import React from "react";
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import ReviewClient from "./review-client";

export default async function DocumentReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please sign in to review.</div>;
  }

  // Verify document access
  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, filename, status")
    .eq("id", id)
    .single();

  if (error || !doc) {
    return notFound();
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Reviewing: {doc.filename}</h1>
      <ReviewClient documentId={doc.id} />
    </div>
  );
}
