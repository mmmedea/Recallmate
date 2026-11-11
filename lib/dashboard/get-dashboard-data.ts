import { createClient } from "@/utils/supabase/server";
import { computeDocumentLifecycleSummary, type DocumentLifecycleSummary } from "@/app/actions/document-lifecycle";
import { ECONOMY_FALLBACK, getEconomySnapshot, type EconomySnapshot } from "@/lib/economy/server";

type QueryState = "ok" | "error";

export type DashboardCalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  type: string;
  priority: string;
};

export type DashboardQuizAttempt = {
  id: string;
  documentId: string;
  documentTitle: string;
  score: number | null;
  totalQuestions: number;
  completedAt: string | null;
  startedAt: string;
};

export type DashboardReviewSummary = {
  total: number;
  due: number;
  overdue: number;
  new: number;
  nextDueAt: string | null;
};

export type DashboardData = {
  documents: DocumentLifecycleSummary[];
  documentsState: QueryState;
  reviews: DashboardReviewSummary;
  reviewsState: QueryState;
  upcomingEvents: DashboardCalendarEvent[];
  eventsState: QueryState;
  recentQuizAttempts: DashboardQuizAttempt[];
  quizState: QueryState;
  economy: EconomySnapshot;
};

async function safeQuery<T>(query: PromiseLike<{ data: T | null; error: unknown }>, fallback: T, section: string) {
  try {
    const result = await query;
    if (result.error) {
      const code = typeof result.error === "object" && "code" in result.error ? result.error.code : "unknown";
      console.error("dashboard_query_failed", { section, code });
      return { state: "error" as const, data: fallback };
    }
    return { state: "ok" as const, data: result.data ?? fallback };
  } catch {
    console.error("dashboard_query_failed", { section, code: "request_failed" });
    return { state: "error" as const, data: fallback };
  }
}

function unwrapSettledQuery<T>(result: PromiseSettledResult<{ state: QueryState; data: T }>, fallback: T) {
  if (result.status === "fulfilled") return result.value;
  return { state: "error" as const, data: fallback };
}

function unwrapSettledEconomy(result: PromiseSettledResult<EconomySnapshot>) {
  if (result.status === "fulfilled") return result.value;
  return ECONOMY_FALLBACK;
}

function safeLifecycleSummary(doc: any): DocumentLifecycleSummary | null {
  try {
    return computeDocumentLifecycleSummary(
      doc,
      Array.isArray(doc?.ai_jobs) ? doc.ai_jobs : [],
      Array.isArray(doc?.notes) ? doc.notes[0]?.id ?? null : null,
      Array.isArray(doc?.questions) ? doc.questions[0]?.id ?? null : null,
      Array.isArray(doc?.conversations) ? doc.conversations[0]?.updated_at ?? null : null,
    );
  } catch {
    return null;
  }
}

function parseValidDate(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function relatedFilename(value: unknown) {
  if (!value) return "Untitled material";
  const doc = Array.isArray(value) ? value[0] : value;
  return typeof doc === "object" && doc && "filename" in doc && typeof doc.filename === "string"
    ? doc.filename
    : "Untitled material";
}

const eventTypeRank: Record<string, number> = {
  exam: 0,
  assignment: 1,
  quiz: 2,
  review: 3,
  study: 4,
  note: 5,
  reminder: 6,
  custom: 7,
};

const priorityRank: Record<string, number> = {
  urgent: 0,
  important: 1,
  normal: 2,
};

function rankUpcomingEvents(events: DashboardCalendarEvent[]) {
  return [...events].sort((a, b) => {
    const dateDelta = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    if (Math.abs(dateDelta) > 7 * 24 * 60 * 60 * 1000) return dateDelta;
    const typeDelta = (eventTypeRank[a.type] ?? 99) - (eventTypeRank[b.type] ?? 99);
    if (typeDelta !== 0) return typeDelta;
    const priorityDelta = (priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99);
    if (priorityDelta !== 0) return priorityDelta;
    return dateDelta;
  });
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient();
  const db = supabase as any;
  const now = new Date();
  const nowIso = now.toISOString();
  const nextMonthIso = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const [documentsSettled, learningSettled, eventsSettled, quizSettled, economySettled] = await Promise.allSettled([
    safeQuery<any[]>(
      db
        .from("documents")
        .select(`
          id, filename, created_at, status, error_message,
          ai_jobs ( id, operation, status ),
          notes ( id ),
          questions ( id ),
          conversations ( updated_at )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12),
      [],
      "recent_materials",
    ),
    safeQuery<any[]>(
      db
        .from("learning_items")
        .select("id,state,due_at,document_id,last_reviewed_at")
        .eq("user_id", userId)
        .limit(500),
      [],
      "review_due",
    ),
    safeQuery<any[]>(
      db
        .from("calendar_events")
        .select("id,title,starts_at,event_type,priority")
        .eq("user_id", userId)
        .gte("starts_at", nowIso)
        .lt("starts_at", nextMonthIso)
        .order("starts_at", { ascending: true })
        .limit(5),
      [],
      "upcoming_events",
    ),
    safeQuery<any[]>(
      db
        .from("quiz_attempts")
        .select("id,document_id,score,total_questions,completed_at,started_at,documents(filename)")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(5),
      [],
      "recent_quizzes",
    ),
    getEconomySnapshot(userId),
  ]);

  const documentsResult = unwrapSettledQuery(documentsSettled, []);
  const learningResult = unwrapSettledQuery(learningSettled, []);
  const eventsResult = unwrapSettledQuery(eventsSettled, []);
  const quizResult = unwrapSettledQuery(quizSettled, []);
  const economy = unwrapSettledEconomy(economySettled);

  const documents = documentsResult.data
    .map(safeLifecycleSummary)
    .filter((doc): doc is DocumentLifecycleSummary => Boolean(doc));

  const learningItems = learningResult.data;
  const dueItems = learningItems.filter((item) => {
    const dueAt = parseValidDate(item?.due_at);
    return dueAt ? dueAt <= now : false;
  });
  const overdueItems = learningItems.filter((item) => {
    const dueAt = parseValidDate(item?.due_at);
    return dueAt ? dueAt.toDateString() !== now.toDateString() && dueAt < now : false;
  });
  const newItems = learningItems.filter((item) => item.state === 0);
  const nextDueAt = learningItems
    .map((item) => (parseValidDate(item?.due_at) ? (item.due_at as string) : null))
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null;

  return {
    documents,
    documentsState: documentsResult.state,
    reviews: {
      total: learningItems.length,
      due: dueItems.length,
      overdue: overdueItems.length,
      new: newItems.length,
      nextDueAt,
    },
    reviewsState: learningResult.state,
    upcomingEvents: rankUpcomingEvents(eventsResult.data.flatMap((event) => {
      if (!event?.id || !event?.title || !parseValidDate(event.starts_at)) return [];
      return [{
        id: event.id,
        title: event.title,
        startsAt: event.starts_at,
        type: event.event_type ?? "study",
        priority: event.priority ?? "normal",
      }];
    })),
    eventsState: eventsResult.state,
    recentQuizAttempts: quizResult.data.flatMap((attempt) => {
      if (!attempt?.id || !attempt?.document_id || !parseValidDate(attempt.started_at)) return [];
      return [{
        id: attempt.id,
        documentId: attempt.document_id,
        documentTitle: relatedFilename(attempt.documents),
        score: attempt.score,
        totalQuestions: Number(attempt.total_questions ?? 0),
        completedAt: attempt.completed_at,
        startedAt: attempt.started_at,
      }];
    }),
    quizState: quizResult.state,
    economy,
  };
}
