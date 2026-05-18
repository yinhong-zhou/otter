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


DEFAULT_TASKS_URL = "https://draw.openai-next.com/seedance/v3/contents/generations/tasks"
DEFAULT_MODEL = "doubao-seedance-2-0-260128"
DEFAULT_CHARACTER = Path(__file__).resolve().parent / "characters" / "magic_otter.json"
DEFAULT_RUNS_DIR = Path(__file__).resolve().parent / "runs"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def compact_list(values: Any) -> str:
    if isinstance(values, list):
        return "、".join(str(item) for item in values if item)
    if values is None:
        return ""
    return str(values)


def context_text(context: dict[str, Any]) -> str:
    parts = [
        context.get("source_video_summary", ""),
        context.get("detected_scene", ""),
        compact_list(context.get("detected_mood")),
        compact_list(context.get("detected_objects")),
        compact_list(context.get("detected_actions")),
    ]
    return " ".join(parts).lower()


def contains_any(text: str, keywords: list[str]) -> bool:
    return any(keyword.lower() in text for keyword in keywords)


def infer_encounter_mode(context: dict[str, Any]) -> str:
    preferred = context.get("preferred_encounter")
    if preferred in {"window_peek", "street_encounter", "portal_cameo"}:
        return preferred

    text = context_text(context)
    if contains_any(text, ["战争", "战场", "诺曼底", "登陆", "爆炸", "士兵", "历史", "电影"]):
        return "portal_cameo"
    if contains_any(text, ["探店", "夜市", "摆摊", "地铁", "街头", "通勤", "城市", "商场"]):
        return "street_encounter"
    if contains_any(text, ["健身", "跑步机", "睡觉", "厨房", "学习", "家里", "emo", "治愈"]):
        return "window_peek"
    return "portal_cameo"


def infer_otter_variant(context: dict[str, Any], mode: str) -> dict[str, str]:
    text = context_text(context)

    if contains_any(text, ["诺曼底", "战争", "战场", "登陆", "士兵", "爆炸"]):
        return {
            "world_role": "误入战争历史片场的迷路小水獭战地客串",
            "costume": "小钢盔、湿漉漉的救生背心、保留深蓝灰大耳机，肩上背一个夸张玩具 AK 形状道具或玩具无线电",
            "action": "它被海浪拍到沙滩上，狼狈趴下又迅速爬起，回头发现镜头后紧张地比嘘，随后抱着道具向前小跑两步",
            "tone": "可爱荒诞反差，像严肃历史视频里突然串台进来的软萌角色",
            "safety": "非写实、无血腥、无受伤、无真实开火，所有危险道具都玩具化和舞台道具化",
        }

    if contains_any(text, ["煎饼", "夜市", "探店", "美食", "铁板", "摊", "小吃"]):
        return {
            "world_role": "临时接管夜市摊位的笨手笨脚小摊主",
            "costume": "小围裙、一次性厨师帽、保留深蓝灰大耳机，爪子上沾了一点面糊",
            "action": "它试图摊煎饼，面糊转成一个像音符的形状，翻面失败后慌张抬头看镜头，把成品递给路人",
            "tone": "街头烟火气里的轻喜剧，可爱、热闹、生活化",
            "safety": "干净食物质感，不出现危险火焰和烫伤",
        }

    if contains_any(text, ["健身", "跑步", "跑步机", "燃脂", "冲刺", "运动"]):
        return {
            "world_role": "被健身视频激励后偷偷在家锻炼的小水獭",
            "costume": "小运动头带、迷你毛巾、保留深蓝灰大耳机",
            "action": "它在跑步机上努力小跑，越来越跟不上节奏，最后趴在扶手上喘气，发现窗外有人看后强装镇定",
            "tone": "窗边偷窥到的私密日常，笨拙但很努力",
            "safety": "轻松搞笑，不表现痛苦或危险运动",
        }

    if contains_any(text, ["emo", "难过", "雨", "失眠", "治愈", "孤独", "睡前"]):
        return {
            "world_role": "刷到情绪视频后安静递耳机的陪伴型水獭",
            "costume": "柔软毯子、保留深蓝灰大耳机，怀里抱着小贝壳播放器",
            "action": "它坐在窗边听雨，抬头发现镜头后轻轻把一边耳机递过来，水面反光缓慢晃动",
            "tone": "低声、温柔、治愈，像偶然撞见的陪伴瞬间",
            "safety": "不渲染消极情绪，只保留温柔陪伴感",
        }

    return {
        "world_role": "跳进上一条视频平行宇宙里的神奇水獭客串演员",
        "costume": "根据上一条视频主题换上轻量化小道具，但必须保留深蓝灰大耳机和水獭本体特征",
        "action": "它正在认真模仿上一条视频里的关键动作，突然发现镜头后害羞凑近屏幕打招呼",
        "tone": "抖音原生、可爱、荒诞、像刷视频时偶然撞见",
        "safety": "无血腥、无恐怖、无真实伤害、无冒犯性内容",
    }


