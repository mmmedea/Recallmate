'use client'
import { Bot, Sparkles } from 'lucide-react'
import { useAppStore } from '@/lib/store'

export default function MedeaWelcomeCard() {
  const openMedea = useAppStore((state) => state.setChatDrawerOpen)
  return <section className="mt-8 overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-xl shadow-indigo-500/20 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-4"><div className="rounded-2xl bg-white/15 p-3"><Bot className="h-7 w-7" /></div><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-100"><Sparkles className="h-3.5 w-3.5" /> Medea AI is ready</p><h2 className="mt-1 text-xl font-black">Need help studying?</h2><p className="mt-1 max-w-xl text-sm text-indigo-100">Ask Medea to explain a topic, turn your notes into practice questions, or build your next study session.</p></div></div><button onClick={() => openMedea(true)} className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigo-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-indigo-50">Open Medea AI</button></div></section>
}
