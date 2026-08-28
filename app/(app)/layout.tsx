import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { SessionGuard } from "@/components/auth/SessionGuard";
import OmniChatDrawer from "@/components/OmniChatDrawer";
import InactivityPreventer from "@/components/InactivityPreventer";
import { getUserBootstrap } from "@/lib/queries/bootstrap";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // getClaims() is the Supabase-recommended method for protecting pages and data
  // in SSR apps. It validates the JWT locally (signature + expiry) rather than
  // reading an unverified cookie or making an unnecessary network round-trip.
  const { data, error } = await supabase.auth.getClaims();

  if (!data?.claims || error) {
    redirect("/login?next=/dashboard");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const username = user?.user_metadata?.username;
  const accountCompleted = user?.user_metadata?.recallmate_account_completed === true;
  if (!username || typeof username !== "string" || username.trim().length < 3 || !accountCompleted) {
    redirect("/onboarding?next=/dashboard");
  }

  const userId = data.claims.sub as string;

  // Bootstrap loads after authentication is confirmed.
  // Scope: identity + credits + entitlements only.
  const bootstrap = await getUserBootstrap(userId);

  return (
    <AppShell bootstrap={bootstrap}>
      <SessionGuard />
      <InactivityPreventer />
      {children}
      <OmniChatDrawer />
    </AppShell>
  );
}
