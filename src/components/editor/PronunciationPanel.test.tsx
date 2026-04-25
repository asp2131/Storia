import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PronunciationPanel } from "@/components/editor/PronunciationPanel";
import type {
  PronunciationCoverageReport,
  PronunciationGenerationResult,
  PronunciationReviewResponse,
  VoiceSettings,
} from "@/hooks/useBookData";

const {
  mockUsePronunciationCoverage,
  mockUseGenerateBookPronunciations,
  mockUsePronunciationReview,
} = vi.hoisted(() => ({
  mockUsePronunciationCoverage: vi.fn(),
  mockUseGenerateBookPronunciations: vi.fn(),
  mockUsePronunciationReview: vi.fn(),
}));

vi.mock("@/hooks/useBookData", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useBookData")>(
    "@/hooks/useBookData"
  );
  return {
    ...actual,
    usePronunciationCoverage: mockUsePronunciationCoverage,
    useGenerateBookPronunciations: mockUseGenerateBookPronunciations,
    usePronunciationReview: mockUsePronunciationReview,
  };
});

const voiceSettings: VoiceSettings = {
  speed: 1,
  style: 0.35,
  useSpeakerBoost: true,
};

const coverageReport: PronunciationCoverageReport = {
  bookId: "42",
  coverage: {
    uniqueBookTokens: 10,
    coveredBookWide: 7,
    ratio: 0.7,
    perPage: [
      {
        pageId: "p1",
        pageNumber: 1,
        total: 4,
        covered: 2,
        fullWordOnly: 1,
        missing: 2,
        missingWords: ["adventure", "forest"],
        status: "partial",
      },
      {
        pageId: "p2",
        pageNumber: 2,
        total: 6,
        covered: 5,
        fullWordOnly: 0,
        missing: 1,
        missingWords: ["lantern"],
        status: "missing",
      },
    ],
  },
  summary: {
    uniqueBookTokens: 10,
    coveredBookWide: 7,
    missingBookWide: 3,
    ratio: 0.7,
    pagesTotal: 2,
    pagesComplete: 0,
    pagesPartial: 1,
    pagesEmpty: 0,
    pagesWithMissing: 2,
    fullCoverage: false,
  },
};

const reviewResponse: PronunciationReviewResponse = {
  bookId: "42",
  filters: {
    search: null,
    pageNumber: null,
    coverageStatus: null,
    reviewStatus: null,
    limit: 100,
    offset: 0,
  },
  review: {
    filteredTotal: 4,
    summary: {
      totalWords: 4,
      coveredWords: 1,
      fullWordOnlyWords: 1,
      missingWords: 1,
      generatedWords: 2,
      reviewedWords: 1,
      failedWords: 1,
    },
    items: [
      {
        normalizedWord: "adventure",
        displayWord: "Adventure",
        occurrences: 2,
        pageIds: ["p1", "p2"],
        pageNumbers: [1, 2],
        coverageStatus: "covered",
        reviewStatus: "reviewed",
        humanReviewed: true,
        audio: {
          fullWord: "/audio/adventure-full.mp3",
          breakdown: "/audio/adventure-break.mp3",
        },
        source: "override",
        confidence: 0.92,
        generatedAt: "2026-04-23T12:00:00.000Z",
        status: "reviewed",
      },
      {
        normalizedWord: "forest",
        displayWord: "forest",
        occurrences: 1,
        pageIds: ["p1"],
        pageNumbers: [1],
        coverageStatus: "full-word-only",
        reviewStatus: "generated",
        humanReviewed: false,
        audio: {
          fullWord: "/audio/forest-full.mp3",
        },
        source: "tts",
        confidence: 0.66,
        generatedAt: "2026-04-23T12:01:00.000Z",
        status: "generated",
      },
      {
        normalizedWord: "lantern",
        displayWord: "Lantern",
        occurrences: 1,
        pageIds: ["p2"],
        pageNumbers: [2],
        coverageStatus: "missing",
        reviewStatus: "failed",
        humanReviewed: false,
        audio: {},
        source: "tts",
        generatedAt: "2026-04-23T12:02:00.000Z",
        status: "failed",
      },
      {
        normalizedWord: "cat",
        displayWord: "cat",
        occurrences: 1,
        pageIds: ["p1"],
        pageNumbers: [1],
        coverageStatus: "covered",
        reviewStatus: "generated",
        humanReviewed: false,
        audio: {
          fullWord: "/audio/cat-full.mp3",
          breakdown: "/audio/cat-break.mp3",
        },
        source: "lexicon",
      },
    ],
  },
};

