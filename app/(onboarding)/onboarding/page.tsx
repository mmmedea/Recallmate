"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, LockKeyhole, UserRound } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function safeInternalPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export default function OnboardingPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const destination = safeInternalPath(searchParams.get("next"));
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setEmail(data.user.email ?? "");
      const existingUsername = data.user.user_metadata?.username;
      if (typeof existingUsername === "string") setUsername(existingUsername);
    });
  }, [router, supabase]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const normalizedUsername = username.trim();
    if (!/^[A-Za-z0-9_]{3,30}$/.test(normalizedUsername)) return setError("Username must be 3–30 letters, numbers, or underscores.");
    if (password.length < 8 || !/[^A-Za-z0-9]/.test(password)) return setError("Password needs at least 8 characters and one special symbol.");
    if (password !== confirmPassword) return setError("Passwords do not match.");

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { username: normalizedUsername, recallmate_account_completed: true },
    });
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    router.replace(destination);
    router.refresh();
  };

  return (
    <section role="dialog" aria-modal="true" aria-labelledby="onboarding-title" className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
      <form onSubmit={submit} className="space-y-5 rounded-3xl border border-white/70 bg-white/90 p-7 shadow-2xl shadow-indigo-950/15 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/90 sm:p-9">
        <div className="space-y-2 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/25"><CheckCircle2 className="h-6 w-6" /></span>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-400">Verified with Google</p>
          <h1 id="onboarding-title" className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">Create your RecallMate account</h1>
          <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">Your Google identity is verified. Complete these required details before entering the dashboard.</p>
        </div>
        <div className="space-y-1.5"><Label htmlFor="verified-email">Verified email</Label><Input id="verified-email" value={email} readOnly className="bg-slate-100 text-slate-500 dark:bg-slate-800" /></div>
        <div className="space-y-1.5"><Label htmlFor="onboarding-username">Username</Label><div className="relative"><UserRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input id="onboarding-username" value={username} onChange={event => setUsername(event.target.value)} className="pl-9" placeholder="your_username" autoComplete="username" required /></div></div>
        <div className="space-y-1.5"><Label htmlFor="onboarding-password">Password</Label><div className="relative"><LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input id="onboarding-password" type="password" value={password} onChange={event => setPassword(event.target.value)} className="pl-9" placeholder="8+ characters and 1 special symbol" autoComplete="new-password" required /></div></div>
        <div className="space-y-1.5"><Label htmlFor="onboarding-confirm">Confirm password</Label><Input id="onboarding-confirm" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" required /></div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
        <Button disabled={saving} className="h-11 w-full bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500">{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving account…</> : "Create account & enter RecallMate"}</Button>
      </form>
    </section>
  );
}
