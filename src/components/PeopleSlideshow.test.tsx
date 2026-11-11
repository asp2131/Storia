import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PeopleSlideshow from "@/components/PeopleSlideshow";

const slides = ["a", "b", "c"].map((id) => ({
  src: `/${id}.jpg`,
  alt: `photo ${id}`,
  title: `Slide ${id}`,
  detail: "detail",
}));

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes("reduced-motion") && reduce,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => mockReducedMotion(false));
afterEach(cleanup);

describe("PeopleSlideshow", () => {
  it("wraps prev/next, follows arrow keys, and advances when the progress timer ends", () => {
    const { container } = render(<PeopleSlideshow slides={slides} />);
    const caption = () => container.querySelector(".people-caption strong")?.textContent;

    expect(caption()).toBe("Slide a");
    fireEvent.click(screen.getByLabelText("Previous photo"));
    expect(caption()).toBe("Slide c");
    fireEvent.click(screen.getByLabelText("Next photo"));
    expect(caption()).toBe("Slide a");

    fireEvent.keyDown(screen.getByRole("region"), { key: "ArrowRight" });
    expect(caption()).toBe("Slide b");

    // jsdom has no AnimationEvent, so React binds the vendor-prefixed name there
    fireEvent(container.querySelector(".people-progress i")!, new Event("webkitAnimationEnd", { bubbles: true }));
    expect(caption()).toBe("Slide c");
  });

  it("does not autoplay under reduced motion but can be started", () => {
    mockReducedMotion(true);
    const { container } = render(<PeopleSlideshow slides={slides} />);
    const timer = () => container.querySelector<HTMLElement>(".people-progress i")!;

    expect(screen.getByLabelText("Play slideshow")).toBeTruthy();
    expect(timer().style.animationPlayState).toBe("paused");

    fireEvent.click(screen.getByLabelText("Play slideshow"));
    expect(timer().style.animationPlayState).toBe("running");
  });
});
