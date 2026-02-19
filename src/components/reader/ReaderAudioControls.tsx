import { Mic, Music, Pause } from "lucide-react";
import type { SoundscapeMode } from "@/hooks/useLocalPreferences";

type ReaderAudioControlsProps = {
  narrationUrl: string | null | undefined;
  soundscapeUrl: string | null | undefined;
  isNarrationPlaying: boolean;
  isSoundscapePlaying: boolean;
  soundscapeMode: SoundscapeMode;
  onToggleNarration: () => void;
  onToggleSoundscape: () => void;
  onChangeSoundscapeMode: (mode: SoundscapeMode) => void;
};

export default function ReaderAudioControls({
  narrationUrl,
  soundscapeUrl,
  isNarrationPlaying,
  isSoundscapePlaying,
  soundscapeMode,
  onToggleNarration,
  onToggleSoundscape,
  onChangeSoundscapeMode,
}: ReaderAudioControlsProps) {
  const isVisible = Boolean(narrationUrl || soundscapeUrl);

  return (
    <div
      className="fixed top-14 left-1/2 -translate-x-1/2 z-40 w-[min(620px,calc(100%-3rem))] transition-opacity duration-200"
      style={{
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? "auto" : "none",
      }}
    >
      <div className="mx-auto flex items-center justify-center gap-2">
        <button
          onClick={onToggleNarration}
          className={`flex items-center gap-2 py-1.5 px-3 backdrop-blur-xl border rounded-full shadow-lg transition-all ${
            isNarrationPlaying
              ? "bg-orange-500/90 border-orange-400/60 text-white"
              : "bg-black/60 border-white/15 text-slate-200 hover:bg-black/70"
          }`}
          style={{ display: narrationUrl ? undefined : "none" }}
        >
          {isNarrationPlaying ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Mic className="w-3.5 h-3.5" />
          )}
          <span className="text-[10px] font-semibold">
            {isNarrationPlaying ? "Reading" : "Read"}
          </span>
        </button>

        <button
          onClick={onToggleSoundscape}
          className="flex items-center gap-3 py-1.5 pl-3 pr-1.5 bg-black/60 backdrop-blur-xl border border-white/15 rounded-full shadow-lg overflow-hidden transition-all hover:bg-black/70"
          style={{ display: soundscapeUrl ? undefined : "none" }}
        >
          <div className="flex items-center gap-2">
            {isSoundscapePlaying ? (
              <Pause className="w-4 h-4 text-teal-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.3)]" />
            ) : (
              <Music className="w-4 h-4 text-slate-200" />
            )}
            {isSoundscapePlaying && (
              <div className="flex items-end gap-0.5 h-3">
                <div
                  className="w-0.5 bg-teal-400/80 rounded-full animate-sound-wave-1"
                  style={{ height: "6px" }}
                />
                <div
                  className="w-0.5 bg-teal-400/80 rounded-full animate-sound-wave-2"
                  style={{ height: "12px" }}
                />
                <div
                  className="w-0.5 bg-teal-400/80 rounded-full animate-sound-wave-3"
                  style={{ height: "8px" }}
                />
              </div>
            )}
          </div>
          <div className="flex items-center bg-black/50 rounded-full p-0.5 gap-0.5 border border-white/10">
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChangeSoundscapeMode("intro-only");
              }}
              className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer transition-all ${
                soundscapeMode === "intro-only"
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              Intro
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChangeSoundscapeMode("continuous");
              }}
              className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer transition-all ${
                soundscapeMode === "continuous"
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              Loop
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
