import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import CookieConsent from "@/components/CookieConsent";
import { InkBleedCursor } from "@/components/effects/InkBleedCursor";
import { RECALLMATE_PRODUCTION_ORIGIN } from "@/lib/app-origin";

import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });
const SITE_URL = new URL(RECALLMATE_PRODUCTION_ORIGIN);
const OG_IMAGE_URL = new URL("/og-image.png", SITE_URL).toString();

export const metadata: Metadata = {
  title: "RecallMate – Study Smarter with AI",
  description: "Turn PDFs, slides, documents and study materials into AI notes, quizzes, reviewers and active recall practice.",
  metadataBase: SITE_URL,
  alternates: {
    canonical: RECALLMATE_PRODUCTION_ORIGIN,
  },
  openGraph: {
    title: "RecallMate – Study Smarter with AI",
    description: "Turn your study materials into notes, quizzes, reviewers and active recall practice.",
    url: RECALLMATE_PRODUCTION_ORIGIN,
    siteName: "RecallMate",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "RecallMate study smarter with AI",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RecallMate – Study Smarter with AI",
    description: "Turn PDFs, slides and documents into AI notes, quizzes and reviewers.",
    images: [OG_IMAGE_URL],
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground min-h-screen antialiased transition-colors duration-200`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <InkBleedCursor />
          <CookieConsent />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
