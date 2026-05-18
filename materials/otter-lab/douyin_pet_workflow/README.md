# 抖音原生宠物工作流 Demo

这个目录用于搭建“神奇水獭”工作流底座：

上一条视频语义 -> 水獭形象切换 -> 原生卡片文案 -> 图片/封面 prompt -> Seedance 视频生成任务。

它现在不会自动分析真实视频内容，先用 `examples/*.json` 模拟“上一条视频识别结果”。后续接入视频理解模型时，只需要把识别结果写成同样结构。

## 目录

- `characters/magic_otter.json`：角色库，已入库“神奇水獭”和最终参考图。
- `examples/video_context_*.json`：上一条视频语义示例。
- `workflow.py`：生成卡片/提示词/方舟请求体，并可提交、查询、下载视频任务。
- `runs/`：默认输出计划、任务状态和下载结果。

## 1. 生成工作流计划

只生成 prompt 和请求体预览，不调用接口：

```powershell
python .\douyin_pet_workflow\workflow.py plan `
  --context .\douyin_pet_workflow\examples\video_context_normandy.json `
  --out .\douyin_pet_workflow\runs\normandy_plan.json
```

也可以换成另外两个示例：

```powershell
python .\douyin_pet_workflow\workflow.py plan `
  --context .\douyin_pet_workflow\examples\video_context_food_stall.json `
  --out .\douyin_pet_workflow\runs\food_plan.json

python .\douyin_pet_workflow\workflow.py plan `
  --context .\douyin_pet_workflow\examples\video_context_fitness.json `
  --out .\douyin_pet_workflow\runs\fitness_plan.json
```

计划文件里会包含：

- `decision.encounter_mode`：窗边偷窥 / 街头偶遇 / 穿越客串
- `decision.otter_variant`：水獭本次身份、服装、动作、安全约束
- `card`：卡片标题、副标题、角标、轻互动、A/B 重互动
- `prompts.video_prompt`：视频生成提示词
- `prompts.cover_image_prompt`：卡片封面图提示词
- `ark_request_preview`：火山方舟 Seedance 请求体预览，参考图 base64 会省略

## 2. 真正提交视频任务

### 方案 A：OpenAI-Next / draw 接口

#### Sora-2 创建视频（新，multipart/form-data）

你最新给的 OpenAPI 对应：

```text
POST https://draw.openai-next.com/v1/videos
Content-Type: multipart/form-data
```

必填字段：

- `prompt`
- `model`，例如 `sora-2`
- `size`，例如 `1280x720`
- `seconds`，例如 `8`
- `input_reference`，本地参考图文件

先只生成 multipart 请求摘要，不提交：

```powershell
python .\douyin_pet_workflow\sora2_video.py request `
  --plan .\douyin_pet_workflow\runs\jimeng_normandy_plan.json `
  --size 1280x720 `
  --seconds 8 `
  --out .\douyin_pet_workflow\runs\sora2_normandy_request.json
```

真正提交：

```powershell
$env:OPENAI_NEXT_API_KEY="你的OpenAI-Next密钥"

python .\douyin_pet_workflow\sora2_video.py submit `
  --plan .\douyin_pet_workflow\runs\jimeng_normandy_plan.json `
  --size 1280x720 `
  --seconds 8 `
  --out .\douyin_pet_workflow\runs\sora2_normandy_response.json
```

这条会把最终水獭参考图作为 `input_reference` 上传，并使用工作流生成的水獭穿越 prompt。

#### Sora-2 character / url + timestamps

你之前给的传输方式对应：

```text
POST https://draw.openai-next.com/v1/videos
```

最小请求体：

```json
{
  "model": "sora-2-character",
  "url": "https://filesystem.site/cdn/20251030/javYrU4etHVFDqg8by7mViTWH1MOZy.mp4",
  "timestamps": "1,3"
}
```

先只生成 payload，不提交：

```powershell
python .\douyin_pet_workflow\openai_next_video.py request-from-plan `
  --plan .\douyin_pet_workflow\runs\normandy_plan.json `
  --out .\douyin_pet_workflow\runs\openai_next_normandy_payload.json
```

