"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, User, Trash2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const [profile, setProfile] = useState({ username: "", age: "", school: "", gender: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata) {
        setProfile({
          username: user.user_metadata.username || "",
          age: user.user_metadata.age || "",
          school: user.user_metadata.school || "",
          gender: user.user_metadata.gender || "",
        });
      }
      setLoading(false);
    }
    loadProfile();
  }, [supabase]);

  const saveProfile = async () => {
    setSaving(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({
      data: {
        username: profile.username.trim(),
        age: profile.age,
        school: profile.school,
        gender: profile.gender
      }
    });
    
    setSaving(false);
    if (error) {
      setMessage("Error saving profile: " + error.message);
    } else {
      setMessage("Profile saved successfully!");
    }
  };

  const deleteAccount = async () => {
    if (!confirm("Are you absolutely sure? This will delete your account and all data permanently.")) return;
    
    const response = await fetch("/api/account", { method: "DELETE" });
    if (!response.ok) {
      setMessage("Unable to delete account. Please try again or contact support.");
      return;
    }
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="mx-auto max-w-2xl py-12 px-4 motion-safe:animate-in motion-safe:fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <User className="w-8 h-8 text-indigo-500" /> Profile Settings
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Manage your personal information and account settings.</p>
      </div>

      <div className="space-y-6 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
            <Input type="text" placeholder="e.g. alex_studies" value={profile.username} onChange={(e) => setProfile({...profile, username: e.target.value})} disabled={loading} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Age</label>
            <Input 
              type="number" 
              placeholder="e.g. 20" 
              value={profile.age} 
              onChange={(e) => setProfile({...profile, age: e.target.value})} 
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">School / University</label>
            <Input 
              type="text" 
              placeholder="e.g. Harvard University" 
              value={profile.school} 
              onChange={(e) => setProfile({...profile, school: e.target.value})} 
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Gender</label>
            <Input 
              type="text" 
              placeholder="e.g. Female, Male, Non-binary" 
              value={profile.gender} 
              onChange={(e) => setProfile({...profile, gender: e.target.value})} 
              disabled={loading}
            />
          </div>
        </div>

        {message && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-lg">
            <CheckCircle2 className="w-4 h-4" /> {message}
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <Button onClick={saveProfile} disabled={saving || loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </div>

      <div className="mt-8 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-900/50 p-6 rounded-2xl">
        <h2 className="text-xl font-bold text-red-700 dark:text-red-500 flex items-center gap-2">
          <AlertCircle className="w-6 h-6" /> Danger Zone
        </h2>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400 mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <Button onClick={deleteAccount} variant="destructive" className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2">
          <Trash2 className="w-4 h-4" /> Delete Account
        </Button>
      </div>
    </div>
  );
}
