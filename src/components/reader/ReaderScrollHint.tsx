import { ChevronDown } from "lucide-react";

type ReaderScrollHintProps = {
  totalPages: number;
  activeIndex: number;
};

export default function ReaderScrollHint({
  totalPages,
  activeIndex,
}: ReaderScrollHintProps) {
  if (totalPages <= 1) return null;

  return (
    <div
      className="fixed bottom-8 left-1/2 z-30 pointer-events-none flex flex-col items-center gap-1.5 transition-opacity duration-500"
      style={{
        opacity: activeIndex === 0 ? 0.7 : 0,
        transform: "translateX(-50%)",
      }}
    >
      <span
        className="text-[11px] tracking-wide uppercase font-medium"
        style={{ color: "var(--reader-text-secondary)" }}
      >
        Swipe up next page
      </span>
      <ChevronDown
        className="w-5 h-5 animate-bounce"
        style={{ color: "var(--reader-text-secondary)" }}
      />
    </div>
  );
}
