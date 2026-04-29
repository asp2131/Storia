"use client";

import {
  useCallback,
  useEffect,
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
  type SaveSnapshot,
  type SaveTargetId,
  type Scheduler,
} from "@/lib/editor/saveCoordinator";

export type { BookDraft, BookDraftPage, OverlayDraft, OverlaySaveResult, SavePhase, SaveReason };

export type SaveStatus = {
  phase: SavePhase;
  dirty: boolean;
  error: Error | null;
};

export type UseEditorSaveOptions = {
  getBookDraft: () => BookDraft;
  saveBook: (draft: BookDraft, reason: SaveReason) => Promise<void>;
  saveOverlay: (draft: OverlayDraft, reason: SaveReason) => Promise<OverlaySaveResult>;
  applyOverlayResult: (result: OverlaySaveResult) => void;
  debounceMs?: number;
  scheduler?: Scheduler;
  onOverlayPhaseChange?: (pageKey: string, phase: SavePhase, error: unknown | null) => void;
};

export type UseEditorSaveReturn = {
  markDirty: (target?: "book" | { overlay: OverlayDraft }) => void;
  commit: (reason?: SaveReason) => Promise<void>;
  status: SaveStatus;
};

export function useEditorSave(options: UseEditorSaveOptions): UseEditorSaveReturn {
  const getBookDraftRef = useRef(options.getBookDraft);
  const saveBookRef = useRef(options.saveBook);
  const saveOverlayRef = useRef(options.saveOverlay);
  const applyOverlayResultRef = useRef(options.applyOverlayResult);
  const onOverlayPhaseChangeRef = useRef(options.onOverlayPhaseChange);

  getBookDraftRef.current = options.getBookDraft;
  saveBookRef.current = options.saveBook;
  saveOverlayRef.current = options.saveOverlay;
  applyOverlayResultRef.current = options.applyOverlayResult;
  onOverlayPhaseChangeRef.current = options.onOverlayPhaseChange;

  const coordinatorRef = useRef<SaveCoordinator | null>(null);
  if (coordinatorRef.current === null) {
    coordinatorRef.current = new SaveCoordinator({
      getBookDraft: () => getBookDraftRef.current(),
      saveBook: (draft, reason) => saveBookRef.current(draft, reason),
      saveOverlay: (draft, reason) => saveOverlayRef.current(draft, reason),
      applyOverlayResult: (result) => applyOverlayResultRef.current(result),
      debounceMs: options.debounceMs,
      scheduler: options.scheduler,
    });
  }

  const coordinator = coordinatorRef.current;

  const [status, setStatus] = useState<SaveStatus>(() => {
    const snap = coordinator.getSnapshot("book");
    return {
      phase: snap.phase,
      dirty: snap.dirty,
      error: snap.error instanceof Error ? snap.error : null,
    };
  });

  useEffect(() => {
    const unsubscribe = coordinator.subscribe((snapshot, target) => {
      if (target === "book") {
        setStatus({
          phase: snapshot.phase,
          dirty: snapshot.dirty,
          error: snapshot.error instanceof Error ? snapshot.error : null,
        });
      } else if (onOverlayPhaseChangeRef.current) {
        const pageKey = SaveCoordinator.pageKeyFromOverlayTarget(target);
        onOverlayPhaseChangeRef.current(pageKey, snapshot.phase, snapshot.error);
      }
    });
    return () => {
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
    async (reason?: SaveReason) => {
      return coordinator.flush(reason ?? "manual");
    },
    [coordinator]
  );

  return { markDirty, commit, status };
}
