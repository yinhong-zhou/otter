"use client";

import { useState, useRef, useEffect, type CSSProperties } from "react";
import {
  IconPaw,
  IconRoute,
  IconArrowLeft,
  IconSparkles,
  IconHeart,
  IconMessageCircle,
  IconShare3,
  IconLink,
  IconFlag,
  IconToolsKitchen2,
  IconBallBasketball,
  IconBook2,
  IconBarbell,
  IconVolume,
  IconVolumeOff,
  type Icon,
} from "@tabler/icons-react";
import { daily, pairs } from "@/lib/data";

// §5 视觉 + 数据定稿,不动。仅按 §5.1 将 ti 字体图标替换为 @tabler/icons-react。
const ORIG_ICONS: Record<string, Icon> = {
  flag: IconFlag,
  "tools-kitchen-2": IconToolsKitchen2,
  "ball-basketball": IconBallBasketball,
  "book-2": IconBook2,
  sparkles: IconSparkles,
  barbell: IconBarbell,
};

const rail = (variant: "otter" | "orig") => (
  <div
    style={{
      position: "absolute",
      right: 6,
      bottom: 50,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 9,
      color: "#fff",
    }}
  >
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: variant === "otter" ? "#534AB7" : "rgba(255,255,255,0.2)",
        border: "1.5px solid #fff",
      }}
    />
    <IconHeart size={16} />
    <IconMessageCircle size={16} />
    <IconShare3 size={16} />
  </div>
);

// 左/右各一个声音开关。叠在屏左侧中部,点击不冒泡到换片。
const soundBtn = (muted: boolean, toggle: () => void, label: string) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      toggle();
    }}
    aria-label={label}
    style={{
      position: "absolute",
      left: 8,
      top: "50%",
      transform: "translateY(-50%)",
      zIndex: 6,
      display: "grid",
      placeItems: "center",
      width: 32,
      height: 32,
      borderRadius: "50%",
      background: "rgba(0,0,0,0.4)",
      border: "0.5px solid rgba(255,255,255,0.22)",
      color: "#fff",
      cursor: "pointer",
      padding: 0,
    }}
  >
    {muted ? <IconVolumeOff size={16} /> : <IconVolume size={16} />}
  </button>
);

const pill: CSSProperties = {
  position: "absolute",
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  padding: "2px 7px",
  borderRadius: 99,
  fontSize: 11,
  letterSpacing: "0.5px",
};

