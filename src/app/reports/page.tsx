import type { Metadata } from "next";
import ReportsClient from "./ReportsClient";

export const metadata: Metadata = {
  title: "Reports",
  description:
    "Review your child's reading, comprehension, and practice activity over time.",
};

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return <ReportsClient />;
}
