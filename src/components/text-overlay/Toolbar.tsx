"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Images,
  Loader2,
  Trash2,
  Type,
} from "lucide-react";

export interface ToolbarProps {
  onAddElement: () => void;
  onComposite: () => void;
  onChangeImage?: () => void;
  onRemoveImage?: () => void;
  isSaving: boolean;
  isCompositing: boolean;
  hasChanges: boolean;
  isAutoSaving?: boolean;
  isStale?: boolean;
  hasOverlay: boolean;
  hasBaseImage: boolean;
  compositedAt?: string | null;
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function Toolbar({
  onAddElement,
  onComposite,
  onChangeImage,
  onRemoveImage,
  isSaving,
  isCompositing,
  hasChanges,
  isAutoSaving = false,
  isStale = false,
  hasOverlay,
  hasBaseImage,
  compositedAt = null,
}: ToolbarProps) {
  const canComposite = hasOverlay && hasBaseImage && !isCompositing;
  const status = isAutoSaving || isSaving
    ? { label: "Saving…", icon: Loader2, tone: "text-zinc-500", spin: true }
    : isStale
      ? { label: "Update preview", icon: AlertTriangle, tone: "text-amber-600", spin: false }
      : hasChanges
        ? { label: "Unsaved overlay", icon: AlertTriangle, tone: "text-amber-600", spin: false }
        : {
            label: compositedAt ? `Updated ${formatRelativeTime(compositedAt)}` : "Overlay saved",
            icon: CheckCircle2,
            tone: "text-zinc-500",
            spin: false,
          };
  const StatusIcon = status.icon;

  return (
    <div className="relative flex h-14 shrink-0 items-center justify-center px-5">
      <div className="flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-white p-1 shadow-[0_2px_10px_rgba(24,24,27,0.06)]">
        <button
          onClick={onAddElement}
          className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-[var(--editor-accent)] px-3 text-xs font-semibold text-white transition hover:brightness-105"
          type="button"
          title="Add text"
        >
          <Type className="h-4 w-4" />
          Add text
        </button>

        {onChangeImage && (
          <button
            onClick={onChangeImage}
            className="grid h-[34px] w-[34px] place-items-center rounded-lg text-zinc-600 transition hover:bg-zinc-100"
            type="button"
            title="Change image"
            aria-label="Change image"
          >
            <ImageIcon className="h-[17px] w-[17px]" />
          </button>
        )}

        <span className="mx-0.5 h-[22px] w-px bg-zinc-200" />

        <button
          onClick={onComposite}
          disabled={!canComposite}
          aria-label="Composite page"
          className={`inline-flex h-[34px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            isStale
              ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "text-zinc-700 hover:bg-zinc-100"
          }`}
          type="button"
          title="Create a composited preview"
        >
          {isCompositing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />}
          <span className="hidden min-[900px]:inline">Composite</span>
        </button>

        {onRemoveImage && (
          <button
            onClick={onRemoveImage}
            className="grid h-[34px] w-[34px] place-items-center rounded-lg text-rose-500 transition hover:bg-rose-50"
            type="button"
            title="Remove image"
            aria-label="Remove image"
          >
            <Trash2 className="h-[17px] w-[17px]" />
          </button>
        )}
      </div>

      <span className={`absolute right-5 hidden items-center gap-1.5 text-[11px] font-semibold 2xl:inline-flex ${status.tone}`}>
        <StatusIcon className={`h-3.5 w-3.5 ${status.spin ? "animate-spin" : ""}`} />
        {status.label}
      </span>
    </div>
  );
}

export default Toolbar;
