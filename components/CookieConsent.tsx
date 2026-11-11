"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type CookiePreferences = { essential: boolean; analytics: boolean; marketing: boolean };
const COOKIE_CONSENT_KEY = "recallmate_cookie_consent";

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({ essential: true, analytics: false, marketing: false });

  useEffect(() => {
    const storedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!storedConsent) setShowBanner(true);
    else {
      try { setPreferences(JSON.parse(storedConsent)); } catch { /* Keep safe defaults. */ }
    }
  }, []);

  const saveConsent = (next: CookiePreferences) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(next));
    setPreferences(next);
    setShowBanner(false);
    setShowPreferences(false);
  };

  if (!showBanner && !showPreferences) return null;

  return (
    <>
      {showBanner && !showPreferences && (
        <aside aria-label="Cookie consent" className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-0 pt-4 sm:px-6 sm:pb-0">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-t-[22px] border border-[#a78bfa]/20 bg-[#17131f] p-6 shadow-[0_-18px_60px_rgba(0,0,0,0.45)] sm:p-7 md:flex-row md:items-center">
            <div className="max-w-3xl space-y-2">
              <h2 className="font-fredoka text-lg font-semibold tracking-tight text-white">We value your privacy</h2>
              <p className="font-nunito text-sm leading-relaxed text-[#b9b1c6] sm:text-base">
                We use essential cookies to keep RecallMate secure and keep you signed in. With your permission, we may also use optional cookies to understand product usage and improve the experience.
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row md:w-auto">
              <Button variant="outline" onClick={() => setShowPreferences(true)} className="h-12 whitespace-nowrap rounded-xl border-[#a78bfa]/30 bg-[#0c0a12] px-5 font-nunito font-bold text-[#f4efff] hover:bg-[#282033] hover:text-white">Manage Preferences</Button>
              <Button variant="outline" onClick={() => saveConsent({ essential: true, analytics: false, marketing: false })} className="h-12 whitespace-nowrap rounded-xl border-[#a78bfa]/30 bg-[#0c0a12] px-5 font-nunito font-bold text-[#f4efff] hover:bg-[#282033] hover:text-white">Deny All</Button>
              <Button onClick={() => saveConsent({ essential: true, analytics: true, marketing: true })} className="h-12 whitespace-nowrap rounded-xl bg-[#a78bfa] px-5 font-nunito font-extrabold text-[#120d1d] hover:bg-[#c4a7ff]">Accept All</Button>
            </div>
          </div>
        </aside>
      )}

      <Dialog open={showPreferences} onOpenChange={setShowPreferences}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cookie Preferences</DialogTitle>
            <DialogDescription>Manage your cookie settings. Essential cookies cannot be disabled because they are required for the application to function.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-start space-x-3">
              <Checkbox id="essential" checked disabled />
              <div className="space-y-1 leading-none">
                <Label htmlFor="essential" className="font-semibold">Essential Cookies (Required)</Label>
                <p className="text-xs text-slate-500">Used for authentication, session management, and security.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Checkbox id="analytics" checked={preferences.analytics} onCheckedChange={(checked) => setPreferences((current) => ({ ...current, analytics: !!checked }))} />
              <div className="space-y-1 leading-none">
                <Label htmlFor="analytics" className="font-semibold">Analytics Cookies</Label>
                <p className="text-xs text-slate-500">Help us understand how people use RecallMate so we can improve it.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Checkbox id="marketing" checked={preferences.marketing} onCheckedChange={(checked) => setPreferences((current) => ({ ...current, marketing: !!checked }))} />
              <div className="space-y-1 leading-none">
                <Label htmlFor="marketing" className="font-semibold">Marketing Cookies</Label>
                <p className="text-xs text-slate-500">Used to measure relevant campaign performance.</p>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowPreferences(false)}>Cancel</Button>
            <Button onClick={() => saveConsent(preferences)} className="bg-[#a78bfa] text-[#120d1d] hover:bg-[#c4a7ff]">Save Preferences</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
