export type GoogleSyncEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  event_type: string;
  priority: string;
  google_event_id?: string | null;
};

export type GoogleSyncMapping = { recallmateEventId: string; googleEventId: string };

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

  for (const event of events) {
    const existingId = event.google_event_id?.trim();
    const endpoint = existingId
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingId)}`
      : "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    const response = await fetchImpl(endpoint, {
      method: existingId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(toGoogleEvent(event)),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Google Calendar rejected an event (${response.status})${detail ? `: ${detail.slice(0, 160)}` : ""}`);
    }

    const result = (await response.json()) as { id?: string };
    if (!result.id) throw new Error("Google Calendar did not return an event id");
    mappings.push({ recallmateEventId: event.id, googleEventId: result.id });
  }

  return { synced: mappings.length, mappings };
}
