"use client";

import React from "react";
import {
  ImagePlus,
  RefreshCw,
  Trash2,
  ArrowLeft,
  ArrowRight,
  X,
  Loader2,
  Type,
  Settings,
  CheckCircle2,
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
import { BookMetaPanel } from "./BookMetaPanel";

export function OverlayEditorPanel() {
  const { error, clearError, imageInputRef } = useBookEditor();
  const { overlayEditorCompositing, handleOverlaySave, handleOverlayComposite } =
    useOverlayEditorContext();
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
  const overlayPageId = activeView.overlayPageId;
  const hasImage = !!(activePageData?.imageUrl || activePageData?.compositedImageUrl);

  const triggerImagePicker = () => imageInputRef.current?.click();

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleImageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 relative">
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 z-10 sticky top-0">
        <BookMetaPanel />
      </header>

      {error && (
        <div className="bg-rose-50 text-rose-700 border border-rose-200 px-6 py-3 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CANVAS AREA */}
      <div className="flex-1 bg-slate-100/80 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center p-8">
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
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleAudioUpload(file);
          }}
        />

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
                    <span className="truncate">
                      {activePageData.text.slice(0, 80)}
                      {activePageData.text.length > 80 ? "..." : ""}
                    </span>
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
                pageId={overlayPageId}
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
            <p className="text-sm text-slate-400 mb-4">Click to upload or drag &amp; drop</p>
            <span className="text-xs text-slate-300 px-2 py-1 bg-slate-100 rounded">
              Supports JPG, PNG, GIF
            </span>
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
            onClick={() => setActivePage(Math.max(1, activePage - 1))}
            className="p-3 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all hover:-translate-x-1 active:scale-95 disabled:opacity-30"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-serif text-slate-800 min-w-12 text-center">
            {activePage}
          </span>
          <button
            type="button"
            onClick={() => setActivePage(Math.min(localPages.length, activePage + 1))}
            className="p-3 rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition-all hover:translate-x-1 active:scale-95"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        <div className="w-1/3 flex justify-end gap-4">
          <button
            type="button"
            onClick={() => setStyleDrawerOpen(true)}
            className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <Settings className="w-4.5 h-4.5" />
            Settings
          </button>
        </div>
      </div>

      <BookStyleDrawer
        open={styleDrawerOpen}
        onClose={() => setStyleDrawerOpen(false)}
      />
    </main>
  );
}
