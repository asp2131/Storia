import type { Metadata } from "next";
import { Playfair_Display, JetBrains_Mono, Lora, Inter, Gaegu, Nunito, Space_Grotesk, Hanken_Grotesk } from "next/font/google";
import Script from "next/script";
import { QueryProvider } from "@/providers/QueryProvider";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-editor",
  subsets: ["latin"],
});

const gaegu = Gaegu({
  variable: "--font-gaegu",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://loratone.kids"),
  title: {
    default: "Loratone - Books That Sound Amazing",
    template: "%s | Loratone",
  },
  description:
    "Interactive children's books with immersive soundscapes and expressive narration tailored to every scene. Read, listen, and explore stories like never before.",
  keywords: [
    "children's books",
    "interactive books",
    "audio books",
    "immersive soundscapes",
    "kids reading",
    "narrated stories",
    "read aloud",
    "kids stories",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://loratone.kids",
    siteName: "Loratone",
    title: "Loratone - Books That Sound Amazing",
    description:
      "Interactive children's books with immersive soundscapes and expressive narration tailored to every scene.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Loratone - Books That Sound Amazing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Loratone - Books That Sound Amazing",
    description:
      "Interactive children's books with immersive soundscapes and expressive narration.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${playfair.variable} ${jetbrains.variable} ${lora.variable} ${inter.variable} ${hankenGrotesk.variable} ${gaegu.variable} ${spaceGrotesk.variable} ${nunito.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Loratone",
              url: "https://loratone.kids",
              description:
                "Interactive children's books with immersive soundscapes and expressive narration tailored to every scene.",
            }),
          }}
        />
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script
            src={process.env.NEXT_PUBLIC_UMAMI_URL ?? "https://cloud.umami.is/script.js"}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            strategy="lazyOnload"
          />
        )}
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
