import { describe, expect, it } from "vitest";
import {
  eventsForRow,
  type EventLookups,
  type MobileAnalyticsRow,
  type QuestionAttemptRow,
  type ReaderFeedbackRow,
  type ReadingSessionRow,
  type TranslatedEvent,
} from "./eventCatalog";

function makeLookups(): EventLookups {
  return {
    childById: new Map([
      [
        "child-ava",
        { id: "child-ava", userId: "user-akin", displayName: "Ava" },
      ],
      [
        "child-leo",
        { id: "child-leo", userId: "user-akin", displayName: "Leo" },
      ],
    ]),
    bookTitleById: new Map([
      ["101", "Bunny Brother"],
      ["202", "Kumu's Sky"],
    ]),
  };
}

const occurred = new Date("2026-04-30T10:00:00Z");

function assertNoRawKeys(events: TranslatedEvent[]) {
  for (const evt of events) {
    // Engineer-style identifiers must never reach the UI through the catalog.
    for (const detail of evt.details) {
      expect(detail.key).not.toMatch(/^[a-z]+(_[a-z]+)+$/);
      expect(detail.key).not.toBe("event_name");
      expect(detail.key).not.toBe("properties");
    }
    expect(evt.label).not.toMatch(/_[a-z]/);
    expect(evt.summaryLine).not.toMatch(/event_name/);
  }
}

describe("eventsForRow — mobile_analytics_events", () => {
  const baseRow: MobileAnalyticsRow = {
    id: "mob-1",
    user_id: "user-akin",
    child_profile_id: "child-ava",
    book_id: 101n,
    session_id: "sess-1",
    event_name: "reader_opened",
    source: "mobile",
    properties: {},
    occurred_at: occurred,
  };

  it("translates known reader_opened with child + book lookup", () => {
    const out = eventsForRow({
      source: "mobile_analytics_events",
      row: baseRow,
      lookups: makeLookups(),
    });
    expect(out).toHaveLength(1);
    const evt = out[0];
    expect(evt.code).toBe("READER_OPENED");
    expect(evt.label).toBe("Opened the reader");
    expect(evt.summaryLine).toBe(`Ava opened "Bunny Brother"`);
    expect(evt.actor.childName).toBe("Ava");
    expect(evt.subject?.id).toBe("101");
    expect(evt.subject?.title).toBe("Bunny Brother");
    assertNoRawKeys(out);
  });

  it("comprehension_answered surfaces correctness via typed details", () => {
    const out = eventsForRow({
      source: "mobile_analytics_events",
      row: { ...baseRow, event_name: "comprehension_answered", properties: { isCorrect: true, questionId: "q-2" } },
      lookups: makeLookups(),
    });
    const evt = out[0];
    expect(evt.code).toBe("COMPREHENSION_ANSWERED");
    expect(evt.label).toBe("Answered correctly");
    expect(evt.summaryLine).toContain("Correct");
    expect(evt.details).toContainEqual({ key: "Correct", value: true });
    // Raw property keys (questionId, isCorrect) must not surface as detail keys.
    expect(evt.details.find((d) => d.key === "questionId")).toBeUndefined();
    assertNoRawKeys(out);
  });

  it("unknown event_name humanises into a system event without leaking the raw token", () => {
    const out = eventsForRow({
      source: "mobile_analytics_events",
      row: { ...baseRow, event_name: "soundscape_loop_failed" },
      lookups: makeLookups(),
    });
    const evt = out[0];
    expect(evt.category).toBe("system");
    expect(evt.label).toBe("Soundscape loop failed");
    expect(evt.summaryLine).not.toContain("soundscape_loop_failed");
    assertNoRawKeys(out);
  });

  it("falls back to placeholder name when child profile lookup misses", () => {
    const lookups = makeLookups();
    lookups.childById.delete("child-ava");
    const out = eventsForRow({
      source: "mobile_analytics_events",
      row: baseRow,
      lookups,
    });
    expect(out[0].actor.childName).toBe("an unidentified child");
  });
});

