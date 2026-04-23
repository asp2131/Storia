import type { RefObject } from "react";
import IntegratedIllustration from "@/components/IntegratedIllustration";
import type { PageData } from "@/hooks/useBookData";

type ReaderStageProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  pages: PageData[];
  activeIndex: number;
  activeWordIndex: number;
  pronouncingIndex: number | null;
  onWordPrimaryAction: (word: string, index: number) => void;
  onWordSecondaryAction: (word: string, index: number) => void;
  setPageRef: (index: number, el: HTMLDivElement | null) => void;
};

export default function ReaderStage({
  containerRef,
  pages,
  activeIndex,
  activeWordIndex,
  pronouncingIndex,
  onWordPrimaryAction,
  onWordSecondaryAction,
  setPageRef,
}: ReaderStageProps) {
  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden"
    >
      {pages.map((page, index) => {
        const isInWindow = Math.abs(index - activeIndex) <= 2;

        return (
          <div
            key={page.id}
            ref={(el) => setPageRef(index, el)}
            className="absolute inset-0 w-full h-full will-change-[clip-path,transform,opacity]"
            style={{
              clipPath:
                index === 0
                  ? "inset(0% 0% 0% 0%)"
                  : "inset(100% 0% 0% 0%)",
              zIndex: index,
            }}
          >
            <div
              data-illustration
              className="w-full h-full flex items-center justify-center p-4 pt-20 pb-6"
            >
              {isInWindow ? (
                page.imageUrl || page.compositedImageUrl ? (
                  <div className="max-w-full max-h-full w-full h-full flex items-center justify-center">
                    <div className="w-full h-full max-w-5xl md:max-w-2xl max-h-[calc(100vh-7rem)] md:max-h-[calc(100vh-10rem)] flex items-center justify-center">
                      <div className="w-full max-h-full">
                        <IntegratedIllustration
                          imageUrl={page.imageUrl || ""}
                          compositedImageUrl={page.compositedImageUrl || null}
                          overlay={page.overlay || null}
                          alt={`Page ${page.pageNumber}`}
                          preferDynamicOverlay
                          activeWordIndex={
                            index === activeIndex ? activeWordIndex : -1
                          }
                          pronouncingWordIndex={
                            index === activeIndex ? pronouncingIndex : null
                          }
                          onWordPrimaryAction={
                            index === activeIndex ? onWordPrimaryAction : undefined
                          }
                          onWordSecondaryAction={
                            index === activeIndex ? onWordSecondaryAction : undefined
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="w-full max-w-2xl aspect-[3/4] rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "var(--reader-card-bg)" }}
                  >
                    <span style={{ color: "var(--reader-text-secondary)" }}>
                      No illustration
                    </span>
                  </div>
                )
              ) : (
                <div
                  className="w-full max-w-2xl aspect-[3/4] rounded-xl"
                  style={{ backgroundColor: "var(--reader-card-bg)" }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
