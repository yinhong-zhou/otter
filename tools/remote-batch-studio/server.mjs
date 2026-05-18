import http from "node:http";
import path from "node:path";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { downloadKeptAssets } from "./lib/download.mjs";
import {
  listProviders,
  getProvider,
  submitRemoteAsset,
  pollRemoteAsset,
} from "./lib/provider-engine.mjs";
import { ensureState, readState, updateState, toolRoot } from "./lib/store.mjs";

const ROOT = toolRoot();
const PUBLIC_DIR = path.join(ROOT, "public");
const PORT = Number(process.env.REMOTE_BATCH_STUDIO_PORT ?? 3210);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function summarizeBatch(state, batchId) {
  const batch = state.batches.find((item) => item.id === batchId);
  if (!batch) {
    return null;
  }
  const assets = state.assets.filter((item) => item.batchId === batchId);
  const counts = {
    total: assets.length,
    queued: assets.filter((item) => item.status === "queued").length,
    submitted: assets.filter((item) => item.status === "submitted").length,
    processing: assets.filter((item) => item.status === "processing").length,
    completed: assets.filter((item) => item.status === "completed").length,
    failed: assets.filter((item) => item.status === "failed").length,
    keep: assets.filter((item) => item.decision === "keep").length,
    reject: assets.filter((item) => item.decision === "reject").length,
    undecided: assets.filter((item) => item.decision === "undecided").length,
  };
  return { ...batch, counts, assets };
}

