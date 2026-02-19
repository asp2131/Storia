type ReaderOutroProps = {
  title: string;
  onFeedback: () => void;
  onBackToLibrary: () => void;
  onReadAgain: () => void;
};

export default function ReaderOutro({
  title,
  onFeedback,
  onBackToLibrary,
  onReadAgain,
}: ReaderOutroProps) {
  return (
    <section
      className="h-screen flex flex-col items-center justify-center gap-8 px-6"
      style={{ backgroundColor: "var(--reader-bg)" }}
    >
      <div className="text-center space-y-4">
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl"
          style={{ backgroundColor: "var(--reader-card-bg)" }}
        >
          &#10024;
        </div>
        <h2 className="text-2xl font-bold" style={{ color: "var(--reader-text)" }}>
          The End
        </h2>
        <p
          className="text-sm max-w-sm mx-auto leading-relaxed"
          style={{ color: "var(--reader-text-secondary)" }}
        >
          You&apos;ve finished reading &ldquo;{title}&rdquo;
        </p>
      </div>
      <div className="flex flex-col gap-3 items-center w-full max-w-xs">
        <button
          onClick={onFeedback}
          className="w-full px-6 py-3 rounded-full text-sm font-semibold transition-all hover:scale-[1.03] active:scale-[0.98]"
          style={{
            backgroundColor: "var(--reader-nav-btn-bg)",
            color: "var(--reader-nav-btn-text)",
          }}
        >
          Share Feedback
        </button>
        <button
          onClick={onBackToLibrary}
          className="w-full px-6 py-2.5 rounded-full text-sm font-medium border transition-all hover:scale-[1.03] active:scale-[0.98]"
          style={{
            borderColor: "var(--reader-progress-bar-bg)",
            color: "var(--reader-text-secondary)",
          }}
        >
          Back to Library
        </button>
        <button
          onClick={onReadAgain}
          className="mt-2 text-xs underline underline-offset-4 transition-opacity hover:opacity-80"
          style={{ color: "var(--reader-text-secondary)" }}
        >
          Read again
        </button>
      </div>
    </section>
  );
}
