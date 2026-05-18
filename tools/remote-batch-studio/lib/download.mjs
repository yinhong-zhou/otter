import { promises as fs } from "node:fs";
import path from "node:path";
import { toolRoot } from "./store.mjs";

const ROOT = toolRoot();
const DOWNLOAD_DIR = path.join(ROOT, "downloads");

function sanitizeFileName(value) {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, " ").trim();
}

function extensionFromUrl(url, fallbackKind) {
  try {
    const parsed = new URL(url);
    const suffix = path.extname(parsed.pathname);
    if (suffix) {
      return suffix;
    }
  } catch {
    // ignore
  }
  return fallbackKind === "video" ? ".mp4" : ".png";
}

export async function downloadKeptAssets(batch, assets) {
  const keepAssets = assets.filter((asset) => asset.decision === "keep" && asset.resultUrl);
  const batchDir = path.join(DOWNLOAD_DIR, batch.id, "keep");
  await fs.mkdir(batchDir, { recursive: true });

  const downloaded = [];
  for (const asset of keepAssets) {
    const response = await fetch(asset.resultUrl);
    if (!response.ok) {
      throw new Error(`下载失败: ${asset.resultUrl}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const extension = extensionFromUrl(asset.resultUrl, asset.kind);
    const baseName = sanitizeFileName(
      `${String(asset.promptIndex + 1).padStart(3, "0")}-${asset.prompt.slice(0, 48) || asset.id}`,
    );
    const outputPath = path.join(batchDir, `${baseName}${extension}`);
    await fs.writeFile(outputPath, buffer);
    downloaded.push(outputPath);
  }

  return {
    batchDir,
    downloaded,
  };
}
