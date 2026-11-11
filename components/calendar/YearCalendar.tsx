'use client'

import { useMemo, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, Bell, CalendarPlus, Download } from 'lucide-react'
import type { CalendarEvent, CalendarEventInput } from '@/app/actions/calendar-actions'
import { deleteCalendarEvent, getCalendarEvents, saveCalendarEvent, toggleCalendarEventCompletion } from '@/app/actions/calendar-actions'

const COLORS: Record<CalendarEvent['color'], string> = {
  indigo: 'bg-indigo-500', violet: 'bg-violet-500', blue: 'bg-blue-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500', slate: 'bg-slate-500',
}
const monthNames = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2026, month, 1)))
const initialForm = (date: Date): CalendarEventInput => ({ title: '', description: '', starts_at: date.toISOString(), ends_at: null, all_day: true, event_type: 'study', color: 'indigo', priority: 'normal', reminderMinutes: 60 })

function dateKey(date: Date) { return date.toISOString().slice(0, 10) }

export default function YearCalendar({ initialEvents, initialYear }: { initialEvents: CalendarEvent[]; initialYear: number }) {
  const [year, setYear] = useState(initialYear)
  const [events, setEvents] = useState(initialEvents)
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [form, setForm] = useState<CalendarEventInput | null>(null)
  const [isPending, startTransition] = useTransition()
  const eventsByDate = useMemo(() => events.reduce<Record<string, CalendarEvent[]>>((acc, event) => { (acc[event.starts_at.slice(0, 10)] ??= []).push(event); return acc }, {}), [events])

  const changeYear = (nextYear: number) => startTransition(async () => { setEvents(await getCalendarEvents(nextYear)); setYear(nextYear) })
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
    const entries = events.map(event => [
      'BEGIN:VEVENT', `UID:${event.id}@recallmate`, `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(event.starts_at)}`, event.ends_at ? `DTEND:${stamp(event.ends_at)}` : '',
      `SUMMARY:${escape(event.title)}`, `DESCRIPTION:${escape(event.description ?? '')}`,
      `CATEGORIES:${event.event_type},${event.priority}`, 'END:VEVENT',
    ].filter(Boolean).join('\r\n')).join('\r\n')
    const blob = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//RecallMate//Study Planner//EN\r\n${entries}\r\nEND:VCALENDAR\r\n`], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `recallmate-${year}.ics`; link.click(); URL.revokeObjectURL(url)
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Study planner</p><h1 className="text-3xl font-bold text-slate-950 dark:text-white">{year} Calendar</h1><p className="mt-1 text-slate-500 dark:text-slate-400">Plan every semester, deadline, and review in one place.</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={() => changeYear(year - 1)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" aria-label="Previous year"><ChevronLeft className="h-5 w-5" /></button><button onClick={() => changeYear(new Date().getFullYear())} className="rounded-lg border border-slate-200 px-3 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">Today</button><button onClick={() => changeYear(year + 1)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" aria-label="Next year"><ChevronRight className="h-5 w-5" /></button><button onClick={exportCalendar} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" title="Download and import into Google Calendar"><Download className="h-4 w-4" />Google Calendar</button><button onClick={() => openNew(new Date())} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Plus className="h-4 w-4" />Add event</button></div>
    </div>
    {isPending && <p className="text-sm text-slate-500">Updating calendar…</p>}
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {Array.from({ length: 12 }, (_, month) => <Month key={month} month={month} year={year} eventsByDate={eventsByDate} onNew={openNew} onEvent={openEdit} onToggle={toggleComplete} />)}
    </div>
    {form && <EventEditor form={form} setForm={setForm} selected={selected} busy={isPending} onCancel={closeEditor} onSave={save} onDelete={remove} />}
  </div>
}

function Month({ year, month, eventsByDate, onNew, onEvent, onToggle }: { year: number; month: number; eventsByDate: Record<string, CalendarEvent[]>; onNew: (date: Date) => void; onEvent: (event: CalendarEvent) => void; onToggle: (event: CalendarEvent) => void }) {
  const first = new Date(Date.UTC(year, month, 1)); const start = first.getUTCDay(); const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-white">{monthNames[month]}</h2><div className="grid grid-cols-7 border-b border-slate-100 text-center text-[10px] font-semibold uppercase text-slate-400 dark:border-slate-800">{['S','M','T','W','T','F','S'].map((d, i) => <span className="py-2" key={`${d}${i}`}>{d}</span>)}</div><div className="grid grid-cols-7">{Array.from({ length: start }, (_, i) => <div className="min-h-20 border-b border-r border-slate-100 dark:border-slate-800" key={`blank${i}`} />)}{Array.from({ length: days }, (_, index) => { const day = index + 1; const date = new Date(Date.UTC(year, month, day, 12)); const items = eventsByDate[dateKey(date)] ?? []; const today = dateKey(date) === dateKey(new Date()); return <button key={day} onClick={() => onNew(date)} className="min-h-20 overflow-hidden border-b border-r border-slate-100 p-1 text-left align-top hover:bg-indigo-50/60 dark:border-slate-800 dark:hover:bg-indigo-950/30"><span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${today ? 'bg-indigo-600 font-bold text-white' : 'text-slate-600 dark:text-slate-300'}`}>{day}</span><div className="mt-1 space-y-0.5">{items.slice(0, 2).map(event => <span role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onEvent(event) }} onKeyDown={e => { if (e.key === 'Enter') onEvent(event) }} className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-[9px] text-white ${COLORS[event.color]} ${event.completed_at ? 'opacity-50 line-through' : ''}`} key={event.id}><span onClick={e => { e.stopPropagation(); onToggle(event) }} className="shrink-0">{event.completed_at ? <Check className="h-2.5 w-2.5" /> : '•'}</span>{event.title}</span>)}{items.length > 2 && <span className="px-1 text-[9px] text-slate-500">+{items.length - 2} more</span>}</div></button> })}</div></section>
}

function EventEditor({ form, setForm, selected, busy, onCancel, onSave, onDelete }: { form: CalendarEventInput; setForm: (form: CalendarEventInput) => void; selected: CalendarEvent | null; busy: boolean; onCancel: () => void; onSave: () => void; onDelete: () => void }) {
  const set = <K extends keyof CalendarEventInput>(key: K, value: CalendarEventInput[K]) => setForm({ ...form, [key]: value })
  const localDate = form.starts_at.slice(0, 10)
  const googleDates = `${new Date(form.starts_at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}/${new Date(form.ends_at ?? new Date(new Date(form.starts_at).getTime() + 60 * 60_000)).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(form.title || 'RecallMate study event')}&dates=${googleDates}&details=${encodeURIComponent(form.description ?? '')}`
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
    <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
      <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold dark:text-white">{selected ? 'Edit event' : 'New event'}</h2><p className="text-sm text-slate-500">Add notes, labels, colors, and reminders.</p></div><button onClick={onCancel} className="text-sm text-slate-500">Cancel</button></div>
      <div className="space-y-4">
        <input autoFocus value={form.title} maxLength={160} onChange={e => set('title', e.target.value)} placeholder="e.g. Biology midterm" className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
        <textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)} placeholder="Notes, chapters, or study instructions" className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700" rows={4} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium dark:text-slate-200">Date<input type="date" value={localDate} onChange={e => set('starts_at', new Date(`${e.target.value}T12:00:00`).toISOString())} className="mt-1 block w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 dark:border-slate-700" /></label>
          <label className="text-sm font-medium dark:text-slate-200">Type<select value={form.event_type} onChange={e => set('event_type', e.target.value as CalendarEvent['event_type'])} className="mt-1 block w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 dark:border-slate-700">{['study','review','quiz','exam','assignment','custom'].map(type => <option key={type}>{type}</option>)}</select></label>
          <label className="text-sm font-medium dark:text-slate-200">Label<select value={form.priority} onChange={e => set('priority', e.target.value as CalendarEvent['priority'])} className="mt-1 block w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 dark:border-slate-700"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
        </div>
        <div><p className="mb-2 text-sm font-medium dark:text-slate-200">Color highlight</p><div className="flex flex-wrap gap-2">{(Object.keys(COLORS) as CalendarEvent['color'][]).map(color => <button type="button" key={color} onClick={() => set('color', color)} title={color} className={`h-7 w-7 rounded-full ${COLORS[color]} ${form.color === color ? 'ring-2 ring-offset-2 ring-slate-950 dark:ring-white' : ''}`} />)}</div></div>
        <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><Bell className="h-4 w-4" />Remind me<select value={form.reminderMinutes ?? ''} onChange={e => set('reminderMinutes', e.target.value ? Number(e.target.value) : null)} className="rounded-lg border border-slate-200 bg-transparent px-2 py-1 dark:border-slate-700"><option value="">No reminder</option><option value="5">5 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option><option value="10080">1 week before</option></select></label>
        <a href={googleUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"><CalendarPlus className="h-4 w-4" />Add this event to Google Calendar</a>
      </div>
      <div className="mt-6 flex items-center justify-between"><div>{selected && <button disabled={busy} onClick={onDelete} className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600"><Trash2 className="h-4 w-4" />Delete</button>}</div><button disabled={busy || !form.title.trim()} onClick={onSave} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save event'}</button></div>
    </div>
  </div>
}
