"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { TextElement, TextOverlayConfig } from "@/types/text-overlay";
import { TEXT_OVERLAY_VERSION } from "@/types/text-overlay";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutoSaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

const HISTORY_LIMIT = 50;

/**
 * Consecutive edits to the same field of the same element inside this window
 * collapse into one undo step, so typing a sentence is one Cmd+Z rather than
 * one per keystroke (which would also evict every structural step from a
 * HISTORY_LIMIT-sized stack).
 */
const HISTORY_COALESCE_MS = 600;

export interface OverlayEditorState {
  // Data
  elements: TextElement[];
  selectedElementId: string | null;
  past: TextElement[][];
  future: TextElement[][];
  historyGroupStart: TextElement[] | null;
  /** `elements` as of the last save, compared by reference to detect a clean undo. */
  savedElements: TextElement[] | null;
  /** Identifies the edit that produced the newest `past` entry, for coalescing. */
  lastEditSignature: string | null;
  lastEditAt: number;
  /** Bumped when the user asks to edit text (add / double-click), to move focus. */
  textEditRequestId: number;

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

  // History
  undo: () => void;
  redo: () => void;
  beginHistoryGroup: () => void;
  endHistoryGroup: () => void;

  // Selection
  selectElement: (id: string | null) => void;
  /** Signal intent to type: focuses the text field in the property panel. */
  requestTextEdit: () => void;

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

// ─── History helpers ──────────────────────────────────────────────────────────

type HistoryPatch = Pick<
  OverlayEditorState,
  "past" | "future" | "lastEditSignature" | "lastEditAt"
>;

/**
 * Snapshot the pre-edit `elements` onto the undo stack.
 *
 * Skipped while a drag/resize group is open, and while `signature` repeats the
 * previous edit inside HISTORY_COALESCE_MS (a typing burst). A null signature
 * never coalesces and resets the burst, so structural edits always get their
 * own step.
 */
function pushHistory(
  s: OverlayEditorState,
  signature: string | null,
  now = Date.now()
): HistoryPatch {
  const coalesce =
    s.historyGroupStart !== null ||
    (signature !== null &&
      signature === s.lastEditSignature &&
      now - s.lastEditAt < HISTORY_COALESCE_MS);

  return {
    past: coalesce ? s.past : [...s.past, s.elements].slice(-HISTORY_LIMIT),
    future: [],
    lastEditSignature: signature,
    lastEditAt: now,
  };
}

/** Restoring to the exact array the last save wrote means there is nothing to save. */
function savedStatePatch(
  s: OverlayEditorState,
  elements: TextElement[]
): Pick<OverlayEditorState, "hasChanges" | "autoSaveStatus"> {
  const isSaved = elements === s.savedElements;
  return {
    hasChanges: !isSaved,
    autoSaveStatus: isSaved ? "idle" : "pending",
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createOverlayEditorStore() {
  return create<OverlayEditorState>()(
    subscribeWithSelector((set, get) => ({
      elements: [],
      selectedElementId: null,
      past: [],
      future: [],
      historyGroupStart: null,
      savedElements: null,
      lastEditSignature: null,
      lastEditAt: 0,
      textEditRequestId: 0,
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
            past: [],
            future: [],
            historyGroupStart: null,
            savedElements: elements,
            lastEditSignature: null,
            lastEditAt: 0,
            hasChanges: false,
            autoSaveStatus: "idle",
          };
        });
      },

      addElement(element) {
        set((s) => ({
          elements: [...s.elements, element],
          selectedElementId: element.id,
          ...pushHistory(s, null),
          hasChanges: true,
          autoSaveStatus: "pending",
        }));
      },

      updateElement(id, updates) {
        set((s) => {
          const target = s.elements.find((el) => el.id === id);
          if (!target) return s;

          // The property panel re-emits the whole element on every change, so
          // diff first: it keeps no-op updates out of the undo stack and off
          // the dirty flag, and narrows the coalescing signature to the field
          // actually being edited.
          const changedKeys = (Object.keys(updates) as (keyof TextElement)[])
            .filter((key) => target[key] !== updates[key])
            .sort();
          if (changedKeys.length === 0) return s;

          const next = s.elements.map((el) =>
            el.id === id ? { ...el, ...updates } : el
          );
          return {
            elements: next,
            ...pushHistory(s, `${id}:${changedKeys.join(",")}`),
            ...savedStatePatch(s, next),
          };
        });
      },

      moveElement(id, dir) {
        set((s) => {
          const i = s.elements.findIndex((el) => el.id === id);
          const j = dir === "up" ? i - 1 : i + 1;
          if (i < 0 || j < 0 || j >= s.elements.length) return s; // no-op at ends
          const next = s.elements.slice();
          [next[i], next[j]] = [next[j], next[i]];
          return {
            elements: next,
            ...pushHistory(s, null),
            hasChanges: true,
            autoSaveStatus: "pending",
          };
        });
      },

      deleteElement(id) {
        set((s) => {
          if (!s.elements.some((el) => el.id === id)) return s;
          return {
            elements: s.elements.filter((el) => el.id !== id),
            selectedElementId:
              s.selectedElementId === id ? null : s.selectedElementId,
            ...pushHistory(s, null),
            hasChanges: true,
            autoSaveStatus: "pending",
          };
        });
      },

      undo() {
        set((s) => {
          const previous = s.past.at(-1);
          if (!previous) return s;
          return {
            elements: previous,
            selectedElementId:
              s.selectedElementId &&
              previous.some((el) => el.id === s.selectedElementId)
                ? s.selectedElementId
                : null,
            past: s.past.slice(0, -1),
            future: [...s.future, s.elements].slice(-HISTORY_LIMIT),
            historyGroupStart: null,
            lastEditSignature: null,
            ...savedStatePatch(s, previous),
          };
        });
      },

      redo() {
        set((s) => {
          const next = s.future.at(-1);
          if (!next) return s;
          return {
            elements: next,
            selectedElementId:
              s.selectedElementId &&
              next.some((el) => el.id === s.selectedElementId)
                ? s.selectedElementId
                : null,
            past: [...s.past, s.elements].slice(-HISTORY_LIMIT),
            future: s.future.slice(0, -1),
            historyGroupStart: null,
            lastEditSignature: null,
            ...savedStatePatch(s, next),
          };
        });
      },

      beginHistoryGroup() {
        set((s) =>
          s.historyGroupStart ? s : { historyGroupStart: s.elements }
        );
      },

      endHistoryGroup() {
        set((s) => {
          if (!s.historyGroupStart) return s;
          if (s.historyGroupStart === s.elements) {
            return { historyGroupStart: null };
          }
          return {
            past: [...s.past, s.historyGroupStart].slice(-HISTORY_LIMIT),
            historyGroupStart: null,
            lastEditSignature: null,
          };
        });
      },

      selectElement(id) {
        set({ selectedElementId: id });
      },

      requestTextEdit() {
        set((s) => ({ textEditRequestId: s.textEditRequestId + 1 }));
      },

      setContainerDimensions(width, height) {
        set({ containerWidth: width, containerHeight: height });
      },

      markSaving() {
        set({ autoSaveStatus: "saving" });
      },

      markSaved() {
        set((s) => ({
          savedElements: s.elements,
          hasChanges: false,
          autoSaveStatus: "saved",
        }));
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
