import type { BookTextStyle, TextOverlayConfig } from "@/types/text-overlay";

export const EDITOR_AUTOSAVE_DEBOUNCE_MS = 2000;

export type SaveReason = "autosave" | "manual" | "retry";

export type SavePhase = "idle" | "pending" | "saving" | "saved" | "error";

export type SaveTargetId = "book" | `overlay:${string}`;

export type BookDraftPage = {
  id?: string;
  pageNumber: number;
  textContent: string;
  imageUrl: string | null;
};

export type BookDraft = {
  title: string;
  author: string;
  defaultTextStyle?: BookTextStyle;
  pages: BookDraftPage[];
};

export type OverlayDraft = {
  pageKey: string;
  pageNumber: number;
  overlay: TextOverlayConfig;
};

export type SaveRequestIntent =
  | { target: "book" }
  | { target: "overlay"; draft: OverlayDraft };

export type OverlaySaveResult = {
  pageKey: string;
  pageNumber: number;
  overlay: TextOverlayConfig | null;
  textContent: string | null;
};

export type SaveSnapshot = {
  target: SaveTargetId;
  phase: SavePhase;
  dirty: boolean;
  error: unknown | null;
  revision: number;
};

export type SaveStatusSnapshot = Omit<SaveSnapshot, "target">;

export type SaveCoordinatorListener = (
  snapshot: SaveSnapshot,
  target: SaveTargetId
) => void;

