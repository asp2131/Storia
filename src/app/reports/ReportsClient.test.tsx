import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReportsClient from "./ReportsClient";

const useSessionMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => useSessionMock(),
}));

const richReport = {
  childProfileId: "child-1",
  range: "30d",
  generatedAt: "2026-04-28T12:00:00Z",
  summary: {
    childProfileId: "child-1",
    range: "30d",
    booksStarted: 2,
    booksCompleted: 1,
    totalSessions: 4,
    totalReadingMinutes: 30,
    averageSessionMinutes: 8,
    comprehensionAttempts: 5,
    averageComprehensionScore: 80,
    practiceSessions: 2,
    practiceMinutes: 8,
    practiceSessionRatePercent: 50,
    narrationSessions: 3,
    narrationMinutes: 20,
    narrationSessionRatePercent: 75,
    sourceBreakdown: [
      { source: "mobile", sessions: 3, minutes: 25 },
      { source: "web", sessions: 1, minutes: 5 },
    ],
    perBook: [
      {
        bookId: "101",
        title: "Where the Wild Things Are",
        sessions: 3,
        minutes: 20,
        lastReadAt: "2026-04-26T09:00:00Z",
        currentPage: 8,
        totalPages: 12,
        completed: false,
        completionCount: 0,
      },
    ],
    dailySeries: [
      { date: "2026-04-25", sessions: 2, minutes: 15, comprehensionAttempts: 3 },
      { date: "2026-04-26", sessions: 1, minutes: 5, comprehensionAttempts: 1 },
    ],
  },
  analytics: {
    totalEvents: 7,
    uniqueEventNames: 2,
    eventsByName: [
      { eventName: "page_turn", count: 5, lastOccurredAt: "2026-04-27T12:00:00Z" },
      { eventName: "book_open", count: 2, lastOccurredAt: "2026-04-26T09:00:00Z" },
    ],
    recentEvents: [
      {
        id: "evt-1",
        childProfileId: "child-1",
        bookId: "101",
        sessionId: "sess-1",
        eventName: "page_turn",
        source: "mobile",
        properties: { page: 5 },
        occurredAt: "2026-04-27T12:00:00Z",
      },
    ],
  },
};

function mockFetchSequence(...sequence: Array<{ ok: boolean; body: unknown }>) {
  for (const step of sequence) {
    fetchMock.mockResolvedValueOnce({
      ok: step.ok,
      json: async () => step.body,
    });
  }
}