def build_card_spec(
    character: dict[str, Any],
    context: dict[str, Any],
    mode: str,
    variant: dict[str, str],
) -> dict[str, Any]:
    mode_info = character["encounter_modes"][mode]
    scene = context.get("detected_scene", "刚刷到的视频世界")

    title_by_mode = {
        "window_peek": "它好像被你刚刷的视频影响了",
        "street_encounter": "你在抖音街头撞见了它",
        "portal_cameo": f"它刚刚串台到{scene}",
    }
    subtitle_by_mode = {
        "window_peek": f"你刚刷到「{scene}」，路过窗外时发现它正在跟着学。",
        "street_encounter": f"你刚刷到「{scene}」，下一秒就在街角拍到它。",
        "portal_cameo": f"你刚刷到「{scene}」，它也掉进了这个平行宇宙。",
    }

    return {
        "card_type": mode,
        "card_type_name": mode_info["name"],
        "title": title_by_mode[mode],
        "subtitle": subtitle_by_mode[mode],
        "badges": ["AI 实时", "LIVE" if mode == "window_peek" else "REC"],
        "camera_overlay": mode_info["camera"],
        "light_interactions": character["light_interactions"][:3],
        "heavy_interactions": [
            "A：把它拉回来",
            "B：让它继续演下去",
        ],
        "why_now": {
            "source_video_id": context.get("source_video_id"),
            "source_scene": scene,
            "source_mood": context.get("detected_mood", []),
            "otter_role": variant["world_role"],
        },
    }


def build_video_prompt(
    character: dict[str, Any],
    context: dict[str, Any],
    mode: str,
    variant: dict[str, str],
    duration: int,
    generate_audio: bool,
) -> str:
    mode_info = character["encounter_modes"][mode]
    audio_line = (
        "生成同步声音：环境声要贴近场景，水獭可以有一声很短的可爱反应或吐槽。"
        if generate_audio
        else "无声视频，但动作节奏要清楚。"
    )

    return "\n".join(
        [
            f"生成一条 {duration} 秒竖屏抖音信息流原生 AI 虚拟宠物视频。",
            "产品设定：用户不是在养宠物，而是在刷推荐页时偶然撞见一只生活在抖音里的神奇水獭。",
            f"角色必须参考传入图片：{character['display_name']}，圆润短腿、奶油浅棕毛色、深棕小爪子和尾巴，必须保留深蓝灰大耳机。",
            "把上一条视频里的主体角色或场景关系，切换成这只水獭来演；不要生成普通人类主角。",
            f"上一条视频语义：{context.get('source_video_summary', '')}",
            f"检测场景：{context.get('detected_scene', '')}",
            f"检测情绪：{compact_list(context.get('detected_mood'))}",
            f"关键物件：{compact_list(context.get('detected_objects'))}",
            f"关键动作：{compact_list(context.get('detected_actions'))}",
            f"本次相遇姿态：{mode_info['name']}。{mode_info['camera']}",
            f"水獭本次身份：{variant['world_role']}",
            f"形象切换：{variant['costume']}",
            f"剧情动作：{variant['action']}",
            f"情绪基调：{variant['tone']}",
            "画风：可爱画风，软萌、干净、明亮，适合作为抖音原生宠物卡片；可以有轻微手持感或监控感，但主体清晰。",
            "构图：9:16 竖屏，水獭占画面中心或中下部，保留一点抖音卡片 UI 留白，镜头运动自然。",
            audio_line,
            f"安全约束：{variant['safety']}，不要水印，不要 logo，不要真实血腥，不要令人不适的恐怖细节。",
        ]
    )


