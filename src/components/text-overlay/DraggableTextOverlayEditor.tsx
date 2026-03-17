"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  TextElement,
  TextOverlayConfig,
  TEXT_OVERLAY_VERSION,
} from "@/types/text-overlay";
import { Sheet } from "react-modal-sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Toolbar } from "./Toolbar";
import { PropertyPanel } from "./PropertyPanel";

type VoiceOption = {
  id: string;
  name: string;
  category?: string | null;
};

interface DraggableTextOverlayEditorProps {
  imageUrl: string;
  overlay: TextOverlayConfig | null;
  onSave: (overlay: TextOverlayConfig) => Promise<void>;
  onComposite: () => Promise<void>;
  isSaving?: boolean;
  isCompositing?: boolean;
  voiceOptions?: VoiceOption[];
  enableVoiceAssignment?: boolean;
  onSelectedElementChange?: (element: TextElement | null) => void;
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
  imageUrl,
  overlay,
  onSave,
  onComposite,
  isSaving = false,
  isCompositing = false,
  voiceOptions = [],
  enableVoiceAssignment = false,
  onSelectedElementChange,
}: DraggableTextOverlayEditorProps) {
  const isCompactLayout = useMediaQuery("(max-width: 1023px)");

  // Initialize elements from overlay prop
  const [elements, setElements] = useState<TextElement[]>(
    overlay?.elements ?? []
  );
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [savedElements, setSavedElements] = useState<TextElement[]>(
    overlay?.elements ?? []
  );
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [propertySheetDismissed, setPropertySheetDismissed] = useState(false);

  // Track container height using ResizeObserver
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!imageContainerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });
    
    resizeObserver.observe(imageContainerRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Compute derived state
  const selectedElement = useMemo(
    () => elements.find((el) => el.id === selectedElementId) ?? null,
    [elements, selectedElementId]
  );

  useEffect(() => {
    onSelectedElementChange?.(selectedElement);
  }, [onSelectedElementChange, selectedElement]);

  // Compute isStale: overlay modified after last composite
  const isStale = useMemo(() => {
    const currentJson = JSON.stringify(elements);
    const originalJson = JSON.stringify(savedElements);
    return currentJson !== originalJson;
  }, [elements, savedElements]);

  // Compute hasOverlay for toolbar
  const hasOverlay = elements.length > 0;
  const isPropertySheetOpen =
    isCompactLayout && !!selectedElement && !propertySheetDismissed;

  // Get compositedAt from overlay metadata if available
  const compositedAt = (overlay as unknown as { compositedAt?: string | null })?.compositedAt ?? null;

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleAddElement = useCallback(() => {
    const newElement: TextElement = {
      id: crypto.randomUUID(),
      text: "New Text",
      x: 10,
      y: 10,
      width: 30,
      fontFamily: "Inter",
      fontSize: 5,
      fontWeight: 400,
      color: "#000000",
      textAlign: "left",
      rotation: 0,
    };
    
    setElements((prev) => [...prev, newElement]);
    setSelectedElementId(newElement.id);
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    const config: TextOverlayConfig = {
      version: TEXT_OVERLAY_VERSION,
      elements,
    };
    
    await onSave(config);
    
    // Track the saved overlay snapshot after a successful save.
    setSavedElements([...elements]);
    setHasChanges(false);
  }, [elements, onSave]);

  const handleComposite = useCallback(async () => {
    await onComposite();
  }, [onComposite]);

  const handleUpdateElement = useCallback(
    (elementId: string, updates: Partial<TextElement>) => {
      setElements((prev) =>
        prev.map((el) => (el.id === elementId ? { ...el, ...updates } : el))
      );
      setHasChanges(true);
    },
    []
  );

  const handlePropertyUpdate = useCallback(
    (updatedElement: TextElement) => {
      setElements((prev) =>
        prev.map((el) => (el.id === updatedElement.id ? updatedElement : el))
      );
      setHasChanges(true);
    },
    []
  );

  const handleDeleteElement = useCallback(
    (elementId: string) => {
      setElements((prev) => prev.filter((el) => el.id !== elementId));
      setSelectedElementId(null);
      setPropertySheetDismissed(false);
      setHasChanges(true);
    },
    []
  );

  const handleSelectElement = useCallback((elementId: string) => {
    setSelectedElementId(elementId);
    setPropertySheetDismissed(false);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // Deselect when clicking on the canvas background (not on an element)
    if (e.target === e.currentTarget) {
      setSelectedElementId(null);
      setPropertySheetDismissed(false);
    }
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Toolbar */}
      <Toolbar
        onAddElement={handleAddElement}
        onSave={handleSave}
        onComposite={handleComposite}
        onOpenProperties={() => setPropertySheetDismissed(false)}
        isSaving={isSaving}
        isCompositing={isCompositing}
        hasChanges={hasChanges}
        isStale={isStale}
        hasOverlay={hasOverlay}
        hasBaseImage={!!imageUrl}
        compositedAt={compositedAt}
        showPropertiesButton={isCompactLayout && !!selectedElement}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Image Canvas */}
        <div
          className="flex-1 relative bg-gray-100 flex items-center justify-center p-3 sm:p-6 lg:p-8 overflow-auto min-h-0"
          onClick={handleCanvasClick}
        >
          <div
            ref={imageContainerRef}
            className="relative inline-block max-w-full max-h-full"
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

        {/* Property Panel */}
        {!isCompactLayout && (
          <PropertyPanel
            selectedElement={selectedElement}
            onUpdate={handlePropertyUpdate}
            onDelete={handleDeleteElement}
            voiceOptions={voiceOptions}
            enableVoiceAssignment={enableVoiceAssignment}
          />
        )}
      </div>

      {isCompactLayout && !selectedElement && elements.length > 0 && (
        <div className="border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
          Tap a text block on the canvas to edit its properties.
        </div>
      )}

      {isCompactLayout && (
        <Sheet
          isOpen={isPropertySheetOpen}
          onClose={() => setPropertySheetDismissed(true)}
          detent="content"
        >
          <Sheet.Backdrop />
          <Sheet.Container>
            <Sheet.Header />
            <Sheet.Content>
              <PropertyPanel
                selectedElement={selectedElement}
                onUpdate={handlePropertyUpdate}
                onDelete={handleDeleteElement}
                voiceOptions={voiceOptions}
                enableVoiceAssignment={enableVoiceAssignment}
                variant="drawer"
              />
            </Sheet.Content>
          </Sheet.Container>
        </Sheet>
      )}
    </div>
  );
}

export default DraggableTextOverlayEditor;
