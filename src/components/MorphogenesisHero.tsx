"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import SplitType from "split-type";
import HeroDissolveShader from "./HeroDissolveShader";

gsap.registerPlugin(ScrollTrigger);

interface MorphogenesisHeroProps {
  onAuthClick: () => void;
  isLoggedIn: boolean;
}

export default function MorphogenesisHero({
  onAuthClick,
  isLoggedIn,
}: MorphogenesisHeroProps) {
  const heroRef = useRef<HTMLElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLElement>(null);
  const svgPathRef = useRef<SVGPathElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const lenisRef = useRef<Lenis | null>(null);

  const handleScroll = useCallback((scroll: number) => {
    if (!heroRef.current) return;
    const heroHeight = heroRef.current.offsetHeight;
    const windowHeight = window.innerHeight;
    const maxScroll = heroHeight - windowHeight;
    const progress = Math.min((scroll / maxScroll) * 2, 1.1);
    setScrollProgress(progress);
  }, []);

  useEffect(() => {
    // Initialize Lenis smooth scroll
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    // RAF loop for Lenis
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // Connect Lenis to ScrollTrigger
    lenis.on("scroll", ScrollTrigger.update);
    lenis.on("scroll", ({ scroll }: { scroll: number }) => handleScroll(scroll));

    // Word-by-word reveal animation
    const heroH2 = heroContentRef.current?.querySelector("h2");
    if (heroH2) {
      const split = new SplitType(heroH2, { types: "words" });
      const words = split.words;

      if (words) {
        gsap.set(words, { opacity: 0 });

        ScrollTrigger.create({
          trigger: heroContentRef.current,
          start: "top 25%",
          end: "bottom 100%",
          onUpdate: (self) => {
            const progress = self.progress;
            const totalWords = words.length;

            words.forEach((word, index) => {
              const wordProgress = index / totalWords;
              const nextWordProgress = (index + 1) / totalWords;

              let opacity = 0;

              if (progress >= nextWordProgress) {
                opacity = 1;
              } else if (progress >= wordProgress) {
                const fadeProgress =
                  (progress - wordProgress) / (nextWordProgress - wordProgress);
                opacity = fadeProgress;
              }

              gsap.to(word, {
                opacity: opacity,
                duration: 0.1,
                overwrite: true,
              });
            });
          },
        });
      }
    }

    // SVG Stroke Draw Animation
    const path = svgPathRef.current;
    if (path) {
      const pathLength = path.getTotalLength();
      path.style.strokeDasharray = `${pathLength}`;
      path.style.strokeDashoffset = `${pathLength}`;

      gsap.to(path, {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: {
          trigger: spotlightRef.current,
          start: "top 80%", // Start drawing when spotlight is 80% from top (earlier)
          end: "bottom 20%", // End when spotlight bottom is 20% from top
          scrub: 1,
        },
      });
    }

    return () => {
      lenis.destroy();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, [handleScroll]);

  return (
    <>
      {/* Hero Section */}
      <section
        ref={heroRef}
        className="hero relative w-full overflow-hidden"
        style={{ height: "200svh" }}
      >
        {/* Hero Header - First viewport */}
        <div
          className="hero-header absolute w-full flex flex-col justify-center items-center gap-4 text-center px-4"
          style={{ height: "100svh" }}
        >
          <span className="font-mono text-xs tracking-[0.5em] uppercase opacity-40">
            Experience Literature through Sound
          </span>
          <h1 className="text-5xl md:text-8xl lg:text-9xl font-serif font-black leading-tight md:leading-none tracking-tight text-amber-100">
            Storia
          </h1>
          <p className="max-w-xl text-lg md:text-xl font-light opacity-70">
            Where every page comes alive with AI-generated soundscapes
          </p>

          {/* Scroll Indicator */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 opacity-40">
            <div className="w-[1px] h-12 bg-gradient-to-b from-white to-transparent" />
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase">
              Scroll to discover
            </span>
          </div>
        </div>

        {/* WebGL Dissolve Canvas */}
        <HeroDissolveShader
          progress={scrollProgress}
          color="#fef3c7"
          spread={0.5}
          className="z-10"
        />

        {/* Hero Content - Revealed after dissolve */}
        <div
          ref={heroContentRef}
          className="hero-content absolute bottom-0 w-full flex justify-center items-center text-center px-4"
          style={{ height: "150svh" }}
        >
          <h2 className="max-w-4xl text-3xl md:text-5xl lg:text-6xl font-serif font-black leading-tight text-[#0a0a0a]">
            40% of children struggle to read on grade level. We believe every
            story deserves to be heard, felt, and experienced through the magic
            of sound.
          </h2>
        </div>
      </section>

      {/* Spotlight Section with SVG Stroke Animation */}
      <section
        ref={spotlightRef}
        className="spotlight relative w-full py-8 px-4 md:px-8 flex flex-col gap-24 md:gap-40 overflow-hidden bg-[#fef3c7]"
      >
        {/* SVG Path Background */}
        <div className="svg-path absolute top-[5vh] md:top-[10vh] left-1/2 -translate-x-1/2 w-[275%] md:w-[90%] h-[120%] z-0 pointer-events-none">
          <svg
            viewBox="0 0 1378 3500"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMin meet"
            className="w-full h-auto"
          >
            <path
              ref={svgPathRef}
              d="M639.668 100C639.668 100 105.669 100 199.669 601.503C293.669 1103.01 1277.17 691.502 1277.17 1399.5C1277.17 2107.5 -155.332 1968 140.168 1438.5C435.669 909.002 1442.66 2093.5 713.168 2659.5C400 2900 200 3100 500 3300"
              stroke="#FF5F0A"
              strokeWidth="200"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Row 1: Image */}

        {/* Row 2: Card + Image */}
        <div className="row flex flex-col md:flex-row justify-center gap-8 relative z-10">
          <div className="col flex-1 flex flex-col justify-center">
            <div className="card w-full md:w-3/4 mx-auto p-6 md:p-12 bg-[#0a0a0a] rounded-2xl flex flex-col gap-4 text-white">
              <div className="font-mono text-xs opacity-40">01 / Analysis</div>
              <h2 className="text-2xl md:text-4xl font-serif font-black text-amber-100">
                AI Scene Analysis
              </h2>
              <p className="text-base md:text-lg font-light opacity-70 leading-relaxed">
                Our AI identifies scenes, moods, settings, and emotions —
                understanding the context just like a human reader would.
              </p>
            </div>
          </div>
          <div className="col flex-1 flex items-center justify-center">
            <img
              src="/landing/MagicalCreature.svg"
              alt="Magical creature emerging"
              className="w-full md:w-3/4 h-auto"
            />
          </div>
        </div>

        {/* Row 3: Image + Card */}
        <div className="row flex flex-col md:flex-row-reverse justify-center gap-8 relative z-10">
          <div className="col flex-1 flex flex-col justify-center">
            <div className="card w-full md:w-3/4 mx-auto p-6 md:p-12 bg-[#0a0a0a] rounded-2xl flex flex-col gap-4 text-white">
              <div className="font-mono text-xs opacity-40">02 / Generation</div>
              <h2 className="text-2xl md:text-4xl font-serif font-black text-amber-100">
                Sonic Immersion
              </h2>
              <p className="text-base md:text-lg font-light opacity-70 leading-relaxed">
                Enjoy seamlessly generated soundscapes that crossfade between
                scenes, adapting to the story&apos;s mood in real-time.
              </p>
            </div>
          </div>
          <div className="col flex-1 flex items-center justify-center">
            <img
              src="/landing/Floating:Emerging.svg"
              alt="Elements floating from book"
              className="w-full md:w-3/4 h-auto"
            />
          </div>
        </div>

        {/* Row 4: Card + Image */}
        <div className="row flex flex-col md:flex-row justify-center gap-8 relative z-10">
          <div className="col flex-1 flex flex-col justify-center">
            <div className="card w-full md:w-3/4 mx-auto p-6 md:p-12 bg-[#0a0a0a] rounded-2xl flex flex-col gap-4 text-white">
              <div className="font-mono text-xs opacity-40">03 / Experience</div>
              <h2 className="text-2xl md:text-4xl font-serif font-black text-amber-100">
                The Living Text
              </h2>
              <p className="text-base md:text-lg font-light opacity-70 leading-relaxed">
                Every word resonates with meaning. Experience your library as a
                multi-sensory journey through sound and light.
              </p>
            </div>
          </div>
          <div className="col flex-1 flex items-center justify-center">
            <img
              src="/landing/TheReader.svg"
              alt="Reader immersed in story"
              className="w-full md:w-3/4 h-auto"
            />
          </div>
        </div>
      </section>

      {/* Transition Section */}
      <section className="relative w-full h-[50vh] flex flex-col items-center justify-center text-center px-4 md:px-8 bg-[#fef3c7]">
        <h2 className="max-w-4xl text-3xl md:text-5xl font-serif font-black text-[#0a0a0a]">
          Clearer stories, deeper connections, ready for whatever comes next
        </h2>
      </section>

      {/* Final CTA */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-4 md:px-8 relative overflow-hidden bg-[#0a0a0a]">
        <div className="relative z-10">
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-serif font-black mb-12 text-white">
            Ready to listen?
          </h2>
          {isLoggedIn ? (
            <a
              href="/library"
              className="text-xl md:text-2xl lg:text-3xl font-serif italic hover:text-amber-200 transition-colors cursor-pointer border-b border-white/20 pb-2"
            >
              Continue your journey in the Library
            </a>
          ) : (
            <button
              onClick={onAuthClick}
              className="text-xl md:text-2xl lg:text-3xl font-serif italic hover:text-amber-200 transition-colors cursor-pointer border-b border-white/20 pb-2"
            >
              Read your first Storia soundscape-book today
            </button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 md:p-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 md:gap-8 opacity-40 text-xs font-mono tracking-wider md:tracking-widest uppercase bg-[#0a0a0a]">
        <div className="text-center md:text-left">&copy; 2026 Storia</div>
        <div className="flex gap-6 md:gap-8">
          <a href="/admin/books" className="hover:opacity-100 transition-opacity">
            Admin
          </a>
          <a
            href="https://github.com"
            className="hover:opacity-100 transition-opacity"
          >
            GitHub
          </a>
        </div>
      </footer>
    </>
  );
}
