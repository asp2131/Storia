"use client";

import React, { useRef, useEffect, useLayoutEffect, useCallback, useMemo, useState } from "react";
import {
  TextElement,
  TextOverlayConfig,
  buildNewTextElement,
  DEFAULT_BOOK_TEXT_STYLE,
  newTextBoxStyle,
  OVERLAY_FONT_CSS_FAMILY,
  type BookTextStyle,
} from "@/types/text-overlay";
import { Toolbar } from "./Toolbar";
import { useOverlayEditor, useOverlayEditorActions } from "@/hooks/useOverlayEditor";
import { useCreatorTextStyle } from "@/hooks/useCreatorTextStyle";

interface DraggableTextOverlayEditorProps {
  pageId: string;
  imageUrl: string;
  overlay: TextOverlayConfig | null;
  /** Reports the latest draft to the book's SaveCoordinator, which owns debounce and status. */
  onSave: (overlay: TextOverlayConfig) => Promise<void>;
  onComposite: () => Promise<void>;
  isCompositing?: boolean;
  /** Per-book default style — seeds newly added text blocks. */
  bookTextStyle?: BookTextStyle;
  onChangeImage?: () => void;
  onRemoveImage?: () => void;
}

// ─── DraggableTextElement Sub-Component ────────────────────────────────────

/**
 * Which history action a keydown maps to, or null to leave the event alone.
 *
 * Cmd/Ctrl+Z inside the overlay text field is deliberately taken over: the
 * overlay stack is the single undo history for the editor, so native textarea
 * undo would otherwise diverge from element position/order history.
 */
export function historyShortcutFor(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey"> & {
    target: EventTarget | null;
  }
): "undo" | "redo" | null {
  if (!event.metaKey && !event.ctrlKey) return null;
  const key = event.key.toLowerCase();
  if (key !== "z" && key !== "y") return null;

  const target = event.target as HTMLElement | null;
  const isTextControl =
    target?.tagName === "INPUT" ||
    target?.tagName === "TEXTAREA" ||
    target?.isContentEditable === true;
  if (isTextControl && !target?.hasAttribute("data-overlay-text-input")) {
    return null;
  }

  return key === "y" || event.shiftKey ? "redo" : "undo";
}

/** Pointer travel (px) before a press on a box counts as a drag instead of a click-to-type. */
const DRAG_THRESHOLD_PX = 4;

/** Screen distance (px) inside which a dragged box's centre snaps to the page centre. */
const SNAP_PX = 6;

export type SnapGuides = { x: boolean; y: boolean };

/**
 * Snap a box (position + size in % of the page) so its centre lands on the
 * page's centre line when it is within `thresholdPct` of it.
 */
export function snapToCenter(
  x: number,
  y: number,
  width: number,
  height: number,
  thresholdX: number,
  thresholdY: number
): { x: number; y: number; guides: SnapGuides } {
  const snapX = Math.abs(x + width / 2 - 50) <= thresholdX;
  const snapY = Math.abs(y + height / 2 - 50) <= thresholdY;
  return {
    x: snapX ? 50 - width / 2 : x,
    y: snapY ? 50 - height / 2 : y,
    guides: { x: snapX, y: snapY },
  };
}

/** True when a key event belongs to a text field, so canvas shortcuts must leave it alone. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return (
    el?.tagName === "INPUT" ||
    el?.tagName === "TEXTAREA" ||
    el?.tagName === "SELECT" ||
    el?.isContentEditable === true
  );
}

/**
 * Character offset under a viewport point inside `container`'s single text
 * node, so a click on a box can drop the caret exactly where it landed.
 */
export function caretOffsetAt(container: HTMLElement, x: number, y: number): number | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  let node: Node | null = null;
  let offset = 0;
  if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y);
    if (position) ({ offsetNode: node, offset } = position);
  } else if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE || !container.contains(node)) return null;
  return offset;
}

interface DraggableTextElementProps {
  element: TextElement;
  isSelected: boolean;
  containerWidth: number;
  containerHeight: number;
  onSelect: () => void;
  onUpdate: (updates: Partial<TextElement>) => void;
  onHistoryGroupStart: () => void;
  onHistoryGroupEnd: () => void;
  onGuidesChange: (guides: SnapGuides | null) => void;
}

/**
 * One text box on the canvas.
 *
 * The box is always typeable: a click (or tap) drops the caret where it
 * landed, a press that moves past DRAG_THRESHOLD_PX moves the box, and the
 * round handle resizes width. While typing, a real <textarea> sits exactly
 * over the rendered text, so select / cut / copy / paste / context menu /
 * touch selection are all native and pasted text keeps its line breaks and
 * takes the box's style. The hidden text below keeps sizing the box, so the
 * width stays put and the height grows as lines wrap.
 */
