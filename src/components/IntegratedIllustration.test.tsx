import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import IntegratedIllustration from "@/components/IntegratedIllustration";
import type { TextOverlayConfig } from "@/types/text-overlay";

const overlay: TextOverlayConfig = {
  version: 1,
  elements: [
    {
      id: "el-1",
      text: "hello world",
      x: 10,
      y: 12,
      width: 45,
      fontFamily: "Inter",
      fontSize: 5,
      fontWeight: 400,
      color: "#111111",
      textAlign: "left",
      rotation: 0,
    },
    {
      id: "el-2",
      text: "again friend",
      x: 12,
      y: 30,
      width: 45,
      fontFamily: "Gaegu",
      fontSize: 5,
      fontWeight: 400,
      color: "#111111",
      textAlign: "left",
      rotation: 0,
    },
  ],
};

describe("IntegratedIllustration overlay interactions", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "Image",
      class MockImage {
        onload: null | (() => void) = null;
        onerror: null | (() => void) = null;
        set src(_value: string) {
          setTimeout(() => this.onload?.(), 0);
        }
      }
    );
    vi.stubGlobal(
      "ResizeObserver",
      class MockResizeObserver {
        observe() {}
        disconnect() {}
        unobserve() {}
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("maps global word indexes across overlay elements and supports primary tap + highlight states", async () => {
    const onWordPrimaryAction = vi.fn();

    render(
      <IntegratedIllustration
        imageUrl="https://example.com/base.png"
        compositedImageUrl={null}
        overlay={overlay}
        alt="Page 1"
        preferDynamicOverlay
        activeWordIndex={2}
        pronouncingWordIndex={3}
        onWordPrimaryAction={onWordPrimaryAction}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("hello")).toBeInTheDocument();
    });

    const againWord = screen.getByText("again");
    const friendWord = screen.getByText("friend");

    fireEvent.click(againWord);

    expect(onWordPrimaryAction).toHaveBeenCalledWith("again", 2);
    expect(againWord).toHaveStyle({ backgroundColor: "var(--reader-highlight-bg)" });
    expect(friendWord).toHaveClass("word-pronouncing");
  });

  it("exposes interactive words accessibly and supports focused secondary action", async () => {
    const onWordPrimaryAction = vi.fn();
    const onWordSecondaryAction = vi.fn();

    render(
      <IntegratedIllustration
        imageUrl="https://example.com/base.png"
        compositedImageUrl={null}
        overlay={overlay}
        alt="Page 1"
        preferDynamicOverlay
        onWordPrimaryAction={onWordPrimaryAction}
        onWordSecondaryAction={onWordSecondaryAction}
      />
    );

    const helloWord = await screen.findByRole("button", { name: /hear hello/i });
    const soundOutHello = screen.getByRole("button", {
      name: /sound out word hello/i,
      hidden: true,
    });

    expect(helloWord.closest('[aria-hidden="true"]')).toBeNull();
    expect(soundOutHello.closest('[aria-hidden="true"]')).toBeNull();

    soundOutHello.focus();
    expect(soundOutHello).toHaveFocus();
    fireEvent.click(soundOutHello);
    expect(onWordSecondaryAction).toHaveBeenCalledWith("hello", 0);

    fireEvent.click(helloWord);
    expect(onWordPrimaryAction).toHaveBeenCalledWith("hello", 0);
  });

  it("fires secondary action on long press and suppresses click after long press", async () => {
    const onWordPrimaryAction = vi.fn();
    const onWordSecondaryAction = vi.fn();

    render(
      <IntegratedIllustration
        imageUrl="https://example.com/base.png"
        compositedImageUrl={null}
        overlay={overlay}
        alt="Page 1"
        preferDynamicOverlay
        onWordPrimaryAction={onWordPrimaryAction}
        onWordSecondaryAction={onWordSecondaryAction}
      />
    );

    const helloWord = await screen.findByRole("button", { name: /hear hello/i });
    vi.useFakeTimers();

    const beforePrimaryCalls = onWordPrimaryAction.mock.calls.length;
    const beforeSecondaryCalls = onWordSecondaryAction.mock.calls.length;

    fireEvent.pointerDown(helloWord);
    vi.advanceTimersByTime(460);
    fireEvent.pointerUp(helloWord);
    fireEvent.click(helloWord);

    expect(onWordSecondaryAction).toHaveBeenCalledTimes(beforeSecondaryCalls + 1);
    expect(onWordSecondaryAction).toHaveBeenCalledWith("hello", 0);
    expect(onWordPrimaryAction).toHaveBeenCalledTimes(beforePrimaryCalls);
  });
});
