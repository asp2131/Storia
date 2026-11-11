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
import { ARTICLES, formatArticleDate } from "@/content/whats-new";
import MascotStoryWorld from "./MascotStoryWorld";
import PeopleSlideshow, { type PeopleSlide } from "./PeopleSlideshow";
import { SiteFooter, SiteNav } from "./SiteChrome";
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

// ponytail: cover URLs copied from books.cover_url; fetch from DB if the shelf changes often
const COVER_BASE = "https://gbtohjbmchjgdfwwlhyy.supabase.co/storage/v1/object/public/storia-storage/";

const BOOKS = [
  { title: "The Wizard of Oz", meta: "Classic tale", cover: `${COVER_BASE}books/51/pages/3_1768876915857_tl0kw3.png` },
  { title: "Danny's Cat", meta: "Family favorite", cover: `${COVER_BASE}books/52/pages/4_1770427321560_4lk3az.png` },
  { title: "My Day at Granny's", meta: "Quick read", cover: `${COVER_BASE}books/54/pages/7_1770948115129_i16109.png` },
  { title: "The Tortoise and the Hare", meta: "Classic fable", cover: `${COVER_BASE}books/temp/1771377409285_lwg1au.png` },
  { title: "Bunny Brother", meta: "Playful story", cover: `${COVER_BASE}books/62/pages/1_1774402726595_w00ewy.webp` },
  { title: "Kumu's Sky", meta: "Adventure", cover: `${COVER_BASE}books/63/kumu-cover.png` },
  { title: "Sweet Potato Sweet Potato", meta: "By Cherelyn Poe", cover: `${COVER_BASE}books/64/pages/1_1773791841691_dnxfay.webp` },
];

const VALUES = [
  {
    word: "Resourceful",
    tone: "v-blue",
    body: "Built lean in New Orleans with educators, SLPs, and authors, so every feature earns its place on the page.",
  },
  {
    word: "Fun",
    tone: "v-sun",
    body: "Soundscapes, a mascot who waves back, and words that light up as they're read. Reading should feel like play.",
  },
  {
    word: "Equitable",
    tone: "v-mint",
    body: "Designed for every kind of reader, including neurodivergent kids and kids still finding their footing.",
  },
];

// Handoff p.7: coverage only, newest first, up to four. Headlines taken from article URLs; verify wording before launch.
const PRESS_LINKS = [
  {
    outlet: "Posse Foundation",
    title: "Notre Dame alum advances entrepreneurship, early literacy",
    href: "https://www.possefoundation.org/news-and-events/notre-dame-alum-advances-entrepreneurship-early-literacy",
    domain: "possefoundation.org",
  },
  {
    outlet: "Equitech Futures",
    title: "Shivang Thakor is building the conditions for children to love reading",
    href: "https://www.equitechfutures.com/articles/shivang-thakor-is-building-the-conditions-for-children-to-love-reading",
    domain: "equitechfutures.com",
  },
  {
    outlet: "ALTA 2026 Podcast",
    title: "Shivang Thakor of the Loratone Kids App",
    href: "https://www.youtube.com/watch?v=wmx2MVKhntw&t=2s",
    domain: "youtube.com",
  },
];

// ponytail: founders photo pending from Shiv; add it as slide 1 when it lands
const PEOPLE_SLIDES: PeopleSlide[] = [
  {
    src: "/storia-landing/team-reading.jpg",
    alt: "Reading a Loratone story to a group of young children seated on the floor",
    title: "NMI Microschool",
    detail: "Uptown New Orleans · reading with K–2nd graders",
  },
  {
    src: "/storia-landing/team-festival.png",
    alt: "The Loratone team with former Mayor Mitch Landrieu at their festival table",
    title: "New Orleans Book Festival",
    detail: "Tulane University · Family Day",
  },
  {
    src: "/storia-landing/team-author.jpg",
    alt: "The Loratone team with author Cherelyn Poe at their festival booth",
    title: "Autism Society of Greater New Orleans Festival",
    detail: "With author Cherelyn Poe",
  },
  {
    src: "/storia-landing/team-mayor.png",
    alt: "Showing Loratone on a laptop to visitors at an outdoor event",
    title: "Meeting readers",
    detail: "Lafayette Square, New Orleans",
  },
];

