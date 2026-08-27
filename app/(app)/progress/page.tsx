import { BarChart3, Target, Flame } from 'lucide-react'

export default function ProgressPage() {
  return <div className="motion-safe:animate-in motion-safe:fade-in duration-500"><p className="text-sm font-semibold text-indigo-600">Your momentum</p><h1 className="mt-1 text-3xl font-bold dark:text-white">Progress</h1><div className="mt-8 grid gap-5 sm:grid-cols-3">{[['Cards reviewed','0',BarChart3],['Mastery','0%',Target],['Study streak','0 days',Flame]].map(([label,value,Icon]) => <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900" key={label as string}><Icon className="h-6 w-6 text-indigo-500" /><p className="mt-4 text-sm text-slate-500">{label as string}</p><p className="mt-1 text-3xl font-bold dark:text-white">{value as string}</p></div>)}</div></div>
}
