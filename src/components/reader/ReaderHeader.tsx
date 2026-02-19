import { Settings, X } from "lucide-react";
import type { RefObject } from "react";

type ReaderHeaderProps = {
  progressBarRef: RefObject<HTMLDivElement | null>;
  pageCounterRef: RefObject<HTMLSpanElement | null>;
  currentPage: number;
  totalPages: number;
  onClose: () => void;
  onOpenSettings: () => void;
};

export default function ReaderHeader({
  progressBarRef,
  pageCounterRef,
  currentPage,
  totalPages,
  onClose,
  onOpenSettings,
}: ReaderHeaderProps) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3 safe-area-top"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--reader-bg) 80%, transparent)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <button onClick={onClose} className="shrink-0 p-1" aria-label="Close">
        <X className="w-6 h-6" style={{ color: "var(--reader-close-color)" }} />
      </button>
      <div
        className="flex-1 h-3 rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--reader-progress-bar-bg)" }}
      >
        <div
          ref={progressBarRef}
          className="h-full rounded-full"
          style={{
            width: totalPages <= 1 ? "100%" : "0%",
            backgroundColor: "var(--reader-progress-bar-fill)",
            transition: "none",
          }}
        />
      </div>
      <span
        ref={pageCounterRef}
        className="text-xs font-medium shrink-0 tabular-nums"
        style={{ color: "var(--reader-text-secondary)" }}
      >
        {currentPage}/{totalPages}
      </span>
      <button
        onClick={onOpenSettings}
        className="shrink-0 p-1"
        aria-label="Settings"
      >
        <Settings
          className="w-5 h-5"
          style={{ color: "var(--reader-close-color)" }}
        />
      </button>
    </header>
  );
}
