"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SplitType from "split-type";

gsap.registerPlugin(ScrollTrigger);

export function useLandingAnimations() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Custom Cursor
    const cursor = document.querySelector("#custom-cursor") as HTMLElement;
    const cursorLines = document.querySelectorAll(".cursor-line");

    if (cursor) {
      window.addEventListener("mousemove", (e) => {
        gsap.to(cursor, {
          x: e.clientX,
          y: e.clientY,
          duration: 0.1,
          ease: "power2.out",
        });
      });

      // Hover effect on lines
      const lineAnim = gsap.to(cursorLines, {
        scaleY: 1.5,
        duration: 0.2,
        stagger: {
          each: 0.05,
          repeat: -1,
          yoyo: true,
        },
        paused: true,
      });

      document.querySelectorAll(".cursor-hover").forEach((el) => {
        el.addEventListener("mouseenter", () => {
          gsap.to(cursor, { scale: 1.5, duration: 0.3 });
          lineAnim.play();
        });
        el.addEventListener("mouseleave", () => {
          gsap.to(cursor, { scale: 1, duration: 0.3 });
          lineAnim.pause();
          gsap.to(cursorLines, { scaleY: 1, duration: 0.3 });
        });
      });
    }

    // Phase A: Entrance
    const entranceTl = gsap.timeline();
    entranceTl
      .to(".entrance-logo", {
        opacity: 1,
        scale: 1,
        duration: 1.5,
        ease: "power4.out",
      })
      .to(".entrance-logo", {
        scale: 100,
        opacity: 0,
        duration: 1.5,
        ease: "power4.inOut",
      })
      .to(
        "#hero-entrance",
        {
          autoAlpha: 0,
          duration: 1,
        },
        "-=0.5"
      )
      .from(
        ".reveal-item",
        {
          y: 40,
          opacity: 0,
          stagger: 0.2,
          duration: 1,
          ease: "power3.out",
        },
        "-=0.5"
      );

    // Phase B: The Soundwave Scrub
    const heroTextEl = document.querySelector("#hero-text");
    if (heroTextEl) {
      const heroText = new SplitType("#hero-text", { types: "words,chars" });

      const scrubTl = gsap.timeline({
        scrollTrigger: {
          trigger: ".storia-container",
          start: "top top",
          end: "+=300%",
          pin: true,
          scrub: 1.5,
        },
      });

      // Soundwave Ripple effect
      scrubTl.to(
        heroText.chars,
        {
          y: (i) => Math.sin(i * 0.8) * 60,
          scaleY: 2.5,
          skewX: 10,
          stagger: {
            each: 0.1,
            from: "center",
          },
          ease: "sine.inOut",
        },
        0
      );

      // Blur based on scroll progress (depth of field)
      scrubTl.fromTo(
        heroText.chars,
        {
          filter: "blur(0px)",
          opacity: 1,
        },
        {
          filter: "blur(10px)",
          opacity: 0.2,
          stagger: {
            each: 0.02,
            from: "edges",
          },
        },
        0.5
      );

      // Phase C: Scene Morph
      scrubTl
        .to(
          ".bg-blob-1",
          {
            x: "100vw",
            y: "100vh",
            backgroundColor: "#1e3a8a", // Midnight Blue
            duration: 2,
          },
          0
        )
        .to(
          ".bg-blob-2",
          {
            x: "-100vw",
            y: "-100vh",
            backgroundColor: "#064e3b", // Forest Green
            duration: 2,
          },
          0
        )
        .to(
          ".bg-blob-3",
          {
            opacity: 0.4,
            scale: 1.5,
            backgroundColor: "#78350f", // Amber
            duration: 2,
          },
          1
        );
    }

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);
}

export default function LandingAnimations() {
  useLandingAnimations();
  return null;
}
