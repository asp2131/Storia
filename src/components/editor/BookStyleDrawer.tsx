"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  AVAILABLE_FONTS,
  FONT_WEIGHT_OPTIONS,
  TEXT_ALIGN_OPTIONS,
  type BookTextStyle,
  type FontWeight,
  type OverlayFont,
  type TextAlign,
  type TextBackground,
  type TextShadow,
} from "@/types/text-overlay";
import { useBookEditor, useBookMetaContext } from "@/contexts/BookEditorContext";

interface BookStyleDrawerProps {
  open: boolean;
  onClose: () => void;
}

const DEFAULT_SHADOW: TextShadow = {
  color: "rgba(0, 0, 0, 0.5)",
  offsetX: 2,
  offsetY: 2,
  blur: 4,
};

const DEFAULT_BACKGROUND: TextBackground = {
  color: "rgba(0, 0, 0, 0.5)",
  padding: 4,
  borderRadius: 4,
};

/**
 * Drawer for editing the per-book default text style. New text blocks seed
 * from this style; "Apply to all pages" bulk-restyles existing overlays.
 * Controls mirror the overlay PropertyPanel.
 */
export function BookStyleDrawer({ open, onClose }: BookStyleDrawerProps) {
  const {
    bookTextStyle,
    applyingTextStyle,
    updateBookTextStyle,
    applyBookTextStyleToAllPages,
  } = useBookMetaContext();
  const { voiceOptions } = useBookEditor().narration;

  const [draft, setDraft] = useState<BookTextStyle>(bookTextStyle);
  const [isShadowExpanded, setIsShadowExpanded] = useState(false);
  const [isBackgroundExpanded, setIsBackgroundExpanded] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [confirmingApply, setConfirmingApply] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Re-initialize the draft every time the drawer opens.
  useEffect(() => {
    if (open) {
      setDraft(bookTextStyle);
      setConfirmingApply(false);
      setApplyMessage(null);
      setActionError(null);
      setSavedTick(false);
      setIsShadowExpanded(false);
      setIsBackgroundExpanded(false);
    }
  }, [open, bookTextStyle]);

  if (!open) return null;

  const update = (updates: Partial<BookTextStyle>) => {
    setDraft((d) => ({ ...d, ...updates }));
    setSavedTick(false);
  };

  const handleShadowToggle = (enabled: boolean) => {
    if (enabled) {
      update({ shadow: draft.shadow ?? DEFAULT_SHADOW });
      setIsShadowExpanded(true);
    } else {
      setDraft((d) => {
        const next = { ...d };
        delete next.shadow;
        return next;
      });
    }
  };

  const handleBackgroundToggle = (enabled: boolean) => {
    if (enabled) {
      update({ background: draft.background ?? DEFAULT_BACKGROUND });
      setIsBackgroundExpanded(true);
    } else {
      setDraft((d) => {
        const next = { ...d };
        delete next.background;
        return next;
      });
    }
  };

  const handleVoiceChange = (voiceId: string) => {
    if (!voiceId) {
      setDraft((d) => {
        const next = { ...d };
        delete next.voiceId;
        delete next.voiceName;
        return next;
      });
      return;
    }
    const voice = voiceOptions.find((v) => v.id === voiceId);
    update({ voiceId, ...(voice ? { voiceName: voice.name } : {}) });
  };

  const handleSaveStyle = async () => {
    setSaving(true);
    setActionError(null);
    try {
      await updateBookTextStyle(draft);
      setSavedTick(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save style.");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyAll = async () => {
    setConfirmingApply(false);
    setApplyMessage(null);
    setActionError(null);
    try {
      const result = await applyBookTextStyleToAllPages();
      setApplyMessage(
        `Restyled ${result.elementsRestyled} text blocks across ${result.pagesUpdated} pages.` +
          (result.pagesSkipped > 0
            ? ` Skipped ${result.pagesSkipped} pages with invalid overlays.`
            : "")
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to apply style.");
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Book text style">
      <div className="absolute inset-0 bg-zinc-900/30 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="editor-pop absolute right-0 top-0 flex h-full w-[344px] max-w-full flex-col border-l border-zinc-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-800">Book Text Style</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-zinc-400 hover:text-zinc-600"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-xs text-zinc-500 mb-4">
            New text blocks start with these settings. Use &ldquo;Apply to all
            pages&rdquo; to restyle existing pages.
          </p>

          {/* Font Family */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-zinc-700 mb-2">
              Font Family
            </label>
            <select
              value={draft.fontFamily}
              onChange={(e) => update({ fontFamily: e.target.value as OverlayFont })}
              className="w-full px-3 py-2 border border-zinc-200 bg-[#fbfbfc] rounded-lg text-sm outline-none focus:border-[var(--editor-accent)]"
            >
              {AVAILABLE_FONTS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>

          {/* Font Size */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-zinc-700 mb-2">
              Font Size: {draft.fontSize.toFixed(1)}%
            </label>
            <input
              type="range"
              min={0.5}
              max={50}
              step={0.1}
              value={draft.fontSize}
              onChange={(e) => update({ fontSize: parseFloat(e.target.value) })}
              className="editor-range w-full"
            />
          </div>

          {/* Font Weight */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-zinc-700 mb-2">
              Font Weight
            </label>
            <select
              value={draft.fontWeight}
              onChange={(e) =>
                update({ fontWeight: parseInt(e.target.value) as FontWeight })
              }
              className="w-full px-3 py-2 border border-zinc-200 bg-[#fbfbfc] rounded-lg text-sm outline-none focus:border-[var(--editor-accent)]"
            >
              {FONT_WEIGHT_OPTIONS.map((weight) => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </select>
          </div>

          {/* Color */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-zinc-700 mb-2">
              Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={draft.color}
                onChange={(e) => update({ color: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={draft.color}
                onChange={(e) => update({ color: e.target.value })}
                className="flex-1 px-3 py-2 border border-zinc-200 bg-[#fbfbfc] rounded-lg text-sm outline-none focus:border-[var(--editor-accent)]"
              />
            </div>
          </div>

          {/* Text Align */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-zinc-700 mb-2">
              Text Align
            </label>
            <div className="flex rounded-lg border border-zinc-300 overflow-hidden">
              {TEXT_ALIGN_OPTIONS.map((align) => (
                <button
                  key={align}
                  onClick={() => update({ textAlign: align as TextAlign })}
                  className={`
                    flex-1 py-2 px-3 text-sm capitalize
                    ${draft.textAlign === align
                      ? "bg-[var(--editor-accent)] text-[var(--editor-on-accent)]"
                      : "bg-white text-zinc-700 hover:bg-zinc-100"
                    }
                  `}
                >
                  {align}
                </button>
              ))}
            </div>
          </div>

          {/* Voice */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-zinc-700 mb-2">
              Voice
            </label>
            <select
              value={draft.voiceId || ""}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 bg-[#fbfbfc] rounded-lg text-sm outline-none focus:border-[var(--editor-accent)]"
            >
              <option value="">No voice</option>
              {voiceOptions.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                  {voice.category ? ` (${voice.category})` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-zinc-500">
              Default narration voice for new text blocks.
            </p>
          </div>

          {/* Shadow Section */}
          <div className="mb-4 border border-zinc-200 rounded-lg">
            <button
              onClick={() => setIsShadowExpanded(!isShadowExpanded)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-zinc-50"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!draft.shadow}
                  onChange={(e) => handleShadowToggle(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4"
                />
                <span className="text-sm font-semibold text-zinc-700">Shadow</span>
              </div>
              <span
                className="text-zinc-400 transition-transform"
                style={{ transform: isShadowExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                ▼
              </span>
            </button>

            {isShadowExpanded && draft.shadow && (
              <div className="p-3 pt-0 border-t border-zinc-200">
                <div className="mt-3">
                  <label className="block text-xs font-medium text-zinc-600 mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    value={draft.shadow.color}
                    onChange={(e) =>
                      update({ shadow: { ...draft.shadow!, color: e.target.value } })
                    }
                    className="w-full px-2 py-1 border border-zinc-300 rounded text-sm"
                  />
                </div>
                {(["offsetX", "offsetY", "blur"] as const).map((field) => (
                  <div className="mt-3" key={field}>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">
                      {field === "offsetX" ? "Offset X" : field === "offsetY" ? "Offset Y" : "Blur"}:{" "}
                      {draft.shadow![field]}%
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={0.1}
                      value={draft.shadow![field]}
                      onChange={(e) =>
                        update({
                          shadow: {
                            ...draft.shadow!,
                            [field]: parseFloat(e.target.value),
                          },
                        })
                      }
                      className="editor-range w-full"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Background Section */}
          <div className="mb-4 border border-zinc-200 rounded-lg">
            <button
              onClick={() => setIsBackgroundExpanded(!isBackgroundExpanded)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-zinc-50"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!draft.background}
                  onChange={(e) => handleBackgroundToggle(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4"
                />
                <span className="text-sm font-semibold text-zinc-700">Background</span>
              </div>
              <span
                className="text-zinc-400 transition-transform"
                style={{ transform: isBackgroundExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                ▼
              </span>
            </button>

            {isBackgroundExpanded && draft.background && (
              <div className="p-3 pt-0 border-t border-zinc-200">
                <div className="mt-3">
                  <label className="block text-xs font-medium text-zinc-600 mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    value={draft.background.color}
                    onChange={(e) =>
                      update({ background: { ...draft.background!, color: e.target.value } })
                    }
                    className="w-full px-2 py-1 border border-zinc-300 rounded text-sm"
                  />
                </div>
                {(["padding", "borderRadius"] as const).map((field) => (
                  <div className="mt-3" key={field}>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">
                      {field === "padding" ? "Padding" : "Border Radius"}:{" "}
                      {draft.background![field]}%
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={0.1}
                      value={draft.background![field]}
                      onChange={(e) =>
                        update({
                          background: {
                            ...draft.background!,
                            [field]: parseFloat(e.target.value),
                          },
                        })
                      }
                      className="editor-range w-full"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {actionError && (
            <p className="mb-3 text-sm text-rose-600" role="alert">
              {actionError}
            </p>
          )}
          {applyMessage && (
            <p className="mb-3 text-sm text-[var(--editor-accent)]" role="status">
              {applyMessage}
            </p>
          )}
        </div>

        <footer className="border-t border-zinc-200 p-4 space-y-2">
          <button
            onClick={handleSaveStyle}
            disabled={saving || applyingTextStyle}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--editor-accent)] px-4 py-2 font-medium text-[var(--editor-on-accent)] transition hover:brightness-105 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {savedTick && !saving ? "Saved ✓" : "Save style"}
          </button>

          {confirmingApply ? (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-amber-800 mb-2">
                This will restyle all text blocks on every page of this book.
                Text and positions are kept. Composited images will need to be
                re-composited.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleApplyAll}
                  disabled={applyingTextStyle}
                  className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {applyingTextStyle && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm apply
                </button>
                <button
                  onClick={() => setConfirmingApply(false)}
                  disabled={applyingTextStyle}
                  className="py-1.5 px-3 bg-white border border-zinc-300 text-zinc-600 text-sm rounded-lg hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingApply(true)}
              disabled={saving || applyingTextStyle}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--editor-accent)] bg-white px-4 py-2 font-medium text-[var(--editor-accent)] transition hover:bg-[var(--editor-accent-faint)] disabled:opacity-50"
            >
              {applyingTextStyle && <Loader2 className="w-4 h-4 animate-spin" />}
              Apply to all pages…
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}

export default BookStyleDrawer;
