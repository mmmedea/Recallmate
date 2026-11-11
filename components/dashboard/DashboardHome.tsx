import Link from "next/link";
import type React from "react";
import { ArrowRight, BarChart3, CalendarDays, CheckCircle2, Clock3, FilePlus2, Flame, Library, Sparkles, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import MedeaWelcomeCard from "@/components/dashboard/MedeaWelcomeCard";
import { DashboardDocumentCard } from "@/components/dashboard/DashboardDocumentCard";
import { DailyRewardModal } from "@/components/dashboard/DailyRewardModal";
import { DailyStreakModal } from "@/components/dashboard/DailyStreakModal";
import type { DashboardData } from "@/lib/dashboard/get-dashboard-data";
import { MedeaLauncher } from "@/components/medea/MedeaLauncher";

export function DashboardHome({ name, data }: { name: string; data: DashboardData }) {
  const readyDocuments = data.documents.filter((doc) => doc.extraction.status === "completed").length;
  const processingDocuments = data.documents.filter((doc) => ["uploaded", "queued", "processing", "analyzing", "generating"].includes(doc.extraction.status)).length;
  const failedDocuments = data.documents.filter((doc) => ["failed", "cancelled"].includes(doc.extraction.status)).length;
  const continueDoc = data.documents.find((doc) => doc.extraction.status === "completed") ?? data.documents[0] ?? null;
  const nextEvent = data.upcomingEvents[0] ?? null;
  const latestQuiz = data.recentQuizAttempts[0] ?? null;
  const medeaPrompt = buildMedeaPrompt(data);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-violet-200/60 bg-white p-6 shadow-2xl shadow-violet-500/10 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 dark:border-white/10 dark:bg-slate-950/80 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.13),transparent_35%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.3em] text-violet-600 dark:text-violet-300">
              <Sparkles className="h-4 w-4" />
              Study command center
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
              Good day, <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">{name}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              Your materials, due reviews, quizzes, and schedule are now organized around what to study next.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/upload">
                <Button className="min-h-11 rounded-2xl bg-violet-600 px-5 font-black text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700">
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Upload material
                </Button>
              </Link>
              <MedeaLauncher source="dashboard" className="inline-flex min-h-11 items-center rounded-2xl border border-violet-200 px-5 text-sm font-black transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-violet-400/30 dark:text-white dark:hover:bg-white/5">
                  Ask Medea
                  <ArrowRight className="ml-2 h-4 w-4" />
              </MedeaLauncher>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-white/60 bg-white/70 p-5 shadow-xl shadow-slate-950/5 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <Link href="/dashboard?streak=1" aria-label="Open daily streak" className="group flex flex-col items-center rounded-2xl px-4 py-6 text-center transition hover:bg-orange-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
              <Flame aria-hidden="true" className="h-16 w-16 fill-orange-500 text-orange-500 drop-shadow-[0_0_18px_rgba(249,115,22,0.35)] motion-safe:group-hover:scale-110 motion-safe:transition-transform" />
              <p className="mt-3 text-6xl font-black tabular-nums text-slate-950 dark:text-white">{data.economy.state === "ok" ? data.economy.streak : "—"}</p>
              <p className="mt-2 text-sm font-black uppercase tracking-widest text-orange-600 dark:text-orange-300">Day streak</p>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{data.economy.state === "ok" ? "Keep your fire going. View your streak." : "Streak is temporarily unavailable. Open to retry."}</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Library} label="Materials" value={data.documents.length} detail={`${readyDocuments} ready · ${processingDocuments} processing · ${failedDocuments} failed`} />
        <MetricCard icon={Clock3} label="Review due" value={data.reviews.due} detail={`${data.reviews.overdue} overdue · ${data.reviews.new} new`} tone={data.reviews.due > 0 ? "amber" : "emerald"} />
        <MetricCard icon={CalendarDays} label="Upcoming" value={data.upcomingEvents.length} detail={nextEvent ? `${nextEvent.title} · ${formatShortDate(nextEvent.startsAt)}` : "No events in the next 30 days"} />
        <MetricCard icon={BarChart3} label="Latest quiz" value={latestQuiz?.score ?? "—"} detail={latestQuiz ? `${latestQuiz.documentTitle} · ${latestQuiz.totalQuestions} questions` : "No quiz attempts yet"} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Continue studying" eyebrow="Next best material" action={continueDoc ? { href: `/documents/${continueDoc.document.id}`, label: "Open" } : { href: "/upload", label: "Upload" }}>
          {continueDoc ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="line-clamp-2 text-xl font-black text-slate-950 dark:text-white">{continueDoc.document.filename}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{statusText(continueDoc)}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: continueDoc.extraction.status === "completed" ? "100%" : "45%" }} />
              </div>
            </div>
          ) : (
            <EmptyState icon={FilePlus2} title="Your study space is ready" body="Upload your first PDF, slide deck, document, or image to generate notes, quizzes, and reviewers." href="/upload" label="Upload material" />
          )}
        </Panel>

        <Panel title="Review due" eyebrow="FSRS queue" action={data.reviews.due > 0 && continueDoc ? { href: `/documents/${continueDoc.document.id}/review`, label: "Start review" } : undefined}>
          {data.reviewsState === "error" ? (
            <DashboardNotice title="You're all caught up." unavailable="We couldn't verify your review queue. Refresh to check." />
          ) : data.reviews.due > 0 ? (
            <div className="flex items-end justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-400/20 dark:bg-amber-500/10">
              <div>
                <p className="text-5xl font-black text-amber-700 dark:text-amber-200">{data.reviews.due}</p>
                <p className="mt-2 text-sm font-semibold text-amber-800 dark:text-amber-100">cards ready for review</p>
              </div>
              <Flame className="h-10 w-10 text-amber-500" />
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="You're all caught up." body="No reviews are due right now." href="/quiz" label="Open quiz" compact />
          )}
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Upcoming" eyebrow="Next 30 days" action={{ href: "/calendar", label: "Open calendar" }} state={data.eventsState}>
          {data.eventsState === "error" ? (
            <SectionError message="We could not load calendar events. Open Calendar to retry." />
          ) : data.upcomingEvents.length > 0 ? (
            <div className="space-y-3">
              {data.upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <div>
                    <p className="font-black text-slate-950 dark:text-white">{event.title}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{event.type} · {event.priority}</p>
                  </div>
                  <time className="shrink-0 rounded-xl bg-violet-50 px-3 py-2 text-sm font-black text-violet-700 dark:bg-violet-500/10 dark:text-violet-200">
                    {formatShortDate(event.startsAt)}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title="No upcoming events" body="Add an exam or assignment to help RecallMate plan your next study block." href="/calendar" label="Open calendar" compact />
          )}
        </Panel>

        <Panel title="Medea suggestion" eyebrow="Fast context" action={{ kind: "medea", label: "Ask Medea", suggestedPrompt: medeaPrompt }} state={data.quizState}>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-400/20 dark:bg-violet-500/10">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">Try asking</p>
            <p className="mt-3 text-xl font-black text-slate-950 dark:text-white">“{medeaPrompt}”</p>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              This prompt is derived from dashboard context only. Opening Medea does not send it or spend AI credits.
            </p>
          </div>
        </Panel>
      </section>

      <MedeaWelcomeCard />

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-600 dark:text-violet-300">Library</p>
            <h2 id="library" className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Recent materials</h2>
          </div>
          <Link href="/topics" className="text-sm font-black text-violet-700 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100">View topics</Link>
        </div>
        {data.documentsState === "error" ? (
          <DashboardNotice title="No recent materials are available." unavailable="We couldn't verify your library. Refresh to check." />
        ) : data.documents.length === 0 ? (
          <DashboardNotice title="No recent materials are available." />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.documents.map((doc) => <DashboardDocumentCard key={doc.document.id} doc={doc} />)}
          </div>
        )}
      </section>

      <DailyStreakModal data={data.economy} />
      <DailyRewardModal data={data.economy} />
    </div>
  );
}

