import OtterDemo from "./OtterDemo";

export default function DemoSection() {
  return (
    <section className="demo-section py-20 px-4 md:px-6 bg-[#0A0A0A]">
      <header className="text-center mb-12">
        <p className="text-xs tracking-widest text-white/40 mb-2">DEMO</p>
        <h2 className="text-2xl md:text-3xl font-medium text-white">
          他不知道你在看
          <br />
          往下滑，撞见他
        </h2>
      </header>
      <div className="w-full max-w-[1440px] mx-auto">
        <OtterDemo />
      </div>
    </section>
  );
}
