"use client";

import { useState, type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Mic,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import {
  TextElement,
  TextShadow,
  TextBackground,
  AVAILABLE_FONTS,
  OVERLAY_FONT_CSS_FAMILY,
  FONT_WEIGHT_OPTIONS,
  TEXT_ALIGN_OPTIONS,
  type TextAlign,
  type FontWeight,
  type OverlayFont,
} from "@/types/text-overlay";

type VoiceOption = {
  id: string;
  name: string;
  category?: string | null;
};

interface PropertyPanelProps {
  selectedElement: TextElement | null;
  onUpdate: (element: TextElement) => void;
  onDelete: (elementId: string) => void;
  voiceOptions?: VoiceOption[];
  enableVoiceAssignment?: boolean;
  embedded?: boolean;
  /** Save this box's style as the creator's default for new text boxes. Hidden when absent. */
  onUseStyleForNewBoxes?: (element: TextElement) => Promise<unknown>;
  /** Text colours already used on this page, offered as one-click swatches. */
  pageColors?: string[];
}

/** Split any `#rgb`, `#rrggbb` or `rgb()/rgba()` colour into a 6-digit hex and an alpha. */
export function parseCssColor(value: string): { hex: string; alpha: number } {
  const v = value.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return { hex: `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`, alpha: 1 };
  if (/^#[0-9a-f]{6}$/.test(v)) return { hex: v, alpha: 1 };
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(v);
  if (rgb) {
    const hex = `#${rgb.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("")}`;
    return { hex, alpha: rgb[4] === undefined ? 1 : Math.max(0, Math.min(1, Number(rgb[4]))) };
  }
  return { hex: "#000000", alpha: 1 };
}

/** Opaque colours stay plain hex (what every reader parses); see-through ones use rgba(). */
export function formatCssColor(hex: string, alpha: number): string {
  if (alpha >= 0.995) return hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})`;
}

const fieldLabel = "mb-1.5 block text-[11.5px] font-semibold text-zinc-500";
const control = "w-full rounded-[9px] border border-zinc-200 bg-[#fbfbfc] px-3 py-2 text-[13px] text-zinc-800 outline-none transition focus:border-[var(--editor-accent)] focus:bg-white focus:ring-2 focus:ring-[var(--editor-accent-faint)]";
const alignIcons = { left: AlignLeft, center: AlignCenter, right: AlignRight };

export function PropertyPanel({
  selectedElement,
  onUpdate,
  onDelete,
  voiceOptions = [],
  enableVoiceAssignment = false,
  embedded = false,
  onUseStyleForNewBoxes,
  pageColors = [],
}: PropertyPanelProps) {
  const [isShadowExpanded, setIsShadowExpanded] = useState(false);
  const [isBackgroundExpanded, setIsBackgroundExpanded] = useState(false);
  // Keyed by element id so the "Saved" note never carries over to another box.
  const [styleSave, setStyleSave] = useState<{ id: string; status: "saving" | "saved" | "error" } | null>(null);
  const shell = embedded
    ? "space-y-4"
    : "editor-scroll w-80 shrink-0 space-y-4 overflow-y-auto border-l border-zinc-200 bg-white p-4";

  if (!selectedElement) {
    return (
      <div className={shell}>
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
          <span className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-lg bg-white text-zinc-400 shadow-sm">
            <AlignLeft className="h-4 w-4" />
          </span>
          <p className="text-[13px] font-semibold text-zinc-600">Select a text block</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Choose text on the page or from the layers list to edit it.
          </p>
        </div>
      </div>
    );
  }

  const update = (patch: Partial<TextElement>) => onUpdate({ ...selectedElement, ...patch });

  const styleStatus = styleSave?.id === selectedElement.id ? styleSave.status : null;
  const handleUseStyle = async () => {
    const id = selectedElement.id;
    setStyleSave({ id, status: "saving" });
    try {
      await onUseStyleForNewBoxes?.(selectedElement);
      setStyleSave({ id, status: "saved" });
    } catch {
      setStyleSave({ id, status: "error" });
    }
  };

  const handleVoiceChange = (voiceId: string) => {
    if (!voiceId) {
      const next = { ...selectedElement };
      delete next.voiceId;
      delete next.voiceName;
      onUpdate(next);
      return;
    }
    const voice = voiceOptions.find((option) => option.id === voiceId);
    onUpdate({
      ...selectedElement,
      voiceId,
      ...(voice ? { voiceName: voice.name } : {}),
    });
  };

  const handleShadowToggle = (enabled: boolean) => {
    if (enabled) {
      const shadow: TextShadow = {
        color: "rgba(0, 0, 0, 0.5)",
        offsetX: 2,
        offsetY: 2,
        blur: 4,
      };
      update({ shadow });
      setIsShadowExpanded(true);
    } else {
      const next = { ...selectedElement };
      delete next.shadow;
      onUpdate(next);
    }
  };

  const handleBackgroundToggle = (enabled: boolean) => {
    if (enabled) {
      const background: TextBackground = {
        color: "rgba(0, 0, 0, 0.5)",
        padding: 4,
        borderRadius: 4,
      };
      update({ background });
      setIsBackgroundExpanded(true);
    } else {
      const next = { ...selectedElement };
      delete next.background;
      onUpdate(next);
    }
  };

  return (
    <div className={shell}>
      <div>
        <label className={fieldLabel} htmlFor={`text-${selectedElement.id}`}>Text content</label>
        <textarea
          id={`text-${selectedElement.id}`}
          data-overlay-text-input
          value={selectedElement.text}
          onChange={(event) => update({ text: event.target.value })}
          className={`${control} min-h-16 resize-y leading-relaxed`}
          rows={2}
        />
      </div>

      <div className="grid grid-cols-[1.35fr_1fr] gap-2">
        <div className="min-w-0">
          <label className={fieldLabel}>Font</label>
          <select
            value={selectedElement.fontFamily}
            onChange={(event) => update({ fontFamily: event.target.value as OverlayFont })}
            className={control}
            style={{ fontFamily: OVERLAY_FONT_CSS_FAMILY[selectedElement.fontFamily] }}
          >
            {AVAILABLE_FONTS.map((font) => <option key={font}>{font}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label className={fieldLabel}>Weight</label>
          <select
            value={selectedElement.fontWeight}
            onChange={(event) => update({ fontWeight: Number(event.target.value) as FontWeight })}
            className={control}
          >
            {FONT_WEIGHT_OPTIONS.map((weight) => <option key={weight}>{weight}</option>)}
          </select>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-[11.5px] font-semibold text-zinc-500">Size</label>
          <div className="flex items-center rounded-md bg-zinc-100">
            <button
              type="button"
              onClick={() => update({ fontSize: Math.max(0.5, Math.round((selectedElement.fontSize - 0.5) * 10) / 10) })}
              className="grid h-6 w-6 place-items-center rounded-md text-zinc-500 hover:bg-white hover:text-zinc-800"
              aria-label="Smaller text"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="min-w-11 text-center text-xs font-semibold tabular-nums text-zinc-700">
              {selectedElement.fontSize.toFixed(1)}%
            </span>
            <button
              type="button"
              onClick={() => update({ fontSize: Math.min(50, Math.round((selectedElement.fontSize + 0.5) * 10) / 10) })}
              className="grid h-6 w-6 place-items-center rounded-md text-zinc-500 hover:bg-white hover:text-zinc-800"
              aria-label="Bigger text"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
        <input
          type="range"
          min={0.5}
          max={50}
          step={0.1}
          value={selectedElement.fontSize}
          onChange={(event) => update({ fontSize: Number(event.target.value) })}
          className="editor-range w-full"
          aria-label="Text size"
        />
      </div>

      <div className="grid grid-cols-[1fr_1.3fr] gap-2">
        <div>
          <label className={fieldLabel}>Color</label>
          <ColorField value={selectedElement.color} onChange={(color) => update({ color })} label="Text color" />
        </div>
        <div>
          <label className={fieldLabel}>Align</label>
          <div className="flex gap-1 rounded-[9px] bg-zinc-100 p-1">
            {TEXT_ALIGN_OPTIONS.map((align) => {
              const Icon = alignIcons[align];
              const active = selectedElement.textAlign === align;
              return (
                <button
                  key={align}
                  type="button"
                  onClick={() => update({ textAlign: align as TextAlign })}
                  className={`grid h-[30px] flex-1 place-items-center rounded-md transition ${active ? "bg-white text-[var(--editor-accent)] shadow-sm" : "text-zinc-500 hover:bg-white/70"}`}
                  aria-label={`Align ${align}`}
                  aria-pressed={active}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {(() => {
        const swatches = Array.from(new Set(["#000000", "#ffffff", ...pageColors.map((c) => c.toLowerCase())])).slice(0, 10);
        return (
          <div className="-mt-1 flex flex-wrap gap-1.5" aria-label="Colors on this page">
            {swatches.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => update({ color })}
                className={`h-6 w-6 rounded-full border shadow-sm transition hover:scale-110 ${selectedElement.color.toLowerCase() === color ? "border-[var(--editor-accent)] ring-2 ring-[var(--editor-accent-soft)]" : "border-black/10"}`}
                style={{ backgroundColor: color }}
                aria-label={`Use color ${color}`}
                title={color}
              />
            ))}
          </div>
        );
      })()}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-[11.5px] font-semibold text-zinc-500">Rotation</label>
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-700">
            {selectedElement.rotation}°
          </span>
        </div>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={selectedElement.rotation}
          onChange={(event) => update({ rotation: Number(event.target.value) })}
          className="editor-range w-full"
        />
      </div>

      {enableVoiceAssignment && (
        <div className="border-t border-zinc-100 pt-4">
          <label className={`${fieldLabel} flex items-center gap-1.5`}>
            <Mic className="h-3.5 w-3.5" />
            Reading voice for this text
          </label>
          <select
            value={selectedElement.voiceId || ""}
            onChange={(event) => handleVoiceChange(event.target.value)}
            className={control}
          >
            <option value="">Use page voice</option>
            {voiceOptions.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}{voice.category ? ` — ${voice.category}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-zinc-400">Remembered for new text blocks.</p>
        </div>
      )}

      <Disclosure
        label="Shadow"
        checked={Boolean(selectedElement.shadow)}
        expanded={isShadowExpanded}
        onExpandedChange={setIsShadowExpanded}
        onCheckedChange={handleShadowToggle}
      >
        {selectedElement.shadow && (
          <div className="space-y-3 border-t border-zinc-100 p-3">
            <ColorField
              label="Shadow color"
              withAlpha
              value={selectedElement.shadow.color}
              onChange={(color) => update({ shadow: { ...selectedElement.shadow!, color } })}
            />
            {(["offsetX", "offsetY", "blur"] as const).map((field) => (
              <RangeValue
                key={field}
                label={field === "offsetX" ? "Offset X" : field === "offsetY" ? "Offset Y" : "Blur"}
                value={selectedElement.shadow![field]}
                onChange={(value) => update({ shadow: { ...selectedElement.shadow!, [field]: value } })}
              />
            ))}
          </div>
        )}
      </Disclosure>

      <Disclosure
        label="Background"
        checked={Boolean(selectedElement.background)}
        expanded={isBackgroundExpanded}
        onExpandedChange={setIsBackgroundExpanded}
        onCheckedChange={handleBackgroundToggle}
      >
        {selectedElement.background && (
          <div className="space-y-3 border-t border-zinc-100 p-3">
            <ColorField
              label="Background color"
              withAlpha
              value={selectedElement.background.color}
              onChange={(color) => update({ background: { ...selectedElement.background!, color } })}
            />
            {(["padding", "borderRadius"] as const).map((field) => (
              <RangeValue
                key={field}
                label={field === "padding" ? "Padding" : "Border radius"}
                value={selectedElement.background![field]}
                onChange={(value) => update({ background: { ...selectedElement.background!, [field]: value } })}
              />
            ))}
          </div>
        )}
      </Disclosure>

      {onUseStyleForNewBoxes && (
        <div>
          <button
            type="button"
            onClick={handleUseStyle}
            disabled={styleStatus === "saving"}
            className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 transition hover:border-[var(--editor-accent)] hover:text-[var(--editor-accent)] disabled:opacity-60"
          >
            {styleStatus === "saving" ? "Saving…" : "Use style for new text boxes"}
          </button>
          <p role="status" className="mt-1.5 text-center text-[11px] leading-snug text-zinc-500">
            {styleStatus === "saved"
              ? "Saved. Your new text boxes, in any book, start with this style."
              : styleStatus === "error"
                ? "Couldn't save the style. Try again."
                : null}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => onDelete(selectedElement.id)}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
      >
        <Trash2 className="h-4 w-4" />
        Delete text block
      </button>
    </div>
  );
}

