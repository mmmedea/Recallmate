"use client";
import Link from "next/link";

const LOGO_URL = "https://drive.google.com/thumbnail?id=1VBjuDg72zKakz032deRqbBJp0SYUFDuu&sz=w512";
const LOGO_FALLBACK = "https://lh3.googleusercontent.com/d/1VBjuDg72zKakz032deRqbBJp0SYUFDuu=w512";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 bg-[#100b19]/85 text-white backdrop-blur-2xl">
      <div className="mx-auto flex min-h-[72px] max-w-[1480px] items-center justify-between gap-2 px-3 sm:min-h-[86px] sm:gap-4 sm:px-12 lg:px-16">
        <Link href="/" aria-label="RecallMate home" className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#c4a7ff]/40 bg-[#21182d] shadow-[0_0_25px_rgba(167,139,250,.22)] sm:h-12 sm:w-12 sm:rounded-2xl">
            <img
              src={LOGO_URL}
              onError={(event) => {
                const image = event.currentTarget;
                if (image.dataset.fallbackApplied === "true") return;
                image.dataset.fallbackApplied = "true";
                image.src = LOGO_FALLBACK;
              }}
              alt="RecallMate logo"
              width={48}
              height={48}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-full w-full object-contain"
            />
          </span>
          <span className="font-fredoka truncate bg-gradient-to-r from-[#f5efff] via-[#c4a7ff] to-[#ff7185] bg-clip-text text-lg font-semibold tracking-tight text-transparent sm:text-2xl lg:text-[1.7rem]">
            RecallMate
          </span>
        </Link>
        <nav aria-label="Account navigation" className="flex shrink-0 items-center gap-1 sm:gap-3">
          <Link
            href="/login"
            className="font-fredoka inline-flex items-center justify-center whitespace-nowrap rounded-full border border-[#c4a7ff]/65 bg-[#2a1c38]/90 px-2.5 py-2 text-[11px] font-semibold tracking-wide text-[#e8dcff] shadow-[0_4px_16px_rgba(167,139,250,.16)] transition-all hover:border-[#ff7185] hover:bg-[#3a2038] hover:text-white hover:shadow-[0_5px_18px_rgba(255,82,107,.2)] sm:px-4 sm:text-sm"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="font-fredoka inline-flex items-center justify-center whitespace-nowrap rounded-full border border-[#c4a7ff]/65 bg-gradient-to-r from-[#a78bfa] via-[#c4a7ff] to-[#ff7185] px-3 py-2 text-[11px] font-bold tracking-wide text-[#100a19] shadow-[0_4px_16px_rgba(167,139,250,.22)] transition-all hover:-translate-y-0.5 hover:brightness-110 sm:px-5 sm:text-sm"
          >
            Learn now
          </Link>
        </nav>
      </div>
    </header>
  );
}
