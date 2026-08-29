"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Bell, Camera, CheckCircle2, KeyRound, Mail, Palette, ShieldCheck, Trash2, User } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/ui/checkbox";

type Profile = {
  username: string;
  age: string;
  school: string;
  gender: string;
  interests: string;
  avatarUrl: string;
  notificationsEnabled: boolean;
  notificationEmail: string;
};

const EMPTY_PROFILE: Profile = { username: "", age: "", school: "", gender: "", interests: "", avatarUrl: "", notificationsEnabled: true, notificationEmail: "" };
const PASSWORD_RULE = /^(?=.*[^A-Za-z0-9]).{8,}$/;

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [accountEmail, setAccountEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      const metadata = user?.user_metadata ?? {};
      const email = user?.email ?? "";
      setAccountEmail(email);
      setNewEmail(email);
      setProfile({
        username: String(metadata.username ?? ""),
        age: String(metadata.age ?? ""),
        school: String(metadata.school ?? ""),
        gender: String(metadata.gender ?? ""),
        interests: String(metadata.interests ?? ""),
        avatarUrl: String(metadata.avatar_url ?? metadata.picture ?? ""),
        notificationsEnabled: metadata.notifications_enabled !== false,
        notificationEmail: String(metadata.notification_email ?? email),
      });
      setLoading(false);
    }
    void loadProfile();
  }, [supabase]);

  const notify = (kind: "success" | "error", text: string) => setMessage({ kind, text });

  const saveProfile = async () => {
    if (profile.username.trim().length < 3) return notify("error", "Username must contain at least 3 characters.");
    const numericAge = profile.age ? Number(profile.age) : null;
    if (numericAge !== null && (!Number.isInteger(numericAge) || numericAge < 5 || numericAge > 120)) return notify("error", "Enter a valid age between 5 and 120.");
    if (profile.notificationsEnabled && !/^\S+@\S+\.\S+$/.test(profile.notificationEmail)) return notify("error", "Enter a valid notification email.");

    setBusy("profile");
    setMessage(null);
    const { error } = await supabase.auth.updateUser({
      data: {
        username: profile.username.trim(),
        age: numericAge,
        school: profile.school.trim(),
        gender: profile.gender.trim(),
        interests: profile.interests.trim(),
        avatar_url: profile.avatarUrl,
        notifications_enabled: profile.notificationsEnabled,
        notification_email: profile.notificationEmail.trim() || accountEmail,
        recallmate_account_completed: true,
      },
    });
    setBusy(null);
    if (error) notify("error", `Could not save your profile: ${error.message}`);
    else {
      notify("success", "Profile and notification preferences saved.");
      router.refresh();
    }
  };

  const chooseAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return notify("error", "Choose an image file.");
    if (file.size > 500_000) return notify("error", "Profile image must be smaller than 500 KB.");
    const reader = new FileReader();
    reader.onload = () => setProfile((current) => ({ ...current, avatarUrl: String(reader.result ?? "") }));
    reader.onerror = () => notify("error", "Could not read that image.");
    reader.readAsDataURL(file);
  };

  const requestEmailChange = async () => {
    const normalized = newEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) return notify("error", "Enter a valid new sign-in email.");
    if (normalized === accountEmail.toLowerCase()) return notify("error", "That is already your sign-in email.");
    setBusy("email");
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ email: normalized });
    setBusy(null);
    if (error) notify("error", `Could not request the email change: ${error.message}`);
    else notify("success", `Verification was sent to ${normalized}. Open that email to confirm the change. Check Spam or Junk if it is missing.`);
  };

  const changePassword = async () => {
    if (!PASSWORD_RULE.test(newPassword)) return notify("error", "Use at least 8 characters and include at least 1 special symbol.");
    if (newPassword !== confirmPassword) return notify("error", "The passwords do not match.");
    setBusy("password");
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(null);
    if (error) notify("error", `Could not change your password: ${error.message}`);
    else {
      setNewPassword("");
      setConfirmPassword("");
      notify("success", "Password changed successfully.");
    }
  };

  const deleteAccount = async () => {
    const confirmation = window.prompt("This permanently deletes your account and all study data. Type DELETE to continue.");
    if (confirmation !== "DELETE") return;
    setBusy("delete");
    setMessage(null);
    const response = await fetch("/api/account", { method: "DELETE" });
    if (!response.ok) {
      setBusy(null);
      notify("error", "Unable to delete the account. Please try again.");
      return;
    }
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 duration-500">
      <div>
        <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Your RecallMate account</p>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-black text-slate-950 dark:text-white"><User className="h-8 w-8 text-indigo-500" />Profile & settings</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Personalize your study experience, notifications, sign-in, and security.</p>
      </div>

      {message && (
        <div role="status" className={`flex items-start gap-2 rounded-xl border p-4 text-sm ${message.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"}`}>
          {message.kind === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}{message.text}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="Profile" className="h-full w-full object-cover" /> : <User className="absolute inset-0 m-auto h-11 w-11 text-white" />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">Profile details</h2>
            <p className="mb-3 text-sm text-slate-500">Shown in your personalized dashboard and study experience.</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              <Camera className="h-4 w-4" />Upload photo<input type="file" accept="image/*" onChange={chooseAvatar} className="sr-only" />
            </label>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username"><Input value={profile.username} onChange={(event) => setProfile({ ...profile, username: event.target.value })} placeholder="alex_studies" disabled={loading} /></Field>
          <Field label="Age"><Input type="number" min={5} max={120} value={profile.age} onChange={(event) => setProfile({ ...profile, age: event.target.value })} placeholder="20" disabled={loading} /></Field>
          <Field label="School / university"><Input value={profile.school} onChange={(event) => setProfile({ ...profile, school: event.target.value })} placeholder="Your school" disabled={loading} /></Field>
          <Field label="Gender"><Input value={profile.gender} onChange={(event) => setProfile({ ...profile, gender: event.target.value })} placeholder="Optional" disabled={loading} /></Field>
          <div className="sm:col-span-2"><Field label="Study interests"><Input value={profile.interests} onChange={(event) => setProfile({ ...profile, interests: event.target.value })} placeholder="Biology, chemistry, mathematics…" disabled={loading} /></Field></div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-lg font-bold dark:text-white"><Palette className="h-5 w-5 text-violet-500" />Appearance</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">Switch between RecallMate light and dark mode.</p>
          <ThemeToggle />
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-lg font-bold dark:text-white"><Bell className="h-5 w-5 text-amber-500" />Notifications</h2>
          <label className="my-4 flex items-center gap-3 text-sm font-semibold"><Checkbox checked={profile.notificationsEnabled} onCheckedChange={(checked) => setProfile({ ...profile, notificationsEnabled: checked === true })} />Enable study reminders</label>
          <Field label="Preferred notification email"><Input type="email" value={profile.notificationEmail} onChange={(event) => setProfile({ ...profile, notificationEmail: event.target.value })} disabled={!profile.notificationsEnabled} placeholder={accountEmail} /></Field>
          <p className="mt-2 text-xs text-slate-500">Defaults to your sign-up email. Calendar reminders also appear in the notification bell.</p>
        </div>
      </section>

      <div className="flex justify-end"><Button onClick={saveProfile} disabled={loading || busy !== null} className="rounded-xl bg-indigo-600 px-6 text-white hover:bg-indigo-700">{busy === "profile" ? "Saving…" : "Save profile & preferences"}</Button></div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-xl font-bold dark:text-white"><ShieldCheck className="h-6 w-6 text-emerald-500" />Sign-in & security</h2>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 font-bold dark:text-white"><Mail className="h-4 w-4" />Change sign-in email</h3>
            <p className="text-xs text-slate-500">Current email: {accountEmail}</p>
            <Input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="new@email.com" />
            <Button variant="outline" onClick={requestEmailChange} disabled={busy !== null}>{busy === "email" ? "Sending…" : "Send verification to new email"}</Button>
          </div>
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 font-bold dark:text-white"><KeyRound className="h-4 w-4" />Change password</h3>
            <p className="text-xs text-slate-500">Use 8+ characters with at least one special symbol.</p>
            <PasswordInput aria-label="New password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New strong password" />
            <PasswordInput aria-label="Confirm new password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" />
            <Button variant="outline" onClick={changePassword} disabled={busy !== null}>{busy === "password" ? "Changing…" : "Change password"}</Button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-red-200 bg-red-50 p-6 dark:border-red-900/60 dark:bg-red-950/20">
        <h2 className="flex items-center gap-2 text-xl font-bold text-red-700 dark:text-red-400"><AlertCircle className="h-6 w-6" />Danger zone</h2>
        <p className="mb-4 mt-2 text-sm text-red-600 dark:text-red-300">Deleting your account permanently removes the account and all associated RecallMate data.</p>
        <Button onClick={deleteAccount} disabled={busy !== null} variant="destructive" className="bg-red-600 text-white hover:bg-red-700"><Trash2 className="mr-2 h-4 w-4" />{busy === "delete" ? "Deleting…" : "Delete account"}</Button>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300"><span className="mb-1.5 block">{label}</span>{children}</label>;
}
