import Hero from "@/components/Hero";
import DemoSection from "@/components/DemoSection";
import SmoothScroll from "@/components/SmoothScroll";
import SkinsMarquee from "@/app/skins/SkinsMarquee";
import CommercialSection from "@/components/CommercialSection";

export default function Home() {
  return (
    <main>
      <SmoothScroll />
      <Hero />
      <DemoSection />
      <section className="bg-black py-16 md:py-24">
        <h2 className="mb-10 text-center font-serif text-5xl font-black leading-none text-white md:mb-16 md:text-[92px]">
          装扮大赏
        </h2>
        <SkinsMarquee />
      </section>
      <CommercialSection />
    </main>
  );
}
