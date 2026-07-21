import { describe, it, expect } from "vitest";
import {
  applyBookTextStyle,
  buildNewTextElement,
  changedRememberedTextSettings,
  DEFAULT_BOOK_TEXT_STYLE,
  rememberTextSettings,
  seedTextElement,
  TEXT_OVERLAY_VERSION,
  validateBookTextStyle,
} from "./text-overlay";
import type { BookTextStyle, TextElement, TextOverlayConfig } from "./text-overlay";

const lora: BookTextStyle = {
  fontFamily: "Lora",
  fontSize: 6.5,
  fontWeight: 600,
  color: "#123456",
  textAlign: "center",
  shadow: { color: "rgba(0,0,0,0.5)", offsetX: 1, offsetY: 1, blur: 2 },
  background: { color: "rgba(0,0,0,0.5)", padding: 4, borderRadius: 4 },
  voiceId: "voice-1",
  voiceName: "Narrator",
};

function el(id: string, overrides: Partial<TextElement> = {}): TextElement {
  return {
    id,
    text: `text-${id}`,
    x: 20,
    y: 30,
    width: 40,
    fontFamily: "Inter",
    fontSize: 4,
    fontWeight: 400,
    color: "#000000",
    textAlign: "left",
    rotation: 15,
    ...overrides,
  };
}

describe("validateBookTextStyle", () => {
  it("round-trips a valid style", () => {
    expect(validateBookTextStyle(lora)).toEqual(lora);
  });

  it("rejects unknown fontFamily / fontWeight / textAlign", () => {
    expect(() => validateBookTextStyle({ ...lora, fontFamily: "Comic Sans" })).toThrow(
      /fontFamily/
    );
    expect(() => validateBookTextStyle({ ...lora, fontWeight: 900 })).toThrow(
      /fontWeight/
    );
    expect(() => validateBookTextStyle({ ...lora, textAlign: "justify" })).toThrow(
      /textAlign/
    );
  });

  it("clamps fontSize to 0.5–50 and defaults it to 5", () => {
    expect(validateBookTextStyle({ ...lora, fontSize: 99 }).fontSize).toBe(50);
    expect(validateBookTextStyle({ ...lora, fontSize: 0 }).fontSize).toBe(5);
  });

  it("defaults missing color and drops empty optional fields", () => {
    const { color: _color, ...rest } = lora;
    const validated = validateBookTextStyle({ ...rest, voiceId: "" });
    expect(validated.color).toBe("#000000");
    expect(validated).not.toHaveProperty("voiceId");
  });
});

describe("rememberTextSettings", () => {
  it("carries font family, size, and voice into future text blocks", () => {
    const remembered = rememberTextSettings(DEFAULT_BOOK_TEXT_STYLE, {
      fontFamily: "Lora",
      fontSize: 7.2,
      voiceId: "voice-2",
      voiceName: "Sprite",
    });

    expect(buildNewTextElement(remembered)).toMatchObject({
      fontFamily: "Lora",
      fontSize: 7.2,
      voiceId: "voice-2",
      voiceName: "Sprite",
    });
    expect(remembered.color).toBe(DEFAULT_BOOK_TEXT_STYLE.color);
  });

  it("changes settings independently and clears voice explicitly", () => {
    const fontOnly = rememberTextSettings(lora, { fontFamily: "Gaegu" });
    expect(fontOnly.voiceId).toBe("voice-1");

    const withoutVoice = rememberTextSettings(fontOnly, {
      voiceId: undefined,
      voiceName: undefined,
    });
    expect(withoutVoice).not.toHaveProperty("voiceId");
    expect(withoutVoice).not.toHaveProperty("voiceName");
  });

  it("detects only defaults explicitly changed on a text block", () => {
    const previous = el("a", { voiceId: "voice-1", voiceName: "Narrator" });
    const next = { ...previous, text: "Changed", fontSize: 7, voiceId: undefined, voiceName: undefined };

    expect(changedRememberedTextSettings(previous, next)).toEqual({
      fontSize: 7,
      voiceId: null,
      voiceName: null,
    });
  });
});

describe("seedTextElement / buildNewTextElement", () => {
  it("seedTextElement returns only style fields", () => {
    const seed = seedTextElement(lora);
    expect(seed).toEqual({
      fontFamily: "Lora",
      fontSize: 6.5,
      fontWeight: 600,
      color: "#123456",
      textAlign: "center",
      shadow: lora.shadow,
      background: lora.background,
      voiceId: "voice-1",
      voiceName: "Narrator",
    });
    expect(seed).not.toHaveProperty("x");
    expect(seed).not.toHaveProperty("text");
  });

  it("buildNewTextElement seeds style and applies geometry defaults", () => {
    const built = buildNewTextElement(lora);
    expect(built).toMatchObject({
      text: "New Text",
      x: 10,
      y: 10,
      width: 30,
      rotation: 0,
      fontFamily: "Lora",
      fontSize: 6.5,
      voiceId: "voice-1",
    });
    expect(built.id).toBeTruthy();
  });

  it("produces distinct ids and honours overrides", () => {
    const a = buildNewTextElement(DEFAULT_BOOK_TEXT_STYLE);
    const b = buildNewTextElement(DEFAULT_BOOK_TEXT_STYLE, { x: 55, text: "Hi" });
    expect(a.id).not.toBe(b.id);
    expect(b.x).toBe(55);
    expect(b.text).toBe("Hi");
  });
});

describe("applyBookTextStyle", () => {
  it("replaces style fields, preserves content/geometry/ids", () => {
    const config: TextOverlayConfig = {
      version: TEXT_OVERLAY_VERSION,
      elements: [el("a"), el("b")],
    };
    const next = applyBookTextStyle(config, lora);

    expect(next.version).toBe(TEXT_OVERLAY_VERSION);
    expect(next.elements).toHaveLength(2);
    for (const original of config.elements) {
      const updated = next.elements.find((e) => e.id === original.id)!;
      expect(updated).toMatchObject({
        id: original.id,
        text: original.text,
        x: original.x,
        y: original.y,
        width: original.width,
        rotation: original.rotation,
        fontFamily: "Lora",
        fontSize: 6.5,
        fontWeight: 600,
        color: "#123456",
        textAlign: "center",
        shadow: lora.shadow,
        background: lora.background,
        voiceId: "voice-1",
        voiceName: "Narrator",
      });
    }
  });

  it("removes shadow/background/voice when the style omits them", () => {
    const config: TextOverlayConfig = {
      version: TEXT_OVERLAY_VERSION,
      elements: [
        el("a", {
          shadow: { color: "#000", offsetX: 1, offsetY: 1, blur: 1 },
          background: { color: "#fff", padding: 2, borderRadius: 2 },
          voiceId: "old-voice",
          voiceName: "Old",
        }),
      ],
    };
    const bare: BookTextStyle = {
      fontFamily: "Gaegu",
      fontSize: 7,
      fontWeight: 300,
      color: "#ff0000",
      textAlign: "right",
    };
    const [updated] = applyBookTextStyle(config, bare).elements;
    expect(updated).not.toHaveProperty("shadow");
    expect(updated).not.toHaveProperty("background");
    expect(updated).not.toHaveProperty("voiceId");
    expect(updated).not.toHaveProperty("voiceName");
    expect(updated.fontFamily).toBe("Gaegu");
  });

  it("handles an empty elements array", () => {
    const next = applyBookTextStyle(
      { version: TEXT_OVERLAY_VERSION, elements: [] },
      lora
    );
    expect(next.elements).toEqual([]);
  });
});
