import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PronunciationPanel } from "@/components/editor/PronunciationPanel";
import type {
  PronunciationCoverageReport,
  PronunciationGenerationResult,
  VoiceSettings,
} from "@/hooks/useBookData";

const {
  mockUsePronunciationCoverage,
  mockUseGenerateBookPronunciations,
} = vi.hoisted(() => ({
  mockUsePronunciationCoverage: vi.fn(),
  mockUseGenerateBookPronunciations: vi.fn(),
}));

vi.mock("@/hooks/useBookData", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useBookData")>(
    "@/hooks/useBookData"
  );
  return {
    ...actual,
    usePronunciationCoverage: mockUsePronunciationCoverage,
    useGenerateBookPronunciations: mockUseGenerateBookPronunciations,
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
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockUsePronunciationCoverage.mockReturnValue({
      data: coverageReport,
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
