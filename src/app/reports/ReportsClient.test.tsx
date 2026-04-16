import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("ReportsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionMock.mockReturnValue({
      data: { user: { id: "parent-1" } },
      isPending: false,
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("shows retry state when summary fails to load", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          childProfiles: [
            { id: "child-1", displayName: "Ava", isDefault: true },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: "Summary failed" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          summary: {
            childProfileId: "child-1",
            range: "30d",
            booksStarted: 1,
            booksCompleted: 1,
            totalSessions: 2,
            totalReadingMinutes: 20,
            averageSessionMinutes: 10,
            comprehensionAttempts: 2,
            averageComprehensionScore: 100,
            practiceSessions: 1,
            practiceMinutes: 5,
            practiceSessionRatePercent: 50,
          },
        }),
      });

    render(<ReportsClient />);

    expect(
      await screen.findByText("Could not load report summary"),
    ).toBeInTheDocument();
    expect(screen.getByText("Summary failed")).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: "Try again" });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText("Practice summary")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/reports/summary?childProfileId=child-1&range=30d",
      { cache: "no-store" },
    );
  });
});
