"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import SplitType from "split-type";
import HeroDissolveShader from "./HeroDissolveShader";
import PrinceModel from "./PrinceModel";

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

  // Refs for GSAP animations
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLSpanElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const parallaxLayer1Ref = useRef<HTMLDivElement>(null);
  const parallaxLayer2Ref = useRef<HTMLDivElement>(null);
  const parallaxLayer3Ref = useRef<HTMLDivElement>(null);
  const magneticElementsRef = useRef<HTMLDivElement>(null);

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

    // Character-by-character title animation with magnetic effect
    if (titleRef.current) {
      const splitTitle = new SplitType(titleRef.current, { types: "chars" });
      const chars = splitTitle.chars;

      if (chars) {
        // Initial state - hidden
        gsap.set(chars, { 
          opacity: 0, 
          y: 100,
          rotateX: -90,
          transformOrigin: "center bottom"
        });

        // Entrance animation - staggered character reveal
        gsap.to(chars, {
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 1.2,
          stagger: 0.08,
          ease: "power4.out",
          delay: 0.5
        });

        // Magnetic cursor effect for each character
        chars.forEach((char) => {
          char.addEventListener("mousemove", (e: MouseEvent) => {
            const rect = char.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const deltaX = (e.clientX - centerX) * 0.3;
            const deltaY = (e.clientY - centerY) * 0.3;

            gsap.to(char, {
              x: deltaX,
              y: deltaY,
              scale: 1.2,
              duration: 0.3,
              ease: "power2.out"
            });
          });

          char.addEventListener("mouseleave", () => {
            gsap.to(char, {
              x: 0,
              y: 0,
              scale: 1,
              duration: 0.5,
              ease: "elastic.out(1, 0.3)"
            });
          });
        });
      }
    }

    // Subtitle animation
    if (subtitleRef.current) {
      gsap.from(subtitleRef.current, {
        opacity: 0,
        y: 30,
        duration: 1,
        delay: 0.2,
        ease: "power3.out"
      });
    }

    // Description animation
    if (descriptionRef.current) {
      gsap.from(descriptionRef.current, {
        opacity: 0,
        y: 30,
        duration: 1,
        delay: 0.4,
        ease: "power3.out"
      });
    }

    // Scroll indicator animation
    if (scrollIndicatorRef.current) {
      gsap.from(scrollIndicatorRef.current, {
        opacity: 0,
        y: 20,
        duration: 1,
        delay: 1.5,
        ease: "power3.out"
      });

      // Continuous bounce animation
      gsap.to(scrollIndicatorRef.current.querySelector(".scroll-line"), {
        scaleY: 0.5,
        transformOrigin: "top",
        duration: 1,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut"
      });
    }

    // Parallax layers on scroll
    if (parallaxLayer1Ref.current) {
      gsap.to(parallaxLayer1Ref.current, {
        y: -150,
        ease: "none",
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1
        }
      });
    }

    if (parallaxLayer2Ref.current) {
      gsap.to(parallaxLayer2Ref.current, {
        y: -80,
        ease: "none",
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1.5
        }
      });
    }

    if (parallaxLayer3Ref.current) {
      gsap.to(parallaxLayer3Ref.current, {
        y: -40,
        ease: "none",
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 2
        }
      });
    }

    // Word-by-word reveal animation for hero content h2
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
          start: "top 80%",
          end: "bottom 20%",
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
      {/* <GrainOverlay /> */}
      {/* Hero Section */}
      <section
        ref={heroRef}
        className="hero relative w-full overflow-hidden bg-unset"
        style={{ height: "200svh" }}
      >
        {/* Background Image - positioned at top with gradient fade */}
        <div className="absolute inset-0 w-full h-full">
          <img
            src="https://res.cloudinary.com/https-pilot-tune-herokuapp-com/image/upload/v1667439399/cloud-ring-b9996e3e8fe9b463920384977b0d854c_gl7kn5.webp"
            alt=""
            className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[140%] max-w-[1000px] h-auto object-contain opacity-90"
            style={{ 
              maskImage: "linear-gradient(to bottom, black 50%, transparent 90%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 90%)",
              filter: "brightness(1.1) contrast(1.1)"
            }}
          />
          {/* Gradient overlay for smooth transition */}
          <div 
            className="absolute inset-0 bg-gradient-to-b from-transparent via-[#6495ED]/30 to-[#6495ED]"
            style={{ top: "20%" }}
          />
        </div>

        {/* Hero Header - First viewport */}
        <div
          ref={magneticElementsRef}
          className="hero-header absolute w-full flex flex-col items-center text-center px-4 pointer-events-auto"
          style={{ 
            height: "100svh", 
            zIndex: 50,
            paddingTop: "12vh"
          }}
        >
          {/* Top section: Subtitle + Title */}
          <div className="flex flex-col items-center">          
            <h1
              ref={titleRef}
              className="text-[14vw] sm:text-[11vw] md:text-[9vw] lg:text-[7vw] font-serif font-black leading-[0.85] tracking-tighter text-white cursor-default select-none -mt-1"
              style={{ 
                perspective: "1000px",
                textShadow: '0 4px 8px rgba(0,0,0,0.4), 0 0 40px rgba(255,255,255,0.3)'
              }}
            >
              Storia
            </h1>
            
            <h5
              ref={descriptionRef}
              className="opacity-100 max-w-xs md:max-w-sm text-lg md:text-base font-medium text-white mt-16 leading-snug"
              style={{ textShadow: '0 2px 4px rgba(255, 255, 255, 0.77)' }}
            >
                            Experience Literature through soundscapes that bring stories to life
            </h5>
          </div>

          {/* Middle section: Prince 3D Model */}
          <div className="flex-1 w-full max-w-[380px] md:max-w-[450px] min-h-[180px] md:min-h-[240px] relative -mt-2">
            <PrinceModel />
          </div>

          {/* CTA Button */}
          <div className="mt-4 md:mt-6 mb-4" style={{ position: 'relative', zIndex: 100 }}>
            {isLoggedIn ? (
              <a
                href="/library"
                className="group inline-flex items-center gap-3 px-8 py-4 bg-white hover:bg-white border-2 border-white rounded-full text-[#6495ED] font-mono text-sm tracking-widest uppercase transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg relative overflow-hidden"
                style={{ position: 'relative', zIndex: 100 }}
              >
                <span className="relative z-10">Start Reading</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="relative z-10 transition-transform duration-300 group-hover:translate-x-1"
                >
                  <path d="M5 12h14"/>
                  <path d="m12 5 7 7-7 7"/>
                </svg>
                <div className="absolute inset-0 bg-gradient-to-r from-white via-[#e8f0fe] to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => {
                  console.log("Start Reading clicked, isLoggedIn:", isLoggedIn);
                  onAuthClick();
                }}
                className="group inline-flex items-center gap-3 px-8 py-4 bg-white hover:bg-white border-2 border-white rounded-full text-[#6495ED] font-mono text-sm tracking-widest uppercase transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg relative overflow-hidden"
                style={{ position: 'relative', zIndex: 100 }}
              >
                <span className="relative z-10">Start Reading</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="relative z-10 transition-transform duration-300 group-hover:translate-x-1"
                >
                  <path d="M5 12h14"/>
                  <path d="m12 5 7 7-7 7"/>
                </svg>
                <div className="absolute inset-0 bg-gradient-to-r from-white via-[#e8f0fe] to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </button>
            )}
          </div>

          {/* Bottom section: Scroll Indicator */}
          <div
            ref={scrollIndicatorRef}
            className="flex flex-col items-center gap-3 pb-8 md:pb-12"
          >
            <div className="scroll-line w-[1px] h-10 bg-gradient-to-b from-white/60 to-transparent" />
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/60">
              Scroll to discover
            </span>
          </div>
        </div>

        {/* WebGL Dissolve Canvas */}
        <HeroDissolveShader
          progress={scrollProgress}
          color="#fef3c7"
          spread={0.5}
          className="z-[5] pointer-events-none"
        />

        {/* Hero Content - Revealed after dissolve */}
        <div
          ref={heroContentRef}
          className="hero-content absolute bottom-0 w-full flex justify-center items-center text-center px-4"
          style={{ height: "150svh", zIndex: 10 }}
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
