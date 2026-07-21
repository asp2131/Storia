import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookStyleDrawer } from "@/components/editor/BookStyleDrawer";
import type { BookTextStyle } from "@/types/text-overlay";

const { mockUpdateBookTextStyle, mockApplyBookTextStyleToAllPages } = vi.hoisted(
  () => ({
    mockUpdateBookTextStyle: vi.fn(),
    mockApplyBookTextStyleToAllPages: vi.fn(),
  })
);

const mockBookTextStyle: BookTextStyle = {
  fontFamily: "Lora",
  fontSize: 6.5,
  fontWeight: 600,
  color: "#123456",
  textAlign: "center",
  voiceId: "voice-1",
  voiceName: "Narrator",
};

vi.mock("@/contexts/BookEditorContext", () => ({
  useBookMetaContext: () => ({
    bookTextStyle: mockBookTextStyle,
    applyingTextStyle: false,
    updateBookTextStyle: mockUpdateBookTextStyle,
    applyBookTextStyleToAllPages: mockApplyBookTextStyleToAllPages,
  }),
  useBookEditor: () => ({
    narration: {
      voiceOptions: [
        { id: "voice-1", name: "Narrator", category: "calm" },
        { id: "voice-2", name: "Sprite", category: "playful" },
      ],
    },
  }),
}));

describe("BookStyleDrawer", () => {
  beforeEach(() => {
    mockUpdateBookTextStyle.mockResolvedValue(undefined);
    mockApplyBookTextStyleToAllPages.mockResolvedValue({
      pagesUpdated: 3,
      elementsRestyled: 12,
      pagesSkipped: 0,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    render(<BookStyleDrawer open={false} onClose={() => {}} />);
    expect(screen.queryByText("Book Text Style")).toBeNull();
  });

  it("renders draft values from the book style", () => {
    render(<BookStyleDrawer open onClose={() => {}} />);

    expect(screen.getByDisplayValue("Lora")).toBeInTheDocument();
    expect(screen.getByText("Font Size: 6.5%")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("#123456")).toHaveLength(2);
    expect(screen.getByDisplayValue("Narrator (calm)")).toBeInTheDocument();
  });

  it("saves the edited draft via updateBookTextStyle", async () => {
    render(<BookStyleDrawer open onClose={() => {}} />);

    fireEvent.change(screen.getByDisplayValue("Lora"), {
      target: { value: "Gaegu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save style" }));

    await waitFor(() =>
      expect(mockUpdateBookTextStyle).toHaveBeenCalledWith({
        ...mockBookTextStyle,
        fontFamily: "Gaegu",
      })
    );
  });

  it("requires the confirm step before applying to all pages", async () => {
    render(<BookStyleDrawer open onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Apply to all pages…" }));
    expect(mockApplyBookTextStyleToAllPages).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm apply" }));

    await waitFor(() =>
      expect(mockApplyBookTextStyleToAllPages).toHaveBeenCalledTimes(1)
    );
    expect(
      await screen.findByText("Restyled 12 text blocks across 3 pages.")
    ).toBeInTheDocument();
  });

  it("shows an inline error when saving fails", async () => {
    mockUpdateBookTextStyle.mockRejectedValue(new Error("boom"));
    render(<BookStyleDrawer open onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Save style" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
