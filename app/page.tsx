import Hero from "@/components/Hero";
import DemoSection from "@/components/DemoSection";
import SmoothScroll from "@/components/SmoothScroll";

// §2 就两屏:没有 nav,没有 footer。
export default function Home() {
  return (
    <main>
      <SmoothScroll />
      <Hero />
      <DemoSection />
    </main>
  );
}
