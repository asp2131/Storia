import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MascotStoryWorld from "@/components/MascotStoryWorld";

const { pause, play, useRive } = vi.hoisted(() => {
  const pause = vi.fn();
  const play = vi.fn();
  return {
    pause,
    play,
    useRive: vi.fn(() => ({
      rive: { pause, play, isPlaying: false },
      RiveComponent: () => null,
    })),
  };
});

vi.mock("@rive-app/react-canvas", () => ({ useRive }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MascotStoryWorld", () => {
  it("loads the bound hero state machine and respects reduced motion", () => {
    const { rerender } = render(<MascotStoryWorld reduceMotion />);

    expect(useRive).toHaveBeenCalledWith(expect.objectContaining({
      src: "/lora_idle_3:4_angle.riv",
      artboard: "CHARACTER_MASTER",
      stateMachines: "State Machine 1",
      autoplay: true,
      autoBind: true,
    }));
    expect(pause).toHaveBeenCalledOnce();

    rerender(<MascotStoryWorld reduceMotion={false} />);
    expect(play).toHaveBeenCalledWith("State Machine 1");
  });
});