async function serveStatic(req, res, pathname) {
  const localPath = pathname === "/" ? "index.html" : pathname.slice(1);
  const resolved = path.join(PUBLIC_DIR, localPath);
  if (!resolved.startsWith(PUBLIC_DIR)) {
    notFound(res);
    return;
  }

  try {
    const body = await fs.readFile(resolved);
    const extension = path.extname(resolved);
    res.writeHead(200, {
      "Content-Type": contentTypes[extension] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    notFound(res);
  }
}

async function submitBatchInBackground(batchId) {
  const state = await readState();
  const batch = state.batches.find((item) => item.id === batchId);
  if (!batch) {
    return;
  }
  const provider = await getProvider(batch.providerId);
  const concurrency = Math.max(1, Number(provider.concurrency ?? 1));

  const pendingAssets = state.assets
    .filter((item) => item.batchId === batchId && item.status === "queued")
    .sort((a, b) => a.promptIndex - b.promptIndex);

  let cursor = 0;
  async function worker() {
    while (cursor < pendingAssets.length) {
      const asset = pendingAssets[cursor++];
      try {
        const remote = await submitRemoteAsset(batch.providerId, {
          batchId: batch.id,
          prompt: asset.prompt,
          promptIndex: asset.promptIndex,
          assetId: asset.id,
        });

        await updateState((draft) => {
          const target = draft.assets.find((item) => item.id === asset.id);
          if (!target) {
            return draft;
          }
          target.status = remote.remoteStatus;
          target.taskId = remote.taskId;
          target.resultUrl = remote.resultUrl;
          target.previewUrl = remote.previewUrl;
          target.requestPreview = remote.requestPreview;
          target.responsePreview = remote.responsePreview;
          target.updatedAt = new Date().toISOString();
          const batchRef = draft.batches.find((item) => item.id === batchId);
          if (batchRef) {
            batchRef.updatedAt = new Date().toISOString();
            batchRef.status = "submitted";
          }
          return draft;
        });
      } catch (error) {
        await updateState((draft) => {
          const target = draft.assets.find((item) => item.id === asset.id);
          if (!target) {
            return draft;
          }
          target.status = "failed";
          target.lastError = error instanceof Error ? error.message : String(error);
          target.updatedAt = new Date().toISOString();
          return draft;
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, pendingAssets.length || 1) }, worker));
}

async function pollBatch(batchId) {
  const state = await readState();
  const batch = state.batches.find((item) => item.id === batchId);
  if (!batch) {
    throw new Error("Batch not found.");
  }

  const candidates = state.assets.filter(
    (item) =>
      item.batchId === batchId &&
      ["submitted", "processing"].includes(item.status),
  );

  for (const asset of candidates) {
    try {
      const remote = await pollRemoteAsset(batch.providerId, asset);
      await updateState((draft) => {
        const target = draft.assets.find((item) => item.id === asset.id);
        if (!target) {
          return draft;
        }
        target.status = remote.remoteStatus;
        target.resultUrl = remote.resultUrl;
        target.previewUrl = remote.previewUrl;
        target.responsePreview = remote.responsePreview;
        target.updatedAt = new Date().toISOString();
        return draft;
      });
    } catch (error) {
      await updateState((draft) => {
        const target = draft.assets.find((item) => item.id === asset.id);
        if (!target) {
          return draft;
        }
        target.status = "failed";
        target.lastError = error instanceof Error ? error.message : String(error);
        target.updatedAt = new Date().toISOString();
        return draft;
      });
    }
  }

  return summarizeBatch(await readState(), batchId);
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsed.pathname;

  try {
    if (req.method === "GET" && pathname === "/api/health") {
      sendJson(res, 200, { ok: true, port: PORT });
      return;
    }

    if (req.method === "GET" && pathname === "/api/providers") {
      sendJson(res, 200, { providers: await listProviders() });
      return;
    }

    if (req.method === "GET" && pathname === "/api/state") {
      const state = await readState();
      const batches = state.batches
        .map((batch) => summarizeBatch(state, batch.id))
        .filter(Boolean)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      sendJson(res, 200, { batches });
      return;
    }

    if (req.method === "POST" && pathname === "/api/batches") {
      const body = await readBody(req);
      const prompts = Array.isArray(body.prompts)
        ? body.prompts.map((item) => String(item).trim()).filter(Boolean)
        : String(body.prompts ?? "")
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean);

      if (!body.providerId || prompts.length === 0) {
        sendJson(res, 400, { error: "providerId 和 prompts 必填。" });
        return;
      }

      const providers = await listProviders();
      const provider = providers.find((item) => item.id === body.providerId);
      if (!provider) {
        sendJson(res, 400, { error: `未知 provider: ${body.providerId}` });
        return;
      }

      const batchId = randomUUID();
      const now = new Date().toISOString();
      const batch = {
        id: batchId,
        name: String(body.name || `batch-${now.slice(0, 16).replace(/[:T]/g, "-")}`),
        providerId: body.providerId,
        providerLabel: provider.label,
        kind: provider.kind,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      };

      const assets = prompts.map((prompt, index) => ({
        id: randomUUID(),
        batchId,
        providerId: body.providerId,
        kind: provider.kind,
        prompt,
        promptIndex: index,
        status: "queued",
        decision: "undecided",
        taskId: null,
        resultUrl: null,
        previewUrl: null,
        requestPreview: null,
        responsePreview: null,
        lastError: null,
        createdAt: now,
        updatedAt: now,
      }));

      await updateState((draft) => {
        draft.batches.push(batch);
        draft.assets.push(...assets);
        return draft;
      });

      void submitBatchInBackground(batchId);
      sendJson(res, 201, { batchId, queued: assets.length });
      return;
    }

    if (req.method === "POST" && pathname.match(/^\/api\/batches\/[^/]+\/poll$/)) {
      const batchId = pathname.split("/")[3];
      const updated = await pollBatch(batchId);
      sendJson(res, 200, { batch: updated });
      return;
    }

    if (req.method === "POST" && pathname.match(/^\/api\/assets\/[^/]+\/decision$/)) {
      const assetId = pathname.split("/")[3];
      const body = await readBody(req);
      const decision = ["keep", "reject", "undecided"].includes(body.decision)
        ? body.decision
        : "undecided";

      await updateState((draft) => {
        const asset = draft.assets.find((item) => item.id === assetId);
        if (!asset) {
          throw new Error("Asset not found.");
        }
        asset.decision = decision;
        asset.updatedAt = new Date().toISOString();
        return draft;
      });

      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && pathname.match(/^\/api\/batches\/[^/]+\/download-kept$/)) {
      const batchId = pathname.split("/")[3];
      const state = await readState();
      const batch = state.batches.find((item) => item.id === batchId);
      if (!batch) {
        sendJson(res, 404, { error: "Batch not found." });
        return;
      }

      const result = await downloadKeptAssets(
        batch,
        state.assets.filter((item) => item.batchId === batchId),
      );
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === "GET" && pathname.match(/^\/api\/batches\/[^/]+\/regeneration-pack$/)) {
      const batchId = pathname.split("/")[3];
      const state = await readState();
      const batch = state.batches.find((item) => item.id === batchId);
      if (!batch) {
        sendJson(res, 404, { error: "Batch not found." });
        return;
      }

      const keepAssets = state.assets.filter(
        (item) => item.batchId === batchId && item.decision === "keep",
      );
      sendJson(res, 200, {
        exportedAt: new Date().toISOString(),
        batchId,
        batchName: batch.name,
        providerId: batch.providerId,
        kind: batch.kind,
        totalKept: keepAssets.length,
        regenerationCandidates: keepAssets.map((asset) => ({
          id: asset.id,
          prompt: asset.prompt,
          resultUrl: asset.resultUrl,
          previewUrl: asset.previewUrl,
          suggestion: `围绕「${asset.prompt}」做同主题扩写，保留成功元素，只替换动作、镜头和结尾。`,
        })),
      });
      return;
    }

    if (req.method === "GET") {
      await serveStatic(req, res, pathname);
      return;
    }

    notFound(res);
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

await ensureState();
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Remote Batch Studio running at http://127.0.0.1:${PORT}`);
});
