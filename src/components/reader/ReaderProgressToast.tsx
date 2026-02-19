import { Bookmark } from "lucide-react";

type ReaderProgressToastProps = {
  message: string | null;
};

export default function ReaderProgressToast({ message }: ReaderProgressToastProps) {
  return (
    <div
      className={`fixed top-16 left-1/2 -translate-x-1/2 pointer-events-none z-[60] transition-all duration-500 ${
        message ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
      }`}
    >
      <div className="bg-teal-600/90 backdrop-blur text-white text-sm px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 border border-teal-400/30">
        <Bookmark className="w-4 h-4 text-teal-200" />
        <span className="font-medium">{message}</span>
      </div>
    </div>
  );
}
