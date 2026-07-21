"use client";

import { ChevronDown, ChevronUp, Trash2, Type } from "lucide-react";
import type { TextElement } from "@/types/text-overlay";

interface LayersPanelProps {
  elements: TextElement[];
  selectedElementId: string | null;
  onSelect: (elementId: string | null) => void;
  onDelete: (elementId: string) => void;
  onMove: (elementId: string, dir: "up" | "down") => void;
  embedded?: boolean;
}

export function LayersPanel({
  elements,
  selectedElementId,
  onSelect,
  onDelete,
  onMove,
  embedded = false,
}: LayersPanelProps) {
  return (
    <div className={embedded ? "mt-5 border-t border-zinc-100 pt-4" : "flex w-52 shrink-0 flex-col border-l border-zinc-200 bg-white"}>
      <div className={`flex items-center justify-between ${embedded ? "mb-2" : "border-b border-zinc-100 px-3 py-2.5"}`}>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.07em] text-zinc-400">Layers</h3>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-400">
          {elements.length}
        </span>
      </div>

      {elements.length === 0 ? (
        <div className={`rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-center text-xs leading-relaxed text-zinc-400 ${embedded ? "" : "m-3"}`}>
          No text layers yet.<br />Use “Add text” above.
        </div>
      ) : (
        <div className={embedded ? "space-y-1" : "editor-scroll flex-1 space-y-1 overflow-y-auto p-2"}>
          {elements.map((element, index) => {
            const isSelected = element.id === selectedElementId;
            const isFirst = index === 0;
            const isLast = index === elements.length - 1;

            return (
              <div
                key={element.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(element.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(element.id);
                  }
                }}
                className={`group flex cursor-pointer items-center gap-2 rounded-[9px] border px-2.5 py-2 outline-none transition ${
                  isSelected
                    ? "border-[color-mix(in_srgb,var(--editor-accent)_30%,white)] bg-[var(--editor-accent-soft)]"
                    : "border-zinc-100 bg-[#fbfbfc] hover:border-zinc-200 hover:bg-white"
                }`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${isSelected ? "bg-white text-[var(--editor-accent)]" : "bg-white text-zinc-400"}`}>
                  <Type className="h-3.5 w-3.5" />
                </span>
                <span className={`min-w-0 flex-1 truncate text-xs ${isSelected ? "font-semibold text-zinc-900" : "font-medium text-zinc-600"}`} title={element.text}>
                  {element.text.trim() || "Empty text"}
                </span>
                <span className="h-3 w-3 shrink-0 rounded-sm border border-black/10" style={{ backgroundColor: element.color }} title={`Color: ${element.color}`} />
                <div className="hidden shrink-0 items-center group-hover:flex">
                  <button
                    type="button"
                    disabled={isFirst}
                    onClick={(event) => { event.stopPropagation(); onMove(element.id, "up"); }}
                    className="rounded p-1 text-zinc-400 hover:bg-white hover:text-zinc-700 disabled:opacity-20"
                    aria-label="Move layer up"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={isLast}
                    onClick={(event) => { event.stopPropagation(); onMove(element.id, "down"); }}
                    className="rounded p-1 text-zinc-400 hover:bg-white hover:text-zinc-700 disabled:opacity-20"
                    aria-label="Move layer down"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); onDelete(element.id); }}
                    className="rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-500"
                    aria-label="Delete layer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
