import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="zh-CN">
      <body className="font-sans bg-bg-primary text-text-primary">{children}</body>
    </html>
  );
}
