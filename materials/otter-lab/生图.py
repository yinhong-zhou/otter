import json
import os
import sys
from getpass import getpass

import requests


API_URL = os.getenv(
    "IMAGE_API_URL",
    "https://api.openai-next.com/v1/images/generations",
)
API_KEY_ENV = "IMAGE_API_KEY"


def main():
    api_key = os.getenv(API_KEY_ENV)
    if not api_key:
        api_key = getpass(f"Enter API key or set {API_KEY_ENV}: ").strip()
    if not api_key:
        sys.exit("Missing API key.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    data = {
        "model": "gemini-2.5-flash-image",
        "prompt": "A cute baby sea otter",
        "n": 1,
        "size": "1024x1024",
    }

    try:
        response = requests.post(API_URL, headers=headers, json=data, timeout=60)
        response.raise_for_status()
    except requests.HTTPError as exc:
        body = response.text.strip()
        if len(body) > 1000:
            body = f"{body[:1000]}..."
        raise SystemExit(f"HTTP {response.status_code}: {body}") from exc
    except requests.RequestException as exc:
        raise SystemExit(f"Request failed: {exc}") from exc

    try:
        result = response.json()
    except ValueError as exc:
        raise SystemExit(f"Response is not JSON: {response.text}") from exc

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
