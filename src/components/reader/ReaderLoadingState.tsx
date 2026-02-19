import { Loader2 } from "lucide-react";

export default function ReaderLoadingState() {
  return (
    <div
      className="h-screen flex items-center justify-center"
      style={{ backgroundColor: "var(--reader-bg)" }}
    >
      <div className="flex flex-col items-center gap-4">
        <Loader2
          className="w-8 h-8 animate-spin"
          style={{ color: "var(--reader-progress-bar-fill)" }}
        />
        <span style={{ color: "var(--reader-text-secondary)" }}>
          Loading book...
        </span>
      </div>
    </div>
  );
}
