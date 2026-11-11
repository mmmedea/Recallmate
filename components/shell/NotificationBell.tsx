'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'

type Notification = { id: string; title: string; body: string | null; read_at: string | null; created_at: string }

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [canRequestBrowserNotifications, setCanRequestBrowserNotifications] = useState(false)
  const seen = useRef(new Set<string>())
  const load = async () => {
    const response = await fetch('/api/notifications', { cache: 'no-store' })
    if (!response.ok) return
    const next: Notification[] = (await response.json()).notifications
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      next.filter(item => !item.read_at && seen.current.size > 0 && !seen.current.has(item.id)).forEach(item => new Notification(item.title, { body: item.body ?? undefined }))
    }
    next.forEach(item => seen.current.add(item.id))
    setItems(next)
  }
  useEffect(() => { setCanRequestBrowserNotifications(typeof Notification !== 'undefined' && Notification.permission === 'default'); load(); const interval = window.setInterval(load, 60_000); return () => window.clearInterval(interval) }, [])
  const markRead = async (id?: string) => { await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { id } : {}) }); setItems(previous => previous.map(item => ({ ...item, read_at: item.read_at ?? new Date().toISOString() }))) }
  const unread = items.filter(item => !item.read_at).length
  const enableBrowserNotifications = async () => {
    if (typeof Notification !== 'undefined') setCanRequestBrowserNotifications((await Notification.requestPermission()) === 'default')
  }
  return <div className="relative"><button onClick={() => { setOpen(value => !value); if (!open) load() }} aria-label="Open notifications" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Bell className="h-5 w-5" />{unread > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}</button>{open && <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800"><span className="font-bold dark:text-white">Notifications</span><button onClick={() => markRead()} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600"><CheckCheck className="h-4 w-4" />Read all</button></div>{canRequestBrowserNotifications && <button onClick={enableBrowserNotifications} className="w-full border-b border-slate-100 px-4 py-2 text-left text-xs font-semibold text-indigo-600 dark:border-slate-800">Enable browser notifications</button>}<div className="max-h-96 overflow-auto">{items.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">You’re all caught up.</p> : items.map(item => <button key={item.id} onClick={() => !item.read_at && markRead(item.id)} className={`block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 dark:border-slate-800 ${item.read_at ? 'opacity-60' : 'bg-indigo-50/50 dark:bg-indigo-950/20'}`}><p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>{item.body && <p className="mt-0.5 text-xs text-slate-500">{item.body}</p>}<p className="mt-1 text-[11px] text-slate-400">{new Date(item.created_at).toLocaleString()}</p></button>)}</div></div>}</div>
}
