"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ReactLenis } from "lenis/react";
import IntegratedIllustration from "@/components/IntegratedIllustration";
import { useReaderData } from "@/hooks/useBookData";
import styles from "./scroll-reader.module.css";

gsap.registerPlugin(ScrollTrigger);

type LenisRefLike = {
  lenis?: {
    raf: (time: number) => void;
    on: (event: string, callback: () => void) => void;
    off?: (event: string, callback: () => void) => void;
  };
};

export default function ScrollReaderPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;
  const lenisRef = useRef<LenisRefLike | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const [activePage, setActivePage] = useState(1);

  const { data: readerData, isLoading: loading, error: queryError } = useReaderData(bookId);
  const error = queryError?.message || null;

  const pages = useMemo(
    () => [...(readerData?.pages ?? [])].sort((a, b) => a.pageNumber - b.pageNumber),
    [readerData?.pages]
  );
  const totalPages = pages.length;

  useEffect(() => {
    let rafId = 0;
    let update: ((time: number) => void) | null = null;
    let onScroll: (() => void) | null = null;
    let currentLenis: LenisRefLike["lenis"] | undefined;

    const setupLenis = () => {
      currentLenis = lenisRef.current?.lenis;
      if (!currentLenis) {
        rafId = requestAnimationFrame(setupLenis);
        return;
      }

      onScroll = () => ScrollTrigger.update();
      currentLenis.on("scroll", onScroll);

      update = (time: number) => {
        currentLenis?.raf(time * 1000);
      };
      gsap.ticker.add(update);
      gsap.ticker.lagSmoothing(0);
    };

    setupLenis();

    return () => {
      cancelAnimationFrame(rafId);
      if (update) gsap.ticker.remove(update);
      if (currentLenis && onScroll && currentLenis.off) currentLenis.off("scroll", onScroll);
    };
  }, []);

  useGSAP(
    () => {
      const container = containerRef.current;
      if (!container || pages.length === 0) return;

      const sections = gsap.utils.toArray<HTMLElement>("[data-scroll-section]", container);

      sections.forEach((section, index) => {
        const panel = section.querySelector<HTMLElement>("[data-scroll-panel]");
        const pageNumber = Number(section.dataset.pageNumber ?? index + 1);

        if (panel) {
          gsap.fromTo(
            panel,
            {
              rotate: index === 0 ? 0 : index % 2 === 0 ? 11 : -11,
              yPercent: index === 0 ? 0 : 7,
            },
            {
              rotate: 0,
              yPercent: 0,
              ease: "none",
              scrollTrigger: {
                trigger: section,
                start: "top bottom",
                end: "top 22%",
                scrub: true,
              },
            }
          );
        }

        ScrollTrigger.create({
          trigger: section,
          start: "top center",
          end: "bottom center",
          onEnter: () => setActivePage(pageNumber),
          onEnterBack: () => setActivePage(pageNumber),
        });

        if (index === sections.length - 1) return;
        ScrollTrigger.create({
          trigger: section,
          start: "bottom bottom",
          end: "bottom top",
          pin: true,
          pinSpacing: false,
        });
      });
    },
    { scope: containerRef, dependencies: [pages] }
  );

  if (loading) {
    return (
      <div className={styles.loader}>
        <Loader2 className="w-8 h-8 animate-spin" />
        <span>Loading scroll reader...</span>
      </div>
    );
  }

  if (error || !readerData) {
    return (
      <div className={styles.loader}>
        <p>{error || "Book not found"}</p>
        <button className={styles.backBtn} onClick={() => router.back()}>
          Go back
        </button>
      </div>
    );
  }

  return (
    <>
      <ReactLenis root options={{ autoRaf: false, smoothWheel: true, lerp: 0.09 }} ref={lenisRef} />
      <header className={styles.floatingHeader}>
        <button className={styles.headerBtn} onClick={() => router.back()} aria-label="Close scroll reader">
          <X className="w-5 h-5" />
        </button>
        <div className={styles.headerMeta}>
          <span>{readerData.book.title}</span>
          <span>
            {activePage}/{totalPages}
          </span>
        </div>
        <button
          className={styles.headerBtn}
          onClick={() => router.push(`/books/${bookId}/reader`)}
          aria-label="Switch to classic reader"
        >
          Classic
        </button>
      </header>

      <main ref={containerRef} className={styles.main}>
        {pages.map((page, index) => (
          <section
            key={page.id}
            data-scroll-section
            data-page-number={page.pageNumber}
            className={`${styles.section} ${index % 2 === 0 ? styles.themeA : styles.themeB}`}
          >
            <div data-scroll-panel className={styles.panel}>
              <div className={styles.panelCol}>
                <div className={styles.panelLabel}>Page {page.pageNumber}</div>
                <h2>{index === 0 ? readerData.book.title : "Story Portal"}</h2>
                <p>{page.textContent || "No text content available for this page yet."}</p>
              </div>
              <div className={styles.panelCol}>
                <div className={styles.imageWrap}>
                  {page.imageUrl || page.compositedImageUrl ? (
                    <IntegratedIllustration
                      imageUrl={page.imageUrl || ""}
                      compositedImageUrl={page.compositedImageUrl || null}
                      overlay={page.overlay || null}
                      alt={`Page ${page.pageNumber}`}
                      preferDynamicOverlay
                    />
                  ) : (
                    <div className={styles.emptyImage}>No illustration</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ))}
        <footer className={styles.footer}>
          <h2>End of Story</h2>
          <button className={styles.footerBtn} onClick={() => router.push(`/books/${bookId}/reader`)}>
            Back to classic reader
          </button>
        </footer>
      </main>
    </>
  );
}
