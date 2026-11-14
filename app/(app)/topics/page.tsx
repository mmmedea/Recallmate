import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { computeDocumentLifecycleSummary } from "@/app/actions/document-lifecycle";
import LibrarySearch from "@/components/library/LibrarySearch";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: documents, error } = await supabase
    .from("documents")
    .select(`
      id, filename, created_at, status, error_message,
      ai_jobs ( id, operation, status, error_message ),
      notes ( id ),
      questions ( id ),
      conversations ( updated_at )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const items = (documents || []).map((doc: any) =>
    computeDocumentLifecycleSummary(
      doc,
      doc.ai_jobs || [],
      (doc.notes as any[])?.[0]?.id || null,
      (doc.questions as any[])?.[0]?.id || null,
      (doc.conversations as any[])?.[0]?.updated_at || null
    )
  );

  return <LibrarySearch items={items} loadError={error ? "Your library could not be loaded right now. Refresh the page to try again." : null} />;
}
