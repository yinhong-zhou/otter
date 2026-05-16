# public/ 媒体说明

| 文件 | 用途 | 状态 |
|---|---|---|
| `hero.mp4` | Hero 主视频 | **已定稿** — 概念 A 破窗穿越(§3.3),Seedance 2.0 生成,1080p/16:9/8s,3.8MB。源:`video/outputs/heroA_breakwindow.mp4`,生成器见 `video/` |
| `hero.webm` | 主视频 webm 版 | 未用 — 本机无 ffmpeg 转不了;Hero.tsx 已改成直接播 `hero.mp4`,不再引用 webm |
| `hero-mobile.webm` | 竖屏 9:16 移动端 | 未做 — 当前桌面横版 mp4 用 `object-cover` 在移动端裁切显示;需要再单独出 9:16 |
| `hero-poster.jpg` | 视频海报 | 未用 — Hero.tsx 已去掉 poster 引用(免 404);loading 期间显示 `#0A0A0A` 背景 |
| `hero-music.mp3` | 右上角喇叭配乐 | 占位待定 — 缺失时喇叭按钮点击无效果,不报错(§3.5 视频本身静音) |

**素材缺失不会崩**:Hero.tsx 有 6s 兜底,视频缺失/报错也触发文字浮现,
背景纯 `#0A0A0A`(不加渐变/glow,符合 §6.1)。

> 重抽/换 Hero 视频:在 `video/` 改 `prompts.py` 跑,再
> `cp video/outputs/<key>.mp4 public/hero.mp4` 覆盖即可。
> 注:定稿片 3.8MB,略超 §3.2 的 <3MB(LCP)目标;无 ffmpeg 未压,
> 后续如需压可用 ffmpeg `-crf` 或 H.265 重编。
