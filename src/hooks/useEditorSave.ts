"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  SaveCoordinator,
  type BookDraft,
  type BookDraftPage,
  type OverlayDraft,
  type OverlaySaveResult,
  type SavePhase,
  type SaveReason,
  type Scheduler,
} from "@/lib/editor/saveCoordinator";

export type {
  BookDraft,
  BookDraftPage,
  OverlayDraft,
  OverlaySaveResult,
  SavePhase,
  SaveReason,
};

export type SaveStatus = {
  phase: SavePhase;
  dirty: boolean;
  error: Error | null;
};

export type UseEditorSaveOptions = {
  getBookDraft: () => BookDraft;
  saveBook: (draft: BookDraft, reason: SaveReason) => Promise<void>;
  saveOverlay: (
    draft: OverlayDraft,
    reason: SaveReason
  ) => Promise<OverlaySaveResult>;
  applyOverlayResult: (result: OverlaySaveResult) => void;
  debounceMs?: number;
  scheduler?: Scheduler;
  onOverlayPhaseChange?: (
    pageKey: string,
    phase: SavePhase,
    error: unknown | null
  ) => void;
};

export type UseEditorSaveReturn = {
  markDirty: (target?: "book" | { overlay: OverlayDraft }) => void;
  commit: (reason?: SaveReason) => Promise<void>;
  status: SaveStatus;
};

function toStatus(coordinator: SaveCoordinator): SaveStatus {
  const snapshot = coordinator.getStatusSnapshot();
  return {
    phase: snapshot.phase,
    dirty: snapshot.dirty,
    error:
      snapshot.error instanceof Error
        ? snapshot.error
        : snapshot.error
          ? new Error(String(snapshot.error))
          : null,
  };
}

export function useEditorSave(options: UseEditorSaveOptions): UseEditorSaveReturn {
  const onOverlayPhaseChangeRef = useRef(options.onOverlayPhaseChange);
  const [coordinator] = useState(
    () =>
      new SaveCoordinator({
        getBookDraft: options.getBookDraft,
        saveBook: options.saveBook,
        saveOverlay: options.saveOverlay,
        applyOverlayResult: options.applyOverlayResult,
        debounceMs: options.debounceMs,
        scheduler: options.scheduler,
      })
  );
  const [status, setStatus] = useState<SaveStatus>(() =>
    toStatus(coordinator)
  );

  // Layout timing guarantees a user event cannot save the previous render.
  useLayoutEffect(() => {
    coordinator.updatePorts({
      getBookDraft: options.getBookDraft,
      saveBook: options.saveBook,
      saveOverlay: options.saveOverlay,
      applyOverlayResult: options.applyOverlayResult,
    });
    onOverlayPhaseChangeRef.current = options.onOverlayPhaseChange;
  }, [
    coordinator,
    options.applyOverlayResult,
    options.getBookDraft,
    options.onOverlayPhaseChange,
    options.saveBook,
    options.saveOverlay,
  ]);

  useEffect(() => {
    const unsubscribe = coordinator.subscribe((snapshot, target) => {
      setStatus(toStatus(coordinator));
      if (target !== "book") {
        onOverlayPhaseChangeRef.current?.(
          SaveCoordinator.pageKeyFromOverlayTarget(target),
          snapshot.phase,
          snapshot.error
        );
      }
    });
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!coordinator.getStatusSnapshot().dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const handleOnline = () => {
      const snapshot = coordinator.getStatusSnapshot();
      if (!snapshot.dirty || snapshot.phase === "saving") return;
      void coordinator.flush("retry").catch(() => undefined);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("online", handleOnline);
      unsubscribe();
      coordinator.dispose();
    };
  }, [coordinator]);

  const markDirty = useCallback(
    (target?: "book" | { overlay: OverlayDraft }) => {
      if (!target || target === "book") {
        coordinator.markBookDirty();
        return;
      }
      coordinator.requestOverlaySave(target.overlay);
    },
    [coordinator]
  );

  const commit = useCallback(
    (reason: SaveReason = "manual") => coordinator.flush(reason),
    [coordinator]
  );

  return { markDirty, commit, status };
}
