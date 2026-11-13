'use client'

import { useMemo, useState, useTransition } from 'react'
import { CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Download, List, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import type { CalendarEvent, CalendarEventInput } from '@/app/actions/calendar-actions'
import { deleteCalendarEvent, getCalendarEvents, saveCalendarEvent, toggleCalendarEventCompletion } from '@/app/actions/calendar-actions'

type View = 'month' | 'year' | 'agenda'

const COLORS: Record<CalendarEvent['color'], string> = {
  indigo: 'bg-indigo-500', violet: 'bg-violet-500', blue: 'bg-blue-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500', slate: 'bg-slate-500',
}
const monthNames = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2026, month, 1)))
const initialForm = (date: Date): CalendarEventInput => ({ title: '', description: '', starts_at: date.toISOString(), ends_at: null, all_day: true, event_type: 'study', color: 'indigo', priority: 'normal', reminderMinutes: 60 })

function dateKey(date: Date) { return date.toISOString().slice(0, 10) }

export default function YearCalendar({ initialEvents, initialYear, loadError }: { initialEvents: CalendarEvent[]; initialYear: number; loadError?: string }) {
  const today = new Date()
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialYear === today.getFullYear() ? today.getMonth() : 0)
  const [view, setView] = useState<View>('month')
  const [events, setEvents] = useState(initialEvents)
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [form, setForm] = useState<CalendarEventInput | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [isPending, startTransition] = useTransition()
  const eventsByDate = useMemo(() => events.reduce<Record<string, CalendarEvent[]>>((acc, event) => { (acc[event.starts_at.slice(0, 10)] ??= []).push(event); return acc }, {}), [events])
  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [events])
  const syncResult = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('google')
  const syncedCount = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('synced')

  const loadYear = (nextYear: number, nextMonth = month) => startTransition(async () => {
    try { setEvents(await getCalendarEvents(nextYear)); setYear(nextYear); setMonth(nextMonth) }
    catch { alert('RecallMate could not load that year. Please try again.') }
  })
  const move = (direction: -1 | 1) => {
    if (view === 'year') return loadYear(year + direction)
    const next = new Date(year, month + direction, 1)
    if (next.getFullYear() === year) setMonth(next.getMonth())
    else loadYear(next.getFullYear(), next.getMonth())
  }
  const goToday = () => loadYear(today.getFullYear(), today.getMonth())
  const openNew = (date: Date) => { setSelected(null); setForm(initialForm(date)) }
  const openEdit = (event: CalendarEvent) => { setSelected(event); setForm({ ...event, reminderMinutes: null }) }
  const closeEditor = () => { setSelected(null); setForm(null) }
  const save = () => form && startTransition(async () => {
    const result = await saveCalendarEvent(form, selected?.id)
    if (!result.success) return alert(result.error)
    const saved = result.event!
    setEvents(previous => selected ? previous.map(event => event.id === saved.id ? saved : event) : [...previous, saved])
    closeEditor()
  })
  const remove = () => selected && startTransition(async () => {
    const result = await deleteCalendarEvent(selected.id)
    if (!result.success) return alert(result.error)
    setEvents(previous => previous.filter(event => event.id !== selected.id)); closeEditor()
  })
  const toggleComplete = (event: CalendarEvent) => startTransition(async () => {
    const completed = !event.completed_at
    const result = await toggleCalendarEventCompletion(event.id, completed)
    if (result.success) setEvents(previous => previous.map(item => item.id === event.id ? { ...item, completed_at: completed ? new Date().toISOString() : null } : item))
  })

  const exportCalendar = () => {
    const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
    const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const entries = events.map(event => ['BEGIN:VEVENT', `UID:${event.id}@recallmate`, `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(event.starts_at)}`, event.ends_at ? `DTEND:${stamp(event.ends_at)}` : '', `SUMMARY:${escape(event.title)}`, `DESCRIPTION:${escape(event.description ?? '')}`, `CATEGORIES:${event.event_type},${event.priority}`, 'END:VEVENT'].filter(Boolean).join('\r\n')).join('\r\n')
    const blob = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//RecallMate//Study Planner//EN\r\n${entries}\r\nEND:VCALENDAR\r\n`], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a')
    link.href = url; link.download = `recallmate-${year}.ics`; link.click(); URL.revokeObjectURL(url)
  }

  const syncGoogle = async () => {
    setSyncing(true)
    setSyncError('')
    try {
      const response = await fetch('/api/integrations/google-calendar/connect')
      const data = await response.json() as { url?: string; error?: string }
      if (!response.ok || !data.url) throw new Error(data.error || 'Google Calendar could not connect.')
      window.location.assign(data.url)
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Google Calendar could not connect.')
      setSyncing(false)
    }
  }

  return <div className="space-y-6 pb-24 font-nunito sm:space-y-7">
    <header className="relative isolate overflow-hidden rounded-[2rem] border border-[#a78bfa]/25 bg-[radial-gradient(ellipse_at_90%_5%,rgba(244,63,94,.2),transparent_40%),linear-gradient(130deg,#1a1224,#100d18_58%,#160d18)] p-6 shadow-[0_24px_80px_rgba(0,0,0,.25)] sm:p-9">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="font-pixelify text-[10px] uppercase tracking-[0.22em] text-[#ff8799]">YOUR STUDY TIMELINE</p><h1 className="mt-2 font-fredoka text-3xl font-semibold tracking-tight text-white sm:text-4xl">{view === 'month' ? `${monthNames[month]} ${year}` : `${year} Calendar`}</h1><p className="mt-3 max-w-2xl font-quicksand text-sm leading-6 text-white/55 sm:text-base">Plan notes, deadlines, exams, and reminders in one clear timeline.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={syncGoogle} disabled={syncing} aria-label="Sync Google Calendar" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#a78bfa]/25 bg-white/[0.04] px-4 font-nunito text-sm font-bold text-[#d9c8ff] transition hover:-translate-y-0.5 hover:bg-[#a78bfa]/10 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Connecting…' : 'Sync Google Calendar'}</button><button type="button" onClick={exportCalendar} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 font-nunito text-sm font-bold text-white/70 hover:bg-white/[0.08]"><Download className="h-4 w-4" />Export .ics</button><button type="button" onClick={() => openNew(new Date(year, month, today.getDate(), 12))} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#a78bfa] to-[#f43f5e] px-5 font-nunito text-sm font-extrabold text-white shadow-lg shadow-[#a78bfa]/15 transition hover:-translate-y-0.5 hover:brightness-110"><Plus className="h-4 w-4" />Add event</button></div>
      </div>
    </header>

    {syncResult === 'connected' && <div role="status" className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">Google Calendar connected. {syncedCount ?? '0'} RecallMate events synchronized.</div>}
    {syncResult === 'error' && <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">Google Calendar sync failed. Confirm Calendar permission and try again.</div>}
    {syncError && <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">{syncError}</div>}
    {loadError && <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{loadError}</div>}

    <div className="sticky top-16 z-20 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#111019]/95 p-2 shadow-xl shadow-black/20 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="grid grid-cols-3 rounded-xl bg-black/30 p-1" role="group" aria-label="Calendar view">{([{ key: 'month', label: 'Month view', icon: CalendarDays }, { key: 'year', label: 'Year view', icon: CalendarDays }, { key: 'agenda', label: 'Agenda view', icon: List }] as const).map(item => <button type="button" key={item.key} aria-label={item.label} aria-pressed={view === item.key} onClick={() => setView(item.key)} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition ${view === item.key ? 'bg-[#a78bfa]/20 text-[#e5d8ff] shadow' : 'text-white/45 hover:text-white'}`}><item.icon className="h-4 w-4" /><span>{item.key[0].toUpperCase() + item.key.slice(1)}</span></button>)}</div>
      <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2 sm:flex"><button type="button" onClick={() => move(-1)} className="grid min-h-11 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-white/65 transition hover:border-[#a78bfa]/30 hover:bg-[#a78bfa]/10 hover:text-white" aria-label="Previous period"><ChevronLeft className="h-5 w-5" /></button><button type="button" onClick={goToday} className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-4 font-nunito text-sm font-bold text-white/75 transition hover:border-[#a78bfa]/30 hover:bg-[#a78bfa]/10 hover:text-white">Today</button><button type="button" onClick={() => move(1)} className="grid min-h-11 place-items-center rounded-xl border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" aria-label="Next period"><ChevronRight className="h-5 w-5" /></button></div>
    </div>

    {isPending && <p role="status" className="font-quicksand text-sm text-white/45">Updating calendar…</p>}
    {view === 'month' && <Month month={month} year={year} eventsByDate={eventsByDate} onNew={openNew} onEvent={openEdit} onToggle={toggleComplete} spacious />}
    {view === 'year' && <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 12 }, (_, value) => <Month key={value} month={value} year={year} eventsByDate={eventsByDate} onNew={openNew} onEvent={openEdit} onToggle={toggleComplete} />)}</div>}
    {view === 'agenda' && <Agenda events={sortedEvents} onEvent={openEdit} onToggle={toggleComplete} onNew={() => openNew(new Date(year, month, today.getDate(), 12))} />}
    {form && <EventEditor form={form} setForm={setForm} selected={selected} busy={isPending} onCancel={closeEditor} onSave={save} onDelete={remove} />}
  </div>
}

