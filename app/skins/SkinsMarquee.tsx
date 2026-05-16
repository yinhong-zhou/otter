"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

const topSkins = Array.from({ length: 14 }, (_, index) => ({
  src: `/skins-1/1.${index + 1}.jpg`,
  label: `Skin ${String(index + 1).padStart(2, "0")}`,
}));

const bottomSkins = Array.from({ length: 8 }, (_, index) => ({
  src: `/skins/2.${index + 1}.jpg`,
  label: `Skin ${String(index + 1).padStart(2, "0")}`,
}));

const thirdSkins = Array.from({ length: 8 }, (_, index) => ({
  src: `/skins-3/3.${index + 1}.png`,
  label: `Skin ${String(index + 1).padStart(2, "0")}`,
}));

const fourthSkins = Array.from({ length: 8 }, (_, index) => ({
  src: `/skins-4/4.${index + 1}.png`,
  label: `Skin ${String(index + 1).padStart(2, "0")}`,
}));

export default function SkinsMarquee() {
  const [selected, setSelected] = useState<string | null>(null);
  const isPaused = selected !== null;

  return (
    <section className="skins-stage" aria-label="神奇水獭换装轮播">
      <SkinRow
        className="skins-row-top"
        items={topSkins}
        isPaused={isPaused}
        selected={selected}
        setSelected={setSelected}
      />
      <SkinRow
        items={bottomSkins}
        isPaused={isPaused}
        selected={selected}
        setSelected={setSelected}
      />
      <SkinRow
        className="skins-row-third"
        items={thirdSkins}
        isPaused={isPaused}
        selected={selected}
        setSelected={setSelected}
      />
      <SkinRow
        className="skins-row-fourth"
        items={fourthSkins}
        isPaused={isPaused}
        selected={selected}
        setSelected={setSelected}
      />
    </section>
  );
}

function SkinRow({
  className = "",
  items,
  isPaused,
  selected,
  setSelected,
}: {
  className?: string;
  items: { src: string; label: string }[];
  isPaused: boolean;
  selected: string | null;
  setSelected: Dispatch<SetStateAction<string | null>>;
}) {
  return (
    <div className={`skins-row ${className}${isPaused ? " is-paused" : ""}`}>
      {[...items, ...items].map((skin, index) => {
        const key = `${skin.src}-${index}`;
        const isSelected = selected === key;

        return (
          <button
            className={`skins-card${isSelected ? " is-selected" : ""}`}
            key={key}
            onClick={() => setSelected((current) => (current === key ? null : key))}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${isSelected ? "继续轮播" : "暂停并查看"} ${skin.label}`}
          >
            <img src={skin.src} alt={skin.label} />
          </button>
        );
      })}
    </div>
  );
}
