"use client";

// Disable prerendering for admin pages
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState, useTransition } from "react";
import { createBookDraft } from "@/app/admin/actions";
import { useSession } from "@/lib/auth-client";

type AdminBook = {
  id: string;
  title: string;
  author: string | null;
  processingStatus: string | null;
  updatedAt: string | null;
  coverUrl?: string | null;
  description?: string | null;
  isPublished?: boolean | null;
  ownerId?: string | null;
  ownerEmail?: string | null;
  reviewStatus?: string | null;
  reviewNote?: string | null;
  submittedAt?: string | null;
};

const reviewStyles: Record<string, { badge: string; label: string }> = {
  draft: { badge: "bg-[var(--studio-draft-fill)] text-[var(--studio-draft-ink)]", label: "Draft" },
  submitted: { badge: "bg-amber-500/10 text-[var(--studio-review-ink)]", label: "In review" },
  approved: { badge: "bg-emerald-500/10 text-[var(--studio-live-ink)]", label: "Live" },
  rejected: { badge: "bg-rose-500/10 text-[var(--studio-changes-ink)]", label: "Changes requested" },
};

const REVIEW_FILTERS = [
  { value: "", label: "All" },
  { value: "submitted", label: "In review" },
  { value: "approved", label: "Live" },
  { value: "draft", label: "Drafts" },
  { value: "rejected", label: "Changes requested" },
];

const statusStyles: Record<string, { badge: string; dot: string; label: string }> = {
  ready_for_review: {
    badge: "bg-[var(--studio-rule)] text-[var(--studio-review-ink)]",
    dot: "bg-[var(--studio-amber)]",
    label: "Ready for Review",
  },
  published: {
    badge: "bg-[var(--studio-live-fill)] text-[var(--studio-live-ink)]",
    dot: "bg-[var(--studio-live-ink)]",
    label: "Published",
  },
  processing: {
    badge: "bg-[var(--studio-review-fill)] text-[var(--studio-review-ink)]",
    dot: "bg-[var(--studio-amber)]",
    label: "Processing",
  },
  failed: {
    badge: "bg-[var(--studio-changes-fill)] text-[var(--studio-changes-ink)]",
    dot: "bg-[var(--studio-changes-ink)]",
    label: "Failed",
  },
};

function getStatusStyle(status?: string | null) {
  if (!status) return statusStyles.processing;
  return statusStyles[status] ?? {
    badge: "bg-[var(--studio-draft-fill)] text-[var(--studio-draft-ink)]",
    dot: "bg-[var(--studio-draft-ink)]",
    label: status.replace(/_/g, " "),
  };
}