export type Scheduler = {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

export type SaveCoordinatorPorts = {
  getBookDraft: () => BookDraft;
  saveBook: (draft: BookDraft, reason: SaveReason) => Promise<void>;
  saveOverlay: (
    draft: OverlayDraft,
    reason: SaveReason
  ) => Promise<OverlaySaveResult>;
  applyOverlayResult: (result: OverlaySaveResult) => void;
  debounceMs?: number;
  scheduler?: Scheduler;
};

type TargetState = SaveSnapshot & {
  overlayDraft?: OverlayDraft;
};

const defaultScheduler: Scheduler = {
  setTimeout(callback, ms) {
    return setTimeout(callback, ms);
  },
  clearTimeout(handle) {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

function createTargetState(target: SaveTargetId): TargetState {
  return {
    target,
    phase: "idle",
    dirty: false,
    error: null,
    revision: 0,
  };
}

function overlayTarget(pageKey: string): SaveTargetId {
  return `overlay:${pageKey}`;
}

function pageKeyFromOverlayTarget(target: SaveTargetId): string {
  return target.startsWith("overlay:") ? target.slice("overlay:".length) : target;
}

/**
 * Single in-process editor save boundary.
 *
 * The coordinator owns the debounce timer, dirty/error phases, and the ordering
 * rule that overlay saves must land before a dirty book/page draft is
 * snapshotted. React Query/fetch calls stay outside as injected ports.
 *
 * This class is the internal engine for `useEditorSave`. New code should use the hook
 * directly; the class is kept exported for tests and advanced use cases.
 */
export class SaveCoordinator {
  private readonly debounceMs: number;
  private readonly scheduler: Scheduler;
  private readonly targets = new Map<SaveTargetId, TargetState>();
  private readonly listeners = new Set<SaveCoordinatorListener>();
  private readonly appliedOverlayResults = new Map<string, OverlaySaveResult>();
  private autosaveTimer: unknown | null = null;
  private flushPromise: Promise<void> | null = null;
  private flushQueued = false;

  constructor(private ports: SaveCoordinatorPorts) {
    this.debounceMs = ports.debounceMs ?? EDITOR_AUTOSAVE_DEBOUNCE_MS;
    this.scheduler = ports.scheduler ?? defaultScheduler;
    this.targets.set("book", createTargetState("book"));
  }

  updatePorts(
    ports: Pick<
      SaveCoordinatorPorts,
      "getBookDraft" | "saveBook" | "saveOverlay" | "applyOverlayResult"
    >
  ): void {
    Object.assign(this.ports, ports);
  }

  requestSave(intent: SaveRequestIntent): void {
    if (intent.target === "book") {
      this.markBookDirty();
      return;
    }

    this.requestOverlaySave(intent.draft);
  }

  markBookDirty(): void {
    const state = this.getTarget("book");
    this.markDirty(state);
    this.scheduleAutosave();
  }

  requestOverlaySave(draft: OverlayDraft): void {
    const state = this.getTarget(overlayTarget(draft.pageKey));
    state.overlayDraft = draft;
    this.markDirty(state);
    this.scheduleAutosave();
  }

  async flush(reason: SaveReason = "manual"): Promise<void> {
    this.clearAutosaveTimer();
    this.flushQueued = true;

    if (!this.flushPromise) {
      this.flushPromise = this.drain(reason).finally(() => {
        this.flushPromise = null;
      });
    }

    return this.flushPromise;
  }

  getSnapshot(target: SaveTargetId): SaveSnapshot {
    return this.snapshot(this.getTarget(target));
  }

  getOverlaySnapshot(pageKey: string): SaveSnapshot {
    return this.getSnapshot(overlayTarget(pageKey));
  }

  getStatusSnapshot(): SaveStatusSnapshot {
    const states = [...this.targets.values()];
    const dirty = states.some((state) => state.dirty);
    const errorState = states.find(
      (state) => state.dirty && state.phase === "error"
    );
    const phase: SavePhase = !dirty
      ? states.some((state) => state.phase === "saved")
        ? "saved"
        : "idle"
      : errorState
        ? "error"
        : states.some((state) => state.phase === "saving")
          ? "saving"
          : "pending";

    return {
      phase,
      dirty,
      error: errorState?.error ?? null,
      revision: states.reduce((total, state) => total + state.revision, 0),
    };
  }

  markBookClean(phase: Extract<SavePhase, "idle" | "saved"> = "saved"): void {
    const state = this.getTarget("book");
    state.dirty = false;
    state.phase = phase;
    state.error = null;
    this.emit(state);
  }

  subscribe(listener: SaveCoordinatorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.clearAutosaveTimer();
    this.listeners.clear();
  }

  static overlayTarget(pageKey: string): SaveTargetId {
    return overlayTarget(pageKey);
  }

  static pageKeyFromOverlayTarget(target: SaveTargetId): string {
    return pageKeyFromOverlayTarget(target);
  }

  private async drain(initialReason: SaveReason): Promise<void> {
    let reason = initialReason;
    while (this.flushQueued) {
      this.flushQueued = false;
      await this.runOnce(reason);
      reason = "autosave";
    }
  }

  private async runOnce(reason: SaveReason): Promise<void> {
    const overlayStates = [...this.targets.values()].filter(
      (state) => state.target !== "book" && state.dirty && state.overlayDraft
    );
    const pageIds = new Set(
      this.ports
        .getBookDraft()
        .pages.map((page) => page.id)
        .filter((id): id is string => !!id)
    );
    const persistedOverlays = overlayStates.filter((state) =>
      pageIds.has(state.overlayDraft!.pageKey)
    );
    const newPageOverlays = overlayStates.filter(
      (state) => !pageIds.has(state.overlayDraft!.pageKey)
    );

    // Existing overlays land first so the following page snapshot cannot
    // overwrite their derived text with stale local text.
    if (persistedOverlays.length > 0) {
      await this.saveOverlays(persistedOverlays, reason);
      if (persistedOverlays.some((state) => state.dirty)) return;
    }

    const bookState = this.getTarget("book");
    if (bookState.dirty) await this.saveBook(bookState, reason);

    // New pages must exist before their overlay endpoint can address them.
    if (newPageOverlays.length > 0) {
      await this.saveOverlays(newPageOverlays, reason);
    }
  }

  private async saveOverlays(
    overlayStates: TargetState[],
    reason: SaveReason
  ): Promise<void> {
    const jobs = overlayStates.map((state) => {
      const draft = state.overlayDraft;
      if (!draft) return null;

      const revisionAtStart = state.revision;
      state.phase = "saving";
      state.error = null;
      this.emit(state);

      return this.ports
        .saveOverlay(draft, reason)
        .then((result) => ({ status: "fulfilled" as const, state, revisionAtStart, result }))
        .catch((error) => ({ status: "rejected" as const, state, revisionAtStart, error }));
    });

    const results = await Promise.all(jobs.filter((job): job is NonNullable<typeof job> => !!job));
    let firstError: unknown = null;

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.state.revision === result.revisionAtStart) {
          this.appliedOverlayResults.set(result.result.pageKey, result.result);
          this.ports.applyOverlayResult(result.result);
          result.state.dirty = false;
          result.state.phase = "saved";
          result.state.error = null;
          this.emit(result.state);
        } else {
          result.state.phase = "pending";
          this.emit(result.state);
        }
      } else if (result.state.revision === result.revisionAtStart) {
        result.state.dirty = true;
        result.state.phase = "error";
        result.state.error = result.error;
        firstError ??= result.error;
        this.emit(result.state);
      } else {
        result.state.phase = "pending";
        this.emit(result.state);
      }
    }

    if (firstError) throw firstError;
  }

  private async saveBook(state: TargetState, reason: SaveReason): Promise<void> {
    const revisionAtStart = state.revision;
    const currentDraft = this.ports.getBookDraft();
    const overlayResults = [...this.appliedOverlayResults.values()];
    const draft: BookDraft = {
      ...currentDraft,
      pages: currentDraft.pages.map((page) => {
        const result =
          (page.id ? this.appliedOverlayResults.get(page.id) : undefined) ??
          overlayResults.find(
            (candidate) => candidate.pageNumber === page.pageNumber
          );
        return result
          ? { ...page, textContent: result.textContent ?? "" }
          : page;
      }),
    };

    state.phase = "saving";
    state.error = null;
    this.emit(state);

    try {
      await this.ports.saveBook(draft, reason);
      if (state.revision === revisionAtStart) {
        state.dirty = false;
        state.phase = "saved";
        state.error = null;
        this.appliedOverlayResults.clear();
      } else {
        state.phase = "pending";
      }
      this.emit(state);
    } catch (error) {
      if (state.revision === revisionAtStart) {
        state.dirty = true;
        state.phase = "error";
        state.error = error;
      } else {
        state.phase = "pending";
      }
      this.emit(state);
      throw error;
    }
  }

  private markDirty(state: TargetState): void {
    state.revision += 1;
    state.dirty = true;
    state.error = null;
    if (state.phase !== "saving") {
      state.phase = "pending";
    }
    this.emit(state);
  }

  private scheduleAutosave(): void {
    this.clearAutosaveTimer();
    this.autosaveTimer = this.scheduler.setTimeout(() => {
      this.autosaveTimer = null;
      void this.flush("autosave").catch(() => undefined);
    }, this.debounceMs);
  }

  private clearAutosaveTimer(): void {
    if (this.autosaveTimer !== null) {
      this.scheduler.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  private getTarget(target: SaveTargetId): TargetState {
    let state = this.targets.get(target);
    if (!state) {
      state = createTargetState(target);
      this.targets.set(target, state);
    }
    return state;
  }

  private emit(state: TargetState): void {
    const snapshot = this.snapshot(state);
    for (const listener of this.listeners) {
      listener(snapshot, state.target);
    }
  }

  private snapshot(state: TargetState): SaveSnapshot {
    return {
      target: state.target,
      phase: state.phase,
      dirty: state.dirty,
      error: state.error,
      revision: state.revision,
    };
  }
}
