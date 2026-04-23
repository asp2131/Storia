import { Mic, Music, Pause, Play, Volume1, Volume2, Wand2, X } from "lucide-react";
import type { PronunciationMode, SoundscapeMode } from "@/hooks/useLocalPreferences";

type ReaderSettingsPanelProps = {
  open: boolean;
  narrationUrl: string | null | undefined;
  soundscapeUrl: string | null | undefined;
  isNarrationPlaying: boolean;
  isSoundscapePlaying: boolean;
  narrationVolume: number;
  soundscapeVolume: number;
  soundscapeMode: SoundscapeMode;
  pronunciationMode: PronunciationMode;
  pronunciationEnabled: boolean;
  onClose: () => void;
  onToggleNarration: () => void;
  onToggleSoundscape: () => void;
  onNarrationVolumeChange: (volume: number) => void;
  onSoundscapeVolumeChange: (volume: number) => void;
  onChangeSoundscapeMode: (mode: SoundscapeMode) => void;
  onChangePronunciationMode: (mode: PronunciationMode) => void;
};

export default function ReaderSettingsPanel({
  open,
  narrationUrl,
  soundscapeUrl,
  isNarrationPlaying,
  isSoundscapePlaying,
  narrationVolume,
  soundscapeVolume,
  soundscapeMode,
  pronunciationMode,
  pronunciationEnabled,
  onClose,
  onToggleNarration,
  onToggleSoundscape,
  onNarrationVolumeChange,
  onSoundscapeVolumeChange,
  onChangeSoundscapeMode,
  onChangePronunciationMode,
}: ReaderSettingsPanelProps) {
  return (
    <div
      className="fixed inset-0 z-[70] transition-opacity duration-200"
      style={{
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        visibility: open ? "visible" : "hidden",
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute right-0 top-0 bottom-0 flex w-full max-w-sm flex-col border-l border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-md transition-transform duration-300"
        style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/20">
                <Mic className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Narration</h3>
                <p className="text-xs text-slate-400">Voice reading</p>
              </div>
            </div>
            {narrationUrl ? (
              <div className="space-y-3 pl-[52px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-300">Playback</span>
                  <button
                    onClick={onToggleNarration}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
                      isNarrationPlaying
                        ? "bg-orange-500 text-white"
                        : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {isNarrationPlaying ? (
                      <>
                        <Pause className="h-4 w-4" />
                        Playing
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Play
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <Volume1 className="h-4 w-4 text-slate-400" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(narrationVolume * 100)}
                    onChange={(e) => onNarrationVolumeChange(Number(e.target.value) / 100)}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-orange-500"
                    aria-label="Narration volume"
                  />
                  <Volume2 className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            ) : (
              <p className="pl-[52px] text-sm italic text-slate-500">No narration for this page</p>
            )}
          </div>

          {pronunciationEnabled ? (
            <>
              <div className="border-t border-white/10" />
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/20">
                    <Wand2 className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Word Help</h3>
                    <p className="text-xs text-slate-400">Choose what a word tap does</p>
                  </div>
                </div>
                <div className="space-y-3 pl-[52px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-300">Tap behavior</span>
                    <div className="flex items-center gap-1 rounded-full bg-white/10 p-1">
                      <button
                        onClick={() => onChangePronunciationMode("tap-whole-word")}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                          pronunciationMode === "tap-whole-word"
                            ? "bg-violet-500 text-white"
                            : "text-slate-400"
                        }`}
                        aria-pressed={pronunciationMode === "tap-whole-word"}
                      >
                        Whole word
                      </button>
                      <button
                        onClick={() => onChangePronunciationMode("tap-breakdown")}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                          pronunciationMode === "tap-breakdown"
                            ? "bg-violet-500 text-white"
                            : "text-slate-400"
                        }`}
                        aria-pressed={pronunciationMode === "tap-breakdown"}
                      >
                        Sound out
                      </button>
                    </div>
                  </div>
                  <p className="text-xs leading-5 text-slate-400">
                    Tap plays the selected word help. Long-press still sounds out a word,
                    and each focused word exposes a secondary <span className="font-medium text-white">Sound out</span> control for keyboard and screen-reader access.
                  </p>
                </div>
              </div>
            </>
          ) : null}

          <div className="border-t border-white/10" />

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/20">
                <Music className="h-5 w-5 text-teal-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Soundscape</h3>
                <p className="text-xs text-slate-400">Ambient audio</p>
              </div>
            </div>
            {soundscapeUrl ? (
              <div className="space-y-3 pl-[52px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-300">Playback</span>
                  <button
                    onClick={onToggleSoundscape}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
                      isSoundscapePlaying
                        ? "bg-teal-500 text-white"
                        : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {isSoundscapePlaying ? (
                      <>
                        <Pause className="h-4 w-4" />
                        Playing
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Play
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <Volume1 className="h-4 w-4 text-slate-400" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(soundscapeVolume * 100)}
                    onChange={(e) => onSoundscapeVolumeChange(Number(e.target.value) / 100)}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-teal-500"
                    aria-label="Soundscape volume"
                  />
                  <Volume2 className="h-4 w-4 text-slate-400" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-300">Mode</span>
                  <div className="flex items-center gap-1 rounded-full bg-white/10 p-1">
                    <button
                      onClick={() => onChangeSoundscapeMode("intro-only")}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        soundscapeMode === "intro-only"
                          ? "bg-teal-500 text-white"
                          : "text-slate-400"
                      }`}
                      aria-pressed={soundscapeMode === "intro-only"}
                    >
                      One-shot
                    </button>
                    <button
                      onClick={() => onChangeSoundscapeMode("continuous")}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        soundscapeMode === "continuous"
                          ? "bg-teal-500 text-white"
                          : "text-slate-400"
                      }`}
                      aria-pressed={soundscapeMode === "continuous"}
                    >
                      Loop
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="pl-[52px] text-sm italic text-slate-500">No soundscape for this page</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
