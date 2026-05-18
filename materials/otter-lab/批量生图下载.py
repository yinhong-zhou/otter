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
OUTPUT_DIR = Path("角色设定图_批量_20260516")

PROMPTS = [
    {
        "name": "01_虚构毛球生物_奶油白薄荷绿_潮玩3D",
        "prompt": "一张虚构毛球生物的角色设定图，泡泡玛特潮玩3D渲染风格，包含正面/侧面/背面三视图 + 4个表情头像（开心、好奇、困倦、生气）+ 2个动作姿态（坐着、奔跑），奶油白配薄荷绿的配色方案，2.5头身Q版比例，白色背景，统一柔光，设定集排版布局",
    },
    {
        "name": "02_小猫_焦糖棕米白_动画电影",
        "prompt": "一张小猫的角色设定图，皮克斯动画风格，包含正面/侧面/背面三视图 + 4个表情头像（开心、好奇、困倦、生气）+ 2个动作姿态（坐着、奔跑），焦糖棕配米白的配色方案，2.5头身Q版比例，白色背景，统一柔光，设定集排版布局",
    },
    {
        "name": "03_仓鼠_樱花粉灰白_毛绒手办",
        "prompt": "一张仓鼠的角色设定图，毛绒手办质感风格，包含正面/侧面/背面三视图 + 4个表情头像（开心、好奇、困倦、生气）+ 2个动作姿态（坐着、奔跑），樱花粉配灰白的配色方案，2头身超Q版比例，白色背景，统一柔光，设定集排版布局",
    },
    {
        "name": "04_蛋形小怪_雾霾蓝奶黄_黏土定格",
        "prompt": "一张蛋形小怪的角色设定图，黏土定格动画风格，包含正面/侧面/背面三视图 + 4个表情头像（开心、好奇、困倦、生气）+ 2个动作姿态（坐着、奔跑），雾霾蓝配奶黄的配色方案，2头身超Q版比例，白色背景，统一柔光，设定集排版布局",
    },
    {
        "name": "05_类水豚生物_焦糖棕米白_日系赛璐璐",
        "prompt": "一张类水豚生物的角色设定图，日系赛璐璐风格，包含正面/侧面/背面三视图 + 4个表情头像（开心、好奇、困倦、生气）+ 2个动作姿态（坐着、奔跑），焦糖棕配米白的配色方案，3头身均衡比例，白色背景，统一柔光，设定集排版布局",
    },
    {
        "name": "06_小狗_雾霾蓝奶黄_潮玩3D",
        "prompt": "一张小狗的角色设定图，泡泡玛特潮玩3D渲染风格，包含正面/侧面/背面三视图 + 4个表情头像（开心、好奇、困倦、生气）+ 2个动作姿态（坐着、奔跑），雾霾蓝配奶黄的配色方案，2.5头身Q版比例，白色背景，统一柔光，设定集排版布局",
    },
    {
        "name": "07_虚构毛球生物_樱花粉灰白_黏土定格",
        "prompt": "一张虚构毛球生物的角色设定图，黏土定格动画风格，包含正面/侧面/背面三视图 + 4个表情头像（开心、好奇、困倦、生气）+ 2个动作姿态（坐着、奔跑），樱花粉配灰白的配色方案，2头身超Q版比例，白色背景，统一柔光，设定集排版布局",
    },
    {
        "name": "08_小猫_奶油白薄荷绿_毛绒手办",
        "prompt": "一张小猫的角色设定图，毛绒手办质感风格，包含正面/侧面/背面三视图 + 4个表情头像（开心、好奇、困倦、生气）+ 2个动作姿态（坐着、奔跑），奶油白配薄荷绿的配色方案，2头身超Q版比例，白色背景，统一柔光，设定集排版布局",
    },
    {
        "name": "09_蛋形小怪_焦糖棕米白_动画电影",
        "prompt": "一张蛋形小怪的角色设定图，皮克斯动画风格，包含正面/侧面/背面三视图 + 4个表情头像（开心、好奇、困倦、生气）+ 2个动作姿态（坐着、奔跑），焦糖棕配米白的配色方案，2.5头身Q版比例，白色背景，统一柔光，设定集排版布局",
    },
    {
        "name": "10_仓鼠_雾霾蓝奶黄_日系赛璐璐",
        "prompt": "一张仓鼠的角色设定图，日系赛璐璐风格，包含正面/侧面/背面三视图 + 4个表情头像（开心、好奇、困倦、生气）+ 2个动作姿态（坐着、奔跑），雾霾蓝配奶黄的配色方案，3头身均衡比例，白色背景，统一柔光，设定集排版布局",
    },
]

PROMPT_SUFFIX = (
    "补充约束：同一张设定图里的所有视图、表情头像和动作姿态必须保持同一个角色设计，"
    "五官、身体比例、配色和材质一致；干净的角色设定集网格排版，留白充足，"
    "不要文字标签，不要水印，不要logo，不要复杂背景。"
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
