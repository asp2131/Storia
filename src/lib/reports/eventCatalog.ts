import type { Prisma } from "@prisma/client";

export type EventSource =
  | "mobile_analytics_events"
  | "reading_session"
  | "question_attempt"
  | "reader_feedback";

export type EventCategory =
  | "engagement"
  | "comprehension"
  | "feedback"
  | "system";

export type TranslatedEventDetail = {
  key: string;
  value: string | number | boolean;
};

export type TranslatedEventActor = {
  userId: string;
  childProfileId: string;
  childName: string;
};

export type TranslatedEventSubject = {
  type: "book" | "session" | "question";
  id: string;
  title?: string;
};

export type TranslatedEvent = {
  code: string;
  source: EventSource;
  rawId: string;
  category: EventCategory;
  label: string;
  summaryLine: string;
  actor: TranslatedEventActor;
  subject?: TranslatedEventSubject;
  details: TranslatedEventDetail[];
  occurredAt: string;
};

export type EventLookups = {
  childById: Map<
    string,
    { id: string; userId: string; displayName: string }
  >;
  bookTitleById: Map<string, string>;
};

export type MobileAnalyticsRow = {
  id: string;
  user_id: string;
  child_profile_id: string;
  book_id: bigint | null;
  session_id: string | null;
  event_name: string;
  source: string;
  properties: Prisma.JsonValue | null;
  occurred_at: Date;
};

export type ReadingSessionRow = {
  id: string;
  sessionId: string;
  userId: string;
  childProfileId: string;
  bookId: bigint;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  startPage: number;
  endPage: number;
  entryIntent: string;
  usedNarration: boolean;
  usedPracticeMode: boolean;
  completedBook: boolean;
  source: string;
};

export type QuestionAttemptRow = {
  id: string;
  userId: string;
  childProfileId: string;
  bookId: bigint;
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  answeredAt: Date;
};

export type ReaderFeedbackRow = {
  id: string;
  userId: string;
  rating: number;
  feedback: string | null;
  createdAt: Date;
};

export type EventsForRowInput =
  | {
      source: "mobile_analytics_events";
      row: MobileAnalyticsRow;
      lookups: EventLookups;
    }
  | {
      source: "reading_session";
      row: ReadingSessionRow;
      lookups: EventLookups;
    }
  | {
      source: "question_attempt";
      row: QuestionAttemptRow;
      lookups: EventLookups;
    }
  | {
      source: "reader_feedback";
      row: ReaderFeedbackRow;
      lookups: EventLookups;
    };

const UNKNOWN_CHILD_NAME = "an unidentified child";
const UNKNOWN_USER_ID = "unknown";

