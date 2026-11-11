import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RecallMate — Study Smarter with AI",
  description:
    "Upload notes, slides, or videos and let AI turn them into active recall questions."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#fafafa] text-gray-900`}>
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 pb-20 pt-6">{children}</main>
      </body>
    </html>
  );
}