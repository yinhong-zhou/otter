"use client";

import { useEffect, useMemo, useState } from "react";

type Decision = "keep" | "reject";
type FilterMode = "all" | "undecided" | Decision;
type DirectoryBucket = "keep" | "reject" | "undecided";

type ReviewItem = {
  id: string;
  title: string;
  sourceFile: string;
  relativePath: string;
  publicUrl: string;
  bytes: number;
  updatedAt: string;
  tags: string[];
};

type ReviewManifest = {
  generatedAt: string;
  sourceDir: string;
  servedDir: string;
  copiedToPublic: boolean;
  total: number;
  items: ReviewItem[];
};

type RoutingSummary = {
  moved: number;
  skipped: number;
  failed: number;
};

type PickerHandle = FileSystemDirectoryHandle;

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}

const STORAGE_KEY = "otter-review-decisions-v1";

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function decisionToBucket(decision?: Decision): DirectoryBucket {
  if (decision === "keep") {
    return "keep";
  }
  if (decision === "reject") {
    return "reject";
  }
  return "undecided";
}

async function ensureSubdir(parent: PickerHandle, name: string) {
  return parent.getDirectoryHandle(name, { create: true });
}

async function routeFile(
  rootHandle: PickerHandle,
  item: ReviewItem,
  bucket: DirectoryBucket,
) {
  const sourceFile = await fetch(item.publicUrl).then(async (response) => {
    if (!response.ok) {
      throw new Error(`无法读取素材: ${item.publicUrl}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  });

  const bucketDir = await ensureSubdir(rootHandle, bucket);
  const targetFile = await bucketDir.getFileHandle(item.sourceFile, { create: true });
  const writable = await targetFile.createWritable();
  await writable.write(sourceFile);
  await writable.close();
}

export default function ReviewPage() {
  const [manifest, setManifest] = useState<ReviewManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [routing, setRouting] = useState(false);
  const [exportingPack, setExportingPack] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setDecisions(JSON.parse(saved) as Record<string, Decision>);
      }
    } catch {
      // Ignore local storage read errors in local review mode.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions));
    } catch {
      // Ignore local storage write errors in local review mode.
    }
  }, [decisions]);

  useEffect(() => {
    let cancelled = false;

    async function loadManifest() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/review-assets/review-manifest.json?ts=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Manifest load failed: ${response.status}`);
        }

        const data = (await response.json()) as ReviewManifest;
        if (!cancelled) {
          setManifest(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Manifest load failed");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadManifest();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    if (!manifest) {
      return [];
    }

    return manifest.items.filter((item) => {
      const decision = decisions[item.id];
      if (filterMode === "all") {
        return true;
      }
      if (filterMode === "undecided") {
        return !decision;
      }
      return decision === filterMode;
    });
  }, [decisions, filterMode, manifest]);

  const stats = useMemo(() => {
    if (!manifest) {
      return { total: 0, keep: 0, reject: 0, undecided: 0 };
    }

    const keep = manifest.items.filter((item) => decisions[item.id] === "keep").length;
    const reject = manifest.items.filter((item) => decisions[item.id] === "reject").length;

    return {
      total: manifest.items.length,
      keep,
      reject,
      undecided: manifest.items.length - keep - reject,
    };
  }, [decisions, manifest]);

  const keepItems = useMemo(() => {
    if (!manifest) {
      return [];
    }
    return manifest.items.filter((item) => decisions[item.id] === "keep");
  }, [decisions, manifest]);

  function setDecision(id: string, decision: Decision) {
    setStatus(null);
    setDecisions((current) => {
      if (current[id] === decision) {
        const next = { ...current };
        delete next[id];
        return next;
      }

      return { ...current, [id]: decision };
    });
  }

  function downloadJson(data: unknown, fileName: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportDecisions() {
    if (!manifest) {
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      sourceDir: manifest.sourceDir,
      servedDir: manifest.servedDir,
      decisions: manifest.items.map((item) => ({
        id: item.id,
        title: item.title,
        sourceFile: item.sourceFile,
        publicUrl: item.publicUrl,
        decision: decisions[item.id] ?? "undecided",
      })),
    };

    downloadJson(payload, "review-decisions.json");
    setStatus("已导出筛选结果 JSON。");
  }

  function exportRegenerationPack() {
    if (!manifest) {
      return;
    }

    setExportingPack(true);
    const payload = {
      exportedAt: new Date().toISOString(),
      sourceDir: manifest.sourceDir,
      totalKept: keepItems.length,
      regenerationCandidates: keepItems.map((item, index) => ({
        sequence: index + 1,
        id: item.id,
        title: item.title,
        sourceFile: item.sourceFile,
        relativePath: item.relativePath,
        publicUrl: item.publicUrl,
        hint: `围绕 ${item.title} 做同主题扩写，保留镜头气质但换动作、场景细节或结尾反应。`,
        nextRound: {
          keepCore: [item.title],
          vary: ["动作", "情绪", "景别", "结尾钩子"],
        },
      })),
      notes: [
        "这是前端导出的下一轮重生成包。",
        "可以先人工补充 prompt，再接到 workflow.py 或批量生成脚本。",
      ],
    };

    downloadJson(payload, "review-regeneration-pack.json");
    setExportingPack(false);
    setStatus("已导出下一轮重生成包。");
  }

  async function routeByDecision() {
    if (!manifest) {
      return;
    }

    if (!window.showDirectoryPicker) {
      setStatus("当前浏览器不支持目录写入。请用新版 Chromium 浏览器打开本页。");
      return;
    }

    setRouting(true);
    setStatus(null);

    const summary: RoutingSummary = { moved: 0, skipped: 0, failed: 0 };

    try {
      const rootHandle = await window.showDirectoryPicker();

      for (const item of manifest.items) {
        const bucket = decisionToBucket(decisions[item.id]);
        try {
          await routeFile(rootHandle, item, bucket);
          summary.moved += 1;
        } catch {
          summary.failed += 1;
        }
      }

      setStatus(`分流完成：写入 ${summary.moved} 个，失败 ${summary.failed} 个。目录下会生成 keep / reject / undecided。`);
    } catch (routeError) {
      if (routeError instanceof DOMException && routeError.name === "AbortError") {
        setStatus("已取消分流。");
      } else {
        setStatus("分流失败，请重新选择目录再试。");
      }
    } finally {
      setRouting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#090909] px-5 py-8 text-white md:px-10 md:py-10">
      <section className="mx-auto flex w-full max-w-[1560px] flex-col gap-8">
        <header className="flex flex-col gap-5 rounded-[28px] border border-white/10 bg-white/[0.04] px-6 py-6 backdrop-blur md:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#c8934a]">
                Video Review
              </p>
              <h1 className="mt-3 font-serif text-4xl font-black tracking-tight text-white md:text-6xl">
                本地视频筛选台
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60 md:text-base">
                先批量生成视频，再把视频目录扫成 manifest，最后在这里逐条判断“留下 / 淘汰”。
                这一版已经支持自动分流，以及从保留素材导出下一轮重生成包。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="总数" value={stats.total} />
              <StatCard label="留下" value={stats.keep} />
              <StatCard label="淘汰" value={stats.reject} />
              <StatCard label="未处理" value={stats.undecided} />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                {[
                  ["all", "全部"],
                  ["undecided", "未处理"],
                  ["keep", "留下"],
                  ["reject", "淘汰"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      filterMode === value
                        ? "border-[#c8934a] bg-[#c8934a] text-black"
                        : "border-white/12 bg-white/5 text-white/70 hover:border-white/25 hover:bg-white/10"
                    }`}
                    onClick={() => setFilterMode(value as FilterMode)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/75 transition hover:border-white/25 hover:bg-white/10"
                  onClick={() => window.location.reload()}
                  type="button"
                >
                  重新读取 manifest
                </button>
                <button
                  className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/75 transition hover:border-white/25 hover:bg-white/10"
                  onClick={exportDecisions}
                  type="button"
                >
                  导出筛选结果
                </button>
                <button
                  className="rounded-full border border-[#c8934a]/40 bg-[#c8934a]/15 px-4 py-2 text-sm text-[#f5d3a1] transition hover:bg-[#c8934a]/22"
                  disabled={keepItems.length === 0 || exportingPack}
                  onClick={exportRegenerationPack}
                  type="button"
                >
                  导出重生成包
                </button>
                <button
                  className="rounded-full border border-emerald-400/30 bg-emerald-400/12 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/18 disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={routing || !manifest}
                  onClick={() => void routeByDecision()}
                  type="button"
                >
                  {routing ? "正在分流..." : "自动分流到文件夹"}
                </button>
              </div>
            </div>

            {manifest ? (
              <div className="space-y-1 text-xs text-white/35">
                <p>
                  源目录: <span className="text-white/55">{manifest.sourceDir}</span>
                </p>
                <p>
                  预览目录: <span className="text-white/55">{manifest.servedDir}</span>
                  {manifest.copiedToPublic ? " (已自动复制到 public)" : ""}
                </p>
                <p>生成时间: {formatTime(manifest.generatedAt)}</p>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm leading-7 text-white/60">
              <p>自动分流会让你选一个本地目录，然后在里面写入 `keep / reject / undecided` 三个子目录。</p>
              <p>“导出重生成包”先走稳妥方案：把所有已保留素材整理成一个 JSON，供下一轮 prompt 或工作流继续加工。</p>
            </div>

            {status ? (
              <div className="rounded-2xl border border-[#c8934a]/20 bg-[#c8934a]/8 px-4 py-3 text-sm text-[#f1d4aa]">
                {status}
              </div>
            ) : null}
          </div>
        </header>

        {loading ? (
          <EmptyState title="正在读取清单" body="页面会读取 /review-assets/review-manifest.json。" />
        ) : null}

        {!loading && error ? (
          <EmptyState
            title="还没有 review manifest"
            body="先运行 node tools/build-review-manifest.mjs，或者把视频目录作为参数传进去再刷新页面。"
          />
        ) : null}

        {!loading && !error && manifest && filteredItems.length === 0 ? (
          <EmptyState title="当前筛选结果为空" body="换一个筛选项，或者先给这些视频做判断。" />
        ) : null}

        {!loading && !error && manifest && filteredItems.length > 0 ? (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => {
              const decision = decisions[item.id];

              return (
                <article
                  className="overflow-hidden rounded-[26px] border border-white/10 bg-[#121212] shadow-[0_28px_80px_rgba(0,0,0,0.35)]"
                  key={item.id}
                >
                  <div className="aspect-[9/16] bg-black">
                    <video
                      className="h-full w-full object-cover"
                      controls
                      muted
                      playsInline
                      preload="metadata"
                      src={item.publicUrl}
                    />
                  </div>

                  <div className="flex flex-col gap-4 px-5 py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-serif text-2xl font-bold text-white">{item.title}</h2>
                        <p className="mt-2 text-sm text-white/45">{item.sourceFile}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          decision === "keep"
                            ? "bg-emerald-400/15 text-emerald-300"
                            : decision === "reject"
                              ? "bg-rose-400/15 text-rose-300"
                              : "bg-white/8 text-white/55"
                        }`}
                      >
                        {decision === "keep" ? "已留下" : decision === "reject" ? "已淘汰" : "未处理"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-white/35">
                      <span>{formatBytes(item.bytes)}</span>
                      <span>{formatTime(item.updatedAt)}</span>
                      <span>{item.relativePath}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                          decision === "keep"
                            ? "bg-emerald-300 text-black"
                            : "border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/18"
                        }`}
                        onClick={() => setDecision(item.id, "keep")}
                        type="button"
                      >
                        留下
                      </button>
                      <button
                        className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                          decision === "reject"
                            ? "bg-rose-300 text-black"
                            : "border border-rose-400/20 bg-rose-400/10 text-rose-200 hover:bg-rose-400/18"
                        }`}
                        onClick={() => setDecision(item.id, "reject")}
                        type="button"
                      >
                        淘汰
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4">
      <div className="text-xs uppercase tracking-[0.2em] text-white/35">{label}</div>
      <div className="mt-2 font-serif text-3xl font-bold text-white">{value}</div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-[28px] border border-dashed border-white/12 bg-white/[0.03] px-6 py-16 text-center">
      <h2 className="font-serif text-3xl font-bold text-white">{title}</h2>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/55">{body}</p>
    </section>
  );
}