def build_cover_prompt(
    character: dict[str, Any],
    context: dict[str, Any],
    mode: str,
    variant: dict[str, str],
) -> str:
    mode_name = character["encounter_modes"][mode]["name"]
    return "\n".join(
        [
            "生成一张抖音信息流原生宠物卡片封面图，9:16 竖版。",
            f"角色：参考图中的{character['display_name']}，保留深蓝灰大耳机、圆润短腿水獭外形和奶油浅棕毛色。",
            f"上一条视频场景：{context.get('detected_scene', '')}",
            f"相遇姿态：{mode_name}",
            f"形象切换：{variant['costume']}",
            f"画面动作：{variant['action']}",
            "风格：可爱画风，抖音原生卡片，画面干净，强记忆点，白色或浅色 UI 留白区域。",
            "不需要生成真实 UI 字体；不要水印，不要 logo。",
        ]
    )


def resolve_reference_path(character_file: Path, character: dict[str, Any]) -> Path:
    raw_path = Path(character["reference_image"])
    if raw_path.is_absolute():
        return raw_path
    return (character_file.parent / raw_path).resolve()


def image_to_data_url(path: Path) -> str:
    suffix = path.suffix.lower().lstrip(".")
    mime = "jpeg" if suffix in {"jpg", "jpeg"} else suffix
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/{mime};base64,{data}"


def build_ark_payload(
    plan: dict[str, Any],
    include_reference_image: bool,
) -> dict[str, Any]:
    content: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": plan["prompts"]["video_prompt"],
        }
    ]

    if include_reference_image:
        ref_path = Path(plan["character"]["reference_image_resolved"])
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": image_to_data_url(ref_path)},
                "role": "reference_image",
            }
        )

    reference_video_url = plan["context"].get("reference_video_url")
    if reference_video_url:
        content.append(
            {
                "type": "video_url",
                "video_url": {"url": reference_video_url},
                "role": "reference_video",
            }
        )

    request = {
        "model": plan["ark"]["model"],
        "content": content,
        "resolution": plan["ark"]["resolution"],
        "ratio": plan["ark"]["ratio"],
        "duration": plan["ark"]["duration"],
        "generate_audio": plan["ark"]["generate_audio"],
        "watermark": plan["ark"]["watermark"],
        "return_last_frame": True,
    }

    seed = plan["ark"].get("seed", -1)
    if seed != -1:
        request["seed"] = seed

    safety_identifier = plan["ark"].get("safety_identifier")
    if safety_identifier:
        request["safety_identifier"] = safety_identifier

    return request


