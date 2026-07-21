"use client";

import React, { useRef, useEffect, useCallback, useMemo } from "react";
import {
  TextElement,
  TextOverlayConfig,
  buildNewTextElement,
  DEFAULT_BOOK_TEXT_STYLE,
  type BookTextStyle,
  type RememberedTextSettings,
} from "@/types/text-overlay";
import { Toolbar } from "./Toolbar";
import { PropertyPanel } from "./PropertyPanel";
import { LayersPanel } from "./LayersPanel";
import { useOverlayEditor, useOverlayEditorActions } from "@/hooks/useOverlayEditor";

type VoiceOption = {
  id: string;
  name: string;
  category?: string | null;
};

interface DraggableTextOverlayEditorProps {
  pageId: string;
  imageUrl: string;
  overlay: TextOverlayConfig | null;
  onSave: (overlay: TextOverlayConfig) => Promise<void>;
  onComposite: () => Promise<void>;
  isSaveCoordinated?: boolean;
  isSaving?: boolean;
  isCompositing?: boolean;
  voiceOptions?: VoiceOption[];
  enableVoiceAssignment?: boolean;
  onSelectedElementChange?: (element: TextElement | null) => void;
  onTextSettingsChange?: (settings: RememberedTextSettings) => void;
  /** Per-book default style — seeds newly added text blocks. */
  bookTextStyle?: BookTextStyle;
}

// ─── DraggableTextElement Sub-Component ────────────────────────────────────

interface DraggableTextElementProps {
  element: TextElement;
  isSelected: boolean;
  containerWidth: number;
  containerHeight: number;
  onSelect: () => void;
  onUpdate: (updates: Partial<TextElement>) => void;
}

function DraggableTextElement({
  element,
  isSelected,
  containerWidth,
  containerHeight,
  onSelect,
  onUpdate,
}: DraggableTextElementProps) {
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, elementX: 0, elementY: 0, elementWidth: 0 });

  // Build text shadow style
  const textShadow = useMemo(() => {
    if (!element.shadow) return undefined;
    const { color, offsetX, offsetY, blur } = element.shadow;
    // Match compositor math: offsetX + blur are relative to image width.
    const blurPx = (blur / 100) * containerWidth;
    const offsetXPx = (offsetX / 100) * containerWidth;
    const offsetYPx = (offsetY / 100) * containerHeight;
    return `${offsetXPx}px ${offsetYPx}px ${blurPx}px ${color}`;
  }, [element.shadow, containerHeight, containerWidth]);

  // Build background style
  const backgroundStyle = useMemo(() => {
    if (!element.background) return undefined;
    const { color, padding, borderRadius } = element.background;
    // Match compositor math: background sizing is relative to image width.
    const paddingPx = (padding / 100) * containerWidth;
    const borderRadiusPx = (borderRadius / 100) * containerWidth;
    return {
      backgroundColor: color,
      padding: `${paddingPx}px`,
      borderRadius: `${borderRadiusPx}px`,
    };
  }, [element.background, containerWidth]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();

    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      elementX: element.x,
      elementY: element.y,
      elementWidth: element.width,
    };

    (e.target as Element).setPointerCapture(e.pointerId);

    // Prevent text selection during drag
    document.body.style.userSelect = "none";
  };

  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    isResizingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      elementX: element.x,
      elementY: element.y,
      elementWidth: element.width,
    };

    (e.target as Element).setPointerCapture(e.pointerId);

    // Prevent text selection during resize
    document.body.style.userSelect = "none";
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current && !isResizingRef.current) return;

    e.preventDefault();

    // Get the parent container for percentage calculations
    const parentElement = (e.target as Element).closest('[data-canvas-container]');
    if (!parentElement) return;

    const rect = parentElement.getBoundingClientRect();

    if (isDraggingRef.current) {
      const deltaXPixels = e.clientX - dragStartRef.current.x;
      const deltaYPixels = e.clientY - dragStartRef.current.y;

      // Convert pixel delta to percentage
      const deltaXPercent = (deltaXPixels / rect.width) * 100;
      const deltaYPercent = (deltaYPixels / rect.height) * 100;

      let newX = dragStartRef.current.elementX + deltaXPercent;
      let newY = dragStartRef.current.elementY + deltaYPercent;

      // Clamp values to 0-100
      newX = Math.max(0, Math.min(100 - element.width, newX));
      newY = Math.max(0, Math.min(100, newY));

      onUpdate({ x: newX, y: newY });
    }

    if (isResizingRef.current) {
      const deltaXPixels = e.clientX - dragStartRef.current.x;

      // Convert pixel delta to percentage
      const deltaXPercent = (deltaXPixels / rect.width) * 100;

      let newWidth = dragStartRef.current.elementWidth + deltaXPercent;

      // Clamp width to reasonable bounds
      newWidth = Math.max(5, Math.min(100 - element.x, newWidth));

      onUpdate({ width: newWidth });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current || isResizingRef.current) {
      isDraggingRef.current = false;
      isResizingRef.current = false;

      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if capture was already released
      }

      // Restore text selection
      document.body.style.userSelect = "";
    }
  };

  // Calculate font size in pixels based on container height
  const fontSizePx = (element.fontSize / 100) * containerHeight;

  return (
    <div
      className={`
        absolute cursor-move select-none pointer-events-auto
        ${isSelected ? "ring-2 ring-blue-500" : ""}
      `}
      style={{
        left: `${element.x}%`,
        top: `${element.y}%`,
        width: `${element.width}%`,
        fontFamily: element.fontFamily,
        fontSize: `${fontSizePx}px`,
        fontWeight: element.fontWeight,
        color: element.color,
        textAlign: element.textAlign,
        transform: `rotate(${element.rotation}deg)`,
        transformOrigin: "left top",
        textShadow,
        lineHeight: 1.3,
        ...backgroundStyle,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {element.text}

      {/* Resize handle - only visible when selected */}
      {isSelected && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize rounded-tl"
          style={{
            transform: `rotate(${-element.rotation}deg)`,
            transformOrigin: "center center",
          }}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      )}
    </div>
  );
}

