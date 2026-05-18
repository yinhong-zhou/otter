import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const STATE_PATH = path.join(DATA_DIR, "state.json");

const DEFAULT_STATE = {
  batches: [],
  assets: [],
  meta: {
    createdAt: null,
    updatedAt: null,
  },
};

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function ensureState() {
  await ensureDataDir();
  try {
    await fs.access(STATE_PATH);
  } catch {
    const now = new Date().toISOString();
    const initial = {
      ...DEFAULT_STATE,
      meta: {
        createdAt: now,
        updatedAt: now,
      },
    };
    await fs.writeFile(STATE_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
  return STATE_PATH;
}

export async function readState() {
  await ensureState();
  const raw = await fs.readFile(STATE_PATH, "utf8");
  return JSON.parse(raw);
}

export async function writeState(nextState) {
  await ensureState();
  const payload = {
    ...nextState,
    meta: {
      ...(nextState.meta ?? {}),
      updatedAt: new Date().toISOString(),
      createdAt: nextState.meta?.createdAt ?? new Date().toISOString(),
    },
  };
  await fs.writeFile(STATE_PATH, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

export async function updateState(mutator) {
  const current = await readState();
  const draft = structuredClone(current);
  const result = (await mutator(draft)) ?? draft;
  return writeState(result);
}

export function toolRoot() {
  return ROOT;
}

export function dataDir() {
  return DATA_DIR;
}
