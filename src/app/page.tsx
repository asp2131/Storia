import type { Metadata } from "next";
import StoriaCalmLanding from "@/components/StoriaCalmLanding";

export const metadata: Metadata = {
  title: { absolute: "Loratone - Books That Sound Amazing" },
  openGraph: {
    title: "Loratone - Books That Sound Amazing",
    siteName: "Loratone",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Loratone - Books That Sound Amazing" }],
  },
  twitter: {
    title: "Loratone - Books That Sound Amazing",
  },
};

export default function Home() {
  return <StoriaCalmLanding />;
}
