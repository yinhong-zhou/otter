import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { toolRoot } from "./store.mjs";

const ROOT = toolRoot();
const CONFIG_DIR = path.join(ROOT, "config");
const PRIMARY_CONFIG = path.join(CONFIG_DIR, "providers.json");
const FALLBACK_CONFIG = path.join(CONFIG_DIR, "providers.example.json");

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function tokenizePath(pathExpression) {
  return pathExpression.split(".").map((part) => {
    if (/^\d+$/.test(part)) {
      return Number(part);
    }
    return part;
  });
}

function readPath(source, pathExpression) {
  const tokens = tokenizePath(pathExpression);
  let current = source;
  for (const token of tokens) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[token];
  }
  return current;
}

function firstMatch(source, candidates = []) {
  for (const candidate of candidates) {
    const value = readPath(source, candidate);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function interpolateString(template, vars) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    if (key.startsWith("env.")) {
      const envName = key.slice(4);
      return process.env[envName] ?? "";
    }
    return vars[key] ?? "";
  });
}

function interpolate(value, vars) {
  if (typeof value === "string") {
    return interpolateString(value, vars);
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolate(item, vars));
  }
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, interpolate(nested, vars)]),
    );
  }
  return value;
}

function redactSecrets(value) {
  let text = JSON.stringify(value, null, 2);
  for (const [envName, envValue] of Object.entries(process.env)) {
    if (!envValue || envValue.length < 8) {
      continue;
    }
    text = text.split(envValue).join(`[REDACTED:${envName}]`);
  }
  return JSON.parse(text);
}

function normalizeStatus(provider, response) {
  const statusValue = String(firstMatch(response, provider.statusPath ?? []) ?? "").toLowerCase();
  if (!statusValue) {
    const resultUrl = firstMatch(response, provider.resultUrlPaths ?? []);
    return resultUrl ? "completed" : "submitted";
  }
  if ((provider.successValues ?? []).map((item) => String(item).toLowerCase()).includes(statusValue)) {
    return "completed";
  }
  if ((provider.failureValues ?? []).map((item) => String(item).toLowerCase()).includes(statusValue)) {
    return "failed";
  }
  return "processing";
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const bodyText = await response.text();
  let payload;
  try {
    payload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    payload = { raw: bodyText };
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${bodyText.slice(0, 400)}`);
  }
  return payload;
}

function buildCreateRequest(provider, vars) {
  const headers = interpolate(provider.create.headers ?? {}, vars);
  const body = interpolate(provider.create.body ?? {}, vars);
  return {
    url: interpolate(provider.create.url, vars),
    method: provider.create.method ?? "POST",
    headers,
    body,
  };
}

function buildPollRequest(provider, vars) {
  if (!provider.poll) {
    return null;
  }
  return {
    url: interpolate(provider.poll.url, vars),
    method: provider.poll.method ?? "GET",
    headers: interpolate(provider.poll.headers ?? {}, vars),
  };
}

export async function loadProviders() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const configPath = await fs
    .access(PRIMARY_CONFIG)
    .then(() => PRIMARY_CONFIG)
    .catch(() => FALLBACK_CONFIG);
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw);
  return {
    configPath,
    providers: parsed.providers ?? {},
  };
}

export async function listProviders() {
  const { providers, configPath } = await loadProviders();
  return Object.entries(providers).map(([id, provider]) => ({
    id,
    label: provider.label ?? id,
    kind: provider.kind ?? "image",
    supportsPolling: Boolean(provider.poll),
    concurrency: provider.concurrency ?? 1,
    configPath,
  }));
}

export async function getProvider(providerId) {
  const { providers } = await loadProviders();
  const provider = providers[providerId];
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return provider;
}

export async function submitRemoteAsset(providerId, input) {
  const provider = await getProvider(providerId);
  const assetId = input.assetId ?? randomUUID();
  const vars = {
    prompt: input.prompt,
    promptIndex: String(input.promptIndex ?? 0),
    batchId: input.batchId,
    assetId,
    kind: provider.kind ?? "image",
  };

  const request = buildCreateRequest(provider, vars);
  const createResponse = await fetchJson(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.method.toUpperCase() === "GET" ? undefined : JSON.stringify(request.body),
  });

  const taskId = firstMatch(createResponse, provider.responseTaskIdPaths ?? []);
  const resultUrl = firstMatch(createResponse, provider.resultUrlPaths ?? []);
  const previewUrl =
    firstMatch(createResponse, provider.previewUrlPaths ?? []) ??
    resultUrl ??
    null;

  return {
    assetId,
    providerKind: provider.kind ?? "image",
    taskId: taskId ? String(taskId) : null,
    resultUrl: resultUrl ? String(resultUrl) : null,
    previewUrl: previewUrl ? String(previewUrl) : null,
    remoteStatus: normalizeStatus(provider, createResponse),
    requestPreview: redactSecrets({
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body,
    }),
    responsePreview: redactSecrets(createResponse),
  };
}

export async function pollRemoteAsset(providerId, asset) {
  const provider = await getProvider(providerId);
  if (!provider.poll) {
    return {
      remoteStatus: asset.resultUrl ? "completed" : asset.status,
      taskId: asset.taskId ?? null,
      resultUrl: asset.resultUrl ?? null,
      previewUrl: asset.previewUrl ?? null,
      responsePreview: asset.responsePreview ?? null,
    };
  }
  if (!asset.taskId) {
    throw new Error("Missing taskId for polling.");
  }

  const request = buildPollRequest(provider, {
    taskId: asset.taskId,
    batchId: asset.batchId,
    assetId: asset.id,
    prompt: asset.prompt,
    kind: asset.kind,
  });

  const response = await fetchJson(request.url, {
    method: request.method,
    headers: request.headers,
  });

  const resultUrl = firstMatch(response, provider.resultUrlPaths ?? []) ?? asset.resultUrl ?? null;
  const previewUrl =
    firstMatch(response, provider.previewUrlPaths ?? []) ??
    resultUrl ??
    asset.previewUrl ??
    null;

  return {
    remoteStatus: normalizeStatus(provider, response),
    taskId: asset.taskId,
    resultUrl: resultUrl ? String(resultUrl) : null,
    previewUrl: previewUrl ? String(previewUrl) : null,
    responsePreview: redactSecrets(response),
  };
}