describe("ReportsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionMock.mockReturnValue({
      data: { user: { id: "parent-1" } },
      isPending: false,
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders all new sections from the analytics endpoint", async () => {
    mockFetchSequence(
      {
        ok: true,
        body: {
          childProfiles: [
            { id: "child-1", displayName: "Ava", isDefault: true },
          ],
        },
      },
      { ok: true, body: { report: richReport } },
    );

    render(<ReportsClient />);

    await waitFor(() => {
      expect(screen.getByText("Books read this period")).toBeInTheDocument();
    });

    // Narration card
    expect(screen.getByText("Narration rate")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();

    // Source breakdown
    const sourceHeading = screen.getByText("Where reading happens");
    const sourcePanel = sourceHeading.closest("section");
    expect(sourcePanel).not.toBeNull();
    expect(within(sourcePanel as HTMLElement).getByText("mobile")).toBeInTheDocument();
    expect(within(sourcePanel as HTMLElement).getByText("web")).toBeInTheDocument();

    // Per-book table
    expect(screen.getByText("Where the Wild Things Are")).toBeInTheDocument();
    expect(screen.getByText("8/12")).toBeInTheDocument();

    // Sparkline
    expect(screen.getByText("Daily activity")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /daily reading minutes/i }),
    ).toBeInTheDocument();

    // Events table
    const eventsPanel = screen.getByText("Events captured").closest("section");
    expect(eventsPanel).not.toBeNull();
    expect(within(eventsPanel as HTMLElement).getByText("page_turn")).toBeInTheDocument();
    expect(within(eventsPanel as HTMLElement).getByText("book_open")).toBeInTheDocument();

    // Recent activity
    expect(screen.getByText("Recent activity")).toBeInTheDocument();
    expect(screen.getByText("Properties")).toBeInTheDocument();

    // Endpoint switched to analytics
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/reports/analytics?childProfileId=child-1&range=30d",
      { cache: "no-store" },
    );
  });

  it("hides optional sections when summary lacks new fields", async () => {
    const minimalReport = {
      ...richReport,
      summary: {
        childProfileId: "child-1",
        range: "30d",
        booksStarted: 1,
        booksCompleted: 0,
        totalSessions: 1,
        totalReadingMinutes: 5,
        averageSessionMinutes: 5,
        comprehensionAttempts: 0,
        averageComprehensionScore: 0,
        practiceSessions: 0,
        practiceMinutes: 0,
        practiceSessionRatePercent: 0,
      },
      analytics: {
        totalEvents: 0,
        uniqueEventNames: 0,
        eventsByName: [],
        recentEvents: [],
      },
    };

    mockFetchSequence(
      {
        ok: true,
        body: {
          childProfiles: [
            { id: "child-1", displayName: "Ava", isDefault: true },
          ],
        },
      },
      { ok: true, body: { report: minimalReport } },
    );

    render(<ReportsClient />);

    await waitFor(() => {
      expect(screen.getByText("Practice summary")).toBeInTheDocument();
    });

    expect(screen.queryByText("Narration rate")).not.toBeInTheDocument();
    expect(screen.queryByText("Where reading happens")).not.toBeInTheDocument();
    expect(screen.queryByText("Books read this period")).not.toBeInTheDocument();
    expect(screen.queryByText("Daily activity")).not.toBeInTheDocument();
    expect(
      screen.getByText("No analytics events captured yet."),
    ).toBeInTheDocument();
    expect(screen.getByText("No recent activity yet.")).toBeInTheDocument();
  });

  it("provides both summary and analytics CSV export links with the right hrefs", async () => {
    mockFetchSequence(
      {
        ok: true,
        body: {
          childProfiles: [
            { id: "child-1", displayName: "Ava", isDefault: true },
          ],
        },
      },
      { ok: true, body: { report: richReport } },
    );

    render(<ReportsClient />);

    await waitFor(() => {
      expect(screen.getByText("Books read this period")).toBeInTheDocument();
    });

    const summaryLink = screen.getByTestId("export-summary-csv");
    const analyticsLink = screen.getByTestId("export-analytics-csv");
    expect(summaryLink).toHaveAttribute(
      "href",
      "/api/reports/summary?childProfileId=child-1&range=30d&format=csv",
    );
    expect(analyticsLink).toHaveAttribute(
      "href",
      "/api/reports/analytics?childProfileId=child-1&range=30d&format=csv",
    );
  });

  it("shows retry state when report fails to load", async () => {
    mockFetchSequence(
      {
        ok: true,
        body: {
          childProfiles: [
            { id: "child-1", displayName: "Ava", isDefault: true },
          ],
        },
      },
      { ok: false, body: { error: { message: "Report failed" } } },
      { ok: true, body: { report: richReport } },
    );

    render(<ReportsClient />);

    expect(
      await screen.findByText("Could not load report"),
    ).toBeInTheDocument();
    expect(screen.getByText("Report failed")).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: "Try again" });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText("Practice summary")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/reports/analytics?childProfileId=child-1&range=30d",
      { cache: "no-store" },
    );
  });

  it("renders events count summary with totals", async () => {
    mockFetchSequence(
      {
        ok: true,
        body: {
          childProfiles: [
            { id: "child-1", displayName: "Ava", isDefault: true },
          ],
        },
      },
      { ok: true, body: { report: richReport } },
    );

    render(<ReportsClient />);

    await waitFor(() => {
      expect(screen.getByText("Events captured")).toBeInTheDocument();
    });

    const heading = screen.getByText("Events captured");
    const panel = heading.closest("section");
    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).getByText(/7 total · 2 unique/)).toBeInTheDocument();
  });
});
