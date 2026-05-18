import argparse
import json
import os
import re
import sys
from getpass import getpass
from pathlib import Path
from typing import Any

import requests


def load_env_files() -> None:
    for env_path in [Path.cwd() / ".env", Path(__file__).resolve().parent / ".env"]:
        if not env_path.exists():
            continue
        for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_files()

DEFAULT_BASE_URL = "https://draw.openai-next.com"
DEFAULT_PATH = "/v1/videos"
DEFAULT_MODEL = "sora-2-character"
API_KEY_ENV = "OPENAI_NEXT_API_KEY"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def get_api_key() -> str:
    api_key = os.getenv(API_KEY_ENV)
    if not api_key:
        api_key = getpass(f"Enter {API_KEY_ENV}: ").strip()
    if not api_key:
        sys.exit(f"Missing {API_KEY_ENV}.")
    return api_key


def headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def redact_sensitive_text(text: str) -> str:
    redacted = text
    api_key = os.getenv(API_KEY_ENV, "")
    candidates = [api_key]
    if api_key.startswith("sk-"):
        candidates.append(api_key[3:])

    for candidate in candidates:
        if candidate:
            redacted = redacted.replace(candidate, "[REDACTED]")

    redacted = re.sub(r"sk-[A-Za-z0-9_-]{12,}", "sk-[REDACTED]", redacted)
    redacted = re.sub(r"\[[A-Za-z0-9_-]{24,}\]", "[REDACTED]", redacted)
    return redacted


def build_payload(args: argparse.Namespace) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": args.model,
        "url": args.url,
        "timestamps": args.timestamps,
    }

    if args.prompt:
        payload["prompt"] = args.prompt

    if args.extra_json:
        extra = json.loads(args.extra_json)
        if not isinstance(extra, dict):
            raise SystemExit("--extra-json must be a JSON object.")
        payload.update(extra)

    return payload


def build_payload_from_plan(args: argparse.Namespace) -> dict[str, Any]:
    plan = load_json(Path(args.plan).resolve())
    context = plan.get("context", {})

    url = args.url or context.get("reference_video_url") or context.get("source_video_url")
    if not url:
        raise SystemExit("Missing video URL. Pass --url or add reference_video_url/source_video_url to context JSON.")

    timestamps = args.timestamps or context.get("reference_timestamps") or context.get("timestamps")
    if not timestamps:
        raise SystemExit("Missing timestamps. Pass --timestamps or add reference_timestamps/timestamps to context JSON.")

    payload: dict[str, Any] = {
        "model": args.model,
        "url": url,
        "timestamps": timestamps,
    }

    if args.include_prompt:
        payload["prompt"] = plan["prompts"]["video_prompt"]

    if args.extra_json:
        extra = json.loads(args.extra_json)
        if not isinstance(extra, dict):
            raise SystemExit("--extra-json must be a JSON object.")
        payload.update(extra)

    return payload


def submit(payload: dict[str, Any], endpoint: str) -> dict[str, Any]:
    api_key = get_api_key()
    response = requests.post(endpoint, headers=headers(api_key), json=payload, timeout=120)
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise SystemExit(f"HTTP {response.status_code}: {redact_sensitive_text(response.text)}") from exc

    try:
        return response.json()
    except ValueError:
        return {"raw_text": response.text}


def command_request(args: argparse.Namespace) -> None:
    payload = build_payload(args)
    out_path = Path(args.out).resolve()
    write_json(out_path, payload)
    print(f"Request payload saved to {out_path}")


def command_request_from_plan(args: argparse.Namespace) -> None:
    payload = build_payload_from_plan(args)
    out_path = Path(args.out).resolve()
    write_json(out_path, payload)
    print(f"Request payload saved to {out_path}")


def command_submit(args: argparse.Namespace) -> None:
    payload = load_json(Path(args.payload).resolve())
    endpoint = args.endpoint.rstrip("/") if args.endpoint.endswith(DEFAULT_PATH) else args.endpoint.rstrip("/") + DEFAULT_PATH
    result = submit(payload, endpoint)
    out_path = Path(args.out).resolve()
    write_json(out_path, result)
    print(f"Response saved to {out_path}")


def command_direct(args: argparse.Namespace) -> None:
    payload = build_payload(args)
    endpoint = args.endpoint.rstrip("/") if args.endpoint.endswith(DEFAULT_PATH) else args.endpoint.rstrip("/") + DEFAULT_PATH
    result = submit(payload, endpoint)
    out_path = Path(args.out).resolve()
    write_json(out_path, result)
    print(f"Response saved to {out_path}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="OpenAI-Next draw video API helper.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    request = subparsers.add_parser("request", help="Build a request payload like the screenshot, without submitting.")
    request.add_argument("--model", default=DEFAULT_MODEL)
    request.add_argument("--url", required=True)
    request.add_argument("--timestamps", required=True, help='Comma-separated timestamps, e.g. "1,3".')
    request.add_argument("--prompt", default=None, help="Optional prompt if the endpoint supports it.")
    request.add_argument("--extra-json", default=None, help="Optional JSON object merged into payload.")
    request.add_argument("--out", default="douyin_pet_workflow/runs/openai_next_payload.json")
    request.set_defaults(func=command_request)

    from_plan = subparsers.add_parser("request-from-plan", help="Build a request payload from workflow plan/context.")
    from_plan.add_argument("--plan", required=True)
    from_plan.add_argument("--model", default=DEFAULT_MODEL)
    from_plan.add_argument("--url", default=None)
    from_plan.add_argument("--timestamps", default=None)
    from_plan.add_argument("--include-prompt", action="store_true")
    from_plan.add_argument("--extra-json", default=None)
    from_plan.add_argument("--out", default="douyin_pet_workflow/runs/openai_next_payload.json")
    from_plan.set_defaults(func=command_request_from_plan)

    submit_cmd = subparsers.add_parser("submit", help="Submit a saved payload.")
    submit_cmd.add_argument("--payload", required=True)
    submit_cmd.add_argument("--endpoint", default=DEFAULT_BASE_URL)
    submit_cmd.add_argument("--out", default="douyin_pet_workflow/runs/openai_next_response.json")
    submit_cmd.set_defaults(func=command_submit)

    direct = subparsers.add_parser("direct", help="Build and submit in one step.")
    direct.add_argument("--model", default=DEFAULT_MODEL)
    direct.add_argument("--url", required=True)
    direct.add_argument("--timestamps", required=True)
    direct.add_argument("--prompt", default=None)
    direct.add_argument("--extra-json", default=None)
    direct.add_argument("--endpoint", default=DEFAULT_BASE_URL)
    direct.add_argument("--out", default="douyin_pet_workflow/runs/openai_next_response.json")
    direct.set_defaults(func=command_direct)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
