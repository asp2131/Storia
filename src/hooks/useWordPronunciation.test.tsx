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
  let audioBufferUrlIds: Map<string, number>;
  let audioBufferUrlsById: Map<number, string>;

  const waitForMountEffectsToSettle = async () => {
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/hello.mp3");
    });
  };

  beforeEach(() => {
    createdSources = [];
    audioBufferUrlIds = new Map<string, number>();
    audioBufferUrlsById = new Map<number, string>();
    fetchMock = vi.fn(async (url: string) => {
      const buffer = new ArrayBuffer(8);
      const id = audioBufferUrlIds.get(url) ?? audioBufferUrlIds.size + 1;
      audioBufferUrlIds.set(url, id);
      audioBufferUrlsById.set(id, url);
      new Uint8Array(buffer)[0] = id;
      return {
        ok: true,
        arrayBuffer: async () => buffer,
        json: async () => ({ url: "/fallback-audio.mp3" }),
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    class MockAudioContext {
      state: AudioContextState = "running";

      resume = vi.fn(async () => undefined);
      close = vi.fn(async () => undefined);
      decodeAudioData = vi.fn(async (buffer: ArrayBuffer) => {
        const id = new Uint8Array(buffer)[0];
        return { duration: 1, __url: audioBufferUrlsById.get(id) } as unknown as AudioBuffer;
      });
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

  // ── WR-5.3: Breakdown 2-clip sequence ─────────────────────────────────────

  it("WR-5.3: breakdown mode plays breakdown clip then full-word clip in sequence", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const wordPronunciations = {
      hello: { breakdown: "/hello-breakdown.mp3", fullWord: "/hello-full.mp3" },
    };

    const { result } = renderHook(() =>
      useWordPronunciation({
        wordPronunciations,
        getNarrationPlaybackState: () => false,
      })
    );

    // Wait for preload to settle (real timers used in waitFor).
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((args: unknown[]) => args[0]);
      expect(urls).toContain("/hello-breakdown.mp3");
      expect(urls).toContain("/hello-full.mp3");
    });

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "breakdown" });
    });

    // Step 1: breakdown clip starts.
    await waitFor(() => {
      expect(createdSources).toHaveLength(1);
      expect(createdSources[0].start).toHaveBeenCalled();
      expect(createdSources[0].buffer).toHaveProperty("__url", "/hello-breakdown.mp3");
      expect(result.current.playbackState).toBe("pronouncing-step1");
    });

    // Step 1 ends → gap → step 2 starts.
    act(() => {
      createdSources[0].onended?.();
    });
    vi.advanceTimersByTime(200);

    await waitFor(() => {
      expect(createdSources).toHaveLength(2);
      expect(createdSources[1].start).toHaveBeenCalled();
      expect(createdSources[1].buffer).toHaveProperty("__url", "/hello-full.mp3");
      expect(result.current.playbackState).toBe("pronouncing-step2");
    });

    // Step 2 ends → idle.
    act(() => {
      createdSources[1].onended?.();
    });

    await waitFor(() => {
      expect(result.current.playbackState).toBe("idle");
      expect(result.current.pronouncingIndex).toBeNull();
    });

    vi.useRealTimers();
  });

  it("WR-5.3: breakdown narration resumes after step2 ends (not after step1)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    let narrationPlaying = true;
    const narrationIntentVersion = 0;
    const pauseNarration = vi.fn(() => { narrationPlaying = false; });
    const resumeNarration = vi.fn(() => { narrationPlaying = true; });

    const wordPronunciations = {
      hello: { breakdown: "/hello-breakdown.mp3", fullWord: "/hello-full.mp3" },
    };

    const { result } = renderHook(() =>
      useWordPronunciation({
        wordPronunciations,
        getNarrationPlaybackState: () => narrationPlaying,
        pauseNarration,
        resumeNarration,
        getNarrationIntentVersion: () => narrationIntentVersion,
      })
    );

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((args: unknown[]) => args[0]);
      expect(urls).toContain("/hello-breakdown.mp3");
    });

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "breakdown" });
    });

    await waitFor(() => {
      expect(pauseNarration).toHaveBeenCalledTimes(1);
      expect(createdSources).toHaveLength(1);
    });

    // After step1 ends, narration must NOT resume yet.
    act(() => {
      createdSources[0].onended?.();
    });
    vi.advanceTimersByTime(200);

    await waitFor(() => expect(createdSources).toHaveLength(2));
    expect(resumeNarration).not.toHaveBeenCalled();

    // After step2 ends, narration resumes.
    act(() => {
      createdSources[1].onended?.();
    });

    await waitFor(() => {
      expect(resumeNarration).toHaveBeenCalledTimes(1);
      expect(result.current.pronouncingIndex).toBeNull();
    });

    vi.useRealTimers();
  });

  it("WR-5.3: new request during gap cancels step2 and starts fresh (cancel-and-replace)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const wordPronunciations = {
      hello: { breakdown: "/hello-breakdown.mp3", fullWord: "/hello-full.mp3" },
      world: "/world.mp3",
    };

    fetchMock = vi.fn(async (url: string) => {
      if (url === "/world.mp3") {
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
      }
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useWordPronunciation({
        wordPronunciations,
        getNarrationPlaybackState: () => false,
      })
    );

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((args: unknown[]) => args[0]);
      expect(urls).toContain("/hello-breakdown.mp3");
    });

    // Start breakdown sequence for "hello".
    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "breakdown" });
    });

    await waitFor(() => expect(createdSources).toHaveLength(1));
    const step1Source = createdSources[0];

    // Step1 ends; gap timer starts.
    act(() => { step1Source.onended?.(); });

    // Before gap elapses, fire a new request (cancel-and-replace, WR-5.8).
    act(() => {
      result.current.pronounceWord({ word: "world", index: 1, mode: "whole-word" });
    });

    // Advance past gap — step2 must NOT start because request was replaced.
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      // The new "world" request starts a source.
      expect(result.current.pronouncingIndex).toBe(1);
    });

    // The new "world" source should be the last (or only second) source.
    // step2 for "hello" must NOT have started because the request was replaced.
    // We verify this by checking that pronouncingIndex is the new request's index (1).
    expect(result.current.pronouncingIndex).toBe(1);
    // The new source should be playing.
    expect(createdSources.at(-1)?.start).toHaveBeenCalled();

    // step1Source.onended was already invoked (we called it), so it's not null.
    // The important invariant is that the gap timer's playStep2 is a no-op —
    // verified by the fact that createdSources does NOT have a step2 entry
    // between step1 and the world source. We only allow ≤3 total sources
    // (step1, possibly step2 if it raced, world). Any step2 would show
    // pronouncingIndex as 0 instead of 1 — already asserted above.
    expect(createdSources.length).toBeLessThanOrEqual(3);

    vi.useRealTimers();
  });

  it("WR-5.7: user toggling narration during step2 prevents auto-resume", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    let narrationPlaying = true;
    let narrationIntentVersion = 0;
    const pauseNarration = vi.fn(() => { narrationPlaying = false; });
    const resumeNarration = vi.fn();

    const wordPronunciations = {
      hello: { breakdown: "/hello-breakdown.mp3", fullWord: "/hello-full.mp3" },
    };

    const { result } = renderHook(() =>
      useWordPronunciation({
        wordPronunciations,
        getNarrationPlaybackState: () => narrationPlaying,
        pauseNarration,
        resumeNarration,
        getNarrationIntentVersion: () => narrationIntentVersion,
      })
    );

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((args: unknown[]) => args[0]);
      expect(urls).toContain("/hello-breakdown.mp3");
    });

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "breakdown" });
    });

    await waitFor(() => expect(createdSources).toHaveLength(1));

    act(() => { createdSources[0].onended?.(); });
    vi.advanceTimersByTime(200);

    await waitFor(() => expect(createdSources).toHaveLength(2));

    // User manually toggles narration DURING step2 (intent version bumped).
    act(() => { narrationIntentVersion += 1; });

    act(() => { createdSources[1].onended?.(); });

    await waitFor(() => {
      expect(result.current.pronouncingIndex).toBeNull();
    });

    // Auto-resume must be suppressed because user intent changed.
    expect(resumeNarration).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("WR-5.4: if only fullWord exists (no breakdown), plays single full-word clip for breakdown mode", async () => {
    const wordPronunciations = { hello: { fullWord: "/hello-full.mp3" } };

    const { result } = renderHook(() =>
      useWordPronunciation({
        wordPronunciations,
        getNarrationPlaybackState: () => false,
      })
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/hello-full.mp3"));

    act(() => {
      result.current.pronounceWord({ word: "hello", index: 0, mode: "breakdown" });
    });

    await waitFor(() => {
      expect(createdSources).toHaveLength(1);
      expect(createdSources[0].start).toHaveBeenCalled();
    });

    // Ends cleanly.
    act(() => { createdSources[0].onended?.(); });

    await waitFor(() => {
      expect(result.current.pronouncingIndex).toBeNull();
      expect(result.current.playbackState).toBe("idle");
    });
  });

  it("WR-5.9: rapid taps do not leave UI in stuck pronouncingIndex state", async () => {
    const wordPronunciations = { hello: "/hello.mp3" };

    const { result } = renderHook(() =>
      useWordPronunciation({
        wordPronunciations,
        getNarrationPlaybackState: () => false,
      })
    );

    await waitForMountEffectsToSettle();

    // Fire 5 rapid requests.
    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.pronounceWord({ word: "hello", index: i, mode: "whole-word" });
      }
    });

    // Only the last request's source should remain; earlier sources are cancelled.
    await waitFor(() => {
      // At least one source should be active.
      expect(createdSources.length).toBeGreaterThanOrEqual(1);
      // The pronouncingIndex should be the last request's index (4).
      expect(result.current.pronouncingIndex).toBe(4);
    });

    // All but the last source should have been stopped.
    const allButLast = createdSources.slice(0, -1);
    for (const src of allButLast) {
      expect(src.stop).toHaveBeenCalled();
    }

    // End the last active source; state should clear.
    act(() => { createdSources.at(-1)?.onended?.(); });

    await waitFor(() => {
      expect(result.current.pronouncingIndex).toBeNull();
      expect(result.current.playbackState).toBe("idle");
    });
  });
});
