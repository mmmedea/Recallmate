"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const MASCOT_VIDEO = "https://drive.google.com/uc?export=download&id=1xN8pUjFfPq58MghU09QfM9vX_R_j293h";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_14%_20%,rgba(167,139,250,0.18),transparent_34%),radial-gradient(ellipse_at_88%_58%,rgba(255,82,107,0.13),transparent_32%),#08070d] text-white">
      <Navbar />
      <section className="relative isolate flex flex-col items-center px-5 pb-20 pt-20 text-center sm:pt-24">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-8 -z-10 mx-auto h-[480px] max-w-5xl rounded-full bg-[radial-gradient(ellipse_at_center,rgba(181,151,255,0.19),rgba(8,7,13,0)_68%)] blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-40 -z-10 h-[420px] w-[420px] rounded-full bg-[#ff526b]/10 blur-[110px]" />
        <p className="font-pixelify mb-8 rounded-full border border-[#a78bfa]/40 bg-[#a78bfa]/10 px-5 py-2 text-xs uppercase tracking-[0.16em] text-[#c9b7ff] sm:text-sm">A smarter way to study</p>
        <div className="w-full max-w-5xl space-y-7">
          <h1 className="font-fredoka mx-auto max-w-4xl text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-[#fffaff] sm:text-6xl md:text-[4.7rem]">Turn your study files into something your brain will{" "}<span className="font-pixelify bg-gradient-to-r from-[#c4a7ff] via-[#a78bfa] to-[#ff526b] bg-clip-text text-transparent">remember.</span></h1>
          <p className="font-quicksand mx-auto max-w-3xl text-base font-semibold leading-relaxed text-[#c9c2d5] sm:text-lg">Bring your notes, slides, and documents. RecallMate transforms your learning material into clear study notes and interactive, source-grounded quizzes that help knowledge stick.</p>
        </div>
        <div className="mt-12">
          <Link href="/login" className="font-fredoka inline-flex min-w-64 items-center justify-center rounded-2xl border border-[#ff8293]/50 bg-gradient-to-r from-[#a78bfa] via-[#a78bfa] to-[#ff7185] px-12 py-5 text-xl font-bold text-[#100a19] shadow-[0_14px_42px_rgba(167,139,250,0.3)] transition-all duration-200 hover:-translate-y-1 hover:brightness-110 active:translate-y-0 sm:min-w-72 sm:py-5 sm:text-2xl">Learn now</Link>
        </div>
        <div className="mt-24 grid w-full max-w-6xl grid-cols-1 gap-5 px-1 text-left sm:grid-cols-3">
          <article className="rounded-3xl border border-[#a78bfa]/25 bg-[#17131f]/90 p-7 shadow-[0_14px_45px_rgba(0,0,0,0.25)] backdrop-blur"><p className="font-pixelify mb-4 text-xs uppercase tracking-[0.14em] text-[#c4a7ff]">01 / Understand</p><h2 className="font-fredoka mb-2 text-xl font-semibold text-white">Clear study notes</h2><p className="font-nunito text-sm leading-relaxed text-[#c4bdce]">Turn lengthy documents and lecture slides into organized summaries and key points.</p></article>
          <article className="rounded-3xl border border-[#a78bfa]/25 bg-[#17131f]/90 p-7 shadow-[0_14px_45px_rgba(0,0,0,0.25)] backdrop-blur"><p className="font-pixelify mb-4 text-xs uppercase tracking-[0.14em] text-[#c4a7ff]">02 / Practice</p><h2 className="font-fredoka mb-2 text-xl font-semibold text-white">Questions from your files</h2><p className="font-nunito text-sm leading-relaxed text-[#c4bdce]">Practice with questions based on your own materials and review at your pace.</p></article>
          <article className="rounded-3xl border border-[#ff526b]/30 bg-[linear-gradient(145deg,rgba(255,82,107,0.09),rgba(23,19,31,0.96)_55%)] p-7 shadow-[0_14px_45px_rgba(0,0,0,0.25)] backdrop-blur"><p className="font-pixelify mb-4 text-xs uppercase tracking-[0.14em] text-[#ff8293]">03 / Remember</p><h2 className="font-fredoka mb-2 text-xl font-semibold text-white">Make learning stick</h2><p className="font-nunito text-sm leading-relaxed text-[#d2bac4]">Build a stronger study habit with focused active recall and repeat practice.</p></article>
        </div>
        <section className="mt-16 flex w-full max-w-6xl flex-col items-center gap-6 overflow-hidden rounded-[2rem] border border-[#a78bfa]/25 bg-[radial-gradient(ellipse_at_80%_20%,rgba(255,82,107,0.12),transparent_40%),linear-gradient(120deg,#151020,#100d18)] px-6 py-9 shadow-[0_18px_65px_rgba(0,0,0,0.32)] sm:flex-row sm:justify-between sm:px-12">
          <div className="max-w-xl text-center sm:text-left"><p className="font-pixelify text-xs uppercase tracking-[0.18em] text-[#ff8293]">A little study buddy</p><h2 className="font-fredoka mt-2 text-2xl font-semibold text-white sm:text-3xl">Ready when you are.</h2><p className="font-nunito mt-2 text-[#c4bdce]">Take a breath, open your notes, and make your next study session count.</p></div>
          <video className="h-44 w-44 shrink-0 object-contain drop-shadow-[0_12px_28px_rgba(167,139,250,0.2)] sm:h-52 sm:w-52" src={MASCOT_VIDEO} autoPlay loop muted playsInline preload="metadata" aria-label="RecallMate mascot waving" />
        </section>
      </section>
      <Footer />
    </main>
  );
}
