"use client";

import { useEffect, useMemo, useState } from "react";

type AdminBook = {
  id: string;
  title: string;
  author: string | null;
  processingStatus: string | null;
  updatedAt: string | null;
  coverUrl?: string | null;
  description?: string | null;
  isPublished?: boolean | null;
};

const statusStyles: Record<string, { badge: string; dot: string; label: string }> = {
  ready_for_review: {
    badge: "bg-[#1a1f2e] text-[#a5b4fc]",
    dot: "bg-[#6366f1]",
    label: "Ready for Review",
  },
  published: {
    badge: "bg-emerald-500/10 text-emerald-400",
    dot: "bg-emerald-400",
    label: "Published",
  },
  processing: {
    badge: "bg-amber-500/10 text-amber-400",
    dot: "bg-amber-400",
    label: "Processing",
  },
  failed: {
    badge: "bg-rose-500/10 text-rose-400",
    dot: "bg-rose-400",
    label: "Failed",
  },
};

function getStatusStyle(status?: string | null) {
  if (!status) return statusStyles.processing;
  return statusStyles[status] ?? {
    badge: "bg-slate-500/10 text-slate-300",
    dot: "bg-slate-300",
    label: status.replace(/_/g, " "),
  };
}

export default function AdminBooksPage() {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingBook, setEditingBook] = useState<AdminBook | null>(null);
  const [formState, setFormState] = useState({
    title: "",
    author: "",
    coverUrl: "",
    description: "",
    isPublished: false,
    processingStatus: "pending",
  });

  const searchQuery = useMemo(() => search.trim(), [search]);

  const loadBooks = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);

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
  }, [searchQuery]);

  const resetForm = () => {
    setFormState({
      title: "",
      author: "",
      coverUrl: "",
      description: "",
      isPublished: false,
      processingStatus: "pending",
    });
  };

  const openCreateModal = () => {
    resetForm();
    setCreateOpen(true);
  };

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

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const response = await fetch("/api/admin/books", {
      method: "POST",
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
      setError(payload?.error || "Failed to create book.");
      setSaving(false);
      return;
    }

    setCreateOpen(false);
    setSaving(false);
    await loadBooks();
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
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-white text-3xl sm:text-4xl font-black leading-tight tracking-[-0.033em]">
            Book & Soundscape Management
          </h1>
          <p className="text-[#929bc9] text-base font-normal leading-normal">
            Review, edit, and manage AI-generated soundscapes for all processed books.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 min-w-[84px] cursor-pointer overflow-hidden rounded-lg h-10 px-4 bg-[#1337ec] text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-[#1337ec]/90 transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          <span className="truncate">Add New Book</span>
        </button>
      </div>

      <div className="mb-2">
        <label className="flex flex-col min-w-40 h-12 w-full">
          <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
            <div className="text-[#929bc9] flex bg-[#232948] items-center justify-center pl-4 rounded-l-lg border border-[#323b67] border-r-0">
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
              className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-[#1337ec] border border-[#323b67] bg-[#232948] h-full placeholder:text-[#929bc9] px-4 rounded-l-none border-l-0 pl-2 text-base font-normal leading-normal"
              placeholder="Search by book title or author..."
            />
          </div>
        </label>
      </div>

      <div className="mb-6">
        <div className="flex overflow-hidden rounded-lg border border-[#323b67] bg-[#111422]">
          <table className="w-full">
            <thead className="bg-[#191e33]">
              <tr>
                <th className="px-4 py-3 text-left text-white text-sm font-medium leading-normal w-2/5">
                  Book Title
                </th>
                <th className="px-4 py-3 text-left text-white text-sm font-medium leading-normal w-1/5">
                  Author
                </th>
                <th className="px-4 py-3 text-left text-white text-sm font-medium leading-normal w-1/5">
                  Processing Status
                </th>
                <th className="px-4 py-3 text-left text-white text-sm font-medium leading-normal w-1/5">
                  Last Updated
                </th>
                <th className="px-4 py-3 text-left text-white text-sm font-medium leading-normal">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#323b67]">
              {loading && (
                <tr>
                  <td colSpan={5} className="h-32 text-center text-[#929bc9]">
                    Loading books...
                  </td>
                </tr>
              )}
              {error && !loading && (
                <tr>
                  <td colSpan={5} className="h-32 text-center text-red-300">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && books.length === 0 && (
                <tr>
                  <td colSpan={5} className="h-32 text-center text-[#929bc9]">
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
                  return (
                    <tr key={book.id} className="hover:bg-[#191e33]">
                      <td className="h-[72px] px-4 py-2 text-white text-sm font-normal leading-normal">
                        {book.title}
                      </td>
                      <td className="h-[72px] px-4 py-2 text-[#929bc9] text-sm font-normal leading-normal">
                        {book.author || "Unknown"}
                      </td>
                      <td className="h-[72px] px-4 py-2">
                        <div
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${style.badge}`}
                        >
                          <span className={`size-1.5 rounded-full ${style.dot}`} />
                          {style.label}
                        </div>
                      </td>
                      <td className="h-[72px] px-4 py-2 text-[#929bc9] text-sm font-normal leading-normal">
                        {book.updatedAt
                          ? new Date(book.updatedAt).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="h-[72px] px-4 py-2">
                        <div className="flex items-center gap-3 text-sm">
                          <a
                            href={`/admin/books/${book.id}/edit`}
                            className="text-[#60a5fa] hover:underline font-semibold"
                          >
                            Edit
                          </a>
                          {["ready_for_review", "published"].includes(
                            book.processingStatus || ""
                          ) && (
                            <a
                              href={`/admin/books/${book.id}/scenes`}
                              className="text-[#1337ec] hover:underline font-semibold"
                            >
                              View Scenes
                            </a>
                          )}
                          <button
                            type="button"
                            className="p-1 text-[#6b7280] hover:text-[#60a5fa]"
                            aria-label="Edit metadata"
                            onClick={() => openEditModal(book)}
                            title="Edit metadata"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="p-1 text-[#6b7280] hover:text-[#f87171]"
                            aria-label="Delete book"
                            onClick={() => handleDelete(book.id)}
                          >
                            🗑️
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

      {(createOpen || editOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#232948] bg-[#0f1419] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">
                {editOpen ? "Edit Book" : "Add New Book"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setEditOpen(false);
                  setEditingBook(null);
                }}
                className="text-[#929bc9] hover:text-white"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={editOpen ? handleUpdate : handleCreate}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-[#c5cbe6]">Title</label>
                  <input
                    required
                    value={formState.title}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-[#323b67] bg-[#232948] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#1337ec]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-[#c5cbe6]">Author</label>
                  <input
                    required
                    value={formState.author}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        author: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-[#323b67] bg-[#232948] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#1337ec]"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-[#c5cbe6]">Cover URL</label>
                <input
                  value={formState.coverUrl}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      coverUrl: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#323b67] bg-[#232948] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#1337ec]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-[#c5cbe6]">Description</label>
                <textarea
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  className="min-h-[90px] w-full rounded-lg border border-[#323b67] bg-[#232948] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#1337ec]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-[#c5cbe6]">Status</label>
                  <select
                    value={formState.processingStatus}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        processingStatus: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-[#323b67] bg-[#232948] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#1337ec]"
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="ready_for_review">Ready for Review</option>
                    <option value="published">Published</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
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
                    className="h-4 w-4 rounded border-[#323b67] bg-[#232948] text-[#1337ec] focus:ring-[#1337ec]"
                  />
                  <label htmlFor="isPublished" className="text-sm text-[#c5cbe6]">
                    Published
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    setEditOpen(false);
                    setEditingBook(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-[#c5cbe6] bg-[#1a1f36] rounded-lg hover:bg-[#232948]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-bold text-white bg-[#1337ec] rounded-lg hover:bg-[#1337ec]/90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editOpen ? "Save Changes" : "Create Book"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}