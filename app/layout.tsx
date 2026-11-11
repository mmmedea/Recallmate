import type { Metadata } from "next";
import "@/app/globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import CookieConsent from "@/components/CookieConsent";

import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "RecallMate | AI Study Notes, Quizzes & Tutor",
  description: "Turn your PDFs, slides, and notes into organized study guides, practice quizzes grounded in your material, and clear explanations with RecallMate.",
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