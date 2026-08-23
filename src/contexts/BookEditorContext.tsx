"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  useBookDetails,
  useEditorPages,
  useAudioAssignments,
  useGenerateNarration,
  useAssignAudio,
  useDeleteAudioAssignment,
  useSavePages,
  useSaveOverlayTextEntries,
  useUpdateBook,
  useApplyBookTextStyle,
  type WordTimestamp,
  type VoiceSettings,
  type AudioAssignment,
  type PageData,
} from "@/hooks/useBookData";
import { useSoundLibrary, useUploadAudio, type SoundAsset } from "@/hooks/useSoundLibrary";
import { assemblePageNarrationText, includedOverlayText, type OverlayTextEntry } from "@/lib/overlayText";
import type {
  TextOverlayConfig,
  TextElement,
  BookTextStyle,
  RememberedTextSettings,
} from "@/types/text-overlay";
import {
  DEFAULT_BOOK_TEXT_STYLE,
  rememberTextSettings,
} from "@/types/text-overlay";
import {
  destroyOverlayEditorStore,
  getExistingOverlayEditorStore,
  remapOverlayEditorStores,
} from "@/stores/overlayEditorRegistry";
import { useOverlayEditor } from "@/hooks/useOverlayEditor";
import type { DropResult } from "@hello-pangea/dnd";
import { computeActiveWordIndexMobileCompat } from "@/lib/mobile-compat/word-sync";
import { normalizeOverlayForMobile } from "@/lib/mobile-compat/normalize";
import {
  useEditorSave,
  type BookDraft,
  type OverlayDraft,
  type OverlaySaveResult,
} from "@/hooks/useEditorSave";

// ─── Local Types ───────────────────────────────────────────────────────────────

export type LocalPageData = {
  id?: string;
  number: number;
  text: string;
  imageUrl: string;
  compositedImageUrl?: string;
  overlay?: TextOverlayConfig | null;
  overlayTextEntries?: OverlayTextEntry[];
  narrationTimestamps?: WordTimestamp[];
};

function toLocalPage(page: PageData): LocalPageData {
  return {
    id: page.id,
    number: page.pageNumber,
    text: page.textContent || "",
    imageUrl: page.imageUrl || "",
    compositedImageUrl: page.compositedImageUrl || undefined,
    overlay: page.overlay || null,
    overlayTextEntries: page.overlayTextEntries || [],
    narrationTimestamps: page.narrationTimestamps || undefined,
  };
}

export type DropAssignment = {
  audioUrl: string;
  audioName: string;
  targetPage: number;
};

export type VoiceOption = {
  id: string;
  name: string;
  category?: string | null;
};

// ─── ActivePageView ────────────────────────────────────────────────────────────

/**
 * Pre-computed view of the currently active page.
 * Replaces 6 separate derivations previously scattered through BookEditor.
 */
export type ActivePageView = {
  data: LocalPageData | undefined;
  pageId: string | undefined;        // server DB id, resolved from pageIdMap
  overlayPageId: string;             // stable key for overlay store
  narrationUrl: string;
  soundscapeUrl: string;
  assignments: { narration?: AudioAssignment; soundscape?: AudioAssignment };
  hasImage: boolean;
  usesOverlayVoices: boolean;        // true = multivoice narration path
};

// ─── Context Slice Types ───────────────────────────────────────────────────────

export type PageManagerContext = {
  localPages: LocalPageData[];
  activePage: number;
  setActivePage: (n: number) => void;
  handleAddPage: () => void;
  handleDeletePage: (pageNumber: number) => void;
  handleDragEndPages: (result: DropResult) => void;
  activeView: ActivePageView;
  pageAudioMap: Record<number, { hasNarration: boolean; hasSoundscape: boolean }>;
  draggedSound: SoundAsset | null;
  dropTargetPage: number | null;
  handlePageDragOver: (e: React.DragEvent, pageNumber: number) => void;
  handlePageDragLeave: () => void;
  handlePageDrop: (e: React.DragEvent, pageNumber: number) => void;
  // Image upload — will move to PageManager panel in a later extraction step
  uploading: boolean;
  setActiveImage: (imageUrl: string) => void;
  handleImageFile: (file: File) => Promise<void>;
};

export type OverlayTextOcrState = {
  status: "idle" | "detecting" | "ready" | "empty" | "error";
  message?: string;
};

export type OverlayTextContext = {
  activeEntries: OverlayTextEntry[];
  ocrState: OverlayTextOcrState;
  saving: boolean;
  hasIncludedEntries: boolean;
  updateEntry: (entryId: string, patch: Partial<OverlayTextEntry>, options?: { persist?: boolean }) => void;
  persistActiveEntries: (entries?: OverlayTextEntry[]) => Promise<void>;
  removeEntry: (entryId: string) => Promise<void>;
  moveEntry: (entryId: string, direction: "up" | "down") => Promise<void>;
  retryOcr: () => Promise<void>;
};

export type NarrationContext = {
  activeView: ActivePageView;
  voiceOptions: VoiceOption[];
  selectedVoiceId: string;
  setSelectedVoiceId: (id: string) => void;
  voicesLoading: boolean;
  voiceSettings: VoiceSettings;
  setVoiceSettings: React.Dispatch<React.SetStateAction<VoiceSettings>>;
  generating: boolean;
  generatingPhase: "idle" | "generating" | "stitching" | "saving";
  generateNarration: (pageNumber?: number) => Promise<void>;
  generateSelectedTextNarration: () => Promise<void>;
  saveRecordedNarration: (file: File, durationMs: number) => Promise<void>;
  selectedOverlayElement: TextElement | null;
  isNarrationPlaying: boolean;
  setIsNarrationPlaying: (v: boolean) => void;
  narrationVolume: number;
  setNarrationVolume: (v: number) => void;
  toggleNarration: () => Promise<void>;
  wordTimestamps: WordTimestamp[];
  activeWordIndex: number;
  narrationProgress: number;
  setNarrationProgress: (v: number) => void;
  showSyncPreview: boolean;
  setShowSyncPreview: (v: boolean) => void;
};

export type AudioLibraryContext = {
  activeView: ActivePageView;
  soundLibrary: ReturnType<typeof useSoundLibrary>["data"];
  libraryLoading: boolean;
  libraryOpen: boolean;
  setLibraryOpen: (v: boolean) => void;
  selectedCategory: string | null;
  setSelectedCategory: (v: string | null) => void;
  librarySearch: string;
  setLibrarySearch: (v: string) => void;
  filteredLibrarySounds: Record<string, SoundAsset[]>;
  libraryPreviewUrl: string | null;
  setLibraryPreviewUrl: (url: string | null) => void;
  toggleLibraryPreview: (url: string) => void;
  draggedSound: SoundAsset | null;
  handleDragStart: (sound: SoundAsset) => void;
  handleDragEnd: () => void;
  dropAssignment: DropAssignment | null;
  setDropAssignment: (v: DropAssignment | null) => void;
  dropRangeStart: number;
  setDropRangeStart: (v: number) => void;
  dropRangeEnd: number;
  setDropRangeEnd: (v: number) => void;
  dropScope: "single" | "range";
  setDropScope: (v: "single" | "range") => void;
  confirmDropAssignment: () => Promise<void>;
  assignAudioPending: boolean;
  soundscapeUrlInput: string;
  setSoundscapeUrlInput: (v: string) => void;
  soundscapeScope: "current" | "range";
  setSoundscapeScope: (v: "current" | "range") => void;
  soundscapeRangeStart: number;
  setSoundscapeRangeStart: (v: number) => void;
  soundscapeRangeEnd: number;
  setSoundscapeRangeEnd: (v: number) => void;
  isSoundscapePlaying: boolean;
  setIsSoundscapePlaying: (v: boolean) => void;
  soundscapeVolume: number;
  setSoundscapeVolume: (v: number) => void;
  toggleSoundscape: () => Promise<void>;
  handleAssignAudio: (
    type: "narration" | "soundscape",
    url: string,
    scope: "current" | "range",
    rangeStart: number,
    rangeEnd: number
  ) => Promise<void>;
  handleDeleteAudio: (type: "narration" | "soundscape") => Promise<void>;
  uploadAudioPending: boolean;
  audioUploadDragging: boolean;
  setAudioUploadDragging: (v: boolean) => void;
  handleAudioUpload: (file: File) => Promise<void>;
  handleAudioDropZone: (event: React.DragEvent<HTMLDivElement>) => void;
  audioInputRef: React.RefObject<HTMLInputElement | null>;
};

