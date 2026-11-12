import { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

/**
 * Launch KPIs requested by the Tulane mentors, computed from tables that
 * already exist. Each KPI carries a status so the dashboard can show honestly
 * which numbers are real, which need instrumentation, and which have no
 * product behind them yet.
 */
export type KpiStatus = "live" | "needs_instrumentation" | "no_product";
export type KpiUnit = "count" | "percent" | "avg";

export type Kpi = {
  key: string;
  label: string;
  value: number | null;
  unit: KpiUnit;
  definition: string;
  status: KpiStatus;
  note?: string;
};

export type KpiReport = {
  generatedAt: string;
  windowDays: number;
  families: Kpi[];
  funnel: Kpi[];
  authors: Kpi[];
};

export interface KpiAgg {
  kpis(): Promise<KpiReport>;
}

const WINDOW_DAYS = 30;

type Num = bigint | number | null;
const n = (v: Num | undefined) => Number(v ?? 0);

export function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

type FamilyRaw = {
  books_on_platform: Num;
  registered_families: Num;
  families_active: Num;
  books_per_active_family: Num;
  cohort_30: Num;
  retained_30: Num;
  cohort_90: Num;
  retained_90: Num;
  pulse_total: Num;
  pulse_more: Num;
};

type FunnelRaw = {
  signups: Num;
  onboarded: Num;
  profiles_created: Num;
  opened_book: Num;
  started_reading: Num;
};

type AuthorRaw = {
  authors_onboarded: Num;
  books_in_development: Num;
  books_published: Num;
  authors_with_book: Num;
  authors_with_second_book: Num;
};

export function createKpiAgg(deps: { prisma?: typeof defaultPrisma } = {}): KpiAgg {
  const prisma = deps.prisma ?? defaultPrisma;

  return {
    async kpis() {
      const since = new Date(Date.now() - WINDOW_DAYS * 86400000);

      const [familyRows, funnelRows, authorRows] = await Promise.all([
        prisma.$queryRaw<FamilyRaw[]>(Prisma.sql`
          WITH starts AS (
            SELECT user_id, book_id, occurred_at
            FROM mobile_analytics_events
            WHERE event_name = 'reading_session_started'
          ), active AS (
            SELECT user_id, COUNT(DISTINCT book_id) AS books
            FROM starts
            WHERE occurred_at >= ${since}
            GROUP BY user_id
          ), families AS (
            SELECT id, "createdAt" AS created_at FROM "user" WHERE role = 'user'
          ), retained AS (
            SELECT f.id,
              EXISTS (SELECT 1 FROM starts s WHERE s.user_id = f.id
                      AND s.occurred_at >= f.created_at + INTERVAL '30 days') AS r30,
              EXISTS (SELECT 1 FROM starts s WHERE s.user_id = f.id
                      AND s.occurred_at >= f.created_at + INTERVAL '90 days') AS r90,
              f.created_at <= NOW() - INTERVAL '30 days' AS c30,
              f.created_at <= NOW() - INTERVAL '90 days' AS c90
            FROM families f
          ), pulse AS (
            SELECT DISTINCT ON (user_id) user_id, properties->>'answer' AS answer
            FROM mobile_analytics_events
            WHERE event_name = 'parent_pulse_answered'
            ORDER BY user_id, occurred_at DESC
          )
          SELECT
            (SELECT COUNT(*) FROM books WHERE is_published)::bigint AS books_on_platform,
            (SELECT COUNT(*) FROM families)::bigint AS registered_families,
            (SELECT COUNT(*) FROM active)::bigint AS families_active,
            COALESCE((SELECT AVG(books) FROM active), 0)::float AS books_per_active_family,
            (SELECT COUNT(*) FROM retained WHERE c30)::bigint AS cohort_30,
            (SELECT COUNT(*) FROM retained WHERE c30 AND r30)::bigint AS retained_30,
            (SELECT COUNT(*) FROM retained WHERE c90)::bigint AS cohort_90,
            (SELECT COUNT(*) FROM retained WHERE c90 AND r90)::bigint AS retained_90,
            (SELECT COUNT(*) FROM pulse)::bigint AS pulse_total,
            (SELECT COUNT(*) FROM pulse WHERE answer = 'more')::bigint AS pulse_more
        `),
        prisma.$queryRaw<FunnelRaw[]>(Prisma.sql`
          SELECT
            COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'signup_completed')::bigint AS signups,
            COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'onboarding_completed')::bigint AS onboarded,
            COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'child_profile_created')::bigint AS profiles_created,
            COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'library_book_opened')::bigint AS opened_book,
            COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'reading_session_started')::bigint AS started_reading
          FROM mobile_analytics_events
          WHERE occurred_at >= ${since}
        `),
        prisma.$queryRaw<AuthorRaw[]>(Prisma.sql`
          WITH per_author AS (
            SELECT owner_id, COUNT(*) AS books FROM books
            WHERE owner_id IS NOT NULL GROUP BY owner_id
          )
          SELECT
            (SELECT COUNT(*) FROM "user" WHERE role = 'author')::bigint AS authors_onboarded,
            (SELECT COUNT(*) FROM books WHERE owner_id IS NOT NULL AND NOT is_published)::bigint AS books_in_development,
            (SELECT COUNT(*) FROM books WHERE owner_id IS NOT NULL AND is_published)::bigint AS books_published,
            (SELECT COUNT(*) FROM per_author)::bigint AS authors_with_book,
            (SELECT COUNT(*) FROM per_author WHERE books >= 2)::bigint AS authors_with_second_book
        `),
      ]);

      return shapeKpiReport({
        family: familyRows[0] ?? ({} as Partial<FamilyRaw>),
        funnel: funnelRows[0] ?? ({} as Partial<FunnelRaw>),
        author: authorRows[0] ?? ({} as Partial<AuthorRaw>),
      });
    },
  };
}

/** Pure shaping so the math is testable without a database. */
export function shapeKpiReport(raw: {
  family: Partial<FamilyRaw>;
  funnel: Partial<FunnelRaw>;
  author: Partial<AuthorRaw>;
}): KpiReport {
  const f = raw.family;
  const fn = raw.funnel;
  const a = raw.author;

  const registered = n(f.registered_families);
  const active = n(f.families_active);
  const pulseTotal = n(f.pulse_total);
  const authorsWithBook = n(a.authors_with_book);

  const live = (key: string, label: string, value: number | null, unit: KpiUnit, definition: string, note?: string): Kpi => ({
    key, label, value, unit, definition, status: "live", note,
  });
  const noProduct = (key: string, label: string, unit: KpiUnit, definition: string): Kpi => ({
    key, label, value: null, unit, definition, status: "no_product",
    note: "No merchandise or campaign feature exists yet. Measure after launch.",
  });

  return {
    generatedAt: new Date().toISOString(),
    windowDays: WINDOW_DAYS,
    families: [
      live("books_on_platform", "Books on the platform", n(f.books_on_platform), "count", "Published books."),
      live("registered_families", "Registered families", registered, "count", "Accounts with the family role."),
      live("families_active_pct", "Families active monthly", pct(active, registered), "percent",
        `Families with at least one reading session in the last ${WINDOW_DAYS} days, over registered families.`,
        `${active} of ${registered}`),
      live("books_per_family", "Books per active family", round1(n(f.books_per_active_family)), "avg",
        `Distinct books read per active family, last ${WINDOW_DAYS} days.`),
      live("retention_30", "Still active after 30 days", pct(n(f.retained_30), n(f.cohort_30)), "percent",
        "Families registered 30+ days ago that read again 30+ days after registering.",
        `${n(f.retained_30)} of ${n(f.cohort_30)}`),
      live("retention_90", "Still active after 90 days", pct(n(f.retained_90), n(f.cohort_90)), "percent",
        "Families registered 90+ days ago that read again 90+ days after registering.",
        `${n(f.retained_90)} of ${n(f.cohort_90)}`),
      {
        key: "parent_interest_pct",
        label: "Parents report more interest in reading",
        value: pct(n(f.pulse_more), pulseTotal),
        unit: "percent",
        definition: "Latest answer per parent to the in-app pulse question.",
        status: pulseTotal > 0 ? "live" : "needs_instrumentation",
        note: pulseTotal > 0 ? `${n(f.pulse_more)} of ${pulseTotal}` : "No answers yet. Prompt ships in Settings.",
      },
    ],
    funnel: [
      live("signups", "Signed up", n(fn.signups), "count", `New accounts, last ${WINDOW_DAYS} days.`),
      live("onboarded", "Completed onboarding", n(fn.onboarded), "count", "Finished the onboarding questions."),
      live("profiles_created", "Created a reader profile", n(fn.profiles_created), "count", "Added at least one child profile."),
      live("opened_book", "Opened a book", n(fn.opened_book), "count", "Tapped a book in the library."),
      live("started_reading", "Started reading", n(fn.started_reading), "count", "Began a reading session."),
    ],
    authors: [
      live("authors_onboarded", "Authors onboarded", n(a.authors_onboarded), "count", "Accounts with the author role."),
      live("books_in_development", "Books in development", n(a.books_in_development), "count", "Author-owned books not yet published."),
      live("books_published_by_authors", "Author books published", n(a.books_published), "count", "Author-owned books that are live."),
      live("authors_second_book_pct", "Authors who started a second book", pct(n(a.authors_with_second_book), authorsWithBook), "percent",
        "Authors with two or more books, over authors with at least one.",
        `${n(a.authors_with_second_book)} of ${authorsWithBook}`),
      noProduct("merch_per_book", "Merchandise items per book", "avg", "Average merchandise items attached to a book."),
      noProduct("books_with_merch_pct", "Books with merchandise", "percent", "Share of books with at least one merchandise item."),
      noProduct("merch_units_sold", "Merchandise units sold", "count", "Units sold across all books."),
      noProduct("books_in_campaigns", "Books in promotional campaigns", "count", "Books with an active promotion."),
      noProduct("sales_per_promoted_book", "Sales or downloads per promoted book", "avg", "Attributed opens or sales per promoted book."),
    ],
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export const kpiAgg: KpiAgg = createKpiAgg();
