const providerSelect = document.querySelector("#providerSelect");
const providerMeta = document.querySelector("#providerMeta");
const batchNameInput = document.querySelector("#batchNameInput");
const promptInput = document.querySelector("#promptInput");
const submitBatchBtn = document.querySelector("#submitBatchBtn");
const refreshStateBtn = document.querySelector("#refreshStateBtn");
const batchList = document.querySelector("#batchList");
const batchCount = document.querySelector("#batchCount");
const detailTitle = document.querySelector("#detailTitle");
const detailMeta = document.querySelector("#detailMeta");
const detailStats = document.querySelector("#detailStats");
const statusBar = document.querySelector("#statusBar");
const assetGrid = document.querySelector("#assetGrid");
const pollBatchBtn = document.querySelector("#pollBatchBtn");
const exportPackBtn = document.querySelector("#exportPackBtn");
const downloadKeptBtn = document.querySelector("#downloadKeptBtn");
const batchTemplate = document.querySelector("#batchCardTemplate");
const assetTemplate = document.querySelector("#assetCardTemplate");

let providers = [];
let batches = [];
let selectedBatchId = null;

function setStatus(message) {
  if (!message) {
    statusBar.textContent = "";
    statusBar.classList.add("hidden");
    return;
  }
  statusBar.textContent = message;
  statusBar.classList.remove("hidden");
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

async function loadProviders() {
  const data = await requestJson("/api/providers");
  providers = data.providers;
  providerSelect.innerHTML = "";
  for (const provider of providers) {
    const option = document.createElement("option");
    option.value = provider.id;
    option.textContent = `${provider.label} · ${provider.kind}`;
    providerSelect.append(option);
  }
  renderProviderMeta();
}

function renderProviderMeta() {
  const current = providers.find((item) => item.id === providerSelect.value);
  if (!current) {
    providerMeta.textContent = "";
    return;
  }
  providerMeta.textContent = `类型: ${current.kind} · 轮询: ${current.supportsPolling ? "是" : "否"}`;
}

async function loadState() {
  const data = await requestJson("/api/state");
  batches = data.batches ?? [];
  batchCount.textContent = String(batches.length);

  if (!selectedBatchId && batches.length > 0) {
    selectedBatchId = batches[0].id;
  }
  if (selectedBatchId && !batches.find((item) => item.id === selectedBatchId)) {
    selectedBatchId = batches[0]?.id ?? null;
  }

  renderBatchList();
  renderSelectedBatch();
}

function renderBatchList() {
  batchList.innerHTML = "";
  if (batches.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "还没有批次。";
    batchList.append(empty);
    return;
  }

  for (const batch of batches) {
    const node = batchTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".batch-name").textContent = batch.name;
    node.querySelector(".batch-kind").textContent = batch.kind;
    node.querySelector(".batch-card-meta").textContent =
      `${batch.providerLabel} · ${batch.counts.total} 条 · ${new Date(batch.createdAt).toLocaleString("zh-CN")}`;
    node.querySelector(".batch-card-counts").textContent =
      `完成 ${batch.counts.completed} / 失败 ${batch.counts.failed} / 保留 ${batch.counts.keep}`;
    if (batch.id === selectedBatchId) {
      node.classList.add("active");
    }
    node.addEventListener("click", () => {
      selectedBatchId = batch.id;
      renderBatchList();
      renderSelectedBatch();
    });
    batchList.append(node);
  }
}

function createMedia(asset) {
  const mediaRoot = document.createElement("div");
  mediaRoot.className = "asset-media";
  const url = asset.resultUrl || asset.previewUrl;

  if (!url) {
    mediaRoot.classList.add("placeholder");
    mediaRoot.textContent = asset.status === "failed" ? "生成失败" : "等待远程结果";
    return mediaRoot;
  }

  if (asset.kind === "video") {
    const video = document.createElement("video");
    video.src = url;
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.muted = true;
    mediaRoot.append(video);
    return mediaRoot;
  }

  const image = document.createElement("img");
  image.src = url;
  image.alt = asset.prompt;
  mediaRoot.append(image);
  return mediaRoot;
}

