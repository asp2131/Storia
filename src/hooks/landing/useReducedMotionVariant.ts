import { useEffect, useState } from "react";

interface ReducedMotionVariant {
  reduceMotion: boolean;
  isTouch: boolean;
  isMobile: boolean;
}

export function useReducedMotionVariant(): ReducedMotionVariant {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", handler);

    const touchMq = window.matchMedia("(pointer: coarse)");
    setIsTouch(touchMq.matches);

    const mobileMq = window.matchMedia("(max-width: 900px)");
    setIsMobile(mobileMq.matches);

    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener("resize", onResize);

    return () => {
      mq.removeEventListener("change", handler);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return { reduceMotion, isTouch, isMobile };
}
