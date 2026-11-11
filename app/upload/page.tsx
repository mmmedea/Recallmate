"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import FileUploader from "@/components/FileUploader";

export default function UploadPage() {
  const [status, setStatus] = useState<"idle" | "extracting" | "generating">("idle");
  const [error, setError] = useState("");
  const router = useRouter();

  const isMediaFile = (file: File) =>
    file.type.startsWith("video/") || file.type.startsWith("audio/");

  const handleFile = async (file: File) => {
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);

      setStatus("extracting");
      const endpoint = isMediaFile(file) ? "/api/transcribe" : "/api/extract-text";
      const extractRes = await fetch(endpoint, { method: "POST", body: form });
      const extractData = await extractRes.json();

      if (!extractRes.ok) {
        throw new Error(extractData.error || "Failed to read file.");
      }

      setStatus("generating");
      const genRes = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extractData.text, fileName: file.name })
      });
      const genData = await genRes.json();

      if (!genRes.ok) {
        throw new Error(genData.error || "Failed to generate study content.");
      }

      sessionStorage.setItem("recallmate-content", JSON.stringify(genData));
      router.push("/quiz");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    }
  };

  return (
    <div className="mx-auto max-w-xl py-10">
      <h1 className="text-2xl font-bold text-gray-900">Upload your material</h1>
      <p className="mt-1 text-sm text-gray-500">
        We'll extract the content and generate notes plus active recall questions.
      </p>

      <div className="mt-6">
        <FileUploader onFileSelected={handleFile} disabled={status !== "idle"} />
      </div>

      {status !== "idle" && (
        <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {status === "extracting" ? "Reading your file..." : "Generating notes and questions..."}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}
    </div>
  );
}