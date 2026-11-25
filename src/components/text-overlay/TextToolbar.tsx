"use client";

import { forwardRef, useState, type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Copy,
  Mic,
  Minus,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PopoverButton } from "@/components/editor/PopoverButton";
import {
  AVAILABLE_FONTS,
  FONT_WEIGHT_OPTIONS,
  OVERLAY_FONT_CSS_FAMILY,
  TEXT_ALIGN_OPTIONS,
  type FontWeight,
  type OverlayFont,
  type TextBackground,
  type TextElement,
  type TextShadow,
} from "@/types/text-overlay";

export type VoiceOption = { id: string; name: string; category?: string | null };

export interface TextToolbarProps {
  element: TextElement;
  onChange: (next: TextElement) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Text colours already used on this page, offered as one-click swatches. */
  pageColors?: string[];
  voiceOptions?: VoiceOption[];
  /** Save this box's look as the creator's default for new boxes, in any book. */
  onUseStyleForNewBoxes?: (element: TextElement) => Promise<unknown>;
  /** Restyle every box on every page of the book to this box's look. */
  onApplyStyleToAllPages?: (element: TextElement) => Promise<unknown>;
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

const DEFAULT_SHADOW: TextShadow = { color: "rgba(0, 0, 0, 0.5)", offsetX: 2, offsetY: 2, blur: 4 };
const DEFAULT_BACKGROUND: TextBackground = { color: "rgba(0, 0, 0, 0.5)", padding: 4, borderRadius: 4 };
const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight };

const iconButton =
  "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 aria-pressed:bg-[var(--editor-accent-soft)] aria-pressed:text-[var(--editor-accent)]";
const divider = <span className="mx-0.5 h-5 w-px shrink-0 bg-zinc-200" aria-hidden />;
const fieldLabel = "mb-1.5 block text-[11.5px] font-semibold text-zinc-500";
const control =
  "w-full rounded-[9px] border border-zinc-200 bg-[#fbfbfc] px-3 py-2 text-[13px] text-zinc-800 outline-none transition focus:border-[var(--editor-accent)] focus:bg-white focus:ring-2 focus:ring-[var(--editor-accent-faint)]";
const menuItem =
  "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-zinc-100 disabled:opacity-50";

/**
 * Canva-style floating bar for the selected text box: every text option in
 * one row, with popovers for colour, effects, voice and style-wide actions.
 */
