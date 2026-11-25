"use client";

import { useId, useRef } from "react";
import {
  Image as ImageIcon,
  Images,
  Loader2,
  MoreHorizontal,
  Redo2,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";

export interface ToolbarProps {
  onAddElement: () => void;
  onComposite: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onChangeImage?: () => void;
  onRemoveImage?: () => void;
  isCompositing: boolean;
  hasOverlay: boolean;
  hasBaseImage: boolean;
}

const iconButton =
  "grid h-[34px] w-[34px] place-items-center rounded-lg text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30";
const menuItem =
  "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Canvas toolbar. Save status lives in the editor header only; rarely used or
 * destructive page actions sit behind "More" so a stray click can't remove art.
 */
export function Toolbar({
  onAddElement,
  onComposite,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onChangeImage,
  onRemoveImage,
  isCompositing,
  hasOverlay,
  hasBaseImage,
}: ToolbarProps) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const canComposite = hasOverlay && hasBaseImage && !isCompositing;
  const mod = typeof navigator !== "undefined" && /Mac|iP/.test(navigator.platform) ? "⌘" : "Ctrl+";

  const runAndClose = (action: () => void) => {
    menuRef.current?.hidePopover();
    action();
  };

  return (
    <div className="relative flex h-14 shrink-0 items-center justify-center px-5">
      <div className="flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-white p-1 shadow-[0_2px_10px_rgba(24,24,27,0.06)]">
        <button
          onClick={onAddElement}
          className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-[var(--editor-accent)] px-3 text-xs font-semibold text-[var(--editor-on-accent)] transition hover:brightness-105"
          type="button"
          title="Add text (T)"
        >
          <Type className="h-4 w-4" />
          Add text
        </button>

        {onChangeImage && (
          <button
            onClick={onChangeImage}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
            type="button"
            title="Replace illustration"
          >
            <ImageIcon className="h-4 w-4" />
            <span className="hidden min-[1000px]:inline">Replace image</span>
          </button>
        )}

        <span className="mx-0.5 h-[22px] w-px bg-zinc-200" />

        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={iconButton}
          type="button"
          title={`Undo (${mod}Z)`}
          aria-label="Undo"
        >
          <Undo2 className="h-[17px] w-[17px]" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={iconButton}
          type="button"
          title={`Redo (${mod}Shift+Z)`}
          aria-label="Redo"
        >
          <Redo2 className="h-[17px] w-[17px]" />
        </button>

        <span className="mx-0.5 h-[22px] w-px bg-zinc-200" />

        <button
          ref={moreRef}
          type="button"
          popoverTarget={menuId}
          className={iconButton}
          title="More page actions"
          aria-label="More page actions"
        >
          {isCompositing ? <Loader2 className="h-[17px] w-[17px] animate-spin" /> : <MoreHorizontal className="h-[17px] w-[17px]" />}
        </button>
      </div>

      <div
        ref={menuRef}
        id={menuId}
        popover="auto"
        role="menu"
        onToggle={(event) => {
          // Popovers open centred in the viewport; pin this one under its button.
          if ((event as unknown as ToggleEvent).newState !== "open") return;
          const anchor = moreRef.current?.getBoundingClientRect();
          const menu = menuRef.current;
          if (!anchor || !menu) return;
          menu.style.top = `${anchor.bottom + 6}px`;
          menu.style.left = `${Math.max(8, anchor.right - menu.offsetWidth)}px`;
        }}
        className="m-0 w-64 rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-800 shadow-[0_12px_32px_rgba(24,24,27,0.16)]"
      >
        <button
          type="button"
          role="menuitem"
          disabled={!canComposite}
          onClick={() => runAndClose(onComposite)}
          className={menuItem}
        >
          <Images className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
          <span>
            <span className="block font-semibold">Flatten text into image</span>
            <span className="block text-[11.5px] leading-snug text-zinc-500">
              {hasOverlay ? "Makes a single image for the web reader. Editing text later clears it." : "Add text first."}
            </span>
          </span>
        </button>
        {onRemoveImage && (
          <button
            type="button"
            role="menuitem"
            onClick={() => runAndClose(onRemoveImage)}
            className={`${menuItem} text-rose-600 hover:bg-rose-50`}
          >
            <Trash2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="font-semibold">Remove illustration</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default Toolbar;