const latestRun: PronunciationGenerationResult = {
  bookId: "42",
  voice: { id: "voice-1", name: "Narrator" },
  request: {
    force: false,
    maxWords: 2,
  },
  stats: {
    generated: 3,
    failed: 1,
    withBreakdown: 2,
    skippedExisting: 6,
  },
  coverage: {
    uniqueBookTokens: 10,
    coveredBookWide: 9,
    ratio: 0.9,
    perPage: [
      {
        pageId: "p1",
        pageNumber: 1,
        total: 4,
        covered: 4,
        fullWordOnly: 0,
        missing: 0,
        missingWords: [],
        status: "complete",
      },
      {
        pageId: "p2",
        pageNumber: 2,
        total: 6,
        covered: 5,
        fullWordOnly: 0,
        missing: 1,
        missingWords: ["lantern"],
        status: "partial",
      },
    ],
  },
  summary: {
    uniqueBookTokens: 10,
    coveredBookWide: 9,
    missingBookWide: 1,
    ratio: 0.9,
    pagesTotal: 2,
    pagesComplete: 1,
    pagesPartial: 1,
    pagesEmpty: 0,
    pagesWithMissing: 1,
    fullCoverage: false,
    requestedTokens: 2,
    remainingTokensAfterRun: 1,
    limitedByMaxWords: true,
  },
  force: false,
};

