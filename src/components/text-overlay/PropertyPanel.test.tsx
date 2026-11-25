import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropertyPanel, parseCssColor, formatCssColor } from "./PropertyPanel";
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

function renderPanel(selected: TextElement | null) {
  return render(
    <PropertyPanel
      embedded
      selectedElement={selected}
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
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
        />
      );
    });

    expect(document.activeElement).not.toBe(screen.getByLabelText("Text content"));
  });

  it("saves the selected box's style for new boxes and confirms it", async () => {
    const box = element("a", "A little fox appeared.");
    const onUseStyleForNewBoxes = vi.fn().mockResolvedValue(undefined);
    render(
      <PropertyPanel
        embedded
        selectedElement={box}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onUseStyleForNewBoxes={onUseStyleForNewBoxes}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Use style for new text boxes" }));
    });

    expect(onUseStyleForNewBoxes).toHaveBeenCalledWith(box);
    expect(screen.getByRole("status").textContent).toMatch(/new text boxes/i);
  });

  it("hides the action when the editor cannot save a creator style", () => {
    renderPanel(element("a", "Edit me"));
    expect(screen.queryByRole("button", { name: "Use style for new text boxes" })).toBeNull();
  });
});

describe("colour helpers", () => {
  it("reads hex and rgb()/rgba() into hex + alpha", () => {
    expect(parseCssColor("#ABC")).toEqual({ hex: "#aabbcc", alpha: 1 });
    expect(parseCssColor("#1a2b3c")).toEqual({ hex: "#1a2b3c", alpha: 1 });
    expect(parseCssColor("rgba(0, 0, 0, 0.5)")).toEqual({ hex: "#000000", alpha: 0.5 });
    expect(parseCssColor("rgb(255,128,0)")).toEqual({ hex: "#ff8000", alpha: 1 });
    expect(parseCssColor("tomato")).toEqual({ hex: "#000000", alpha: 1 });
  });

  it("writes plain hex when opaque and rgba() when see-through", () => {
    expect(formatCssColor("#ff8000", 1)).toBe("#ff8000");
    expect(formatCssColor("#ff8000", 0.456)).toBe("rgba(255, 128, 0, 0.46)");
    expect(parseCssColor(formatCssColor("#102030", 0.3))).toEqual({ hex: "#102030", alpha: 0.3 });
  });
});
