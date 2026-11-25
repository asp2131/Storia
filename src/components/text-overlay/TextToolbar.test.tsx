import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextToolbar, formatCssColor, parseCssColor } from "./TextToolbar";
import type { TextElement } from "@/types/text-overlay";

afterEach(cleanup);

// Closed native popovers are display:none, so their contents need { hidden: true }.

const box: TextElement = {
  id: "a",
  text: "A little fox appeared.",
  x: 10,
  y: 10,
  width: 30,
  fontFamily: "Inter",
  fontSize: 5,
  fontWeight: 400,
  color: "#000000",
  textAlign: "left",
  rotation: 0,
  shadow: { color: "rgba(0, 0, 0, 0.5)", offsetX: 2, offsetY: 2, blur: 4 },
};

function renderToolbar(props: Partial<React.ComponentProps<typeof TextToolbar>> = {}) {
  const onChange = vi.fn();
  render(
    <TextToolbar
      element={box}
      onChange={onChange}
      onDuplicate={vi.fn()}
      onDelete={vi.fn()}
      {...props}
    />
  );
  return { onChange };
}

describe("TextToolbar", () => {
  it("toggles bold and steps the size", () => {
    const { onChange } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ fontWeight: 700 }));
    fireEvent.click(screen.getByRole("button", { name: "Bigger text" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ fontSize: 5.5 }));
  });

  it("turning an effect off sends an explicit undefined so the store drops it", () => {
    const { onChange } = renderToolbar();
    fireEvent.click(screen.getByRole("checkbox", { name: "Shadow", hidden: true }));
    const next = onChange.mock.lastCall![0] as TextElement;
    expect("shadow" in next).toBe(true);
    expect(next.shadow).toBeUndefined();
  });

  it("asks for a second click before restyling every page", async () => {
    const onApplyStyleToAllPages = vi.fn().mockResolvedValue(undefined);
    renderToolbar({ onApplyStyleToAllPages });

    fireEvent.click(screen.getByRole("button", { name: /Apply style to every page/, hidden: true }));
    expect(onApplyStyleToAllPages).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Click again to restyle every page/, hidden: true }));
    });
    expect(onApplyStyleToAllPages).toHaveBeenCalledWith(box);
    expect(screen.getByRole("status", { hidden: true }).textContent).toMatch(/every page/i);
  });

  it("saves the box's style for new boxes and confirms it", async () => {
    const onUseStyleForNewBoxes = vi.fn().mockResolvedValue(undefined);
    renderToolbar({ onUseStyleForNewBoxes });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Use style for new text boxes/, hidden: true }));
    });
    expect(onUseStyleForNewBoxes).toHaveBeenCalledWith(box);
    expect(screen.getByRole("status", { hidden: true }).textContent).toMatch(/new text boxes/i);
  });

  it("hides the style menu when there is nothing to put in it", () => {
    renderToolbar();
    expect(screen.queryByTitle("More text options")).toBeNull();
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
