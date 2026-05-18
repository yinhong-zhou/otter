import argparse
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
DEFAULT_UPLOAD_URL = "https://api.openai-next.com/fileSystem/upload"
DEFAULT_EDIT_ENDPOINT = "https://draw.openai-next.com/xai-video/v1/videos/edits"
DEFAULT_STATUS_ENDPOINT = "https://draw.openai-next.com/xai-video/v1/videos"
DEFAULT_MODEL = "grok-imagine-video"


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
    return redacted


def read_json_response(response: requests.Response) -> dict[str, Any]:
    try:
        return response.json()
    except ValueError:
        return {"raw_text": response.text}


def headers(api_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}"}


def json_headers(api_key: str) -> dict[str, str]:
    result = headers(api_key)
    result["Content-Type"] = "application/json"
    return result


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


def iter_urls(value: Any) -> list[str]:
    return [item for item in iter_strings(value) if item.startswith("http")]


def iter_video_urls(value: Any) -> list[str]:
    return [
        url
        for url in iter_urls(value)
        if any(marker in url.lower() for marker in [".mp4", ".mov", "video"])
    ]


def infer_mime(path: Path) -> str:
    return mimetypes.guess_type(str(path))[0] or "application/octet-stream"


def upload_file(file_path: Path, upload_url: str) -> dict[str, Any]:
    api_key = get_api_key()
    if not file_path.exists():
        raise SystemExit(f"File not found: {file_path}")
    with file_path.open("rb") as file_obj:
        response = requests.post(
            upload_url,
            headers=headers(api_key),
            files={"file": (file_path.name, file_obj, infer_mime(file_path))},
            timeout=300,
        )
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise SystemExit(f"HTTP {response.status_code}: {redact_sensitive_text(response.text)}") from exc
    return read_json_response(response)


def extract_uploaded_url(upload_response: dict[str, Any]) -> str:
    urls = iter_urls(upload_response)
    if urls:
        return urls[0]
    raise SystemExit("Upload response did not contain an HTTP URL.")


def submit_edit(video_url: str, prompt: str, endpoint: str, model: str) -> dict[str, Any]:
    api_key = get_api_key()
    payload = {
        "model": model,
        "prompt": prompt,
        "video": {"url": video_url},
    }
    response = requests.post(endpoint, headers=json_headers(api_key), json=payload, timeout=180)
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise SystemExit(f"HTTP {response.status_code}: {redact_sensitive_text(response.text)}") from exc
    return read_json_response(response)


def query_status(request_id: str, endpoint: str) -> dict[str, Any]:
    api_key = get_api_key()
    response = requests.get(f"{endpoint.rstrip('/')}/{request_id}", headers=headers(api_key), timeout=120)
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise SystemExit(f"HTTP {response.status_code}: {redact_sensitive_text(response.text)}") from exc
    return read_json_response(response)


def read_prompt(args: argparse.Namespace) -> str:
    if args.prompt_file:
        return Path(args.prompt_file).resolve().read_text(encoding="utf-8").strip()
    if args.prompt:
        return args.prompt.strip()
    raise SystemExit("Pass --prompt or --prompt-file.")


def command_upload(args: argparse.Namespace) -> None:
    result = upload_file(Path(args.file).resolve(), args.upload_url)
    out_path = Path(args.out).resolve()
    write_json(out_path, result)
    print(f"Upload response saved to {out_path}")
    print(f"Uploaded URL: {extract_uploaded_url(result)}")


def command_submit(args: argparse.Namespace) -> None:
    prompt = read_prompt(args)
    result = submit_edit(args.video_url, prompt, args.endpoint, args.model)
    out_path = Path(args.out).resolve()
    write_json(out_path, result)
    print(f"Edit response saved to {out_path}")
    request_id = find_first_key(result, {"request_id", "id", "task_id"})
    if request_id:
        print(f"Request id: {request_id}")


def command_submit_local(args: argparse.Namespace) -> None:
    prompt = read_prompt(args)
    upload_result = upload_file(Path(args.video).resolve(), args.upload_url)
    upload_out = Path(args.upload_out).resolve()
    write_json(upload_out, upload_result)
    video_url = extract_uploaded_url(upload_result)
    print(f"Upload response saved to {upload_out}")
    print(f"Uploaded URL: {video_url}")

    result = submit_edit(video_url, prompt, args.endpoint, args.model)
    out_path = Path(args.out).resolve()
    write_json(out_path, result)
    print(f"Edit response saved to {out_path}")
    request_id = find_first_key(result, {"request_id", "id", "task_id"})
    if request_id:
        print(f"Request id: {request_id}")


def command_status(args: argparse.Namespace) -> None:
    result = query_status(args.request_id, args.endpoint)
    out_path = Path(args.out).resolve()
    write_json(out_path, result)
    print(f"Status response saved to {out_path}")
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
            out_path = out_dir / f"xai_video_edit_{index:02d}{suffix}"
            response = session.get(url, timeout=300)
            response.raise_for_status()
            out_path.write_bytes(response.content)
            print(f"Downloaded {out_path}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="OpenAI Next xAI video edit helper.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    upload = subparsers.add_parser("upload")
    upload.add_argument("--file", required=True)
    upload.add_argument("--upload-url", default=DEFAULT_UPLOAD_URL)
    upload.add_argument("--out", required=True)
    upload.set_defaults(func=command_upload)

    submit = subparsers.add_parser("submit")
    submit.add_argument("--video-url", required=True)
    submit.add_argument("--prompt", default=None)
    submit.add_argument("--prompt-file", default=None)
    submit.add_argument("--model", default=DEFAULT_MODEL)
    submit.add_argument("--endpoint", default=DEFAULT_EDIT_ENDPOINT)
    submit.add_argument("--out", required=True)
    submit.set_defaults(func=command_submit)

    submit_local = subparsers.add_parser("submit-local")
    submit_local.add_argument("--video", required=True)
    submit_local.add_argument("--prompt", default=None)
    submit_local.add_argument("--prompt-file", default=None)
    submit_local.add_argument("--model", default=DEFAULT_MODEL)
    submit_local.add_argument("--upload-url", default=DEFAULT_UPLOAD_URL)
    submit_local.add_argument("--endpoint", default=DEFAULT_EDIT_ENDPOINT)
    submit_local.add_argument("--upload-out", required=True)
    submit_local.add_argument("--out", required=True)
    submit_local.set_defaults(func=command_submit_local)

    status = subparsers.add_parser("status")
    status.add_argument("--request-id", required=True)
    status.add_argument("--endpoint", default=DEFAULT_STATUS_ENDPOINT)
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
