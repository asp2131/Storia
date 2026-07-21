"use client";

import { Type } from "lucide-react";
import {
  useBookEditor,
  useOverlayEditorContext,
  usePageManagerContext,
} from "@/contexts/BookEditorContext";
import { LayersPanel } from "@/components/text-overlay/LayersPanel";
import { PropertyPanel } from "@/components/text-overlay/PropertyPanel";
import { useOverlayEditor, useOverlayEditorActions } from "@/hooks/useOverlayEditor";
import { changedRememberedTextSettings } from "@/types/text-overlay";
import type { TextElement } from "@/types/text-overlay";

export function ElementInspectorPanel() {
  const { activeView } = usePageManagerContext();
  const { rememberOverlayTextSettings } = useOverlayEditorContext();
  const { voiceOptions } = useBookEditor().narration;
  const pageId = activeView.overlayPageId;
  const actions = useOverlayEditorActions(pageId);
  const elements = useOverlayEditor(pageId, (state) => state.elements);
  const selectedElementId = useOverlayEditor(pageId, (state) => state.selectedElementId);
  const selectedElement = useOverlayEditor(pageId, (state) => state.getSelectedElement());

  const handleUpdate = (updatedElement: TextElement) => {
    const settings = selectedElement?.id === updatedElement.id
      ? changedRememberedTextSettings(selectedElement, updatedElement)
      : {};

    actions.updateElement(updatedElement.id, updatedElement);
    if (Object.keys(settings).length > 0) rememberOverlayTextSettings(settings);
  };

  return (
    <div className="editor-pop pb-4">
      <div className="mb-3 flex items-center justify-between px-0.5 pt-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-zinc-400">
          <Type className="h-3.5 w-3.5" />
          Text
        </span>
        <span className="rounded-full bg-[var(--editor-accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--editor-accent)]">
          {selectedElement ? "1 selected" : `${elements.length} layer${elements.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <PropertyPanel
        embedded
        selectedElement={selectedElement}
        onUpdate={handleUpdate}
        onDelete={actions.deleteElement}
        voiceOptions={voiceOptions}
        enableVoiceAssignment
      />

      <LayersPanel
        embedded
        elements={elements}
        selectedElementId={selectedElementId}
        onSelect={actions.selectElement}
        onDelete={actions.deleteElement}
        onMove={actions.moveElement}
      />
    </div>
  );
}
