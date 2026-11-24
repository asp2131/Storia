import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
