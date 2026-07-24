import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import HeaderHearts from "@/components/HeaderHearts"; // Or wherever your top nav items are

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RecallMate",
  description: "AI-powered study assistant and quiz generator",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen antialiased`}>
        <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            
            {/* CLICKABLE LOGO / APP NAME */}
            <Link 
              href="/upload" 
              className="flex items-center gap-2 font-black text-xl text-white hover:text-indigo-400 transition-colors"
            >
              <span className="bg-indigo-600 text-white p-2 rounded-xl text-xs">🧠</span>
              RecallMate
            </Link>

            {/* Right side navigation items (Hearts, Premium button, Theme toggle, etc.) */}
            <div className="flex items-center gap-4">
              {/* Header components or buttons go here */}
            </div>

          </div>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}