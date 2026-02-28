"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  BookOpen,
  GripVertical,
  Image as ImageIcon,
  Plus,
  Pencil,
  PlayCircle,
  UploadCloud,
  ImagePlus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Headphones,
  X,
  Pause,
  Play,
  Loader2,
  Wand2,
  Sparkles,
  Type,
  Music,
  Mic,
  Upload,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  GripHorizontal,
  FileAudio,
  Settings,
} from "lucide-react";
import {
  useBookDetails,
  useEditorPages,
  useAudioAssignments,
  useGenerateNarration,
  useAssignAudio,
  useDeleteAudioAssignment,
  useSavePages,
  useUpdateBook,
  WordTimestamp,
} from "@/hooks/useBookData";
import { useSoundLibrary, useUploadAudio, SoundAsset } from "@/hooks/useSoundLibrary";
import type { TextOverlayConfig } from "@/types/text-overlay";
import { DraggableTextOverlayEditor } from "@/components/text-overlay/DraggableTextOverlayEditor";

type LocalPageData = {
  id?: string;
  number: number;
  text: string;
  imageUrl: string;
  compositedImageUrl?: string;
  overlay?: TextOverlayConfig | null;
  narrationTimestamps?: WordTimestamp[];
};

type DropAssignment = {
  audioUrl: string;
  audioName: string;
  targetPage: number;
};