function DashboardNotice({ title, unavailable }: { title: string; unavailable?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm dark:border-white/10 dark:bg-white/5">
      <p className="font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      {unavailable && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{unavailable} <Link href="/dashboard" className="underline underline-offset-2">Refresh</Link></p>}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = "violet" }: { icon: any; label: string; value: number | string; detail: string; tone?: "violet" | "amber" | "emerald" }) {
  const toneClass = tone === "amber" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200" : tone === "emerald" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200" : "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200";
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-slate-950/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{value}</p>
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-2xl ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

type PanelAction = { kind?: 'link'; href: string; label: string } | { kind: 'medea'; label: string; suggestedPrompt?: string };

function Panel({ title, eyebrow, children, action, state = "ok" }: { title: string; eyebrow: string; children: React.ReactNode; action?: PanelAction; state?: "ok" | "error" }) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-black uppercase tracking-[0.22em] ${state === "error" ? "text-rose-500" : "text-violet-600 dark:text-violet-300"}`}>{eyebrow}</p>
          <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{title}</h2>
        </div>
        {action && (action.kind === 'medea' ? (
          <MedeaLauncher source="dashboard" suggestedPrompt={action.suggestedPrompt} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:border-violet-300 hover:text-violet-700 dark:border-white/10 dark:text-slate-200 dark:hover:text-violet-200">
            {action.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </MedeaLauncher>
        ) : (
          <Link href={action.href} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:border-violet-300 hover:text-violet-700 dark:border-white/10 dark:text-slate-200 dark:hover:text-violet-200">
            {action.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ))}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon, title, body, href, label, compact = false }: { icon: any; title: string; body: string; href: string; label: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center dark:border-white/15 dark:bg-white/5 ${compact ? "p-5" : "p-10"}`}>
      <Icon className="mx-auto h-9 w-9 text-violet-500" />
      <h3 className="mt-3 text-lg font-black text-slate-950 dark:text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{body}</p>
      <Link href={href} className="mt-5 inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white transition hover:bg-violet-700">
        {label}
      </Link>
    </div>
  );
}

function SectionError({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-sm font-semibold text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
      <span>{message}</span>
      <Link href="/dashboard" className="shrink-0 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-black text-rose-700 transition hover:bg-rose-100 dark:border-rose-400/30 dark:bg-white/10 dark:text-rose-100">
        Try again
      </Link>
    </div>
  );
}

function statusText(doc: { extraction: { status: string }; notes: { status: string }; quiz: { status: string } }) {
  if (doc.extraction.status !== "completed") return `Extraction is ${doc.extraction.status}. Open progress to continue.`;
  const ready = [doc.notes.status === "ready" ? "notes" : null, doc.quiz.status === "ready" ? "quiz" : null].filter(Boolean);
  return ready.length ? `Ready: ${ready.join(" and ")}.` : "Text extracted. Generate notes, quiz, or reviewer next.";
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildMedeaPrompt(data: DashboardData) {
  if (data.reviews.due > 0 && data.upcomingEvents[0]) return `What should I study before ${data.upcomingEvents[0].title}?`;
  if (data.reviews.due > 0) return `Help me clear my ${data.reviews.due} due review items.`;
  if (data.upcomingEvents[0]) return `Make a study plan for ${data.upcomingEvents[0].title}.`;
  if (data.recentQuizAttempts[0]) return `Help me improve after my latest quiz.`;
  return "What should I study tonight?";
}