def build_plan(args: argparse.Namespace) -> dict[str, Any]:
    context_file = Path(args.context).resolve()
    character_file = Path(args.character).resolve()
    context = load_json(context_file)
    character = load_json(character_file)
    reference_image = resolve_reference_path(character_file, character)

    mode = infer_encounter_mode(context)
    variant = infer_otter_variant(context, mode)
    card_spec = build_card_spec(character, context, mode, variant)
    video_prompt = build_video_prompt(
        character,
        context,
        mode,
        variant,
        args.duration,
        args.generate_audio,
    )
    cover_prompt = build_cover_prompt(character, context, mode, variant)

    plan = {
        "version": "0.1",
        "goal": "根据上一条抖音视频语义，将神奇水獭切换为对应形象，并生成视频任务与原生卡片文案。",
        "inputs": {
            "context_file": str(context_file),
            "character_file": str(character_file),
        },
        "context": context,
        "character": {
            "id": character["id"],
            "display_name": character["display_name"],
            "reference_image": character["reference_image"],
            "reference_image_resolved": str(reference_image),
        },
        "decision": {
            "encounter_mode": mode,
            "encounter_mode_name": character["encounter_modes"][mode]["name"],
            "otter_variant": variant,
        },
        "card": card_spec,
        "prompts": {
            "video_prompt": video_prompt,
            "cover_image_prompt": cover_prompt,
        },
        "ark": {
            "tasks_url": args.tasks_url,
            "model": args.model,
            "resolution": args.resolution,
            "ratio": args.ratio,
            "duration": args.duration,
            "generate_audio": args.generate_audio,
            "watermark": args.watermark,
            "seed": args.seed,
            "safety_identifier": args.safety_identifier,
        },
    }
    plan["ark_request_preview"] = build_ark_payload(plan, include_reference_image=False)
    plan["ark_request_preview"]["content"].append(
        {
            "type": "image_url",
            "image_url": {"url": "<base64 reference image omitted in preview>"},
            "role": "reference_image",
        }
    )
    return plan


def get_api_key() -> str:
    api_key = os.getenv("SEEDANCE_API_KEY") or os.getenv("OPENAI_NEXT_API_KEY") or os.getenv("ARK_API_KEY")
    if not api_key:
        api_key = getpass("Enter SEEDANCE_API_KEY or OPENAI_NEXT_API_KEY: ").strip()
    if not api_key:
        sys.exit("Missing SEEDANCE_API_KEY or OPENAI_NEXT_API_KEY.")
    return api_key


def ark_headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def redact_sensitive_text(text: str) -> str:
    redacted = text
    candidates = [
        os.getenv("SEEDANCE_API_KEY", ""),
        os.getenv("OPENAI_NEXT_API_KEY", ""),
        os.getenv("ARK_API_KEY", ""),
    ]
    for candidate in list(candidates):
        if candidate.startswith("sk-"):
            candidates.append(candidate[3:])

    for candidate in candidates:
        if candidate:
            redacted = redacted.replace(candidate, "[REDACTED]")

    redacted = re.sub(r"sk-[A-Za-z0-9_-]{12,}", "sk-[REDACTED]", redacted)
    redacted = re.sub(r"\[[A-Za-z0-9_-]{24,}\]", "[REDACTED]", redacted)
    return redacted


def submit_task(args: argparse.Namespace) -> None:
    plan_path = Path(args.plan).resolve()
    plan = load_json(plan_path)
    payload = build_ark_payload(plan, include_reference_image=True)
    api_key = get_api_key()

    response = requests.post(
        plan["ark"].get("tasks_url") or DEFAULT_TASKS_URL,
        headers=ark_headers(api_key),
        json=payload,
        timeout=60,
    )
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise SystemExit(f"HTTP {response.status_code}: {redact_sensitive_text(response.text)}") from exc

    result = response.json()
    out_path = Path(args.out).resolve() if args.out else plan_path.with_name(plan_path.stem + "_task.json")
    write_json(out_path, result)
    print(f"Submitted task. Response saved to {out_path}")
    if result.get("id"):
        print(f"Task id: {result['id']}")


def poll_task(args: argparse.Namespace) -> None:
    api_key = get_api_key()
    tasks_url = args.tasks_url.rstrip("/")
    url = f"{tasks_url}/{args.task_id}"
    response = requests.get(url, headers=ark_headers(api_key), timeout=60)
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise SystemExit(f"HTTP {response.status_code}: {redact_sensitive_text(response.text)}") from exc

    result = response.json()
    out_path = Path(args.out).resolve() if args.out else DEFAULT_RUNS_DIR / f"{args.task_id}_status.json"
    write_json(out_path, result)
    print(f"Task status saved to {out_path}")
    if result.get("status"):
        print(f"Status: {result['status']}")


