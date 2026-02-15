import type { Metadata } from "next";
import { Playfair_Display, JetBrains_Mono, Lora, Inter, Gaegu } from "next/font/google";
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

const gaegu = Gaegu({
  variable: "--font-gaegu",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

export const metadata: Metadata = {
  title: "Storia - Books That Sound Amazing",
  description: "Experience literature like never before with AI-generated soundscapes that adapt to every scene.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${playfair.variable} ${jetbrains.variable} ${lora.variable} ${inter.variable} ${gaegu.variable} antialiased`}>
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
