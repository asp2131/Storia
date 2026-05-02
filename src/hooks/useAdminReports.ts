"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  HeadlineData,
  ReportRange,
  TrendData,
  TopBooksData,
  FeedbackData,
} from "@/lib/reports/agg";
import type { TimelinePage } from "@/lib/reports/timeline";
import type { EventCategory } from "@/lib/reports/eventCatalog";

const STALE_TIME = 30_000;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Failed to load ${url}`);
  }
  return data.data as T;
}

export function useAdminReportsHeadline(range: ReportRange) {
  return useQuery<HeadlineData>({
    queryKey: ["admin", "reports", "headline", range],
    queryFn: () => fetchJson(`/api/admin/reports/headline?range=${range}`),
    staleTime: STALE_TIME,
  });
}

export function useAdminReportsTrend(range: ReportRange) {
  return useQuery<TrendData>({
    queryKey: ["admin", "reports", "trend", range],
    queryFn: () => fetchJson(`/api/admin/reports/trend?range=${range}`),
    staleTime: STALE_TIME,
  });
}

export function useAdminReportsTopBooks(range: ReportRange, limit = 10) {
  return useQuery<TopBooksData>({
    queryKey: ["admin", "reports", "top-books", range, limit],
    queryFn: () =>
      fetchJson(`/api/admin/reports/top-books?range=${range}&limit=${limit}`),
    staleTime: STALE_TIME,
  });
}

export function useAdminReportsFeedback(range: ReportRange, limit = 20) {
  return useQuery<FeedbackData>({
    queryKey: ["admin", "reports", "feedback", range, limit],
    queryFn: () =>
      fetchJson(`/api/admin/reports/feedback?range=${range}&limit=${limit}`),
    staleTime: STALE_TIME,
  });
}

export function useAdminReportsTimeline(
  range: ReportRange,
  options?: {
    limit?: number;
    childId?: string | null;
    bookId?: string | null;
    category?: EventCategory | null;
  }
) {
  const { limit = 50, childId, bookId, category } = options ?? {};
  const params = new URLSearchParams({ range, limit: String(limit) });
  if (childId) params.set("childId", childId);
  if (bookId) params.set("bookId", bookId);
  if (category) params.set("category", category);

  return useQuery<TimelinePage>({
    queryKey: ["admin", "reports", "timeline", range, limit, childId, bookId, category],
    queryFn: () => fetchJson(`/api/admin/reports/timeline?${params.toString()}`),
    staleTime: STALE_TIME,
  });
}
