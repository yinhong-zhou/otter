import argparse
import base64
import json
import mimetypes
import os
import re
import sys
from getpass import getpass
from pathlib import Path
from typing import Any

import requests


API_KEY_ENV = "OPENAI_NEXT_API_KEY"
DEFAULT_TASKS_URL = "https://draw.openai-next.com/seedance/v3/contents/generations/tasks"
DEFAULT_MODEL = "doubao-seedance-2-0-260128"


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


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def get_api_key() -> str:
    api_key = os.getenv("SEEDANCE_API_KEY") or os.getenv(API_KEY_ENV) or os.getenv("ARK_API_KEY")
    if not api_key:
        api_key = getpass("Enter SEEDANCE_API_KEY or OPENAI_NEXT_API_KEY: ").strip()
    if not api_key:
        sys.exit("Missing SEEDANCE_API_KEY or OPENAI_NEXT_API_KEY.")
    return api_key


def redact_sensitive_text(text: str) -> str:
    redacted = text
    candidates = [
        os.getenv("SEEDANCE_API_KEY", ""),
        os.getenv(API_KEY_ENV, ""),
        os.getenv("ARK_API_KEY", ""),
    ]
    for candidate in list(candidates):
        if candidate.startswith("sk-"):
            candidates.append(candidate[3:])
    for candidate in candidates:
        if candidate:
            redacted = redacted.replace(candidate, "[REDACTED]")
    redacted = re.sub(r"sk-[A-Za-z0-9_-]{12,}", "sk-[REDACTED]", redacted)
    return redacted


def infer_mime(path: Path) -> str:
    return mimetypes.guess_type(str(path))[0] or "application/octet-stream"


def file_to_data_url(path: Path) -> str:
    mime = infer_mime(path)
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{data}"


def read_json_response(response: requests.Response) -> dict[str, Any]:
    try:
        return response.json()
    except ValueError:
        return {"raw_text": response.text}


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


def iter_strings(value: Any) -> list[str]:
    strings: list[str] = []
    if isinstance(value, str):
        strings.append(value)
    elif isinstance(value, dict):
        for item in value.values():
            strings.extend(iter_strings(item))
    elif isinstance(value, list):
        for item in value:
            strings.extend(iter_strings(item))
    return strings


def iter_video_urls(value: Any) -> list[str]:
    return [
        item
        for item in iter_strings(value)
        if item.startswith("http") and any(marker in item.lower() for marker in [".mp4", ".mov", "video"])
    ]


def image_content(path: Path, role: str) -> dict[str, Any]:
    return {
        "type": "image_url",
        "image_url": {"url": file_to_data_url(path)},
        "role": role,
    }


def build_payload(args: argparse.Namespace) -> dict[str, Any]:
    prompt = Path(args.prompt_file).resolve().read_text(encoding="utf-8").strip()
    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]

    if args.reference_image:
        content.append(image_content(Path(args.reference_image).resolve(), "character_reference"))
    if args.first_frame:
        content.append(image_content(Path(args.first_frame).resolve(), "first_frame_reference"))
    for index, frame_path in enumerate(args.keyframe or [], start=1):
        content.append(image_content(Path(frame_path).resolve(), f"motion_keyframe_{index:02d}"))
    if args.last_frame:
        content.append(image_content(Path(args.last_frame).resolve(), "last_frame_reference"))
    if args.source_video_url:
        content.append(
            {
                "type": "video_url",
                "video_url": {"url": args.source_video_url},
                "role": "source_video_reference",
            }
        )

    payload: dict[str, Any] = {
        "model": args.model,
        "content": content,
        "resolution": args.resolution,
        "ratio": args.ratio,
        "duration": args.duration,
        "generate_audio": args.generate_audio,
        "watermark": args.watermark,
        "return_last_frame": True,
    }
    if args.seed is not None:
        payload["seed"] = args.seed
    if args.safety_identifier:
        payload["safety_identifier"] = args.safety_identifier
    return payload


