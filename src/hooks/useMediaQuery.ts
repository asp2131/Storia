"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Observe a CSS media query from React without breaking SSR.
 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return () => {};
    }

    const mediaQueryList = window.matchMedia(query);
    mediaQueryList.addEventListener("change", onStoreChange);

    return () => {
      mediaQueryList.removeEventListener("change", onStoreChange);
    };
  }, [query]);

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