export type OverlayEditorContext = {
  activeView: ActivePageView;
  overlayEditorCompositing: boolean;
  handleOverlaySave: (overlayConfig: TextOverlayConfig) => Promise<void>;
  handleOverlayComposite: () => Promise<void>;
  rememberOverlayTextSettings: (settings: RememberedTextSettings) => void;
  selectedOverlayElement: TextElement | null;
};

export type ApplyTextStyleResult = {
  pagesUpdated: number;
  elementsRestyled: number;
  pagesSkipped: number;
};

export type BookMetaContext = {
  localTitle: string;
  setLocalTitle: (v: string) => void;
  localAuthor: string;
  setLocalAuthor: (v: string) => void;
  hasLocalChanges: boolean;
  markDirty: () => void;
  autoSaving: boolean;
  saving: boolean;
  saveError: string | null;
  handleSave: () => Promise<void>;
  handlePublish: () => Promise<void>;
  activePage: number;
  localPagesLength: number;
  bookTextStyle: BookTextStyle;
  applyingTextStyle: boolean;
  updateBookTextStyle: (style: BookTextStyle) => Promise<void>;
  applyBookTextStyleToAllPages: () => Promise<ApplyTextStyleResult>;
};

export type BookEditorContextValue = {
  pageManager: PageManagerContext;
  narration: NarrationContext;
  audioLibrary: AudioLibraryContext;
  overlayEditor: OverlayEditorContext;
  overlayText: OverlayTextContext;
  bookMeta: BookMetaContext;
  error: string | null;
  clearError: () => void;
  // Shared refs for audio elements — consumed by the JSX audio tags
  soundscapeRef: React.RefObject<HTMLAudioElement | null>;
  narrationRef: React.RefObject<HTMLAudioElement | null>;
  libraryPreviewRef: React.RefObject<HTMLAudioElement | null>;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  // Loading state
  loading: boolean;
};

// ─── Context ───────────────────────────────────────────────────────────────────

const BookEditorCtx = createContext<BookEditorContextValue | null>(null);

function useBookEditorCtx(): BookEditorContextValue {
  const ctx = useContext(BookEditorCtx);
  if (!ctx) throw new Error("useBookEditor must be used inside BookEditorProvider");
  return ctx;
}

// Named slice selectors
export const usePageManagerContext   = (): PageManagerContext   => useBookEditorCtx().pageManager;
export const useNarrationContext     = (): NarrationContext     => useBookEditorCtx().narration;
export const useAudioLibraryContext  = (): AudioLibraryContext  => useBookEditorCtx().audioLibrary;
export const useOverlayEditorContext = (): OverlayEditorContext => useBookEditorCtx().overlayEditor;
export const useOverlayTextContext   = (): OverlayTextContext   => useBookEditorCtx().overlayText;
export const useBookMetaContext      = (): BookMetaContext      => useBookEditorCtx().bookMeta;
export const useBookEditor           = (): BookEditorContextValue => useBookEditorCtx();

// ─── Provider ─────────────────────────────────────────────────────────────────