async function setDecision(assetId, decision) {
  await requestJson(`/api/assets/${assetId}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
  await loadState();
}

function renderSelectedBatch() {
  const batch = batches.find((item) => item.id === selectedBatchId);
  if (!batch) {
    detailTitle.textContent = "还没有选中批次";
    detailMeta.textContent = "先提交一个批次，或者从左侧选择已有批次。";
    detailStats.innerHTML = "";
    assetGrid.className = "asset-grid empty";
    assetGrid.textContent = "当前批次还没有素材。";
    pollBatchBtn.disabled = true;
    exportPackBtn.disabled = true;
    downloadKeptBtn.disabled = true;
    return;
  }

  detailTitle.textContent = batch.name;
  detailMeta.textContent =
    `${batch.providerLabel} · ${batch.kind} · ${batch.counts.total} 条 prompt`;
  detailStats.innerHTML = "";
  [
    ["总数", batch.counts.total],
    ["处理中", batch.counts.processing + batch.counts.submitted],
    ["完成", batch.counts.completed],
    ["失败", batch.counts.failed],
    ["保留", batch.counts.keep],
    ["淘汰", batch.counts.reject],
  ].forEach(([label, value]) => {
    const pill = document.createElement("div");
    pill.className = "stat-pill";
    pill.textContent = `${label}: ${value}`;
    detailStats.append(pill);
  });

  pollBatchBtn.disabled = false;
  exportPackBtn.disabled = batch.counts.keep === 0;
  downloadKeptBtn.disabled = batch.counts.keep === 0;

  assetGrid.className = "asset-grid";
  assetGrid.innerHTML = "";
  if (batch.assets.length === 0) {
    assetGrid.className = "asset-grid empty";
    assetGrid.textContent = "当前批次还没有素材。";
    return;
  }

  for (const asset of batch.assets) {
    const node = assetTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".asset-media").replaceWith(createMedia(asset));
    node.querySelector(".asset-index").textContent = `#${String(asset.promptIndex + 1).padStart(3, "0")}`;
    node.querySelector(".asset-status").textContent = asset.status;
    node.querySelector(".asset-prompt").textContent = asset.prompt;

    const links = node.querySelector(".asset-links");
    if (asset.previewUrl) {
      const preview = document.createElement("a");
      preview.href = asset.previewUrl;
      preview.target = "_blank";
      preview.rel = "noreferrer";
      preview.textContent = "打开预览";
      links.append(preview);
    }
    if (asset.resultUrl) {
      const result = document.createElement("a");
      result.href = asset.resultUrl;
      result.target = "_blank";
      result.rel = "noreferrer";
      result.textContent = "打开结果";
      links.append(result);
    }
    if (!links.children.length) {
      links.textContent = asset.taskId ? `taskId: ${asset.taskId}` : "等待返回 URL";
    }

    node.querySelectorAll(".decision-btn").forEach((button) => {
      const decision = button.dataset.decision;
      if (decision === asset.decision) {
        button.classList.add("active");
      }
      button.addEventListener("click", async () => {
        try {
          await setDecision(asset.id, decision);
        } catch (error) {
          setStatus(error.message);
        }
      });
    });

    if (asset.lastError) {
      const errorBox = node.querySelector(".asset-error");
      errorBox.classList.remove("hidden");
      errorBox.textContent = asset.lastError;
    }

    assetGrid.append(node);
  }
}

async function submitBatch() {
  const prompts = promptInput.value.trim();
  if (!prompts) {
    setStatus("先填 prompts。");
    return;
  }
  submitBatchBtn.disabled = true;
  setStatus("正在提交批次...");
  try {
    const data = await requestJson("/api/batches", {
      method: "POST",
      body: JSON.stringify({
        providerId: providerSelect.value,
        name: batchNameInput.value.trim(),
        prompts,
      }),
    });
    selectedBatchId = data.batchId;
    promptInput.value = "";
    batchNameInput.value = "";
    setStatus(`已提交 ${data.queued} 条 prompt。`);
    await loadState();
  } catch (error) {
    setStatus(error.message);
  } finally {
    submitBatchBtn.disabled = false;
  }
}

async function pollSelectedBatch() {
  if (!selectedBatchId) {
    return;
  }
  pollBatchBtn.disabled = true;
  setStatus("正在轮询远程任务...");
  try {
    await requestJson(`/api/batches/${selectedBatchId}/poll`, { method: "POST" });
    await loadState();
    setStatus("轮询完成。");
  } catch (error) {
    setStatus(error.message);
  } finally {
    pollBatchBtn.disabled = false;
  }
}

async function downloadKept() {
  if (!selectedBatchId) {
    return;
  }
  downloadKeptBtn.disabled = true;
  setStatus("正在下载保留项...");
  try {
    const data = await requestJson(`/api/batches/${selectedBatchId}/download-kept`, {
      method: "POST",
    });
    setStatus(`已下载 ${data.downloaded.length} 个文件到 ${data.batchDir}`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    downloadKeptBtn.disabled = false;
  }
}

async function exportPack() {
  if (!selectedBatchId) {
    return;
  }
  try {
    const data = await requestJson(`/api/batches/${selectedBatchId}/regeneration-pack`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedBatchId}-regeneration-pack.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("已导出重生成包。");
  } catch (error) {
    setStatus(error.message);
  }
}

providerSelect.addEventListener("change", renderProviderMeta);
submitBatchBtn.addEventListener("click", submitBatch);
refreshStateBtn.addEventListener("click", async () => {
  try {
    await loadState();
    setStatus("状态已刷新。");
  } catch (error) {
    setStatus(error.message);
  }
});
pollBatchBtn.addEventListener("click", pollSelectedBatch);
downloadKeptBtn.addEventListener("click", downloadKept);
exportPackBtn.addEventListener("click", exportPack);

async function bootstrap() {
  try {
    await loadProviders();
    await loadState();
    setStatus("");
  } catch (error) {
    setStatus(error.message);
  }
}

bootstrap();
