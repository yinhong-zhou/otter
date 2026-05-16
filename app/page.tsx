import Hero from "@/components/Hero";
import DemoSection from "@/components/DemoSection";
import SmoothScroll from "@/components/SmoothScroll";
import SkinsMarquee from "@/app/skins/SkinsMarquee";

// §2 就两屏:没有 nav,没有 footer。
export default function Home() {
  return (
    <main>
      <SmoothScroll />
      <Hero />
      <DemoSection />
      <section className="relative h-screen overflow-hidden bg-black">
        <h2 className="absolute left-1/2 top-8 z-20 -translate-x-1/2 whitespace-nowrap font-serif text-5xl font-black leading-none text-white md:top-10 md:text-[92px]">
          装扮大赏
        </h2>
        <SkinsMarquee />
      </section>
    </main>
  );
}
