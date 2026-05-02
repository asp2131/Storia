"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

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

interface LibraryClientProps {
  initialBooks: Book[];
}

const COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FDCB6E",
  "#6C5CE7",
  "#A8E6CF",
  "#FD79A8",
  "#FF9F43",
];

export default function LibraryClient({ initialBooks }: LibraryClientProps) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [books, setBooks] = useState<Book[]>(initialBooks);
  const [activeIndex, setActiveIndex] = useState(
    Math.max(0, Math.floor(initialBooks.length / 2)),
  );
  const [loading, setLoading] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const backgroundRef = useRef<HTMLDivElement>(null);

  // Fix 5: Cache window.innerWidth — never read it in GSAP callback
  const windowWidthRef = useRef(
    typeof window !== "undefined" ? window.innerWidth : 768,
  );

  useEffect(() => {
    const handleResize = () => {
      windowWidthRef.current = window.innerWidth;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fix 7: Swipe cooldown ref to prevent queued swipes
  const isAnimatingRef = useRef(false);

  const user = session?.user as UserWithRole | undefined;
  const userId = user?.id;

  // Fix 1: Remove activeIndex from fetchBooks deps — only keep userId
  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        perPage: "50", // Fetch a large batch for the toy box canvas
        sort: "recent",
      });
      if (userId) params.set("userId", userId);

      const res = await fetch(`/api/books?${params}`);
      const data = await res.json();

      if (!res.ok) {
        console.error("API error:", data.error || "Unknown error");
        return;
      }

      const fetchedBooks = data.books || [];
      if (fetchedBooks.length > 0) {
        setBooks(fetchedBooks);
        // Always reset to middle of new batch
        setActiveIndex(Math.max(0, Math.floor(fetchedBooks.length / 2)));
      }
    } catch (error) {
      console.error("Failed to fetch books:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // Close menu logic
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutside =
        userMenuRef.current && !userMenuRef.current.contains(target);
      if (isOutside) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
  };

  // GSAP Animation orchestration based on activeIndex
  useGSAP(
    () => {
      if (!books.length) return;

      // Animate covers
      cardsRef.current.forEach((card, index) => {
        if (!card) return;

        const offset = index - activeIndex;
        const isActive = offset === 0;
        const distance = Math.abs(offset);

        // Fix 5: Use cached window width instead of reading from DOM
        const spacingUnit = windowWidthRef.current < 640 ? 180 : 350;

        // Fix 3: Only animate cards within ±4 of activeIndex — skip far cards
        if (distance > 4) {
          gsap.set(card, { opacity: 0, x: offset * spacingUnit, zIndex: 0 });
          return;
        }

        const xPos = offset * spacingUnit;

        // Cards shrink as they get further from center
        const scale = isActive ? 1 : Math.max(0.6, 1 - distance * 0.15);
        const zIndex = 100 - distance;

        // Cards further than 3 spaces fade out entirely
        const opacity = distance > 3 ? 0 : isActive ? 1 : 0.4;

        // Fix 2: Set zIndex instantly — not GPU-composited, don't tween it
        gsap.set(card, { zIndex: zIndex });

        gsap.to(card, {
          x: xPos,
          scale: scale,
          opacity: opacity,
          duration: 0.6,
          ease: "back.out(1.2)",
          force3D: true,
        });

        // Animate the play button inside the card independently
        const playBtn = card.querySelector(".play-btn");
        if (playBtn) {
          // Fix 8: Set pointerEvents instantly — discrete property, don't tween
          gsap.set(playBtn, { pointerEvents: isActive ? "auto" : "none" });

          gsap.to(playBtn, {
            opacity: isActive ? 1 : 0,
            scale: isActive ? 1 : 0.5,
            duration: 0.4,
            delay: isActive ? 0.2 : 0,
            ease: "back.out(1.5)",
          });
        }
      });
    },
    { dependencies: [activeIndex, books.length], scope: containerRef },
  );

  // Navigation handlers with swipe cooldown (Fix 7)
  const handlePrev = () => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    setActiveIndex((prev) => Math.max(0, prev - 1));
    setTimeout(() => {
      isAnimatingRef.current = false;
    }, 650);
  };
  const handleNext = () => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    setActiveIndex((prev) => Math.min(books.length - 1, prev + 1));
    setTimeout(() => {
      isAnimatingRef.current = false;
    }, 650);
  };
  const handleCardClick = (index: number) => {
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  // Touch/Drag handling for carousel
  const touchStartRef = useRef<{ x: number; time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX =
      "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    touchStartRef.current = { x: clientX, time: Date.now() };
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (!touchStartRef.current) return;

    const clientX =
      "changedTouches" in e
        ? e.changedTouches[0].clientX
        : (e as React.MouseEvent).clientX;
    const { x: startX, time: startTime } = touchStartRef.current;

    const deltaX = startX - clientX;
    const deltaTime = Date.now() - startTime;

    // Register as a swipe if dragged more than 50px within 500ms
    if (Math.abs(deltaX) > 50 && deltaTime < 500) {
      if (deltaX > 0) handleNext();
      else handlePrev();
    }

    touchStartRef.current = null;
  };

  if (isPending || (loading && books.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900">
        <div className="animate-spin w-12 h-12 border-4 rounded-full border-zinc-700 border-t-white" />
      </div>
    );
  }

  const isAdmin = user?.role === "admin";

  return (
    <div
      ref={containerRef}
      className="min-h-screen relative overflow-hidden bg-zinc-900 select-none touch-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
    >
      {/* Dynamic Ambient Background */}
      {/* Fix 9: Removed transition-colors and duration-700 to avoid conflicting with GSAP */}
      <div
        ref={backgroundRef}
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at center, currentColor 0%, transparent 80%)",
          color: COLORS[activeIndex % COLORS.length],
          transition: "color 0.8s ease",
        }}
      />

      {/* Navigation Bar */}
      <nav className="absolute top-0 z-[200] w-full p-6 sm:p-8 flex justify-between items-center pointer-events-none">
        <Link
          href="/"
          className="flex items-center gap-3 pointer-events-auto group"
        >
          <svg
            className="w-10 h-10 text-white drop-shadow-lg group-hover:scale-110 transition-transform"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
          </svg>
          <span className="text-white font-black text-2xl tracking-tight drop-shadow-lg">
            Storia
          </span>
        </Link>

        <div className="relative pointer-events-auto" ref={userMenuRef}>
          {session ? (
            <>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/25 border border-white/30 flex items-center justify-center text-white font-black text-lg hover:bg-white/35 hover:scale-105 active:scale-95 transition-all shadow-xl"
              >
                {user?.email?.charAt(0).toUpperCase()}
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-4 w-56 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-zinc-800/95 border border-white/10 overflow-hidden py-2 z-50">
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="block px-6 py-4 text-base text-white hover:bg-white/20 font-bold transition-colors"
                    >
                      Admin Dashboard
                    </Link>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-6 py-4 text-base text-white hover:bg-white/20 font-bold transition-colors"
                  >
                    Log out
                  </button>
                </div>
              )}
            </>
          ) : (
            <Link
              href="/"
              className="px-8 py-4 bg-white text-zinc-900 rounded-full font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              Login
            </Link>
          )}
        </div>
      </nav>

      {/* Infinite Canvas Carousel */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {books.length === 0 ? (
          <div className="text-white font-black text-3xl sm:text-4xl bg-zinc-800/90 px-10 py-6 rounded-[2rem] pointer-events-auto border border-white/10 shadow-2xl">
            Your Toy Box is Empty!
          </div>
        ) : (
          books.map((book, i) => {
            // Fix 4: Virtualize card rendering — only render ±5 cards
            if (Math.abs(i - activeIndex) > 5) {
              return (
                <div
                  key={book.id}
                  ref={(el) => {
                    cardsRef.current[i] = el;
                  }}
                  style={{ display: "none" }}
                />
              );
            }

            return (
              <div
                key={book.id}
                ref={(el) => {
                  cardsRef.current[i] = el;
                }}
                onClick={(e) => {
                  if (i !== activeIndex) {
                    e.stopPropagation();
                    handleCardClick(i);
                  }
                }}
                className="absolute pointer-events-auto cursor-pointer group"
                style={{
                  width: "min(65vw, min(420px, 35vh))",
                  aspectRatio: "2/3",
                }}
              >
                {/* Context Above Card */}
                <div
                  className="context-above absolute bottom-full left-0 right-0 mb-4 sm:mb-6 flex flex-col items-center justify-end text-center pointer-events-none opacity-0 transition-opacity duration-300 w-[140%] -ml-[20%]"
                  style={{ opacity: i === activeIndex ? 1 : 0 }}
                >
                  <h3 className="text-white font-black text-xl sm:text-4xl mb-1 sm:mb-2 drop-shadow-xl leading-tight line-clamp-2 px-2">
                    {book.title}
                  </h3>
                  <p className="text-white/80 font-bold text-sm sm:text-xl mb-3 sm:mb-4 drop-shadow-lg">
                    By {book.author}
                  </p>
                  {(book.progressPercent && book.progressPercent > 0) ||
                  (book.currentPage && book.currentPage > 1) ? (
                    <span className="text-white font-bold text-xs sm:text-base bg-black/60 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-white/10 shadow-xl">
                      Continue reading
                      {book.currentPage ? ` from page ${book.currentPage}` : ""}
                    </span>
                  ) : (
                    <span className="text-white font-bold text-xs sm:text-base bg-black/60 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-white/10 shadow-xl">
                      Start Reading
                    </span>
                  )}
                </div>

                <div className="w-full h-full rounded-[2rem] sm:rounded-[3rem] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.6)] relative bg-zinc-800 border-4 border-white/10 transition-colors group-hover:border-white/30 mt-auto">
                  {book.coverUrl ? (
                    <Image
                      src={book.coverUrl}
                      alt={book.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 75vw, 420px"
                      priority={Math.abs(i - activeIndex) <= 1}
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 text-white pb-10">
                      <span className="text-4xl font-black text-center px-6 leading-tight opacity-40">
                        {book.title}
                      </span>
                    </div>
                  )}

                  {/* Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-8 sm:p-10 pointer-events-none">
                    {book.progressPercent != null &&
                      book.progressPercent > 0 && (
                        <div className="w-full bg-white/20 rounded-full h-3 mb-2 overflow-hidden shadow-inner">
                          <div
                            className="bg-white h-full rounded-full"
                            style={{ width: `${book.progressPercent}%` }}
                          />
                        </div>
                      )}
                  </div>

                  {/* Play/Open Button (Center) */}
                  <div className="play-btn absolute inset-0 flex items-center justify-center opacity-0 pointer-events-none">
                    <Link
                      href={`/books/${book.id}/reader`}
                      className="w-20 h-20 sm:w-28 sm:h-28 bg-white text-zinc-900 rounded-full flex items-center justify-center shadow-[0_15px_30px_rgba(0,0,0,0.5)] hover:scale-110 hover:bg-zinc-100 active:scale-95 transition-all disabled:opacity-50"
                      onClick={(e) => e.stopPropagation()}
                      draggable={false}
                    >
                      <svg
                        className="w-10 h-10 sm:w-14 sm:h-14 ml-1 sm:ml-2"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </Link>
                  </div>

                  {/* Badges */}
                  {book.hasSoundscape && (
                    <div className="absolute top-6 right-6 sm:top-8 sm:right-8 w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-2xl text-2xl z-10 pointer-events-none">
                      🔊
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Manual Navigation Controls — flanking the carousel */}
      {books.length > 0 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            disabled={activeIndex === 0}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-[150] pointer-events-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black/50 border border-white/20 text-white flex items-center justify-center shadow-xl active:scale-90 transition-all disabled:opacity-0 disabled:pointer-events-none"
          >
            <svg
              className="w-6 h-6 sm:w-8 sm:h-8 mr-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            disabled={activeIndex === books.length - 1}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-[150] pointer-events-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black/50 border border-white/20 text-white flex items-center justify-center shadow-xl active:scale-90 transition-all disabled:opacity-0 disabled:pointer-events-none"
          >
            <svg
              className="w-6 h-6 sm:w-8 sm:h-8 ml-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
