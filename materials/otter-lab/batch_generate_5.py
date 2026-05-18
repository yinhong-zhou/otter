import base64
import json
import os
import sys
import time
from getpass import getpass
from pathlib import Path
from urllib.parse import urlparse

import requests


API_URL = os.getenv(
    "IMAGE_API_URL",
    "https://api.openai-next.com/v1/images/generations",
)
API_KEY_ENV = "IMAGE_API_KEY"
MODEL = os.getenv("IMAGE_MODEL", "gemini-2.5-flash-image")
SIZE = os.getenv("IMAGE_SIZE", "1024x1024")
OUTPUT_DIR = Path("character_sheets_batch_20260516_set2")

PROMPTS = [
    {
        "name": "01_egg_creature_cream_mint_popmart",
        "prompt": "A character design sheet of a fictional egg-shaped creature pet, Popmart collectible toy 3D render style, including front/side/back three-view orthographic drawings + 4 facial expression close-ups (happy, curious, sleepy, grumpy) + 2 action poses (sitting, running), cream white paired with mint green color scheme, 2.5-head super chibi proportions, oversized glossy eyes with catchlights, smooth matte plastic texture with subtle subsurface scattering, white background, uniform soft studio lighting, character design sheet layout with labels",
    },
    {
        "name": "02_capybara_creature_caramel_oat_pixar",
        "prompt": "A character design sheet of a fictional capybara-like creature pet, Pixar animation 3D style, including front/side/back three-view orthographic drawings + 4 facial expression close-ups (joyful, puzzled, drowsy, pouty) + 2 action poses (sitting calmly, waddling run), warm caramel brown paired with oat white color scheme, 3-head balanced chibi proportions, velvety fur texture with fine strand detail, expressive large eyes, white background, uniform warm rim lighting, character design sheet layout with clean annotation lines",
    },
    {
        "name": "03_fluffy_ball_misty_blue_plush",
        "prompt": "A character design sheet of a fictional round fluffy ball creature pet, plush stuffed toy render style, including front/side/back three-view orthographic drawings + 4 facial expression close-ups (delighted, curious, sleepy, startled) + 2 action poses (curled up resting, bouncing), misty blue paired with warm cream yellow color scheme, 2-head ultra-chibi proportions, extremely dense soft fur texture, tiny stubby limbs, bead-like shiny eyes, white background, uniform diffused soft lighting, character design sheet layout",
    },
    {
        "name": "04_hamster_sakura_gray_cel_shading",
        "prompt": "A character design sheet of a hamster pet character, Japanese cel-shading anime illustration style, including front/side/back three-view orthographic drawings + 4 facial expression close-ups (cheerful, inquisitive, drowsy, puffed-cheek angry) + 2 action poses (sitting with chubby cheeks, running with tiny legs blurred), sakura pink paired with soft gray-white color scheme, 2.5-head Q-version chibi proportions, clean ink outlines with flat color fills and two-tone cel shading, white background, uniform flat lighting, character design sheet layout with Japanese annotation style",
    },
    {
        "name": "05_small_egg_creature_fog_blue_clay",
        "prompt": "A character design sheet of a fictional small egg-shaped creature pet, clay stop-motion animation style (Aardman / Laika aesthetic), including front/side/back three-view orthographic drawings + 4 facial expression close-ups (gleeful, wondering, yawning, grumbling) + 2 action poses (waddling stand, tiptoeing sneak), fog blue paired with butter yellow color scheme, 2.5-head chibi proportions, visible clay fingerprint texture on surface, hand-sculpted imperfect edges, expressive mouth shapes, white background, uniform even studio lighting, character design sheet layout",
    },
]

PROMPT_SUFFIX = (
    "Additional constraints: keep every view, expression, and pose on the sheet as the same character design; "
    "maintain consistent face, silhouette, proportions, materials, and color palette; use a clean grid-based "
    "character sheet composition with generous spacing; labels and annotation lines should be minimal and neat "
    "when requested; no watermark, no logo, no extra characters, no complex background."
)


def get_api_key():
    api_key = os.getenv(API_KEY_ENV)
    if not api_key:
        api_key = getpass(f"Enter API key or set {API_KEY_ENV}: ").strip()
    if not api_key:
        sys.exit("Missing API key.")
    return api_key


def choose_extension(url, default=".png"):
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        return suffix
    return default


def generate_image(session, headers, prompt):
    payload = {
        "model": MODEL,
        "prompt": f"{prompt}\n{PROMPT_SUFFIX}",
        "n": 1,
        "size": SIZE,
    }
    response = session.post(API_URL, headers=headers, json=payload, timeout=120)
    response.raise_for_status()
    return response.json(), payload


def save_generated_image(session, item, result):
    data = result.get("data") or []
    if not data:
        raise ValueError("Response JSON has no data items.")

    first = data[0]
    if first.get("url"):
        url = first["url"]
        image_response = session.get(url, timeout=120)
        image_response.raise_for_status()
        ext = choose_extension(url)
        image_path = OUTPUT_DIR / f"{item['name']}{ext}"
        image_path.write_bytes(image_response.content)
        return image_path, url

    if first.get("b64_json"):
        image_path = OUTPUT_DIR / f"{item['name']}.png"
        image_path.write_bytes(base64.b64decode(first["b64_json"]))
        return image_path, None

    raise ValueError("Response item has neither url nor b64_json.")


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    api_key = get_api_key()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    manifest = {
        "api_url": API_URL,
        "model": MODEL,
        "size": SIZE,
        "output_dir": str(OUTPUT_DIR),
        "items": [],
    }

    with requests.Session() as session:
        for index, item in enumerate(PROMPTS, start=1):
            print(f"[{index}/{len(PROMPTS)}] Generating {item['name']}...", flush=True)
            record = {
                "name": item["name"],
                "original_prompt": item["prompt"],
                "status": "started",
            }

            try:
                result, payload = generate_image(session, headers, item["prompt"])
                image_path, url = save_generated_image(session, item, result)
                record.update(
                    {
                        "status": "ok",
                        "file": str(image_path),
                        "url": url,
                        "request": {
                            "model": payload["model"],
                            "prompt": payload["prompt"],
                            "n": payload["n"],
                            "size": payload["size"],
                        },
                        "response": result,
                    }
                )
                print(f"  Saved {image_path}", flush=True)
            except requests.HTTPError as exc:
                response = exc.response
                body = response.text.strip() if response is not None else str(exc)
                record.update(
                    {
                        "status": "http_error",
                        "error": body[:2000],
                        "status_code": response.status_code if response is not None else None,
                    }
                )
                print(f"  HTTP error: {record['error']}", flush=True)
            except Exception as exc:
                record.update({"status": "error", "error": str(exc)})
                print(f"  Error: {exc}", flush=True)

            manifest["items"].append(record)
            (OUTPUT_DIR / "manifest.json").write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            time.sleep(1)

    ok_count = sum(1 for item in manifest["items"] if item["status"] == "ok")
    print(f"Done. Saved {ok_count}/{len(PROMPTS)} images to {OUTPUT_DIR}", flush=True)


if __name__ == "__main__":
    main()