def summarize_payload(args: argparse.Namespace, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "endpoint": args.tasks_url,
        "model": payload["model"],
        "resolution": payload["resolution"],
        "ratio": payload["ratio"],
        "duration": payload["duration"],
        "generate_audio": payload["generate_audio"],
        "watermark": payload["watermark"],
        "source_video_url": args.source_video_url,
        "prompt_file": str(Path(args.prompt_file).resolve()),
        "reference_image": str(Path(args.reference_image).resolve()) if args.reference_image else None,
        "first_frame": str(Path(args.first_frame).resolve()) if args.first_frame else None,
        "keyframes": [str(Path(item).resolve()) for item in args.keyframe or []],
        "last_frame": str(Path(args.last_frame).resolve()) if args.last_frame else None,
        "content_roles": [item.get("role", item["type"]) for item in payload["content"]],
    }


def submit_payload(payload: dict[str, Any], tasks_url: str) -> dict[str, Any]:
    api_key = get_api_key()
    response = requests.post(
        tasks_url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=180,
    )
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise SystemExit(f"HTTP {response.status_code}: {redact_sensitive_text(response.text)}") from exc
    return read_json_response(response)


def query_task(task_id: str, tasks_url: str) -> dict[str, Any]:
    api_key = get_api_key()
    response = requests.get(
        f"{tasks_url.rstrip('/')}/{task_id}",
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=120,
    )
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise SystemExit(f"HTTP {response.status_code}: {redact_sensitive_text(response.text)}") from exc
    return read_json_response(response)


def command_submit(args: argparse.Namespace) -> None:
    payload = build_payload(args)
    write_json(Path(args.summary_out).resolve(), summarize_payload(args, payload))
    result = submit_payload(payload, args.tasks_url)
    out_path = Path(args.out).resolve()
    write_json(out_path, result)
    print(f"Seedance request summary saved to {Path(args.summary_out).resolve()}")
    print(f"Seedance response saved to {out_path}")
    task_id = find_first_key(result, {"id", "task_id", "request_id"})
    if task_id:
        print(f"Task id: {task_id}")


def command_status(args: argparse.Namespace) -> None:
    result = query_task(args.task_id, args.tasks_url)
    out_path = Path(args.out).resolve()
    write_json(out_path, result)
    print(f"Seedance status saved to {out_path}")
    status = find_first_key(result, {"status", "state"})
    if status:
        print(f"Status: {status}")
    video_urls = iter_video_urls(result)
    if video_urls:
        print(f"Video URL: {video_urls[0]}")


def command_download(args: argparse.Namespace) -> None:
    data = load_json(Path(args.response).resolve())
    urls = iter_video_urls(data)
    if not urls:
        raise SystemExit("No video URL found in response JSON.")
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    with requests.Session() as session:
        for index, url in enumerate(urls, start=1):
            suffix = ".mov" if ".mov" in url.lower() else ".mp4"
            out_path = out_dir / f"seedance_otter_gym_{index:02d}{suffix}"
            response = session.get(url, timeout=300)
            response.raise_for_status()
            out_path.write_bytes(response.content)
            print(f"Downloaded {out_path}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Seedance native video generation helper.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    submit = subparsers.add_parser("submit")
    submit.add_argument("--prompt-file", required=True)
    submit.add_argument("--source-video-url", default=None)
    submit.add_argument("--reference-image", default=None)
    submit.add_argument("--first-frame", default=None)
    submit.add_argument("--keyframe", action="append", default=[])
    submit.add_argument("--last-frame", default=None)
    submit.add_argument("--tasks-url", default=DEFAULT_TASKS_URL)
    submit.add_argument("--model", default=DEFAULT_MODEL)
    submit.add_argument("--resolution", default="720p", choices=["480p", "720p", "1080p"])
    submit.add_argument("--ratio", default="9:16", choices=["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"])
    submit.add_argument("--duration", type=int, default=8)
    submit.add_argument("--seed", type=int, default=None)
    submit.add_argument("--watermark", action="store_true")
    submit.add_argument("--safety-identifier", default=None)
    audio = submit.add_mutually_exclusive_group()
    audio.add_argument("--generate-audio", dest="generate_audio", action="store_true", default=False)
    audio.add_argument("--silent", dest="generate_audio", action="store_false")
    submit.add_argument("--summary-out", required=True)
    submit.add_argument("--out", required=True)
    submit.set_defaults(func=command_submit)

    status = subparsers.add_parser("status")
    status.add_argument("--task-id", required=True)
    status.add_argument("--tasks-url", default=DEFAULT_TASKS_URL)
    status.add_argument("--out", required=True)
    status.set_defaults(func=command_status)

    download = subparsers.add_parser("download")
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
