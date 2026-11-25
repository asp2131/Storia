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
      ? `${activeEntries.length} piece${activeEntries.length === 1 ? "" : "s"} of text found in the art`
      : "Words painted into the art show up here, so narration can read them too.");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.07em] text-zinc-400">
          <Type className="h-3.5 w-3.5 text-[var(--editor-accent)]" />
          Text in the illustration
        </h4>
        <button
          type="button"
          onClick={() => void retryOcr()}
          disabled={ocrState.status === "detecting"}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--editor-accent-soft)] bg-[var(--editor-accent-faint)] px-2 py-1 text-[10px] font-semibold text-[var(--editor-accent)] hover:brightness-95 disabled:opacity-50"
        >
          {ocrState.status === "detecting" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Detect again
        </button>
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
        <p className={`text-[11px] ${ocrState.status === "error" ? "text-rose-600" : "text-zinc-600"}`}>
          {statusCopy}
        </p>

        {activeEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 bg-white p-3 text-[11px] text-zinc-500">
            No text found in this illustration. If the art has words in it, click Detect again.
          </div>
        ) : (
          <div className="space-y-2">
            {activeEntries.map((entry, index) => (
              <div key={entry.id} className="space-y-2 rounded-lg border border-zinc-200 bg-white p-2">
                <div className="flex items-start gap-2">
                  <textarea
                    value={entry.text}
                    onChange={(event) => updateEntry(entry.id, { text: event.target.value })}
                    onBlur={() => void persistActiveEntries()}
                    rows={2}
                    className="min-h-12 flex-1 resize-y rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 outline-none focus:border-[var(--editor-accent)] focus:ring-2 focus:ring-[var(--editor-accent-faint)]"
                    aria-label={`Illustration text ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => void removeEntry(entry.id)}
                    className="rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="Remove illustration text"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500">
                  <label className="flex items-center gap-1.5 font-medium text-zinc-600">
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
                      className="h-3.5 w-3.5 rounded border-zinc-300 accent-[var(--editor-accent)]"
                    />
                    Include in narration
                  </label>

                  <div className="flex items-center gap-1">
                    <span>#{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => void moveEntry(entry.id, "up")}
                      disabled={index === 0 || saving}
                      className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30"
                      aria-label="Move illustration text up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void moveEntry(entry.id, "down")}
                      disabled={index === activeEntries.length - 1 || saving}
                      className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30"
                      aria-label="Move illustration text down"
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
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--editor-accent)]">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </div>
        )}
      </div>
    </div>
  );
}
