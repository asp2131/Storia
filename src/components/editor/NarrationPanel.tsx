"use client";

// TODO: BookEditorContext.tsx already exists at src/contexts/BookEditorContext.tsx.
// useNarrationContext is exported from that file. The NarrationContext type
// in the live context uses `activeView: ActivePageView` (not `activePage`) and
// `generateSelectedTextNarration` (not `generateNarrationForSelection`).
// The narration-assignment delete is handled here via a prop sourced from
// audioLibrary.handleDeleteAudio — once the provider exposes deleteNarration
// directly on NarrationContext this import can be updated without touching JSX.

import {
  Headphones,
  Pause,
  Play,
  Loader2,
  Wand2,
  Sparkles,
  PlayCircle,
} from "lucide-react";
import { useNarrationContext, useOverlayTextContext } from "@/contexts/BookEditorContext";
import { OverlayTextPanel } from "@/components/editor/OverlayTextPanel";

/**
 * NarrationPanel — the Voice Narration section of the editor right rail.
 *
 * Renders:
 *  - Narration assignment status display + Remove button
 *  - Playback controls (play/pause + volume slider)
 *  - AI Generate section:
 *    - Multi-voice info banner (when overlay voices are active)
 *    - Voice selector dropdown
 *    - Voice settings sliders (speed, style exaggeration, speaker boost toggle)
 *    - "This Page" and "Selected text" generate buttons
 *  - Sync Preview section (word-highlight preview with play/pause)
 *
 * Does NOT include: page management, soundscape/ambient audio, overlay canvas,
 * book metadata, or the sound library.
 */