describe("PronunciationPanel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined as unknown as void);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

    mockUsePronunciationCoverage.mockReturnValue({
      data: coverageReport,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUsePronunciationReview.mockReturnValue({
      data: reviewResponse,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseGenerateBookPronunciations.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(latestRun),
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
    });
  });

  it("renders coverage summary and missing-page hints from the coverage report", () => {
    render(
      <PronunciationPanel
        bookId="42"
        selectedVoiceId="voice-1"
        voiceSettings={voiceSettings}
      />
    );

    expect(screen.getByText("Generate pronunciation help")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("2 still need review")).toBeInTheDocument();
    expect(screen.getByText("3 words still missing")).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getByText("Missing: adventure, forest")).toBeInTheDocument();
  });

  it("triggers missing-only generation with current voice settings", () => {
    const mutateAsync = vi.fn().mockResolvedValue(latestRun);
    mockUseGenerateBookPronunciations.mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
    });

    render(
      <PronunciationPanel
        bookId="42"
        selectedVoiceId="voice-1"
        voiceSettings={voiceSettings}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /generate missing pronunciations/i }));

    expect(mutateAsync).toHaveBeenCalledWith({
      voice: "voice-1",
      voiceSettings,
      force: false,
    });
  });

  it("shows latest run summary details after a capped generation run", () => {
    mockUseGenerateBookPronunciations.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      data: latestRun,
    });

    render(
      <PronunciationPanel
        bookId="42"
        selectedVoiceId="voice-1"
        voiceSettings={voiceSettings}
      />
    );

    expect(screen.getByText("Missing pronunciations generated.")).toBeInTheDocument();
    expect(screen.getByText("9/10 words covered across the book. 1 still missing.")).toBeInTheDocument();
    expect(screen.getByText("This run was capped at 2 words.")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
  });

  it("supports full regeneration mode and keeps the action label in sync", () => {
    render(
      <PronunciationPanel
        bookId="42"
        selectedVoiceId="voice-1"
        voiceSettings={voiceSettings}
      />
    );

    fireEvent.click(screen.getByRole("checkbox"));

    expect(screen.getByRole("button", { name: /regenerate all pronunciations/i })).toBeInTheDocument();
  });

  it("shows a pending regenerate state while the request is in flight", () => {
    mockUseGenerateBookPronunciations.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
      data: undefined,
    });

    render(
      <PronunciationPanel
        bookId="42"
        selectedVoiceId="voice-1"
        voiceSettings={voiceSettings}
      />
    );

    fireEvent.click(screen.getByRole("checkbox"));

    expect(
      screen.getByText("Regenerating pronunciation assets for the whole book…")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /regenerate all pronunciations/i })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /refresh report/i })).toBeDisabled();
  });

  it("limits review cards to the three pages with the most missing words and truncates long missing-word lists", () => {
    mockUsePronunciationCoverage.mockReturnValue({
      data: {
        ...coverageReport,
        coverage: {
          ...coverageReport.coverage,
          perPage: [
            {
              pageId: "p4",
              pageNumber: 4,
              total: 7,
              covered: 0,
              fullWordOnly: 0,
              missing: 5,
              missingWords: ["alpha", "beta", "gamma", "delta", "epsilon"],
              status: "missing",
            },
            {
              pageId: "p3",
              pageNumber: 3,
              total: 6,
              covered: 1,
              fullWordOnly: 0,
              missing: 4,
              missingWords: ["comet", "meteor", "orbit", "eclipse"],
              status: "partial",
            },
            {
              pageId: "p1",
              pageNumber: 1,
              total: 4,
              covered: 2,
              fullWordOnly: 1,
              missing: 2,
              missingWords: ["adventure", "forest"],
              status: "partial",
            },
            {
              pageId: "p2",
              pageNumber: 2,
              total: 6,
              covered: 5,
              fullWordOnly: 0,
              missing: 1,
              missingWords: ["lantern"],
              status: "missing",
            },
          ],
        },
        summary: {
          ...coverageReport.summary,
          pagesTotal: 4,
          pagesPartial: 2,
          pagesWithMissing: 4,
        },
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <PronunciationPanel
        bookId="42"
        selectedVoiceId="voice-1"
        voiceSettings={voiceSettings}
      />
    );

    expect(screen.getByText("Page 4")).toBeInTheDocument();
    expect(screen.getByText("Page 3")).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.queryByText("Page 2")).not.toBeInTheDocument();
    expect(
      screen.getByText("Missing: alpha, beta, gamma, delta…")
    ).toBeInTheDocument();
  });

  it("shows per-word preview/review metadata with server-backed filters and audio preview buttons", () => {
    render(
      <PronunciationPanel
        bookId="42"
        selectedVoiceId="voice-1"
        voiceSettings={voiceSettings}
      />
    );

    expect(screen.getByText("Per-word review")).toBeInTheDocument();
    expect(screen.getByText("Adventure")).toBeInTheDocument();
    expect(screen.getByText("forest")).toBeInTheDocument();
    expect(screen.getByText("Lantern")).toBeInTheDocument();
    expect(screen.getByText("Source override")).toBeInTheDocument();
    expect(screen.getByText("Entry reviewed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview breakdown adventure/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /preview breakdown forest/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /preview whole word lantern/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/search pronunciation words/i), {
      target: { value: "forest" },
    });
    fireEvent.change(screen.getByLabelText(/filter pronunciation review by page/i), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText(/filter pronunciation review by coverage/i), {
      target: { value: "full-word-only" },
    });
    fireEvent.change(screen.getByLabelText(/filter pronunciation review by status/i), {
      target: { value: "generated" },
    });

    expect(mockUsePronunciationReview).toHaveBeenLastCalledWith("42", {
      search: "forest",
      pageNumber: 2,
      coverageStatus: "full-word-only",
      reviewStatus: "generated",
      limit: 100,
      offset: 0,
    });

    fireEvent.change(screen.getByLabelText(/search pronunciation words/i), {
      target: { value: "   " },
    });
    fireEvent.change(screen.getByLabelText(/filter pronunciation review by page/i), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText(/filter pronunciation review by coverage/i), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByLabelText(/filter pronunciation review by status/i), {
      target: { value: "all" },
    });

    expect(mockUsePronunciationReview).toHaveBeenLastCalledWith("42", {
      search: undefined,
      pageNumber: undefined,
      coverageStatus: undefined,
      reviewStatus: undefined,
      limit: 100,
      offset: 0,
    });

    fireEvent.click(screen.getByRole("button", { name: /preview whole word adventure/i }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("shows a preview error when audio playback fails", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValueOnce(new Error("nope"));

    render(
      <PronunciationPanel
        bookId="42"
        selectedVoiceId="voice-1"
        voiceSettings={voiceSettings}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /preview whole word adventure/i }));

    expect(
      await screen.findByText("Preview failed for /audio/adventure-full.mp3")
    ).toBeInTheDocument();
  });

  it("shows a preview error when the audio element emits an error event", async () => {
    const originalAudio = window.Audio;
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();

    class FakeAudio {
      static lastInstance: FakeAudio | null = null;
      currentTime = 0;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public src: string) {
        FakeAudio.lastInstance = this;
      }

      play = play;
      pause = pause;
    }

    Object.defineProperty(window, "Audio", {
      configurable: true,
      writable: true,
      value: FakeAudio,
    });

    try {
      render(
        <PronunciationPanel
          bookId="42"
          selectedVoiceId="voice-1"
          voiceSettings={voiceSettings}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /preview whole word adventure/i }));
      FakeAudio.lastInstance?.onerror?.();

      expect(
        await screen.findByText("Preview failed for /audio/adventure-full.mp3")
      ).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "Audio", {
        configurable: true,
        writable: true,
        value: originalAudio,
      });
    }
  });

  it("shows review-query errors inside the review surface", () => {
    mockUsePronunciationReview.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: new Error("Review endpoint unavailable"),
      refetch: vi.fn(),
    });

    render(
      <PronunciationPanel
        bookId="42"
        selectedVoiceId="voice-1"
        voiceSettings={voiceSettings}
      />
    );

    expect(screen.getByText("Review endpoint unavailable")).toBeInTheDocument();
  });

  it("shows API errors from the generation mutation", () => {
    mockUseGenerateBookPronunciations.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: true,
      error: new Error("Pronunciation service unavailable"),
      data: undefined,
    });

    render(
      <PronunciationPanel
        bookId="42"
        selectedVoiceId="voice-1"
        voiceSettings={voiceSettings}
      />
    );

    expect(screen.getByText("Pronunciation service unavailable")).toBeInTheDocument();
  });
});
