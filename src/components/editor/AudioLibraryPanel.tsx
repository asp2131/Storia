"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileAudio,
  FolderOpen,
  GripHorizontal,
  Headphones,
  Loader2,
  Music,
  Pause,
  Play,
  Layers,
  Upload,
} from "lucide-react";
import {
  useNarrationContext,
  useAudioLibraryContext,
  usePageManagerContext,
} from "@/contexts/BookEditorContext";
import { ElementInspectorPanel } from "@/components/editor/ElementInspectorPanel";
import { PronunciationPanel } from "@/components/editor/PronunciationPanel";
import { NarrationPanel } from "@/components/editor/NarrationPanel";

export function AudioLibraryPanel() {
  const params = useParams();
  const bookId = params.id as string;
  const { selectedVoiceId, voiceSettings } = useNarrationContext();
  const audioLibrary = useAudioLibraryContext();
  const { localPages, activeView } = usePageManagerContext();

  const {
    libraryLoading,
    libraryOpen,
    setLibraryOpen,
    selectedCategory,
    setSelectedCategory,
    librarySearch,
    setLibrarySearch,
    filteredLibrarySounds,
    libraryPreviewUrl,
    toggleLibraryPreview,
    handleDragStart,
    handleDragEnd,
    dropAssignment,
    setDropAssignment,
    dropRangeStart,
    setDropRangeStart,
    dropRangeEnd,
    setDropRangeEnd,
    dropScope,
    setDropScope,
    confirmDropAssignment,
    assignAudioPending,
    soundscapeUrlInput,
    setSoundscapeUrlInput,
    soundscapeScope,
    setSoundscapeScope,
    soundscapeRangeStart,
    setSoundscapeRangeStart,
    soundscapeRangeEnd,
    setSoundscapeRangeEnd,
    isSoundscapePlaying,
    soundscapeVolume,
    setSoundscapeVolume,
    toggleSoundscape,
    handleAssignAudio,
    handleDeleteAudio,
    uploadAudioPending,
    audioUploadDragging,
    setAudioUploadDragging,
    handleAudioDropZone,
    audioInputRef,
  } = audioLibrary;

  const soundscapeActiveUrl = activeView.soundscapeUrl;
  const soundscapeAssignment = activeView.assignments.soundscape;
  const activeAssignments = {
    soundscape: soundscapeAssignment
      ? {
          url: soundscapeAssignment.audioUrl,
          scope: soundscapeAssignment.scope,
          range:
            soundscapeAssignment.scope === "range" &&
            soundscapeAssignment.rangeStart != null &&
            soundscapeAssignment.rangeEnd != null
              ? `${soundscapeAssignment.rangeStart}-${soundscapeAssignment.rangeEnd}`
              : "current",
        }
      : undefined,
  };
  // Text styling happens on the canvas, so selecting a box never changes tabs:
  // Audio can narrate just the selected box.
  const [visibleTab, selectTab] = useState<"element" | "audio" | "words">("element");

  return (
    <>
      {/* ─── RIGHT SIDEBAR: Tabbed Audio Panel ─────────────────── */}
      <aside className="z-20 flex w-[344px] shrink-0 flex-col border-l border-zinc-200/80 bg-white max-[1180px]:w-72 max-[600px]:hidden">
        <div className="shrink-0 px-3.5 pb-3 pt-3.5">
          <div className="flex w-full gap-1 rounded-[10px] bg-zinc-100 p-1">
            {[
              { id: "element" as const, label: "Layers", icon: Layers },
              { id: "audio" as const, label: "Audio", icon: Headphones },
              { id: "words" as const, label: "Words", icon: BookOpen },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                className={`flex h-[34px] flex-1 items-center justify-center gap-1.5 rounded-[7px] px-2 text-[12.5px] font-semibold transition ${
                  visibleTab === tab.id
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:bg-white/60 hover:text-zinc-700"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="editor-scroll flex-1 space-y-5 overflow-y-auto px-4 pb-6 pt-1">
          {visibleTab === "element" && <ElementInspectorPanel />}

          {visibleTab === "audio" && (
            <div className="editor-pop space-y-6">
              <NarrationPanel onDeleteNarration={() => handleDeleteAudio("narration")} />

              {/* ── Ambient Soundscape ───────────────────────────────── */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-zinc-400"><Music className="h-3.5 w-3.5" />Background sound</h4>

                <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
                  {activeAssignments?.soundscape ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-xs font-semibold text-emerald-700">Playing on this page</span>
                        {activeAssignments.soundscape.scope === "range" && (
                          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                            Pages {activeAssignments.soundscape.range}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAudio("soundscape")}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}

                  {soundscapeActiveUrl && (
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={toggleSoundscape} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--editor-accent)] text-[var(--editor-on-accent)] shadow-sm hover:brightness-105">
                        {isSoundscapePlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                      </button>
                      <input
                        type="range" min="0" max="100"
                        value={Math.round(soundscapeVolume * 100)}
                        onChange={(e) => setSoundscapeVolume(Number(e.target.value) / 100)}
                        aria-label="Background sound volume"
                        className="editor-range flex-1"
                      />
                    </div>
                  )}

                  {/* Upload Audio */}
                  <div className="space-y-3 border-t border-zinc-100 pt-3 first:border-t-0 first:pt-0">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                      <Upload className="w-3.5 h-3.5" />
                      Upload audio
                    </span>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setAudioUploadDragging(true); }}
                      onDragLeave={() => setAudioUploadDragging(false)}
                      onDrop={handleAudioDropZone}
                      onClick={() => audioInputRef.current?.click()}
                      className={`rounded-lg border-2 border-dashed p-4 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                        audioUploadDragging
                          ? "border-[var(--editor-accent)] bg-[var(--editor-accent-faint)]"
                          : "border-zinc-200 hover:border-[var(--editor-accent)] hover:bg-[var(--editor-accent-faint)]"
                      }`}
                    >
                      {uploadAudioPending ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin text-[var(--editor-accent)]" />
                          <span className="text-[11px] text-zinc-600">Uploading…</span>
                        </>
                      ) : (
                        <>
                          <FileAudio className="h-5 w-5 text-zinc-400" />
                          <span className="text-center text-[11px] text-zinc-600">
                            Drop audio file or click to browse
                          </span>
                          <span className="text-[10px] text-zinc-400">MP3, WAV, OGG, FLAC · up to 50 MB</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* URL input */}
                  <div className="space-y-3 border-t border-zinc-100 pt-3">
                    <span className="text-xs font-semibold text-zinc-700">Or paste a link</span>
                    <input
                      value={soundscapeUrlInput}
                      onChange={(e) => setSoundscapeUrlInput(e.target.value)}
                      placeholder="https://…/rain.mp3"
                      className="w-full rounded-[9px] border border-zinc-200 bg-[#fbfbfc] px-3 py-2 text-xs text-zinc-700 outline-none focus:border-[var(--editor-accent)] focus:bg-white focus:ring-2 focus:ring-[var(--editor-accent-faint)]"
                    />
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setSoundscapeScope("current")} className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${soundscapeScope === "current" ? "border-[var(--editor-accent)] bg-[var(--editor-accent-soft)] text-[var(--editor-accent)]" : "border-zinc-200 bg-white text-zinc-600"}`}>
                        This page
                      </button>
                      <button type="button" onClick={() => setSoundscapeScope("range")} className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${soundscapeScope === "range" ? "border-[var(--editor-accent)] bg-[var(--editor-accent-soft)] text-[var(--editor-accent)]" : "border-zinc-200 bg-white text-zinc-600"}`}>
                        Page range
                      </button>
                      {soundscapeScope === "range" && (
                        <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                          <input type="number" min={1} max={localPages.length} value={soundscapeRangeStart} onChange={(e) => setSoundscapeRangeStart(Number(e.target.value))} className="w-14 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs" />
                          <span>to</span>
                          <input type="number" min={soundscapeRangeStart} max={localPages.length} value={soundscapeRangeEnd} onChange={(e) => setSoundscapeRangeEnd(Number(e.target.value))} className="w-14 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs" />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAssignAudio("soundscape", soundscapeUrlInput, soundscapeScope, soundscapeRangeStart, soundscapeRangeEnd)}
                      className="w-full rounded-lg bg-[var(--editor-accent)] py-2 text-xs font-semibold text-[var(--editor-on-accent)] hover:brightness-105 disabled:opacity-40"
                      disabled={!soundscapeUrlInput.trim()}
                    >
                      Assign sound
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Sound Library ────────────────────────────────────── */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setLibraryOpen(!libraryOpen)}
                  className="flex items-center justify-between w-full group"
                >
                  <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-zinc-400">
                    <FolderOpen className="w-3.5 h-3.5" />
                    Sound Library
                  </h4>
                  {libraryOpen ? (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  )}
                </button>

                {libraryOpen && (
                  <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3">
                    {/* Search */}
                    <input
                      value={librarySearch}
                      onChange={(e) => setLibrarySearch(e.target.value)}
                      placeholder="Search sounds…"
                      className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[var(--editor-accent-soft)]"
                    />

                    {libraryLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                      </div>
                    ) : Object.keys(filteredLibrarySounds).length === 0 ? (
                      <div className="text-center py-6 text-xs text-zinc-400">
                        {librarySearch ? "No sounds match your search" : "No sounds in library"}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Category pills */}
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(filteredLibrarySounds).map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSelectedCategory(cat)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition border ${
                                selectedCategory === cat
                                  ? "bg-[var(--editor-accent)] text-[var(--editor-on-accent)] border-[var(--editor-accent)]"
                                  : "bg-white text-zinc-500 border-zinc-200 hover:border-[var(--editor-accent)]"
                              }`}
                            >
                              {cat} ({filteredLibrarySounds[cat].length})
                            </button>
                          ))}
                        </div>

                        {/* Sound list */}
                        {selectedCategory && filteredLibrarySounds[selectedCategory] && (
                          <div className="space-y-1.5 max-h-64 overflow-y-auto">
                            <p className="text-[10px] text-zinc-400 italic">Drag a sound onto a page thumbnail to assign it</p>
                            {filteredLibrarySounds[selectedCategory].map((sound) => (
                              <div
                                key={`${selectedCategory}-${sound.name}`}
                                draggable
                                onDragStart={() => handleDragStart({ ...sound, category: selectedCategory! })}
                                onDragEnd={handleDragEnd}
                                className="flex items-center gap-2 p-2 rounded-lg border border-zinc-200 bg-white hover:border-[var(--editor-accent)] hover:shadow-sm cursor-grab active:cursor-grabbing transition-all group"
                              >
                                <GripHorizontal className="w-3 h-3 text-zinc-300 group-hover:text-[var(--editor-accent)] shrink-0" />
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); toggleLibraryPreview(sound.url); }}
                                  className="w-6 h-6 flex items-center justify-center bg-[var(--editor-accent-faint)] text-[var(--editor-accent)] rounded-full hover:bg-[var(--editor-accent-soft)] shrink-0"
                                >
                                  {libraryPreviewUrl === sound.url ? (
                                    <Pause className="w-3 h-3" />
                                  ) : (
                                    <Play className="w-3 h-3 ml-0.5" />
                                  )}
                                </button>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[11px] font-medium text-zinc-700 truncate">
                                    {sound.name.replace(/_/g, " ").replace(/\.[^.]+$/, "")}
                                  </div>
                                  {sound.size && (
                                    <div className="text-[9px] text-zinc-400">
                                      {(sound.size / 1024 / 1024).toFixed(1)} MB
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSoundscapeUrlInput(sound.url);
                                  }}
                                  className="text-[9px] text-[var(--editor-accent)] hover:text-[var(--editor-accent)] bg-[var(--editor-accent-faint)] hover:bg-[var(--editor-accent-soft)] px-1.5 py-0.5 rounded font-semibold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Use this URL in the assignment field"
                                >
                                  Use
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {visibleTab === "words" && (
            <PronunciationPanel
              bookId={bookId}
              selectedVoiceId={selectedVoiceId}
              voiceSettings={voiceSettings}
            />
          )}
        </div>
      </aside>

      {/* ─── Drop Assignment Dialog (overlay) ─────────────────────── */}
      {dropAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 p-6 w-96 space-y-5">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-zinc-800 flex items-center gap-2">
                <Music className="w-5 h-5 text-[var(--editor-accent)]" />
                Assign background sound
              </h3>
              <p className="text-sm text-zinc-500">
                <span className="font-medium text-zinc-700">{dropAssignment.audioName}</span>
                {" → "}
                Page {dropAssignment.targetPage}
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-zinc-600">Scope</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDropScope("single")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition ${
                    dropScope === "single"
                      ? "bg-[var(--editor-accent)] text-[var(--editor-on-accent)] border-[var(--editor-accent)]"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-[var(--editor-accent)]"
                  }`}
                >
                  This Page Only
                </button>
                <button
                  type="button"
                  onClick={() => setDropScope("range")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition ${
                    dropScope === "range"
                      ? "bg-[var(--editor-accent)] text-[var(--editor-on-accent)] border-[var(--editor-accent)]"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-[var(--editor-accent)]"
                  }`}
                >
                  Page Range
                </button>
              </div>

              {dropScope === "range" && (
                <div className="flex items-center gap-3 pt-1">
                  <label className="text-xs text-zinc-500">From</label>
                  <input
                    type="number"
                    min={1}
                    max={localPages.length}
                    value={dropRangeStart}
                    onChange={(e) => setDropRangeStart(Number(e.target.value))}
                    className="w-20 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[var(--editor-accent-soft)]"
                  />
                  <label className="text-xs text-zinc-500">to</label>
                  <input
                    type="number"
                    min={dropRangeStart}
                    max={localPages.length}
                    value={dropRangeEnd}
                    onChange={(e) => setDropRangeEnd(Number(e.target.value))}
                    className="w-20 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[var(--editor-accent-soft)]"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDropAssignment(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDropAssignment}
                disabled={assignAudioPending}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-[var(--editor-accent)] text-[var(--editor-on-accent)] hover:brightness-105 shadow-sm disabled:opacity-60"
              >
                {assignAudioPending ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
