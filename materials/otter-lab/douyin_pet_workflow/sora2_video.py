import argparse
import base64
import json
import os
import re
import sys
from getpass import getpass
from pathlib import Path
from typing import Any

import requests


def load_env_files() -> None:
    """Load simple KEY=VALUE pairs without requiring python-dotenv."""
    candidates = [
        Path.cwd() / ".env",
        Path(__file__).resolve().parent / ".env",
    ]
    for env_path in candidates:
        if not env_path.exists():
            continue
        for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key:
                os.environ.setdefault(key, value)


load_env_files()

DEFAULT_ENDPOINT = os.getenv("OPENAI_NEXT_VIDEOS_ENDPOINT", "https://draw.openai-next.com/v1/videos")
DEFAULT_MODEL = "sora-2"
DEFAULT_SIZE = "1280x720"
DEFAULT_SECONDS = "8"
API_KEY_ENV = "OPENAI_NEXT_API_KEY"
VALID_SIZES = {"720x1280", "1280x720", "1024x1792", "1792x1024"}
VALID_SECONDS = {"4", "8", "12"}


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def read_json_response(response: requests.Response) -> dict[str, Any]:
    try:
        return response.json()
    except ValueError:
        return {"raw_text": response.text}


def get_api_key() -> str:
    api_key = os.getenv(API_KEY_ENV)
    if not api_key:
        api_key = getpass(f"Enter {API_KEY_ENV}: ").strip()
    if not api_key:
        sys.exit(f"Missing {API_KEY_ENV}.")
    return api_key


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


def infer_mime(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if suffix == ".png":
        return "image/png"
    if suffix == ".webp":
        return "image/webp"
    return "application/octet-stream"


def image_to_data_url(path: Path) -> str:
    mime = infer_mime(path)
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{data}"


def prompt_from_plan(plan_path: Path) -> tuple[str, Path]:
    plan = load_json(plan_path)
    prompt = plan["prompts"]["video_prompt"]
    reference_image = Path(plan["character"]["reference_image_resolved"])
    return prompt, reference_image


def build_summary(args: argparse.Namespace, prompt: str, reference_image: Path) -> dict[str, Any]:
    validate_options(args)
    if args.transport == "json":
        content_type = "application/json"
        input_reference: Any = {
            "image_url": "<base64 data URL omitted in dry-run summary>",
            "source_file": str(reference_image),
        }
    else:
        content_type = "multipart/form-data"
        input_reference = str(reference_image)

    return {
        "endpoint": args.endpoint,
        "method": "POST",
        "content_type": content_type,
        "transport": args.transport,
        "fields": {
            "prompt": prompt,
            "model": args.model,
            "size": args.size,
            "seconds": args.seconds,
            "input_reference": input_reference,
        },
    }


def validate_options(args: argparse.Namespace) -> None:
    if args.size not in VALID_SIZES:
        raise SystemExit(f"Invalid --size {args.size}. Use one of: {', '.join(sorted(VALID_SIZES))}.")
    if str(args.seconds) not in VALID_SECONDS:
        raise SystemExit(f"Invalid --seconds {args.seconds}. Use one of: {', '.join(sorted(VALID_SECONDS))}.")


def build_json_payload(args: argparse.Namespace, prompt: str, reference_image: Path) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "prompt": prompt,
        "model": args.model,
        "size": args.size,
        "seconds": str(args.seconds),
    }
    if args.input_reference_file_id:
        payload["input_reference"] = {"file_id": args.input_reference_file_id}
    else:
        payload["input_reference"] = {"image_url": image_to_data_url(reference_image)}
    return payload


def submit_json_video(args: argparse.Namespace, prompt: str, reference_image: Path) -> dict[str, Any]:
    api_key = get_api_key()
    payload = build_json_payload(args, prompt, reference_image)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    response = requests.post(args.endpoint, headers=headers, json=payload, timeout=180)

    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise SystemExit(f"HTTP {response.status_code}: {redact_sensitive_text(response.text)}") from exc

    return read_json_response(response)


def submit_multipart_video(args: argparse.Namespace, prompt: str, reference_image: Path) -> dict[str, Any]:
    api_key = get_api_key()
    data = {
        "prompt": prompt,
        "model": args.model,
        "size": args.size,
        "seconds": args.seconds,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
    }

    with reference_image.open("rb") as file_obj:
        files = {
            "input_reference": (
                reference_image.name,
                file_obj,
                infer_mime(reference_image),
            )
        }
        response = requests.post(args.endpoint, headers=headers, data=data, files=files, timeout=180)

    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise SystemExit(f"HTTP {response.status_code}: {redact_sensitive_text(response.text)}") from exc

    return read_json_response(response)


def submit_video(args: argparse.Namespace, prompt: str, reference_image: Path) -> dict[str, Any]:
    validate_options(args)
    if not reference_image.exists() and not args.input_reference_file_id:
        raise SystemExit(f"Reference image not found: {reference_image}")
    if args.transport == "json":
        return submit_json_video(args, prompt, reference_image)
    return submit_multipart_video(args, prompt, reference_image)


