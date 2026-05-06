"use client";

import { ChevronDown, ChevronUp, Loader2, RefreshCw, Trash2, Type } from "lucide-react";
import { useOverlayTextContext } from "@/contexts/BookEditorContext";

export function OverlayTextPanel() {
  const {
    activeEntries,
    ocrState,
    saving,
    updateEntry,
    persistActiveEntries,
    removeEntry,
    moveEntry,
    retryOcr,
  } = useOverlayTextContext();

  const statusCopy =
    ocrState.message ||
    (activeEntries.length > 0
      ? `${activeEntries.length} overlay text item${activeEntries.length === 1 ? "" : "s"}`
      : "Upload an illustration to detect text baked into the image.");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Type className="w-3.5 h-3.5 text-sky-500" />
          Overlay text
        </h4>
        <button
          type="button"
          onClick={() => void retryOcr()}
          disabled={ocrState.status === "detecting"}
          className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
        >
          {ocrState.status === "detecting" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Retry OCR
        </button>
      </div>

      <div className="rounded-xl border border-sky-100 bg-linear-to-br from-sky-50 to-cyan-50 p-3 shadow-sm space-y-3">
        <p className={`text-[11px] ${ocrState.status === "error" ? "text-red-600" : "text-sky-700"}`}>
          {statusCopy}
        </p>

        {activeEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-sky-200 bg-white/60 p-3 text-[11px] text-slate-500">
            No overlay text entries yet. OCR failures do not block page saving; use Retry OCR after upload.
          </div>
        ) : (
          <div className="space-y-2">
            {activeEntries.map((entry, index) => (
              <div key={entry.id} className="rounded-lg border border-sky-100 bg-white/80 p-2 shadow-xs space-y-2">
                <div className="flex items-start gap-2">
                  <textarea
                    value={entry.text}
                    onChange={(event) => updateEntry(entry.id, { text: event.target.value })}
                    onBlur={() => void persistActiveEntries()}
                    rows={2}
                    className="min-h-12 flex-1 resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    aria-label={`Overlay text ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => void removeEntry(entry.id)}
                    className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="Remove overlay text"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                  <label className="flex items-center gap-1.5 font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={entry.includeInNarration}
                      onChange={(event) =>
                        updateEntry(
                          entry.id,
                          { includeInNarration: event.target.checked },
                          { persist: true }
                        )
                      }
                      className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-200"
                    />
                    Include in narration
                  </label>

                  <div className="flex items-center gap-1">
                    <span>#{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => void moveEntry(entry.id, "up")}
                      disabled={index === 0 || saving}
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                      aria-label="Move overlay text up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void moveEntry(entry.id, "down")}
                      disabled={index === activeEntries.length - 1 || saving}
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                      aria-label="Move overlay text down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {saving && (
          <div className="flex items-center gap-1.5 text-[10px] text-sky-600">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving overlay text…
          </div>
        )}
      </div>
    </div>
  );
}