function DraggableTextElement({
  element,
  isSelected,
  containerWidth,
  containerHeight,
  onSelect,
  onUpdate,
  onHistoryGroupStart,
  onHistoryGroupEnd,
  onGuidesChange,
}: DraggableTextElementProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const gestureRef = useRef<{
    mode: "move" | "resize";
    x: number;
    y: number;
    elementX: number;
    elementY: number;
    elementWidth: number;
    moved: boolean;
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [overflows, setOverflows] = useState(false);

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

  // Match compositor math: background sizing is relative to image width.
  const paddingPx = element.background ? (element.background.padding / 100) * containerWidth : 0;
  const backgroundStyle = element.background
    ? {
        backgroundColor: element.background.color,
        padding: `${paddingPx}px`,
        borderRadius: `${(element.background.borderRadius / 100) * containerWidth}px`,
      }
    : undefined;

  // Calculate font size in pixels based on container height
  const fontSizePx = (element.fontSize / 100) * containerHeight;

  // Warn, never clip or shrink, when the box runs past the bottom of the scene.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !containerHeight) return;
    const bottomPx = (element.y / 100) * containerHeight + root.offsetHeight;
    setOverflows(bottomPx > containerHeight + 1);
  }, [element.text, element.y, element.width, fontSizePx, element.fontFamily, element.fontWeight, paddingPx, containerHeight, containerWidth]);

  const startTyping = (offset: number | null) => {
    const input = inputRef.current;
    if (!input) return;
    // Focus synchronously inside the pointer handler: iOS only raises the
    // keyboard for focus that happens during the user's gesture.
    input.focus({ preventScroll: true });
    const at = Math.min(offset ?? input.value.length, input.value.length);
    input.setSelectionRange(at, at);
  };

  const beginGesture = (e: React.PointerEvent, mode: "move" | "resize") => {
    e.stopPropagation();
    e.preventDefault();
    rootRef.current?.setPointerCapture(e.pointerId);
    gestureRef.current = {
      mode,
      x: e.clientX,
      y: e.clientY,
      elementX: element.x,
      elementY: element.y,
      elementWidth: element.width,
      moved: false,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // While typing, presses inside the text belong to the textarea: caret,
    // drag-to-select, long-press selection.
    if (isEditing && e.target === inputRef.current) {
      e.stopPropagation();
      return;
    }
    beginGesture(e, "move");
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    e.preventDefault();

    const deltaXPixels = e.clientX - gesture.x;
    const deltaYPixels = e.clientY - gesture.y;
    if (!gesture.moved) {
      if (Math.hypot(deltaXPixels, deltaYPixels) < DRAG_THRESHOLD_PX) return;
      gesture.moved = true;
      // Moving ends typing; resizing keeps the caret where it is while lines reflow.
      if (gesture.mode === "move") inputRef.current?.blur();
      onSelect();
      onHistoryGroupStart();
      document.body.style.userSelect = "none";
    }

    const rect = rootRef.current?.closest("[data-canvas-container]")?.getBoundingClientRect();
    if (!rect) return;

    if (gesture.mode === "move") {
      const heightPct = ((rootRef.current?.offsetHeight ?? 0) / rect.height) * 100;
      // Shift-drag skips snapping, like most design tools.
      const snapped = snapToCenter(
        gesture.elementX + (deltaXPixels / rect.width) * 100,
        gesture.elementY + (deltaYPixels / rect.height) * 100,
        element.width,
        heightPct,
        e.shiftKey ? -1 : (SNAP_PX / rect.width) * 100,
        e.shiftKey ? -1 : (SNAP_PX / rect.height) * 100
      );
      onGuidesChange(snapped.guides);
      onUpdate({
        x: Math.max(0, Math.min(100 - element.width, snapped.x)),
        y: Math.max(0, Math.min(100, snapped.y)),
      });
    } else {
      // Width only: the text reflows and the height follows it.
      const newWidth = gesture.elementWidth + (deltaXPixels / rect.width) * 100;
      onUpdate({ width: Math.max(5, Math.min(100 - element.x, newWidth)) });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    try {
      rootRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if capture was already released
    }

    if (gesture.moved) {
      document.body.style.userSelect = "";
      onGuidesChange(null);
      onHistoryGroupEnd();
      return;
    }
    // A press that never moved is a click: type right where it landed.
    if (gesture.mode === "move" && e.type === "pointerup") {
      onSelect();
      startTyping(textRef.current ? caretOffsetAt(textRef.current, e.clientX, e.clientY) : null);
    }
  };

  const isEmpty = element.text.trim().length === 0;
  const outline = overflows
    ? "outline-2 outline-offset-4 outline-red-500"
    : isSelected
      ? "outline-2 outline-offset-4 outline-[var(--editor-accent)]"
      : isEmpty
        ? "outline-1 outline-dashed outline-offset-4 outline-zinc-400"
        : "hover:outline-1 hover:outline-offset-4 hover:outline-[var(--editor-accent)]";

  return (
    <div
      ref={rootRef}
      data-overlay-element-id={element.id}
      className={`absolute pointer-events-auto rounded-sm ${isEditing ? "" : "cursor-text select-none"} ${outline}`}
      style={{
        left: `${element.x}%`,
        top: `${element.y}%`,
        width: `${element.width}%`,
        fontFamily: OVERLAY_FONT_CSS_FAMILY[element.fontFamily],
        fontSize: `${fontSizePx}px`,
        fontWeight: element.fontWeight,
        color: element.color,
        textAlign: element.textAlign,
        transform: `rotate(${element.rotation}deg)`,
        transformOrigin: "left top",
        textShadow,
        lineHeight: 1.3,
        // Drags must not scroll the page on touch; typing keeps native touch selection.
        touchAction: isEditing ? "auto" : "none",
        ...backgroundStyle,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Sizes the box. The trailing zero-width space keeps a trailing line break (or an empty box) one line tall. */}
      <span
        ref={textRef}
        aria-hidden={isEditing}
        className="block whitespace-pre-wrap break-words"
        style={{ visibility: isEditing ? "hidden" : "visible" }}
      >
        {element.text + "​"}
      </span>

      <textarea
        ref={inputRef}
        data-overlay-text-input
        aria-label="Text box"
        tabIndex={-1}
        value={element.text}
        placeholder="Type here"
        spellCheck
        onChange={(e) => onUpdate({ text: e.target.value })}
        onFocus={() => setIsEditing(true)}
        onBlur={() => setIsEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") e.currentTarget.blur();
        }}
        className="absolute m-0 resize-none overflow-hidden whitespace-pre-wrap break-words border-0 bg-transparent p-0 outline-none placeholder:text-current placeholder:opacity-40"
        style={{
          inset: `${paddingPx}px`,
          font: "inherit",
          lineHeight: "inherit",
          letterSpacing: "inherit",
          textAlign: "inherit",
          color: "inherit",
          textShadow: "inherit",
          // Focusable while invisible, so a click can move the caret in before it shows.
          opacity: isEditing ? 1 : 0,
          pointerEvents: isEditing ? "auto" : "none",
        }}
      />

      {overflows && (
        <span
          role="status"
          className="pointer-events-none absolute bottom-full left-0 mb-2 whitespace-nowrap rounded-md border border-red-200 bg-red-50 px-2 py-0.5 font-sans text-[11px] font-semibold not-italic leading-normal text-red-600"
          style={{ textShadow: "none", textAlign: "left" }}
        >
          Text does not fit this scene
        </span>
      )}

      {/* Resize handle - only visible when selected */}
      {isSelected && (
        <div
          className="absolute -bottom-2 -right-2 h-4 w-4 cursor-ew-resize touch-none rounded-full border-2 border-[var(--editor-accent)] bg-white shadow-sm"
          style={{
            transform: `rotate(${-element.rotation}deg)`,
            transformOrigin: "center center",
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            beginGesture(e, "resize");
          }}
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
  isCompositing = false,
  bookTextStyle,
  onChangeImage,
  onRemoveImage,
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
  const canUndo = useOverlayEditor(pageId, (s) => s.past.length > 0);
  const canRedo = useOverlayEditor(pageId, (s) => s.future.length > 0);
  const autoSaveStatus = useOverlayEditor(pageId, (s) => s.autoSaveStatus);
  const containerWidth = useOverlayEditor(pageId, (s) => s.containerWidth);
  const containerHeight = useOverlayEditor(pageId, (s) => s.containerHeight);
  const textEditRequestId = useOverlayEditor(pageId, (s) => s.textEditRequestId);
  const { creatorStyle } = useCreatorTextStyle();
  const [guides, setGuides] = useState<SnapGuides | null>(null);

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

  // Report each new draft to the parent SaveCoordinator, which owns debounce/status.
  useEffect(() => {
    if (autoSaveStatus !== "pending") return;
    void onSave(actionsRef.current.buildConfig()).catch(() => {
      actionsRef.current.markSaveError();
    });
  }, [autoSaveStatus, elements, onSave]);

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      const action = historyShortcutFor(event);
      if (!action) return;

      event.preventDefault();
      if (action === "redo") actionsRef.current.redo();
      else actionsRef.current.undo();
    };

    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, [pageId]);


  // ─── Handlers ──────────────────────────────────────────────────────────

  // "Add text" (and any other edit request) puts the caret in the selected box
  // on the canvas, so the creator can type without a second click.
  useEffect(() => {
    if (!textEditRequestId) return;
    const id = actionsRef.current.getSelectedElement()?.id;
    if (!id) return;
    const input = imageContainerRef.current?.querySelector<HTMLTextAreaElement>(
      `[data-overlay-element-id="${CSS.escape(id)}"] textarea`
    );
    if (!input) return;
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  }, [textEditRequestId]);

  const handleAddElement = useCallback(() => {
    actions.addElement(
      buildNewTextElement(
        newTextBoxStyle(bookTextStyle ?? DEFAULT_BOOK_TEXT_STYLE, creatorStyle),
        // ponytail: simple cascade so a new box never lands exactly on the last one; wraps after 8.
        { text: "", y: 10 + (elements.length % 8) * 8 }
      )
    );
    actions.requestTextEdit();
  }, [actions, bookTextStyle, creatorStyle, elements.length]);
  const addElementRef = useRef(handleAddElement);
  useEffect(() => {
    addElementRef.current = handleAddElement;
  }, [handleAddElement]);

  // Canvas shortcuts for the selected box. Ignored while typing anywhere, so
  // Backspace in a text box or the inspector never deletes the box itself.
  useEffect(() => {
    const handleCanvasKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target) || event.altKey) return;
      const store = actionsRef.current;
      const selected = store.getSelectedElement();
      const mod = event.metaKey || event.ctrlKey;

      if (!mod && (event.key === "t" || event.key === "T")) {
        event.preventDefault();
        addElementRef.current();
        return;
      }
      if (!selected) return;

      if (mod && event.key.toLowerCase() === "d") {
        event.preventDefault();
        store.addElement({
          ...selected,
          id: crypto.randomUUID(),
          x: Math.min(100 - selected.width, selected.x + 3),
          y: Math.min(95, selected.y + 3),
        });
        return;
      }
      if (mod) return;

      const step = event.shiftKey ? 2.5 : 0.5;
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      if (nudge[event.key]) {
        event.preventDefault();
        const [dx, dy] = nudge[event.key];
        store.updateElement(selected.id, {
          x: Math.max(0, Math.min(100 - selected.width, selected.x + dx)),
          y: Math.max(0, Math.min(100, selected.y + dy)),
        });
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        store.deleteElement(selected.id);
      } else if (event.key === "Escape") {
        store.selectElement(null);
      } else if (
        event.key === "Enter" &&
        // A focused button or link keeps its own Enter.
        !(event.target as Element | null)?.closest?.("button, a, [role='button'], [role='menuitem']")
      ) {
        event.preventDefault();
        store.requestTextEdit();
      }
    };

    window.addEventListener("keydown", handleCanvasKey);
    return () => window.removeEventListener("keydown", handleCanvasKey);
  }, [pageId]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // Any click that isn't on a text box (gray backdrop or the art itself) deselects.
      if (!(e.target as Element).closest("[data-overlay-element-id]")) {
        actions.selectElement(null);
      }
    },
    [actions]
  );

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-100">
      <Toolbar
        onAddElement={handleAddElement}
        onComposite={onComposite}
        onUndo={actions.undo}
        onRedo={actions.redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onChangeImage={onChangeImage}
        onRemoveImage={onRemoveImage}
        isCompositing={isCompositing}
        hasOverlay={elements.length > 0}
        hasBaseImage={!!imageUrl}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className="editor-scroll relative flex flex-1 items-center justify-center overflow-auto bg-zinc-100 px-6 pb-8 pt-2"
          onClick={handleCanvasClick}
        >
          <div
            ref={imageContainerRef}
            className="relative inline-block max-w-full editor-pop"
            data-canvas-container
          >
            <img
              src={imageUrl}
              alt="Base illustration"
              className="max-h-[calc(100vh-13rem)] max-w-full rounded-2xl object-contain shadow-[0_12px_40px_rgba(24,24,27,0.13),0_2px_8px_rgba(24,24,27,0.06)]"
              draggable={false}
            />

            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              {elements.map((element) => (
                <DraggableTextElement
                  key={element.id}
                  element={element}
                  isSelected={element.id === selectedElementId}
                  containerWidth={containerWidth}
                  containerHeight={containerHeight}
                  onSelect={() => actions.selectElement(element.id)}
                  onUpdate={(updates) => actions.updateElement(element.id, updates)}
                  onHistoryGroupStart={actions.beginHistoryGroup}
                  onHistoryGroupEnd={actions.endHistoryGroup}
                  onGuidesChange={setGuides}
                />
              ))}
              {guides?.x && (
                <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-fuchsia-500" />
              )}
              {guides?.y && (
                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-fuchsia-500" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DraggableTextOverlayEditor;
