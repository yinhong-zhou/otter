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

const skinRows = [topSkins, bottomSkins, thirdSkins, fourthSkins];
const allSkins = skinRows.flat();
const columnAlignedSkins =
  allSkins.length % skinRows.length === 0
    ? allSkins
    : [
        ...allSkins,
        ...allSkins.slice(0, skinRows.length - (allSkins.length % skinRows.length)),
      ];
const marqueeSkins = [
  ...columnAlignedSkins,
  ...columnAlignedSkins,
  ...columnAlignedSkins,
];

export default function SkinsMarquee() {
  const [selected, setSelected] = useState<string | null>(null);
  const isPaused = selected !== null;

  return (
    <section className="skins-stage" aria-label="神奇水獭换装轮播">
      <div className={`skins-track${isPaused ? " is-paused" : ""}`}>
        {marqueeSkins.map((skin, index) => {
          const key = `${skin.src}-${index}`;
          const isSelected = selected === key;

          return (
            <SkinCard
              key={key}
              skin={skin}
              isSelected={isSelected}
              setSelected={setSelected}
              itemKey={key}
            />
          );
        })}
      </div>
    </section>
  );
}

function SkinCard({
  skin,
  isSelected,
  setSelected,
  itemKey,
}: {
  skin: { src: string; label: string };
  isSelected: boolean;
  setSelected: Dispatch<SetStateAction<string | null>>;
  itemKey: string;
}) {
  return (
    <button
      className={`skins-card${isSelected ? " is-selected" : ""}`}
      onClick={() => setSelected((current) => (current === itemKey ? null : itemKey))}
      type="button"
      aria-pressed={isSelected}
      aria-label={`${isSelected ? "继续轮播" : "暂停并查看"} ${skin.label}`}
    >
      <img src={skin.src} alt={skin.label} />
    </button>
  );
}
