import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWordPronunciation } from "@/hooks/useWordPronunciation";

type MockSource = {
  buffer: AudioBuffer | null;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
};

describe("useWordPronunciation", () => {
  let createdSources: MockSource[];
  let fetchMock: ReturnType<typeof vi.fn>;

  const waitForMountEffectsToSettle = async () => {
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/hello.mp3");
    });
  };

  beforeEach(() => {
    createdSources = [];
    fetchMock = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
      json: async () => ({ url: "/fallback-audio.mp3" }),
    }));

    vi.stubGlobal("fetch", fetchMock);

    class MockAudioContext {
      state: AudioContextState = "running";

      resume = vi.fn(async () => undefined);
      close = vi.fn(async () => undefined);
      decodeAudioData = vi.fn(async () => ({ duration: 1 } as AudioBuffer));
      createBufferSource() {
        const source: MockSource = {
          buffer: null,
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          onended: null,
        };
        createdSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      }
      get destination() {
        return {} as AudioDestinationNode;
      }
    }

    vi.stubGlobal("AudioContext", MockAudioContext as unknown as typeof AudioContext);
    vi.stubGlobal("requestIdleCallback", ((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 1 } as IdleDeadline);
      return 1;
    }) as typeof requestIdleCallback);
    vi.stubGlobal("cancelIdleCallback", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pauses narration for breakdown playback and resumes when playback ends", async () => {
    let narrationPlaying = true;
    const narrationIntentVersion = 0;
    const pauseNarration = vi.fn(() => {
      narrationPlaying = false;
    });
    const resumeNarration = vi.fn(() => {
      narrationPlaying = true;
    });
    const wordPronunciations = { hello: "/hello.mp3" };

    const { result } = renderHook(() =>
      useWordPronunciation({
        wordPronunciations,
        getNarrationPlaybackState: () => narrationPlaying,
        pauseNarration,
        resumeNarration,
        getNarrationIntentVersion: () => narrationIntentVersion,
      })
    );

    await waitForMountEffectsToSettle();

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "breakdown" });
    });

    await waitFor(() => {
      expect(pauseNarration).toHaveBeenCalledTimes(1);
      expect(createdSources).toHaveLength(1);
      expect(createdSources.at(-1)?.onended).toEqual(expect.any(Function));
    });

    act(() => {
      createdSources.at(-1)?.onended?.();
    });

    await waitFor(() => {
      expect(resumeNarration).toHaveBeenCalledTimes(1);
      expect(result.current.pronouncingIndex).toBeNull();
    });
  });

  it("does not auto-resume narration after a newer user intent", async () => {
    let narrationPlaying = true;
    let narrationIntentVersion = 5;
    const pauseNarration = vi.fn(() => {
      narrationPlaying = false;
    });
    const resumeNarration = vi.fn(() => {
      narrationPlaying = true;
    });
    const wordPronunciations = { hello: "/hello.mp3" };

    const { result } = renderHook(() =>
      useWordPronunciation({
        wordPronunciations,
        getNarrationPlaybackState: () => narrationPlaying,
        pauseNarration,
        resumeNarration,
        getNarrationIntentVersion: () => narrationIntentVersion,
      })
    );

    await waitForMountEffectsToSettle();

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "breakdown" });
    });

    await waitFor(() => {
      expect(pauseNarration).toHaveBeenCalledTimes(1);
      expect(createdSources).toHaveLength(1);
      expect(createdSources.at(-1)?.onended).toEqual(expect.any(Function));
    });

    act(() => {
      narrationIntentVersion += 1;
      createdSources.at(-1)?.onended?.();
    });

    await waitFor(() => {
      expect(resumeNarration).not.toHaveBeenCalled();
      expect(result.current.pronouncingIndex).toBeNull();
    });
  });

  it("does not resume narration when breakdown starts while narration is already paused", async () => {
    const narrationPlaying = false;
    const pauseNarration = vi.fn();
    const resumeNarration = vi.fn();
    const wordPronunciations = { hello: "/hello.mp3" };

    const { result } = renderHook(() =>
      useWordPronunciation({
        wordPronunciations,
        getNarrationPlaybackState: () => narrationPlaying,
        pauseNarration,
        resumeNarration,
        getNarrationIntentVersion: () => 0,
      })
    );

    await waitForMountEffectsToSettle();

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "breakdown" });
    });

    await waitFor(() => {
      expect(pauseNarration).not.toHaveBeenCalled();
      expect(createdSources).toHaveLength(1);
      expect(createdSources.at(-1)?.onended).toEqual(expect.any(Function));
    });

    act(() => {
      createdSources.at(-1)?.onended?.();
    });

    await waitFor(() => {
      expect(resumeNarration).not.toHaveBeenCalled();
      expect(result.current.pronouncingIndex).toBeNull();
    });
  });

  it("selects breakdown URL when mode is breakdown and entry has both URLs", async () => {
    const wordPronunciations = {
      hello: { breakdown: "/hello-breakdown.mp3", fullWord: "/hello-full.mp3" },
    };

    const { result } = renderHook(() =>
      useWordPronunciation({
        wordPronunciations,
        getNarrationPlaybackState: () => false,
      })
    );

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((args) => args[0]);
      expect(urls).toContain("/hello-breakdown.mp3");
      expect(urls).toContain("/hello-full.mp3");
    });

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "breakdown" });
    });

    await waitFor(() => {
      expect(createdSources).toHaveLength(1);
      expect(createdSources[0].start).toHaveBeenCalled();
    });

    const breakdownCalls = fetchMock.mock.calls.filter(
      (args) => args[0] === "/hello-breakdown.mp3"
    ).length;
    const fullWordCalls = fetchMock.mock.calls.filter(
      (args) => args[0] === "/hello-full.mp3"
    ).length;
    expect(breakdownCalls).toBe(1);
    expect(fullWordCalls).toBe(1);
  });

  it("falls back to fullWord when breakdown URL missing in breakdown mode", async () => {
    const wordPronunciations = { hello: { fullWord: "/hello-full.mp3" } };

    const { result } = renderHook(() =>
      useWordPronunciation({
        wordPronunciations,
        getNarrationPlaybackState: () => false,
      })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/hello-full.mp3");
    });

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "breakdown" });
    });

    await waitFor(() => {
      expect(createdSources).toHaveLength(1);
      expect(createdSources[0].start).toHaveBeenCalled();
    });

    const fullWordCalls = fetchMock.mock.calls.filter(
      (args) => args[0] === "/hello-full.mp3"
    ).length;
    expect(fullWordCalls).toBe(1);
  });

  it("prefers fullWord over breakdown in whole-word mode", async () => {
    const wordPronunciations = {
      hello: { breakdown: "/hello-breakdown.mp3", fullWord: "/hello-full.mp3" },
    };

    const { result } = renderHook(() =>
      useWordPronunciation({
        wordPronunciations,
        getNarrationPlaybackState: () => false,
      })
    );

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((args) => args[0]);
      expect(urls).toContain("/hello-full.mp3");
    });

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "whole-word" });
    });

    await waitFor(() => {
      expect(createdSources).toHaveLength(1);
      expect(createdSources[0].start).toHaveBeenCalled();
    });

    const breakdownCalls = fetchMock.mock.calls.filter(
      (args) => args[0] === "/hello-breakdown.mp3"
    ).length;
    const fullWordCalls = fetchMock.mock.calls.filter(
      (args) => args[0] === "/hello-full.mp3"
    ).length;
    expect(breakdownCalls).toBe(1);
    expect(fullWordCalls).toBe(1);
  });

  it("treats legacy string entry as the URL for both modes", async () => {
    const wordPronunciations = { hello: "/hello-legacy.mp3" };

    const { result } = renderHook(() =>
      useWordPronunciation({
        wordPronunciations,
        getNarrationPlaybackState: () => false,
      })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/hello-legacy.mp3");
    });

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "breakdown" });
    });

    await waitFor(() => {
      expect(createdSources).toHaveLength(1);
    });

    act(() => {
      createdSources.at(-1)?.onended?.();
    });

    await waitFor(() => {
      expect(result.current.pronouncingIndex).toBeNull();
    });

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "whole-word" });
    });

    await waitFor(() => {
      expect(createdSources).toHaveLength(2);
    });

    const legacyCalls = fetchMock.mock.calls.filter(
      (args) => args[0] === "/hello-legacy.mp3"
    ).length;
    expect(legacyCalls).toBe(1);
  });

  it("breakdown and whole-word clips are cached independently per mode", async () => {
    const wordPronunciations = {
      hello: { breakdown: "/hello-breakdown.mp3", fullWord: "/hello-full.mp3" },
    };

    const { result } = renderHook(() =>
      useWordPronunciation({
        wordPronunciations,
        getNarrationPlaybackState: () => false,
      })
    );

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((args) => args[0]);
      expect(urls).toContain("/hello-breakdown.mp3");
      expect(urls).toContain("/hello-full.mp3");
    });

    const countUrl = (url: string) =>
      fetchMock.mock.calls.filter((args) => args[0] === url).length;
    const breakdownBefore = countUrl("/hello-breakdown.mp3");
    const fullWordBefore = countUrl("/hello-full.mp3");

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "breakdown" });
    });
    await waitFor(() => expect(createdSources).toHaveLength(1));
    act(() => { createdSources.at(-1)?.onended?.(); });

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "whole-word" });
    });
    await waitFor(() => expect(createdSources).toHaveLength(2));
    act(() => { createdSources.at(-1)?.onended?.(); });

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "breakdown" });
    });
    await waitFor(() => expect(createdSources).toHaveLength(3));

    expect(countUrl("/hello-breakdown.mp3")).toBe(breakdownBefore);
    expect(countUrl("/hello-full.mp3")).toBe(fullWordBefore);
  });

  it("rapid-fire same word: second request cancels first source", async () => {
    const wordPronunciations = { hello: "/hello.mp3" };

    const { result } = renderHook(() =>
      useWordPronunciation({
        wordPronunciations,
        getNarrationPlaybackState: () => false,
      })
    );

    await waitForMountEffectsToSettle();

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "whole-word" });
    });

    await waitFor(() => expect(createdSources).toHaveLength(1));

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 1, mode: "whole-word" });
    });

    await waitFor(() => expect(createdSources).toHaveLength(2));

    expect(createdSources[0].stop).toHaveBeenCalled();
    expect(createdSources[0].onended).toBeNull();
    expect(result.current.pronouncingIndex).toBe(1);

    act(() => {
      createdSources[1].onended?.();
    });

    await waitFor(() => {
      expect(result.current.pronouncingIndex).toBeNull();
    });
  });

  it("whole-word mode does not pause or resume narration", async () => {
    const pauseNarration = vi.fn();
    const resumeNarration = vi.fn();
    const wordPronunciations = { hello: "/hello.mp3" };

    const { result } = renderHook(() =>
      useWordPronunciation({
        wordPronunciations,
        getNarrationPlaybackState: () => true,
        pauseNarration,
        resumeNarration,
        getNarrationIntentVersion: () => 0,
      })
    );

    await waitForMountEffectsToSettle();

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "whole-word" });
    });

    await waitFor(() => expect(createdSources).toHaveLength(1));

    act(() => {
      createdSources.at(-1)?.onended?.();
    });

    await waitFor(() => {
      expect(result.current.pronouncingIndex).toBeNull();
    });

    expect(pauseNarration).not.toHaveBeenCalled();
    expect(resumeNarration).not.toHaveBeenCalled();
  });

  it("changing wordPronunciations map cancels active playback", async () => {
    const pageOne: Record<string, string> = { hello: "/hello.mp3" };
    const pageTwo: Record<string, string> = { world: "/world.mp3" };

    const { result, rerender } = renderHook(
      ({ map }: { map: Record<string, string> }) =>
        useWordPronunciation({
          wordPronunciations: map,
          getNarrationPlaybackState: () => false,
        }),
      { initialProps: { map: pageOne } }
    );

    await waitForMountEffectsToSettle();

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "whole-word" });
    });

    await waitFor(() => expect(createdSources).toHaveLength(1));
    const firstSource = createdSources[0];
    expect(firstSource.start).toHaveBeenCalled();

    act(() => {
      rerender({ map: pageTwo });
    });

    await waitFor(() => {
      expect(firstSource.stop).toHaveBeenCalled();
      expect(result.current.pronouncingIndex).toBeNull();
    });
  });
});
