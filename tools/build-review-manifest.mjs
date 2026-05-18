import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PUBLIC_ROOT = path.join(ROOT, "public");
const DEFAULT_STAGE_DIR = path.join(PUBLIC_ROOT, "review-assets", "videos");
const DEFAULT_SOURCE_DIR = DEFAULT_STAGE_DIR;
const DEFAULT_OUTPUT_PATH = path.join(PUBLIC_ROOT, "review-assets", "review-manifest.json");
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".m4v"]);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function inferTitle(fileName) {
  return fileName
    .replace(path.extname(fileName), "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function walk(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

async function listVideos(dirPath) {
  await ensureDirectory(dirPath);
  const allFiles = await walk(dirPath);
  return allFiles
    .filter((filePath) => VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
}

async function copyIntoPublic(sourceDir) {
  const sourceName = path.basename(sourceDir);
  const targetRoot = path.join(DEFAULT_STAGE_DIR, sourceName);
  const sourceVideos = await listVideos(sourceDir);

  for (const filePath of sourceVideos) {
    const relativePath = path.relative(sourceDir, filePath);
    const targetPath = path.join(targetRoot, relativePath);
    await ensureDirectory(path.dirname(targetPath));
    await fs.copyFile(filePath, targetPath);
  }

  return { targetDir: targetRoot, count: sourceVideos.length };
}

async function buildManifest(originalSourceDir, servedDir, outputPath, copiedToPublic) {
  const videos = await listVideos(servedDir);

  const items = await Promise.all(
    videos.map(async (filePath, index) => {
      const stat = await fs.stat(filePath);
      const relativePath = toPosix(path.relative(PUBLIC_ROOT, filePath));
      const fileName = path.basename(filePath);

      return {
        id: `video-${String(index + 1).padStart(4, "0")}`,
        title: inferTitle(fileName),
        sourceFile: fileName,
        relativePath,
        publicUrl: `/${relativePath}`,
        bytes: stat.size,
        updatedAt: stat.mtime.toISOString(),
        tags: [],
      };
    }),
  );

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceDir: toPosix(path.relative(ROOT, originalSourceDir)),
    servedDir: toPosix(path.relative(ROOT, servedDir)),
    copiedToPublic,
    total: items.length,
    items,
  };

  await ensureDirectory(path.dirname(outputPath));
  await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2), "utf8");
  return manifest;
}

async function main() {
  const sourceDir = path.resolve(process.argv[2] ?? DEFAULT_SOURCE_DIR);
  const outputPath = path.resolve(process.argv[3] ?? DEFAULT_OUTPUT_PATH);

  let servedDir = sourceDir;
  let copiedToPublic = false;

  if (!isInside(PUBLIC_ROOT, sourceDir) && sourceDir !== PUBLIC_ROOT) {
    const copyResult = await copyIntoPublic(sourceDir);
    servedDir = copyResult.targetDir;
    copiedToPublic = true;
  }

  const manifest = await buildManifest(sourceDir, servedDir, outputPath, copiedToPublic);

  console.log(`Manifest written to ${outputPath}`);
  console.log(`Source directory: ${sourceDir}`);
  console.log(`Served directory: ${servedDir}`);
  console.log(`Videos indexed: ${manifest.total}`);
  if (copiedToPublic) {
    console.log("Videos were copied into public/review-assets/videos for local preview.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
