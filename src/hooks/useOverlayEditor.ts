"use client";

import { useStore } from "zustand";
import { getOverlayEditorStore } from "@/stores/overlayEditorRegistry";
import type { OverlayEditorState, OverlayEditorStore } from "@/stores/overlayEditorStore";

/**
 * Subscribe to a slice of the overlay editor store for the given page.
 * Only re-renders when the selected slice changes.
 */
export function useOverlayEditor<T>(
  pageId: string,
  selector: (state: OverlayEditorState) => T
): T {
  const store = getOverlayEditorStore(pageId) as OverlayEditorStore;
  return useStore(store, selector as (state: OverlayEditorState) => T);
}

/**
 * Access store actions without subscribing to state.
 * Components that only call actions use this to avoid unnecessary re-renders.
 * Safe to call outside React (e.g. keyboard handlers).
 */
export function useOverlayEditorActions(pageId: string): OverlayEditorState {
  return getOverlayEditorStore(pageId).getState();
}
