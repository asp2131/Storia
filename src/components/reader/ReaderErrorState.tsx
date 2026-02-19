type ReaderErrorStateProps = {
  error: string;
  onGoBack: () => void;
};

export default function ReaderErrorState({
  error,
  onGoBack,
}: ReaderErrorStateProps) {
  return (
    <div
      className="h-screen flex items-center justify-center"
      style={{ backgroundColor: "var(--reader-bg)" }}
    >
      <div className="text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={onGoBack}
          className="font-medium"
          style={{ color: "var(--reader-nav-btn-bg)" }}
        >
          Go back
        </button>
      </div>
    </div>
  );
}
