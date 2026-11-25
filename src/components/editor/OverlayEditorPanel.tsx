"use client";

import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Keyboard,
  Loader2,
  X,
} from "lucide-react";
import { DraggableTextOverlayEditor } from "@/components/text-overlay/DraggableTextOverlayEditor";
import { PopoverButton } from "./PopoverButton";
import { creatorTextStyleFrom, type TextElement } from "@/types/text-overlay";
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
  const { bookTextStyle, updateBookTextStyle, applyBookTextStyleToAllPages } = useBookMetaContext();
  const { voiceOptions } = useBookEditor().narration;

  // The book style is the source for "apply to every page"; it keeps the
  // book's remembered voice, and applying never touches a box's own voice.
  const applyStyleToAllPages = async (element: TextElement) => {
    await updateBookTextStyle({
      ...creatorTextStyleFrom(element),
      ...(bookTextStyle.voiceId ? { voiceId: bookTextStyle.voiceId, voiceName: bookTextStyle.voiceName } : {}),
    });
    await applyBookTextStyleToAllPages();
  };

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
            isCompositing={overlayEditorCompositing}
            bookTextStyle={bookTextStyle}
            voiceOptions={voiceOptions}
            onTextSettingsChange={rememberOverlayTextSettings}
            onApplyStyleToAllPages={applyStyleToAllPages}
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
        <div className="flex w-1/3 items-center gap-1" />

        <div className="flex w-1/3 items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setActivePage(Math.max(1, activePage - 1))}
            disabled={activePage <= 1}
            className="grid h-8 w-8 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50 disabled:opacity-30"
            aria-label="Previous page"
            title="Previous page (PgUp)"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="min-w-14 text-center text-xs font-semibold tabular-nums text-zinc-600" aria-live="polite">
            {activePage} <span className="text-zinc-400">/ {localPages.length}</span>
          </span>
          <button
            type="button"
            onClick={() => setActivePage(Math.min(localPages.length, activePage + 1))}
            disabled={activePage >= localPages.length}
            className="grid h-8 w-8 place-items-center rounded-full bg-zinc-900 text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-30"
            aria-label="Next page"
            title="Next page (PgDn)"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex w-1/3 justify-end">
          <ShortcutsButton />
        </div>
      </footer>

    </main>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Add text box", "T"],
  ["Edit text", "Enter or click"],
  ["Stop editing / deselect", "Esc"],
  ["Nudge box", "Arrow keys (Shift = bigger)"],
  ["Duplicate box", "⌘/Ctrl + D"],
  ["Copy / paste box (any page)", "⌘/Ctrl + C / V"],
  ["Delete box", "Delete"],
  ["Undo / redo", "⌘/Ctrl + Z / Shift + Z"],
  ["Previous / next page", "PgUp / PgDn"],
];

function ShortcutsButton() {
  return (
    <PopoverButton
      title="Keyboard shortcuts"
      align="end"
      buttonClassName="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-zinc-500 transition hover:bg-white hover:text-zinc-800"
      panelClassName="w-80 p-4"
      label={
        <>
          <Keyboard className="h-4 w-4" />
          <span className="hidden min-[1100px]:inline">Shortcuts</span>
        </>
      }
    >
      {() => (
        <>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-zinc-400">Keyboard shortcuts</h3>
          <dl className="space-y-1.5 text-[13px]">
            {SHORTCUTS.map(([label, keys]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <dt className="text-zinc-600">{label}</dt>
                <dd className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11.5px] font-semibold text-zinc-700">{keys}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </PopoverButton>
  );
}
