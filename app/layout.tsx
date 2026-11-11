import type { Metadata } from "next";
import { Fredoka, Nunito, Quicksand, Pixelify_Sans } from "next/font/google";
import "@/app/globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import CookieConsent from "@/components/CookieConsent";
import { Toaster } from "@/components/ui/toaster";

const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const quicksand = Quicksand({ subsets: ["latin"], variable: "--font-quicksand", display: "swap" });
const pixelify = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixelify", display: "swap" });

export const metadata: Metadata = {
  title: "RecallMate | Learn It. Recall It. Remember It.",
  description: "Turn your study files into clear notes and interactive quizzes that help you remember what matters.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fredoka.variable} ${nunito.variable} ${quicksand.variable} ${pixelify.variable} min-h-screen bg-[#08070d] font-nunito text-white antialiased transition-colors duration-200`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <CookieConsent />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
