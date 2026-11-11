import type { Metadata } from "next";
import "@/app/globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import CookieConsent from "@/components/CookieConsent";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "RecallMate | Turn Your Study Files Into Active Recall",
  description: "Upload documents, slides, or images and turn your learning material into clear study notes and source-grounded quizzes with RecallMate.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#020617] font-sans text-white antialiased transition-colors duration-200">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <CookieConsent />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