export default function AdminBooksPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [search, setSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState("");
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingBook, setEditingBook] = useState<AdminBook | null>(null);
  const [isPendingCreation, startTransition] = useTransition();

  const handleCreateBookDraft = () => {
    startTransition(async () => {
      await createBookDraft();
    });
  };

  const [formState, setFormState] = useState({
    title: "",
    author: "",
    coverUrl: "",
    description: "",
    isPublished: false,
    processingStatus: "pending",
  });

  const searchQuery = useMemo(() => search.trim(), [search]);
  const submittedCount = useMemo(
    () => books.filter((b) => b.reviewStatus === "submitted").length,
    [books]
  );

  const loadBooks = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (reviewFilter) params.set("reviewStatus", reviewFilter);

    const response = await fetch(`/api/admin/books?${params.toString()}`);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload?.error || "Failed to load books.");
      setLoading(false);
      return;
    }

    const payload = await response.json();
    setBooks(payload?.books ?? []);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    loadBooks().then(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [searchQuery, reviewFilter]);

  const openEditModal = (book: AdminBook) => {
    setEditingBook(book);
    setFormState({
      title: book.title ?? "",
      author: book.author ?? "",
      coverUrl: book.coverUrl ?? "",
      description: book.description ?? "",
      isPublished: Boolean(book.isPublished),
      processingStatus: book.processingStatus ?? "pending",
    });
    setEditOpen(true);
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingBook) return;
    setSaving(true);
    setError(null);

    const response = await fetch(`/api/admin/books/${editingBook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formState.title,
        author: formState.author,
        coverUrl: formState.coverUrl || null,
        description: formState.description || null,
        isPublished: formState.isPublished,
        processingStatus: formState.processingStatus,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload?.error || "Failed to update book.");
      setSaving(false);
      return;
    }

    setEditOpen(false);
    setEditingBook(null);
    setSaving(false);
    await loadBooks();
  };

  const runReviewAction = async (
    bookId: string,
    action: "submit" | "withdraw" | "approve" | "reject" | "unpublish",
    note?: string
  ) => {
    setReviewBusyId(bookId);
    setError(null);

    const response = await fetch(`/api/admin/books/${bookId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const problems: string[] = payload?.problems ?? [];
      setError(
        [payload?.error || "Failed to update review status.", ...problems].join(" ")
      );
      setReviewBusyId(null);
      return;
    }

    setReviewBusyId(null);
    await loadBooks();
  };

  const handleReject = async (bookId: string) => {
    const note = window.prompt(
      "What does the author need to change before this can go live?"
    );
    if (!note) return;
    await runReviewAction(bookId, "reject", note);
  };

  const handleDelete = async (bookId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this book? This cannot be undone."
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    const response = await fetch(`/api/admin/books/${bookId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload?.error || "Failed to delete book.");
      setSaving(false);
      return;
    }

    setSaving(false);
    await loadBooks();
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b-2 border-[var(--studio-ink)] pb-[18px]">
        <div className="flex flex-col gap-[7px]">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--studio-review-ink)]">
            {submittedCount > 0
              ? `${submittedCount} waiting on a decision`
              : isAdmin
                ? "The whole library"
                : "Your shelf"}
          </span>
          <h1 className="m-0 font-serif text-[44px] font-medium leading-none tracking-[-0.025em]">
            {isAdmin ? "Books" : "My Books"}
          </h1>
        </div>
        <button
          type="button"
          onClick={handleCreateBookDraft}
          disabled={isPendingCreation}
          className="flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-[var(--studio-coral)] text-[var(--studio-on-coral)] text-[11px] font-bold uppercase tracking-[0.12em] hover:brightness-95 transition disabled:opacity-50"
        >
          {isPendingCreation ? (
            <div className="w-4 h-4 border-2 border-[var(--studio-on-coral)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="text-lg leading-none">+</span>
          )}
          <span>{isPendingCreation ? "Creating" : "New book"}</span>
        </button>
      </div>

      <div className="mb-2">
        <label className="flex flex-col min-w-40 h-12 w-full">
          <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
            <div className="text-[var(--studio-ink-muted)] flex bg-[var(--studio-card)] items-center justify-center pl-4 rounded-l-lg border border-[var(--studio-rule-strong)] border-r-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[var(--studio-ink)] focus:outline-0 focus:ring-2 focus:ring-[var(--studio-coral)] border border-[var(--studio-rule-strong)] bg-[var(--studio-rule)] h-full placeholder:text-[var(--studio-ink-muted)] px-4 rounded-l-none border-l-0 pl-2 text-base font-normal leading-normal"
              placeholder="Search by book title or author..."
            />
          </div>
        </label>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {REVIEW_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setReviewFilter(filter.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              reviewFilter === filter.value
                ? "bg-[var(--studio-coral)] text-[var(--studio-on-coral)]"
                : "bg-[var(--studio-rule)] text-[var(--studio-ink-muted)] hover:text-white"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <div className="flex overflow-hidden rounded-lg border border-[var(--studio-rule-strong)] bg-[var(--studio-card)]">
          <table className="w-full">
            <thead className="bg-[var(--studio-rail)]">
              <tr>
                <th className="px-4 py-3 text-left text-[var(--studio-ink-muted)] text-[11px] font-bold uppercase tracking-[0.07em] leading-normal w-2/5">
                  Book Title
                </th>
                <th className="px-4 py-3 text-left text-[var(--studio-ink-muted)] text-[11px] font-bold uppercase tracking-[0.07em] leading-normal w-1/5">
                  Author
                </th>
                <th className="px-4 py-3 text-left text-[var(--studio-ink-muted)] text-[11px] font-bold uppercase tracking-[0.07em] leading-normal w-1/5">
                  Review
                </th>
                <th className="px-4 py-3 text-left text-[var(--studio-ink-muted)] text-[11px] font-bold uppercase tracking-[0.07em] leading-normal w-1/5">
                  Processing Status
                </th>
                <th className="px-4 py-3 text-left text-[var(--studio-ink-muted)] text-[11px] font-bold uppercase tracking-[0.07em] leading-normal w-1/5">
                  Last Updated
                </th>
                <th className="px-4 py-3 text-left text-[var(--studio-ink-muted)] text-[11px] font-bold uppercase tracking-[0.07em] leading-normal">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--studio-rule-strong)]">
              {loading && (
                <tr>
                  <td colSpan={6} className="h-32 text-center text-[var(--studio-ink-muted)]">
                    Loading books...
                  </td>
                </tr>
              )}
              {error && !loading && (
                <tr>
                  <td colSpan={6} className="h-32 text-center text-[var(--studio-changes-ink)]">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && books.length === 0 && (
                <tr>
                  <td colSpan={6} className="h-32 text-center text-[var(--studio-ink-muted)]">
                    {searchQuery
                      ? `No books found matching "${searchQuery}"`
                      : "No books yet. Upload your first book to get started!"}
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                books.map((book) => {
                  const style = getStatusStyle(book.processingStatus);
                  const review =
                    reviewStyles[book.reviewStatus ?? "draft"] ?? reviewStyles.draft;
                  const busy = reviewBusyId === book.id;
                  return (
                    <tr key={book.id} className="hover:bg-[var(--studio-rail)]">
                      <td className="h-[72px] px-4 py-2 text-[var(--studio-ink)] text-sm font-normal leading-normal">
                        {book.title}
                      </td>
                      <td className="h-[72px] px-4 py-2 text-[var(--studio-ink-muted)] text-sm font-normal leading-normal">
                        {book.author || "Unknown"}
                        {isAdmin && book.ownerEmail && (
                          <span className="block text-xs text-[var(--studio-ink-muted)] truncate">
                            {book.ownerEmail}
                          </span>
                        )}
                      </td>
                      <td className="h-[72px] px-4 py-2">
                        <div
                          className={`inline-flex items-center rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${review.badge}`}
                          title={book.reviewNote ?? undefined}
                        >
                          {review.label}
                        </div>
                        {book.reviewStatus === "rejected" && book.reviewNote && (
                          <p className="mt-1 text-xs text-[var(--studio-changes-ink)]/80 line-clamp-2">
                            {book.reviewNote}
                          </p>
                        )}
                      </td>
                      <td className="h-[72px] px-4 py-2">
                        <div
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${style.badge}`}
                        >
                          <span className={`size-1.5 rounded-full ${style.dot}`} />
                          {style.label}
                        </div>
                      </td>
                      <td className="h-[72px] px-4 py-2 text-[var(--studio-ink-muted)] text-sm font-normal leading-normal">
                        {book.updatedAt
                          ? new Date(book.updatedAt).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="h-[72px] px-4 py-2">
                        <div className="flex items-center gap-3 text-sm">
                          <a
                            href={`/admin/books/${book.id}/edit`}
                            className="text-[var(--studio-coral-deep)] hover:underline font-semibold"
                          >
                            Edit
                          </a>
                          {["ready_for_review", "published"].includes(
                            book.processingStatus || ""
                          ) && (
                            <a
                              href={`/admin/books/${book.id}/scenes`}
                              className="text-[var(--studio-coral)] hover:underline font-semibold"
                            >
                              View Scenes
                            </a>
                          )}
                          {isAdmin
                            ? book.reviewStatus === "submitted" && (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => runReviewAction(book.id, "approve")}
                                    className="text-[var(--studio-live-ink)] hover:underline font-semibold disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleReject(book.id)}
                                    className="text-[var(--studio-changes-ink)] hover:underline font-semibold disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                </>
                              )
                            : book.reviewStatus === "submitted" ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => runReviewAction(book.id, "withdraw")}
                                  className="text-[var(--studio-ink-muted)] hover:underline font-semibold disabled:opacity-50"
                                >
                                  Withdraw
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => runReviewAction(book.id, "submit")}
                                  className="text-[var(--studio-live-ink)] hover:underline font-semibold disabled:opacity-50"
                                >
                                  Submit for review
                                </button>
                              )}
                          <button
                            type="button"
                            className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--studio-ink-muted)] hover:text-[var(--studio-coral-deep)] transition"
                            aria-label="Edit metadata"
                            onClick={() => openEditModal(book)}
                            title="Edit metadata"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--studio-ink-muted)] hover:text-[var(--studio-changes-ink)] transition"
                            aria-label="Delete book"
                            onClick={() => handleDelete(book.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--studio-rule)] bg-[var(--studio-card)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[var(--studio-ink)]">
                Edit Book
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditOpen(false);
                  setEditingBook(null);
                }}
                className="text-[var(--studio-ink-muted)] hover:text-white"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={handleUpdate}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-[var(--studio-ink-2)]">Title</label>
                  <input
                    required
                    value={formState.title}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-[var(--studio-rule-strong)] bg-[var(--studio-rule)] px-3 py-2 text-sm text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--studio-coral)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-[var(--studio-ink-2)]">Author</label>
                  <input
                    required
                    value={formState.author}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        author: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-[var(--studio-rule-strong)] bg-[var(--studio-rule)] px-3 py-2 text-sm text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--studio-coral)]"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-[var(--studio-ink-2)]">Cover URL</label>
                <input
                  value={formState.coverUrl}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      coverUrl: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[var(--studio-rule-strong)] bg-[var(--studio-rule)] px-3 py-2 text-sm text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--studio-coral)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-[var(--studio-ink-2)]">Description</label>
                <textarea
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  className="min-h-[90px] w-full rounded-lg border border-[var(--studio-rule-strong)] bg-[var(--studio-rule)] px-3 py-2 text-sm text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--studio-coral)]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-[var(--studio-ink-2)]">Status</label>
                  <select
                    value={formState.processingStatus}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        processingStatus: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-[var(--studio-rule-strong)] bg-[var(--studio-rule)] px-3 py-2 text-sm text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--studio-coral)]"
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="ready_for_review">Ready for Review</option>
                    <option value="published">Published</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                {/* Publishing is a review decision — the API ignores this field
                    for authors, so don't offer it to them. */}
                <div
                  className={`items-center gap-2 pt-6 ${isAdmin ? "flex" : "hidden"}`}
                >
                  <input
                    id="isPublished"
                    type="checkbox"
                    checked={formState.isPublished}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        isPublished: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-[var(--studio-rule-strong)] bg-[var(--studio-rule)] text-[var(--studio-coral)] focus:ring-[var(--studio-coral)]"
                  />
                  <label htmlFor="isPublished" className="text-sm text-[var(--studio-ink-2)]">
                    Published
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditOpen(false);
                    setEditingBook(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-[var(--studio-ink-2)] bg-[#1a1f36] rounded-lg hover:bg-[var(--studio-rule)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-bold text-[var(--studio-ink)] bg-[var(--studio-coral)] rounded-lg hover:bg-[var(--studio-coral)]/90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}