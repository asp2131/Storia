"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Image from "next/image";
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
  Bold,
  Italic,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Settings,
  Headphones,
  X,
  Pause,
  Volume2,
  Layers,
  Info,
  Mic,
  ArrowLeftRight,
  Play,
  Volume1,
  ChevronRight,
  CloudRain,
  Music,
  Upload,
  Loader2,
  Wand2,
  Sparkles,
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

type LocalPageData = {
  id?: string;
  number: number;
  text: string;
  imageUrl: string;
  narrationTimestamps?: WordTimestamp[];
};

export default function BookEditor() {
  const router = useRouter();
  const params = useParams();
  const bookIdParam = params.id as string;

  // React Query hooks
  const { data: bookDetails, isLoading: bookLoading } = useBookDetails(bookIdParam);
  const { data: serverPages, isLoading: pagesLoading } = useEditorPages(bookIdParam);

  // Local state for edits (not yet saved to server)
  const [localPages, setLocalPages] = useState<LocalPageData[]>([]);
  const [localTitle, setLocalTitle] = useState("");
  const [localAuthor, setLocalAuthor] = useState("");
  const [hasLocalChanges, setHasLocalChanges] = useState(false);

  // Sync server data to local state when loaded
  useEffect(() => {
    if (serverPages && serverPages.length > 0 && !hasLocalChanges) {
      setLocalPages(
        serverPages.map((p) => ({
          id: p.id,
          number: p.pageNumber,
          text: p.textContent || "",
          imageUrl: p.imageUrl || "",
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

  // Audio URL inputs (for manual entry)
  const [narrationUrlInput, setNarrationUrlInput] = useState("");
  const [soundscapeUrlInput, setSoundscapeUrlInput] = useState("");
  const [narrationScope, setNarrationScope] = useState<"current" | "range">("current");
  const [soundscapeScope, setSoundscapeScope] = useState<"current" | "range">("current");
  const [narrationRangeStart, setNarrationRangeStart] = useState(1);
  const [narrationRangeEnd, setNarrationRangeEnd] = useState(1);
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

  // Refs
  const soundscapeRef = useRef<HTMLAudioElement>(null);
  const narrationRef = useRef<HTMLAudioElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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

  // Update range defaults when active page changes
  useEffect(() => {
    setNarrationRangeStart(activePage);
    setNarrationRangeEnd(activePage);
    setSoundscapeRangeStart(activePage);
    setSoundscapeRangeEnd(activePage);
  }, [activePage]);

  useEffect(() => {
    if (soundscapeRef.current) {
      soundscapeRef.current.volume = soundscapeVolume;
    }
  }, [soundscapeVolume]);

  useEffect(() => {
    if (narrationRef.current) {
      narrationRef.current.volume = narrationVolume;
    }
  }, [narrationVolume]);


  // Calculate active word based on narration progress
  useEffect(() => {
    if (!isNarrationPlaying || wordTimestamps.length === 0) {
      if (!isNarrationPlaying) setActiveWordIndex(-1);
      return;
    }

    const currentTime = narrationProgress;

    // Debug: Log timestamps structure on first run
    if (currentTime < 0.1 && wordTimestamps.length > 0) {
      console.log("[Editor] First 5 timestamps:", wordTimestamps.slice(0, 5));
      console.log("[Editor] Last timestamp:", wordTimestamps[wordTimestamps.length - 1]);
    }

    // Find the word that should be highlighted at currentTime
    let foundIndex = -1;

    for (let i = 0; i < wordTimestamps.length; i++) {
      const wordData = wordTimestamps[i];

      // If we haven't reached this word's start time yet, stop
      if (currentTime < wordData.start) {
        break;
      }

      // This word has started, so it's a candidate
      foundIndex = i;
    }

    // Debug: Log every ~0.5 seconds
    if (Math.floor(currentTime * 2) !== Math.floor((currentTime - 0.1) * 2)) {
      const currentWord = foundIndex >= 0 ? wordTimestamps[foundIndex] : null;
      console.log(`[Editor] Time: ${currentTime.toFixed(2)}s | Word ${foundIndex}: "${currentWord?.word}" (${currentWord?.start?.toFixed(2)}-${currentWord?.end?.toFixed(2)})`);
    }

    setActiveWordIndex(foundIndex);
  }, [narrationProgress, wordTimestamps, isNarrationPlaying]);

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
      .map((page, index) => ({
        ...page,
        number: index + 1,
      }));
    setLocalPages(updated);
    setHasLocalChanges(true);
    setActivePage((prev) => {
      if (prev === pageNumber) {
        return Math.max(1, pageNumber - 1);
      }
      return prev > pageNumber ? prev - 1 : prev;
    });
  };

  const handleTextChange = (value: string) => {
    setLocalPages((prev) =>
      prev.map((page) =>
        page.number === activePage ? { ...page, text: value } : page
      )
    );
    setHasLocalChanges(true);
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

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
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

  // Helper to ensure pages exist and get page ID
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

  const handleGenerateNarration = async (pageNumber?: number) => {
    const targetPage = pageNumber ?? activePage;
    const pageData = localPages.find((p) => p.number === targetPage);

    if (!pageData?.text?.trim()) {
      setError("No text content to generate narration from.");
      return;
    }

    setError(null);

    try {
      const data = await generateNarrationMutation.mutateAsync({
        text: pageData.text,
        pageNumber: targetPage,
      });

      // Update local state with timestamps
      if (data.wordTimestamps && data.wordTimestamps.length > 0) {
        console.log(`[Editor] Received ${data.wordTimestamps.length} word timestamps`);
        setLocalPages((prev) =>
          prev.map((p) =>
            p.number === targetPage
              ? { ...p, narrationTimestamps: data.wordTimestamps }
              : p
          )
        );
      } else {
        console.warn(`[Editor] No word timestamps received from API. Alignment quality: ${data.alignmentQuality}`);
      }

      // Auto-assign the generated narration to the current page
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
      setError("No pages with text content.");
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

        // Update local state with timestamps
        if (data.wordTimestamps && data.wordTimestamps.length > 0) {
          setLocalPages((prev) =>
            prev.map((p) =>
              p.number === page.number
                ? { ...p, narrationTimestamps: data.wordTimestamps }
                : p
            )
          );
        }

        // Assign the audio if page exists
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

  const handleSave = async () => {
    setError(null);

    try {
      // Update book metadata
      await updateBookMutation.mutateAsync({
        title: localTitle.trim() || "Untitled Book",
        author: localAuthor,
      });

      // Save all page content
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

  const handlePublish = async () => {
    setError(null);

    try {
      // Save all page content first
      await savePagesMutation.mutateAsync(
        localPages.map((page) => ({
          pageNumber: page.number,
          textContent: page.text,
          imageUrl: page.imageUrl || null,
        }))
      );

      // Update the book to be published
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
        <audio
          ref={soundscapeRef}
          src={soundscapeActiveUrl}
          loop
          onEnded={() => setIsSoundscapePlaying(false)}
        />
      ) : (
        <audio ref={soundscapeRef} />
      )}
      <audio
        ref={narrationRef}
        src={narrationActiveUrl || undefined}
        onTimeUpdate={(e) => setNarrationProgress(e.currentTarget.currentTime)}
        onEnded={() => {
          setIsNarrationPlaying(false);
          setActiveWordIndex(-1);
        }}
      />
      {/* LEFT SIDEBAR: Navigator */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)] z-20 shrink-0">
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-5 border-b border-slate-100">
          <a
            href="/admin/books"
            className="flex items-center gap-2 text-teal-600 hover:text-teal-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <BookOpen className="w-6 h-6" />
            <span className="font-bold tracking-tight text-slate-900">
              Storia
            </span>
          </a>
        </div>

        {/* Page List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Pages
          </div>

          {localPages.map((page) => {
            const isActive = page.number === activePage;
            return (
              <div
                key={page.number}
                role="button"
                tabIndex={0}
                onClick={() => setActivePage(page.number)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActivePage(page.number);
                  }
                }}
                className="group relative block text-left w-full cursor-pointer"
              >
                <div
                  className={`absolute -left-2 top-1/2 -translate-y-1/2 ${
                    isActive
                      ? "opacity-100 text-teal-400"
                      : "opacity-0 text-slate-400"
                  } group-hover:opacity-100`}
                >
                  <GripVertical className="w-4 h-4" />
                </div>
                {localPages.length > 1 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeletePage(page.number);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDeletePage(page.number);
                      }
                    }}
                    className={`absolute right-0 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition ${
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                    aria-label="Delete page"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <span
                    className={`text-xs w-4 pt-1 ${
                      isActive
                        ? "font-bold text-teal-600"
                        : "font-medium text-slate-400"
                    }`}
                  >
                    {page.number}
                  </span>
                  <div
                    className={`w-full aspect-3/4 bg-white rounded-md overflow-hidden p-2 transition-all ${
                      isActive
                        ? "border-2 border-teal-500 ring-2 ring-teal-100 shadow-md"
                        : "border border-slate-200 shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="w-full h-1/2 bg-slate-50 rounded-sm mb-2 flex items-center justify-center text-slate-300">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-1 w-full bg-slate-100 rounded-full"></div>
                      <div className="h-1 w-4/5 bg-slate-100 rounded-full"></div>
                      <div className="h-1 w-5/6 bg-slate-100 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Page Button */}
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

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* HEADER */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 z-10 sticky top-0">
          {/* Book Title Ghost Input */}
          <div className="flex-1 max-w-xl group relative">
            <label htmlFor="book-title" className="sr-only">
              Book Title
            </label>
            <input
              type="text"
              id="book-title"
              value={localTitle}
              onChange={(event) => { setLocalTitle(event.target.value); setHasLocalChanges(true); }}
              className="w-full text-lg font-semibold text-slate-800 bg-transparent border-2 border-transparent hover:border-slate-200 focus:border-teal-500 rounded-md px-2 py-1 transition-all outline-none truncate focus:bg-slate-50/50"
              placeholder="Untitled Book"
            />
            <Pencil className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-6">
            <div className="text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full">
              Page {activePage} <span className="text-slate-300 mx-1">/</span>{" "}
              {localPages.length}
            </div>

            <div className="h-6 w-px bg-slate-200"></div>

            <button className="flex items-center gap-2 text-slate-600 hover:text-teal-600 font-medium transition-colors">
              <PlayCircle className="w-5 h-5" />
              Preview
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Draft"}
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
          <div className="bg-rose-50 text-rose-700 border border-rose-200 px-6 py-3 text-sm">
            {error}
          </div>
        )}

        {/* CANVAS AREA */}
        <div className="flex-1 bg-slate-50 overflow-y-auto overflow-x-hidden flex flex-col items-center py-10 px-4">
          {/* The Page (Card) */}
          <div className="w-full max-w-3xl aspect-3/4 bg-white rounded-xl shadow-lg border border-slate-100 flex flex-col overflow-hidden relative group/page">
            {/* SECTION 1: Illustration Placeholder (Top) */}
            <div className="h-[55%] bg-slate-50/50 relative p-6 flex flex-col border-b border-slate-100">
              {/* The Drop Zone Container */}
              <div
                onClick={triggerImagePicker}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleImageDrop}
                className="w-full h-full border-2 border-dashed border-slate-300 rounded-xl bg-white hover:bg-slate-50 transition-colors flex flex-col items-center justify-center text-slate-400 cursor-pointer relative group/image overflow-hidden"
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />

                {uploading ? (
                  <div className="flex flex-col items-center text-center p-6">
                    <div className="w-16 h-16 bg-teal-50 text-teal-500 rounded-full flex items-center justify-center mb-4">
                      <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                    <h3 className="text-slate-700 font-medium text-lg mb-1">
                      Uploading...
                    </h3>
                    <p className="text-sm text-slate-400">
                      Please wait while your image uploads
                    </p>
                  </div>
                ) : activePageData?.imageUrl ? (
                  <>
                    <Image
                      src={activePageData.imageUrl}
                      alt="Page illustration"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 hover:opacity-100 transition-all flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          triggerImagePicker();
                        }}
                        className="bg-white text-slate-700 hover:text-teal-600 px-4 py-2 rounded-lg shadow-lg font-medium text-sm flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveImage("");
                        }}
                        className="bg-white/90 text-red-500 hover:bg-white px-4 py-2 rounded-lg shadow-lg font-medium text-sm flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-center p-6 transition-opacity group-hover/image:opacity-100">
                    <div className="w-16 h-16 bg-teal-50 text-teal-500 rounded-full flex items-center justify-center mb-4">
                      <ImagePlus className="w-8 h-8" />
                    </div>
                    <h3 className="text-slate-700 font-medium text-lg mb-1">
                      Add an Illustration
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">
                      Click to upload or drag & drop
                    </p>
                    <span className="text-xs text-slate-300 px-2 py-1 bg-slate-100 rounded">
                      Supports JPG, PNG, GIF
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2: Text Area (Bottom) */}
            <div className="flex-1 p-10 bg-white relative">
              <textarea
                value={activePageData?.text ?? ""}
                onChange={(event) => handleTextChange(event.target.value)}
                className="w-full h-full resize-none outline-none border-none text-xl leading-relaxed text-slate-700 placeholder:text-slate-300 font-serif bg-transparent"
                placeholder="Start writing your story here... Once upon a time, in a land far away..."
              ></textarea>

              {/* Floating Format Toolbar */}
              <div className="absolute bottom-6 right-6 flex gap-1 opacity-0 group-focus-within/page:opacity-100 transition-opacity duration-500">
                <button
                  className="p-2 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                  title="Bold"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  className="p-2 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                  title="Italic"
                >
                  <Italic className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Spacer for scrolling */}
          <div className="h-24 w-full"></div>
        </div>

        {/* FOOTER CONTROLS */}
        <div className="h-20 bg-white border-t border-slate-200 flex items-center justify-between px-8 absolute bottom-0 w-full z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
          {/* Autosave Status */}
          <div className="flex items-center gap-2 w-1/3">
            <div className="flex items-center gap-1.5 text-teal-600 bg-teal-50 px-3 py-1.5 rounded-full text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Editing
            </div>
            <span className="text-xs text-slate-400 ml-2">
              {error ? error : "Changes not saved yet"}
            </span>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-4 w-1/3 justify-center">
            <button
              type="button"
              onClick={() => setActivePage((prev) => Math.max(1, prev - 1))}
              className="p-3 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all hover:-translate-x-1 active:scale-95 disabled:opacity-30"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <span className="text-lg font-serif text-slate-800 min-w-12 text-center">
              {activePage}
            </span>

            <button
              type="button"
              onClick={() =>
                setActivePage((prev) => Math.min(localPages.length, prev + 1))
              }
              className="p-3 rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition-all hover:translate-x-1 active:scale-95"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Empty right side for balance or auxiliary tools */}
          <div className="w-1/3 flex justify-end gap-4">
            <button className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-2 text-sm font-medium">
              <Settings className="w-4.5 h-4.5" />
              Settings
            </button>
          </div>
        </div>
      </main>

      {/* RIGHT SIDEBAR: Audio Management */}
      <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.05)] z-20 shrink-0">
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 text-slate-800">
            <Headphones className="w-6 h-6 text-amber-500" />
            <span className="font-bold tracking-tight">Audio Manager</span>
          </div>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section: Applied Soundscape */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Ambient Soundscape
              </h4>
              <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium border border-green-100">
                Active
              </span>
            </div>

            {/* Active Audio Card */}
            <div className="bg-linear-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100 shadow-sm relative group">
              {/* Top Row: Info + Remove */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 leading-tight">
                    Forest Ambience
                  </h3>
                  <span className="text-xs text-amber-600/80 font-medium">
                    00:45 - Looping
                  </span>
                </div>
                <button
                  onClick={async () => {
                    const pageId = getPageId(activePage);
                    if (pageId) {
                      try {
                        await deleteAudioMutation.mutateAsync({
                          pageId,
                          audioType: "soundscape",
                        });
                        setSoundscapeUrlInput("");
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to remove");
                      }
                    }
                  }}
                  disabled={deleteAudioMutation.isPending}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1 -mr-1 rounded hover:bg-white/50 disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Waveform Visualization */}
              <div className="flex items-center justify-between gap-0.5 h-6 mb-4 px-1 opacity-80">
                {[3, 2, 4, 2, 5, 3, 2, 4, 3, 5, 2, 4, 3, 2, 4].map((h, i) => (
                  <div
                    key={i}
                    className={`w-1 bg-amber-400 rounded-full ${
                      h === 2
                        ? "h-2 bg-amber-300"
                        : h === 3
                        ? "h-3"
                        : h === 4
                        ? "h-4"
                        : "h-5 bg-amber-500"
                    }`}
                  ></div>
                ))}
              </div>

              {/* Controls: Play + Volume */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSoundscape}
                  className="w-8 h-8 flex items-center justify-center bg-amber-500 text-white rounded-full hover:bg-amber-600 shadow-sm transition-transform active:scale-95"
                >
                  {isSoundscapePlaying ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 ml-0.5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(soundscapeVolume * 100)}
                  onChange={(event) =>
                    setSoundscapeVolume(Number(event.target.value) / 100)
                  }
                  className="w-full h-1 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <Volume2 className="w-3 h-3 text-amber-400" />
              </div>

              {/* Page Range Assignment */}
              <div className="pt-2 mt-3 border-t border-amber-100">
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-white/60 rounded text-xs font-medium text-amber-700 border border-amber-100/50 shadow-sm">
                    <Layers className="w-2.5 h-2.5" />
                    {activeAssignments?.soundscape?.range === "current"
                      ? "Current Page"
                      : activeAssignments?.soundscape?.range
                      ? `Pages ${activeAssignments.soundscape.range}`
                      : "No range set"}
                  </div>
                </div>
              </div>

              {/* Assignment Controls */}
              <div className="mt-4 space-y-3 border-t border-amber-100 pt-4">
                <div className="flex items-center justify-between text-xs text-amber-700">
                  <span className="font-semibold">Assign Soundscape</span>
                  {activeAssignments?.soundscape && (
                    <span className="px-2 py-0.5 rounded-full bg-white/70 border border-amber-200 text-amber-600">
                      Assigned ({activeAssignments.soundscape.range})
                    </span>
                  )}
                </div>
                <input
                  value={soundscapeUrlInput}
                  onChange={(event) => setSoundscapeUrlInput(event.target.value)}
                  placeholder="Paste soundscape URL"
                  className="w-full rounded-md border border-amber-200 bg-white/70 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSoundscapeScope("current")}
                    className={`px-2.5 py-1 rounded text-[10px] font-semibold border ${
                      soundscapeScope === "current"
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-white text-amber-700 border-amber-200"
                    }`}
                  >
                    Current Page
                  </button>
                  <button
                    type="button"
                    onClick={() => setSoundscapeScope("range")}
                    className={`px-2.5 py-1 rounded text-[10px] font-semibold border ${
                      soundscapeScope === "range"
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-white text-amber-700 border-amber-200"
                    }`}
                  >
                    Range
                  </button>
                  {soundscapeScope === "range" && (
                    <div className="flex items-center gap-2 text-[10px] text-amber-700">
                      <input
                        type="number"
                        min={1}
                        max={localPages.length}
                        value={soundscapeRangeStart}
                        onChange={(event) =>
                          setSoundscapeRangeStart(Number(event.target.value))
                        }
                        className="w-14 rounded border border-amber-200 bg-white px-2 py-1 text-xs"
                      />
                      <span>to</span>
                      <input
                        type="number"
                        min={soundscapeRangeStart}
                        max={localPages.length}
                        value={soundscapeRangeEnd}
                        onChange={(event) =>
                          setSoundscapeRangeEnd(Number(event.target.value))
                        }
                        className="w-14 rounded border border-amber-200 bg-white px-2 py-1 text-xs"
                      />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleAssignAudio(
                      "soundscape",
                      soundscapeUrlInput,
                      soundscapeScope,
                      soundscapeRangeStart,
                      soundscapeRangeEnd
                    )
                  }
                  className="w-full rounded-md bg-amber-500 text-white text-xs font-semibold py-2 hover:bg-amber-600"
                >
                  Save Soundscape Assignment
                </button>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section: Voice Narration */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Voice Narration
              </h4>
              <div className="group/tooltip relative">
                <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 cursor-help align-middle" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50 text-center">
                  Narration is a voice overlay, distinct from ambient background
                  audio.
                </div>
              </div>
            </div>

            {/* Narration Card */}
            <div className="bg-linear-to-br from-orange-50 to-yellow-50 rounded-xl p-4 border border-orange-200 shadow-sm relative group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-linear-to-br from-orange-100 to-yellow-100 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100 shadow-sm">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 leading-tight">
                      Chapter Reading
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                      <span className="text-xs text-orange-700/70 font-medium">
                        Voice
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    title="Replace Narration"
                    className="text-slate-400 hover:text-orange-600 transition-colors p-1.5 rounded-md hover:bg-orange-100/50"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title="Remove narration"
                    onClick={async () => {
                      const pageId = getPageId(activePage);
                      if (pageId) {
                        try {
                          await deleteAudioMutation.mutateAsync({
                            pageId,
                            audioType: "narration",
                          });
                          setNarrationUrlInput("");
                          // Clear local timestamps
                          setLocalPages((prev) =>
                            prev.map((p) =>
                              p.number === activePage
                                ? { ...p, narrationTimestamps: undefined }
                                : p
                            )
                          );
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Failed to remove");
                        }
                      }
                    }}
                    disabled={deleteAudioMutation.isPending}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Narration Waveform */}
              <div className="bg-white/40 rounded-lg p-2 mb-3 border border-orange-100/50">
                <div className="flex items-center justify-between gap-0.5 h-8 opacity-90">
                  {[2, 3, 5, 3, 2, 4, 6, 4, 2, 1, 3, 5, 2, 4, 3, 1, 2, 4].map(
                    (h, i) => (
                      <div
                        key={i}
                        className={`w-1 rounded-full ${
                          h === 1
                            ? "h-1 bg-orange-200"
                            : h === 2
                            ? "h-2 bg-orange-300"
                            : h === 3
                            ? "h-3 bg-orange-400"
                            : h === 4
                            ? "h-4 bg-orange-500"
                            : h === 5
                            ? "h-5 bg-orange-500"
                            : "h-6 bg-orange-600"
                        }`}
                      ></div>
                    )
                  )}
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleNarration}
                  className="w-8 h-8 flex items-center justify-center bg-orange-600 text-white rounded-full hover:bg-orange-700 shadow-md shadow-orange-600/20 transition-all hover:scale-105 active:scale-95"
                >
                  {isNarrationPlaying ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 ml-0.5" />
                  )}
                </button>
                <div className="flex-1 flex items-center gap-2">
                  <Volume1 className="w-3 h-3 text-orange-600/60" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(narrationVolume * 100)}
                    onChange={(event) =>
                      setNarrationVolume(Number(event.target.value) / 100)
                    }
                    className="w-full h-1 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                  />
                </div>
              </div>

              {/* Current Narration Status */}
              <div className="mt-4 space-y-3 border-t border-orange-200/60 pt-4">
                <div className="text-xs font-semibold text-orange-700">Current Status</div>

                {activeAssignments?.narration?.url || narrationActiveUrl ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-semibold text-green-700">Narration Assigned</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const pageId = getPageId(activePage);
                          if (pageId) {
                            try {
                              await deleteAudioMutation.mutateAsync({
                                pageId,
                                audioType: "narration",
                              });
                              setNarrationUrlInput("");
                              // Clear local timestamps
                              setLocalPages((prev) =>
                                prev.map((p) =>
                                  p.number === activePage
                                    ? { ...p, narrationTimestamps: undefined }
                                    : p
                                )
                              );
                            } catch (err) {
                              setError(err instanceof Error ? err.message : "Failed to remove");
                            }
                          }
                        }}
                        disabled={deleteAudioMutation.isPending}
                        className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
                      >
                        {deleteAudioMutation.isPending ? "Removing..." : "Remove"}
                      </button>
                    </div>
                    <div className="text-[10px] text-green-600 truncate font-mono bg-green-100/50 px-2 py-1 rounded">
                      {activeAssignments?.narration?.url || narrationActiveUrl}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="text-xs text-slate-500">No narration for this page</span>
                  </div>
                )}
              </div>

              {/* AI Generation Controls */}
              <div className="mt-4 space-y-3 border-t border-orange-200/60 pt-4">
                <div className="flex items-center justify-between text-xs text-orange-700">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5" />
                    Generate with AI
                  </span>
                  {(activeAssignments?.narration?.url || narrationActiveUrl) && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      Will replace current
                    </span>
                  )}
                </div>

                {/* Generate Buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleGenerateNarration()}
                    disabled={generatingNarration || generatingAllNarration || !activePageData?.text?.trim()}
                    className="flex-1 flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-semibold py-2.5 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {generatingNarration ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5" />
                        This Page
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateAllNarration}
                    disabled={generatingNarration || generatingAllNarration}
                    className="flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-semibold py-2.5 px-3 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    title="Generate narration for all pages"
                  >
                    {generatingAllNarration ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {generationProgress.current}/{generationProgress.total}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        All Pages
                      </>
                    )}
                  </button>
                </div>

                {!activePageData?.text?.trim() && (
                  <p className="text-[10px] text-orange-600/70 italic">
                    Add text content to this page to generate narration.
                  </p>
                )}
              </div>

              {/* Sync Preview Section */}
              {(wordTimestamps.length > 0 || activeAssignments?.narration?.url || narrationActiveUrl) && (
                <div className="mt-4 space-y-3 border-t border-orange-200/60 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-orange-700 flex items-center gap-1.5">
                      <PlayCircle className="w-3.5 h-3.5" />
                      Sync Preview
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSyncPreview(!showSyncPreview)}
                      className="text-[10px] text-orange-600 hover:text-orange-700 bg-orange-50 px-2 py-1 rounded-full border border-orange-200 transition-colors"
                    >
                      {showSyncPreview ? "Hide" : "Show"}
                    </button>
                  </div>

                  {showSyncPreview && (
                    <div className="bg-white/70 rounded-lg p-3 border border-orange-200/50">
                      {/* Play controls */}
                      <div className="flex items-center gap-2 mb-3">
                        <button
                          type="button"
                          onClick={toggleNarration}
                          className="w-7 h-7 flex items-center justify-center bg-orange-600 text-white rounded-full hover:bg-orange-700 transition-all"
                        >
                          {isNarrationPlaying ? (
                            <Pause className="w-3 h-3" />
                          ) : (
                            <Play className="w-3 h-3 ml-0.5" />
                          )}
                        </button>
                        <span className="text-[10px] text-slate-500">
                          {isNarrationPlaying ? "Playing..." : "Click to preview sync"}
                        </span>
                      </div>

                      {/* Word highlighting preview */}
                      <div className="max-h-32 overflow-y-auto">
                        <p className="text-sm leading-relaxed text-slate-700 font-serif">
                          {wordTimestamps.length > 0 ? (
                            wordTimestamps.map((wordData, index) => (
                              <span
                                key={index}
                                className={`transition-all duration-150 ${
                                  index === activeWordIndex && isNarrationPlaying
                                    ? "bg-orange-300 text-orange-900 rounded px-0.5 font-semibold"
                                    : ""
                                }`}
                              >
                                {wordData.word}{" "}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic text-xs">
                              No sync data available. Generate narration to see word highlighting.
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Sync stats */}
                      {wordTimestamps.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-orange-100 flex items-center gap-3 text-[10px] text-slate-500">
                          <span>{wordTimestamps.length} words synced</span>
                          {isNarrationPlaying && activeWordIndex >= 0 && (
                            <span className="text-orange-600 font-medium">
                              Word {activeWordIndex + 1} of {wordTimestamps.length}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Manual URL Assignment */}
              <div className="mt-4 space-y-3 border-t border-orange-200/60 pt-4">
                <div className="flex items-center justify-between text-xs text-orange-700">
                  <span className="font-semibold">Or paste URL manually</span>
                  {activeAssignments?.narration && (
                    <span className="px-2 py-0.5 rounded-full bg-white/70 border border-orange-200 text-orange-600">
                      Assigned ({activeAssignments.narration.range})
                    </span>
                  )}
                </div>
                <input
                  value={narrationUrlInput}
                  onChange={(event) => setNarrationUrlInput(event.target.value)}
                  placeholder="Paste narration URL"
                  className="w-full rounded-md border border-orange-200 bg-white/70 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNarrationScope("current")}
                    className={`px-2.5 py-1 rounded text-[10px] font-semibold border ${
                      narrationScope === "current"
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-white text-orange-700 border-orange-200"
                    }`}
                  >
                    Current Page
                  </button>
                  <button
                    type="button"
                    onClick={() => setNarrationScope("range")}
                    className={`px-2.5 py-1 rounded text-[10px] font-semibold border ${
                      narrationScope === "range"
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-white text-orange-700 border-orange-200"
                    }`}
                  >
                    Range
                  </button>
                  {narrationScope === "range" && (
                    <div className="flex items-center gap-2 text-[10px] text-orange-700">
                      <input
                        type="number"
                        min={1}
                        max={localPages.length}
                        value={narrationRangeStart}
                        onChange={(event) =>
                          setNarrationRangeStart(Number(event.target.value))
                        }
                        className="w-14 rounded border border-orange-200 bg-white px-2 py-1 text-xs"
                      />
                      <span>to</span>
                      <input
                        type="number"
                        min={narrationRangeStart}
                        max={localPages.length}
                        value={narrationRangeEnd}
                        onChange={(event) =>
                          setNarrationRangeEnd(Number(event.target.value))
                        }
                        className="w-14 rounded border border-orange-200 bg-white px-2 py-1 text-xs"
                      />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleAssignAudio(
                      "narration",
                      narrationUrlInput,
                      narrationScope,
                      narrationRangeStart,
                      narrationRangeEnd
                    )
                  }
                  disabled={!narrationUrlInput}
                  className="w-full rounded-md bg-orange-500 text-white text-xs font-semibold py-2 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Narration Assignment
                </button>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section: Library */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Soundscape Library
              </h4>
              <button className="text-xs text-amber-600 font-medium hover:text-amber-700 flex items-center gap-1">
                Browse All <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="group flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-pointer">
                <div className="w-8 h-8 rounded bg-indigo-50 text-indigo-400 flex items-center justify-center shrink-0">
                  <CloudRain className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-sm font-medium text-slate-700 truncate">
                    Heavy Rainfall
                  </h5>
                  <span className="text-[10px] text-slate-400">
                    01:20 - Ambience
                  </span>
                </div>
                <button className="opacity-0 group-hover:opacity-100 bg-white border border-slate-200 text-slate-600 hover:text-amber-600 hover:border-amber-200 px-2.5 py-1 rounded text-xs font-medium transition-all shadow-sm">
                  Use
                </button>
              </div>

              <div className="group flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-pointer">
                <div className="w-8 h-8 rounded bg-rose-50 text-rose-400 flex items-center justify-center shrink-0">
                  <Music className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-sm font-medium text-slate-700 truncate">
                    Soft Piano Theme
                  </h5>
                  <span className="text-[10px] text-slate-400">
                    02:15 - Music
                  </span>
                </div>
                <button className="opacity-0 group-hover:opacity-100 bg-white border border-slate-200 text-slate-600 hover:text-amber-600 hover:border-amber-200 px-2.5 py-1 rounded text-xs font-medium transition-all shadow-sm">
                  Use
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Upload */}
        <div className="p-4 border-t border-slate-100 bg-white">
          <button className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium rounded-lg border border-slate-200 border-dashed transition-all hover:text-amber-600 hover:border-amber-300 group">
            <Upload className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
            Upload Audio File
          </button>
        </div>
      </aside>
    </div>
  );
}