function Month({ year, month, eventsByDate, onNew, onEvent, onToggle, spacious = false }: { year: number; month: number; eventsByDate: Record<string, CalendarEvent[]>; onNew: (date: Date) => void; onEvent: (event: CalendarEvent) => void; onToggle: (event: CalendarEvent) => void; spacious?: boolean }) {
  const first = new Date(Date.UTC(year, month, 1)); const start = first.getUTCDay(); const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="border-b border-slate-100 px-4 py-3 text-base font-black text-slate-900 dark:border-slate-800 dark:text-white">{monthNames[month]}</h2><div className="grid grid-cols-7 border-b border-slate-100 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800">{['S','M','T','W','T','F','S'].map((d, i) => <span className="py-2" key={`${d}${i}`}>{d}</span>)}</div><div className="grid grid-cols-7">{Array.from({ length: start }, (_, i) => <div className={`${spacious ? 'min-h-20 sm:min-h-28' : 'min-h-20'} border-b border-r border-slate-100 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-950/20`} key={`blank${i}`} />)}{Array.from({ length: days }, (_, index) => { const day = index + 1; const date = new Date(Date.UTC(year, month, day, 12)); const items = eventsByDate[dateKey(date)] ?? []; const isToday = dateKey(date) === dateKey(new Date()); return <button type="button" aria-label={`Open ${monthNames[month]} ${day}`} key={day} onClick={() => onNew(date)} className={`${spacious ? 'min-h-20 sm:min-h-28' : 'min-h-20'} min-w-0 overflow-hidden border-b border-r border-slate-100 p-1 text-left align-top transition hover:bg-indigo-50/70 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-800 dark:hover:bg-indigo-950/30`}><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday ? 'bg-indigo-600 font-bold text-white' : 'text-slate-600 dark:text-slate-300'}`}>{day}</span><div className="mt-1 space-y-1">{items.slice(0, spacious ? 3 : 2).map(event => <span role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onEvent(event) }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEvent(event) } }} className={`flex min-h-5 w-full items-center gap-1 truncate rounded px-1 py-0.5 text-[9px] font-semibold text-white sm:text-[10px] ${COLORS[event.color]} ${event.completed_at ? 'opacity-50 line-through' : ''}`} key={event.id}><span onClick={e => { e.stopPropagation(); onToggle(event) }} className="shrink-0">{event.completed_at ? <Check className="h-2.5 w-2.5" /> : '•'}</span>{event.title}</span>)}{items.length > (spacious ? 3 : 2) && <span className="px-1 text-[9px] font-semibold text-slate-500">+{items.length - (spacious ? 3 : 2)} more</span>}</div></button> })}</div></section>
}

function Agenda({ events, onEvent, onToggle, onNew }: { events: CalendarEvent[]; onEvent: (event: CalendarEvent) => void; onToggle: (event: CalendarEvent) => void; onNew: () => void }) {
  if (!events.length) return <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700"><CalendarDays className="mx-auto h-10 w-10 text-indigo-500" /><h2 className="mt-3 text-lg font-black dark:text-white">Your agenda is clear</h2><p className="mt-1 text-sm text-slate-500">Add your first study session, note, exam, or reminder.</p><button type="button" onClick={onNew} className="mt-5 min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white">Create event</button></div>
  return <div className="space-y-3">{events.map(event => <article key={event.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"><button type="button" onClick={() => onToggle(event)} aria-label={`${event.completed_at ? 'Mark incomplete' : 'Mark complete'}: ${event.title}`} className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white ${COLORS[event.color]}`}>{event.completed_at ? <Check className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}</button><button type="button" onClick={() => onEvent(event)} className="min-w-0 flex-1 text-left"><p className={`truncate font-bold text-slate-900 dark:text-white ${event.completed_at ? 'line-through opacity-60' : ''}`}>{event.title}</p><p className="mt-1 text-sm text-slate-500">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: event.all_day ? undefined : 'short' }).format(new Date(event.starts_at))} · {event.event_type} · {event.priority}</p></button></article>)}</div>
}

