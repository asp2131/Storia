import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import IntegratedIllustration from "@/components/IntegratedIllustration";
import type { TextOverlayConfig } from "@/types/text-overlay";

describe("IntegratedIllustration overlay interactions", () => {
  it("maps global word indexes across overlay elements and supports tap + highlight states", async () => {
    const onWordTap = vi.fn();

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

    render(
      <IntegratedIllustration
        imageUrl="https://example.com/base.png"
        compositedImageUrl={null}
        overlay={overlay}
        alt="Page 1"
        preferDynamicOverlay
        activeWordIndex={2}
        pronouncingWordIndex={3}
        onWordTap={onWordTap}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("hello")).toBeInTheDocument();
    });

    const againWord = screen.getByText("again");
    const friendWord = screen.getByText("friend");

    fireEvent.click(againWord);

    expect(onWordTap).toHaveBeenCalledWith("again", 2);
    expect(againWord).toHaveStyle({ backgroundColor: "var(--reader-highlight-bg)" });
    expect(friendWord).toHaveClass("word-pronouncing");
  });
});
