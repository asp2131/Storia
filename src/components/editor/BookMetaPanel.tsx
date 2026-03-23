"use client";

import { Pencil, Loader2, CheckCircle2, UploadCloud } from "lucide-react";
import { useBookMetaContext } from "@/contexts/BookEditorContext";

/**
 * BookMetaPanel — renders the full book editor header content:
 * left section: title + author inline editors
 * right section: page counter, save status indicator, Save Draft and Publish buttons
 *
 * Designed to be the sole child of the <header> flex container in BookEditorInner.
 * The header uses `justify-between` so this component renders two sibling divs.
 */
export function BookMetaPanel() {
  const {
    localTitle,
    setLocalTitle,
    localAuthor,
    setLocalAuthor,
    hasLocalChanges,
    autoSaving,
    saving,
    handleSave,
    handlePublish,
    activePage,
    localPagesLength,
  } = useBookMetaContext();

  return (
    <>
      {/* Left: title + author */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <div className="group relative flex-1">
          <input
            type="text"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            className="w-full text-lg font-semibold text-slate-800 bg-transparent border-2 border-transparent hover:border-slate-200 focus:border-teal-500 rounded-md px-2 py-1 transition-all outline-none truncate focus:bg-slate-50/50"
            placeholder="Untitled Book"
          />
          <Pencil className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
        </div>
        <div className="group relative w-40 shrink-0">
          <input
            type="text"
            value={localAuthor}
            onChange={(e) => setLocalAuthor(e.target.value)}
            className="w-full text-sm text-slate-500 bg-transparent border-2 border-transparent hover:border-slate-200 focus:border-teal-500 rounded-md px-2 py-1 transition-all outline-none truncate focus:bg-slate-50/50"
            placeholder="Author"
          />
          <Pencil className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
        </div>
      </div>

      {/* Right: page counter + save status + action buttons */}
      <div className="flex items-center gap-6">
        <div className="text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full">
          Page {activePage} <span className="text-slate-300 mx-1">/</span> {localPagesLength}
        </div>
        <div className="h-6 w-px bg-slate-200" />
        {autoSaving ? (
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Auto-saving…
          </span>
        ) : hasLocalChanges ? (
          <span className="text-xs text-amber-500">Unsaved changes</span>
        ) : (
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" />
            Saved
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Draft"}
          <span className="text-xs text-slate-300 font-normal hidden lg:inline">
            {typeof navigator !== "undefined" && navigator.platform?.includes("Mac")
              ? "⌘S"
              : "Ctrl+S"}
          </span>
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
    </>
  );
}
