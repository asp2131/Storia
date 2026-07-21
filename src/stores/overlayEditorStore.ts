"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { TextElement, TextOverlayConfig } from "@/types/text-overlay";
import { TEXT_OVERLAY_VERSION } from "@/types/text-overlay";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutoSaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface OverlayEditorState {
  // Data
  elements: TextElement[];
  selectedElementId: string | null;

  // Canvas dimensions — owned here so DraggableTextElement can read without prop-drilling
  containerWidth: number;
  containerHeight: number;

  // Save state machine
  hasChanges: boolean;
  autoSaveStatus: AutoSaveStatus;

  // ─── Actions ──────────────────────────────────────────────────────────────

  /** Seed initial elements and reset all transient state. Call on mount or page switch. */
  init: (elements: TextElement[]) => void;

  // Element mutations — each transitions autoSaveStatus to "pending"
  addElement: (element: TextElement) => void;
  updateElement: (id: string, updates: Partial<TextElement>) => void;
  deleteElement: (id: string) => void;
  /** Move an element one slot earlier/later in reading order. */
  moveElement: (id: string, dir: "up" | "down") => void;

  // Selection
  selectElement: (id: string | null) => void;

  // Container size (fed by ResizeObserver)
  setContainerDimensions: (width: number, height: number) => void;

  // Save lifecycle — driven by the autosave useEffect in the component
  markSaving: () => void;
  markSaved: () => void;
  markSaveError: () => void;

  // ─── Derived helpers ──────────────────────────────────────────────────────

  getSelectedElement: () => TextElement | null;
  buildConfig: () => TextOverlayConfig;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createOverlayEditorStore() {
  return create<OverlayEditorState>()(
    subscribeWithSelector((set, get) => ({
      elements: [],
      selectedElementId: null,
      containerWidth: 0,
      containerHeight: 0,
      hasChanges: false,
      autoSaveStatus: "idle",

      init(elements) {
        set((state) => {
          if (
            state.elements === elements ||
            JSON.stringify(state.elements) === JSON.stringify(elements)
          ) {
            return state;
          }
          return {
            elements,
            selectedElementId: null,
            hasChanges: false,
            autoSaveStatus: "idle",
          };
        });
      },

      addElement(element) {
        set((s) => ({
          elements: [...s.elements, element],
          selectedElementId: element.id,
          hasChanges: true,
          autoSaveStatus: "pending",
        }));
      },

      updateElement(id, updates) {
        set((s) => ({
          elements: s.elements.map((el) =>
            el.id === id ? { ...el, ...updates } : el
          ),
          hasChanges: true,
          autoSaveStatus: "pending",
        }));
      },

      moveElement(id, dir) {
        set((s) => {
          const i = s.elements.findIndex((el) => el.id === id);
          const j = dir === "up" ? i - 1 : i + 1;
          if (i < 0 || j < 0 || j >= s.elements.length) return s; // no-op at ends
          const next = s.elements.slice();
          [next[i], next[j]] = [next[j], next[i]];
          return { elements: next, hasChanges: true, autoSaveStatus: "pending" };
        });
      },

      deleteElement(id) {
        set((s) => ({
          elements: s.elements.filter((el) => el.id !== id),
          selectedElementId: s.selectedElementId === id ? null : s.selectedElementId,
          hasChanges: true,
          autoSaveStatus: "pending",
        }));
      },

      selectElement(id) {
        set({ selectedElementId: id });
      },

      setContainerDimensions(width, height) {
        set({ containerWidth: width, containerHeight: height });
      },

      markSaving() {
        set({ autoSaveStatus: "saving" });
      },

      markSaved() {
        set({ hasChanges: false, autoSaveStatus: "saved" });
      },

      markSaveError() {
        set({ autoSaveStatus: "error" });
      },

      getSelectedElement() {
        const { elements, selectedElementId } = get();
        return elements.find((el) => el.id === selectedElementId) ?? null;
      },

      buildConfig(): TextOverlayConfig {
        return { version: TEXT_OVERLAY_VERSION, elements: get().elements };
      },
    }))
  );
}

export type OverlayEditorStore = ReturnType<typeof createOverlayEditorStore>;