function EventEditor({ form, setForm, selected, busy, onCancel, onSave, onDelete }: { form: CalendarEventInput; setForm: (form: CalendarEventInput) => void; selected: CalendarEvent | null; busy: boolean; onCancel: () => void; onSave: () => void; onDelete: () => void }) {
  const set = <K extends keyof CalendarEventInput>(key: K, value: CalendarEventInput[K]) => setForm({ ...form, [key]: value })
  const localDate = form.starts_at.slice(0, 10)
  const googleDates = `${new Date(form.starts_at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}/${new Date(form.ends_at ?? new Date(new Date(form.starts_at).getTime() + 60 * 60_000)).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(form.title || 'RecallMate study event')}&dates=${googleDates}&details=${encodeURIComponent(form.description ?? '')}`
  return <div role="dialog" aria-modal="true" aria-labelledby="event-editor-title" className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) onCancel() }}><div className="max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl dark:bg-slate-900 sm:max-w-xl sm:rounded-3xl sm:p-7"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="event-editor-title" className="text-xl font-black dark:text-white">{selected ? 'Edit event' : 'New event'}</h2><p className="text-sm text-slate-500">Add notes, labels, colors, and a reminder.</p></div><button type="button" onClick={onCancel} aria-label="Close event editor" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button></div><div className="space-y-4"><label className="block text-sm font-bold dark:text-slate-200">Title<input autoFocus value={form.title} maxLength={160} onChange={e => set('title', e.target.value)} placeholder="e.g. Biology midterm" className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700" /></label><label className="block text-sm font-bold dark:text-slate-200">Notes<textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)} placeholder="Chapters, goals, links, or study instructions" className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700" rows={4} /></label><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><label className="text-sm font-bold dark:text-slate-200">Date<input type="date" value={localDate} onChange={e => set('starts_at', new Date(`${e.target.value}T12:00:00`).toISOString())} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-700" /></label><label className="text-sm font-bold dark:text-slate-200">Type<select value={form.event_type} onChange={e => set('event_type', e.target.value as CalendarEvent['event_type'])} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 capitalize dark:border-slate-700 dark:bg-slate-900">{['study','review','quiz','exam','assignment','note','reminder','custom'].map(type => <option value={type} key={type}>{type}</option>)}</select></label><label className="text-sm font-bold dark:text-slate-200">Priority<select value={form.priority} onChange={e => set('priority', e.target.value as CalendarEvent['priority'])} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label></div><div><p className="mb-2 text-sm font-bold dark:text-slate-200">Color highlight</p><div className="flex flex-wrap gap-3">{(Object.keys(COLORS) as CalendarEvent['color'][]).map(color => <button type="button" aria-label={`Use ${color} color`} key={color} onClick={() => set('color', color)} className={`h-11 w-11 rounded-full ${COLORS[color]} ${form.color === color ? 'ring-2 ring-offset-2 ring-slate-950 dark:ring-white dark:ring-offset-slate-900' : ''}`} />)}</div></div><label className="block text-sm font-bold dark:text-slate-200">Reminder<select value={form.reminderMinutes ?? ''} onChange={e => set('reminderMinutes', e.target.value ? Number(e.target.value) : null)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"><option value="">No reminder</option><option value="5">5 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option><option value="10080">1 week before</option></select></label><a href={googleUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"><CalendarPlus className="h-4 w-4" />Add only this event to Google Calendar</a></div><div className="mt-6 flex items-center justify-between gap-3"><div>{selected && <button type="button" disabled={busy} onClick={onDelete} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 className="h-4 w-4" />Delete</button>}</div><button type="button" disabled={busy || !form.title.trim()} onClick={onSave} className="min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-black text-white shadow-lg disabled:opacity-50">{busy ? 'Saving…' : 'Save event'}</button></div></div></div>
}