export function NarrationPanel({
  onDeleteNarration,
}: {
  /**
   * Callback to delete the narration assignment for the active page.
   * Provided externally because NarrationContext does not yet expose a
   * deleteNarration method — it is sourced from audioLibrary.handleDeleteAudio.
   * When the context is updated to include deleteNarration this prop can be
   * removed and the call wired directly.
   */
  onDeleteNarration: () => void;
}) {
  const {
    activeView,
    voiceOptions,
    selectedVoiceId,
    setSelectedVoiceId,
    voicesLoading,
    voiceSettings,
    setVoiceSettings,
    generating: generatingNarration,
    generatingPhase: overlayNarrationPhase,
    generateNarration: handleGenerateNarration,
    generateSelectedTextNarration: handleGenerateSelectedTextNarration,
    selectedOverlayElement,
    isNarrationPlaying,
    narrationVolume,
    setNarrationVolume,
    toggleNarration,
    wordTimestamps,
    activeWordIndex,
    showSyncPreview,
    setShowSyncPreview,
  } = useNarrationContext();
  const { hasIncludedEntries } = useOverlayTextContext();

  const activePageData = activeView.data;
  const narrationActiveUrl = activeView.narrationUrl;
  const activePageUsesOverlayVoices = activeView.usesOverlayVoices;
  const narrationAssignment = activeView.assignments.narration;

  return (
    /* ── Voice Narration ──────────────────────────────────── */
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.07em] text-zinc-400">
        <Headphones className="h-3.5 w-3.5 text-[var(--editor-accent)]" />
        Narration
      </h4>

      <div className="space-y-4 rounded-[13px] border border-zinc-200 bg-white p-4 shadow-sm">
        {(narrationAssignment?.audioUrl || narrationActiveUrl) ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-semibold text-green-700">Assigned</span>
              </div>
              <button
                type="button"
                onClick={onDeleteNarration}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-300" />
            <span className="text-xs text-slate-500">No narration for this page</span>
          </div>
        )}

        {narrationActiveUrl && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleNarration}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--editor-accent)] text-white shadow-sm transition hover:brightness-105"
            >
              {isNarrationPlaying ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5 ml-0.5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(narrationVolume * 100)}
              onChange={(e) => setNarrationVolume(Number(e.target.value) / 100)}
              className="editor-range flex-1"
            />
          </div>
        )}

        {/* AI Generate */}
        <div className="space-y-3 border-t border-zinc-100 pt-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--editor-accent)]">
            <Wand2 className="w-3.5 h-3.5" />
            Generate with AI
          </span>
          {activePageUsesOverlayVoices ? (
            <div className="rounded-lg border border-[var(--editor-accent-soft)] bg-[var(--editor-accent-faint)] px-2.5 py-2 text-[11px] text-[var(--editor-accent)]">
              Multi-voice mode is active for this page. Voices are taken from each overlay text block.
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Voice
              </label>
              <select
                value={selectedVoiceId}
                onChange={(e) => setSelectedVoiceId(e.target.value)}
                disabled={voicesLoading || voiceOptions.length === 0}
                className="w-full rounded-[9px] border border-zinc-200 bg-[#fbfbfc] px-3 py-2 text-xs text-zinc-700 outline-none focus:border-[var(--editor-accent)] disabled:opacity-60"
              >
                {voiceOptions.length === 0 ? (
                  <option value="">{voicesLoading ? "Loading voices..." : "Default voice"}</option>
                ) : (
                  voiceOptions.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}{voice.category ? ` (${voice.category})` : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
          <div className="space-y-3 rounded-[9px] border border-zinc-200 bg-zinc-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Voice settings
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-600">
                <span>Speed</span>
                <span>{voiceSettings.speed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.2"
                step="0.01"
                value={voiceSettings.speed}
                onChange={(e) =>
                  setVoiceSettings((prev) => ({
                    ...prev,
                    speed: Number(e.target.value),
                  }))
                }
                className="editor-range w-full"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-600">
                <span>Style exaggeration</span>
                <span>{voiceSettings.style.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={voiceSettings.style}
                onChange={(e) =>
                  setVoiceSettings((prev) => ({
                    ...prev,
                    style: Number(e.target.value),
                  }))
                }
                className="editor-range w-full"
              />
            </div>

            <label className="flex items-center justify-between text-[11px] text-slate-700">
              <span>Speaker boost</span>
              <button
                type="button"
                onClick={() =>
                  setVoiceSettings((prev) => ({
                    ...prev,
                    useSpeakerBoost: !prev.useSpeakerBoost,
                  }))
                }
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  voiceSettings.useSpeakerBoost ? "bg-[var(--editor-accent)]" : "bg-zinc-300"
                }`}
                aria-pressed={voiceSettings.useSpeakerBoost}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    voiceSettings.useSpeakerBoost ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
          </div>

          <OverlayTextPanel />

          {!activePageData?.text?.trim() && !hasIncludedEntries && (
            <p className="text-[10px] italic text-zinc-400">
              Add page text or include overlay text first to generate narration.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleGenerateNarration()}
              disabled={generatingNarration || (!activePageData?.text?.trim() && !hasIncludedEntries)}
              className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-[var(--editor-accent)] py-2.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generatingNarration ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {overlayNarrationPhase === "stitching"
                    ? "Stitching audio..."
                    : overlayNarrationPhase === "saving"
                    ? "Saving..."
                    : "Generating voices..."}
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  This Page
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleGenerateSelectedTextNarration}
              disabled={
                generatingNarration ||
                !selectedOverlayElement?.id ||
                !selectedOverlayElement.text?.trim()
              }
              className="flex items-center justify-center gap-2 rounded-[10px] border border-[var(--editor-accent-soft)] bg-[var(--editor-accent-soft)] px-3 py-2.5 text-xs font-semibold text-[var(--editor-accent)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />Selected text
            </button>
          </div>
          {!selectedOverlayElement?.id && (
            <p className="text-[10px] italic text-zinc-400">
              Select a text instance in the overlay editor to enable &quot;Selected text&quot;.
            </p>
          )}
        </div>

        {/* Sync preview */}
        {wordTimestamps.length > 0 && (
          <div className="space-y-2 border-t border-zinc-100 pt-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--editor-accent)]">
                <PlayCircle className="w-3.5 h-3.5" /> Sync Preview
              </span>
              <button
                type="button"
                onClick={() => setShowSyncPreview(!showSyncPreview)}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-700"
              >
                {showSyncPreview ? "Hide" : "Show"}
              </button>
            </div>
            {showSyncPreview && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={toggleNarration}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--editor-accent)] text-white"
                  >
                    {isNarrationPlaying ? (
                      <Pause className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3 ml-0.5" />
                    )}
                  </button>
                  <span className="text-[10px] text-slate-500">
                    {isNarrationPlaying ? "Playing..." : "Click to preview"}
                  </span>
                </div>
                <div className="max-h-32 overflow-y-auto">
                  <p className="text-sm leading-relaxed text-slate-700 font-serif">
                    {wordTimestamps.map((wd, i) => (
                      <span
                        key={i}
                        className={`transition-all duration-150 ${
                          i === activeWordIndex && isNarrationPlaying
                            ? "bg-orange-300 text-orange-900 rounded px-0.5 font-semibold"
                            : ""
                        }`}
                      >
                        {wd.word}{" "}
                      </span>
                    ))}
                  </p>
                </div>
                <div className="mt-2 text-[10px] text-slate-500">
                  {wordTimestamps.length} words synced
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
