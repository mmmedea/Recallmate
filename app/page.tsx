"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#08070d] text-white">
      <Navbar />
      <section className="relative isolate flex min-h-[calc(100vh-76px)] flex-col items-center px-5 pb-24 pt-24 text-center sm:pt-28">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-12 -z-10 mx-auto h-[480px] max-w-5xl rounded-full bg-[radial-gradient(ellipse_at_center,rgba(181,151,255,0.17),rgba(8,7,13,0)_68%)] blur-3xl" />
        <p className="mb-8 rounded-full border border-[#a78bfa]/40 bg-[#a78bfa]/10 px-5 py-2 font-pixelify text-xs uppercase tracking-[0.16em] text-[#c9b7ff] sm:text-sm">
          A smarter way to study
        </p>

        <div className="w-full max-w-5xl space-y-7">
          <h1 className="font-fredoka mx-auto max-w-4xl text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-[#fffaff] sm:text-6xl md:text-[4.7rem]">
            Turn your study files into something your brain will{" "}
            <span className="font-pixelify bg-gradient-to-r from-[#c4a7ff] via-[#a78bfa] to-[#ff526b] bg-clip-text text-transparent">remember.</span>
          </h1>
          <p className="font-quicksand mx-auto max-w-3xl text-base font-semibold leading-relaxed text-[#c9c2d5] sm:text-lg">
            Bring your notes, slides, and documents. RecallMate transforms your learning material into clear study notes and interactive, source-grounded quizzes that help knowledge stick.
          </p>
        </div>

        <div className="mt-12">
          <Link
            href="/login"
            className="font-fredoka inline-flex min-w-52 items-center justify-center rounded-2xl border border-[#c4a7ff]/50 bg-gradient-to-r from-[#a78bfa] to-[#8b5cf6] px-9 py-4 text-lg font-semibold text-[#120d1d] shadow-[0_12px_45px_rgba(167,139,250,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0"
          >
            Learn now
          </Link>
        </div>

        <div className="mt-24 grid w-full max-w-6xl grid-cols-1 gap-5 px-1 text-left sm:grid-cols-3">
          <article className="rounded-3xl border border-[#a78bfa]/20 bg-[#17131f]/85 p-7 shadow-lg shadow-black/20 backdrop-blur">
            <p className="font-pixelify mb-4 text-xs uppercase tracking-[0.14em] text-[#c4a7ff]">01 / Understand</p>
            <h2 className="font-fredoka mb-2 text-xl font-semibold text-white">Clear study notes</h2>
            <p className="font-nunito text-sm leading-relaxed text-[#b9b1c6]">Turn lengthy documents and lecture slides into organized summaries and key points.</p>
          </article>
          <article className="rounded-3xl border border-[#a78bfa]/20 bg-[#17131f]/85 p-7 shadow-lg shadow-black/20 backdrop-blur">
            <p className="font-pixelify mb-4 text-xs uppercase tracking-[0.14em] text-[#c4a7ff]">02 / Practice</p>
            <h2 className="font-fredoka mb-2 text-xl font-semibold text-white">Questions from your files</h2>
            <p className="font-nunito text-sm leading-relaxed text-[#b9b1c6]">Practice with questions based on your own materials and review at your pace.</p>
          </article>
          <article className="rounded-3xl border border-[#ff526b]/25 bg-[#1b121b]/90 p-7 shadow-lg shadow-black/20 backdrop-blur">
            <p className="font-pixelify mb-4 text-xs uppercase tracking-[0.14em] text-[#ff8293]">03 / Remember</p>
            <h2 className="font-fredoka mb-2 text-xl font-semibold text-white">Make learning stick</h2>
            <p className="font-nunito text-sm leading-relaxed text-[#c8b4be]">Build a stronger study habit with focused active recall and repeat practice.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
