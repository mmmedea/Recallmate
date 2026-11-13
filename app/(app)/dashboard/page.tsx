import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getRecentDocuments } from "@/app/actions/document-actions";
import { DocumentLifecycleSummary } from "@/app/actions/document-lifecycle";
import EconomyDashboard from "@/components/dashboard/EconomyDashboard";

export const metadata = {
  title: "Dashboard | RecallMate",
  description: "Your focused workspace for study materials and active recall.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const name = session.user.user_metadata?.username
    || session.user.user_metadata?.full_name
    || session.user.email?.split("@")[0]
    || "Student";

  const now = new Date();
  const manilaNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const dayStart = new Date(Date.UTC(manilaNow.getUTCFullYear(), manilaNow.getUTCMonth(), manilaNow.getUTCDate()) - 8 * 60 * 60 * 1000);
  const nextDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [
    { data: documents, success },
    { count: materialCount, error: materialCountError },
    { count: dueTodayCount, error: dueTodayError },
    { count: upcomingCount, error: upcomingError },
  ] = await Promise.all([
    getRecentDocuments(),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("user_id", session.user.id),
    supabase.from("learning_items").select("id", { count: "exact", head: true }).eq("user_id", session.user.id).gte("due_at", dayStart.toISOString()).lt("due_at", nextDay.toISOString()),
    supabase.from("learning_items").select("id", { count: "exact", head: true }).eq("user_id", session.user.id).gte("due_at", nextDay.toISOString()),
  ]);

  const recent = success && documents ? documents : [];
  const latest = [...recent].sort((a, b) => {
    const aLastActive = new Date(a.chat.lastDiscussedAt || a.document.createdAt).getTime();
    const bLastActive = new Date(b.chat.lastDiscussedAt || b.document.createdAt).getTime();
    return bLastActive - aLastActive;
  })[0];
  const continueHref = latest
    ? latest.quiz.status === "ready"
      ? `/quiz/${latest.document.id}`
      : latest.notes.status === "ready"
        ? `/notes/${latest.document.id}`
        : `/documents/${latest.document.id}${latest.extraction.status === "completed" ? "" : "/process"}`
    : "/upload";

  return (
    <div className="dashboard-canvas mx-auto max-w-7xl space-y-8 px-4 py-7 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="font-pixelify text-xs uppercase tracking-[0.24em] text-[#bda5ff]">YOUR STUDY SPACE</p>
          <h1 className="font-fredoka text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Welcome back, <span className="bg-gradient-to-r from-[#c6a8ff] via-[#e7d8ff] to-[#ff657e] bg-clip-text text-transparent">{name}</span>
          </h1>
          <p className="font-quicksand text-sm text-white/60 sm:text-base">A little progress today makes a big difference tomorrow.</p>
        </div>
        <Link href="/upload" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#a78bfa]/40 bg-[#a78bfa]/10 px-5 py-3 font-nunito text-sm font-extrabold text-[#d9c8ff] transition hover:-translate-y-0.5 hover:border-[#c4b5fd] hover:bg-[#a78bfa]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4b5fd]">
          + Add material
        </Link>
      </header>

      <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[#111019] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full bg-[#8b5cf6]/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 -z-10 h-64 w-64 rounded-full bg-[#f43f5e]/10 blur-3xl" />
        <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full border border-[#b79aff]/25 bg-[#a78bfa]/10 px-3 py-1 font-pixelify text-[11px] uppercase tracking-[0.16em] text-[#cbb8ff]">PICK UP WHERE YOU LEFT OFF</span>
            <h2 className="mt-4 font-fredoka text-3xl font-semibold leading-tight text-white sm:text-4xl">Continue studying.</h2>
            <p className="mt-3 max-w-xl font-quicksand text-sm leading-6 text-white/60 sm:text-base">
              {latest ? "Jump straight back into your most recent study material. Your next focused session starts here." : "Upload your first material and turn it into a focused study session with notes and practice questions."}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href={continueHref} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#a78bfa] to-[#8b5cf6] px-6 py-3 font-nunito text-sm font-extrabold text-[#100b1b] shadow-lg shadow-[#8b5cf6]/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#8b5cf6]/30">
                {latest ? "Resume studying  →" : "Create your first workspace  →"}
              </Link>
              {latest && <span className="max-w-[240px] truncate font-nunito text-xs text-white/50">{latest.document.filename}</span>}
            </div>
          </div>
          <div className="hidden min-w-36 items-center justify-center lg:flex">
            <div className="relative flex h-36 w-36 items-center justify-center rounded-[2rem] border border-[#c4b5fd]/20 bg-gradient-to-br from-[#a78bfa]/20 to-[#f43f5e]/10 shadow-[0_0_70px_rgba(167,139,250,0.16)]">
              <span className="font-pixelify text-5xl text-[#d9c8ff]">01</span>
              <span className="absolute -right-3 -top-3 rounded-full border border-[#fb7185]/30 bg-[#f43f5e]/15 px-3 py-1 font-pixelify text-[10px] text-[#ff9aaa]">FOCUS</span>
              <span className="absolute -bottom-3 -left-3 rounded-full border border-[#c4b5fd]/30 bg-[#a78bfa]/15 px-3 py-1 font-pixelify text-[10px] text-[#d9c8ff]">RECALL</span>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-white/10 pt-4">
          <EconomyDashboard />
        </div>
      </section>

      <section aria-label="Study overview">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="font-pixelify text-[10px] uppercase tracking-[0.2em] text-[#a78bfa]">AT A GLANCE</p>
            <h2 className="mt-1 font-fredoka text-2xl font-semibold text-white">Your study overview</h2>
          </div>
          <Link href="/progress" className="font-nunito text-xs font-bold text-[#c4b5fd] transition hover:text-white">View progress →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Due today" value={dueTodayError ? "—" : String(dueTodayCount ?? 0)} note="Scheduled for today" tone="red" />
          <MetricCard label="Upcoming reviews" value={upcomingError ? "—" : String(upcomingCount ?? 0)} note="Scheduled after today" tone="purple" />
          <MetricCard label="Total materials" value={materialCountError ? "—" : String(materialCount ?? 0)} note="Uploaded study files" tone="light" />
        </div>
      </section>

      <section aria-label="Recent materials">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="font-pixelify text-[10px] uppercase tracking-[0.2em] text-[#a78bfa]">RECENT ACTIVITY</p>
            <h2 className="mt-1 font-fredoka text-2xl font-semibold text-white">Recent materials</h2>
            <p className="mt-1 font-quicksand text-sm text-white/50">Your latest uploads, ready when you are.</p>
          </div>
          <Link href="/topics" className="font-nunito text-xs font-bold text-[#c4b5fd] transition hover:text-white">Open library →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-[#a78bfa]/30 bg-[#111019] px-6 py-14 text-center">
            <p className="font-fredoka text-xl text-white">Your library starts here.</p>
            <p className="mx-auto mt-2 max-w-md font-quicksand text-sm leading-6 text-white/55">Add a PDF or document and RecallMate will help you turn it into study-ready content.</p>
            <Link href="/upload" className="mt-5 inline-flex rounded-xl bg-[#a78bfa]/15 px-5 py-2.5 font-nunito text-sm font-extrabold text-[#d9c8ff] transition hover:bg-[#a78bfa]/25">Upload a material</Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recent.slice(0, 6).map((doc) => <DocumentCard key={doc.document.id} doc={doc} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: "red" | "purple" | "light" }) {
  const accents = {
    red: "from-[#fb7185]/15 to-transparent border-[#fb7185]/20 text-[#ff9aaa]",
    purple: "from-[#a78bfa]/15 to-transparent border-[#a78bfa]/20 text-[#d4c2ff]",
    light: "from-white/10 to-transparent border-white/10 text-white",
  };
  return (
    <article className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${accents[tone]} bg-[#111019] p-5 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-xl hover:shadow-black/20`}>
      <p className="font-nunito text-sm font-bold text-white/65">{label}</p>
      <p className="mt-4 font-fredoka text-4xl font-semibold text-white">{value}</p>
      <p className="mt-1 font-quicksand text-xs text-white/40">{note}</p>
    </article>
  );
}

function DocumentCard({ doc }: { doc: DocumentLifecycleSummary }) {
  const { document, notes, quiz } = doc;
  const isFailed = doc.extraction.status === "failed" || doc.extraction.status === "cancelled";
  const isReady = doc.extraction.status === "completed";
  const isProcessing = ["uploaded", "queued", "extracting", "analyzing", "generating"].includes(doc.extraction.status || "");
  const needsAttention = notes?.status === "inconsistent" || quiz?.status === "inconsistent" || notes?.status === "failed" || quiz?.status === "failed";
  const status = isFailed ? "Needs attention" : needsAttention ? "Check outputs" : isProcessing ? "Processing" : isReady ? "Ready to study" : "Uploaded";
  const statusTone = isFailed || needsAttention ? "text-[#ff899d] bg-[#fb7185]/10 border-[#fb7185]/20" : isProcessing ? "text-[#d7c5ff] bg-[#a78bfa]/10 border-[#a78bfa]/20" : "text-[#b9f5d0] bg-emerald-400/10 border-emerald-300/20";
  return (
    <Link href={`/documents/${document.id}${isReady ? "" : "/process"}`} className="group rounded-2xl border border-white/10 bg-[#111019] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#a78bfa]/40 hover:shadow-xl hover:shadow-[#8b5cf6]/10">
      <div className="flex items-center justify-between gap-3">
        <span className="font-pixelify text-[10px] uppercase tracking-[0.16em] text-white/35">STUDY MATERIAL</span>
        <span className={`rounded-full border px-2.5 py-1 font-nunito text-[10px] font-extrabold ${statusTone}`}>{status}</span>
      </div>
      <h3 className="mt-5 truncate font-fredoka text-lg font-semibold text-white transition group-hover:text-[#d6c4ff]" title={document.filename}>{document.filename}</h3>
      <p className="mt-1 font-quicksand text-xs text-white/40">{new Date(document.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
        <div className="flex gap-2 font-nunito text-[11px] font-bold text-white/45">
          <span className={notes?.status === "ready" ? "text-[#c4b5fd]" : ""}>Notes {notes?.status === "ready" ? "✓" : "·"}</span>
          <span className={quiz?.status === "ready" ? "text-[#c4b5fd]" : ""}>Quiz {quiz?.status === "ready" ? "✓" : "·"}</span>
        </div>
        <span className="font-nunito text-xs font-extrabold text-[#c4b5fd] transition group-hover:translate-x-1">Open →</span>
      </div>
    </Link>
  );
}
