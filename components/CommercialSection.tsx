"use client";

import { useEffect } from "react";
import styles from "./CommercialSection.module.css";

const revenueLines = [
  {
    tag: "01 · SKIN",
    title: "装扮付费",
    body: "穿越世界的服装皮肤。低客单高频次，参考 LINE 贴纸模式。",
  },
  {
    tag: "02 · SUB",
    title: "月订阅",
    body: "更高频出现、独家场景、A/B 剧情选择权。稳定现金流。",
  },
  {
    tag: "03 · IP",
    title: "品牌联名",
    body: "水獭穿越进品牌的世界。广告变成一次偶遇，不是插播。",
  },
  {
    tag: "04 · B2B",
    title: "平台授权",
    body: "把这套逻辑打包给抖音、B站、微信。他们有流量，我们有技术。",
  },
];

const delayClasses = [styles.delay1, styles.delay2, styles.delay3, styles.delay4];

export default function CommercialSection() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.isVisible);
          }
        });
      },
      { threshold: 0.15 },
    );

    document.querySelectorAll(`.${styles.reveal}`).forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section className={styles.chapter} aria-label="商业化路径">
      <div className={styles.panel}>
        <div className={styles.eyebrow}>BUSINESS MODEL · 变现路径</div>

        <h2 className={styles.headline}>
          四条线
          <br />
          <em>不依赖单一收入</em>
        </h2>

        <div className={styles.grid}>
          {revenueLines.map((line, index) => (
            <article
              className={`${styles.card} ${styles.reveal} ${delayClasses[index]}`}
              key={line.tag}
            >
              <div className={styles.tag}>{line.tag}</div>
              <h3>{line.title}</h3>
              <p>{line.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className={styles.rule} />

      <div className={`${styles.panel} ${styles.panelClose}`}>
        <div className={styles.vline} />

        <div className={`${styles.closing} ${styles.reveal}`}>
          没有人在等
          <br />
          一个需要打开的宠物。
          <br />
          <em>他们在等一次偶遇。</em>
        </div>

        <p className={`${styles.sub} ${styles.reveal} ${styles.delay2}`}>
          宠物经济 <strong>6000亿</strong>，虚拟陪伴赛道拥挤——
          <br />
          没有人做被动触达。这个位置现在是空的。
        </p>

        <footer className={styles.bottom}>
          <div>MAGIC OTTER · 水獭邻居</div>
          <div>
            CONCEPT 2025
            <br />
            CONFIDENTIAL
          </div>
        </footer>
      </div>
    </section>
  );
}
