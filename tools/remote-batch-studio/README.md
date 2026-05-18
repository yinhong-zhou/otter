# Remote Batch Studio

一个独立的小工具，用来做这件事：

1. 批量调用远程 API 生成图片或视频
2. 不急着下载结果，只保存任务状态和远程结果 URL
3. 在本地网页里筛选 `留下 / 淘汰`
4. 只下载筛选后的保留项
5. 顺手导出一份“下一轮重生成包”

它和当前的 Next 项目页面已经解耦，后面你可以把这个文件夹当轮子单独搬走。

## 目录

```text
tools/remote-batch-studio/
  config/
    providers.example.json
  data/
    state.json                 # 首次启动自动生成
  downloads/
  lib/
  public/
  package.json
  server.mjs
  README.md
```

## 启动

在仓库根目录执行：

```powershell
node .\tools\remote-batch-studio\server.mjs
```

默认地址：

```text
http://127.0.0.1:3210
```

如果要改端口：

```powershell
$env:REMOTE_BATCH_STUDIO_PORT="3211"
node .\tools\remote-batch-studio\server.mjs
```

## Provider 配置

工具本身不把 API 写死，而是走配置文件。

第一次使用时，把：

```text
tools/remote-batch-studio/config/providers.example.json
```

复制成：

```text
tools/remote-batch-studio/config/providers.json
```

然后按你的接口改。

### 已附带的配置样例

- `seedance_video`
  - 适合现在这个项目已有的视频生成链路
  - 走异步任务：提交后拿 `taskId`，再轮询结果
- `image_sync_example`
  - 适合图片接口样例
  - 如果接口是同步返回图片 URL，可以直接用

## 环境变量

配置里可以用这种占位符：

```json
"Authorization": "Bearer {{env.SEEDANCE_API_KEY}}"
```

也就是你只要提前设置环境变量：

```powershell
$env:SEEDANCE_API_KEY="你的密钥"
$env:IMAGE_API_KEY="你的图片接口密钥"
```

## 配置格式说明

每个 provider 主要有这几块：

### 1. create

提交任务时发什么请求

```json
"create": {
  "url": "https://example.com/api/tasks",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer {{env.MY_API_KEY}}",
    "Content-Type": "application/json"
  },
  "body": {
    "prompt": "{{prompt}}"
  }
}
```

### 2. poll

如果是异步任务，再定义轮询接口：

```json
"poll": {
  "url": "https://example.com/api/tasks/{{taskId}}",
  "method": "GET",
  "headers": {
    "Authorization": "Bearer {{env.MY_API_KEY}}"
  }
}
```

### 3. 结果字段路径

工具要知道去哪里找：

- 任务 ID
- 状态
- 结果 URL
- 预览 URL

例如：

```json
"responseTaskIdPaths": ["id", "data.id", "task_id"],
"statusPath": ["status", "data.status"],
"resultUrlPaths": ["data.video_url", "result.video_url"],
"previewUrlPaths": ["data.cover_url", "cover_url"]
```

路径格式就是点路径，像 `data.0.url` 这种也支持。

## 网页里能做什么

### 新建批次

- 选 provider
- 填批次名
- 一行一个 prompt
- 点“批量提交”

### 批次页

- 看每条任务当前状态
- 打开远程预览 URL
- `留下 / 淘汰 / 清空`
- 轮询未完成任务
- 下载保留项
- 导出重生成包

## 下载逻辑

工具不会在刚生成时就把文件都拉下来。

只有你把素材标成 `留下` 之后，点：

```text
下载保留项
```

才会下载到：

```text
tools/remote-batch-studio/downloads/<batchId>/keep/
```

## 数据存放

批次和筛选状态都存在：

```text
tools/remote-batch-studio/data/state.json
```

所以服务重启后还在。

## 推荐工作流

### 视频

1. 配好 `seedance_video`
2. 一批 prompts 提交
3. 轮询直到返回远程视频 URL
4. 在网页里筛选
5. 只下载保留项
6. 导出重生成包，继续喂下一轮

### 图片

1. 配好图片 provider
2. 批量提交
3. 直接预览远程图 URL
4. 筛选
5. 下载保留项

## 适合继续扩展的方向

- 增加 prompt 模板系统
- 增加 CSV / JSON 批量导入
- 增加标签、评分、快捷键
- 增加 provider 的并发控制和重试
- 增加 webhook 回调接入
- 增加 S3 / OSS / R2 存档

## 备注

这个版本的目标是先把“远程生成 -> 本地筛选 -> 保留后下载”闭环跑通。

如果你下一步要，我建议直接继续加这三件：

1. `providers.json` 的 UI 配置页
2. CSV 批量导入 prompt
3. 筛选通过后自动触发下一轮重生成
