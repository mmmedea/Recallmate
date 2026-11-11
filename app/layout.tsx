import type { Metadata } from "next";
import "@/app/globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import CookieConsent from "@/components/CookieConsent";

import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "RecallMate – Study Smarter with AI",
  description: "Upload study documents or images and let AI turn them into predictive exam questions and active recall quizzes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans bg-background text-foreground min-h-screen antialiased transition-colors duration-200">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <CookieConsent />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}