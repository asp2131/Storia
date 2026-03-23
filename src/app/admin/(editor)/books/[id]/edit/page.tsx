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

// ─── Inner component — reads all state from context ───────────────────────────

function BookEditorInner() {
  const { soundscapeRef, narrationRef, libraryPreviewRef, loading } = useBookEditor();
  const { activeView, setIsSoundscapePlaying, libraryPreviewUrl, setLibraryPreviewUrl } = useAudioLibraryContext();
  const { activeView: narrationActiveView, setIsNarrationPlaying, setNarrationProgress } = useNarrationContext();

  const soundscapeActiveUrl = activeView.soundscapeUrl;
  const narrationActiveUrl = narrationActiveView.narrationUrl;

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
      {/* Audio elements */}
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

      <PageManagerPanel />
      <OverlayEditorPanel />
      <AudioLibraryPanel />
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
