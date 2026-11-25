"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Eye,
  Loader2,
  Pencil,
  Save,
  Send,
  UploadCloud,
} from "lucide-react";
import { useBookMetaContext } from "@/contexts/BookEditorContext";
import { useBookDetails } from "@/hooks/useBookData";
import { PopoverButton } from "@/components/editor/PopoverButton";
import { useSession } from "@/lib/auth-client";

const REVIEW_CHIPS: Record<string, { label: string; className: string }> = {
  live: { label: "Live", className: "bg-emerald-50 text-emerald-700" },
  submitted: { label: "In review", className: "bg-amber-50 text-amber-700" },
  rejected: { label: "Changes requested", className: "bg-rose-50 text-rose-700" },
  draft: { label: "Draft", className: "bg-zinc-100 text-zinc-500" },
};

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
  } = useBookMetaContext();

  const status = saveError
    ? { icon: AlertCircle, label: "Save failed — retry", className: "text-rose-600" }
    : autoSaving
      ? { icon: Loader2, label: "Saving changes…", className: "text-zinc-400" }
      : hasLocalChanges
        ? { icon: null, label: "Unsaved changes", className: "text-amber-600" }
        : { icon: CheckCircle2, label: "All changes saved", className: "text-zinc-400" };
  const StatusIcon = status.icon;

  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const { data: book } = useBookDetails(bookId);
  const queryClient = useQueryClient();
  const reviewKey = book?.reviewStatus ?? "draft";
  const chip =
    book?.isPublished && reviewKey === "submitted"
      ? { label: "Live · update in review", className: REVIEW_CHIPS.live.className }
      : book?.isPublished
        ? REVIEW_CHIPS.live
        : (REVIEW_CHIPS[reviewKey] ?? REVIEW_CHIPS.draft);

  const [submitState, setSubmitState] = useState<
    { status: "idle" | "busy" | "done" } | { status: "error"; message: string; problems: string[] }
  >({ status: "idle" });

  /** Authors don't publish: they hand the book to an editor via the review queue. */
  const submitForReview = async () => {
    setSubmitState({ status: "busy" });
    try {
      await handleSave();
      const response = await fetch(`/api/admin/books/${bookId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSubmitState({
          status: "error",
          message: payload?.error || "Couldn't submit the book.",
          problems: Array.isArray(payload?.problems) ? payload.problems : [],
        });
        return;
      }
      setSubmitState({ status: "done" });
      void queryClient.invalidateQueries({ queryKey: ["book-details", bookId] });
    } catch {
      setSubmitState({ status: "error", message: "Couldn't save your latest changes. Try again.", problems: [] });
    }
  };

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
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--editor-accent)] text-[var(--editor-on-accent)]">
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
          {book && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${chip.className}`}
              title={reviewKey === "rejected" && book.reviewNote ? book.reviewNote : undefined}
            >
              {chip.label}
            </span>
          )}
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
        <PopoverButton
          title={isAdmin ? "Publish" : "Submit for review"}
          align="end"
          disabled={saving}
          onOpen={() => {
            if (submitState.status !== "busy") setSubmitState({ status: "idle" });
          }}
          buttonClassName="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-[var(--editor-accent)] px-4 text-[13px] font-semibold text-[var(--editor-on-accent)] shadow-sm transition hover:brightness-105 disabled:opacity-50"
          panelClassName="w-80 p-4"
          label={
            <>
              {isAdmin ? <UploadCloud className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              <span className="hidden sm:inline">{isAdmin ? "Publish" : "Submit"}</span>
            </>
          }
        >
          {(close) => isAdmin ? (
            <>
              <h3 className="text-sm font-semibold">Publish to the library?</h3>
              <p className="mt-1 text-[13px] leading-snug text-zinc-500">
                Families can read it as soon as it&apos;s published.
              </p>
              <button
                type="button"
                onClick={() => {
                  close();
                  void handlePublish();
                }}
                className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--editor-accent)] text-[13px] font-semibold text-[var(--editor-on-accent)] hover:brightness-105"
              >
                <UploadCloud className="h-4 w-4" />
                Publish now
              </button>
            </>
          ) : submitState.status === "done" || (reviewKey === "submitted" && submitState.status === "idle") ? (
            <>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                In review
              </h3>
              <p className="mt-1 text-[13px] leading-snug text-zinc-500">
                An editor is checking your book. You can keep editing; changes save as you go.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold">Submit for review?</h3>
              <p className="mt-1 text-[13px] leading-snug text-zinc-500">
                An editor checks every book before families can read it. You can keep editing while you wait.
              </p>
              {submitState.status === "error" && (
                <div role="alert" className="mt-2 rounded-lg bg-rose-50 p-2.5 text-[12.5px] text-rose-700">
                  <p className="font-semibold">{submitState.message}</p>
                  {submitState.problems.length > 0 && (
                    <ul className="mt-1 list-disc pl-4">
                      {submitState.problems.map((problem) => <li key={problem}>{problem}</li>)}
                    </ul>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => void submitForReview()}
                disabled={submitState.status === "busy"}
                className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--editor-accent)] text-[13px] font-semibold text-[var(--editor-on-accent)] hover:brightness-105 disabled:opacity-60"
              >
                {submitState.status === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit for review
              </button>
            </>
          )}
        </PopoverButton>
      </div>
    </>
  );
}
