import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { getDashboardData } from "@/lib/dashboard/get-dashboard-data";

export const metadata = {
  title: "Dashboard | RecallMate",
  description: "Your RecallMate study command center.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const name =
    session.user.user_metadata?.username ||
    session.user.user_metadata?.full_name ||
    session.user.email?.split("@")[0] ||
    "Student";

  const data = await getDashboardData(session.user.id);

  return <DashboardHome name={name} data={data} />;
}
