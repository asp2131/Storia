"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import SplitType from "split-type";
import { useReducedMotionVariant } from "@/hooks/landing/useReducedMotionVariant";
import { scrambleIn } from "@/lib/landing/scramble";
import MascotStoryWorld from "./MascotStoryWorld";
import "./StoriaCalmLanding.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const MANIFESTO_WORDS = [
  "Loratone",
  "helps",
  "children",
  "strengthen",
  "reading,",
  "speech,",
  "and",
  "language",
  "skills",
  "through",
  "stories",
  "they",
  "can",
  "hear,",
  "feel,",
  "and",
  { text: "follow.", highlight: true },
];

const BOOKS = [
  { title: "The Wizard of Oz", meta: "Classic tale", cover: "bc-1" },
  { title: "Danny's Cat", meta: "Family favorite", cover: "bc-2" },
  { title: "My Day at Granny's", meta: "Quick read", cover: "bc-3" },
  { title: "The Tortoise and the Hare", meta: "Classic fable", cover: "bc-4" },
  { title: "Jax & Shini", meta: "Folk tale", cover: "bc-5" },
  { title: "Bunny Brother", meta: "Playful story", cover: "bc-6" },
  { title: "Kumu's Sky", meta: "Adventure", cover: "bc-7" },
  { title: "Sweet Potato Sweet Potato", meta: "By Cherelyn Poe", cover: "bc-8" },
];

const PRESS_LINKS = [
  {
    label: "Equitech Futures",
    title: "Shivang Thakor is building the conditions for children to love reading",
    href: "https://www.equitechfutures.com/articles/shivang-thakor-is-building-the-conditions-for-children-to-love-reading",
  },
  {
    label: "ALTA 2026 Podcast",
    title: "Shivang Thakor of the Loratone Kids App",
    href: "https://www.youtube.com/watch?v=wmx2MVKhntw&t=2s",
  },
];