function humanize(token: string): string {
  if (!token) return "Activity";
  const cleaned = token.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "Activity";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function minutesFromSeconds(seconds: number): number {
  return Math.max(0, Math.round(seconds / 60));
}

function pageRange(startPage: number, endPage: number): string {
  if (startPage === endPage) return `page ${startPage}`;
  return `pages ${startPage}–${endPage}`;
}

function actorFromChild(
  childProfileId: string,
  fallbackUserId: string,
  lookups: EventLookups
): TranslatedEventActor {
  const child = lookups.childById.get(childProfileId);
  if (child) {
    return {
      userId: child.userId,
      childProfileId: child.id,
      childName: child.displayName || UNKNOWN_CHILD_NAME,
    };
  }
  return {
    userId: fallbackUserId || UNKNOWN_USER_ID,
    childProfileId,
    childName: UNKNOWN_CHILD_NAME,
  };
}

function bookTitle(bookId: bigint | null, lookups: EventLookups): string | null {
  if (bookId == null) return null;
  return lookups.bookTitleById.get(bookId.toString()) ?? null;
}

function bookSubject(
  bookId: bigint | null,
  lookups: EventLookups
): TranslatedEventSubject | undefined {
  if (bookId == null) return undefined;
  const id = bookId.toString();
  return {
    type: "book",
    id,
    title: lookups.bookTitleById.get(id),
  };
}

// ─── Mobile analytics catalog ──────────────────────────────────────────────

type MobileMapper = (
  row: MobileAnalyticsRow,
  actor: TranslatedEventActor,
  bookName: string | null
) => Pick<TranslatedEvent, "code" | "category" | "label" | "summaryLine" | "details">;

const MOBILE_REGISTRY: Record<string, MobileMapper> = {
  reader_opened: (_row, actor, bookName) => ({
    code: "READER_OPENED",
    category: "engagement",
    label: "Opened the reader",
    summaryLine: bookName
      ? `${actor.childName} opened "${bookName}"`
      : `${actor.childName} opened the reader`,
    details: [],
  }),

  comprehension_answered: (row, actor, bookName) => {
    const props = (row.properties ?? {}) as Record<string, unknown>;
    const isCorrect =
      typeof props.isCorrect === "boolean" ? props.isCorrect : null;
    const correctness =
      isCorrect == null ? "" : isCorrect ? "Correct" : "Incorrect";
    return {
      code: "COMPREHENSION_ANSWERED",
      category: "comprehension",
      label: isCorrect == null
        ? "Answered a comprehension question"
        : isCorrect
          ? "Answered correctly"
          : "Missed a question",
      summaryLine: bookName
        ? `${actor.childName} answered a question about "${bookName}"${correctness ? ` — ${correctness}` : ""}`
        : `${actor.childName} answered a comprehension question${correctness ? ` — ${correctness}` : ""}`,
      details: isCorrect == null ? [] : [{ key: "Correct", value: isCorrect }],
    };
  },

  narration_started: (_row, actor, bookName) => ({
    code: "NARRATION_STARTED",
    category: "engagement",
    label: "Started narration",
    summaryLine: bookName
      ? `${actor.childName} started narration on "${bookName}"`
      : `${actor.childName} started narration`,
    details: [],
  }),

  narration_stopped: (_row, actor, bookName) => ({
    code: "NARRATION_STOPPED",
    category: "engagement",
    label: "Stopped narration",
    summaryLine: bookName
      ? `${actor.childName} stopped narration on "${bookName}"`
      : `${actor.childName} stopped narration`,
    details: [],
  }),

  page_turned: (row, actor, bookName) => {
    const props = (row.properties ?? {}) as Record<string, unknown>;
    const page = typeof props.page === "number" ? props.page : null;
    return {
      code: "PAGE_TURNED",
      category: "engagement",
      label: page == null ? "Turned a page" : `Reached page ${page}`,
      summaryLine: bookName
        ? `${actor.childName} turned a page in "${bookName}"`
        : `${actor.childName} turned a page`,
      details: page == null ? [] : [{ key: "Page", value: page }],
    };
  },
};

function mapMobileEvent(input: {
  row: MobileAnalyticsRow;
  lookups: EventLookups;
}): TranslatedEvent {
  const { row, lookups } = input;
  const actor = actorFromChild(row.child_profile_id, row.user_id, lookups);
  const bookName = bookTitle(row.book_id, lookups);
  const known = MOBILE_REGISTRY[row.event_name];
  const partial: ReturnType<MobileMapper> = known
    ? known(row, actor, bookName)
    : {
        code: `MOBILE_${row.event_name.toUpperCase()}`,
        category: "system",
        label: humanize(row.event_name),
        summaryLine: `${actor.childName} — ${humanize(row.event_name)}${
          bookName ? ` on "${bookName}"` : ""
        }`,
        details: [],
      };

  return {
    ...partial,
    source: "mobile_analytics_events",
    rawId: row.id,
    actor,
    subject: bookSubject(row.book_id, lookups),
    occurredAt: row.occurred_at.toISOString(),
  };
}

// ─── Reading session ───────────────────────────────────────────────────────

function mapReadingSession(input: {
  row: ReadingSessionRow;
  lookups: EventLookups;
}): TranslatedEvent[] {
  const { row, lookups } = input;
  const actor = actorFromChild(row.childProfileId, row.userId, lookups);
  const bookName =
    lookups.bookTitleById.get(row.bookId.toString()) ?? "a book";
  const minutes = minutesFromSeconds(row.durationSeconds);

  const sessionDetails: TranslatedEventDetail[] = [
    { key: "Duration (min)", value: minutes },
    { key: "Pages read", value: pageRange(row.startPage, row.endPage) },
    { key: "Entry mode", value: humanize(row.entryIntent) },
  ];
  if (row.usedNarration) sessionDetails.push({ key: "Used narration", value: true });
  if (row.usedPracticeMode) sessionDetails.push({ key: "Used practice mode", value: true });

  const completedEvent: TranslatedEvent = {
    code: "READING_SESSION_COMPLETED",
    source: "reading_session",
    rawId: row.id,
    category: "engagement",
    label: `Read ${pageRange(row.startPage, row.endPage)} of "${bookName}"`,
    summaryLine: `${actor.childName} read ${pageRange(row.startPage, row.endPage)} of "${bookName}" for ${minutes} min`,
    actor,
    subject: bookSubject(row.bookId, lookups),
    details: sessionDetails,
    occurredAt: row.endedAt.toISOString(),
  };

  if (!row.completedBook) {
    return [completedEvent];
  }

  return [
    completedEvent,
    {
      code: "BOOK_COMPLETED",
      source: "reading_session",
      rawId: `${row.id}:completion`,
      category: "engagement",
      label: `Finished "${bookName}"`,
      summaryLine: `${actor.childName} finished "${bookName}"`,
      actor,
      subject: bookSubject(row.bookId, lookups),
      details: [
        { key: "Final page", value: row.endPage },
        { key: "Total session minutes", value: minutes },
      ],
      occurredAt: row.endedAt.toISOString(),
    },
  ];
}

// ─── Question attempt ──────────────────────────────────────────────────────

function mapQuestionAttempt(input: {
  row: QuestionAttemptRow;
  lookups: EventLookups;
}): TranslatedEvent {
  const { row, lookups } = input;
  const actor = actorFromChild(row.childProfileId, row.userId, lookups);
  const bookName =
    lookups.bookTitleById.get(row.bookId.toString()) ?? "a book";

  return {
    code: "QUESTION_ANSWERED",
    source: "question_attempt",
    rawId: row.id,
    category: "comprehension",
    label: row.isCorrect
      ? `Answered correctly on "${bookName}"`
      : `Missed a question on "${bookName}"`,
    summaryLine: `${actor.childName} answered a question about "${bookName}" — ${row.isCorrect ? "Correct" : "Incorrect"}`,
    actor,
    subject: { type: "question", id: row.questionId },
    details: [
      { key: "Correct", value: row.isCorrect },
      { key: "Answer chosen", value: row.selectedAnswer },
    ],
    occurredAt: row.answeredAt.toISOString(),
  };
}

// ─── Reader feedback ───────────────────────────────────────────────────────

function mapReaderFeedback(input: {
  row: ReaderFeedbackRow;
  lookups: EventLookups;
}): TranslatedEvent {
  const { row } = input;
  const actor: TranslatedEventActor = {
    userId: row.userId,
    childProfileId: "",
    childName: "A parent",
  };
  const truncated = row.feedback
    ? row.feedback.length > 80
      ? `${row.feedback.slice(0, 77)}…`
      : row.feedback
    : null;

  return {
    code: "FEEDBACK_SUBMITTED",
    source: "reader_feedback",
    rawId: row.id,
    category: "feedback",
    label: `Left a ${row.rating}-star rating`,
    summaryLine: truncated
      ? `Parent feedback (${row.rating}★): "${truncated}"`
      : `Parent submitted a ${row.rating}-star rating`,
    actor,
    details: [
      { key: "Rating", value: row.rating },
      ...(truncated ? [{ key: "Comment", value: truncated }] : []),
    ],
    occurredAt: row.createdAt.toISOString(),
  };
}

/**
 * Translate a row from one analytics-bearing table into one or more
 * business-readable timeline entries. Mappers MUST NOT leak raw `event_name`
 * strings or raw JSON `properties` keys into the returned shape — every
 * detail is a typed { key, value } pair.
 */
export function eventsForRow(input: EventsForRowInput): TranslatedEvent[] {
  switch (input.source) {
    case "mobile_analytics_events":
      return [mapMobileEvent(input)];
    case "reading_session":
      return mapReadingSession(input);
    case "question_attempt":
      return [mapQuestionAttempt(input)];
    case "reader_feedback":
      return [mapReaderFeedback(input)];
  }
}
