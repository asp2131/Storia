"use client";

import {
  Type,
  ChevronUp,
  ChevronDown,
  Trash2,
} from "lucide-react";
import type { TextElement, TextOverlayConfig } from "@/types/text-overlay";

interface LayersPanelProps {
  elements: TextElement[];
  selectedElementId: string | null;
  onSelect: (elementId: string | null) => void;
  onDelete: (elementId: string) => void;
  onMove: (elementId: string, dir: "up" | "down") => void;
}

export function LayersPanel({
  elements,
  selectedElementId,
  onSelect,
  onDelete,
  onMove,
}: LayersPanelProps) {
  if (elements.length === 0) {
    return (
      <div className="w-52 bg-white border-l border-gray-200 flex flex-col">
        <div className="px-3 py-2 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Layers
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-gray-400 text-xs text-center">
            No text elements yet.
            <br />
            Click "Add Text" to create one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-52 bg-white border-l border-gray-200 flex flex-col">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Layers
        </h3>
        <span className="text-[10px] text-gray-400 tabular-nums">
          {elements.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {elements.map((element, index) => {
          const isSelected = element.id === selectedElementId;
          const displayText = element.text?.trim() || "Empty text";
          const isFirst = index === 0;
          const isLast = index === elements.length - 1;

          return (
            <div
              key={element.id}
              onClick={() => onSelect(element.id)}
              className={`
                group flex items-center gap-2 px-3 py-2 cursor-pointer transition
                ${isSelected
                  ? "bg-blue-50 border-r-2 border-blue-500"
                  : "hover:bg-gray-50 border-r-2 border-transparent"
                }
              `}
            >
              <span className="text-[10px] text-gray-400 font-mono w-4 text-center shrink-0">
                {index + 1}
              </span>

              <div
                className="w-3 h-3 rounded-sm shrink-0 border border-gray-200"
                style={{ backgroundColor: element.color }}
                title={`Color: ${element.color}`}
              />

              <Type className="w-3 h-3 text-gray-400 shrink-0" />

              <span
                className={`text-xs truncate flex-1 min-w-0 ${
                  isSelected ? "text-blue-700 font-medium" : "text-gray-700"
                }`}
                title={displayText}
              >
                {displayText}
              </span>

              <button
                type="button"
                disabled={isFirst}
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(element.id, "up");
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition shrink-0 disabled:opacity-0"
                title="Move earlier in reading order"
              >
                <ChevronUp className="w-3 h-3" />
              </button>

              <button
                type="button"
                disabled={isLast}
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(element.id, "down");
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition shrink-0 disabled:opacity-0"
                title="Move later in reading order"
              >
                <ChevronDown className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(element.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition shrink-0"
                title="Delete layer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