def iter_urls(value: Any) -> list[str]:
    urls: list[str] = []
    if isinstance(value, dict):
        for key, item in value.items():
            if isinstance(item, str) and "url" in key.lower() and item.startswith("http"):
                urls.append(item)
            else:
                urls.extend(iter_urls(item))
    elif isinstance(value, list):
        for item in value:
            urls.extend(iter_urls(item))
    return urls


def download_outputs(args: argparse.Namespace) -> None:
    response_path = Path(args.task_response).resolve()
    data = load_json(response_path)
    urls = iter_urls(data)
    video_urls = [
        url for url in urls if any(part in url.lower() for part in [".mp4", ".mov", "video"])
    ]
    if not video_urls:
        raise SystemExit("No video URL found in task response.")

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    with requests.Session() as session:
        for index, url in enumerate(video_urls, start=1):
            suffix = ".mp4" if ".mov" not in url.lower() else ".mov"
            out_path = out_dir / f"generated_otter_video_{index:02d}{suffix}"
            response = session.get(url, timeout=120)
            response.raise_for_status()
            out_path.write_bytes(response.content)
            print(f"Downloaded {out_path}")


def command_plan(args: argparse.Namespace) -> None:
    plan = build_plan(args)
    out_path = Path(args.out).resolve()
    write_json(out_path, plan)
    print(f"Plan saved to {out_path}")
    print(f"Encounter mode: {plan['decision']['encounter_mode_name']}")
    print(f"Card title: {plan['card']['title']}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Douyin native AI otter pet workflow: video context -> otter variant -> card + Jimeng/Seedance task."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    plan = subparsers.add_parser("plan", help="Build prompts, card spec, and Ark request preview.")
    plan.add_argument("--context", required=True, help="Path to previous-video context JSON.")
    plan.add_argument("--character", default=str(DEFAULT_CHARACTER), help="Path to character JSON.")
    plan.add_argument("--out", default=str(DEFAULT_RUNS_DIR / "plan.json"), help="Output plan JSON path.")
    plan.add_argument("--tasks-url", default=os.getenv("SEEDANCE_TASKS_URL", os.getenv("ARK_TASKS_URL", DEFAULT_TASKS_URL)))
    plan.add_argument("--model", default=os.getenv("SEEDANCE_MODEL", os.getenv("ARK_MODEL", DEFAULT_MODEL)))
    plan.add_argument("--resolution", default="720p", choices=["480p", "720p", "1080p"])
    plan.add_argument("--ratio", default="9:16", choices=["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"])
    plan.add_argument("--duration", type=int, default=5)
    plan.add_argument("--seed", type=int, default=-1)
    plan.add_argument("--watermark", action="store_true")
    plan.add_argument("--safety-identifier", default=None)
    audio = plan.add_mutually_exclusive_group()
    audio.add_argument("--generate-audio", dest="generate_audio", action="store_true", default=True)
    audio.add_argument("--silent", dest="generate_audio", action="store_false")
    plan.set_defaults(func=command_plan)

    submit = subparsers.add_parser("submit", help="Submit a planned Seedance task.")
    submit.add_argument("--plan", required=True, help="Path to plan JSON from the plan command.")
    submit.add_argument("--out", default=None, help="Output task response JSON path.")
    submit.set_defaults(func=submit_task)

    poll = subparsers.add_parser("poll", help="Query a Seedance task status.")
    poll.add_argument("--task-id", required=True)
    poll.add_argument("--tasks-url", default=os.getenv("SEEDANCE_TASKS_URL", os.getenv("ARK_TASKS_URL", DEFAULT_TASKS_URL)))
    poll.add_argument("--out", default=None)
    poll.set_defaults(func=poll_task)

    download = subparsers.add_parser("download", help="Download generated video URLs from a task status JSON.")
    download.add_argument("--task-response", required=True)
    download.add_argument("--out-dir", default=str(DEFAULT_RUNS_DIR / "downloads"))
    download.set_defaults(func=download_outputs)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