如果接口支持 prompt，可以把水獭工作流生成的视频提示词一起带上：

```powershell
python .\douyin_pet_workflow\openai_next_video.py request-from-plan `
  --plan .\douyin_pet_workflow\runs\normandy_plan.json `
  --include-prompt `
  --out .\douyin_pet_workflow\runs\openai_next_normandy_payload_with_prompt.json
```

真正提交前设置 API Key：

```powershell
$env:OPENAI_NEXT_API_KEY="你的OpenAI-Next密钥"
```

提交：

```powershell
python .\douyin_pet_workflow\openai_next_video.py submit `
  --payload .\douyin_pet_workflow\runs\openai_next_normandy_payload.json `
  --out .\douyin_pet_workflow\runs\openai_next_normandy_response.json
```

也可以按截图方式直接传：

```powershell
python .\douyin_pet_workflow\openai_next_video.py direct `
  --url "https://filesystem.site/cdn/20251030/javYrU4etHVFDqg8by7mViTWH1MOZy.mp4" `
  --timestamps "1,3" `
  --out .\douyin_pet_workflow\runs\openai_next_direct_response.json
```

### 方案 B：即梦 Seedance

这条线按火山方舟 Seedance 文档的请求体格式接入，但接口地址替换为：

```text
https://draw.openai-next.com/seedance/v3/contents/generations/tasks
```

先设置即梦后台拿到的 key：

```powershell
$env:SEEDANCE_API_KEY="你的即梦Seedance密钥"
```

然后提交：

```powershell
python .\douyin_pet_workflow\workflow.py submit `
  --plan .\douyin_pet_workflow\runs\normandy_plan.json `
  --out .\douyin_pet_workflow\runs\normandy_task.json
```

默认模型是：

```text
doubao-seedance-2-0-260128
```

如果即梦后台给的是另一个 Model ID，可以在 plan 阶段覆盖：

```powershell
python .\douyin_pet_workflow\workflow.py plan `
  --context .\douyin_pet_workflow\examples\video_context_normandy.json `
  --model "你的ModelID或EndpointID" `
  --out .\douyin_pet_workflow\runs\normandy_plan.json
```

如果要手动覆盖接口地址：

```powershell
python .\douyin_pet_workflow\workflow.py plan `
  --context .\douyin_pet_workflow\examples\video_context_normandy.json `
  --tasks-url "https://draw.openai-next.com/seedance/v3/contents/generations/tasks" `
  --out .\douyin_pet_workflow\runs\normandy_plan.json
```

## 3. 查询任务

提交成功后会返回任务 ID：

```powershell
python .\douyin_pet_workflow\workflow.py poll `
  --task-id "你的任务ID" `
  --out .\douyin_pet_workflow\runs\normandy_status.json
```

## 4. 下载视频

当任务状态为 `succeeded` 且状态 JSON 里有视频 URL：

```powershell
python .\douyin_pet_workflow\workflow.py download `
  --task-response .\douyin_pet_workflow\runs\normandy_status.json `
  --out-dir .\douyin_pet_workflow\runs\downloads
```

## 关键设计

最小闭环是：

1. 上一条视频被识别成结构化语义。
2. 工作流决定水獭以哪种姿态出现。
3. 水獭根据视频主题变装，但保留最终参考图里的耳机、毛色、体型和气质。
4. 生成一张“像抖音信息流里自然刷到”的 AI 宠物卡片。
5. 用户可以轻互动，也可以用 A/B 选择影响下一段剧情。

三种相遇姿态：

- `window_peek`：窗边偷窥，他在家里被上一条视频影响。
- `street_encounter`：街头偶遇，你像路人一样拍到它。
- `portal_cameo`：穿越客串，它跳进你刚刷视频的平行宇宙。

## 注意

- `submit` 才会把参考图转成 base64 并发给火山方舟。
- 如果上一条视频有真人、人脸或版权素材，当前 demo 默认只使用“语义摘要”，不直接把视频当参考视频上传。
- 如果要传入公网参考视频 URL，可在 context JSON 里加 `reference_video_url` 字段。
- 危险或战争题材会自动加“玩具化、非写实、无血腥、无真实伤害”的约束。
