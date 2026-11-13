"use client";

import { useEffect, useRef, useState } from "react";

type NotificationItem = { id: string; title: string; body: string | null; read_at: string | null; created_at: string };

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [canRequestBrowserNotifications, setCanRequestBrowserNotifications] = useState(false);
  const seen = useRef(new Set<string>());

  const load = async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const next: NotificationItem[] = (await response.json()).notifications;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      next.filter(item => !item.read_at && seen.current.size > 0 && !seen.current.has(item.id)).forEach(item => new Notification(item.title, { body: item.body ?? undefined }));
    }
    next.forEach(item => seen.current.add(item.id));
    setItems(next);
  };

  useEffect(() => {
    setCanRequestBrowserNotifications(typeof Notification !== "undefined" && Notification.permission === "default");
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const markRead = async (id?: string) => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : {}) });
    setItems(previous => previous.map(item => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
  };
  const unread = items.filter(item => !item.read_at).length;
  const enableBrowserNotifications = async () => {
    if (typeof Notification !== "undefined") setCanRequestBrowserNotifications((await Notification.requestPermission()) === "default");
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => { setOpen(value => !value); if (!open) void load(); }} aria-label="Open notifications"
        className="relative rounded-xl p-2.5 text-lg text-white/70 transition hover:bg-white/[0.07] hover:text-white">
        <span aria-hidden="true">♧</span>
        {unread > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-[#f43f5e] px-1 text-[10px] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-white/10 bg-[#15131d] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><span className="font-fredoka font-semibold text-white">Notifications</span><button onClick={() => void markRead()} className="font-nunito text-xs font-bold text-[#c4b5fd]">✓ Read all</button></div>
        {canRequestBrowserNotifications && <button onClick={() => void enableBrowserNotifications()} className="w-full border-b border-white/10 px-4 py-2 text-left font-nunito text-xs font-bold text-[#c4b5fd]">Enable browser notifications</button>}
        <div className="max-h-96 overflow-auto">
          {items.length === 0 ? <p className="p-6 text-center font-quicksand text-sm text-white/45">You’re all caught up.</p> : items.map(item => <button key={item.id} onClick={() => !item.read_at && void markRead(item.id)} className={`block w-full border-b border-white/5 px-4 py-3 text-left last:border-0 ${item.read_at ? "opacity-60" : "bg-[#a78bfa]/[0.06]"}`}>
            <p className="font-nunito text-sm font-bold text-white">{item.title}</p>
            {item.body && <p className="mt-0.5 font-quicksand text-xs text-white/55">{item.body}</p>}
            <p className="mt-1 font-nunito text-[10px] text-white/35">{new Date(item.created_at).toLocaleString()}</p>
          </button>)}
        </div>
      </div>}
    </div>
  );
}
