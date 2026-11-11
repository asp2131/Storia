import { describe, expect, it } from "vitest";
import { pct, shapeKpiReport } from "@/lib/reports/kpis";

describe("kpis shaping", () => {
  it("computes percentages and keeps empty denominators null", () => {
    expect(pct(3, 12)).toBe(25);
    expect(pct(0, 0)).toBeNull();
  });

  it("marks parent pulse as needing instrumentation until someone answers", () => {
    const report = shapeKpiReport({
      family: { registered_families: 10n, families_active: 4n, cohort_90: 5n, retained_90: 2n, pulse_total: 0n, pulse_more: 0n },
      funnel: { signups: 3n },
      author: { authors_with_book: 2n, authors_with_second_book: 1n },
    });
    const byKey = Object.fromEntries([...report.families, ...report.funnel, ...report.authors].map((k) => [k.key, k]));

    expect(byKey.families_active_pct.value).toBe(40);
    expect(byKey.retention_90.value).toBe(40);
    expect(byKey.parent_interest_pct.status).toBe("needs_instrumentation");
    expect(byKey.signups.value).toBe(3);
    expect(byKey.authors_second_book_pct.value).toBe(50);
    expect(byKey.merch_units_sold.status).toBe("no_product");
    expect(byKey.merch_units_sold.value).toBeNull();
  });
});