export default function BookEditor() {
  const router = useRouter();
  const params = useParams();
  const bookIdParam = params.id as string;

  // React Query hooks
  const { data: bookDetails, isLoading: bookLoading } = useBookDetails(bookIdParam);
  const { data: serverPages, isLoading: pagesLoading } = useEditorPages(bookIdParam);

  // Sound library
  const { data: soundLibrary, isLoading: libraryLoading } = useSoundLibrary();
  const uploadAudioMutation = useUploadAudio(bookIdParam);

  // Local state for edits (not yet saved to server)
  const [localPages, setLocalPages] = useState<LocalPageData[]>([]);
  const [localTitle, setLocalTitle] = useState("");
  const [localAuthor, setLocalAuthor] = useState("");
  const [hasLocalChanges, setHasLocalChanges] = useState(false);

  // Overlay editor modal state
  const [overlayEditorSaving, setOverlayEditorSaving] = useState(false);
  const [overlayEditorCompositing, setOverlayEditorCompositing] = useState(false);

  // Sync server data to local state when loaded
  useEffect(() => {
    if (serverPages && serverPages.length > 0 && !hasLocalChanges) {
      setLocalPages(
        serverPages.map((p) => ({
          id: p.id,
          number: p.pageNumber,
          text: p.textContent || "",
          imageUrl: p.imageUrl || "",
          compositedImageUrl: p.compositedImageUrl || undefined,
          overlay: p.overlay || undefined,
          narrationTimestamps: p.narrationTimestamps || undefined,
        }))
      );
    }
  }, [serverPages, hasLocalChanges]);

  useEffect(() => {
    if (bookDetails && !hasLocalChanges) {
      setLocalTitle(bookDetails.title || "Untitled Book");
      setLocalAuthor(bookDetails.author || "Unknown");
    }
  }, [bookDetails, hasLocalChanges]);

  // UI state
  const [activePage, setActivePage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio state
  const [soundscapeUrlInput, setSoundscapeUrlInput] = useState("");
  const [soundscapeScope, setSoundscapeScope] = useState<"current" | "range">("current");
  const [soundscapeRangeStart, setSoundscapeRangeStart] = useState(1);
  const [soundscapeRangeEnd, setSoundscapeRangeEnd] = useState(1);

  // Audio playback state
  const [isSoundscapePlaying, setIsSoundscapePlaying] = useState(false);
  const [isNarrationPlaying, setIsNarrationPlaying] = useState(false);
  const [soundscapeVolume, setSoundscapeVolume] = useState(0.6);
  const [narrationVolume, setNarrationVolume] = useState(0.85);
  const [generatingAllNarration, setGeneratingAllNarration] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });

  // Sync preview state
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [narrationProgress, setNarrationProgress] = useState(0);
  const [showSyncPreview, setShowSyncPreview] = useState(false);

  // Sound library state
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [libraryPreviewUrl, setLibraryPreviewUrl] = useState<string | null>(null);
  const [librarySearch, setLibrarySearch] = useState("");

  // Drag-and-drop state
  const [draggedSound, setDraggedSound] = useState<SoundAsset | null>(null);
  const [dropTargetPage, setDropTargetPage] = useState<number | null>(null);
  const [dropAssignment, setDropAssignment] = useState<DropAssignment | null>(null);
  const [dropRangeStart, setDropRangeStart] = useState(1);
  const [dropRangeEnd, setDropRangeEnd] = useState(1);
  const [dropScope, setDropScope] = useState<"single" | "range">("single");

  // Audio upload state
  const [audioUploadDragging, setAudioUploadDragging] = useState(false);

  // Refs
  const soundscapeRef = useRef<HTMLAudioElement>(null);
  const narrationRef = useRef<HTMLAudioElement>(null);
  const libraryPreviewRef = useRef<HTMLAudioElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Mutations
  const generateNarrationMutation = useGenerateNarration(bookIdParam);
  const assignAudioMutation = useAssignAudio(bookIdParam);
  const deleteAudioMutation = useDeleteAudioAssignment(bookIdParam);
  const savePagesMutation = useSavePages(bookIdParam);
  const updateBookMutation = useUpdateBook(bookIdParam);

  // Audio assignments for current page
  const { data: currentAssignments } = useAudioAssignments(bookIdParam, activePage);

  // Derived state
  const loading = bookLoading || pagesLoading;
  const saving = savePagesMutation.isPending || updateBookMutation.isPending;
  const generatingNarration = generateNarrationMutation.isPending;

  const activePageData = localPages.find((page) => page.number === activePage);
  const wordTimestamps = activePageData?.narrationTimestamps || [];

  // Build page ID map from server pages
  const pageIdMap = useMemo(() => {
    const map: Record<number, string> = {};
    serverPages?.forEach((p) => {
      map[p.pageNumber] = p.id;
    });
    return map;
  }, [serverPages]);

  // Get audio URLs for current page
  const narrationAssignment = currentAssignments?.find((a) => a.audioType === "narration");
  const soundscapeAssignment = currentAssignments?.find((a) => a.audioType === "soundscape");
  const narrationActiveUrl = narrationAssignment?.audioUrl || activePageData?.narrationTimestamps ?
    serverPages?.find(p => p.pageNumber === activePage)?.narrationUrl || "" : "";
  const soundscapeActiveUrl = soundscapeAssignment?.audioUrl || soundscapeUrlInput;

  // Build a map of all page audio assignments for badges
  const pageAudioMap = useMemo(() => {
    const map: Record<number, { hasNarration: boolean; hasSoundscape: boolean }> = {};
    if (!serverPages) return map;
    for (const p of serverPages) {
      map[p.pageNumber] = {
        hasNarration: !!p.narrationUrl || !!(p.assignments?.some(a => a.audioType === "narration")),
        hasSoundscape: !!(p.assignments?.some(a => a.audioType === "soundscape")),
      };
    }
    return map;
  }, [serverPages]);

  // Filtered library sounds
  const filteredLibrarySounds = useMemo(() => {
    if (!soundLibrary?.categories) return {};
    if (!librarySearch.trim()) return soundLibrary.categories;

    const query = librarySearch.toLowerCase();
    const filtered: Record<string, SoundAsset[]> = {};
    for (const [category, sounds] of Object.entries(soundLibrary.categories)) {
      const matches = sounds.filter(s =>
        s.name.toLowerCase().includes(query) || category.toLowerCase().includes(query)
      );
      if (matches.length > 0) filtered[category] = matches;
    }
    return filtered;
  }, [soundLibrary, librarySearch]);

  // Auto-select first category
  useEffect(() => {
    if (soundLibrary?.categories && !selectedCategory) {
      const cats = Object.keys(soundLibrary.categories);
      if (cats.length > 0) setSelectedCategory(cats[0]);
    }
  }, [soundLibrary, selectedCategory]);

  // Update range defaults when active page changes
  useEffect(() => {
    setSoundscapeRangeStart(activePage);
    setSoundscapeRangeEnd(activePage);
  }, [activePage]);

  useEffect(() => {
    if (soundscapeRef.current) soundscapeRef.current.volume = soundscapeVolume;
  }, [soundscapeVolume]);

  useEffect(() => {
    if (narrationRef.current) narrationRef.current.volume = narrationVolume;
  }, [narrationVolume]);

  // Calculate active word based on narration progress
  useEffect(() => {
    if (!isNarrationPlaying || wordTimestamps.length === 0) {
      if (!isNarrationPlaying) setActiveWordIndex(-1);
      return;
    }
    const currentTime = narrationProgress;
    let foundIndex = -1;
    for (let i = 0; i < wordTimestamps.length; i++) {
      if (currentTime < wordTimestamps[i].start) break;
      foundIndex = i;
    }
    setActiveWordIndex(foundIndex);
  }, [narrationProgress, wordTimestamps, isNarrationPlaying]);

  // ─── Keyboard Shortcuts ─────────────────────────────────────────
  const handleSaveRef = useRef<() => Promise<void>>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSaveRef.current?.();
        return;
      }

      if (isInput) return;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setActivePage((prev) => Math.max(1, prev - 1));
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setActivePage((prev) => Math.min(localPages.length, prev + 1));
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [localPages.length]);

  // ─── Audio Controls ─────────────────────────────────────────────
  const toggleSoundscape = async () => {
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
  };

  const toggleNarration = async () => {
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
  };

  // ─── Page Actions ───────────────────────────────────────────────
  const handleAddPage = () => {
    setLocalPages((prev) => [
      ...prev,
      { number: prev.length + 1, text: "", imageUrl: "" },
    ]);
    setHasLocalChanges(true);
  };

  const handleDeletePage = (pageNumber: number) => {
    if (localPages.length <= 1) return;
    const updated = localPages
      .filter((page) => page.number !== pageNumber)
      .map((page, index) => ({ ...page, number: index + 1 }));
    setLocalPages(updated);
    setHasLocalChanges(true);
    setActivePage((prev) => {
      if (prev === pageNumber) return Math.max(1, pageNumber - 1);
      return prev > pageNumber ? prev - 1 : prev;
    });
  };

  const setActiveImage = (imageUrl: string) => {
    setLocalPages((prev) =>
      prev.map((page) =>
        page.number === activePage ? { ...page, imageUrl } : page
      )
    );
    setHasLocalChanges(true);
  };

  const handleImageFile = async (file: File) => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setUploading(false);
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleImageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  };

  const triggerImagePicker = () => {
    imageInputRef.current?.click();
  };

  // ─── Audio Upload ───────────────────────────────────────────────
  const handleAudioUpload = async (file: File) => {
    setError(null);
    try {
      const result = await uploadAudioMutation.mutateAsync(file);
      setSoundscapeUrlInput(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload audio.");
    }
  };

  const handleAudioFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleAudioUpload(file);
  };

  const handleAudioDropZone = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setAudioUploadDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && (file.type.startsWith("audio/") || file.name.match(/\.(mp3|wav|ogg|flac|aac|m4a|webm)$/i))) {
      handleAudioUpload(file);
    }
  };

  // ─── Audio Assignment ───────────────────────────────────────────
  const getPageId = useCallback((pageNumber: number): string | undefined => {
    return pageIdMap[pageNumber];
  }, [pageIdMap]);

  const handleAssignAudio = async (
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
  };

  // ─── Drag-and-Drop Assignment ───────────────────────────────────
  const handleDragStart = (sound: SoundAsset) => {
    setDraggedSound(sound);
  };

  const handleDragEnd = () => {
    setDraggedSound(null);
    setDropTargetPage(null);
  };

  const handlePageDragOver = (e: React.DragEvent, pageNumber: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropTargetPage(pageNumber);
  };

  const handlePageDragLeave = () => {
    setDropTargetPage(null);
  };

  const handlePageDrop = (e: React.DragEvent, pageNumber: number) => {
    e.preventDefault();
    setDropTargetPage(null);

    if (draggedSound) {
      setDropAssignment({
        audioUrl: draggedSound.url,
        audioName: draggedSound.name.replace(/_/g, " ").replace(/\.[^.]+$/, ""),
        targetPage: pageNumber,
      });
      setDropRangeStart(pageNumber);
      setDropRangeEnd(pageNumber);
      setDropScope("single");
    }

    setDraggedSound(null);
  };

  const confirmDropAssignment = async () => {
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
  };

  // ─── Narration Generation ──────────────────────────────────────
  const handleGenerateNarration = async (pageNumber?: number) => {
    const targetPage = pageNumber ?? activePage;
    const pageData = localPages.find((p) => p.number === targetPage);
    if (!pageData?.text?.trim()) {
      setError("No text content to generate narration from. Add text via the overlay editor first.");
      return;
    }
    setError(null);
    try {
      const data = await generateNarrationMutation.mutateAsync({
        text: pageData.text,
        pageNumber: targetPage,
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
  };

  const handleGenerateAllNarration = async () => {
    const pagesWithText = localPages.filter((p) => p.text?.trim());
    if (pagesWithText.length === 0) {
      setError("No pages with text content. Add text via the overlay editor first.");
      return;
    }
    setGeneratingAllNarration(true);
    setGenerationProgress({ current: 0, total: pagesWithText.length });
    setError(null);
    try {
      for (let i = 0; i < pagesWithText.length; i++) {
        const page = pagesWithText[i];
        setGenerationProgress({ current: i + 1, total: pagesWithText.length });
        const data = await generateNarrationMutation.mutateAsync({
          text: page.text,
          pageNumber: page.number,
        });
        if (data.wordTimestamps && data.wordTimestamps.length > 0) {
          setLocalPages((prev) =>
            prev.map((p) =>
              p.number === page.number
                ? { ...p, narrationTimestamps: data.wordTimestamps }
                : p
            )
          );
        }
        const pageId = getPageId(page.number);
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate narration.");
    } finally {
      setGeneratingAllNarration(false);
      setGenerationProgress({ current: 0, total: 0 });
    }
  };

  // ─── Save / Publish ─────────────────────────────────────────────
  const handleSave = async () => {
    setError(null);
    try {
      await updateBookMutation.mutateAsync({
        title: localTitle.trim() || "Untitled Book",
        author: localAuthor,
      });
      await savePagesMutation.mutateAsync(
        localPages.map((page) => ({
          pageNumber: page.number,
          textContent: page.text,
          imageUrl: page.imageUrl || null,
        }))
      );
      setHasLocalChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    }
  };
  handleSaveRef.current = handleSave;

  const handlePublish = async () => {
    setError(null);
    try {
      await savePagesMutation.mutateAsync(
        localPages.map((page) => ({
          pageNumber: page.number,
          textContent: page.text,
          imageUrl: page.imageUrl || null,
        }))
      );
      await updateBookMutation.mutateAsync({
        title: localTitle.trim() || "Untitled Book",
        author: localAuthor,
        isPublished: true,
        processingStatus: "published",
      });
      setHasLocalChanges(false);
      router.push("/admin/books");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish.");
    }
  };

  // ─── Overlay Modal Handlers ──────────────────────────────────────
  const handleOverlaySave = async (overlayConfig: TextOverlayConfig) => {
    setOverlayEditorSaving(true);
    try {
      const res = await fetch(
        `/api/admin/books/${bookIdParam}/pages/${activePage}/overlay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overlay: overlayConfig }),
        }
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save overlay");
      }
      const data = await res.json();
      setLocalPages((prev) =>
        prev.map((p) =>
          p.number === activePage
            ? { ...p, overlay: data.overlay || overlayConfig, text: data.textContent || "", compositedImageUrl: undefined }
            : p
        )
      );
      if (overlayConfig.elements.length > 0) {
        setOverlayEditorCompositing(true);
        const compRes = await fetch(
          `/api/admin/books/${bookIdParam}/pages/${activePage}/composite`,
          { method: "POST" }
        );
        if (compRes.ok) {
          const compData = await compRes.json();
          setLocalPages((prev) =>
            prev.map((p) =>
              p.number === activePage
                ? { ...p, compositedImageUrl: compData.compositedImageUrl }
                : p
            )
          );
        }
        setOverlayEditorCompositing(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save overlay");
    } finally {
      setOverlayEditorSaving(false);
      setOverlayEditorCompositing(false);
    }
  };

  const handleOverlayComposite = async () => {
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
  };

  // Derive active assignments info for UI display
  const activeAssignments = useMemo(() => {
    if (!currentAssignments) return undefined;
    const narration = currentAssignments.find((a) => a.audioType === "narration");
    const soundscape = currentAssignments.find((a) => a.audioType === "soundscape");
    return {
      narration: narration ? {
        url: narration.audioUrl,
        scope: narration.scope,
        range: narration.scope === "range" && narration.rangeStart && narration.rangeEnd
          ? `${narration.rangeStart}-${narration.rangeEnd}`
          : "current",
      } : undefined,
      soundscape: soundscape ? {
        url: soundscape.audioUrl,
        scope: soundscape.scope,
        range: soundscape.scope === "range" && soundscape.rangeStart && soundscape.rangeEnd
          ? `${soundscape.rangeStart}-${soundscape.rangeEnd}`
          : "current",
      } : undefined,
    };
  }, [currentAssignments]);

  const hasImage = !!(activePageData?.imageUrl || activePageData?.compositedImageUrl);

  // ─── Library Preview Player ─────────────────────────────────────
  const toggleLibraryPreview = (url: string) => {
    if (libraryPreviewUrl === url && libraryPreviewRef.current && !libraryPreviewRef.current.paused) {
      libraryPreviewRef.current.pause();
      setLibraryPreviewUrl(null);
    } else {
      setLibraryPreviewUrl(url);
      setTimeout(() => {
        libraryPreviewRef.current?.play();
      }, 50);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <span className="text-slate-600">Loading book...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {soundscapeActiveUrl ? (
        <audio ref={soundscapeRef} src={soundscapeActiveUrl} loop onEnded={() => setIsSoundscapePlaying(false)} />
      ) : (
        <audio ref={soundscapeRef} />
      )}
      <audio
        ref={narrationRef}
        src={narrationActiveUrl || undefined}
        onTimeUpdate={(e) => setNarrationProgress(e.currentTarget.currentTime)}
        onEnded={() => { setIsNarrationPlaying(false); setActiveWordIndex(-1); }}
      />
      {libraryPreviewUrl && (
        <audio
          ref={libraryPreviewRef}
          src={libraryPreviewUrl}
          onEnded={() => setLibraryPreviewUrl(null)}
        />
      )}

      {/* ─── LEFT SIDEBAR: Page Navigator ─────────────────────────── */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)] z-20 shrink-0">
        <div className="h-16 flex items-center px-5 border-b border-slate-100">
          <a href="/admin/books" className="flex items-center gap-2 text-teal-600 hover:text-teal-700">
            <ArrowLeft className="w-4 h-4" />
            <BookOpen className="w-6 h-6" />
            <span className="font-bold tracking-tight text-slate-900">Storia</span>
          </a>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pages</div>
            {draggedSound && (
              <span className="text-[10px] text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full font-medium animate-pulse">
                Drop on a page
              </span>
            )}
          </div>

          {localPages.map((page) => {
            const isActive = page.number === activePage;
            const pageHasOverlay = page.overlay && page.overlay.elements.length > 0;
            const audioStatus = pageAudioMap[page.number];
            const isDropTarget = dropTargetPage === page.number;

            return (
              <div
                key={page.number}
                role="button"
                tabIndex={0}
                onClick={() => setActivePage(page.number)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActivePage(page.number); } }}
                onDragOver={(e) => handlePageDragOver(e, page.number)}
                onDragLeave={handlePageDragLeave}
                onDrop={(e) => handlePageDrop(e, page.number)}
                className="group relative block text-left w-full cursor-pointer"
              >
                <div className={`absolute -left-2 top-1/2 -translate-y-1/2 ${isActive ? "opacity-100 text-teal-400" : "opacity-0 text-slate-400"} group-hover:opacity-100`}>
                  <GripVertical className="w-4 h-4" />
                </div>
                {localPages.length > 1 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); handleDeletePage(page.number); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleDeletePage(page.number); } }}
                    className={`absolute right-0 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"} z-10`}
                    aria-label="Delete page"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <span className={`text-xs w-4 pt-1 ${isActive ? "font-bold text-teal-600" : "font-medium text-slate-400"}`}>
                    {page.number}
                  </span>
                  <div className={`w-full aspect-3/4 bg-white rounded-md overflow-hidden transition-all relative ${
                    isDropTarget
                      ? "border-2 border-teal-400 ring-2 ring-teal-200 shadow-lg scale-[1.02] bg-teal-50/30"
                      : isActive
                        ? "border-2 border-teal-500 ring-2 ring-teal-100 shadow-md"
                        : "border border-slate-200 shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5"
                  }`}>
                    {page.compositedImageUrl || page.imageUrl ? (
                      <img
                        src={page.compositedImageUrl || page.imageUrl}
                        alt={`Page ${page.number}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2">
                        <div className="w-full h-1/2 bg-slate-50 rounded-sm mb-2 flex items-center justify-center text-slate-300">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <div className="space-y-1 w-full">
                          <div className="h-1 w-full bg-slate-100 rounded-full"></div>
                          <div className="h-1 w-4/5 bg-slate-100 rounded-full"></div>
                        </div>
                      </div>
                    )}

                    {/* Drop target overlay */}
                    {isDropTarget && (
                      <div className="absolute inset-0 bg-teal-500/10 flex items-center justify-center pointer-events-none">
                        <div className="bg-teal-600 text-white text-[9px] px-2 py-1 rounded-full font-bold shadow-sm">
                          Drop here
                        </div>
                      </div>
                    )}

                    {/* Badges row */}
                    <div className="absolute top-1 right-1 flex items-center gap-0.5">
                      {page.compositedImageUrl ? (
                        <div className="bg-teal-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-medium">Overlay</div>
                      ) : pageHasOverlay ? (
                        <div className="bg-blue-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-medium">Text</div>
                      ) : null}
                    </div>

                    {/* Audio badges at bottom */}
                    {(audioStatus?.hasNarration || audioStatus?.hasSoundscape) && (
                      <div className="absolute bottom-1 left-1 flex items-center gap-0.5">
                        {audioStatus.hasNarration && (
                          <div className="bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center" title="Has narration">
                            <Mic className="w-2.5 h-2.5" />
                          </div>
                        )}
                        {audioStatus.hasSoundscape && (
                          <div className="bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center" title="Has soundscape">
                            <Music className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-100 bg-white">
          <button
            type="button"
            onClick={handleAddPage}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium rounded-lg border border-slate-200 border-dashed transition-all hover:border-teal-400 hover:text-teal-600 group"
          >
            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Add Page
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* HEADER */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 z-10 sticky top-0">
          <div className="flex-1 max-w-xl group relative">
            <input
              type="text"
              value={localTitle}
              onChange={(e) => { setLocalTitle(e.target.value); setHasLocalChanges(true); }}
              className="w-full text-lg font-semibold text-slate-800 bg-transparent border-2 border-transparent hover:border-slate-200 focus:border-teal-500 rounded-md px-2 py-1 transition-all outline-none truncate focus:bg-slate-50/50"
              placeholder="Untitled Book"
            />
            <Pencil className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
          </div>

          <div className="flex items-center gap-6">
            <div className="text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full">
              Page {activePage} <span className="text-slate-300 mx-1">/</span> {localPages.length}
            </div>
            <div className="h-6 w-px bg-slate-200"></div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Draft"}
              <span className="text-xs text-slate-300 font-normal hidden lg:inline">{navigator.platform?.includes("Mac") ? "⌘S" : "Ctrl+S"}</span>
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg font-medium shadow-sm shadow-teal-600/20 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Publish"}
              <UploadCloud className="w-5 h-5" />
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-rose-50 text-rose-700 border border-rose-200 px-6 py-3 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* CANVAS AREA */}
        <div className="flex-1 bg-slate-100/80 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center p-8">
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioFileChange} />

          {uploading ? (
            <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-teal-50 text-teal-500 rounded-full flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <h3 className="text-slate-700 font-medium text-lg mb-1">Uploading...</h3>
              <p className="text-sm text-slate-400">Please wait while your image uploads</p>
            </div>
          ) : hasImage ? (
            <div className="flex flex-col gap-4 w-full max-w-6xl">
              <div className="w-full bg-white rounded-lg shadow-sm border border-slate-100 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {activePageData?.text ? (
                    <div className="flex items-center gap-2 text-sm text-slate-600 min-w-0">
                      <Type className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="truncate">{activePageData.text.slice(0, 80)}{activePageData.text.length > 80 ? "..." : ""}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400 italic">No text overlay yet</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                    Inline text editor
                  </span>
                  <button
                    type="button"
                    onClick={triggerImagePicker}
                    className="bg-white text-slate-700 hover:text-teal-600 px-3 py-1.5 rounded-lg border border-slate-200 font-medium text-sm flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Change Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveImage("")}
                    className="bg-white text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 font-medium text-sm flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                </div>
              </div>

              <div
                className="w-full h-[70vh] rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleImageDrop}
              >
                <DraggableTextOverlayEditor
                  imageUrl={activePageData!.imageUrl}
                  overlay={activePageData!.overlay || null}
                  onSave={handleOverlaySave}
                  onComposite={handleOverlayComposite}
                  isSaving={overlayEditorSaving}
                  isCompositing={overlayEditorCompositing}
                />
              </div>
            </div>
          ) : (
            <div
              onClick={triggerImagePicker}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleImageDrop}
              className="w-full max-w-md aspect-3/4 bg-white rounded-xl shadow-lg border-2 border-dashed border-slate-300 hover:border-teal-400 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center text-slate-400 cursor-pointer"
            >
              <div className="w-16 h-16 bg-teal-50 text-teal-500 rounded-full flex items-center justify-center mb-4">
                <ImagePlus className="w-8 h-8" />
              </div>
              <h3 className="text-slate-700 font-medium text-lg mb-1">Add an Illustration</h3>
              <p className="text-sm text-slate-400 mb-4">Click to upload or drag & drop</p>
              <span className="text-xs text-slate-300 px-2 py-1 bg-slate-100 rounded">Supports JPG, PNG, GIF</span>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="h-20 bg-white border-t border-slate-200 flex items-center justify-between px-8 absolute bottom-0 w-full z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2 w-1/3">
            <div className="flex items-center gap-1.5 text-teal-600 bg-teal-50 px-3 py-1.5 rounded-full text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Editing
            </div>
            <span className="text-xs text-slate-400 ml-2">
              {hasLocalChanges ? "Unsaved changes" : "All saved"}
            </span>
          </div>

          <div className="flex items-center gap-4 w-1/3 justify-center">
            <button
              type="button"
              onClick={() => setActivePage((prev) => Math.max(1, prev - 1))}
              className="p-3 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all hover:-translate-x-1 active:scale-95 disabled:opacity-30"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-lg font-serif text-slate-800 min-w-12 text-center">{activePage}</span>
            <button
              type="button"
              onClick={() => setActivePage((prev) => Math.min(localPages.length, prev + 1))}
              className="p-3 rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition-all hover:translate-x-1 active:scale-95"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <div className="w-1/3 flex justify-end gap-4">
            <button className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-2 text-sm font-medium">
              <Settings className="w-4.5 h-4.5" />
              Settings
            </button>
          </div>
        </div>
      </main>

      {/* ─── RIGHT SIDEBAR: Audio & Sound Library ─────────────────── */}
      <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.05)] z-20 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 text-slate-800">
            <Headphones className="w-6 h-6 text-amber-500" />
            <span className="font-bold tracking-tight">Audio</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── Voice Narration ──────────────────────────────────── */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Voice Narration</h4>

            <div className="bg-linear-to-br from-orange-50 to-yellow-50 rounded-xl p-4 border border-orange-200 shadow-sm space-y-4">
              {(activeAssignments?.narration?.url || narrationActiveUrl) ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs font-semibold text-green-700">Assigned</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const pageId = getPageId(activePage);
                        if (pageId) {
                          try {
                            await deleteAudioMutation.mutateAsync({ pageId, audioType: "narration" });
                            setLocalPages((prev) => prev.map((p) => p.number === activePage ? { ...p, narrationTimestamps: undefined } : p));
                          } catch (err) { setError(err instanceof Error ? err.message : "Failed to remove"); }
                        }
                      }}
                      disabled={deleteAudioMutation.isPending}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                  <span className="text-xs text-slate-500">No narration for this page</span>
                </div>
              )}

              {narrationActiveUrl && (
                <div className="flex items-center gap-3">
                  <button type="button" onClick={toggleNarration} className="w-8 h-8 flex items-center justify-center bg-orange-600 text-white rounded-full hover:bg-orange-700 shadow-sm">
                    {isNarrationPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                  </button>
                  <input
                    type="range" min="0" max="100"
                    value={Math.round(narrationVolume * 100)}
                    onChange={(e) => setNarrationVolume(Number(e.target.value) / 100)}
                    className="flex-1 h-1 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                  />
                </div>
              )}

              {/* AI Generate */}
              <div className="border-t border-orange-200/60 pt-3 space-y-3">
                <span className="text-xs font-semibold text-orange-700 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5" />
                  Generate with AI
                </span>
                {!activePageData?.text?.trim() && (
                  <p className="text-[10px] text-orange-600/70 italic">
                    Add text overlay first to generate narration.
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleGenerateNarration()}
                    disabled={generatingNarration || generatingAllNarration || !activePageData?.text?.trim()}
                    className="flex-1 flex items-center justify-center gap-2 rounded-md bg-linear-to-r from-orange-500 to-amber-500 text-white text-xs font-semibold py-2.5 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {generatingNarration ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating...</> : <><Wand2 className="w-3.5 h-3.5" />This Page</>}
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateAllNarration}
                    disabled={generatingNarration || generatingAllNarration}
                    className="flex items-center justify-center gap-2 rounded-md bg-linear-to-r from-purple-500 to-indigo-500 text-white text-xs font-semibold py-2.5 px-3 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {generatingAllNarration ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{generationProgress.current}/{generationProgress.total}</> : <><Sparkles className="w-3.5 h-3.5" />All</>}
                  </button>
                </div>
              </div>

              {/* Sync preview */}
              {wordTimestamps.length > 0 && (
                <div className="border-t border-orange-200/60 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-orange-700 flex items-center gap-1.5">
                      <PlayCircle className="w-3.5 h-3.5" /> Sync Preview
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSyncPreview(!showSyncPreview)}
                      className="text-[10px] text-orange-600 hover:text-orange-700 bg-orange-50 px-2 py-1 rounded-full border border-orange-200"
                    >
                      {showSyncPreview ? "Hide" : "Show"}
                    </button>
                  </div>
                  {showSyncPreview && (
                    <div className="bg-white/70 rounded-lg p-3 border border-orange-200/50">
                      <div className="flex items-center gap-2 mb-3">
                        <button type="button" onClick={toggleNarration} className="w-7 h-7 flex items-center justify-center bg-orange-600 text-white rounded-full">
                          {isNarrationPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                        </button>
                        <span className="text-[10px] text-slate-500">{isNarrationPlaying ? "Playing..." : "Click to preview"}</span>
                      </div>
                      <div className="max-h-32 overflow-y-auto">
                        <p className="text-sm leading-relaxed text-slate-700 font-serif">
                          {wordTimestamps.map((wd, i) => (
                            <span
                              key={i}
                              className={`transition-all duration-150 ${i === activeWordIndex && isNarrationPlaying ? "bg-orange-300 text-orange-900 rounded px-0.5 font-semibold" : ""}`}
                            >
                              {wd.word}{" "}
                            </span>
                          ))}
                        </p>
                      </div>
                      <div className="mt-2 text-[10px] text-slate-500">{wordTimestamps.length} words synced</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* ── Ambient Soundscape ───────────────────────────────── */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ambient Soundscape</h4>

            <div className="bg-linear-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100 shadow-sm space-y-4">
              {activeAssignments?.soundscape ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-semibold text-green-700">Assigned</span>
                    {activeAssignments.soundscape.scope === "range" && (
                      <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                        Pages {activeAssignments.soundscape.range}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      const pageId = getPageId(activePage);
                      if (pageId) {
                        try {
                          await deleteAudioMutation.mutateAsync({ pageId, audioType: "soundscape" });
                          setSoundscapeUrlInput("");
                        } catch (err) { setError(err instanceof Error ? err.message : "Failed to remove"); }
                      }
                    }}
                    disabled={deleteAudioMutation.isPending}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded"
                  >
                    Remove
                  </button>
                </div>
              ) : null}

              {soundscapeActiveUrl && (
                <div className="flex items-center gap-3">
                  <button type="button" onClick={toggleSoundscape} className="w-8 h-8 flex items-center justify-center bg-amber-500 text-white rounded-full hover:bg-amber-600 shadow-sm">
                    {isSoundscapePlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                  </button>
                  <input
                    type="range" min="0" max="100"
                    value={Math.round(soundscapeVolume * 100)}
                    onChange={(e) => setSoundscapeVolume(Number(e.target.value) / 100)}
                    className="flex-1 h-1 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              )}

              {/* Upload Audio */}
              <div
                className={`border-t border-amber-100 pt-3 space-y-3`}
              >
                <span className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Audio
                </span>
                <div
                  onDragOver={(e) => { e.preventDefault(); setAudioUploadDragging(true); }}
                  onDragLeave={() => setAudioUploadDragging(false)}
                  onDrop={handleAudioDropZone}
                  onClick={() => audioInputRef.current?.click()}
                  className={`rounded-lg border-2 border-dashed p-4 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                    audioUploadDragging
                      ? "border-amber-400 bg-amber-50"
                      : "border-amber-200 hover:border-amber-400 hover:bg-amber-50/50"
                  }`}
                >
                  {uploadAudioMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                      <span className="text-[10px] text-amber-600">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <FileAudio className="w-5 h-5 text-amber-400" />
                      <span className="text-[10px] text-amber-600 text-center">
                        Drop audio file or click to browse
                      </span>
                      <span className="text-[9px] text-amber-400">MP3, WAV, OGG, FLAC &bull; Max 50MB</span>
                    </>
                  )}
                </div>
              </div>

              {/* URL input */}
              <div className="space-y-3 border-t border-amber-100 pt-3">
                <span className="text-xs font-semibold text-amber-700">Or Paste URL</span>
                <input
                  value={soundscapeUrlInput}
                  onChange={(e) => setSoundscapeUrlInput(e.target.value)}
                  placeholder="Paste soundscape URL"
                  className="w-full rounded-md border border-amber-200 bg-white/70 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setSoundscapeScope("current")} className={`px-2.5 py-1 rounded text-[10px] font-semibold border ${soundscapeScope === "current" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-amber-700 border-amber-200"}`}>
                    Current Page
                  </button>
                  <button type="button" onClick={() => setSoundscapeScope("range")} className={`px-2.5 py-1 rounded text-[10px] font-semibold border ${soundscapeScope === "range" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-amber-700 border-amber-200"}`}>
                    Range
                  </button>
                  {soundscapeScope === "range" && (
                    <div className="flex items-center gap-2 text-[10px] text-amber-700">
                      <input type="number" min={1} max={localPages.length} value={soundscapeRangeStart} onChange={(e) => setSoundscapeRangeStart(Number(e.target.value))} className="w-14 rounded border border-amber-200 bg-white px-2 py-1 text-xs" />
                      <span>to</span>
                      <input type="number" min={soundscapeRangeStart} max={localPages.length} value={soundscapeRangeEnd} onChange={(e) => setSoundscapeRangeEnd(Number(e.target.value))} className="w-14 rounded border border-amber-200 bg-white px-2 py-1 text-xs" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleAssignAudio("soundscape", soundscapeUrlInput, soundscapeScope, soundscapeRangeStart, soundscapeRangeEnd)}
                  className="w-full rounded-md bg-amber-500 text-white text-xs font-semibold py-2 hover:bg-amber-600"
                >
                  Save Assignment
                </button>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* ── Sound Library ────────────────────────────────────── */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setLibraryOpen(!libraryOpen)}
              className="flex items-center justify-between w-full group"
            >
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5" />
                Sound Library
              </h4>
              {libraryOpen ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {libraryOpen && (
              <div className="bg-linear-to-br from-slate-50 to-slate-100/50 rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
                {/* Search */}
                <input
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Search sounds..."
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-300"
                />

                {libraryLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  </div>
                ) : Object.keys(filteredLibrarySounds).length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    {librarySearch ? "No sounds match your search" : "No sounds in library"}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Category pills */}
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(filteredLibrarySounds).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition border ${
                            selectedCategory === cat
                              ? "bg-teal-600 text-white border-teal-600"
                              : "bg-white text-slate-500 border-slate-200 hover:border-teal-300"
                          }`}
                        >
                          {cat} ({filteredLibrarySounds[cat].length})
                        </button>
                      ))}
                    </div>

                    {/* Sound list */}
                    {selectedCategory && filteredLibrarySounds[selectedCategory] && (
                      <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        <p className="text-[10px] text-slate-400 italic">Drag a sound onto a page thumbnail to assign it</p>
                        {filteredLibrarySounds[selectedCategory].map((sound) => (
                          <div
                            key={`${selectedCategory}-${sound.name}`}
                            draggable
                            onDragStart={() => handleDragStart({ ...sound, category: selectedCategory! })}
                            onDragEnd={handleDragEnd}
                            className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white hover:border-teal-300 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all group"
                          >
                            <GripHorizontal className="w-3 h-3 text-slate-300 group-hover:text-teal-400 shrink-0" />
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleLibraryPreview(sound.url); }}
                              className="w-6 h-6 flex items-center justify-center bg-teal-50 text-teal-600 rounded-full hover:bg-teal-100 shrink-0"
                            >
                              {libraryPreviewUrl === sound.url ? (
                                <Pause className="w-3 h-3" />
                              ) : (
                                <Play className="w-3 h-3 ml-0.5" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-medium text-slate-700 truncate">
                                {sound.name.replace(/_/g, " ").replace(/\.[^.]+$/, "")}
                              </div>
                              {sound.size && (
                                <div className="text-[9px] text-slate-400">
                                  {(sound.size / 1024 / 1024).toFixed(1)} MB
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSoundscapeUrlInput(sound.url);
                              }}
                              className="text-[9px] text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 px-1.5 py-0.5 rounded font-semibold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Use this URL in the assignment field"
                            >
                              Use
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ─── Drop Assignment Dialog (overlay) ─────────────────────── */}
      {dropAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-96 space-y-5">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Music className="w-5 h-5 text-teal-500" />
                Assign Soundscape
              </h3>
              <p className="text-sm text-slate-500">
                <span className="font-medium text-slate-700">{dropAssignment.audioName}</span>
                {" → "}
                Page {dropAssignment.targetPage}
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-600">Scope</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDropScope("single")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition ${
                    dropScope === "single"
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-teal-300"
                  }`}
                >
                  This Page Only
                </button>
                <button
                  type="button"
                  onClick={() => setDropScope("range")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition ${
                    dropScope === "range"
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-teal-300"
                  }`}
                >
                  Page Range
                </button>
              </div>

              {dropScope === "range" && (
                <div className="flex items-center gap-3 pt-1">
                  <label className="text-xs text-slate-500">From</label>
                  <input
                    type="number"
                    min={1}
                    max={localPages.length}
                    value={dropRangeStart}
                    onChange={(e) => setDropRangeStart(Number(e.target.value))}
                    className="w-20 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                  <label className="text-xs text-slate-500">to</label>
                  <input
                    type="number"
                    min={dropRangeStart}
                    max={localPages.length}
                    value={dropRangeEnd}
                    onChange={(e) => setDropRangeEnd(Number(e.target.value))}
                    className="w-20 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDropAssignment(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDropAssignment}
                disabled={assignAudioMutation.isPending}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 shadow-sm disabled:opacity-60"
              >
                {assignAudioMutation.isPending ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
