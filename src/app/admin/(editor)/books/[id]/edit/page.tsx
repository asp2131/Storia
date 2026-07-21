"use client";

import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  BookEditorProvider,
  useBookEditor,
  useAudioLibraryContext,
  useNarrationContext,
} from "@/contexts/BookEditorContext";
import { PageManagerPanel } from "@/components/editor/PageManagerPanel";
import { OverlayEditorPanel } from "@/components/editor/OverlayEditorPanel";
import { AudioLibraryPanel } from "@/components/editor/AudioLibraryPanel";
import { BookMetaPanel } from "@/components/editor/BookMetaPanel";

// ─── Inner component — reads all state from context ───────────────────────────

function BookEditorInner() {
  const { soundscapeRef, narrationRef, libraryPreviewRef, loading } = useBookEditor();
  const { activeView, setIsSoundscapePlaying, libraryPreviewUrl, setLibraryPreviewUrl } = useAudioLibraryContext();
  const { activeView: narrationActiveView, setIsNarrationPlaying, setNarrationProgress } = useNarrationContext();

  const soundscapeActiveUrl = activeView.soundscapeUrl;
  const narrationActiveUrl = narrationActiveView.narrationUrl;

  if (loading) {
    return (
      <div className="book-editor flex h-screen items-center justify-center bg-zinc-100">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--editor-accent)]" />
          <span className="text-zinc-600">Loading book…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="book-editor flex h-screen flex-col overflow-hidden bg-zinc-100 text-zinc-900">
      {soundscapeActiveUrl ? (
        <audio ref={soundscapeRef} src={soundscapeActiveUrl} loop onEnded={() => setIsSoundscapePlaying(false)} />
      ) : (
        <audio ref={soundscapeRef} />
      )}
      <audio
        ref={narrationRef}
        src={narrationActiveUrl || undefined}
        onTimeUpdate={(e) => setNarrationProgress(e.currentTarget.currentTime)}
        onEnded={() => { setIsNarrationPlaying(false); setNarrationProgress(0); }}
      />
      {libraryPreviewUrl && (
        <audio
          ref={libraryPreviewRef}
          src={libraryPreviewUrl}
          onEnded={() => setLibraryPreviewUrl(null)}
        />
      )}

      <header className="z-30 flex h-14 shrink-0 items-center border-b border-zinc-200/80 bg-white px-4">
        <BookMetaPanel />
      </header>
      <div className="flex min-h-0 flex-1">
        <PageManagerPanel />
        <OverlayEditorPanel />
        <AudioLibraryPanel />
      </div>
    </div>
  );
}

// ─── BookEditor — wraps inner component with the provider ─────────────────────

export default function BookEditor() {
  const params = useParams();
  const bookIdParam = params.id as string;

  return (
    <BookEditorProvider bookId={bookIdParam}>
      <BookEditorInner />
    </BookEditorProvider>
  );
}
