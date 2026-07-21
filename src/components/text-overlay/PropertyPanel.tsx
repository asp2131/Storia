"use client";

import { useState } from "react";
import {
  TextElement,
  TextShadow,
  TextBackground,
  AVAILABLE_FONTS,
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
}

export function PropertyPanel({
  selectedElement,
  onUpdate,
  onDelete,
  voiceOptions = [],
  enableVoiceAssignment = false,
}: PropertyPanelProps) {
  const [isShadowExpanded, setIsShadowExpanded] = useState(false);
  const [isBackgroundExpanded, setIsBackgroundExpanded] = useState(false);

  if (!selectedElement) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
        <p className="text-gray-500 text-sm">
          Select a text element to edit its properties
        </p>
      </div>
    );
  }

  const handleTextChange = (text: string) => {
    onUpdate({ ...selectedElement, text });
  };

  const handleFontFamilyChange = (fontFamily: OverlayFont) => {
    onUpdate({ ...selectedElement, fontFamily });
  };

  const handleFontSizeChange = (fontSize: number) => {
    onUpdate({ ...selectedElement, fontSize });
  };

  const handleFontWeightChange = (fontWeight: FontWeight) => {
    onUpdate({ ...selectedElement, fontWeight });
  };

  const handleColorChange = (color: string) => {
    onUpdate({ ...selectedElement, color });
  };

  const handleTextAlignChange = (textAlign: TextAlign) => {
    onUpdate({ ...selectedElement, textAlign });
  };

  const handleRotationChange = (rotation: number) => {
    onUpdate({ ...selectedElement, rotation });
  };

  const handleVoiceChange = (voiceId: string) => {
    if (!voiceId) {
      const rest = { ...selectedElement };
      delete rest.voiceId;
      delete rest.voiceName;
      onUpdate(rest);
      return;
    }

    const selectedVoice = voiceOptions.find((voice) => voice.id === voiceId);
    onUpdate({
      ...selectedElement,
      voiceId,
      ...(selectedVoice ? { voiceName: selectedVoice.name } : {}),
    });
  };

  const handleShadowToggle = (enabled: boolean) => {
    if (enabled) {
      const defaultShadow: TextShadow = {
        color: "rgba(0, 0, 0, 0.5)",
        offsetX: 2,
        offsetY: 2,
        blur: 4,
      };
      onUpdate({ ...selectedElement, shadow: defaultShadow });
      setIsShadowExpanded(true);
    } else {
      const { shadow: _, ...elementWithoutShadow } = selectedElement;
      onUpdate(elementWithoutShadow);
    }
  };

  const handleShadowChange = (updates: Partial<TextShadow>) => {
    if (!selectedElement.shadow) return;
    onUpdate({
      ...selectedElement,
      shadow: { ...selectedElement.shadow, ...updates },
    });
  };

  const handleBackgroundToggle = (enabled: boolean) => {
    if (enabled) {
      const defaultBackground: TextBackground = {
        color: "rgba(0, 0, 0, 0.5)",
        padding: 4,
        borderRadius: 4,
      };
      onUpdate({ ...selectedElement, background: defaultBackground });
      setIsBackgroundExpanded(true);
    } else {
      const { background: _, ...elementWithoutBackground } = selectedElement;
      onUpdate(elementWithoutBackground);
    }
  };

  const handleBackgroundChange = (updates: Partial<TextBackground>) => {
    if (!selectedElement.background) return;
    onUpdate({
      ...selectedElement,
      background: { ...selectedElement.background, ...updates },
    });
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
      {/* Text Content */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Text Content
        </label>
        <textarea
          value={selectedElement.text}
          onChange={(e) => handleTextChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
          rows={3}
        />
      </div>

      {enableVoiceAssignment && (
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Voice
          </label>
          <select
            value={selectedElement.voiceId || ""}
            onChange={(e) => handleVoiceChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">No voice (use legacy page voice)</option>
            {voiceOptions.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}{voice.category ? ` (${voice.category})` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-gray-500">
            Used for this block and remembered for new text blocks.
          </p>
        </div>
      )}

      {/* Font Family */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Font Family
        </label>
        <select
          value={selectedElement.fontFamily}
          onChange={(e) => handleFontFamilyChange(e.target.value as OverlayFont)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Font Size: {selectedElement.fontSize.toFixed(1)}%
        </label>
        <input
          type="range"
          min={0.5}
          max={50}
          step={0.1}
          value={selectedElement.fontSize}
          onChange={(e) => handleFontSizeChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Font Weight */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Font Weight
        </label>
        <select
          value={selectedElement.fontWeight}
          onChange={(e) =>
            handleFontWeightChange(parseInt(e.target.value) as FontWeight)
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Color
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={selectedElement.color}
            onChange={(e) => handleColorChange(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer"
          />
          <input
            type="text"
            value={selectedElement.color}
            onChange={(e) => handleColorChange(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Text Align */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Text Align
        </label>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          {TEXT_ALIGN_OPTIONS.map((align) => (
            <button
              key={align}
              onClick={() => handleTextAlignChange(align)}
              className={`
                flex-1 py-2 px-3 text-sm capitalize
                ${selectedElement.textAlign === align
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
                }
              `}
            >
              {align}
            </button>
          ))}
        </div>
      </div>

      {/* Rotation */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Rotation: {selectedElement.rotation}°
        </label>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={selectedElement.rotation}
          onChange={(e) => handleRotationChange(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Shadow Section */}
      <div className="mb-4 border border-gray-200 rounded-lg">
        <button
          onClick={() => setIsShadowExpanded(!isShadowExpanded)}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!selectedElement.shadow}
              onChange={(e) => handleShadowToggle(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4"
            />
            <span className="text-sm font-semibold text-gray-700">Shadow</span>
          </div>
          <span
            className="text-gray-400 transition-transform"
            style={{ transform: isShadowExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            ▼
          </span>
        </button>

        {isShadowExpanded && selectedElement.shadow && (
          <div className="p-3 pt-0 border-t border-gray-200">
            {/* Shadow Color */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedElement.shadow.color}
                  onChange={(e) =>
                    handleShadowChange({ color: e.target.value })
                  }
                  className="w-8 h-8 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={selectedElement.shadow.color}
                  onChange={(e) =>
                    handleShadowChange({ color: e.target.value })
                  }
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>

            {/* Shadow Offset X */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Offset X: {selectedElement.shadow.offsetX}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={selectedElement.shadow.offsetX}
                onChange={(e) =>
                  handleShadowChange({ offsetX: parseFloat(e.target.value) })
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Shadow Offset Y */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Offset Y: {selectedElement.shadow.offsetY}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={selectedElement.shadow.offsetY}
                onChange={(e) =>
                  handleShadowChange({ offsetY: parseFloat(e.target.value) })
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Shadow Blur */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Blur: {selectedElement.shadow.blur}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={selectedElement.shadow.blur}
                onChange={(e) =>
                  handleShadowChange({ blur: parseFloat(e.target.value) })
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Background Section */}
      <div className="mb-4 border border-gray-200 rounded-lg">
        <button
          onClick={() => setIsBackgroundExpanded(!isBackgroundExpanded)}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!selectedElement.background}
              onChange={(e) => handleBackgroundToggle(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4"
            />
            <span className="text-sm font-semibold text-gray-700">
              Background
            </span>
          </div>
          <span
            className="text-gray-400 transition-transform"
            style={{ transform: isBackgroundExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            ▼
          </span>
        </button>

        {isBackgroundExpanded && selectedElement.background && (
          <div className="p-3 pt-0 border-t border-gray-200">
            {/* Background Color */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedElement.background.color}
                  onChange={(e) =>
                    handleBackgroundChange({ color: e.target.value })
                  }
                  className="w-8 h-8 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={selectedElement.background.color}
                  onChange={(e) =>
                    handleBackgroundChange({ color: e.target.value })
                  }
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>

            {/* Background Padding */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Padding: {selectedElement.background.padding}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={selectedElement.background.padding}
                onChange={(e) =>
                  handleBackgroundChange({ padding: parseFloat(e.target.value) })
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Background Border Radius */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Border Radius: {selectedElement.background.borderRadius}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={selectedElement.background.borderRadius}
                onChange={(e) =>
                  handleBackgroundChange({
                    borderRadius: parseFloat(e.target.value),
                  })
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Delete Button */}
      <button
        onClick={() => onDelete(selectedElement.id)}
        className="w-full py-2 px-4 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
      >
        Delete Element
      </button>
    </div>
  );
}
