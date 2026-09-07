import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropertyPanel } from "./PropertyPanel";
import type { TextElement } from "@/types/text-overlay";

// This project has no global testing-library cleanup, so unmount between cases
// or duplicate renders collide on `screen` queries.
afterEach(cleanup);

function element(id: string, text: string): TextElement {
  return {
    id,
    text,
    x: 0,
    y: 0,
    width: 30,
    fontFamily: "Inter",
    fontSize: 4,
    fontWeight: 400,
    color: "#000000",
    textAlign: "left",
    rotation: 0,
  };
}

function renderPanel(selected: TextElement | null, focusTextToken = 0) {
  return render(
    <PropertyPanel
      embedded
      selectedElement={selected}
      focusTextToken={focusTextToken}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  );
}

describe("PropertyPanel", () => {
  it("does not steal focus when an element is merely selected", () => {
    const { rerender } = renderPanel(null);
    act(() => {
      rerender(
        <PropertyPanel
          embedded
          selectedElement={element("a", "Edit me")}
          focusTextToken={0}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
        />
      );
    });

    expect(document.activeElement).not.toBe(screen.getByLabelText("Text content"));
  });

  it("focuses the text content with the caret at the end when text edit is requested", () => {
    const { rerender } = renderPanel(element("a", "Edit me"), 0);
    act(() => {
      rerender(
        <PropertyPanel
          embedded
          selectedElement={element("a", "Edit me")}
          focusTextToken={1}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
        />
      );
    });

    const input = screen.getByLabelText("Text content") as HTMLTextAreaElement;
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(input.value.length);
  });
});
