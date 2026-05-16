import type { Metadata, Viewport } from "next";
import { Noto_Serif_SC, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// next/font 在构建时下载并自托管字体文件,
// 满足 §6.2「本地化部署字体,不走 Google Fonts CDN」的要求。
const notoSerif = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "900"],
  variable: "--font-serif",
  display: "swap",
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "神奇水獭 · Otter",
  description: "一只生活在抖音里的神奇水獭——你看什么,他就去哪。",
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${notoSerif.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans bg-bg-primary text-text-primary">{children}</body>
    </html>
  );
}
