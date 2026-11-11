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
        <aside aria-label="Cookie consent" className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-0 pt-4 sm:px-6">
          <div className="relative mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 overflow-hidden rounded-t-[22px] border border-[#a78bfa]/25 bg-[#100d18]/95 p-6 shadow-[0_-18px_70px_rgba(0,0,0,0.58)] backdrop-blur-2xl sm:p-7 md:flex-row md:items-center">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c4a7ff] to-[#ff526b]" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full bg-[#ff526b]/10 blur-3xl" />
            <div className="relative max-w-3xl space-y-2">
              <p className="font-pixelify text-[10px] uppercase tracking-[0.2em] text-[#ff8293]">Your data, your choice</p>
              <h2 className="font-fredoka text-xl font-semibold tracking-tight text-white sm:text-2xl">We value your privacy</h2>
              <p className="font-nunito text-sm leading-relaxed text-[#c7bfd2] sm:text-base">
                We use essential cookies to keep RecallMate secure and keep you signed in. With your permission, we may also use optional cookies to understand product usage and improve the experience.
              </p>
            </div>
            <div className="relative flex w-full shrink-0 flex-col gap-3 sm:flex-row md:w-auto">
              <Button variant="outline" onClick={() => setShowPreferences(true)} className="h-12 whitespace-nowrap rounded-xl border-[#a78bfa]/35 bg-[#09070e] px-5 font-quicksand font-bold text-[#f4efff] transition-colors hover:border-[#c4a7ff] hover:bg-[#21182d] hover:text-white">Manage Preferences</Button>
              <Button variant="outline" onClick={() => saveConsent({ essential: true, analytics: false, marketing: false })} className="h-12 whitespace-nowrap rounded-xl border-[#ff526b]/35 bg-[#160b12] px-5 font-quicksand font-bold text-[#ffdce2] transition-colors hover:border-[#ff8293] hover:bg-[#32101d] hover:text-white">Deny All</Button>
              <Button onClick={() => saveConsent({ essential: true, analytics: true, marketing: true })} className="h-12 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#a78bfa] to-[#c4a7ff] px-5 font-quicksand font-extrabold text-[#100a19] shadow-[0_7px_25px_rgba(167,139,250,0.22)] transition-all hover:-translate-y-0.5 hover:from-[#c4a7ff] hover:to-[#ff8293]">Accept All</Button>
            </div>
          </div>
        </aside>
      )}

      <Dialog open={showPreferences} onOpenChange={setShowPreferences}>
        <DialogContent className="border-[#a78bfa]/25 bg-[#100d18] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-fredoka text-xl">Cookie Preferences</DialogTitle>
            <DialogDescription className="font-nunito text-[#c7bfd2]">Manage your cookie settings. Essential cookies cannot be disabled because they are required for the application to function.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4 font-nunito">
            <div className="flex items-start space-x-3">
              <Checkbox id="essential" checked disabled />
              <div className="space-y-1 leading-none">
                <Label htmlFor="essential" className="font-semibold text-white">Essential Cookies (Required)</Label>
                <p className="text-xs text-[#aaa0b8]">Used for authentication, session management, and security.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Checkbox id="analytics" checked={preferences.analytics} onCheckedChange={(checked) => setPreferences((current) => ({ ...current, analytics: !!checked }))} />
              <div className="space-y-1 leading-none">
                <Label htmlFor="analytics" className="font-semibold text-white">Analytics Cookies</Label>
                <p className="text-xs text-[#aaa0b8]">Help us understand how people use RecallMate so we can improve it.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Checkbox id="marketing" checked={preferences.marketing} onCheckedChange={(checked) => setPreferences((current) => ({ ...current, marketing: !!checked }))} />
              <div className="space-y-1 leading-none">
                <Label htmlFor="marketing" className="font-semibold text-white">Marketing Cookies</Label>
                <p className="text-xs text-[#aaa0b8]">Used to measure relevant campaign performance.</p>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowPreferences(false)} className="font-quicksand border-[#a78bfa]/35 bg-[#09070e] text-white hover:bg-[#21182d] hover:text-white">Cancel</Button>
            <Button onClick={() => saveConsent(preferences)} className="font-quicksand bg-gradient-to-r from-[#a78bfa] to-[#c4a7ff] font-bold text-[#100a19] hover:from-[#c4a7ff] hover:to-[#ff8293]">Save Preferences</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