export function BookEditorProvider({
  bookId: bookIdParam,
  children,
}: {
  bookId: string;
  children: ReactNode;
}) {
  const router = useRouter();

  // ─── React Query ──────────────────────────────────────────────────────────

  const { data: bookDetails, isLoading: bookLoading } = useBookDetails(bookIdParam);
  const {
    data: serverPages,
    isLoading: pagesLoading,
    refetch: refetchPages,
  } = useEditorPages(bookIdParam);
  const { data: soundLibrary, isLoading: libraryLoading } = useSoundLibrary();
  const uploadAudioMutation = useUploadAudio(bookIdParam);

  const generateNarrationMutation = useGenerateNarration(bookIdParam);
  const assignAudioMutation = useAssignAudio(bookIdParam);
  const deleteAudioMutation = useDeleteAudioAssignment(bookIdParam);
  const savePagesMutation = useSavePages(bookIdParam);
  const saveOverlayTextMutation = useSaveOverlayTextEntries(bookIdParam);
  const updateBookMutation = useUpdateBook(bookIdParam);
  const applyTextStyleMutation = useApplyBookTextStyle(bookIdParam);

  // ─── Core page state ──────────────────────────────────────────────────────

  const [localPages, setLocalPages] = useState<LocalPageData[]>([]);
  const [activePage, setActivePageState] = useState(1);


  // ─── Book meta state ──────────────────────────────────────────────────────

  const [localTitle, setLocalTitle] = useState("");
  const [localAuthor, setLocalAuthor] = useState("");
  const [bookTextStyle, setBookTextStyle] = useState<BookTextStyle>(
    DEFAULT_BOOK_TEXT_STYLE
  );

  // ─── Narration state ──────────────────────────────────────────────────────

  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    speed: 0.75,
    style: 0.76,
    useSpeakerBoost: true,
  });
  const [isNarrationPlaying, setIsNarrationPlaying] = useState(false);
  const [narrationVolume, setNarrationVolume] = useState(0.85);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [narrationProgress, setNarrationProgress] = useState(0);
  const [showSyncPreview, setShowSyncPreview] = useState(false);
  const [generatingOverlayNarration, setGeneratingOverlayNarration] = useState(false);
  const [overlayNarrationPhase, setOverlayNarrationPhase] = useState<
    "idle" | "generating" | "stitching" | "saving"
  >("idle");

  // ─── Audio library / soundscape state ────────────────────────────────────

  const [soundscapeUrlInput, setSoundscapeUrlInput] = useState("");
  const [soundscapeScope, setSoundscapeScope] = useState<"current" | "range">("current");
  const [soundscapeRangeStart, setSoundscapeRangeStart] = useState(1);
  const [soundscapeRangeEnd, setSoundscapeRangeEnd] = useState(1);
  const [isSoundscapePlaying, setIsSoundscapePlaying] = useState(false);
  const [soundscapeVolume, setSoundscapeVolume] = useState(0.6);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [libraryPreviewUrl, setLibraryPreviewUrl] = useState<string | null>(null);
  const [librarySearch, setLibrarySearch] = useState("");
  const [draggedSound, setDraggedSound] = useState<SoundAsset | null>(null);
  const [dropTargetPage, setDropTargetPage] = useState<number | null>(null);
  const [dropAssignment, setDropAssignment] = useState<DropAssignment | null>(null);
  const [dropRangeStart, setDropRangeStart] = useState(1);
  const [dropRangeEnd, setDropRangeEnd] = useState(1);
  const [dropScope, setDropScope] = useState<"single" | "range">("single");
  const [audioUploadDragging, setAudioUploadDragging] = useState(false);

  // ─── Overlay state ────────────────────────────────────────────────────────

  const [overlayEditorCompositing, setOverlayEditorCompositing] = useState(false);

  // ─── OCR overlay text state ───────────────────────────────────────────────

  const [ocrStateByPage, setOcrStateByPage] = useState<Record<number, OverlayTextOcrState>>({});

  // ─── Upload state ─────────────────────────────────────────────────────────

  const [uploading, setUploading] = useState(false);

  // ─── Error state ──────────────────────────────────────────────────────────

  const [error, setError] = useState<string | null>(null);

  // ─── Refs ─────────────────────────────────────────────────────────────────

  const soundscapeRef = useRef<HTMLAudioElement>(null);
  const narrationRef = useRef<HTMLAudioElement>(null);
  const libraryPreviewRef = useRef<HTMLAudioElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const hydratedPagesBookRef = useRef<string | null>(null);
  const hydratedDetailsBookRef = useRef<string | null>(null);

  // ─── Audio assignments for current page ───────────────────────────────────

  const {
    data: currentAssignments,
    refetch: refetchAssignments,
  } = useAudioAssignments(bookIdParam, activePage);

  // ─── pageIdMap ────────────────────────────────────────────────────────────

  const pageIdMap = useMemo(() => {
    const map: Record<number, string> = {};
    serverPages?.forEach((p) => {
      map[p.pageNumber] = p.id;
    });
    return map;
  }, [serverPages]);

  const getPageId = useCallback(
    (pageNumber: number): string | undefined => pageIdMap[pageNumber],
    [pageIdMap]
  );

  // ─── ActivePageView — memoized derivation ─────────────────────────────────

  const activePageData = useMemo(
    () => localPages.find((page) => page.number === activePage),
    [localPages, activePage]
  );

  const overlayPageId = activePageData?.id ?? `page-${activePage}`;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const selectedOverlayElement = useOverlayEditor(overlayPageId, (s) => s.getSelectedElement());

  const narrationAssignment = currentAssignments?.find((a) => a.audioType === "narration");
  const soundscapeAssignment = currentAssignments?.find((a) => a.audioType === "soundscape");

  const narrationActiveUrl = useMemo(() => {
    if (narrationAssignment?.audioUrl) return narrationAssignment.audioUrl;
    if (activePageData?.narrationTimestamps) {
      return serverPages?.find((p) => p.pageNumber === activePage)?.narrationUrl || "";
    }
    return "";
  }, [narrationAssignment, activePageData, serverPages, activePage]);

  const soundscapeActiveUrl = soundscapeAssignment?.audioUrl || soundscapeUrlInput;

  const activePageUsesOverlayVoices = useMemo(() => {
    if (!activePageData) return false;
    return (activePageData.overlay?.elements || []).some(
      (el) => !!el.voiceId && !!el.text?.trim()
    );
  }, [activePageData]);

  const activeView: ActivePageView = useMemo(
    () => ({
      data: activePageData,
      pageId: getPageId(activePage),
      overlayPageId,
      narrationUrl: narrationActiveUrl,
      soundscapeUrl: soundscapeActiveUrl,
      assignments: {
        narration: narrationAssignment,
        soundscape: soundscapeAssignment,
      },
      hasImage: !!(activePageData?.imageUrl || activePageData?.compositedImageUrl),
      usesOverlayVoices: activePageUsesOverlayVoices,
    }),
    [
      activePageData,
      activePage,
      getPageId,
      overlayPageId,
      narrationActiveUrl,
      soundscapeActiveUrl,
      narrationAssignment,
      soundscapeAssignment,
      activePageUsesOverlayVoices,
    ]
  );

  // ─── pageAudioMap ─────────────────────────────────────────────────────────

  const pageAudioMap = useMemo(() => {
    const map: Record<number, { hasNarration: boolean; hasSoundscape: boolean }> = {};
    if (!serverPages) return map;
    for (const p of serverPages) {
      map[p.pageNumber] = {
        hasNarration:
          !!p.narrationUrl || !!(p.assignments?.some((a) => a.audioType === "narration")),
        hasSoundscape: !!(p.assignments?.some((a) => a.audioType === "soundscape")),
      };
    }
    return map;
  }, [serverPages]);

  // ─── filteredLibrarySounds ────────────────────────────────────────────────

  const filteredLibrarySounds = useMemo(() => {
    if (!soundLibrary?.categories) return {};
    if (!librarySearch.trim()) return soundLibrary.categories;

    const query = librarySearch.toLowerCase();
    const filtered: Record<string, SoundAsset[]> = {};
    for (const [category, sounds] of Object.entries(soundLibrary.categories)) {
      const matches = sounds.filter(
        (s) =>
          s.name.toLowerCase().includes(query) || category.toLowerCase().includes(query)
      );
      if (matches.length > 0) filtered[category] = matches;
    }
    return filtered;
  }, [soundLibrary, librarySearch]);

  // ─── Word timestamps ──────────────────────────────────────────────────────

  const wordTimestamps = activePageData?.narrationTimestamps || [];

  const currentBookDraft = useMemo<BookDraft>(
    () => ({
      title: localTitle.trim() || "Untitled Book",
      author: localAuthor,
      defaultTextStyle: bookTextStyle,
      pages: localPages.map((page) => ({
        id: page.id,
        pageNumber: page.number,
        textContent: page.text,
        imageUrl: page.imageUrl || null,
      })),
    }),
    [bookTextStyle, localAuthor, localPages, localTitle]
  );

  const saveBookDraft = useCallback(
    async (draft: BookDraft) => {
      setError(null);
      try {
        await updateBookMutation.mutateAsync({
          title: draft.title,
          author: draft.author,
          defaultTextStyle: draft.defaultTextStyle,
        });
        const result = await savePagesMutation.mutateAsync(draft.pages);

        // Preserve edits made during the request; only adopt server identities.
        if (result?.pages) {
          setLocalPages((current) =>
            current.map((page) => {
              const saved = result.pages.find((candidate) =>
                page.id
                  ? candidate.id === page.id
                  : candidate.pageNumber === page.number
              );
              return saved?.id ? { ...page, id: saved.id } : page;
            })
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
        throw err;
      }
    },
    [savePagesMutation, updateBookMutation]
  );

  const saveOverlayDraft = useCallback(
    async (draft: OverlayDraft): Promise<OverlaySaveResult> => {
      try {
        const res = await fetch(
          `/api/admin/books/${bookIdParam}/pages/${draft.pageNumber}/overlay`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              overlay: normalizeOverlayForMobile(
                draft.overlay as unknown as {
                  version: number;
                  elements: Array<Record<string, unknown>>;
                }
              ),
            }),
          }
        );
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to save overlay");
        }
        const data = await res.json();
        return {
          pageKey: draft.pageKey,
          pageNumber: draft.pageNumber,
          // Keep the editor-owned draft so a successful background save cannot
          // rehydrate the canvas with a server-normalized copy mid-edit.
          overlay: draft.overlay,
          textContent: data.textContent ?? "",
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save overlay");
        throw err;
      }
    },
    [bookIdParam]
  );

  const applyOverlayResult = useCallback((result: OverlaySaveResult) => {
    setLocalPages((prev) =>
      prev.map((p) =>
        p.number === result.pageNumber
          ? {
              ...p,
              overlay: result.overlay || p.overlay,
              text: result.textContent ?? "",
            }
          : p
      )
    );
  }, []);

  const { markDirty, commit, status } = useEditorSave({
    getBookDraft: () => currentBookDraft,
    saveBook: saveBookDraft,
    saveOverlay: saveOverlayDraft,
    applyOverlayResult,
    onOverlayPhaseChange: (pageKey, phase) => {
      const store = getExistingOverlayEditorStore(pageKey);
      if (!store) return;
      const actions = store.getState();
      if (phase === "saving") actions.markSaving();
      else if (phase === "saved") actions.markSaved();
      else if (phase === "error") actions.markSaveError();
    },
  });

  const rememberOverlayTextSettings = useCallback(
    (settings: RememberedTextSettings) => {
      setBookTextStyle((current) => rememberTextSettings(current, settings));
      markDirty("book");
    },
    [markDirty]
  );

  const queueActiveOverlayIfDirty = useCallback(() => {
    const overlayState = getExistingOverlayEditorStore(overlayPageId)?.getState();
    if (!overlayState?.hasChanges) return;

    markDirty({
      overlay: {
        pageKey: overlayPageId,
        pageNumber: activePage,
        overlay: overlayState.buildConfig(),
      },
    });
  }, [activePage, markDirty, overlayPageId]);

  const handleSave = useCallback(() => {
    queueActiveOverlayIfDirty();
    return commit("manual");
  }, [commit, queueActiveOverlayIfDirty]);

  // ─── Book text style ─────────────────────────────────────────────────────

  const applyingTextStyle = applyTextStyleMutation.isPending;

  const updateBookTextStyle = useCallback(
    async (style: BookTextStyle) => {
      try {
        await updateBookMutation.mutateAsync({ defaultTextStyle: style });
        setBookTextStyle(style);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save text style.");
        throw err;
      }
    },
    [updateBookMutation]
  );

  const applyBookTextStyleToAllPages =
    useCallback(async (): Promise<ApplyTextStyleResult> => {
      try {
        await handleSave();
        const result = await applyTextStyleMutation.mutateAsync();
        const refreshed = await refetchPages();
        if (refreshed.data) setLocalPages(refreshed.data.map(toLocalPage));
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to apply text style.");
        throw err;
      }
    }, [applyTextStyleMutation, handleSave, refetchPages]);

  // ─── Derived loading/saving flags ─────────────────────────────────────────

  const loading = bookLoading || pagesLoading;
  const hasLocalChanges = status.dirty;
  const autoSaving = status.phase === "saving";
  const saving =
    status.phase === "saving" ||
    savePagesMutation.isPending ||
    saveOverlayTextMutation.isPending ||
    updateBookMutation.isPending;
  const generatingNarration =
    generateNarrationMutation.isPending || generatingOverlayNarration;

  const setActivePageInternal = useCallback(
    (
      next: number,
      options?: { destroyKeyOverride?: string; preserveCurrentStore?: boolean }
    ) => {
      if (next !== activePage && !options?.preserveCurrentStore) {
        queueActiveOverlayIfDirty();
      }

      // Stop audio
      soundscapeRef.current?.pause();
      narrationRef.current?.pause();
      setIsSoundscapePlaying(false);
      setIsNarrationPlaying(false);

      if (!options?.preserveCurrentStore) {
        // Destroy overlay store for the page we're leaving
        const currentOverlayPageId =
          options?.destroyKeyOverride ??
          localPages.find((p) => p.number === activePage)?.id ??
          `page-${activePage}`;
        destroyOverlayEditorStore(currentOverlayPageId);
      }

      // Reset soundscape range to new page
      setSoundscapeRangeStart(next);
      setSoundscapeRangeEnd(next);

      setActivePageState(next);
    },
    [activePage, localPages, queueActiveOverlayIfDirty]
  );

  const setActivePage = useCallback(
    (next: number) => setActivePageInternal(next),
    [setActivePageInternal]
  );

  // ─── Sync server → local state ────────────────────────────────────────────

  useEffect(() => {
    if (
      serverPages !== undefined &&
      hydratedPagesBookRef.current !== bookIdParam
    ) {
      setLocalPages(serverPages.map(toLocalPage));
      hydratedPagesBookRef.current = bookIdParam;
    }
  }, [bookIdParam, serverPages]);

  useEffect(() => {
    if (bookDetails && hydratedDetailsBookRef.current !== bookIdParam) {
      setLocalTitle(bookDetails.title || "Untitled Book");
      setLocalAuthor(bookDetails.author || "Unknown");
      setBookTextStyle(
        bookDetails.defaultTextStyle ?? DEFAULT_BOOK_TEXT_STYLE
      );
      hydratedDetailsBookRef.current = bookIdParam;
    }
  }, [bookDetails, bookIdParam]);

  // ─── Load voices ──────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const loadVoices = async () => {
      setVoicesLoading(true);
      try {
        const res = await fetch("/api/elevenlabs/voices");
        if (!res.ok) throw new Error("Failed to load ElevenLabs voices");
        const data = (await res.json()) as { voices?: VoiceOption[] };
        const voices = Array.isArray(data.voices) ? data.voices : [];
        if (!mounted) return;
        setVoiceOptions(voices);
        if (voices.length > 0) {
          setSelectedVoiceId((current) => current || voices[0].id);
        }
      } catch (voiceError) {
        if (mounted) {
          console.warn("[book-editor] Failed to load voices:", voiceError);
        }
      } finally {
        if (mounted) setVoicesLoading(false);
      }
    };

    loadVoices();
    return () => { mounted = false; };
  }, []);

  // ─── Audio library — auto-select first category ───────────────────────────

  useEffect(() => {
    if (soundLibrary?.categories && !selectedCategory) {
      const cats = Object.keys(soundLibrary.categories);
      if (cats.length > 0) setSelectedCategory(cats[0]);
    }
  }, [soundLibrary, selectedCategory]);

  // ─── Cleanup overlay store on unmount ─────────────────────────────────────

  useEffect(() => {
    return () => destroyOverlayEditorStore(overlayPageId);
  }, [overlayPageId]);

  // ─── Volume sync ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (soundscapeRef.current) soundscapeRef.current.volume = soundscapeVolume;
  }, [soundscapeVolume]);

  useEffect(() => {
    if (narrationRef.current) narrationRef.current.volume = narrationVolume;
  }, [narrationVolume]);

  // ─── Active word index ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isNarrationPlaying || wordTimestamps.length === 0) {
      if (!isNarrationPlaying) setActiveWordIndex(-1);
      return;
    }
    setActiveWordIndex(computeActiveWordIndexMobileCompat(wordTimestamps, narrationProgress));
  }, [narrationProgress, wordTimestamps, isNarrationPlaying]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
        return;
      }

      if (isInput) return;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setActivePageInternal(Math.max(1, activePage - 1));
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setActivePageInternal(Math.min(localPages.length, activePage + 1));
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activePage, handleSave, localPages.length, setActivePageInternal]);

  // ─── Auto-save ────────────────────────────────────────────────────────────
  // SaveCoordinator schedules the shared editor debounce when markDirty() or an
  // overlay draft request arrives.

  // ─── Audio controls ───────────────────────────────────────────────────────

  const toggleSoundscape = useCallback(async () => {
    if (!soundscapeActiveUrl) {
      setError("Please provide a soundscape URL.");
      return;
    }
    if (!soundscapeRef.current) return;
    if (soundscapeRef.current.src !== soundscapeActiveUrl) {
      soundscapeRef.current.src = soundscapeActiveUrl;
    }
    if (isSoundscapePlaying) {
      soundscapeRef.current.pause();
      setIsSoundscapePlaying(false);
    } else {
      await soundscapeRef.current.play();
      setIsSoundscapePlaying(true);
    }
  }, [soundscapeActiveUrl, isSoundscapePlaying]);

  const toggleNarration = useCallback(async () => {
    if (!narrationActiveUrl) {
      setError("Please provide a narration URL.");
      return;
    }
    if (!narrationRef.current) return;
    if (narrationRef.current.src !== narrationActiveUrl) {
      narrationRef.current.src = narrationActiveUrl;
    }
    if (isNarrationPlaying) {
      narrationRef.current.pause();
      setIsNarrationPlaying(false);
    } else {
      await narrationRef.current.play();
      setIsNarrationPlaying(true);
    }
  }, [narrationActiveUrl, isNarrationPlaying]);

  // ─── Library preview ──────────────────────────────────────────────────────

  const toggleLibraryPreview = useCallback(
    (url: string) => {
      if (
        libraryPreviewUrl === url &&
        libraryPreviewRef.current &&
        !libraryPreviewRef.current.paused
      ) {
        libraryPreviewRef.current.pause();
        setLibraryPreviewUrl(null);
      } else {
        setLibraryPreviewUrl(url);
        setTimeout(() => {
          libraryPreviewRef.current?.play();
        }, 50);
      }
    },
    [libraryPreviewUrl]
  );

  // ─── Page actions ─────────────────────────────────────────────────────────

  const handleAddPage = useCallback(() => {
    setLocalPages((prev) => [
      ...prev,
      { number: prev.length + 1, text: "", imageUrl: "" },
    ]);
    markDirty();
  }, [markDirty]);

  const handleDeletePage = useCallback(
    (pageNumber: number) => {
      if (localPages.length <= 1) return;

      // Always clean up the deleted page store (covers both id-based and page-N keys)
      const deletedPageKey =
        localPages.find((page) => page.number === pageNumber)?.id ?? `page-${pageNumber}`;
      destroyOverlayEditorStore(deletedPageKey);

      const remainingItems = localPages.filter((page) => page.number !== pageNumber);

      // Remap unsaved page stores after renumbering
      const oldKeys = remainingItems.map((item) => item.id ?? `page-${item.number}`);
      const updated = remainingItems.map((page, index) => ({ ...page, number: index + 1 }));
      const newKeys = updated.map((item) => item.id ?? `page-${item.number}`);
      remapOverlayEditorStores(oldKeys, newKeys);

      setLocalPages(updated);
      markDirty();
      setActivePageState((prev) => {
        if (prev === pageNumber) return Math.max(1, pageNumber - 1);
        return prev > pageNumber ? prev - 1 : prev;
      });
    },
    [localPages, markDirty]
  );

  const handleDragEndPages = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;

      const sourcePageNumber = result.source.index + 1;
      const destinationPageNumber = result.destination.index + 1;

      const items = [...localPages];
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);

      // Build old overlay keys BEFORE renumbering
      const oldKeys = items.map((item) => item.id ?? `page-${item.number}`);

      const updatedItems = items.map((item, index) => ({
        ...item,
        number: index + 1,
      }));

      // Build new overlay keys AFTER renumbering
      const newKeys = updatedItems.map((item) => item.id ?? `page-${item.number}`);

      // Remap overlay stores whose keys changed (pages without server IDs)
      remapOverlayEditorStores(oldKeys, newKeys);

      setLocalPages(updatedItems);
      markDirty();

      if (activePage === sourcePageNumber) {
        setActivePageInternal(destinationPageNumber, { preserveCurrentStore: true });
      } else if (activePage > sourcePageNumber && activePage <= destinationPageNumber) {
        setActivePageInternal(activePage - 1, { preserveCurrentStore: true });
      } else if (activePage < sourcePageNumber && activePage >= destinationPageNumber) {
        setActivePageInternal(activePage + 1, { preserveCurrentStore: true });
      }
    },
    [localPages, activePage, markDirty, setActivePageInternal]
  );

  // ─── Image actions ────────────────────────────────────────────────────────

  const setActiveImage = useCallback(
    (imageUrl: string) => {
      setLocalPages((prev) =>
        prev.map((page) =>
          page.number === activePage ? { ...page, imageUrl } : page
        )
      );
      markDirty();
    },
    [activePage, markDirty]
  );

  const runOcrForPage = useCallback(
    async (pageNumber: number, imageUrl: string) => {
      if (!bookIdParam || !imageUrl) return;
      setOcrStateByPage((prev) => ({
        ...prev,
        [pageNumber]: { status: "detecting", message: "Detecting on-image text…" },
      }));

      try {
        const response = await fetch(
          `/api/admin/books/${bookIdParam}/pages/${pageNumber}/ocr`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl }),
          }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "OCR failed.");
        }

        const entries = Array.isArray(payload.entries)
          ? (payload.entries as OverlayTextEntry[])
          : [];
        setLocalPages((prev) =>
          prev.map((page) =>
            page.number === pageNumber
              ? {
                  ...page,
                  id: typeof payload.pageId === "string" ? payload.pageId : page.id,
                  overlayTextEntries: entries,
                }
              : page
          )
        );
        setOcrStateByPage((prev) => ({
          ...prev,
          [pageNumber]: entries.length > 0
            ? { status: "ready", message: `${entries.length} overlay text item${entries.length === 1 ? "" : "s"} detected.` }
            : { status: "empty", message: "No on-image text detected." },
        }));
      } catch (err) {
        setOcrStateByPage((prev) => ({
          ...prev,
          [pageNumber]: {
            status: "error",
            message: err instanceof Error ? err.message : "OCR failed.",
          },
        }));
      }
    },
    [bookIdParam]
  );

  const handleImageFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please upload a valid image file.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("File too large. Maximum size is 10MB.");
        return;
      }
      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (bookIdParam) {
          formData.append("bookId", bookIdParam);
          formData.append("pageNumber", activePage.toString());
        }
        const response = await fetch("/api/admin/uploads", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || "Failed to upload image.");
        }
        const data = await response.json();
        setActiveImage(data.url);
        void runOcrForPage(activePage, data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload image.");
      } finally {
        setUploading(false);
      }
    },
    [activePage, bookIdParam, runOcrForPage, setActiveImage]
  );

  const activeOverlayTextEntries = useMemo(
    () => activePageData?.overlayTextEntries || [],
    [activePageData?.overlayTextEntries]
  );

  const persistOverlayTextEntries = useCallback(
    async (entries: OverlayTextEntry[] = activeOverlayTextEntries) => {
      const normalized = entries.map((entry, index) => ({
        ...entry,
        text: entry.text.trim(),
        sortOrder: index,
      })).filter((entry) => entry.text.length > 0);

      const result = await saveOverlayTextMutation.mutateAsync({
        pageNumber: activePage,
        entries: normalized,
      });

      setLocalPages((prev) =>
        prev.map((page) =>
          page.number === activePage
            ? { ...page, overlayTextEntries: result.entries }
            : page
        )
      );
    },
    [activeOverlayTextEntries, activePage, saveOverlayTextMutation]
  );

  const updateOverlayTextEntry = useCallback(
    (entryId: string, patch: Partial<OverlayTextEntry>, options?: { persist?: boolean }) => {
      let nextEntries: OverlayTextEntry[] = [];
      setLocalPages((prev) =>
        prev.map((page) => {
          if (page.number !== activePage) return page;
          nextEntries = (page.overlayTextEntries || []).map((entry) =>
            entry.id === entryId ? { ...entry, ...patch } : entry
          );
          return { ...page, overlayTextEntries: nextEntries };
        })
      );
      if (options?.persist) {
        void persistOverlayTextEntries(nextEntries);
      }
    },
    [activePage, persistOverlayTextEntries]
  );

  const removeOverlayTextEntry = useCallback(
    async (entryId: string) => {
      const nextEntries = activeOverlayTextEntries.filter((entry) => entry.id !== entryId);
      setLocalPages((prev) =>
        prev.map((page) =>
          page.number === activePage ? { ...page, overlayTextEntries: nextEntries } : page
        )
      );
      await persistOverlayTextEntries(nextEntries);
    },
    [activeOverlayTextEntries, activePage, persistOverlayTextEntries]
  );

  const moveOverlayTextEntry = useCallback(
    async (entryId: string, direction: "up" | "down") => {
      const currentIndex = activeOverlayTextEntries.findIndex((entry) => entry.id === entryId);
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= activeOverlayTextEntries.length) {
        return;
      }
      const nextEntries = [...activeOverlayTextEntries];
      const [item] = nextEntries.splice(currentIndex, 1);
      nextEntries.splice(targetIndex, 0, item);
      const ordered = nextEntries.map((entry, index) => ({ ...entry, sortOrder: index }));
      setLocalPages((prev) =>
        prev.map((page) =>
          page.number === activePage ? { ...page, overlayTextEntries: ordered } : page
        )
      );
      await persistOverlayTextEntries(ordered);
    },
    [activeOverlayTextEntries, activePage, persistOverlayTextEntries]
  );

  const retryActiveOcr = useCallback(async () => {
    const imageUrl = activePageData?.imageUrl || activePageData?.compositedImageUrl || "";
    if (!imageUrl) {
      setOcrStateByPage((prev) => ({
        ...prev,
        [activePage]: { status: "error", message: "Upload an illustration before running OCR." },
      }));
      return;
    }
    await runOcrForPage(activePage, imageUrl);
  }, [activePage, activePageData, runOcrForPage]);

  // ─── Audio upload ─────────────────────────────────────────────────────────

  const handleAudioUpload = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const result = await uploadAudioMutation.mutateAsync(file);
        setSoundscapeUrlInput(result.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload audio.");
      }
    },
    [uploadAudioMutation]
  );

  const handleAudioDropZone = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setAudioUploadDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (
        file &&
        (file.type.startsWith("audio/") ||
          file.name.match(/\.(mp3|wav|ogg|flac|aac|m4a|webm)$/i))
      ) {
        handleAudioUpload(file);
      }
    },
    [handleAudioUpload]
  );

  // ─── Audio assignment ─────────────────────────────────────────────────────

  const handleAssignAudio = useCallback(
    async (
      type: "narration" | "soundscape",
      url: string,
      scope: "current" | "range",
      rangeStart: number,
      rangeEnd: number
    ) => {
      if (!url) {
        setError("Please provide an audio URL.");
        return;
      }
      const pageId = getPageId(activePage);
      if (!pageId) {
        setError("Page not saved yet. Save the book first.");
        return;
      }
      try {
        const normalizedScope = scope === "current" ? "single" : "range";
        await assignAudioMutation.mutateAsync({
          pageId,
          audioUrl: url,
          audioType: type,
          scope: normalizedScope,
          rangeStart: normalizedScope === "range" ? rangeStart : null,
          rangeEnd: normalizedScope === "range" ? rangeEnd : null,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to assign audio.");
      }
    },
    [activePage, assignAudioMutation, getPageId]
  );

  const handleDeleteAudio = useCallback(
    async (type: "narration" | "soundscape") => {
      const pageId = getPageId(activePage);
      if (!pageId) return;
      try {
        await deleteAudioMutation.mutateAsync({ pageId, audioType: type });
        if (type === "narration") {
          setLocalPages((prev) =>
            prev.map((p) =>
              p.number === activePage
                ? { ...p, narrationTimestamps: undefined }
                : p
            )
          );
        } else {
          setSoundscapeUrlInput("");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove");
      }
    },
    [activePage, deleteAudioMutation, getPageId]
  );

  // ─── Drag-and-drop assignment ─────────────────────────────────────────────

  const handleDragStart = useCallback((sound: SoundAsset) => {
    setDraggedSound(sound);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedSound(null);
    setDropTargetPage(null);
  }, []);

  const handlePageDragOver = useCallback(
    (e: React.DragEvent, pageNumber: number) => {
      if (!draggedSound) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDropTargetPage(pageNumber);
    },
    [draggedSound]
  );

  const handlePageDragLeave = useCallback(() => {
    setDropTargetPage(null);
  }, []);

  const handlePageDrop = useCallback(
    (e: React.DragEvent, pageNumber: number) => {
      if (!draggedSound) return;
      e.preventDefault();
      setDropTargetPage(null);
      setDropAssignment({
        audioUrl: draggedSound.url,
        audioName: draggedSound.name.replace(/_/g, " ").replace(/\.[^.]+$/, ""),
        targetPage: pageNumber,
      });
      setDropRangeStart(pageNumber);
      setDropRangeEnd(pageNumber);
      setDropScope("single");
      setDraggedSound(null);
    },
    [draggedSound]
  );

  const confirmDropAssignment = useCallback(async () => {
    if (!dropAssignment) return;

    const pageId = getPageId(dropAssignment.targetPage);
    if (!pageId) {
      setError("Page not saved yet. Save the book first.");
      setDropAssignment(null);
      return;
    }

    try {
      await assignAudioMutation.mutateAsync({
        pageId,
        audioUrl: dropAssignment.audioUrl,
        audioType: "soundscape",
        scope: dropScope,
        rangeStart: dropScope === "range" ? dropRangeStart : null,
        rangeEnd: dropScope === "range" ? dropRangeEnd : null,
      });
      setDropAssignment(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign audio.");
      setDropAssignment(null);
    }
  }, [dropAssignment, dropRangeEnd, dropRangeStart, dropScope, assignAudioMutation, getPageId]);

  // ─── Narration helpers ────────────────────────────────────────────────────

  const saveRecordedNarration = useCallback(
    async (file: File, durationMs: number) => {
      setError(null);
      try {
        await handleSave();
        const form = new FormData();
        form.set("file", file);
        form.set("durationMs", String(durationMs));

        const response = await fetch(
          `/api/admin/books/${bookIdParam}/pages/${activePage}/narration-recording`,
          { method: "POST", body: form }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to save narration recording.");
        }

        const wordTimestamps = Array.isArray(payload.wordTimestamps)
          ? (payload.wordTimestamps as WordTimestamp[])
          : [];
        setLocalPages((pages) =>
          pages.map((page) =>
            page.number === activePage
              ? { ...page, narrationTimestamps: wordTimestamps }
              : page
          )
        );

        const [pagesResult] = await Promise.all([refetchPages(), refetchAssignments()]);
        if (pagesResult.data) setLocalPages(pagesResult.data.map(toLocalPage));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save narration recording.";
        setError(message);
        throw new Error(message);
      }
    },
    [activePage, bookIdParam, handleSave, refetchAssignments, refetchPages]
  );

  const getVoicedOverlayItems = useCallback((page: LocalPageData) => {
    const elements = page.overlay?.elements || [];
    return elements
      .map((el, idx) => ({
        overlayElementId: el.id,
        text: el.text?.trim() || "",
        voiceId: el.voiceId,
        voiceName: el.voiceName,
        sortOrder: idx,
      }))
      .filter((item) => item.text.length > 0);
  }, []);

  const isOverlayMultivoicePage = useCallback((page: LocalPageData) => {
    const elements = page.overlay?.elements || [];
    return elements.some((el) => !!el.voiceId && !!el.text?.trim());
  }, []);

  const generateOverlayNarrationForPage = useCallback(
    async (page: LocalPageData) => {
      const items = getVoicedOverlayItems(page);
      if (items.length === 0) {
        throw new Error(
          "No overlay text found for this page. Add text in the overlay editor first."
        );
      }

      setGeneratingOverlayNarration(true);
      setOverlayNarrationPhase("generating");
      try {
        const response = await fetch("/api/admin/generate-overlay-narration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookId: bookIdParam,
            pageNumber: page.number,
            items,
            voiceSettings,
            updatePageNarration: true,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || "Failed to generate multi-voice narration");
        }

        setOverlayNarrationPhase("stitching");

        const payload = (await response.json()) as {
          pageId?: string;
          tracks?: Array<{ audioUrl: string; wordTimestamps: WordTimestamp[] }>;
          stitchedUrl?: string;
          combinedTimestamps?: WordTimestamp[];
        };

        const narrationUrl = payload.stitchedUrl || payload.tracks?.[0]?.audioUrl;
        const narrationTimestamps = payload.combinedTimestamps?.length
          ? payload.combinedTimestamps
          : payload.tracks?.[0]?.wordTimestamps;

        if (!narrationUrl) {
          throw new Error("No audio tracks returned from multi-voice narration generation.");
        }

        setOverlayNarrationPhase("saving");

        const pageId = getPageId(page.number) || payload.pageId;
        if (pageId) {
          await assignAudioMutation.mutateAsync({
            pageId,
            audioUrl: narrationUrl,
            audioType: "narration",
            scope: "single",
            rangeStart: null,
            rangeEnd: null,
          });
        } else {
          throw new Error("Narration was generated but page assignment could not be resolved.");
        }

        if (narrationTimestamps?.length) {
          setLocalPages((prev) =>
            prev.map((p) =>
              p.number === page.number ? { ...p, narrationTimestamps } : p
            )
          );
        }
      } finally {
        setGeneratingOverlayNarration(false);
        setOverlayNarrationPhase("idle");
      }
    },
    [assignAudioMutation, bookIdParam, getPageId, getVoicedOverlayItems, voiceSettings]
  );

  const generateNarration = useCallback(
    async (pageNumber?: number) => {
      const targetPage = pageNumber ?? activePage;
      const pageData = localPages.find((p) => p.number === targetPage);
      if (!pageData) {
        setError("No active page selected.");
        return;
      }
      const narrationText = assemblePageNarrationText(
        pageData?.text,
        pageData?.overlayTextEntries
      );
      if (!narrationText.trim()) {
        setError(
          "No text content to generate narration from. Add page text or include overlay text first."
        );
        return;
      }
      setError(null);
      try {
        if (isOverlayMultivoicePage(pageData)) {
          await generateOverlayNarrationForPage(pageData);
          return;
        }

        const data = await generateNarrationMutation.mutateAsync({
          text: pageData.text || "",
          pageNumber: targetPage,
          voice: selectedVoiceId || undefined,
          voiceSettings,
        });
        if (data.wordTimestamps && data.wordTimestamps.length > 0) {
          setLocalPages((prev) =>
            prev.map((p) =>
              p.number === targetPage
                ? { ...p, narrationTimestamps: data.wordTimestamps }
                : p
            )
          );
        }
        const pageId = getPageId(targetPage);
        if (pageId) {
          await assignAudioMutation.mutateAsync({
            pageId,
            audioUrl: data.url,
            audioType: "narration",
            scope: "single",
            rangeStart: null,
            rangeEnd: null,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate narration.");
      }
    },
    [
      activePage,
      assignAudioMutation,
      generateNarrationMutation,
      generateOverlayNarrationForPage,
      getPageId,
      isOverlayMultivoicePage,
      localPages,
      selectedVoiceId,
      voiceSettings,
    ]
  );

  const generateSelectedTextNarration = useCallback(async () => {
    if (!activePageData) {
      setError("No active page selected.");
      return;
    }

    if (!selectedOverlayElement?.id || !selectedOverlayElement.text?.trim()) {
      setError("Select a text instance in the overlay editor first.");
      return;
    }

    setError(null);

    const nonEmptyOverlayItems =
      activePageData.overlay?.elements.filter((el) => !!el.text?.trim()) || [];
    const shouldUpdatePageNarration = nonEmptyOverlayItems.length <= 1;

    try {
      const selectedVoice = voiceOptions.find(
        (voice) => voice.id === selectedOverlayElement.voiceId
      );

      const response = await fetch("/api/admin/generate-overlay-narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: bookIdParam,
          pageNumber: activePageData.number,
          items: [
            {
              overlayElementId: selectedOverlayElement.id,
              text: selectedOverlayElement.text,
              voiceId: selectedOverlayElement.voiceId || selectedVoiceId || undefined,
              voiceName: selectedOverlayElement.voiceName || selectedVoice?.name,
              sortOrder: 0,
            },
          ],
          voiceSettings,
          updatePageNarration: shouldUpdatePageNarration,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          payload?.error || "Failed to generate narration for selected text."
        );
      }

      const payload = (await response.json()) as {
        pageId?: string;
        tracks?: Array<{ audioUrl: string; wordTimestamps: WordTimestamp[] }>;
        stitchedUrl?: string;
        combinedTimestamps?: WordTimestamp[];
      };

      const narrationUrl = payload.stitchedUrl || payload.tracks?.[0]?.audioUrl;
      const narrationTimestamps = payload.combinedTimestamps?.length
        ? payload.combinedTimestamps
        : payload.tracks?.[0]?.wordTimestamps;

      if (!narrationUrl) {
        throw new Error("No audio returned for selected text instance.");
      }

      if (shouldUpdatePageNarration) {
        const pageId = getPageId(activePageData.number) || payload.pageId;
        if (pageId) {
          await assignAudioMutation.mutateAsync({
            pageId,
            audioUrl: narrationUrl,
            audioType: "narration",
            scope: "single",
            rangeStart: null,
            rangeEnd: null,
          });
        } else {
          throw new Error(
            "Narration was generated but page assignment could not be resolved."
          );
        }

        if (narrationTimestamps?.length) {
          setLocalPages((prev) =>
            prev.map((p) =>
              p.number === activePageData.number ? { ...p, narrationTimestamps } : p
            )
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate narration for selected text."
      );
    }
  }, [
    activePageData,
    assignAudioMutation,
    bookIdParam,
    getPageId,
    selectedOverlayElement,
    selectedVoiceId,
    voiceOptions,
    voiceSettings,
  ]);

  // ─── Save / Publish ───────────────────────────────────────────────────────

  const handlePublish = useCallback(async () => {
    setError(null);
    try {
      queueActiveOverlayIfDirty();
      await commit("manual");
      await updateBookMutation.mutateAsync({
        title: currentBookDraft.title,
        author: currentBookDraft.author,
        isPublished: true,
        processingStatus: "published",
      });
      router.push("/admin/books");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish.");
    }
  }, [
    commit,
    currentBookDraft,
    queueActiveOverlayIfDirty,
    router,
    updateBookMutation,
  ]);

  // ─── Overlay handlers ─────────────────────────────────────────────────────

  const handleOverlaySave = useCallback(
    async (overlayConfig: TextOverlayConfig) => {
      markDirty({
        overlay: { pageKey: overlayPageId, pageNumber: activePage, overlay: overlayConfig },
      });
    },
    [markDirty, overlayPageId, activePage]
  );

  const handleOverlayComposite = useCallback(async () => {
    setOverlayEditorCompositing(true);
    try {
      const res = await fetch(
        `/api/admin/books/${bookIdParam}/pages/${activePage}/composite`,
        { method: "POST" }
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to composite image");
      }
      const data = await res.json();
      setLocalPages((prev) =>
        prev.map((p) =>
          p.number === activePage
            ? { ...p, compositedImageUrl: data.compositedImageUrl }
            : p
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to composite image");
    } finally {
      setOverlayEditorCompositing(false);
    }
  }, [activePage, bookIdParam]);

  // ─── activeAssignments (UI display helper) ────────────────────────────────

  const activeAssignments = useMemo(() => {
    if (!currentAssignments) return undefined;
    const narration = currentAssignments.find((a) => a.audioType === "narration");
    const soundscape = currentAssignments.find((a) => a.audioType === "soundscape");
    return {
      narration: narration
        ? {
            url: narration.audioUrl,
            scope: narration.scope,
            range:
              narration.scope === "range" &&
              narration.rangeStart &&
              narration.rangeEnd
                ? `${narration.rangeStart}-${narration.rangeEnd}`
                : "current",
          }
        : undefined,
      soundscape: soundscape
        ? {
            url: soundscape.audioUrl,
            scope: soundscape.scope,
            range:
              soundscape.scope === "range" &&
              soundscape.rangeStart &&
              soundscape.rangeEnd
                ? `${soundscape.rangeStart}-${soundscape.rangeEnd}`
                : "current",
          }
        : undefined,
    };
  }, [currentAssignments]);

  // ─── Expose uploading, hasImage, activeAssignments via context ────────────
  // (consumed by existing JSX in page.tsx until panels are fully extracted)

  // ─── Build context value ──────────────────────────────────────────────────

  const contextValue: BookEditorContextValue = useMemo(
    () => ({
      pageManager: {
        localPages,
        activePage,
        setActivePage,
        handleAddPage,
        handleDeletePage,
        handleDragEndPages,
        activeView,
        pageAudioMap,
        draggedSound,
        dropTargetPage,
        handlePageDragOver,
        handlePageDragLeave,
        handlePageDrop,
        uploading,
        setActiveImage,
        handleImageFile,
      },
      narration: {
        activeView,
        voiceOptions,
        selectedVoiceId,
        setSelectedVoiceId,
        voicesLoading,
        voiceSettings,
        setVoiceSettings,
        generating: generatingNarration,
        generatingPhase: overlayNarrationPhase,
        generateNarration,
        generateSelectedTextNarration,
        saveRecordedNarration,
        selectedOverlayElement,
        isNarrationPlaying,
        setIsNarrationPlaying,
        narrationVolume,
        setNarrationVolume,
        toggleNarration,
        wordTimestamps,
        activeWordIndex,
        narrationProgress,
        setNarrationProgress,
        showSyncPreview,
        setShowSyncPreview,
      },
      audioLibrary: {
        activeView,
        soundLibrary,
        libraryLoading,
        libraryOpen,
        setLibraryOpen,
        selectedCategory,
        setSelectedCategory,
        librarySearch,
        setLibrarySearch,
        filteredLibrarySounds,
        libraryPreviewUrl,
        setLibraryPreviewUrl,
        toggleLibraryPreview,
        draggedSound,
        handleDragStart,
        handleDragEnd,
        dropAssignment,
        setDropAssignment,
        dropRangeStart,
        setDropRangeStart,
        dropRangeEnd,
        setDropRangeEnd,
        dropScope,
        setDropScope,
        confirmDropAssignment,
        assignAudioPending: assignAudioMutation.isPending,
        soundscapeUrlInput,
        setSoundscapeUrlInput,
        soundscapeScope,
        setSoundscapeScope,
        soundscapeRangeStart,
        setSoundscapeRangeStart,
        soundscapeRangeEnd,
        setSoundscapeRangeEnd,
        isSoundscapePlaying,
        setIsSoundscapePlaying,
        soundscapeVolume,
        setSoundscapeVolume,
        toggleSoundscape,
        handleAssignAudio,
        handleDeleteAudio,
        uploadAudioPending: uploadAudioMutation.isPending,
        audioUploadDragging,
        setAudioUploadDragging,
        handleAudioUpload,
        handleAudioDropZone,
        audioInputRef,
      },
      overlayEditor: {
        activeView,
        overlayEditorCompositing,
        handleOverlaySave,
        handleOverlayComposite,
        rememberOverlayTextSettings,
        selectedOverlayElement,
      },
      overlayText: {
        activeEntries: activeOverlayTextEntries,
        ocrState: ocrStateByPage[activePage] || { status: "idle" },
        saving: saveOverlayTextMutation.isPending,
        hasIncludedEntries: includedOverlayText(activeOverlayTextEntries).length > 0,
        updateEntry: updateOverlayTextEntry,
        persistActiveEntries: persistOverlayTextEntries,
        removeEntry: removeOverlayTextEntry,
        moveEntry: moveOverlayTextEntry,
        retryOcr: retryActiveOcr,
      },
      bookMeta: {
        localTitle,
        setLocalTitle: (v: string) => { setLocalTitle(v); markDirty(); },
        localAuthor,
        setLocalAuthor: (v: string) => { setLocalAuthor(v); markDirty(); },
        hasLocalChanges,
        markDirty,
        autoSaving,
        saving,
        saveError: status.error?.message ?? null,
        handleSave,
        handlePublish,
        activePage,
        localPagesLength: localPages.length,
        bookTextStyle,
        applyingTextStyle,
        updateBookTextStyle,
        applyBookTextStyleToAllPages,
      },
      error,
      clearError: () => setError(null),
      soundscapeRef,
      narrationRef,
      libraryPreviewRef,
      imageInputRef,
      loading,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      localPages,
      activePage,
      activeView,
      pageAudioMap,
      draggedSound,
      dropTargetPage,
      voiceOptions,
      selectedVoiceId,
      voicesLoading,
      voiceSettings,
      generatingNarration,
      overlayNarrationPhase,
      selectedOverlayElement,
      isNarrationPlaying,
      narrationVolume,
      wordTimestamps,
      activeWordIndex,
      narrationProgress,
      showSyncPreview,
      soundLibrary,
      libraryLoading,
      libraryOpen,
      selectedCategory,
      librarySearch,
      filteredLibrarySounds,
      libraryPreviewUrl,
      dropAssignment,
      dropRangeStart,
      dropRangeEnd,
      dropScope,
      soundscapeUrlInput,
      soundscapeScope,
      soundscapeRangeStart,
      soundscapeRangeEnd,
      isSoundscapePlaying,
      soundscapeVolume,
      overlayEditorCompositing,
      rememberOverlayTextSettings,
      activeOverlayTextEntries,
      ocrStateByPage,
      saveOverlayTextMutation.isPending,
      updateOverlayTextEntry,
      persistOverlayTextEntries,
      removeOverlayTextEntry,
      moveOverlayTextEntry,
      retryActiveOcr,
      localTitle,
      localAuthor,
      bookTextStyle,
      applyingTextStyle,
      updateBookTextStyle,
      applyBookTextStyleToAllPages,
      status,
      markDirty,
      handleSave,
      handlePublish,
      error,
      loading,
      activeAssignments,
      assignAudioMutation.isPending,
      uploadAudioMutation.isPending,
      audioUploadDragging,
      uploading,
    ]
  );

  return (
    <BookEditorCtx.Provider value={contextValue}>
      {children}
    </BookEditorCtx.Provider>
  );
}
