export type GoogleSyncEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  event_type: string;
  priority: string;
  google_calendar_id?: string | null;
  google_event_id?: string | null;
};

export type GoogleSyncMapping = { recallmateEventId: string; googleCalendarId: string; googleEventId: string };

export const GOOGLE_CALENDAR_SYNC_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
export const RECALLMATE_GOOGLE_CALENDAR_NAME = "RecallMate Study Schedule";

function addOneDay(date: string) {
  const value = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function toGoogleEvent(event: GoogleSyncEvent) {
  const startDate = event.starts_at.slice(0, 10);
  const start = event.all_day ? { date: startDate } : { dateTime: event.starts_at };
  const end = event.all_day
    ? { date: event.ends_at ? event.ends_at.slice(0, 10) : addOneDay(startDate) }
    : { dateTime: event.ends_at ?? new Date(new Date(event.starts_at).getTime() + 60 * 60_000).toISOString() };

  return {
    summary: event.title,
    description: [event.description, `RecallMate ${event.event_type} · ${event.priority}`].filter(Boolean).join("\n\n"),
    start,
    end,
    extendedProperties: { private: { recallmateEventId: event.id } },
  };
}

async function readGoogleJson<T>(response: Response) {
  const bodyText = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Google Calendar rejected a request (${response.status})${bodyText ? `: ${bodyText.slice(0, 160)}` : ""}`);
  }
  if (!bodyText) return {} as T;
  return JSON.parse(bodyText) as T;
}

async function createRecallMateCalendar(accessToken: string, fetchImpl: typeof fetch) {
  const response = await fetchImpl("https://www.googleapis.com/calendar/v3/calendars", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: RECALLMATE_GOOGLE_CALENDAR_NAME,
      description: "Study schedule synchronized from RecallMate.",
    }),
  });
  const result = await readGoogleJson<{ id?: string }>(response);
  if (!result.id) throw new Error("Google Calendar did not return a calendar id");
  return result.id;
}

async function resolveRecallMateCalendarId(accessToken: string, events: GoogleSyncEvent[], fetchImpl: typeof fetch) {
  const existingCalendarId = events.map((event) => event.google_calendar_id?.trim()).find(Boolean);
  return existingCalendarId || createRecallMateCalendar(accessToken, fetchImpl);
}

export async function syncEventsToGoogle({
  accessToken,
  events,
  fetchImpl = fetch,
}: {
  accessToken: string;
  events: GoogleSyncEvent[];
  fetchImpl?: typeof fetch;
}) {
  const mappings: GoogleSyncMapping[] = [];
  if (events.length === 0) return { synced: 0, mappings };
  const calendarId = await resolveRecallMateCalendarId(accessToken, events, fetchImpl);
  const encodedCalendarId = encodeURIComponent(calendarId);

  for (const event of events) {
    const existingId = event.google_event_id?.trim();
    const endpoint = existingId
      ? `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${encodeURIComponent(existingId)}`
      : `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events`;
    const response = await fetchImpl(endpoint, {
      method: existingId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(toGoogleEvent(event)),
    });

    const result = await readGoogleJson<{ id?: string }>(response);
    if (!result.id) throw new Error("Google Calendar did not return an event id");
    mappings.push({ recallmateEventId: event.id, googleCalendarId: calendarId, googleEventId: result.id });
  }

  return { synced: mappings.length, mappings };
}
