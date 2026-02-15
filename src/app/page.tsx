import Link from "next/link";
import HomeClient from "./HomeClient";

export default function Home() {
  return (
    <div className="relative bg-[#0a0a0a] text-white selection:bg-amber-200 selection:text-black">
      <HomeClient />

      {/* SEO content — visible to crawlers, positioned below the Three.js hero */}
      <section className="relative z-10 bg-[#0a0a0a] px-6 py-20 sm:py-28">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-amber-100/90 mb-6">
            Interactive Children&apos;s Books with AI Soundscapes
          </h1>
          <p className="text-base sm:text-lg text-white/60 leading-relaxed mb-10">
            Storia brings stories to life with AI-generated narration and ambient soundscapes
            that adapt to every scene. Children swipe through beautifully illustrated pages,
            tap to hear words read aloud with word-by-word highlighting, and immerse themselves
            in soundscapes — from rustling forests to crashing waves — that match each moment
            of the story.
          </p>

          <div className="grid sm:grid-cols-3 gap-8 text-left mb-14">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-200/70 mb-2">
                Read Aloud
              </h2>
              <p className="text-sm text-white/50 leading-relaxed">
                AI-powered narration reads each page with natural expression while highlighting
                words in real time, helping kids follow along and build reading skills.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-200/70 mb-2">
                Immersive Audio
              </h2>
              <p className="text-sm text-white/50 leading-relaxed">
                Every scene has its own ambient soundscape — ocean waves, chirping birds,
                city sounds — making stories feel alive and engaging for young readers.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-200/70 mb-2">
                Beautiful Illustrations
              </h2>
              <p className="text-sm text-white/50 leading-relaxed">
                Full-page illustrated artwork with text woven directly into the scene,
                creating a seamless visual reading experience on any device.
              </p>
            </div>
          </div>

          <Link
            href="/library"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 hover:text-white text-sm font-semibold tracking-wider transition-all duration-300"
          >
            Browse the Library
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14"/>
              <path d="m12 5 7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
