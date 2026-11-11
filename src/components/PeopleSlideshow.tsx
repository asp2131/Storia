"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useReducedMotionVariant } from "@/hooks/landing/useReducedMotionVariant";

export type PeopleSlide = { src: string; alt: string; title: string; detail: string };

/**
 * Arch-print carousel from the landing handoff (p.6). The active progress segment's CSS
 * animation IS the 6 s timer: pausing it pauses autoplay, and `animationend` advances.
 */
export default function PeopleSlideshow({ slides }: { slides: PeopleSlide[] }) {
  const [index, setIndex] = useState(0);
  const { reduceMotion } = useReducedMotionVariant();
  // null = user hasn't chosen; default to no autoplay under prefers-reduced-motion
  const [userPlaying, setPlaying] = useState<boolean | null>(null);
  const playing = userPlaying ?? !reduceMotion;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const swipeX = useRef<number | null>(null);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const count = slides.length;
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);
  const running = playing && !hovered && !focused && !hidden;
  const slide = slides[index];
  const next = slides[(index + 1) % count];

  return (
    <div
      className="people-show"
      role="region"
      aria-roledescription="carousel"
      aria-label="Photos of the Loratone team and readers"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // keyboard focus only: a mouse click on a control shouldn't freeze autoplay
      onFocus={(e) => setFocused(e.target.matches(":focus-visible"))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      }}
      onPointerDown={(e) => {
        swipeX.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (swipeX.current === null) return;
        const dx = e.clientX - swipeX.current;
        swipeX.current = null;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="people-stack">
        <div className="people-print people-print-back" aria-hidden="true">
          <Image src={next.src} alt="" fill sizes="(max-width: 900px) 90vw, 420px" />
        </div>
        <div className="people-print" aria-live={running ? "off" : "polite"}>
          {slides.map((s, i) => (
            <div
              key={s.src}
              className={i === index ? "people-slide active" : "people-slide"}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={i !== index}
            >
              <Image src={s.src} alt={s.alt} fill priority={i === 0} sizes="(max-width: 900px) 90vw, 420px" />
            </div>
          ))}
        </div>
      </div>

      <div className="people-bar">
        <div className="people-caption">
          <strong>{slide.title}</strong>
          <span>{slide.detail}</span>
        </div>
        <div className="people-controls">
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            aria-label={playing ? "Pause slideshow" : "Play slideshow"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button type="button" onClick={() => go(-1)} aria-label="Previous photo">
            ‹
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Next photo">
            ›
          </button>
        </div>
      </div>

      <div className="people-progress" aria-hidden="true">
        {slides.map((s, i) => (
          <span key={s.src} className={i < index ? "done" : undefined}>
            {i === index && (
              <i
                key={index}
                style={{ animationPlayState: running ? "running" : "paused" }}
                onAnimationEnd={() => go(1)}
              />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
