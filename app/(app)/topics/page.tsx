"use client";

import Link from "next/link";

export default function TopicsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-pixelify text-[10px] uppercase tracking-[0.22em] text-[#c4a7ff]">YOUR STUDY COLLECTION</p>
          <h1 className="mt-2 font-fredoka text-3xl font-semibold text-white sm:text-4xl">My Library</h1>
          <p className="mt-2 font-quicksand text-sm text-white/50">Keep your materials, notes, reviewers and practice sets organized in one place.</p>
        </div>
        <Link href="/upload" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#a78bfa] to-[#c4a7ff] px-5 py-3 font-nunito text-sm font-black text-[#170f23] transition hover:-translate-y-0.5 hover:brightness-110">+ Add material</Link>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/upload?mode=flashcards" className="group rounded-3xl border border-[#a78bfa]/25 bg-gradient-to-br from-[#a78bfa]/15 to-[#111019] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#c4b5fd]/50 hover:shadow-xl hover:shadow-[#8b5cf6]/10">
          <span className="font-pixelify text-[10px] uppercase tracking-[0.2em] text-[#d6c4ff]">01 · BUILD</span>
          <h2 className="mt-4 font-fredoka text-2xl font-semibold text-white">Create flashcards</h2>
          <p className="mt-2 max-w-md font-quicksand text-sm leading-6 text-white/50">Make your own question-and-answer cards and practice active recall at your pace.</p>
          <span className="mt-6 inline-flex font-nunito text-sm font-extrabold text-[#d6c4ff] transition group-hover:translate-x-1">Create a deck →</span>
        </Link>
        <Link href="/upload" className="group rounded-3xl border border-[#f43f5e]/20 bg-gradient-to-br from-[#f43f5e]/10 to-[#111019] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#fb7185]/50 hover:shadow-xl hover:shadow-[#f43f5e]/10">
          <span className="font-pixelify text-[10px] uppercase tracking-[0.2em] text-[#ff9aaa]">02 · GENERATE</span>
          <h2 className="mt-4 font-fredoka text-2xl font-semibold text-white">Upload & build a reviewer</h2>
          <p className="mt-2 max-w-md font-quicksand text-sm leading-6 text-white/50">Turn PDFs and study documents into clear notes, generated reviewers and quizzes.</p>
          <span className="mt-6 inline-flex font-nunito text-sm font-extrabold text-[#ff9aaa] transition group-hover:translate-x-1">Open workspace →</span>
        </Link>
      </div>
      <div className="rounded-3xl border border-dashed border-white/10 bg-[#111019] px-6 py-10 text-center">
        <p className="font-fredoka text-xl font-semibold text-white">Your collection lives here.</p>
        <p className="mx-auto mt-2 max-w-lg font-quicksand text-sm leading-6 text-white/45">Your uploaded materials and generated study outputs are available from your recent activity on the dashboard. Open a material to continue working with it.</p>
        <Link href="/dashboard" className="mt-5 inline-flex font-nunito text-sm font-extrabold text-[#d6c4ff] hover:text-white">Back to Study →</Link>
      </div>
    </div>
  );
}