def command_request(args: argparse.Namespace) -> None:
    if args.plan:
        prompt, reference_image = prompt_from_plan(Path(args.plan).resolve())
    else:
        if not args.prompt or not args.input_reference:
            raise SystemExit("Pass --plan or both --prompt and --input-reference.")
        prompt = args.prompt
        reference_image = Path(args.input_reference).resolve()

    summary = build_summary(args, prompt, reference_image)
    out_path = Path(args.out).resolve()
    write_json(out_path, summary)
    print(f"Multipart request summary saved to {out_path}")


def command_submit(args: argparse.Namespace) -> None:
    if args.plan:
        prompt, reference_image = prompt_from_plan(Path(args.plan).resolve())
    else:
        if not args.prompt or not args.input_reference:
            raise SystemExit("Pass --plan or both --prompt and --input-reference.")
        prompt = args.prompt
        reference_image = Path(args.input_reference).resolve()

    result = submit_video(args, prompt, reference_image)
    out_path = Path(args.out).resolve()
    write_json(out_path, result)
    print(f"Response saved to {out_path}")
    video_id = find_first_key(result, {"id", "video_id", "task_id"})
    if video_id:
        print(f"Video id: {video_id}")


def find_first_key(value: Any, keys: set[str]) -> Any:
    if isinstance(value, dict):
        for key, item in value.items():
            if key in keys and item:
                return item
        for item in value.values():
            found = find_first_key(item, keys)
            if found:
                return found
    elif isinstance(value, list):
        for item in value:
            found = find_first_key(item, keys)
            if found:
                return found
    return None


def iter_urls(value: Any) -> list[str]:
    urls: list[str] = []
    if isinstance(value, dict):
        for key, item in value.items():
            if isinstance(item, str) and item.startswith("http") and "url" in key.lower():
                urls.append(item)
            else:
                urls.extend(iter_urls(item))
    elif isinstance(value, list):
        for item in value:
            urls.extend(iter_urls(item))
    return urls


def iter_video_urls(value: Any) -> list[str]:
    return [
        url
        for url in iter_urls(value)
        if any(marker in url.lower() for marker in [".mp4", ".mov", "video"])
    ]


def command_status(args: argparse.Namespace) -> None:
    api_key = get_api_key()
    endpoint = args.endpoint.rstrip("/")
    response = requests.get(
        f"{endpoint}/{args.video_id}",
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=60,
    )
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise SystemExit(f"HTTP {response.status_code}: {redact_sensitive_text(response.text)}") from exc

    result = read_json_response(response)
    out_path = Path(args.out).resolve()
    write_json(out_path, result)
    print(f"Status saved to {out_path}")
    status = find_first_key(result, {"status", "state"})
    progress = find_first_key(result, {"progress"})
    if status:
        print(f"Status: {status}")
    if progress is not None:
        print(f"Progress: {progress}")
    video_urls = iter_video_urls(result)
    if video_urls:
        print(f"Video URL: {video_urls[0]}")


def command_download(args: argparse.Namespace) -> None:
    data = load_json(Path(args.response).resolve())
    video_urls = iter_video_urls(data)
    if not video_urls:
        raise SystemExit("No video URL found in response JSON.")

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    with requests.Session() as session:
        for index, url in enumerate(video_urls, start=1):
            suffix = ".mov" if ".mov" in url.lower() else ".mp4"
            out_path = out_dir / f"sora2_video_{index:02d}{suffix}"
            response = session.get(url, timeout=180)
            response.raise_for_status()
            out_path.write_bytes(response.content)
            print(f"Downloaded {out_path}")


def add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--plan", default=None, help="Workflow plan JSON; uses prompts.video_prompt and character reference image.")
    parser.add_argument("--prompt", default=None)
    parser.add_argument("--input-reference", default=None)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--size", default=DEFAULT_SIZE)
    parser.add_argument("--seconds", default=DEFAULT_SECONDS)
    parser.add_argument("--transport", default="json", choices=["json", "multipart"])
    parser.add_argument("--input-reference-file-id", default=None, help="Use an uploaded file_id instead of image_url data URL.")
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT)
    parser.add_argument("--out", required=True)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Sora-2 multipart video API helper.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    request = subparsers.add_parser("request", help="Write a multipart request summary without submitting.")
    add_common_args(request)
    request.set_defaults(func=command_request)

    submit = subparsers.add_parser("submit", help="Submit multipart video creation request.")
    add_common_args(submit)
    submit.set_defaults(func=command_submit)

    status = subparsers.add_parser("status", help="Query video generation status by id.")
    status.add_argument("--video-id", required=True)
    status.add_argument("--endpoint", default=DEFAULT_ENDPOINT)
    status.add_argument("--out", required=True)
    status.set_defaults(func=command_status)

    download = subparsers.add_parser("download", help="Download video URLs found in a response/status JSON.")
    download.add_argument("--response", required=True)
    download.add_argument("--out-dir", default="douyin_pet_workflow/runs/downloads")
    download.set_defaults(func=command_download)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