const WEB_APP_URL = "https://app.loratone.com/#/intro";
const IOS_URL = "https://apps.apple.com/us/app/storia-kids/id6759848322";
const CONTACT_EMAIL = "hello@loratone.kids";

type SpotlightStatus = "in-development" | "coming-soon" | "available";

// Handoff p.8: one record per title; status decides the buttons. Never show "Read" before release.
const SPOTLIGHT: {
  title: string;
  status: SpotlightStatus;
  releaseMonth?: string;
  intro: string;
  art: { src: string; alt: string };
  readHref?: string;
  band: "sun" | "mint" | "blue";
} = {
  title: "Hat Trickster",
  status: "in-development",
  // draft intro written from the rough pages; Shiv to approve
  intro:
    "Her new bunny hat has eyes, ears that stretch for blocks, and a mind of its own. On her first day at a new school, it starts playing tricks, and she's the one who has to catch up.",
  art: {
    src: "/storia-landing/hat-trickster-spread.webp",
    alt: "Hat Trickster cover and an inside page: a girl in a white bunny-eared hat leaps across a blue sky with the hat's long ears streaming behind her; inside, she dashes past a desk, a classmate stares in surprise, and the stretchy ears snatch a skateboard as she tumbles.",
  },
  band: "sun",
};

const SPOTLIGHT_STATUS_COPY: Record<SpotlightStatus, { label: string; kicker: string }> = {
  "in-development": { label: "In development", kicker: "A new story coming to Loratone" },
  "coming-soon": { label: "Coming soon", kicker: "Coming soon to Loratone" },
  available: { label: "New in Loratone", kicker: "Now in the Loratone library" },
};

