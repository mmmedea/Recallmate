"use client";

import Image from "next/image";
import Link from "next/link";

const LOGO_URL = "https://drive.google.com/uc?export=download&id=1DdRoxeAMP8O4X1sbgVeA_LH3F5FjO0NH";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#a78bfa]/25 bg-[#08070d]/90 text-white shadow-[0_8px_35px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
      <div aria-hidden="true" className="h-[3px] w-full bg-gradient-to-r from-[#ff526b] via-[#a78bfa] to-[#ff526b]" />
      <div className="mx-auto flex min-h-[82px] max-w-[1480px] items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="RecallMate home" className="flex items-center gap-3">
          <img src={LOGO_URL} alt="RecallMate logo" className="h-11 w-11 rounded-xl object-contain" />
          <span className="font-fredoka bg-gradient-to-r from-[#f5efff] via-[#c4a7ff] to-[#ff7185] bg-clip-text text-2xl font-semibold tracking-tight text-transparent sm:text-[1.7rem]">RecallMate</span>
        </Link>
        <Link href="/login" className="font-fredoka inline-flex min-w-36 items-center justify-center rounded-2xl border border-[#ff8293]/50 bg-gradient-to-r from-[#a78bfa] via-[#a78bfa] to-[#ff7185] px-8 py-3.5 text-base font-semibold text-[#100a19] shadow-[0_8px_28px_rgba(167,139,250,0.2)] transition-all hover:-translate-y-0.5 hover:brightness-110 sm:min-w-44 sm:px-10 sm:py-4 sm:text-lg">Sign in</Link>
      </div>
    </header>
  );
}