function Disclosure({
  label,
  checked,
  expanded,
  onCheckedChange,
  onExpandedChange,
  children,
}: {
  label: string;
  checked: boolean;
  expanded: boolean;
  onCheckedChange: (checked: boolean) => void;
  onExpandedChange: (expanded: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-zinc-200 bg-white">
      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        className="flex w-full items-center justify-between p-3 text-left transition hover:bg-zinc-50"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onCheckedChange(event.target.checked)}
            onClick={(event) => event.stopPropagation()}
            className="h-4 w-4 accent-[var(--editor-accent)]"
          />
          {label}
        </span>
        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && children}
    </div>
  );
}

function RangeValue({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-[11px] text-zinc-500">
        <span>{label}</span><span className="tabular-nums">{value}%</span>
      </div>
      <input type="range" min={0} max={100} step={0.1} value={value} onChange={(event) => onChange(Number(event.target.value))} className="editor-range w-full" />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  withAlpha = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  withAlpha?: boolean;
}) {
  const { hex, alpha } = parseCssColor(value);
  return (
    <div className="space-y-2">
      <div className="flex h-[38px] items-center gap-2 rounded-[9px] border border-zinc-200 bg-[#fbfbfc] px-2.5">
        <input
          type="color"
          value={hex}
          onChange={(event) => onChange(formatCssColor(event.target.value, alpha))}
          className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
          aria-label={label}
        />
        <input
          key={hex}
          defaultValue={hex.toUpperCase()}
          onBlur={(event) => {
            const next = parseCssColor(event.target.value.startsWith("#") ? event.target.value : `#${event.target.value}`);
            onChange(formatCssColor(next.hex, alpha));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="min-w-0 flex-1 bg-transparent text-xs uppercase tabular-nums text-zinc-600 outline-none"
          aria-label={`${label} hex value`}
        />
        {withAlpha && <span className="text-[11px] tabular-nums text-zinc-400">{Math.round(alpha * 100)}%</span>}
      </div>
      {withAlpha && (
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(alpha * 100)}
          onChange={(event) => onChange(formatCssColor(hex, Number(event.target.value) / 100))}
          className="editor-range w-full"
          aria-label={`${label} opacity`}
        />
      )}
    </div>
  );
}
