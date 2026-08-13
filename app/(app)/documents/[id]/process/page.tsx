import { getDocumentLifecycle } from "@/app/actions/document-actions";
import { redirect } from "next/navigation";
import WorkspaceClient from "./WorkspaceClient";
import { AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProcessingWorkspacePage({ params }: { params: { id: string } }) {
  const { data: summary, success, error, status } = await getDocumentLifecycle(params.id);

  if (!success || !summary) {
    if (status === 404) {
      redirect("/dashboard"); // Unauthorized or not found
    }
    return (
      <div className="mx-auto max-w-4xl py-12 px-4 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Failed to load processing state</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{error || "An unexpected error occurred"}</p>
      </div>
    );
  }

  // If extraction is completed, notes are completed and output ready, quiz is completed and output ready,
  // we could potentially auto-redirect to Study Hub.
  // But maybe the user just wants to see the workspace. We will let the client component decide or provide a button.

  return <WorkspaceClient initialSummary={summary} />;
}
