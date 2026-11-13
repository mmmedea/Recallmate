"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/ui/checkbox";

type Profile = {
  username: string;
  age: string;
  school: string;
  interests: string;
  avatarUrl: string;
  notificationsEnabled: boolean;
  notificationEmail: string;
};

type SettingsTab = "profile" | "security" | "workspace";

const EMPTY_PROFILE: Profile = {
  username: "",
  age: "",
  school: "",
  interests: "",
  avatarUrl: "",
  notificationsEnabled: true,
  notificationEmail: "",
};
const PASSWORD_RULE = /^(?=.*[^A-Za-z0-9]).{8,}$/;

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
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

  const signOutOtherSessions = async () => {
    setBusy("sessions");
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setBusy(null);
    if (error) notify("error", `Could not sign out other sessions: ${error.message}`);
    else notify("success", "Other RecallMate sessions have been signed out.");
  };

  const tabs: { id: SettingsTab; label: string; description: string }[] = [
    { id: "profile", label: "Profile & preferences", description: "Personal details and appearance" },
    { id: "security", label: "Security & authentication", description: "Sign-in, sessions and account safety" },
    { id: "workspace", label: "Workspace", description: "Calendar and integrations" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-7 px-4 py-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 duration-500 sm:px-6">
      <header className="space-y-2">
        <p className="font-pixelify text-[10px] uppercase tracking-[0.24em] text-[#c4a7ff]">YOUR ACCOUNT</p>
        <h1 className="font-fredoka text-3xl font-semibold tracking-tight text-white sm:text-4xl">Settings & Profile</h1>
        <p className="max-w-2xl font-quicksand text-sm text-white/55">Manage your learning profile, account security, and workspace preferences in one place.</p>
      </header>

      <div role="tablist" aria-label="Settings sections" className="grid gap-2 rounded-2xl border border-white/10 bg-[#111019] p-2 sm:grid-cols-3">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => { setActiveTab(tab.id); setMessage(null); }}
            className={`rounded-xl border px-4 py-3 text-left transition ${activeTab === tab.id ? "border-[#a78bfa]/40 bg-[#a78bfa]/15 shadow-[0_0_24px_rgba(167,139,250,.08)]" : "border-transparent hover:bg-white/[0.04]"}`}>
            <span className={`block font-nunito text-sm font-extrabold ${activeTab === tab.id ? "text-[#e2d5ff]" : "text-white/70"}`}>{tab.label}</span>
            <span className="mt-1 block font-quicksand text-[11px] text-white/40">{tab.description}</span>
          </button>
        ))}
      </div>

      {message && (
        <div role="status" className={`rounded-xl border px-4 py-3 font-nunito text-sm ${message.kind === "success" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-rose-400/20 bg-rose-400/10 text-rose-200"}`}>
          {message.text}
        </div>
      )}

      {activeTab === "profile" && (
        <div role="tabpanel" className="space-y-5">
          <section className="rounded-3xl border border-white/10 bg-[#111019] p-6 shadow-xl shadow-black/10">
            <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative h-20 w-20 overflow-hidden rounded-3xl border border-[#a78bfa]/25 bg-gradient-to-br from-[#a78bfa]/30 to-[#f43f5e]/20">
                {profile.avatarUrl ? <img src={profile.avatarUrl} alt="Profile" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center font-fredoka text-2xl font-bold text-[#e2d5ff]">{profile.username.trim().slice(0, 1).toUpperCase() || "R"}</span>}
              </div>
              <div>
                <h2 className="font-fredoka text-xl font-semibold text-white">Your learning profile</h2>
                <p className="mb-3 mt-1 font-quicksand text-sm text-white/45">These details help personalize study suggestions and AI-generated materials.</p>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#a78bfa]/25 bg-[#a78bfa]/10 px-3 py-2 font-nunito text-xs font-extrabold text-[#d9c8ff] transition hover:bg-[#a78bfa]/20">
                  Upload profile photo<input type="file" accept="image/*" onChange={chooseAvatar} className="sr-only" />
                </label>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Username"><Input value={profile.username} onChange={(event) => setProfile({ ...profile, username: event.target.value })} placeholder="alex_studies" disabled={loading} /></Field>
              <Field label="Age"><Input type="number" min={5} max={120} value={profile.age} onChange={(event) => setProfile({ ...profile, age: event.target.value })} placeholder="20" disabled={loading} /></Field>
              <div className="sm:col-span-2"><Field label="School / university"><Input value={profile.school} onChange={(event) => setProfile({ ...profile, school: event.target.value })} placeholder="Your school or university" disabled={loading} /></Field></div>
              <div className="sm:col-span-2"><Field label="Study interests"><Input value={profile.interests} onChange={(event) => setProfile({ ...profile, interests: event.target.value })} placeholder="Biology, programming, mathematics…" disabled={loading} /></Field></div>
            </div>
          </section>

          <section className="grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-[#111019] p-6">
              <h2 className="font-fredoka text-lg font-semibold text-white">Notifications</h2>
              <label className="my-4 flex items-center gap-3 font-nunito text-sm font-bold text-white/80"><Checkbox checked={profile.notificationsEnabled} onCheckedChange={(checked) => setProfile({ ...profile, notificationsEnabled: checked === true })} />Enable study reminders</label>
              <Field label="Preferred notification email"><Input type="email" value={profile.notificationEmail} onChange={(event) => setProfile({ ...profile, notificationEmail: event.target.value })} disabled={!profile.notificationsEnabled} placeholder={accountEmail} /></Field>
              <p className="mt-2 font-quicksand text-xs text-white/40">Defaults to your sign-up email. Calendar reminders also appear in the notification bell.</p>
            </div>
          </section>

          <div className="flex justify-end"><Button onClick={saveProfile} disabled={loading || busy !== null} className="rounded-xl bg-gradient-to-r from-[#a78bfa] to-[#c4a7ff] px-6 font-nunito font-black text-[#170f23] hover:brightness-110">{busy === "profile" ? "Saving…" : "Save profile & preferences"}</Button></div>
        </div>
      )}

      {activeTab === "security" && (
        <div role="tabpanel" className="space-y-5">
          <section className="rounded-3xl border border-white/10 bg-[#111019] p-6">
            <div className="mb-5">
              <p className="font-pixelify text-[10px] uppercase tracking-[0.18em] text-[#c4a7ff]">ACCOUNT ACCESS</p>
              <h2 className="mt-1 font-fredoka text-2xl font-semibold text-white">Security & Authentication</h2>
              <p className="mt-1 font-quicksand text-sm text-white/45">Manage your sign-in email, password, and active sessions.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <h3 className="font-fredoka text-lg font-semibold text-white">Change sign-in email</h3>
                <p className="font-quicksand text-xs text-white/45">Current email: {accountEmail}</p>
                <Field label="New sign-in email"><Input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="new@email.com" /></Field>
                <Button variant="outline" onClick={requestEmailChange} disabled={busy !== null} className="border-[#a78bfa]/30 font-nunito text-[#e2d5ff] hover:bg-[#a78bfa]/10">{busy === "email" ? "Sending…" : "Send verification email"}</Button>
              </div>
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <h3 className="font-fredoka text-lg font-semibold text-white">Change password</h3>
                <p className="font-quicksand text-xs text-white/45">Use at least 8 characters and include one special symbol.</p>
                <PasswordInput aria-label="New password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="border-white/10 bg-[#0b0a11] text-white placeholder:text-white/30" placeholder="New strong password" />
                <PasswordInput aria-label="Confirm new password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="border-white/10 bg-[#0b0a11] text-white placeholder:text-white/30" placeholder="Confirm password" />
                <Button variant="outline" onClick={changePassword} disabled={busy !== null} className="border-[#a78bfa]/30 font-nunito text-[#e2d5ff] hover:bg-[#a78bfa]/10">{busy === "password" ? "Changing…" : "Change password"}</Button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#111019] p-6">
            <h3 className="font-fredoka text-lg font-semibold text-white">Active session safety</h3>
            <p className="my-2 max-w-2xl font-quicksand text-sm text-white/45">If you used RecallMate on a shared or lost device, revoke every other active session. Your current session stays signed in.</p>
            <Button variant="outline" onClick={signOutOtherSessions} disabled={busy !== null} className="border-white/15 font-nunito text-white/80 hover:bg-white/[0.05]">{busy === "sessions" ? "Signing out…" : "Sign out of other sessions"}</Button>
          </section>

          <section className="rounded-3xl border border-rose-500/25 bg-rose-500/[0.06] p-6">
            <p className="font-pixelify text-[10px] uppercase tracking-[0.18em] text-rose-300">IRREVERSIBLE ACTION</p>
            <h3 className="mt-1 font-fredoka text-xl font-semibold text-rose-200">Danger zone</h3>
            <p className="mb-4 mt-2 max-w-2xl font-quicksand text-sm text-rose-200/65">Deleting your account permanently removes your account and all associated RecallMate data.</p>
            <Button onClick={deleteAccount} disabled={busy !== null} variant="destructive" className="bg-rose-600 font-nunito font-extrabold text-white hover:bg-rose-700">{busy === "delete" ? "Deleting…" : "Delete account"}</Button>
          </section>
        </div>
      )}

      {activeTab === "workspace" && (
        <section role="tabpanel" className="rounded-3xl border border-white/10 bg-[#111019] p-6">
          <p className="font-pixelify text-[10px] uppercase tracking-[0.18em] text-[#c4a7ff]">CONNECTED TO YOUR STUDY FLOW</p>
          <h2 className="mt-1 font-fredoka text-2xl font-semibold text-white">Workspace & integrations</h2>
          <p className="mt-2 max-w-2xl font-quicksand text-sm leading-6 text-white/50">Calendar connections use explicit consent. Open Schedule to add events to Google Calendar or export your full year as an ICS file.</p>
          <Button variant="outline" className="mt-5 border-[#a78bfa]/30 font-nunito text-[#e2d5ff] hover:bg-[#a78bfa]/10" onClick={() => router.push("/calendar")}>Open calendar integrations →</Button>
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block font-nunito text-sm font-semibold text-white/75"><span className="mb-1.5 block">{label}</span>{children}</label>;
}
