"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";

interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  description: string | null;
  totalPages: number | null;
  metadata: Record<string, unknown> | null;
  hasSoundscape: boolean;
}

interface Pagination {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

const GENRES = [
  { value: "", label: "All Genres" },
  { value: "fiction", label: "Fiction" },
  { value: "mystery", label: "Mystery" },
  { value: "fantasy", label: "Fantasy" },
  { value: "science-fiction", label: "Science Fiction" },
  { value: "romance", label: "Romance" },
  { value: "thriller", label: "Thriller" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Recently Added" },
  { value: "title_asc", label: "Title (A-Z)" },
  { value: "title_desc", label: "Title (Z-A)" },
  { value: "author_asc", label: "Author (A-Z)" },
];

export default function LibraryPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [books, setBooks] = useState<Book[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        perPage: "10",
        sort,
      });
      if (search) params.set("search", search);
      if (genre) params.set("genre", genre);

      const res = await fetch(`/api/books?${params}`);
      const data = await res.json();

      setBooks(data.books);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Failed to fetch books:", error);
    } finally {
      setLoading(false);
    }
  }, [page, search, genre, sort]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/");
    }
  }, [session, isPending, router]);

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleGenreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setGenre(e.target.value);
    setPage(1);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setGenre("");
    setSort("recent");
    setPage(1);
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
  };

  const hasActiveFilters = search || genre;

  if (isPending) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const user = session.user;
  const isAdmin = (session as any)?.user?.role === "admin";

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* Navigation Bar */}
      <nav className="bg-[#101322] border-b border-[#232948]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col gap-4 py-4 md:py-0 md:h-16">
            {/* Top row: logo/links left, user avatar right */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 sm:gap-8">
                <Link
                  href="/"
                  className="flex items-center gap-2 text-white font-bold text-lg"
                >
                  <svg
                    className="w-6 h-6 text-[#1337ec]"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                  </svg>
                  <span className="truncate">Storia</span>
                </Link>

                <div className="hidden sm:flex flex-wrap items-center gap-4 sm:gap-6">
                  <Link
                    href="/library"
                    className="text-white font-medium text-sm"
                  >
                    Library
                  </Link>
                </div>
              </div>

              {/* User Dropdown (always visible, top-right) */}
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen}
                  className="w-10 h-10 bg-[#e5e7eb] rounded-full flex items-center justify-center hover:bg-opacity-80 transition focus:outline-none focus:ring-2 focus:ring-[#1337ec]"
                >
                  <span className="text-[#0a0e1a] font-bold text-sm">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#232948] rounded-lg shadow-lg border border-[#373c5a] py-1 z-50">
                    {isAdmin && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-3 px-4 py-2 text-sm text-[#929bc9] hover:text-white hover:bg-[#373c5a] transition"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M3 7h18M3 12h18M3 17h18"
                          />
                        </svg>
                        Admin Dashboard
                      </Link>
                    )}

                    <Link
                      href="/admin"
                      className="flex items-center gap-3 px-4 py-2 text-sm text-[#929bc9] hover:text-white hover:bg-[#373c5a] transition"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M3 7h18M3 12h18M3 17h18"
                        />
                      </svg>
                      Admin Dashboard
                    </Link>

                    <hr className="border-[#373c5a] my-1" />

                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-[#929bc9] hover:text-white hover:bg-[#373c5a] transition w-full"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Search bar below on mobile, inline on desktop via width */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full">
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search"
                  value={search}
                  onChange={handleSearch}
                  className="w-full h-9 pl-10 pr-4 bg-[#232948] text-white text-sm rounded-lg border-none focus:ring-2 focus:ring-[#1337ec] placeholder:text-[#929bc9]"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#929bc9]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-white text-3xl sm:text-4xl font-black leading-tight tracking-[-0.033em] mb-2 font-serif">
            Discover Your Next Read
          </h1>
          <p className="text-[#929bc9] text-sm sm:text-base font-normal leading-normal">
            Browse, search, and select a book to begin your immersive reading
            experience.
          </p>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 mb-8">
          {/* Filter by Genre */}
          <div className="relative w-full sm:w-auto">
            <select
              value={genre}
              onChange={handleGenreChange}
              className="appearance-none h-10 w-full sm:w-auto pl-4 pr-10 bg-[#232948] text-white text-sm font-medium rounded-lg border-none focus:ring-2 focus:ring-[#1337ec] hover:bg-opacity-80 cursor-pointer sm:min-w-[160px]"
            >
              {GENRES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>

          {/* Sort */}
          <div className="relative w-full sm:w-auto">
            <select
              value={sort}
              onChange={handleSortChange}
              className="appearance-none h-10 w-full sm:w-auto pl-4 pr-10 bg-[#232948] text-white text-sm font-medium rounded-lg border-none focus:ring-2 focus:ring-[#1337ec] hover:bg-opacity-80 cursor-pointer sm:min-w-[160px]"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="h-10 px-4 text-[#1337ec] hover:text-[#1337ec]/80 text-sm font-medium transition w-full sm:w-auto text-left sm:text-center"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Books Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full" />
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#929bc9] text-lg mb-4">
              No books found matching your filters.
            </p>
            <button
              onClick={clearFilters}
              className="text-[#1337ec] hover:text-opacity-80 font-medium"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
              {books.map((book) => (
                <Link
                  key={book.id}
                  href={`/read/${book.id}`}
                  className="group cursor-pointer relative"
                >
                  {/* Book Cover */}
                  <div className="w-full aspect-[2/3] bg-[#232948] rounded-xl overflow-hidden shadow-lg group-hover:shadow-2xl group-hover:scale-105 transition-all duration-300 relative">
                    {book.coverUrl ? (
                      <img
                        src={book.coverUrl}
                        alt={`Book cover for ${book.title}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#929bc9] bg-gradient-to-br from-[#232948] to-[#1a1f3e]">
                        <svg
                          className="w-20 h-20"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                        </svg>
                      </div>
                    )}

                    {/* Soundscape Badge */}
                    {book.hasSoundscape && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-[#1337ec] text-white text-xs font-bold rounded flex items-center gap-1">
                        <span>🔊</span>
                      </div>
                    )}
                  </div>

                  {/* Book Info */}
                  <div className="mt-3">
                    <h3 className="text-white text-sm font-semibold leading-tight line-clamp-2 mb-1">
                      {book.title}
                    </h3>
                    <p className="text-[#929bc9] text-xs font-normal">
                      {book.author}
                    </p>
                    {book.hasSoundscape && (
                      <p className="text-[#1337ec] text-xs font-medium mt-1">
                        Soundscape Available
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-10 sm:mt-12">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center text-white hover:bg-[#232948] rounded disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  ‹
                </button>

                {generatePaginationRange(page, pagination.totalPages).map(
                  (pageNum, idx) =>
                    pageNum === "..." ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="w-8 h-8 flex items-center justify-center text-[#929bc9]"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum as number)}
                        className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium transition ${
                          pageNum === page
                            ? "bg-[#1337ec] text-white"
                            : "text-white hover:bg-[#232948]"
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                )}

                <button
                  onClick={() =>
                    setPage((p) => Math.min(pagination.totalPages, p + 1))
                  }
                  disabled={page === pagination.totalPages}
                  className="w-8 h-8 flex items-center justify-center text-white hover:bg-[#232948] rounded disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function generatePaginationRange(
  current: number,
  total: number
): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }

  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }

  return [1, "...", current - 1, current, current + 1, "...", total];
}
