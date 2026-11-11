"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#a78bfa]/15 bg-[#0c0a12]/95 text-white backdrop-blur-xl">
      <div className="mx-auto flex min-h-[76px] max-w-[1480px] items-center justify-center px-5 sm:px-8">
        <Link href="/" className="font-fredoka text-2xl font-semibold tracking-tight text-white">
          RecallMate
        </Link>
      </div>
    </header>
  );
}