export const TextToolbar = forwardRef<HTMLDivElement, TextToolbarProps & { style?: React.CSSProperties }>(
  function TextToolbar(
    {
      element,
      onChange,
      onDuplicate,
      onDelete,
      pageColors = [],
      voiceOptions = [],
      onUseStyleForNewBoxes,
      onApplyStyleToAllPages,
      style,
    },
    ref
  ) {
    const [status, setStatus] = useState<string | null>(null);
    const [armApply, setArmApply] = useState(false);
    const update = (patch: Partial<TextElement>) => onChange({ ...element, ...patch });
    // Explicit undefined, not a deleted key: the store merges updates, so a
    // missing key would leave the old shadow/background/voice in place.
    const without = (...keys: ("shadow" | "background" | "voiceId" | "voiceName")[]) =>
      update(Object.fromEntries(keys.map((key) => [key, undefined])));

    const bold = element.fontWeight >= 600;
    const AlignIcon = ALIGN_ICONS[element.textAlign];
    const nextAlign =
      TEXT_ALIGN_OPTIONS[(TEXT_ALIGN_OPTIONS.indexOf(element.textAlign) + 1) % TEXT_ALIGN_OPTIONS.length];
    const swatches = Array.from(
      new Set(["#000000", "#ffffff", ...pageColors.map((c) => c.toLowerCase())])
    ).slice(0, 10);
    const voiceName = element.voiceId
      ? voiceOptions.find((voice) => voice.id === element.voiceId)?.name ?? element.voiceName
      : null;
    const setSize = (size: number) =>
      update({ fontSize: Math.min(50, Math.max(0.5, Math.round(size * 10) / 10)) });

    const run = async (label: string, action: () => Promise<unknown>) => {
      setStatus(`${label}…`);
      try {
        await action();
        setStatus(label === "Saving" ? "Saved. New text boxes, in any book, start with this style." : "Every page now uses this style.");
      } catch {
        setStatus("That didn't work. Try again.");
      }
    };

    return (
      <div
        ref={ref}
        role="toolbar"
        aria-label="Text options"
        style={style}
        // Clicks here must not reach the canvas (which would deselect the box).
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        className="absolute z-30 flex items-center gap-0.5 rounded-xl border border-zinc-200/90 bg-white/95 p-1 shadow-[0_10px_30px_rgba(24,24,27,0.16),0_2px_6px_rgba(24,24,27,0.06)] backdrop-blur transition-[opacity,transform] duration-150 ease-out starting:translate-y-1 starting:scale-95 starting:opacity-0"
      >
        <select
          value={element.fontFamily}
          onChange={(event) => update({ fontFamily: event.target.value as OverlayFont })}
          className="h-8 w-[8.5rem] shrink-0 cursor-pointer truncate rounded-lg bg-transparent px-2 text-[13px] text-zinc-800 outline-none transition hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-[var(--editor-accent-soft)]"
          style={{ fontFamily: OVERLAY_FONT_CSS_FAMILY[element.fontFamily] }}
          aria-label="Font"
          title="Font"
        >
          {AVAILABLE_FONTS.map((font) => <option key={font}>{font}</option>)}
        </select>

        {divider}

        <div className="flex shrink-0 items-center">
          <button type="button" className={iconButton} onClick={() => setSize(element.fontSize - 0.5)} title="Smaller text" aria-label="Smaller text">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            key={element.fontSize}
            type="number"
            min={0.5}
            max={50}
            step={0.5}
            defaultValue={element.fontSize}
            onBlur={(event) => setSize(Number(event.target.value) || element.fontSize)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-label="Text size"
            title="Text size (% of page height)"
            className="h-8 w-12 rounded-md bg-transparent text-center text-[13px] font-semibold tabular-nums text-zinc-800 outline-none [appearance:textfield] hover:bg-zinc-100 focus:bg-zinc-100 [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button type="button" className={iconButton} onClick={() => setSize(element.fontSize + 0.5)} title="Bigger text" aria-label="Bigger text">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {divider}

        <button
          type="button"
          className={iconButton}
          aria-pressed={bold}
          onClick={() => update({ fontWeight: bold ? 400 : 700 })}
          title="Bold"
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>

        <PopoverButton
          title="Text color"
          buttonClassName={`${iconButton} flex-col gap-0`}
          panelClassName="w-60 p-3"
          label={
            <>
              <span className="text-[15px] font-bold leading-none text-zinc-800">A</span>
              <span className="mt-0.5 h-1 w-4 rounded-full border border-black/10" style={{ backgroundColor: element.color }} />
            </>
          }
        >
          {() => (
            <div className="space-y-3">
              <ColorField label="Text color" value={element.color} onChange={(color) => update({ color })} />
              <div className="flex flex-wrap gap-1.5" aria-label="Quick colors">
                {swatches.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => update({ color })}
                    className={`h-6 w-6 rounded-full border shadow-sm transition hover:scale-110 ${element.color.toLowerCase() === color ? "border-[var(--editor-accent)] ring-2 ring-[var(--editor-accent-soft)]" : "border-black/10"}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Use color ${color}`}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </PopoverButton>

        <button
          type="button"
          className={iconButton}
          onClick={() => update({ textAlign: nextAlign })}
          title={`Align ${element.textAlign} (click for ${nextAlign})`}
          aria-label={`Align ${element.textAlign}`}
        >
          <AlignIcon className="h-4 w-4" />
        </button>

        <PopoverButton
          title="Effects"
          pressed={Boolean(element.shadow || element.background || element.rotation)}
          buttonClassName={iconButton}
          panelClassName="w-72 p-3"
          label={<Sparkles className="h-4 w-4" />}
        >
          {() => (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className={fieldLabel}>Weight</span>
                  <select
                    value={element.fontWeight}
                    onChange={(event) => update({ fontWeight: Number(event.target.value) as FontWeight })}
                    className={control}
                  >
                    {FONT_WEIGHT_OPTIONS.map((weight) => <option key={weight}>{weight}</option>)}
                  </select>
                </label>
                <RangeValue
                  label="Rotate"
                  unit="°"
                  min={-180}
                  max={180}
                  step={1}
                  value={element.rotation}
                  onChange={(rotation) => update({ rotation })}
                />
              </div>
              <Disclosure
                label="Shadow"
                checked={Boolean(element.shadow)}
                onCheckedChange={(on) => (on ? update({ shadow: DEFAULT_SHADOW }) : without("shadow"))}
              >
                {element.shadow && (
                  <>
                    <ColorField
                      label="Shadow color"
                      withAlpha
                      value={element.shadow.color}
                      onChange={(color) => update({ shadow: { ...element.shadow!, color } })}
                    />
                    {(["offsetX", "offsetY", "blur"] as const).map((field) => (
                      <RangeValue
                        key={field}
                        label={field === "offsetX" ? "Offset X" : field === "offsetY" ? "Offset Y" : "Blur"}
                        value={element.shadow![field]}
                        onChange={(next) => update({ shadow: { ...element.shadow!, [field]: next } })}
                      />
                    ))}
                  </>
                )}
              </Disclosure>
              <Disclosure
                label="Background"
                checked={Boolean(element.background)}
                onCheckedChange={(on) => (on ? update({ background: DEFAULT_BACKGROUND }) : without("background"))}
              >
                {element.background && (
                  <>
                    <ColorField
                      label="Background color"
                      withAlpha
                      value={element.background.color}
                      onChange={(color) => update({ background: { ...element.background!, color } })}
                    />
                    {(["padding", "borderRadius"] as const).map((field) => (
                      <RangeValue
                        key={field}
                        label={field === "padding" ? "Padding" : "Corner radius"}
                        value={element.background![field]}
                        onChange={(next) => update({ background: { ...element.background!, [field]: next } })}
                      />
                    ))}
                  </>
                )}
              </Disclosure>
            </div>
          )}
        </PopoverButton>

        {voiceOptions.length > 0 && (
          <PopoverButton
            title={voiceName ? `Reading voice: ${voiceName}` : "Reading voice"}
            pressed={Boolean(element.voiceId)}
            buttonClassName={iconButton}
            panelClassName="w-64 p-3"
            label={<Mic className="h-4 w-4" />}
          >
            {() => (
              <label className="block">
                <span className={fieldLabel}>Reading voice for this text</span>
                <select
                  value={element.voiceId || ""}
                  onChange={(event) => {
                    const voice = voiceOptions.find((option) => option.id === event.target.value);
                    if (!voice) return without("voiceId", "voiceName");
                    update({ voiceId: voice.id, voiceName: voice.name });
                  }}
                  className={control}
                >
                  <option value="">Use page voice</option>
                  {voiceOptions.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}{voice.category ? ` — ${voice.category}` : ""}
                    </option>
                  ))}
                </select>
                <span className="mt-1.5 block text-[11px] text-zinc-400">New text boxes start with the voice you pick last.</span>
              </label>
            )}
          </PopoverButton>
        )}

        {divider}

        <button type="button" className={iconButton} onClick={onDuplicate} title="Duplicate (⌘D)" aria-label="Duplicate">
          <Copy className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={`${iconButton} hover:bg-rose-50 hover:text-rose-600`}
          onClick={onDelete}
          title="Delete (Del)"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        {(onUseStyleForNewBoxes || onApplyStyleToAllPages) && (
          <PopoverButton
            title="More text options"
            align="end"
            buttonClassName={iconButton}
            panelClassName="w-72"
            onOpen={() => {
              setStatus(null);
              setArmApply(false);
            }}
            label={<MoreHorizontal className="h-4 w-4" />}
          >
            {() => (
              <div>
                {onUseStyleForNewBoxes && (
                  <button type="button" className={menuItem} onClick={() => void run("Saving", () => onUseStyleForNewBoxes(element))}>
                    <span>
                      <span className="block font-semibold">Use style for new text boxes</span>
                      <span className="block text-[11.5px] leading-snug text-zinc-500">Your next boxes, in any book, start looking like this one.</span>
                    </span>
                  </button>
                )}
                {onApplyStyleToAllPages && (
                  <button
                    type="button"
                    className={`${menuItem} ${armApply ? "bg-amber-50 hover:bg-amber-100" : ""}`}
                    onClick={() => {
                      if (!armApply) return setArmApply(true);
                      setArmApply(false);
                      void run("Applying", () => onApplyStyleToAllPages(element));
                    }}
                  >
                    <span>
                      <span className="block font-semibold">{armApply ? "Click again to restyle every page" : "Apply style to every page"}</span>
                      <span className="block text-[11.5px] leading-snug text-zinc-500">
                        Every text box in this book gets this font, size, colour and effects. Words, positions and voices stay.
                      </span>
                    </span>
                  </button>
                )}
                <p role="status" className="px-2.5 pb-1 text-[11.5px] leading-snug text-zinc-500 empty:hidden">
                  {status}
                </p>
              </div>
            )}
          </PopoverButton>
        )}
      </div>
    );
  }
);

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
            const raw = event.target.value.trim();
            onChange(formatCssColor(parseCssColor(raw.startsWith("#") ? raw : `#${raw}`).hex, alpha));
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

function Disclosure({
  label,
  checked,
  onCheckedChange,
  children,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-[10px] border border-zinc-200 bg-white">
      <div className="flex items-center justify-between px-3 py-2.5">
        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => {
              onCheckedChange(event.target.checked);
              setOpen(event.target.checked);
            }}
            className="h-4 w-4 accent-[var(--editor-accent)]"
          />
          {label}
        </label>
        {checked && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100"
            aria-label={`${open ? "Hide" : "Show"} ${label.toLowerCase()} settings`}
            aria-expanded={open}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      {checked && open && <div className="space-y-3 border-t border-zinc-100 p-3">{children}</div>}
    </div>
  );
}

function RangeValue({
  label,
  value,
  onChange,
  unit = "%",
  min = 0,
  max = 100,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex justify-between text-[11px] font-semibold text-zinc-500">
        <span>{label}</span>
        <span className="tabular-nums">{value}{unit}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="editor-range w-full"
        aria-label={label}
      />
    </label>
  );
}
