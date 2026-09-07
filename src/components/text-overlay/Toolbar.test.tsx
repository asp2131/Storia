import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toolbar } from "./Toolbar";

afterEach(cleanup);

describe("Toolbar history controls", () => {
  const props = {
    onAddElement: vi.fn(),
    onComposite: vi.fn(),
    isSaving: false,
    isCompositing: false,
    hasChanges: false,
    hasOverlay: true,
    hasBaseImage: true,
  };

  it("disables undo and redo when there is no history", () => {
    render(
      <Toolbar
        {...props}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        canUndo={false}
        canRedo={false}
      />
    );

    expect(screen.getByLabelText("Undo")).toBeDisabled();
    expect(screen.getByLabelText("Redo")).toBeDisabled();
  });

  it("fires the history actions when enabled", () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(
      <Toolbar {...props} onUndo={onUndo} onRedo={onRedo} canUndo canRedo />
    );

    fireEvent.click(screen.getByLabelText("Undo"));
    fireEvent.click(screen.getByLabelText("Redo"));

    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledOnce();
  });
});
