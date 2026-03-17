import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DraggableTextOverlayEditor } from "@/components/text-overlay/DraggableTextOverlayEditor";
import type { TextOverlayConfig } from "@/types/text-overlay";

let matchesCompactViewport = false;

vi.mock("react-modal-sheet", () => {
  const SheetRoot = ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: ReactNode;
  }) => (isOpen ? <div data-testid="mock-sheet">{children}</div> : null);

  return {
    Sheet: Object.assign(SheetRoot, {
      Backdrop: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Container: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Header: () => <div data-testid="mock-sheet-header" />,
      Content: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    }),
  };
});

describe("DraggableTextOverlayEditor", () => {
  const overlay: TextOverlayConfig = {
    version: 1,
    elements: [
      {
        id: "overlay-1",
        text: "Hello overlay",
        x: 10,
        y: 15,
        width: 35,
        fontFamily: "Inter",
        fontSize: 5,
        fontWeight: 400,
        color: "#111111",
        textAlign: "left",
        rotation: 0,
      },
    ],
  };

  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: matchesCompactViewport && query === "(max-width: 1023px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    class ResizeObserverMock {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  beforeEach(() => {
    matchesCompactViewport = false;
  });

  it("renders the desktop property sidebar when not compact", () => {
    render(
      <DraggableTextOverlayEditor
        imageUrl="https://example.com/image.png"
        overlay={overlay}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onComposite={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText("Select a text element to edit its properties")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-sheet")).not.toBeInTheDocument();
  });

  it("opens the property sheet when selecting text on compact layouts", () => {
    matchesCompactViewport = true;

    render(
      <DraggableTextOverlayEditor
        imageUrl="https://example.com/image.png"
        overlay={overlay}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onComposite={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.pointerDown(screen.getByText("Hello overlay"), {
      pointerId: 1,
      clientX: 120,
      clientY: 120,
    });

    expect(screen.getByTestId("mock-sheet")).toBeInTheDocument();
    expect(screen.getByText("Text properties")).toBeInTheDocument();
  });
});
