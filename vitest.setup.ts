import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = vi.fn();
}

if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = vi.fn();
}

class InstantImage {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;

  set src(_value: string) {
    queueMicrotask(() => {
      this.onload?.();
    });
  }
}

vi.stubGlobal("Image", InstantImage);
