import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WORKFLOW_DIR = path.join(ROOT, "materials", "otter-lab", "douyin_pet_workflow");
const DEFAULT_CONTEXTS_DIR = path.join(WORKFLOW_DIR, "examples");
const DEFAULT_OUT_DIR = path.join(
  WORKFLOW_DIR,
  "runs",
  "batch",
  new Date().toISOString().replace(/[:.]/g, "-"),
);
const WORKFLOW_SCRIPT = path.join(WORKFLOW_DIR, "workflow.py");

function toPosix(value) {
  return value.split(path.sep).join("/");
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

function resolvePythonRuntime() {
  const manual = process.env.OTTER_PYTHON?.trim();
  const candidates = manual
    ? [{ command: manual, prefix: [] }]
    : [
        { command: "python", prefix: [] },
        { command: "py", prefix: ["-3"] },
      ];

  for (const candidate of candidates) {
    const probe = spawnSync(candidate.command, [...candidate.prefix, "--version"], {
      cwd: ROOT,
      encoding: "utf8",
      shell: false,
    });

    if (probe.status === 0) {
      return candidate;
    }
  }

  throw new Error("No Python runtime found. Set OTTER_PYTHON to your interpreter path.");
}

async function main() {
  const contextsDir = path.resolve(process.argv[2] ?? DEFAULT_CONTEXTS_DIR);
  const outDir = path.resolve(process.argv[3] ?? DEFAULT_OUT_DIR);
  const python = resolvePythonRuntime();

  const contextFiles = (await walk(contextsDir))
    .filter((filePath) => path.extname(filePath).toLowerCase() === ".json")
    .sort((a, b) => a.localeCompare(b, "zh-CN"));

  await ensureDirectory(outDir);

  const batchIndex = {
    generatedAt: new Date().toISOString(),
    contextsDir: toPosix(path.relative(ROOT, contextsDir)),
    workflowScript: toPosix(path.relative(ROOT, WORKFLOW_SCRIPT)),
    outDir: toPosix(path.relative(ROOT, outDir)),
    total: contextFiles.length,
    success: 0,
    failed: 0,
    items: [],
  };

  for (const contextFile of contextFiles) {
    const stem = path.basename(contextFile, path.extname(contextFile));
    const planPath = path.join(outDir, `${stem}.plan.json`);
    const run = spawnSync(
      python.command,
      [
        ...python.prefix,
        WORKFLOW_SCRIPT,
        "plan",
        "--context",
        contextFile,
        "--out",
        planPath,
      ],
      {
        cwd: ROOT,
        encoding: "utf8",
        shell: false,
      },
    );

    if (run.status === 0) {
      const plan = JSON.parse(await fs.readFile(planPath, "utf8"));
      batchIndex.success += 1;
      batchIndex.items.push({
        contextFile: toPosix(path.relative(ROOT, contextFile)),
        planFile: toPosix(path.relative(ROOT, planPath)),
        encounterMode: plan.decision?.encounter_mode ?? "",
        encounterModeName: plan.decision?.encounter_mode_name ?? "",
        title: plan.card?.title ?? stem,
        subtitle: plan.card?.subtitle ?? "",
      });
      continue;
    }

    batchIndex.failed += 1;
    batchIndex.items.push({
      contextFile: toPosix(path.relative(ROOT, contextFile)),
      planFile: toPosix(path.relative(ROOT, planPath)),
      error: (run.stderr || run.stdout || "Unknown failure").trim(),
    });
  }

  const indexPath = path.join(outDir, "batch-index.json");
  await fs.writeFile(indexPath, JSON.stringify(batchIndex, null, 2), "utf8");

  console.log(`Batch index written to ${indexPath}`);
  console.log(`Contexts processed: ${batchIndex.total}`);
  console.log(`Succeeded: ${batchIndex.success}`);
  console.log(`Failed: ${batchIndex.failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
