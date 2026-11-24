import { describe, expect, it } from "vitest";
import { parseTruetypeUrl, wrapText } from "./image-compositing";

// The composited PNG only matches the editor if node-canvas gets a real TTF for
// the overlay family, so the shape of the Google Fonts response matters.
const CSS2_RESPONSE = `@font-face {
  font-family: 'Nunito';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/nunito/v32/XRXI3I6Li01BKofiOc5wtlZ2di8HDFwmRTM.ttf) format('truetype');
}`;

describe("parseTruetypeUrl", () => {
  it("extracts the truetype source Google serves to old user agents", () => {
    expect(parseTruetypeUrl(CSS2_RESPONSE)).toBe(
      "https://fonts.gstatic.com/s/nunito/v32/XRXI3I6Li01BKofiOc5wtlZ2di8HDFwmRTM.ttf"
    );
  });

  it("returns null for a woff2 response, so the caller falls back", () => {
    const woff2 = CSS2_RESPONSE.replace(".ttf) format('truetype')", ".woff2) format('woff2')");
    expect(parseTruetypeUrl(woff2)).toBeNull();
  });
});

describe("wrapText", () => {
  // One unit of width per character keeps the expected lines readable.
  const ctx = { measureText: (s: string) => ({ width: s.length }) } as Parameters<typeof wrapText>[0];

  it("keeps the author's line breaks, then wraps each line to the box width", () => {
    expect(wrapText(ctx, "The forest was quiet.\nThen the music began.", 12)).toEqual([
      "The forest",
      "was quiet.",
      "Then the",
      "music began.",
    ]);
  });

  it("keeps blank lines blank", () => {
    expect(wrapText(ctx, "One\n\nTwo", 20)).toEqual(["One", "", "Two"]);
  });
});
