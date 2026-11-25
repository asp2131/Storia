"use client";

import { Layers } from "lucide-react";
import { usePageManagerContext } from "@/contexts/BookEditorContext";
import { LayersPanel } from "@/components/text-overlay/LayersPanel";
import { useOverlayEditor, useOverlayEditorActions } from "@/hooks/useOverlayEditor";

/**
 * Text boxes on the page, in reading order. Styling lives in the floating
 * toolbar on the canvas; this is for picking, reordering and deleting boxes.
 */
export function ElementInspectorPanel() {
  const { activeView } = usePageManagerContext();
  const pageId = activeView.overlayPageId;
  const actions = useOverlayEditorActions(pageId);
  const elements = useOverlayEditor(pageId, (state) => state.elements);
  const selectedElementId = useOverlayEditor(pageId, (state) => state.selectedElementId);

  return (
    <div className="editor-pop pb-4">
      <p className="mb-3 flex items-center gap-1.5 px-0.5 pt-1 text-[11.5px] leading-snug text-zinc-500">
        <Layers className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        Boxes are read aloud top to bottom. Select one to style it on the page.
      </p>
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