describe("eventsForRow — reading_session", () => {
  const baseRow: ReadingSessionRow = {
    id: "rs-1",
    sessionId: "sess-1",
    userId: "user-akin",
    childProfileId: "child-ava",
    bookId: 101n,
    startedAt: new Date("2026-04-30T09:48:00Z"),
    endedAt: occurred,
    durationSeconds: 720,
    startPage: 4,
    endPage: 9,
    entryIntent: "standard",
    usedNarration: true,
    usedPracticeMode: false,
    completedBook: false,
    source: "mobile",
  };

  it("emits one READING_SESSION_COMPLETED with details surfacing hidden columns", () => {
    const out = eventsForRow({
      source: "reading_session",
      row: baseRow,
      lookups: makeLookups(),
    });
    expect(out).toHaveLength(1);
    const evt = out[0];
    expect(evt.code).toBe("READING_SESSION_COMPLETED");
    expect(evt.summaryLine).toBe(`Ava read pages 4–9 of "Bunny Brother" for 12 min`);
    const detailKeys = evt.details.map((d) => d.key);
    expect(detailKeys).toContain("Duration (min)");
    expect(detailKeys).toContain("Pages read");
    expect(detailKeys).toContain("Entry mode");
    expect(detailKeys).toContain("Used narration");
    expect(detailKeys).not.toContain("Used practice mode"); // false → omitted
    assertNoRawKeys(out);
  });

  it("emits BOOK_COMPLETED in addition when the session finished the book", () => {
    const out = eventsForRow({
      source: "reading_session",
      row: { ...baseRow, completedBook: true },
      lookups: makeLookups(),
    });
    expect(out).toHaveLength(2);
    const codes = out.map((e) => e.code);
    expect(codes).toEqual(["READING_SESSION_COMPLETED", "BOOK_COMPLETED"]);
    expect(out[1].label).toBe(`Finished "Bunny Brother"`);
  });

  it("uses 'a book' placeholder if the book title lookup misses", () => {
    const lookups = makeLookups();
    lookups.bookTitleById.delete("101");
    const out = eventsForRow({
      source: "reading_session",
      row: baseRow,
      lookups,
    });
    expect(out[0].summaryLine).toContain(`"a book"`);
  });
});

describe("eventsForRow — question_attempt", () => {
  const baseRow: QuestionAttemptRow = {
    id: "qa-1",
    userId: "user-akin",
    childProfileId: "child-ava",
    bookId: 101n,
    questionId: "q-2",
    selectedAnswer: "B",
    isCorrect: false,
    answeredAt: occurred,
  };

  it("translates incorrect attempt with typed correctness detail", () => {
    const out = eventsForRow({
      source: "question_attempt",
      row: baseRow,
      lookups: makeLookups(),
    });
    expect(out).toHaveLength(1);
    const evt = out[0];
    expect(evt.code).toBe("QUESTION_ANSWERED");
    expect(evt.label).toBe(`Missed a question on "Bunny Brother"`);
    expect(evt.summaryLine).toContain("Incorrect");
    expect(evt.details).toContainEqual({ key: "Correct", value: false });
    expect(evt.subject).toEqual({ type: "question", id: "q-2" });
    assertNoRawKeys(out);
  });
});

describe("eventsForRow — reader_feedback", () => {
  const baseRow: ReaderFeedbackRow = {
    id: "fb-1",
    userId: "user-akin",
    rating: 5,
    feedback: "Loved the narration on Bunny Brother!",
    createdAt: occurred,
  };

  it("translates feedback with truncated comment", () => {
    const longText = "x".repeat(120);
    const out = eventsForRow({
      source: "reader_feedback",
      row: { ...baseRow, feedback: longText },
      lookups: makeLookups(),
    });
    const evt = out[0];
    expect(evt.code).toBe("FEEDBACK_SUBMITTED");
    expect(evt.label).toBe("Left a 5-star rating");
    const comment = evt.details.find((d) => d.key === "Comment");
    expect(typeof comment?.value).toBe("string");
    expect((comment?.value as string).endsWith("…")).toBe(true);
    assertNoRawKeys(out);
  });

  it("omits Comment detail when feedback is null", () => {
    const out = eventsForRow({
      source: "reader_feedback",
      row: { ...baseRow, feedback: null },
      lookups: makeLookups(),
    });
    const evt = out[0];
    expect(evt.details.find((d) => d.key === "Comment")).toBeUndefined();
    expect(evt.summaryLine).toBe("Parent submitted a 5-star rating");
  });
});
