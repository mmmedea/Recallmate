import Link from "next/link";
import { Brain, Heart, UploadCloud, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div>
      <section className="flex flex-col items-center py-16 text-center">
        <span className="mb-4 rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-600">
          Notes + Active Recall, combined
        </span>
        <h1 className="max-w-2xl text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
          Turn any file into a study session your brain will remember
        </h1>
        <p className="mt-4 max-w-xl text-gray-500">
          Upload a PDF, document, or a video lecture. AI generates a summary, notes,
          and easy/medium/hard active recall questions — powered by a hearts system
          that keeps you focused.
        </p>
        <Link
          href="/upload"
          className="mt-8 flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:opacity-90"
        >
          <UploadCloud className="h-4 w-4" /> Upload a file
        </Link>
      </section>

      <section className="grid gap-6 py-10 sm:grid-cols-3">
        <FeatureCard
          icon={<Sparkles className="h-5 w-5 text-indigo-500" />}
          title="AI-generated notes"
          desc="Summaries and bullet notes pulled straight from your file, including video transcripts."
        />
        <FeatureCard
          icon={<Brain className="h-5 w-5 text-indigo-500" />}
          title="3-tier active recall"
          desc="Easy, medium, and hard short-answer questions generated from your own material."
        />
        <FeatureCard
          icon={<Heart className="h-5 w-5 text-rose-500" />}
          title="15 hearts, real stakes"
          desc="Lose a heart on a missed question, regenerate one every 30 minutes, or go premium for unlimited."
        />
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50">
        {icon}
      </div>
      <h3 className="font-bold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{desc}</p>
    </div>
  );
}