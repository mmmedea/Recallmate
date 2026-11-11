"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteDocument } from "@/app/actions/document-actions";
import { DiamondLoader } from "@/components/DiamondLoader";

export function DeleteDocumentButton({ documentId, filename }: { documentId: string; filename: string }) {
  const [isPending, startTransition] = useTransition();

  function requestDelete() {
    const confirmed = window.confirm(
      `Delete "${filename}"?\n\nThis will remove the document from your library and delete generated study content tied to it where the database is configured to cascade. This cannot be undone.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      await deleteDocument(documentId);
    });
  }

  return (
    <button
      type="button"
      aria-label={isPending ? `Deleting ${filename}` : `Delete ${filename}`}
      aria-busy={isPending}
      title="Delete from library"
      disabled={isPending}
      onClick={requestDelete}
      className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-red-950/30 dark:hover:text-red-300"
    >
      {isPending ? (
        <DiamondLoader variant="inline" label={`Deleting ${filename}`} />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );
}
