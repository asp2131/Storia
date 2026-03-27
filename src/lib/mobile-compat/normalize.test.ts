import { describe, expect, it } from "vitest";
import {
  normalizeTextShadow,
  normalizeOverlayForMobile,
} from "@/lib/mobile-compat/normalize";

describe("normalizeTextShadow", () => {
  it("converts legacy offsetX/offsetY to canonical x/y", () => {
    const result = normalizeTextShadow({
      color: "#ff0000",
      offsetX: 2,
      offsetY: 3,
      blur: 4,
    });

    expect(result).toEqual({
      color: "#ff0000",
      x: 2,
      y: 3,
      blur: 4,
    });
  });

  it("passes through canonical x/y untouched", () => {
    const result = normalizeTextShadow({
      color: "#00ff00",
      x: 5,
      y: 6,
      blur: 7,
    });

    expect(result).toEqual({
      color: "#00ff00",
      x: 5,
      y: 6,
      blur: 7,
    });
  });

  it("prefers canonical x/y over legacy offsetX/offsetY when both present", () => {
    const result = normalizeTextShadow({
      color: "#000000",
      x: 10,
      y: 20,
      offsetX: 1,
      offsetY: 2,
      blur: 3,
    });

    expect(result).toEqual({
      color: "#000000",
      x: 10,
      y: 20,
      blur: 3,
    });
  });

  it("handles missing fields with defaults", () => {
    const result = normalizeTextShadow({});

    expect(result).toEqual({
      color: "#000000",
      x: 0,
      y: 0,
      blur: 0,
    });
  });

  it("handles missing color with default #000000", () => {
    const result = normalizeTextShadow({ x: 1, y: 2, blur: 3 });

    expect(result.color).toBe("#000000");
  });
});

describe("normalizeOverlayForMobile", () => {
  it("normalizes shadows across all elements", () => {
    const input = {
      version: 1,
      elements: [
        {
          id: "el1",
          text: "Hello",
          shadow: { color: "#000", offsetX: 2, offsetY: 3, blur: 4 },
        },
        {
          id: "el2",
          text: "World",
          shadow: { color: "#fff", offsetX: 1, offsetY: 1, blur: 2 },
        },
      ],
    };

    const result = normalizeOverlayForMobile(input);

    expect(result.elements[0].shadow).toEqual({
      color: "#000",
      x: 2,
      y: 3,
      blur: 4,
    });
    expect(result.elements[1].shadow).toEqual({
      color: "#fff",
      x: 1,
      y: 1,
      blur: 2,
    });
  });

  it("leaves elements without shadows unchanged", () => {
    const input = {
      version: 1,
      elements: [
        { id: "el1", text: "No shadow here", fontSize: 16 },
        {
          id: "el2",
          text: "Has shadow",
          shadow: { color: "#000", offsetX: 1, offsetY: 1, blur: 1 },
        },
      ],
    };

    const result = normalizeOverlayForMobile(input);

    expect(result.elements[0]).toEqual({
      id: "el1",
      text: "No shadow here",
      fontSize: 16,
    });
    expect(result.elements[1].shadow).toEqual({
      color: "#000",
      x: 1,
      y: 1,
      blur: 1,
    });
  });

  it("does not mutate the input object", () => {
    const originalShadow = {
      color: "#000",
      offsetX: 2,
      offsetY: 3,
      blur: 4,
    };
    const input = {
      version: 1,
      elements: [{ id: "el1", text: "Hello", shadow: originalShadow }],
    };

    const inputCopy = JSON.parse(JSON.stringify(input));
    normalizeOverlayForMobile(input);

    expect(input).toEqual(inputCopy);
  });

  it("preserves the version field", () => {
    const input = { version: 2, elements: [] };
    const result = normalizeOverlayForMobile(input);

    expect(result.version).toBe(2);
  });

  it("handles elements with null shadow", () => {
    const input = {
      version: 1,
      elements: [{ id: "el1", text: "Test", shadow: null }],
    };

    const result = normalizeOverlayForMobile(input);

    expect(result.elements[0].shadow).toBeNull();
  });
});
