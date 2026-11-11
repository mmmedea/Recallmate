"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertCircle, Bell, Camera, CheckCircle2, LogOut, Mail, MapPin, Palette, Plug, ShieldCheck, Trash2, User } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { getPublicBuildLabel } from "@/lib/build-info";
import { DiamondLoader } from "@/components/DiamondLoader";

type Profile = {
  username: string;
  age: string;
  school: string;
  gender: string;
  interests: string;
  avatarUrl: string;
  notificationsEnabled: boolean;
  notificationEmail: string;
  secondaryEmail: string;
  street: string;
  city: string;
  region: string;
  country: string;
  addressType: "home" | "work";
};

const EMPTY_PROFILE: Profile = { username: "", age: "", school: "", gender: "", interests: "", avatarUrl: "", notificationsEnabled: true, notificationEmail: "", secondaryEmail: "", street: "", city: "", region: "", country: "", addressType: "home" };
export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [accountEmail, setAccountEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const buildLabel = getPublicBuildLabel();

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
        secondaryEmail: String(metadata.secondary_email ?? ""),
        street: String(metadata.address?.street ?? ""),
        city: String(metadata.address?.city ?? ""),
        region: String(metadata.address?.region ?? ""),
        country: String(metadata.address?.country ?? ""),
        addressType: metadata.address?.type === "work" ? "work" : "home",
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
        secondary_email: profile.secondaryEmail.trim(),
        address: { street: profile.street.trim(), city: profile.city.trim(), region: profile.region.trim(), country: profile.country.trim(), type: profile.addressType },
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

  const signOutOtherSessions = async () => {
    setBusy("sessions");
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setBusy(null);
    if (error) notify("error", `Could not sign out other sessions: ${error.message}`);
    else notify("success", "Other RecallMate sessions have been signed out.");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 duration-500">
      <div>
        <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Your RecallMate account</p>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-black text-slate-950 dark:text-white"><User className="h-8 w-8 text-indigo-500" />Profile & settings</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Personalize your study experience, notifications, sign-in, and security.</p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          <DiamondLoader variant="inline" label="Loading profile" />
          <span>Loading your profile…</span>
        </div>
      )}

      {message && (
        <div role="status" className={`flex items-start gap-2 rounded-xl border p-4 text-sm ${message.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"}`}>
          {message.kind === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}{message.text}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg">
            {profile.avatarUrl ? (
              <Image src={profile.avatarUrl} alt="Profile" fill sizes="96px" unoptimized className="object-cover" />
            ) : (
              <User className="absolute inset-0 m-auto h-11 w-11 text-white" />
            )}
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

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-xl font-bold dark:text-white"><MapPin className="h-6 w-6 text-indigo-500" />Account identity & optional address</h2>
        <p className="mt-1 text-sm text-slate-500">A secondary contact and address are optional. They are stored with your protected account metadata and are never shown publicly.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Secondary email"><Input type="email" value={profile.secondaryEmail} onChange={(event) => setProfile({ ...profile, secondaryEmail: event.target.value })} placeholder="Optional recovery contact" /></Field>
          <Field label="Address type"><select value={profile.addressType} onChange={(event) => setProfile({ ...profile, addressType: event.target.value as "home" | "work" })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="home">Home</option><option value="work">Work</option></select></Field>
          <Field label="Street number & street"><Input value={profile.street} onChange={(event) => setProfile({ ...profile, street: event.target.value })} placeholder="Optional" /></Field>
          <Field label="City"><Input value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })} placeholder="Optional" /></Field>
          <Field label="County / province"><Input value={profile.region} onChange={(event) => setProfile({ ...profile, region: event.target.value })} placeholder="Optional" /></Field>
          <Field label="Country"><Input value={profile.country} onChange={(event) => setProfile({ ...profile, country: event.target.value })} placeholder="Optional" /></Field>
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

      <div className="flex justify-end"><Button onClick={saveProfile} disabled={loading || busy !== null} className="rounded-xl bg-indigo-600 px-6 text-white hover:bg-indigo-700">{busy === "profile" ? <span className="inline-flex items-center gap-2"><DiamondLoader variant="inline" label="Saving profile" />Saving…</span> : "Save profile & preferences"}</Button></div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-xl font-bold dark:text-white"><ShieldCheck className="h-6 w-6 text-emerald-500" />Sign-in & security</h2>
        <div className="mt-5 grid gap-6">
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 font-bold dark:text-white"><Mail className="h-4 w-4" />Change sign-in email</h3>
            <p className="text-xs text-slate-500">Current email: {accountEmail}</p>
            <Input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="new@email.com" />
            <Button variant="outline" onClick={requestEmailChange} disabled={busy !== null}>{busy === "email" ? <span className="inline-flex items-center gap-2"><DiamondLoader variant="inline" label="Sending verification email" />Sending…</span> : "Send verification to new email"}</Button>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><h3 className="flex items-center gap-2 font-bold dark:text-white"><LogOut className="h-4 w-4" />Active session safety</h3><p className="my-2 text-sm text-slate-500">If you used RecallMate on a shared or lost device, immediately revoke every other active session.</p><Button variant="outline" onClick={signOutOtherSessions} disabled={busy !== null}>{busy === "sessions" ? <span className="inline-flex items-center gap-2"><DiamondLoader variant="inline" label="Signing out of other sessions" />Signing out…</span> : "Sign out of other sessions"}</Button></div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="flex items-center gap-2 text-xl font-bold dark:text-white"><Plug className="h-6 w-6 text-violet-500" />Workspace & integrations</h2><p className="mt-2 text-sm text-slate-500">Calendar connections use explicit consent. Open Calendar to add an event directly to Google Calendar or export your full year as an ICS file.</p><Button variant="outline" className="mt-4" onClick={() => router.push('/calendar')}>Open calendar integrations</Button></section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-bold dark:text-white">About RecallMate</h2>
        <p className="mt-2 text-sm text-slate-500">Use this marker to confirm the browser is running the latest deployed build.</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
            <dt className="font-semibold text-slate-500 dark:text-slate-400">Production build</dt>
            <dd className="mt-1 font-mono text-base font-bold text-slate-950 dark:text-white">{buildLabel}</dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
            <dt className="font-semibold text-slate-500 dark:text-slate-400">Canonical site</dt>
            <dd className="mt-1 font-semibold text-slate-950 dark:text-white">recallmate-ai.vercel.app</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-3xl border border-red-200 bg-red-50 p-6 dark:border-red-900/60 dark:bg-red-950/20">
        <h2 className="flex items-center gap-2 text-xl font-bold text-red-700 dark:text-red-400"><AlertCircle className="h-6 w-6" />Danger zone</h2>
        <p className="mb-4 mt-2 text-sm text-red-600 dark:text-red-300">Deleting your account permanently removes the account and all associated RecallMate data.</p>
        <Button onClick={deleteAccount} disabled={busy !== null} variant="destructive" className="bg-red-600 text-white hover:bg-red-700">{busy === "delete" ? <span className="inline-flex items-center gap-2"><DiamondLoader variant="inline" label="Deleting account" />Deleting…</span> : <><Trash2 className="mr-2 h-4 w-4" />Delete account</>}</Button>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300"><span className="mb-1.5 block">{label}</span>{children}</label>;
}
