"use client";

// Force dynamic rendering to avoid build-time auth issues
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
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
  currentPage?: number | null;
  progressPercent?: number | null;
  lastReadAt?: string | null;
}

interface UserWithRole {
  role?: string;
  email?: string;
  id?: string;
  name?: string;
  image?: string | null;
  emailVerified?: boolean;
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
  const [continueReadingBooks, setContinueReadingBooks] = useState<Book[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);

  const user = session?.user as UserWithRole | undefined;
  const userId = user?.id;

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
      if (userId) params.set("userId", userId);

      const res = await fetch(`/api/books?${params}`);
      const data = await res.json();

      if (!res.ok) {
        console.error("API error:", data.error || "Unknown error");
        setBooks([]);
        setPagination(null);
        return;
      }

      setBooks(data.books || []);
      setPagination(data.pagination || null);

      // Filter and sort continue reading books (only on first page, no filters)
      if (userId && page === 1 && !search && !genre) {
        const inProgressBooks = data.books
          .filter((book: Book) =>
            book.progressPercent !== null &&
            book.progressPercent !== undefined &&
            book.progressPercent > 0 &&
            book.progressPercent < 100
          )
          .sort((a: Book, b: Book) => {
            const dateA = a.lastReadAt ? new Date(a.lastReadAt).getTime() : 0;
            const dateB = b.lastReadAt ? new Date(b.lastReadAt).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 6);
        setContinueReadingBooks(inProgressBooks);
      } else {
        setContinueReadingBooks([]);
      }
    } catch (error) {
      console.error("Failed to fetch books:", error);
    } finally {
      setLoading(false);
    }
  }, [page, search, genre, sort, userId]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideMobile = userMenuRef.current && !userMenuRef.current.contains(target);
      const isOutsideDesktop = desktopMenuRef.current && !desktopMenuRef.current.contains(target);

      // Close if click is outside both menu refs
      if (isOutsideMobile && isOutsideDesktop) {
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--reader-bg)' }}>
        <div className="animate-spin w-8 h-8 border-2 rounded-full" style={{ borderColor: 'var(--storia-border)', borderTopColor: 'var(--storia-primary)' }} />
      </div>
    );
  }

  const isAdmin = user?.role === "admin";
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--reader-bg)' }}>
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-40 w-full backdrop-blur-md" style={{ backgroundColor: 'var(--storia-nav-bg)', borderBottom: '1px solid var(--storia-border)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-center md:h-16 gap-4 py-4 md:py-0">
            {/* Top row / Left section: Logo & Mobile User Menu */}
            <div className="flex items-center justify-between md:w-auto">
              <div className="flex items-center gap-8">
                <Link
                  href="/"
                  className="flex items-center gap-2 font-bold text-lg"
                  style={{ color: 'var(--reader-text)' }}
                >
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    style={{ color: 'var(--storia-primary)' }}
                  >
                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                  </svg>
                  <span className="truncate">Storia</span>
                </Link>

                <div className="hidden md:flex items-center gap-6">
                  <Link
                    href="/library"
                    className="font-medium text-sm py-5"
                    style={{ color: 'var(--reader-text)', borderBottom: '2px solid var(--storia-primary)' }}
                  >
                    Library
                  </Link>
                </div>
              </div>

              {/* Mobile User Menu Toggle (moved here for mobile layout) */}
              <div className="md:hidden relative" ref={userMenuRef}>
                {session ? (
                  <>
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'var(--storia-surface)', color: 'var(--reader-text)' }}
                    >
                      <span className="font-bold text-sm">
                        {user?.email?.charAt(0).toUpperCase()}
                      </span>
                    </button>
                    {userMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg py-1 z-50" style={{ backgroundColor: 'var(--storia-surface)', border: '1px solid var(--storia-border)' }}>
                        {isAdmin && (
                          <Link
                            href="/admin"
                            className="flex items-center gap-3 px-4 py-2 text-sm transition"
                            style={{ color: 'var(--reader-text-secondary)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--reader-text)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--reader-text-secondary)'}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h18M3 12h18M3 17h18" />
                            </svg>
                            Admin Dashboard
                          </Link>
                        )}
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-3 px-4 py-2 text-sm transition w-full"
                          style={{ color: 'var(--reader-text-secondary)' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--reader-text)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--reader-text-secondary)'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Log out
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href="/"
                    className="h-9 px-4 text-white text-sm font-medium rounded-lg flex items-center justify-center transition"
                    style={{ backgroundColor: 'var(--storia-primary)' }}
                  >
                    Login
                  </Link>
                )}
              </div>
            </div>

            {/* Search Bar (Center on Desktop, Full on Mobile) */}
            <div className="flex-1 max-w-2xl mx-auto w-full md:px-8">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Search title, author, or keyword..."
                  value={search}
                  onChange={handleSearch}
                  className="w-full h-10 pl-11 pr-4 text-sm rounded-full transition-all"
                  style={{
                    backgroundColor: 'var(--storia-input-bg)',
                    color: 'var(--reader-text)',
                    border: '1px solid var(--storia-border)',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--storia-primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--storia-border)'}
                />
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: 'var(--reader-text-secondary)' }}
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

            {/* Desktop User Menu (Right) */}
            <div className="hidden md:flex items-center justify-end md:w-auto relative" ref={desktopMenuRef}>
              {session ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-3 hover:opacity-80 transition focus:outline-none"
                  >
                    <span className="text-sm font-medium mr-2" style={{ color: 'var(--reader-text-secondary)' }}>
                      {user?.email}
                    </span>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(to bottom right, var(--storia-primary), var(--storia-primary-dark))', border: '1px solid var(--storia-border)' }}>
                      <span className="text-white font-bold text-sm">
                        {user?.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-xl shadow-2xl py-2 z-50 overflow-hidden ring-1 ring-black ring-opacity-5" style={{ backgroundColor: 'var(--storia-input-bg)', border: '1px solid var(--storia-border)' }}>
                      {isAdmin && (
                        <Link
                          href="/admin"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm transition w-full text-left"
                          style={{ color: 'var(--reader-text-secondary)' }}
                          onClick={() => setUserMenuOpen(false)}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--reader-text)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--reader-text-secondary)'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h18M3 12h18M3 17h18" />
                          </svg>
                          Admin Dashboard
                        </Link>
                      )}
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm transition w-full text-left"
                        style={{ color: 'var(--reader-text-secondary)' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--reader-text)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--reader-text-secondary)'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/"
                  className="h-9 px-4 text-white text-sm font-medium rounded-lg flex items-center justify-center transition"
                  style={{ backgroundColor: 'var(--storia-primary)' }}
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-[-0.033em] mb-2 font-serif" style={{ color: 'var(--reader-text)' }}>
            Discover Your Next Read
          </h1>
          <p className="text-sm sm:text-base font-normal leading-normal" style={{ color: 'var(--reader-text-secondary)' }}>
            Browse, search, and select a book to begin your immersive reading
            experience.
          </p>
        </div>

        {/* Continue Reading Section - Only show for authenticated users with progress */}
        {session && continueReadingBooks.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <svg
                className="w-6 h-6"
                fill="currentColor"
                viewBox="0 0 20 20"
                style={{ color: 'var(--storia-primary)' }}
              >
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--reader-text)' }}>
                Continue Reading
              </h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-track-transparent">
              {continueReadingBooks.map((book) => (
                <Link
                  key={book.id}
                  href={`/books/${book.id}/reader`}
                  className="group cursor-pointer flex-shrink-0 w-36 sm:w-40"
                >
                  {/* Book Cover with Progress Bar */}
                  <div className="w-full aspect-2/3 rounded-xl overflow-hidden shadow-lg group-hover:shadow-2xl group-hover:scale-105 transition-all duration-300 relative" style={{ backgroundColor: 'var(--storia-surface)' }}>
                    {book.coverUrl ? (
                      <div className="relative w-full h-full">
                        <Image
                          src={book.coverUrl}
                          alt={`Book cover for ${book.title}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 144px, 160px"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--reader-text-secondary)', background: 'linear-gradient(to bottom right, var(--storia-surface), var(--storia-input-bg))' }}>
                        <svg
                          className="w-16 h-16"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                        </svg>
                      </div>
                    )}

                    {/* Progress Bar at bottom of cover */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2">
                      <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--storia-border)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${book.progressPercent || 0}%`, backgroundColor: 'var(--reader-progress-bar-fill)' }}
                        />
                      </div>
                      <p className="text-white/80 text-xs mt-1 text-center">
                        {book.progressPercent}% complete
                      </p>
                    </div>

                    {/* Soundscape Badge */}
                    {book.hasSoundscape && (
                      <div className="absolute top-2 right-2 px-2 py-1 text-white text-xs font-bold rounded flex items-center gap-1" style={{ backgroundColor: 'var(--storia-primary)' }}>
                        <span>🔊</span>
                      </div>
                    )}
                  </div>

                  {/* Book Info */}
                  <div className="mt-3">
                    <h3 className="text-sm font-semibold leading-tight line-clamp-2 mb-1" style={{ color: 'var(--reader-text)' }}>
                      {book.title}
                    </h3>
                    <p className="text-xs font-normal" style={{ color: 'var(--reader-text-secondary)' }}>
                      {book.author}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 mb-8">
          {/* Filter by Genre */}
          <div className="relative w-full sm:w-auto">
            <select
              value={genre}
              onChange={handleGenreChange}
              className="appearance-none h-10 w-full sm:w-auto pl-4 pr-10 text-sm font-medium rounded-lg border-none cursor-pointer sm:min-w-[160px]"
              style={{ backgroundColor: 'var(--storia-surface)', color: 'var(--reader-text)' }}
            >
              {GENRES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: 'var(--reader-text-secondary)' }}
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
              className="appearance-none h-10 w-full sm:w-auto pl-4 pr-10 text-sm font-medium rounded-lg border-none cursor-pointer sm:min-w-[160px]"
              style={{ backgroundColor: 'var(--storia-surface)', color: 'var(--reader-text)' }}
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: 'var(--reader-text-secondary)' }}
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
              className="h-10 px-4 text-sm font-medium transition w-full sm:w-auto text-left sm:text-center"
              style={{ color: 'var(--storia-primary)' }}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Books Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 rounded-full" style={{ borderColor: 'var(--storia-border)', borderTopColor: 'var(--storia-primary)' }} />
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg mb-4" style={{ color: 'var(--reader-text-secondary)' }}>
              No books found matching your filters.
            </p>
            <button
              onClick={clearFilters}
              className="font-medium"
              style={{ color: 'var(--storia-primary)' }}
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
                  href={`/books/${book.id}/reader`}
                  className="group cursor-pointer relative"
                >
                    {/* Book Cover */}
                  <div className="w-full aspect-2/3 rounded-xl overflow-hidden shadow-lg group-hover:shadow-2xl group-hover:scale-105 transition-all duration-300 relative" style={{ backgroundColor: 'var(--storia-surface)' }}>
                    {book.coverUrl ? (
                      <div className="relative w-full h-full">
                        <Image
                          src={book.coverUrl}
                          alt={`Book cover for ${book.title}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--reader-text-secondary)', background: 'linear-gradient(to bottom right, var(--storia-surface), var(--storia-input-bg))' }}>
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
                      <div className="absolute top-2 right-2 px-2 py-1 text-white text-xs font-bold rounded flex items-center gap-1" style={{ backgroundColor: 'var(--storia-primary)' }}>
                        <span>🔊</span>
                      </div>
                    )}

                    {/* Progress Bar for books with reading progress */}
                    {book.progressPercent !== null &&
                      book.progressPercent !== undefined &&
                      book.progressPercent > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2">
                          <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--storia-border)' }}>
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ width: `${book.progressPercent}%`, backgroundColor: 'var(--reader-progress-bar-fill)' }}
                            />
                          </div>
                          <p className="text-white/80 text-xs mt-1 text-center">
                            {book.progressPercent}% complete
                          </p>
                        </div>
                      )}
                  </div>

                  {/* Book Info */}
                  <div className="mt-3">
                    <h3 className="text-sm font-semibold leading-tight line-clamp-2 mb-1" style={{ color: 'var(--reader-text)' }}>
                      {book.title}
                    </h3>
                    <p className="text-xs font-normal" style={{ color: 'var(--reader-text-secondary)' }}>
                      {book.author}
                    </p>
                    {book.hasSoundscape && (
                      <p className="text-xs font-medium mt-1" style={{ color: 'var(--storia-primary)' }}>
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
                  className="w-8 h-8 flex items-center justify-center rounded disabled:opacity-30 disabled:cursor-not-allowed transition"
                  style={{ color: 'var(--reader-text)' }}
                >
                  ‹
                </button>

                {generatePaginationRange(page, pagination.totalPages).map(
                  (pageNum, idx) =>
                    pageNum === "..." ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="w-8 h-8 flex items-center justify-center"
                        style={{ color: 'var(--reader-text-secondary)' }}
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum as number)}
                        className="w-8 h-8 flex items-center justify-center rounded text-sm font-medium transition"
                        style={
                          pageNum === page
                            ? { backgroundColor: 'var(--storia-primary)', color: '#ffffff' }
                            : { color: 'var(--reader-text)' }
                        }
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
                  className="w-8 h-8 flex items-center justify-center rounded disabled:opacity-30 disabled:cursor-not-allowed transition"
                  style={{ color: 'var(--reader-text)' }}
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
