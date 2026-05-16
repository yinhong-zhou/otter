"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { IconVolume, IconVolumeOff } from "@tabler/icons-react";

// 文案 — 用户定稿
const SLOGAN = "嗨 · 我叫神奇水獭";
const INTRO_1 = "我是你的水獭搭子 · 住在你的抖音里";
const INTRO_2 = "你刷视频时 · 我就会出现在那条里";

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const sloganRef = useRef<HTMLHeadingElement>(null);
  const intro1Ref = useRef<HTMLParagraphElement>(null);
  const intro2Ref = useRef<HTMLParagraphElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  const [audioOn, setAudioOn] = useState(false);

  // 文字层一轮:进(slogan 逐字 fade-up)→ 停 ~2s → 整体淡出。
  // 可重复调用(每个视频循环末尾跑一次);done 在淡出后回调,用于重启视频。
  const titleCycle = useCallback((done?: () => void) => {
    const chars = sloganRef.current?.querySelectorAll<HTMLElement>(".char") ?? [];
    const intros = [intro1Ref.current, intro2Ref.current].filter(
      Boolean
    ) as HTMLElement[];
    const hint = hintRef.current;
    const all = [...Array.from(chars), ...intros, hint].filter(
      Boolean
    ) as HTMLElement[];
    const tl = gsap.timeline({ onComplete: done });

    // 进
    tl.fromTo(
      chars,
      { yPercent: 60, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.45, ease: "power3.out", stagger: 0.03 },
      0
    );
    tl.fromTo(
      intros,
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, ease: "power2.out", stagger: 0.1 },
      0.2
    );
    tl.fromTo(hint, { opacity: 0 }, { opacity: 0.6, duration: 0.35 }, 0.4);

    // 停 ~2s → 整体淡出
    tl.to(all, { opacity: 0, duration: 0.4, ease: "power1.in" }, "+=1.6");
    return tl;
  }, []);

  // 视频:手动循环。放完(停在最后一帧)→ 文字一轮 ~2s → 归零重播。
  // (不用 <video loop>:loop 不触发 'ended' 也不停最后一帧,无法插入文字停顿)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let tl: gsap.core.Timeline | null = null;

    const onEnded = () => {
      tl = titleCycle(() => {
        if (cancelled) return;
        try {
          video.currentTime = 0;
        } catch {
          /* noop */
        }
        void video.play().catch(() => {});
      });
    };
    video.addEventListener("ended", onEnded);

    // 视频缺失/报错:静态显示文字(不重启视频),首屏不至于空白
    const onError = () => {
      titleCycle();
    };
    video.addEventListener("error", onError);
    const fallback = window.setTimeout(() => {
      if (video.readyState < 2) titleCycle();
    }, 12000);

    return () => {
      cancelled = true;
      tl?.kill();
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
      window.clearTimeout(fallback);
    };
  }, [titleCycle]);

  // §6.3 鼠标 ±5px 微视差(可选)
  useEffect(() => {
    const layer = textLayerRef.current;
    if (!layer) return;
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 10;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      gsap.to(layer, { x, y, duration: 0.6, ease: "power2.out" });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // 喇叭按钮:解除/恢复视频自身静音。
  // 视频带的是 Seedance 2.0 生成的音轨(generate_audio=true);自动播放策略
  // 要求初始 muted,点击后 unmute 才出声(浏览器要求由用户手势触发)。
  const toggleAudio = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted) {
      video.muted = false;
      video.volume = 1;
      void video.play().catch(() => {});
      setAudioOn(true);
    } else {
      video.muted = true;
      setAudioOn(false);
    }
  };

  return (
    <section className="hero relative h-screen overflow-hidden bg-bg-primary">
      {/* 定稿:A 破窗穿越(§3.3 概念 A),Seedance 2.0 生成,自带音轨。
          只有 mp4(无 ffmpeg 转 webm),直接播 mp4,免 webm/poster 404。
          手动循环(无 loop 属性):放完停最后一帧 → slogan 浮现 ~2s → 重播。
          初始 muted 满足自动播放策略,右上角喇叭点击后解除静音出声。 */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src="/hero.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
      />

      <div
        ref={textLayerRef}
        className="text-layer absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6"
      >
        <h1 ref={sloganRef} className="slogan" aria-label={SLOGAN}>
          {Array.from(SLOGAN).map((ch, i) => (
            <span
              key={i}
              className="char inline-block"
              style={{ opacity: 0, whiteSpace: ch === " " ? "pre" : "normal" }}
            >
              {ch}
            </span>
          ))}
        </h1>
        <p ref={intro1Ref} className="intro" style={{ opacity: 0 }}>
          {INTRO_1}
        </p>
        <p ref={intro2Ref} className="intro" style={{ opacity: 0 }}>
          {INTRO_2}
        </p>
        <div ref={hintRef} className="scroll-hint" style={{ opacity: 0 }}>
          ↓ scroll
        </div>
      </div>

      <button
        onClick={toggleAudio}
        aria-label={audioOn ? "关闭声音" : "播放声音"}
        className="audio-toggle absolute top-6 right-6 z-10 grid place-items-center w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
      >
        {audioOn ? <IconVolume size={20} /> : <IconVolumeOff size={20} />}
      </button>
    </section>
  );
}
