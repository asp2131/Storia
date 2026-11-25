"use client";

import { useId, useRef, type ReactNode } from "react";

/**
 * A button that opens a native popover panel (light dismiss and Esc for free).
 * The panel pins under the button, or above it when there's no room below.
 */
export function PopoverButton({
  label,
  title,
  buttonClassName,
  panelClassName = "",
  align = "start",
  disabled,
  pressed,
  onOpen,
  children,
}: {
  label: ReactNode;
  /** Tooltip, and the accessible name for icon-only buttons. */
  title: string;
  buttonClassName: string;
  panelClassName?: string;
  align?: "start" | "end";
  disabled?: boolean;
  pressed?: boolean;
  onOpen?: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => document.getElementById(id)?.hidePopover?.();

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        popoverTarget={id}
        title={title}
        disabled={disabled}
        aria-pressed={pressed}
        className={buttonClassName}
      >
        {label}
      </button>
      <div
        ref={panelRef}
        id={id}
        popover="auto"
        onToggle={(event) => {
          if ((event as unknown as ToggleEvent).newState !== "open") return;
          onOpen?.();
          const anchor = buttonRef.current?.getBoundingClientRect();
          const panel = panelRef.current;
          if (!anchor || !panel) return;
          const below = anchor.bottom + 6;
          const top =
            below + panel.offsetHeight > window.innerHeight - 8
              ? Math.max(8, anchor.top - panel.offsetHeight - 6)
              : below;
          const left = align === "end" ? anchor.right - panel.offsetWidth : anchor.left;
          panel.style.top = `${top}px`;
          panel.style.left = `${Math.min(Math.max(8, left), window.innerWidth - panel.offsetWidth - 8)}px`;
        }}
        className={`m-0 rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-800 shadow-[0_12px_32px_rgba(24,24,27,0.16)] ${panelClassName}`}
      >
        {children(close)}
      </div>
    </>
  );
}
