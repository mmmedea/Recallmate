"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type CookiePreferences = {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
};

const COOKIE_CONSENT_KEY = "recallmate_cookie_consent";

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always true
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    // Check if consent has already been given
    const storedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!storedConsent) {
      setShowBanner(true);
    } else {
      try {
        setPreferences(JSON.parse(storedConsent));
      } catch (e) {
        // Fallback if parsing fails
      }
    }
  }, []);

  const handleAcceptAll = () => {
    const allConsented = { essential: true, analytics: true, marketing: true };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(allConsented));
    setPreferences(allConsented);
    setShowBanner(false);
  };

  const handleDenyAll = () => {
    const allDenied = { essential: true, analytics: false, marketing: false };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(allDenied));
    setPreferences(allDenied);
    setShowBanner(false);
  };

  const handleSavePreferences = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(preferences));
    setShowBanner(false);
    setShowPreferences(false);
  };

  if (!showBanner && !showPreferences) return null;

  return (
    <>
      {showBanner && !showPreferences && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 md:p-8 animate-in slide-in-from-bottom duration-500">
          <div className="mx-auto max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <h3 className="font-semibold text-lg text-slate-900 dark:text-white">We value your privacy</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                We use essential cookies to keep RecallMate secure and keep you signed in. With your permission, we may also use optional cookies to understand product usage and improve the experience.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
              <Button variant="outline" onClick={() => setShowPreferences(true)} className="whitespace-nowrap">
                Manage Preferences
              </Button>
              <Button variant="outline" onClick={handleDenyAll} className="whitespace-nowrap">
                Deny All
              </Button>
              <Button onClick={handleAcceptAll} className="bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap">
                Accept All
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showPreferences} onOpenChange={setShowPreferences}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cookie Preferences</DialogTitle>
            <DialogDescription>
              Manage your cookie settings. Essential cookies cannot be disabled as they are strictly necessary for the application to function.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex items-start space-x-3">
              <Checkbox id="essential" checked={true} disabled />
              <div className="space-y-1 leading-none">
                <Label htmlFor="essential" className="font-semibold cursor-not-allowed opacity-70">
                  Essential Cookies (Required)
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Used for authentication, session management, and security. The app cannot function without these.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox 
                id="analytics" 
                checked={preferences.analytics}
                onCheckedChange={(c) => setPreferences({ ...preferences, analytics: !!c })}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="analytics" className="font-semibold cursor-pointer">
                  Analytics Cookies
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Help us understand how you use RecallMate so we can improve the experience.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox 
                id="marketing" 
                checked={preferences.marketing}
                onCheckedChange={(c) => setPreferences({ ...preferences, marketing: !!c })}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="marketing" className="font-semibold cursor-pointer">
                  Marketing Cookies
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Used to deliver relevant advertisements and track ad performance.
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowPreferences(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreferences} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Save Preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