export default function StoriaCalmLanding() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const heroTitleRef = useRef<HTMLHeadingElement | null>(null);
  const primaryCtaRef = useRef<HTMLAnchorElement | null>(null);
  const secondaryCtaRef = useRef<HTMLAnchorElement | null>(null);
  const { reduceMotion } = useReducedMotionVariant();

  useGSAP(
    () => {
      const root = rootRef.current;
      const heroTitle = heroTitleRef.current;
      if (!root || !heroTitle) return;

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const nav = root.querySelector<HTMLElement>(".storia-nav");
      const heroInner = root.querySelector<HTMLElement>(".hero-inner");
      const heroVisual = root.querySelector<HTMLElement>(".hero-visual");
      const heroPhoto = root.querySelector<HTMLElement>(".hero-photo-card");
      const heroHill = root.querySelector<HTMLElement>(".hero-mascot-hill");
      const heroMascot = root.querySelector<HTMLElement>(".hero-mascot-stage");
      const missionShell = root.querySelector<HTMLElement>(".mission-shell");
      const magneticButtons = [primaryCtaRef.current, secondaryCtaRef.current].filter(
        Boolean
      ) as HTMLAnchorElement[];
      const splitHeadline = reduceMotion
        ? null
        : new SplitType(heroTitle, {
            types: "lines,chars",
            lineClass: "hero-line",
            charClass: "hero-char",
          });

      const lineTargets = splitHeadline?.lines ?? [];
      const charTargets = splitHeadline?.chars ?? [];
      const heroEyebrow = root.querySelector<HTMLElement>(".hero .eyebrow");
      const heroActions = root.querySelector<HTMLElement>(".hero .actions");
      const heroActionItems = heroActions ? Array.from(heroActions.children) : [];
      let scrambleCleanup: (() => void) | undefined;

      const onScroll = () => {
        if (!nav) return;
        nav.classList.toggle("scrolled", window.scrollY > 40);
      };

      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();

      if (reduceMotion) {
        gsap.set(
          [
            nav,
            heroEyebrow,
            heroTitle,
            heroActions,
            heroVisual,
            heroPhoto,
            heroHill,
            heroMascot,
            ".storia-calm .reveal",
            ".storia-calm .reveal-image",
          ],
          {
            clearProps: "all",
            opacity: 1,
            x: 0,
            y: 0,
            scale: 1,
            rotate: 0,
            rotateX: 0,
            rotateY: 0,
            skewY: 0,
          }
        );
      } else {
        gsap.set(lineTargets, { overflow: "hidden" });
        gsap.set(charTargets, {
          yPercent: 110,
          rotate: 2,
          transformOrigin: "50% 100%",
          willChange: "transform",
        });
        gsap.set(nav, { y: -18, opacity: 0 });
        gsap.set(heroEyebrow, { opacity: 1 });
        gsap.set(heroVisual, { opacity: 1, y: 0, scale: 1, rotate: 0 });
        gsap.set(heroActionItems, { y: 18, opacity: 0 });
        gsap.set(heroPhoto, { y: 30, scale: 1.08, rotate: -8, opacity: 0 });
        gsap.set(heroHill, { y: 80, scale: 0.94, opacity: 0 });
        gsap.set(heroMascot, { x: 50, y: 24, scale: 0.96, opacity: 0 });

        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .addLabel("hero")
          .to(nav, { opacity: 1, y: 0, duration: 0.65 }, "hero")
          .call(
            () => {
              if (heroEyebrow) {
                scrambleCleanup = scrambleIn(heroEyebrow, {
                  duration: 0.3,
                  charDelay: 38,
                  stagger: 18,
                });
              }
            },
            [],
            "hero+=0.1"
          )
          .to(
            charTargets,
            {
              yPercent: 0,
              rotate: 0,
              duration: 1.05,
              ease: "power4.out",
              stagger: { each: 0.022, from: "start" },
            },
            "hero+=0.08"
          )
          .to(
            heroPhoto,
            { opacity: 1, y: 0, scale: 1, rotate: -3, duration: 0.9, ease: "power4.out" },
            "hero+=0.28"
          )
          .to(
            heroHill,
            { opacity: 1, y: 0, scale: 1, duration: 1, ease: "power4.out" },
            "hero+=0.3"
          )
          .to(
            heroMascot,
            { opacity: 1, x: 0, y: 0, scale: 1, duration: 1, ease: "power4.out" },
            "hero+=0.34"
          )
          .to(
            heroActionItems,
            { opacity: 1, y: 0, duration: 0.65, stagger: 0.08 },
            "hero+=0.5"
          );
      }

      gsap.to(".manifesto .m-word", {
        color: (_index: number, el: Element) =>
          el.classList.contains("hl") ? "var(--sl-accent)" : "var(--sl-ink)",
        stagger: 1,
        ease: "none",
        scrollTrigger: {
          trigger: ".manifesto",
          start: "top 70%",
          end: "bottom 70%",
          scrub: true,
        },
      });

      const steps = gsap.utils.toArray<HTMLElement>(".pin-step");
      const screens = gsap.utils.toArray<HTMLElement>(".phone-screen");
      const setScreen = (activeIndex: number) => {
        screens.forEach((screen, index) => {
          screen.classList.toggle("active", index === activeIndex);
        });
      };
      setScreen(0);

      steps.forEach((step, index) => {
        ScrollTrigger.create({
          trigger: step,
          start: "top 55%",
          end: "bottom 55%",
          onEnter: () => setScreen(index),
          onEnterBack: () => setScreen(index),
        });

        gsap.fromTo(
          step,
          { opacity: 0.25 },
          {
            opacity: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: step,
              start: "top 75%",
              end: "top 45%",
              scrub: true,
            },
          }
        );

        gsap.to(step, {
          opacity: 0.25,
          ease: "power2.in",
          scrollTrigger: {
            trigger: step,
            start: "bottom 45%",
            end: "bottom 15%",
            scrub: true,
          },
        });
      });

      gsap.fromTo(
        ".bleed-img .bleed-media",
        { scale: 1.1 },
        {
          scale: 1,
          scrollTrigger: {
            trigger: ".bleed",
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
        }
      );

      gsap.from(".bleed-caption p, .bleed-caption cite", {
        y: 30,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.15,
        scrollTrigger: { trigger: ".bleed-caption", start: "top 80%" },
      });

      gsap.to(".mission-intro.reveal", {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power4.out",
        scrollTrigger: { trigger: ".mission-section", start: "top 80%" },
      });

      const missionMedia = gsap.matchMedia();
      missionMedia.add(
        {
          pinned: "(min-width: 800px) and (prefers-reduced-motion: no-preference)",
          simple: "(max-width: 799px), (prefers-reduced-motion: reduce)",
        },
        (context) => {
          if (context.conditions?.pinned) {
            gsap.set(".mission-card", {
              opacity: 0,
              y: 90,
              scale: 0.92,
              borderRadius: 96,
              transformOrigin: "50% 100%",
            });
            gsap
              .timeline({
                scrollTrigger: {
                  trigger: ".mission-section",
                  start: "top 12%",
                  end: "+=560",
                  scrub: 0.6,
                  pin: true,
                  anticipatePin: 1,
                },
              })
              .to(".mission-card", {
                opacity: 1,
                y: 0,
                scale: 1,
                borderRadius: 24,
                duration: 1,
                ease: "power4.out",
                stagger: 0.22,
              });
          } else {
            gsap.to(".mission-card.reveal", {
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: "power3.out",
              stagger: 0.12,
              scrollTrigger: { trigger: ".mission-grid", start: "top 85%" },
            });
          }
        }
      );

      gsap.to(".stories-head .reveal", {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: { trigger: ".stories-head", start: "top 80%" },
      });

      gsap.from(".book-card", {
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: { trigger: ".stories-rail", start: "top 85%" },
      });

      gsap.to(".community-head .reveal", {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: { trigger: ".community-head", start: "top 80%" },
      });

      gsap.to(".c-grid .reveal", {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: { trigger: ".c-grid", start: "top 80%" },
      });

      gsap.to(".press-strip.reveal", {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: ".press-strip", start: "top 85%" },
      });

      gsap.to(".cta-section .reveal", {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: { trigger: ".cta-section", start: "top 75%" },
      });

      gsap.to(".cta-mascot", {
        y: -8,
        duration: 2.6,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        delay: 1,
      });

      const magneticCleanups: Array<() => void> = [];

      if (!reduceMotion) {
        magneticButtons.forEach((button) => {
          const xTo = gsap.quickTo(button, "x", { duration: 0.35, ease: "power3.out" });
          const yTo = gsap.quickTo(button, "y", { duration: 0.35, ease: "power3.out" });
          const rotateTo = gsap.quickTo(button, "rotate", {
            duration: 0.35,
            ease: "power3.out",
          });

          const onMove = (event: PointerEvent) => {
            const bounds = button.getBoundingClientRect();
            const offsetX = event.clientX - (bounds.left + bounds.width / 2);
            const offsetY = event.clientY - (bounds.top + bounds.height / 2);
            const magneticX = gsap.utils.clamp(-14, 14, offsetX * 0.18);
            const magneticY = gsap.utils.clamp(-10, 10, offsetY * 0.22);
            xTo(magneticX);
            yTo(magneticY);
            rotateTo(gsap.utils.clamp(-4, 4, offsetX * 0.03));
          };

          const resetMagnetic = () => {
            xTo(0);
            yTo(0);
            rotateTo(0);
          };

          button.addEventListener("pointermove", onMove);
          button.addEventListener("pointerleave", resetMagnetic);
          button.addEventListener("blur", resetMagnetic);

          magneticCleanups.push(() => {
            button.removeEventListener("pointermove", onMove);
            button.removeEventListener("pointerleave", resetMagnetic);
            button.removeEventListener("blur", resetMagnetic);
            resetMagnetic();
          });
        });
      }

      const velocityCleanups: Array<() => void> = [];

      if (!reduceMotion) {
        [heroInner, missionShell].forEach((element, index) => {
          if (!element) return;

          gsap.set(element, {
            transformPerspective: 1000,
            transformOrigin: "50% 50%",
            willChange: "transform",
          });

          const skewTo = gsap.quickTo(element, "skewY", {
            duration: 0.3,
            ease: "power3.out",
          });
          const tiltTo = gsap.quickTo(element, "rotationX", {
            duration: 0.35,
            ease: "power3.out",
          });
          const panTo = gsap.quickTo(element, "rotationY", {
            duration: 0.35,
            ease: "power3.out",
          });

          const trigger = ScrollTrigger.create({
            trigger: element,
            start: "top bottom",
            end: "bottom top",
            scrub: false,
            onUpdate: (self) => {
              const velocity = self.getVelocity();
              const skew = gsap.utils.clamp(-3.2, 3.2, velocity / 900);
              const tilt = gsap.utils.clamp(-2.4, 2.4, velocity / -1600);
              skewTo(skew);
              tiltTo(tilt);
              panTo(index === 0 ? tilt * 0.45 : tilt * -0.3);
            },
            onLeave: () => {
              skewTo(0);
              tiltTo(0);
              panTo(0);
            },
            onLeaveBack: () => {
              skewTo(0);
              tiltTo(0);
              panTo(0);
            },
          });

          velocityCleanups.push(() => {
            trigger.kill();
            skewTo(0);
            tiltTo(0);
            panTo(0);
          });
        });
      }

      const fallbackTimer = window.setTimeout(() => {
        root
          .querySelectorAll<HTMLElement>(
            ".storia-nav, .hero .reveal, .reveal-image, .hero-photo-card, .hero-mascot-hill, .hero-mascot-stage"
          )
          .forEach((element) => {
            if (parseFloat(getComputedStyle(element).opacity) < 0.1) {
              element.style.opacity = "1";
              element.style.transform = "none";
            }
          });
        root.querySelectorAll<HTMLElement>(".hero-char, .hero .eyebrow .char").forEach((element) => {
          element.style.opacity = "1";
          if (getComputedStyle(element).transform !== "none") {
            element.style.transform = "none";
          }
        });
      }, 3000);

      ScrollTrigger.refresh();

      return () => {
        window.clearTimeout(fallbackTimer);
        window.removeEventListener("scroll", onScroll);
        magneticCleanups.forEach((cleanup) => cleanup());
        velocityCleanups.forEach((cleanup) => cleanup());
        missionMedia.revert();
        scrambleCleanup?.();
        splitHeadline?.revert();
      };
    },
    { scope: rootRef }
  );

  return (
    <div ref={rootRef} className="storia-calm">
      <nav className="storia-nav">
        <Link href="#top" className="wordmark">
          <span className="dot">
            <Image src="/storia-landing/logo-headshot.png" alt="" width={32} height={32} />
          </span>
          <span>loratone</span>
        </Link>
        <div className="links">
          <a href="#mission">Why we built this</a>
          <a href="#how">How it works</a>
          <a href="#stories">Stories</a>
          <a href="#community">Our story</a>
          <Link href="/library">Library</Link>
        </div>
        <a className="cta" href="#download">Download</a>
      </nav>

      <main id="top">
        <section className="hero">
          <div className="hero-inner">
            <p className="eyebrow reveal">For ages 4–10 · Made in New Orleans</p>
            <h1 ref={heroTitleRef} className="hero-title" aria-label="Loratone brings every story to life.">
              Loratone brings <em>every story</em> to life.
            </h1>
            <div className="actions reveal">
              <a
                ref={primaryCtaRef}
                className="btn btn-primary"
                href="https://apps.apple.com/us/app/storia-kids/id6759848322"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download on iOS
              </a>
              <a ref={secondaryCtaRef} className="btn btn-ghost" href="#how">
                See how it works
              </a>
            </div>
          </div>
          <div className="hero-visual reveal-image">
            <Image
              className="hero-mascot-hill"
              src="/storia-landing/mascot-hill.svg"
              alt=""
              width={160}
              height={107}
            />
            <div className="hero-mascot-stage">
              <MascotStoryWorld reduceMotion={reduceMotion} />
            </div>
            <div className="hero-photo-card">
              <Image
                src="/storia-landing/kid-ipad.jpg"
                alt="A child reading a Loratone storybook on a tablet"
                fill
                priority
                sizes="(max-width: 900px) 116px, 13vw"
              />
            </div>
          </div>
        </section>

        <section className="manifesto">
          <p className="manifesto-text">
            {MANIFESTO_WORDS.map((word, index) => {
              if (typeof word === "string") {
                return (
                  <span key={index} className="m-word">
                    {word}
                  </span>
                );
              }
              return (
                <span key={index} className="m-word hl">
                  {word.text}
                </span>
              );
            })}
          </p>
        </section>

        <section className="mission-section" id="mission">
          <div className="mission-shell">
            <div className="mission-intro reveal">
              <p className="eyebrow">Why this matters</p>
              <h2>
                <a
                  href="https://brighterly.com/blog/literacy-statistics/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  67% of fourth-graders aren&apos;t reading at grade level.
                </a>
              </h2>
              <p className="lede">
                We&apos;re building Loratone in response to that reality—because every
                story deserves to be heard, felt, and experienced in a way that
                helps kids stay engaged with reading.
              </p>
            </div>

            <div className="mission-grid">
              <article className="mission-card reveal">
                <p className="mission-kicker">01 / Founder</p>
                <h3>Shivang Thakor</h3>
                <p>
                  For as long as Shivang can remember, he has read stories with
                  sound by his side. In middle school, he would not read Romeo
                  and Juliet unless he was listening to Pachelbel&apos;s Canon in D
                  with birds chirping in the background. Now, as the first in
                  his family to graduate from college as a Posse Foundation
                  Scholar, he wants to serve readers like him who may have just
                  needed a little sound to go with their stories.
                </p>
              </article>

              <article className="mission-card reveal">
                <p className="mission-kicker">02 / Founder + Software Architect</p>
                <h3>Akintunde Pounds</h3>
                <p>
                  As a parent to a daughter with autism, Akintunde is on a
                  mission to bridge literacy gaps for all kids—especially
                  children with disabilities. He and his brother come from a
                  third-generation family of educators, and with 5+ years
                  teaching computer science, he brings both lived empathy and
                  classroom experience to how Loratone is built.
                </p>
              </article>

              <article className="mission-card reveal mission-card-wide">
                <p className="mission-kicker">03 / Motivation</p>
                <h3>Why We Built Loratone</h3>
                <p>
                  We built Loratone to redefine what a book can be. Our immersive
                  sensory audiobooks are designed to strengthen foundational
                  reading skills in children by supporting orthographic
                  representation, phonological representation, and semantic
                  representation in every story.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="pin-section" id="how">
          <div className="pin-stage">
            <div className="pin-left">
              <div className="phone">
                <Image
                  className="phone-screen pscreen-0 active"
                  src="/storia-landing/app-library.png"
                  alt="Story library screen"
                  fill
                  sizes="340px"
                />
                <Image
                  className="phone-screen pscreen-1"
                  src="/storia-landing/app-reading.png"
                  alt="Reading screen with narration"
                  fill
                  sizes="340px"
                />
                <Image
                  className="phone-screen pscreen-2"
                  src="/storia-landing/app-reading.png"
                  alt="Reading screen with immersive soundscape"
                  fill
                  sizes="340px"
                />
              </div>
            </div>
            <div className="pin-right">
              <div className="pin-steps">
                <div className="pin-step">
                  <p className="eyebrow">01 · Choose</p>
                  <h2>A library laid out like a map.</h2>
                  <p>
                    Kids wander a hand-drawn story world and pick tales by mood,
                    length, or hero. A growing library of stories is live now, with
                    more coming soon.
                  </p>
                </div>
                <div className="pin-step">
                  <p className="eyebrow">02 · Listen</p>
                  <h2>Warm narration. Page by page.</h2>
                  <p>
                    Every story includes warm, expressive narration, with pauses,
                    rhythm, and care. Kids can read along or simply listen.
                  </p>
                </div>
                <div className="pin-step">
                  <p className="eyebrow">03 · Feel</p>
                  <h2>Soundscapes that bring it close.</h2>
                  <p>
                    A custom audio bed under each page — rain, footsteps, wind in
                    the trees — composed to match the moment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bleed">
          <div className="bleed-overline">
            Loratone at NMI Microschool in Uptown New Orleans reading our curated
            stories to K–2nd graders
          </div>
          <div className="bleed-img">
            <div className="bleed-media">
              <Image
                src="/storia-landing/team-reading.jpg"
                alt="Reading to children at a community event"
                fill
                sizes="100vw"
              />
            </div>
          </div>
          <div className="bleed-caption">
            <p>“My kid loves Loratone. Her fav story so far is Danny&apos;s Cat.”</p>
            <cite>— Shay Claiborne, parent and founder &amp; CEO of MilestoneMate</cite>
          </div>
        </section>

        <section className="stories" id="stories">
          <div className="stories-head">
            <p className="eyebrow reveal">The library</p>
            <h2 className="reveal">A shelf that grows with them.</h2>
            <p className="lede reveal">
              Classics, folk tales, and originals — narrated with care. New
              titles added each month.
            </p>
            <p className="stories-note reveal">
              Preview of the current shelf — 8 titles now, with more on the way.
            </p>
          </div>
          <div className="stories-rail">
            {BOOKS.map((book) => (
              <div className="book-card" key={book.title}>
                <div className={`bc-cover ${book.cover}`}>
                  <span>{book.title}</span>
                </div>
                <p className="bc-meta">{book.meta}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="community" id="community">
          <div className="community-head">
            <p className="eyebrow reveal">Our story</p>
            <h2 className="reveal">Built by readers, for readers.</h2>
            <p className="lede reveal">
              Loratone is a small team in New Orleans, making a slow, careful app
              with authors, librarians, and the kids who test every page.
            </p>
          </div>

          <div className="c-grid">
            <figure className="c-tile c-a reveal">
              <Image src="/storia-landing/team-author.jpg" alt="With author Cherelyn Poe" fill sizes="(max-width: 900px) 100vw, 50vw" />
              <figcaption>With author Cherelyn Poe</figcaption>
            </figure>
            <figure className="c-tile c-b reveal">
              <Image src="/storia-landing/team-festival.png" alt="Loratone team at festival" fill sizes="(max-width: 900px) 100vw, 50vw" />
              <figcaption>Tulane Book Festival with Former Mayor Mitch Landrieu</figcaption>
            </figure>
          </div>

          <div className="press-strip reveal" aria-label="Loratone press features">
            <p className="press-eyebrow">Featured in</p>
            <div className="press-cards">
              {PRESS_LINKS.map((item) => (
                <a
                  className="press-card"
                  href={item.href}
                  key={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{item.label}</span>
                  <strong>{item.title}</strong>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="cta-section" id="download">
          <div className="cta-inner">
            <Image className="cta-mascot reveal" src="/storia-landing/mascot-full.png" alt="Loratone mascot" width={120} height={120} />
            <h2 className="reveal">Start tonight’s story.</h2>
            <p className="lede reveal">
              Free to try with a handful of tales. A family subscription unlocks
              the full library.
            </p>
            <a
              className="btn btn-primary reveal"
              href="https://apps.apple.com/us/app/storia-kids/id6759848322"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download on the App Store
            </a>
            <p className="fine-print reveal">Android coming soon.</p>
          </div>
        </section>
      </main>

      <footer className="storia-footer">
        <div className="footer-inner">
          <span>© 2026 Loratone, Inc. · Made in New Orleans</span>
          <div className="footer-links">
            <Link href="/privacy-policy">Privacy</Link>
            <a href="mailto:hello@loratone.kids">Contact</a>
            <Link href="/library">Library</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
