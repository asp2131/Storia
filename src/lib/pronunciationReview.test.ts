import { describe, expect, it } from "vitest";
import { buildPronunciationReviewData } from "@/lib/pronunciationReview";

describe("buildPronunciationReviewData", () => {
  const pages = [
    {
      id: 101n,
      pageNumber: 1,
      textContent: "Hello, world! HELLO",
      entries: {
        hello: {
          fullWord: "/hello-full.mp3",
          breakdown: "/hello-break.mp3",
          source: "tts" as const,
          status: "generated" as const,
          generatedAt: "2026-04-23T10:00:00.000Z",
        },
      },
    },
    {
      id: 102n,
      pageNumber: 2,
      textContent: "World lantern",
      entries: {
        world: {
          fullWord: "/world-full.mp3",
          status: "reviewed" as const,
          source: "override" as const,
          confidence: 0.95,
          generatedAt: "2026-04-23T11:00:00.000Z",
        },
        lantern: {
          status: "failed" as const,
          source: "tts" as const,
          generatedAt: "2026-04-23T12:00:00.000Z",
        },
      },
    },
  ];

  it("aggregates normalized review rows with coverage, audio, and review metadata", () => {
    const result = buildPronunciationReviewData(pages);

    expect(result.summary).toEqual({
      totalWords: 3,
      coveredWords: 1,
      fullWordOnlyWords: 1,
      missingWords: 1,
      generatedWords: 1,
      reviewedWords: 1,
      failedWords: 1,
    });

    expect(result.filteredTotal).toBe(3);
    expect(result.items.map((item) => item.normalizedWord)).toEqual([
      "lantern",
      "hello",
      "world",
    ]);

    expect(result.items[0]).toMatchObject({
      normalizedWord: "lantern",
      displayWord: "lantern",
      pageNumbers: [2],
      coverageStatus: "missing",
      reviewStatus: "failed",
      humanReviewed: false,
      status: "failed",
    });

    expect(result.items[1]).toMatchObject({
      normalizedWord: "hello",
      displayWord: "Hello",
      occurrences: 2,
      pageNumbers: [1],
      coverageStatus: "covered",
      reviewStatus: "generated",
      audio: {
        fullWord: "/hello-full.mp3",
        breakdown: "/hello-break.mp3",
      },
    });

    expect(result.items[2]).toMatchObject({
      normalizedWord: "world",
      displayWord: "world",
      pageNumbers: [1, 2],
      coverageStatus: "full-word-only",
      reviewStatus: "reviewed",
      humanReviewed: true,
      audio: {
        fullWord: "/world-full.mp3",
      },
      source: "override",
      confidence: 0.95,
    });
  });

  it("supports lightweight search, page, status filters, and pagination", () => {
    const result = buildPronunciationReviewData(pages, {
      search: "wo",
      reviewStatus: "reviewed",
      pageNumber: 2,
      limit: 1,
      offset: 0,
    });

    expect(result.summary.totalWords).toBe(3);
    expect(result.filteredTotal).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.normalizedWord).toBe("world");
  });
});
