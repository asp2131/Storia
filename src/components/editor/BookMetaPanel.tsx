"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  Save,
  UploadCloud,
} from "lucide-react";
import {
  useBookMetaContext,
  usePageManagerContext,
} from "@/contexts/BookEditorContext";

export function BookMetaPanel() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;
  const {
    localTitle,
    setLocalTitle,
    localAuthor,
    setLocalAuthor,
    hasLocalChanges,
    autoSaving,
    saving,
    saveError,
    handleSave,
    handlePublish,
    activePage,
    localPagesLength,
  } = useBookMetaContext();
  const { setActivePage } = usePageManagerContext();

  const status = saveError
    ? { icon: AlertCircle, label: "Save failed — retry", className: "text-rose-600" }
    : autoSaving
      ? { icon: Loader2, label: "Saving changes…", className: "text-zinc-400" }
      : hasLocalChanges
        ? { icon: null, label: "Unsaved changes", className: "text-amber-600" }
        : { icon: CheckCircle2, label: "All changes saved", className: "text-zinc-400" };
  const StatusIcon = status.icon;

  return (
    <>
      <div className="flex shrink-0 items-center gap-2.5">
        <Link
          href="/admin/books"
          aria-label="Back to library"
          className="grid h-8 w-8 place-items-center rounded-lg text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </Link>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--editor-accent)] text-white">
          <BookOpen className="h-4 w-4" />
        </span>
        <span className="text-[15px] font-bold tracking-[-0.01em] text-zinc-900 max-[900px]:hidden">
          Loratone
        </span>
      </div>

      <div className="mx-4 h-[22px] w-px shrink-0 bg-zinc-200" />

      <div className="min-w-0 flex-1">
        <div className="group relative flex max-w-sm items-center gap-1.5">
          <input
            type="text"
            value={localTitle}
            onChange={(event) => setLocalTitle(event.target.value)}
            onBlur={() => void handleSave()}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="min-w-0 max-w-72 bg-transparent text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 focus:rounded-md focus:ring-2 focus:ring-[var(--editor-accent-soft)]"
            placeholder="Untitled Book"
            aria-label="Book title"
          />
          <Pencil className="h-3 w-3 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <div className="flex min-w-0 items-center gap-2 text-[11px] leading-none">
          <span className={`inline-flex items-center gap-1 ${status.className}`} aria-live="polite">
            {StatusIcon ? (
              <StatusIcon className={`h-3 w-3 ${autoSaving ? "animate-spin" : ""}`} />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            )}
            {status.label}
          </span>
          <span className="hidden text-zinc-300 md:inline">·</span>
          <input
            type="text"
            value={localAuthor}
            onChange={(event) => setLocalAuthor(event.target.value)}
            onBlur={() => void handleSave()}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="hidden min-w-0 max-w-36 bg-transparent text-zinc-400 outline-none placeholder:text-zinc-300 focus:text-zinc-600 md:block"
            placeholder="Add author"
            aria-label="Book author"
          />
        </div>
      </div>

      <div className="mx-3 flex shrink-0 items-center gap-0.5 rounded-lg bg-zinc-100 p-0.5 sm:p-1">
        <button
          type="button"
          title="Previous page"
          aria-label="Previous page"
          onClick={() => setActivePage(Math.max(1, activePage - 1))}
          disabled={activePage <= 1}
          className="grid h-7 w-7 place-items-center rounded-md text-zinc-600 transition hover:bg-white disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-16 px-1 text-center text-xs font-semibold tabular-nums text-zinc-700">
          Page {activePage} / {localPagesLength}
        </span>
        <button
          type="button"
          title="Next page"
          aria-label="Next page"
          onClick={() => setActivePage(Math.min(localPagesLength, activePage + 1))}
          disabled={activePage >= localPagesLength}
          className="grid h-7 w-7 place-items-center rounded-md text-zinc-600 transition hover:bg-white disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              await handleSave();
              router.push(`/books/${bookId}/reader`);
            } catch {
              // Save status already exposes the failure; stay in the editor.
            }
          }}
          disabled={saving}
          aria-label="Preview book"
          className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
        >
          <Eye className="h-4 w-4" />
          <span className="hidden xl:inline">Preview</span>
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          aria-label="Save draft"
          className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="hidden 2xl:inline">Save draft</span>
        </button>
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={saving}
          className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-[var(--editor-accent)] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50"
        >
          <UploadCloud className="h-4 w-4" />
          <span className="hidden sm:inline">Publish</span>
        </button>
      </div>
    </>
  );
}
