"use client";

import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Loader2,
  Settings,
  X,
} from "lucide-react";
import { DraggableTextOverlayEditor } from "@/components/text-overlay/DraggableTextOverlayEditor";
import { BookStyleDrawer } from "./BookStyleDrawer";
import {
  useBookEditor,
  useOverlayEditorContext,
  usePageManagerContext,
  useAudioLibraryContext,
  useBookMetaContext,
} from "@/contexts/BookEditorContext";

export function OverlayEditorPanel() {
  const { error, clearError, imageInputRef } = useBookEditor();
  const {
    overlayEditorCompositing,
    handleOverlaySave,
    handleOverlayComposite,
    rememberOverlayTextSettings,
  } = useOverlayEditorContext();
  const {
    localPages,
    activePage,
    setActivePage,
    activeView,
    uploading,
    setActiveImage,
    handleImageFile,
  } = usePageManagerContext();
  const { audioInputRef, handleAudioUpload } = useAudioLibraryContext();
  const { hasLocalChanges, bookTextStyle } = useBookMetaContext();
  const { voiceOptions } = useBookEditor().narration;
  const [styleDrawerOpen, setStyleDrawerOpen] = React.useState(false);

  const activePageData = activeView.data;
  const hasImage = Boolean(activePageData?.imageUrl || activePageData?.compositedImageUrl);
  const triggerImagePicker = () => imageInputRef.current?.click();

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleImageFile(file);
  };

  const handleImageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void handleImageFile(file);
  };

  return (
    <main className="relative flex min-w-0 flex-1 flex-col bg-zinc-100">
      {error && (
        <div className="flex items-center justify-between border-b border-rose-200 bg-rose-50 px-5 py-2.5 text-sm text-rose-700" role="alert">
          <span>{error}</span>
          <button onClick={clearError} className="rounded-md p-1 text-rose-400 hover:bg-rose-100 hover:text-rose-600" aria-label="Dismiss error">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageChange}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleAudioUpload(file);
        }}
      />

      <div className="min-h-0 flex-1" onDragOver={(event) => event.preventDefault()} onDrop={handleImageDrop}>
        {uploading ? (
          <div className="grid h-full place-items-center p-8">
            <div className="editor-pop flex flex-col items-center rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-xl">
              <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--editor-accent-soft)] text-[var(--editor-accent)]">
                <Loader2 className="h-7 w-7 animate-spin" />
              </span>
              <h3 className="text-base font-semibold text-zinc-800">Uploading illustration…</h3>
              <p className="mt-1 text-sm text-zinc-400">This should only take a moment.</p>
            </div>
          </div>
        ) : hasImage ? (
          <DraggableTextOverlayEditor
            pageId={activeView.overlayPageId}
            imageUrl={activePageData!.imageUrl}
            overlay={activePageData!.overlay || null}
            onSave={handleOverlaySave}
            onComposite={handleOverlayComposite}
            isSaveCoordinated
            isSaving={false}
            isCompositing={overlayEditorCompositing}
            voiceOptions={voiceOptions}
            enableVoiceAssignment
            bookTextStyle={bookTextStyle}
            onTextSettingsChange={rememberOverlayTextSettings}
            showInspector={false}
            onChangeImage={triggerImagePicker}
            onRemoveImage={() => setActiveImage("")}
          />
        ) : (
          <div className="grid h-full place-items-center p-8">
            <button
              type="button"
              onClick={triggerImagePicker}
              className="editor-pop flex aspect-[4/5] w-full max-w-sm flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-white text-zinc-400 shadow-lg transition hover:border-[var(--editor-accent)] hover:bg-[var(--editor-accent-faint)]"
            >
              <span className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-[var(--editor-accent-soft)] text-[var(--editor-accent)]">
                <ImagePlus className="h-8 w-8" />
              </span>
              <span className="text-lg font-semibold text-zinc-700">Add an illustration</span>
              <span className="mt-1 text-sm">Click to upload or drag and drop</span>
              <span className="mt-4 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-400">
                JPG, PNG or GIF
              </span>
            </button>
          </div>
        )}
      </div>

      <footer className="flex h-[52px] shrink-0 items-center justify-between border-t border-zinc-200/80 bg-zinc-100 px-5">
        <div className="flex w-1/3 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow-sm">
            <span className={`h-2 w-2 rounded-full ${hasLocalChanges ? "bg-amber-500" : "bg-emerald-500"}`} />
            Editing · {hasLocalChanges ? "unsaved" : "saved"}
          </span>
        </div>

        <div className="flex w-1/3 items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setActivePage(Math.max(1, activePage - 1))}
            disabled={activePage <= 1}
            className="grid h-8 w-8 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50 disabled:opacity-30"
            aria-label="Previous page"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="min-w-8 text-center font-serif text-sm font-semibold tabular-nums text-zinc-700">
            {activePage}
          </span>
          <button
            type="button"
            onClick={() => setActivePage(Math.min(localPages.length, activePage + 1))}
            disabled={activePage >= localPages.length}
            className="grid h-8 w-8 place-items-center rounded-full bg-zinc-900 text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-30"
            aria-label="Next page"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex w-1/3 justify-end">
          <button
            type="button"
            onClick={() => setStyleDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-zinc-500 transition hover:bg-white hover:text-zinc-800"
          >
            <Settings className="h-4 w-4" />
            Book style
          </button>
        </div>
      </footer>

      <BookStyleDrawer open={styleDrawerOpen} onClose={() => setStyleDrawerOpen(false)} />
    </main>
  );
}