const START_PATHS = [
  {
    heading: "Parents and caregivers",
    body: "Get Loratone on iPad, or start reading in your browser. Free to try with a handful of tales; a family subscription unlocks the full library.",
    link: { label: "Download on iOS", href: IOS_URL, external: true },
  },
  {
    heading: "Schools and SLPs",
    body: "Tell us about your readers and how you'd like to use Loratone with them.",
    link: {
      label: "Contact us about schools",
      href: `mailto:${CONTACT_EMAIL}?subject=Loratone%20for%20schools%20and%20SLPs`,
      external: false,
    },
  },
  {
    heading: "Authors and partners",
    body: "Have a story, an event, or a program that fits? We'd like to hear about it.",
    link: {
      label: "Contact us about partnering",
      href: `mailto:${CONTACT_EMAIL}?subject=Partnering%20with%20Loratone`,
      external: false,
    },
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

      // Resting colour is full-contrast ink (CSS); only dim-then-reveal when motion is allowed.
      if (!reduceMotion) {
        gsap.fromTo(
          ".manifesto .m-word",
          { color: "var(--sl-ink-30)" },
          {
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
          }
        );
      }

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
          // ponytail: step 03 (soundscapes) has no screenshot yet, stays on the reading screen
          onEnter: () => setScreen(Math.min(index, screens.length - 1)),
          onEnterBack: () => setScreen(Math.min(index, screens.length - 1)),
        });

        if (reduceMotion) return;

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

      gsap.to(".values .reveal", {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: { trigger: ".values", start: "top 80%" },
      });

      gsap.to(".news .reveal", {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: { trigger: ".news", start: "top 80%" },
      });

      gsap.utils.toArray<HTMLElement>(".reveal-group").forEach((group) => {
        gsap.to(group.querySelectorAll(".reveal"), {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.1,
          scrollTrigger: { trigger: group, start: "top 80%" },
        });
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
              const skew = gsap.utils.clamp(-1.6, 1.6, velocity / 900);
              const tilt = gsap.utils.clamp(-1.2, 1.2, velocity / -1600);
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
      <SiteNav />

      <main id="top">
        <section className="hero">
          <div className="hero-inner">
            <p className="eyebrow reveal">For all kids and reluctant readers · Made in New Orleans</p>
            <h1 ref={heroTitleRef} className="hero-title" aria-label="Loratone brings every story to life.">
              Loratone brings <em>every story</em> to life.
            </h1>
            <p className="hero-sub">
              Illustrated storybooks with warm narration and soundscapes. On iPad and the web.
            </p>
            <div className="actions reveal">
              <a
                ref={primaryCtaRef}
                className="btn btn-primary"
                href={IOS_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download on iOS
              </a>
              <a
                ref={secondaryCtaRef}
                className="btn btn-ghost"
                href={WEB_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Web version
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
              </div>
            </div>
            <div className="pin-right">
              <div className="pin-steps">
                <div className="pin-step">
                  <div className="phone pin-shot">
                    <Image src="/storia-landing/app-library.png" alt="Story library screen" fill sizes="240px" />
                  </div>
                  <p className="eyebrow">01 · Choose</p>
                  <h2>A library laid out like a map.</h2>
                  <p>
                    Kids wander a hand-drawn story world and pick tales by mood,
                    length, or hero. A growing library of stories is live now, with
                    more coming soon.
                  </p>
                </div>
                <div className="pin-step">
                  <div className="phone pin-shot">
                    <Image src="/storia-landing/app-reading.png" alt="Reading screen with narration" fill sizes="240px" />
                  </div>
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

        <section className="people reveal-group" id="about" aria-labelledby="people-title">
          <div className="people-grid">
            <div className="people-intro">
              <h2 id="people-title" className="reveal">The people behind the stories.</h2>
              <p className="lede reveal">
                Loratone is built in New Orleans by cofounders Shivang Thakor and Akin Pounds,
                with educators, SLPs, and authors at the table. Here&apos;s where we&apos;ve been
                reading lately.
              </p>
              <blockquote className="people-quote reveal">
                <p>“My kid loves Loratone. Her fav story so far is Danny&apos;s Cat.”</p>
                <cite>Shay Claiborne, parent and founder &amp; CEO of MilestoneMate</cite>
              </blockquote>
            </div>
            <PeopleSlideshow slides={PEOPLE_SLIDES} />
          </div>
          <div className="values" role="list" aria-label="What Loratone stands for">
            {VALUES.map((value) => (
              <article className={`value-card ${value.tone} reveal`} key={value.word} role="listitem">
                <h3>{value.word}.</h3>
                <p>{value.body}</p>
              </article>
            ))}
          </div>
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
                <p className="mission-kicker">01 / Co-founder + CEO</p>
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
                <p className="mission-kicker">02 / Co-founder + CTO</p>
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

        <section
          className={`spotlight spotlight-${SPOTLIGHT.band} reveal-group`}
          id="spotlight"
          aria-labelledby="spotlight-title"
        >
          <div className="spotlight-inner">
            <div className="spotlight-copy">
              <p className="spotlight-status reveal">
                <span aria-hidden="true" />
                {SPOTLIGHT.status === "coming-soon" && SPOTLIGHT.releaseMonth
                  ? `Coming in ${SPOTLIGHT.releaseMonth}`
                  : SPOTLIGHT_STATUS_COPY[SPOTLIGHT.status].label}
              </p>
              <p className="spotlight-kicker reveal">{SPOTLIGHT_STATUS_COPY[SPOTLIGHT.status].kicker}</p>
              <h2 id="spotlight-title" className="reveal">{SPOTLIGHT.title}</h2>
              <p className="spotlight-intro reveal">{SPOTLIGHT.intro}</p>
              <div className="spotlight-actions reveal">
                {SPOTLIGHT.status === "available" && SPOTLIGHT.readHref ? (
                  <a className="btn btn-dark" href={SPOTLIGHT.readHref}>
                    Read it now
                  </a>
                ) : (
                  // ponytail: "Follow along" / "Get notified" go to What's new until an email signup exists
                  <Link className="btn btn-dark" href="/whats-new">
                    {SPOTLIGHT.status === "coming-soon" ? "Get notified" : "Follow along"}
                  </Link>
                )}
                <a className="btn btn-outline" href={WEB_APP_URL} target="_blank" rel="noopener noreferrer">
                  Read stories now
                </a>
              </div>
            </div>
            <div className="spotlight-art reveal">
              <Image
                src={SPOTLIGHT.art.src}
                alt={SPOTLIGHT.art.alt}
                width={1800}
                height={1200}
                sizes="(max-width: 900px) 92vw, 560px"
              />
            </div>
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
              Preview of the current shelf — 7 titles now, with more on the way.
            </p>
          </div>
          <div className="stories-rail">
            {BOOKS.map((book) => (
              <div className="book-card" key={book.title}>
                <div className="bc-cover">
                  <Image src={book.cover} alt={`${book.title} cover`} fill sizes="240px" />
                </div>
                <p className="bc-title">{book.title}</p>
                <p className="bc-meta">{book.meta}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="press reveal-group" id="press" aria-labelledby="press-title">
          <h2 id="press-title" className="reveal">In the news.</h2>
          <ul className="press-list">
            {PRESS_LINKS.slice(0, 4).map((item) => (
              <li key={item.href} className="reveal">
                <a className="press-row" href={item.href}>
                  <span className="press-outlet">{item.outlet}</span>
                  <span className="press-title">{item.title}</span>
                  <span className="press-link">Read on {item.domain}</span>
                </a>
              </li>
            ))}
          </ul>
          <Link className="press-award reveal" href="/whats-new/tulane-open-season-fall-2026">
            <span className="press-award-badge">3rd place</span>
            Tulane Open Season Pitch Competition, Fall 2026
          </Link>
        </section>

        <section className="news" id="whats-new">
          <div className="news-head">
            <div>
              <p className="eyebrow reveal">What&apos;s new</p>
              <h2 className="reveal">Fresh from the Loratone desk.</h2>
            </div>
            <Link className="btn btn-ghost reveal" href="/whats-new">
              All updates →
            </Link>
          </div>
          <div className="news-grid">
            {ARTICLES.slice(0, 3).map((article) => (
              <Link className="news-card reveal" href={`/whats-new/${article.slug}`} key={article.slug}>
                <div className={`news-cover news-${article.category.toLowerCase()}`}>
                  {article.cover ? (
                    <Image src={article.cover.src} alt={article.cover.alt} fill sizes="(max-width: 900px) 100vw, 560px" />
                  ) : (
                    <span className="news-cover-mark" aria-hidden="true">{article.category}</span>
                  )}
                </div>
                <p className="news-meta">
                  {article.category} · {formatArticleDate(article.date)}
                </p>
                <h3>{article.title}</h3>
                <p className="news-summary">{article.summary}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="start reveal-group" id="start" aria-labelledby="start-title">
          <Image
            className="cta-girl"
            src="/landing/girl-on-cloud.png"
            alt=""
            width={800}
            height={713}
            sizes="(max-width: 1100px) 240px, 22vw"
          />
          <div className="start-inner">
            <Image className="cta-mascot reveal" src="/storia-landing/mascot-full.png" alt="" width={120} height={120} />
            <h2 id="start-title" className="reveal">Where to start.</h2>
            <div className="start-grid">
              {START_PATHS.map((path) => (
                <div className="start-path reveal" key={path.heading}>
                  <h3>{path.heading}</h3>
                  <p>{path.body}</p>
                  <a
                    href={path.link.href}
                    {...(path.link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {path.link.label}
                  </a>
                </div>
              ))}
            </div>
            <p className="fine-print reveal">Android coming soon.</p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