// ─── Main Editor Component ────────────────────────────────────────────────

export function DraggableTextOverlayEditor({
  pageId,
  imageUrl,
  overlay,
  onSave,
  onComposite,
  isSaveCoordinated = false,
  isSaving = false,
  isCompositing = false,
  voiceOptions = [],
  enableVoiceAssignment = false,
  onSelectedElementChange,
  onTextSettingsChange,
  bookTextStyle,
}: DraggableTextOverlayEditorProps) {
  const actions = useOverlayEditorActions(pageId);

  // Keep a ref to actions so callbacks always use the current store
  const actionsRef = useRef(actions);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  // State slices from store
  const elements = useOverlayEditor(pageId, (s) => s.elements);
  const selectedElementId = useOverlayEditor(pageId, (s) => s.selectedElementId);
  const hasChanges = useOverlayEditor(pageId, (s) => s.hasChanges);
  const autoSaveStatus = useOverlayEditor(pageId, (s) => s.autoSaveStatus);
  const containerWidth = useOverlayEditor(pageId, (s) => s.containerWidth);
  const containerHeight = useOverlayEditor(pageId, (s) => s.containerHeight);

  const isAutoSaving = autoSaveStatus === "saving";

  // Derived selected element
  const selectedElement = useOverlayEditor(pageId, (s) => s.getSelectedElement());

  // Init store when overlay prop or pageId changes
  // Use actionsRef (not actions) to avoid re-triggering: getState() returns a
  // new object after every set(), which would cause an infinite render loop.
  useEffect(() => {
    actionsRef.current.init(overlay?.elements ?? []);
  }, [overlay, pageId]);

  // Track container dimensions using ResizeObserver
  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!imageContainerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        actionsRef.current.setContainerDimensions(entry.contentRect.width, entry.contentRect.height);
      }
    });

    resizeObserver.observe(imageContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [pageId]);

  // Autosave request effect. Coordinated callers report the latest draft to a
  // parent SaveCoordinator, which owns debounce/status. Non-coordinated callers
  // still get direct save lifecycle status for compatibility.
  useEffect(() => {
    if (autoSaveStatus !== "pending") return;

    const savePromise = onSave(actionsRef.current.buildConfig());
    if (isSaveCoordinated) {
      void savePromise.catch(() => {
        actionsRef.current.markSaveError();
      });
      return;
    }

    actionsRef.current.markSaving();
    void savePromise
      .then(() => actionsRef.current.markSaved())
      .catch(() => actionsRef.current.markSaveError());
  }, [autoSaveStatus, elements, isSaveCoordinated, onSave]);

  // Notify parent when selected element changes
  useEffect(() => {
    onSelectedElementChange?.(selectedElement);
  }, [onSelectedElementChange, selectedElement]);

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleAddElement = useCallback(() => {
    actions.addElement(
      buildNewTextElement(bookTextStyle ?? DEFAULT_BOOK_TEXT_STYLE)
    );
  }, [actions, bookTextStyle]);

  const handleComposite = useCallback(async () => {
    await onComposite();
  }, [onComposite]);

  const handleUpdateElement = useCallback(
    (elementId: string, updates: Partial<TextElement>) => {
      actions.updateElement(elementId, updates);
    },
    [actions]
  );

  const handlePropertyUpdate = useCallback(
    (updatedElement: TextElement) => {
      const settings: RememberedTextSettings = {};
      if (selectedElement?.id === updatedElement.id) {
        if (selectedElement.fontFamily !== updatedElement.fontFamily) {
          settings.fontFamily = updatedElement.fontFamily;
        }
        if (selectedElement.fontSize !== updatedElement.fontSize) {
          settings.fontSize = updatedElement.fontSize;
        }
        if (
          selectedElement.voiceId !== updatedElement.voiceId ||
          selectedElement.voiceName !== updatedElement.voiceName
        ) {
          settings.voiceId = updatedElement.voiceId;
          settings.voiceName = updatedElement.voiceName;
        }
      }

      actions.updateElement(updatedElement.id, updatedElement);
      if (Object.keys(settings).length > 0) onTextSettingsChange?.(settings);
    },
    [actions, onTextSettingsChange, selectedElement]
  );

  const handleDeleteElement = useCallback(
    (elementId: string) => {
      actions.deleteElement(elementId);
    },
    [actions]
  );

  const handleSelectElement = useCallback(
    (elementId: string | null) => {
      actions.selectElement(elementId);
    },
    [actions]
  );

  const handleMoveElement = useCallback(
    (elementId: string, dir: "up" | "down") => {
      actions.moveElement(elementId, dir);
    },
    [actions]
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // Deselect when clicking on the canvas background (not on an element)
      if (e.target === e.currentTarget) {
        actions.selectElement(null);
      }
    },
    [actions]
  );

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Toolbar */}
      <Toolbar
        onAddElement={handleAddElement}
        onComposite={handleComposite}
        isSaving={isSaving || isAutoSaving}
        isCompositing={isCompositing}
        hasChanges={hasChanges}
        isAutoSaving={isAutoSaving}
        hasOverlay={elements.length > 0}
        hasBaseImage={!!imageUrl}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Image Canvas */}
        <div
          className="flex-1 relative bg-gray-100 flex items-center justify-center p-8 overflow-auto"
          onClick={handleCanvasClick}
        >
          <div
            ref={imageContainerRef}
            className="relative inline-block"
            data-canvas-container
          >
            {/* Base Image */}
            <img
              src={imageUrl}
              alt="Base illustration"
              className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
              draggable={false}
            />

            {/* Text Elements Overlay Container */}
            <div className="absolute inset-0 overflow-hidden">
              {elements.map((element) => (
                <DraggableTextElement
                  key={element.id}
                  element={element}
                  isSelected={element.id === selectedElementId}
                  containerWidth={containerWidth}
                  containerHeight={containerHeight}
                  onSelect={() => handleSelectElement(element.id)}
                  onUpdate={(updates) => handleUpdateElement(element.id, updates)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Layers Panel */}
        <LayersPanel
          elements={elements}
          selectedElementId={selectedElementId}
          onSelect={handleSelectElement}
          onDelete={handleDeleteElement}
          onMove={handleMoveElement}
        />

        {/* Property Panel */}
        <PropertyPanel
          selectedElement={selectedElement}
          onUpdate={handlePropertyUpdate}
          onDelete={handleDeleteElement}
          voiceOptions={voiceOptions}
          enableVoiceAssignment={enableVoiceAssignment}
        />
      </div>
    </div>
  );
}

export default DraggableTextOverlayEditor;
