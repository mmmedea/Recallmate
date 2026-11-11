"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#a78bfa]/20 bg-[#08070d]/90 text-white shadow-[0_8px_35px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div aria-hidden="true" className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#a78bfa] to-[#ff526b]" />
      <div className="mx-auto flex min-h-[76px] max-w-[1480px] items-center justify-center px-5 sm:px-8">
        <Link href="/" className="font-fredoka bg-gradient-to-r from-[#f5efff] via-[#c4a7ff] to-[#ff7185] bg-clip-text text-2xl font-semibold tracking-tight text-transparent transition-opacity hover:opacity-85">
          RecallMate
        </Link>
      </div>
    </header>
  );
}