export default function OtterDemo() {
  const [iDaily, setIDaily] = useState(0);
  const [iPair, setIPair] = useState(0);

  // 左屏只轮播已定稿、有视频的日常(当前 4 条);无视频的不进轮播
  const dailyClips = daily.filter((x) => x.video);
  const dList = dailyClips.length ? dailyClips : daily;
  const d = dList[iDaily % dList.length];
  // 中/右屏轮播全部穿越对(6 条):有视频的播视频(当前诺曼底),
  // 其余回退到 §5 占位视觉(水獭版「穿越中…」/ 原视频图标)。点击逐条切换。
  const pList = pairs;
  const p = pList[iPair % pList.length];
  const OrigIcon = ORIG_ICONS[p.orig.icon] ?? IconLink;

  const nextDaily = () => setIDaily((i) => (i + 1) % dList.length);
  const nextPair = () => setIPair((i) => (i + 1) % pList.length);

  // 左组声音 = 日常视频;右组声音 = 水獭穿越视频。原视频永远静音。
  const dailyVidRef = useRef<HTMLVideoElement>(null);
  const otterVidRef = useRef<HTMLVideoElement>(null);
  // 互斥:同一时刻最多一路有声(日常 / 水獭),开一个自动静音另一个。
  const [audioSide, setAudioSide] = useState<"none" | "daily" | "otter">("none");
  const dailyMuted = audioSide !== "daily";
  const otterMuted = audioSide !== "otter";

  // 视频每次切片会按 key 重挂载,muted 复位到属性(true);
  // 依赖里带上当前片源,重挂载后重新套用用户选择的声音状态。
  useEffect(() => {
    const v = dailyVidRef.current;
    if (!v) return;
    v.muted = dailyMuted;
    if (!dailyMuted) void v.play().catch(() => {});
  }, [dailyMuted, d.video]);

  useEffect(() => {
    const v = otterVidRef.current;
    if (!v) return;
    v.muted = otterMuted;
    if (!otterMuted) void v.play().catch(() => {});
  }, [otterMuted, p.otterVideo]);

  return (
    <div className="otter-stage">
      <header style={{ textAlign: "center", marginBottom: 22 }}>
        <p
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "1.5px",
            margin: "0 0 4px",
          }}
        >
          神奇水獭 · OTTER
        </p>
        <p style={{ fontSize: 18, color: "#fafafa", fontWeight: 500, margin: 0 }}>
          你看什么 · 他就去哪
        </p>
      </header>

      <div className="otter-grid">
        {/* 左组:水獭日常(独立容器) */}
        <div className="otter-group otter-group-daily">
          <div className="otter-col-daily">
            <div className="otter-phone" onClick={nextDaily}>
              {/* 定稿日常视频:全屏自动循环静音播放,顶部/底部 UI 叠其上 */}
              <video
                ref={dailyVidRef}
                key={d.video}
                src={d.video}
                autoPlay
                muted
                playsInline
                preload="auto"
                onEnded={nextDaily}
                onError={nextDaily}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
              {soundBtn(
                dailyMuted,
                () => setAudioSide((s) => (s === "daily" ? "none" : "daily")),
                dailyMuted ? "开启日常声音" : "日常静音"
              )}
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  left: 10,
                  right: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "#E24B4A",
                    }}
                  />
                  <span>LIVE</span>
                  <span style={{ color: "rgba(255,255,255,0.5)" }}>· {d.loc}</span>
                </div>
                <span>{d.time}</span>
              </div>
              {/* 占位框已移除:日常视频全屏播放,见上方 <video> */}
              <div
                style={{
                  position: "absolute",
                  left: 10,
                  right: 10,
                  bottom: 30,
                  color: "#fff",
                  fontSize: 11,
                }}
              >
                {d.caption}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 10,
                  right: 10,
                  bottom: 10,
                  display: "flex",
                  gap: 4,
                }}
              >
                {["拍", "喂", "×"].map((t) => (
                  <span
                    key={t}
                    style={{
                      flex: 1,
                      background: "rgba(255,255,255,0.1)",
                      color: "#fff",
                      padding: 4,
                      borderRadius: 6,
                      textAlign: "center",
                      fontSize: 11,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <p className="otter-cap">水獭日常</p>
            <p className="otter-hint">点屏幕刷一下</p>
          </div>
        </div>

        {/* 分割短白线 */}
        <div className="otter-divider" aria-hidden="true" />

        {/* 右组:穿越对(独立容器,中+右两屏紧凑相连) */}
        <div className="otter-group otter-group-cross">
          {/* 2 · 水獭穿越后 */}
          <div className="otter-col-otter">
            <div style={{ position: "relative" }}>
              <div className="otter-phone" onClick={nextPair}>
                {/* 定稿:水獭穿越生成视频,全屏循环;UI 叠其上 */}
                {p.otterVideo && (
                  <video
                    ref={otterVidRef}
                    key={p.otterVideo}
                    src={p.otterVideo}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
                {p.otterVideo &&
                  soundBtn(
                    otterMuted,
                    () => setAudioSide((s) => (s === "otter" ? "none" : "otter")),
                    otterMuted ? "开启水獭声音" : "水獭静音"
                  )}
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                    gap: 10,
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 11,
                  }}
                >
                  <span>关注</span>
                  <span style={{ color: "#fff", fontWeight: 500 }}>宠物</span>
                </div>
                <div
                  style={{
                    ...pill,
                    top: 8,
                    left: 8,
                    background: "#534AB7",
                    color: "#fff",
                  }}
                >
                  <IconPaw size={11} />
                  水獭版
                </div>
                <div
                  style={{
                    ...pill,
                    top: 8,
                    right: 8,
                    background: "rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  <IconSparkles size={11} />
                  AI
                </div>
                {!p.otterVideo && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <IconPaw size={42} color="rgba(255,255,255,0.3)" />
                    <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                      穿越中…
                    </p>
                  </div>
                )}
                {rail("otter")}
                <div
                  style={{
                    position: "absolute",
                    left: 8,
                    right: 34,
                    bottom: 10,
                    color: "#fff",
                    fontSize: 11,
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 500 }}>@小獭</p>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.88)" }}>{p.otter}</p>
                </div>
              </div>
              {/* 方向:原视频(右屏 3)→ 水獭版(中屏 2),箭头朝左指向第二屏 */}
              <div className="cross-pill">
                <IconArrowLeft size={11} />
                <span>穿越</span>
                <IconRoute size={11} />
              </div>
            </div>
            <p className="otter-cap">水獭穿越后</p>
            <p className="otter-hint">点中/右屏同步换</p>
          </div>

          {/* 3 · 原视频(永远静音,无声音开关) */}
          <div className="otter-col-orig">
            <div
              className="otter-phone"
              style={{ background: "#000" }}
              onClick={nextPair}
            >
              {/* 定稿:你刚刷到的原视频(截取的 10s 源片),全屏循环;UI 叠其上 */}
              {p.origVideo && (
                <video
                  key={p.origVideo}
                  src={p.origVideo}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  left: 0,
                  right: 0,
                  display: "flex",
                  justifyContent: "center",
                  gap: 10,
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 11,
                }}
              >
                <span style={{ color: "#fff", fontWeight: 500 }}>推荐</span>
                <span>关注</span>
              </div>
              <div
                style={{
                  ...pill,
                  top: 8,
                  left: 8,
                  background: "rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                <IconLink size={11} />
                原视频
              </div>
              {!p.origVideo && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <OrigIcon size={38} color="rgba(255,255,255,0.32)" />
                </div>
              )}
              {rail("orig")}
              <div
                style={{
                  position: "absolute",
                  left: 8,
                  right: 34,
                  bottom: 10,
                  color: "#fff",
                  fontSize: 11,
                }}
              >
                <p style={{ margin: 0, fontWeight: 500 }}>{p.orig.author}</p>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.85)" }}>
                  {p.orig.title}
                </p>
              </div>
            </div>
            <p className="otter-cap">原视频</p>
            <p className="otter-hint">你刚刷到的</p>
          </div>
        </div>
      </div>
    </div>
  );
}
