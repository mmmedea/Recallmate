import { describe, expect, it, vi } from 'vitest'
import { syncEventsToGoogle } from '@/lib/integrations/google-calendar'

const baseEvent = {
  id: 'event-1', title: 'Chemistry review', description: 'Chapter 4',
  starts_at: '2026-09-10T12:00:00.000Z', ends_at: null, all_day: true,
  event_type: 'review', priority: 'important', google_event_id: null,
}

describe('Google Calendar synchronization', () => {
  it('creates RecallMate events in the primary Google Calendar', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: 'google-1' }), { status: 200 })) as unknown as typeof fetch
    const result = await syncEventsToGoogle({ accessToken: 'private-token', events: [baseEvent], fetchImpl })
    expect(result).toEqual({ synced: 1, mappings: [{ recallmateEventId: 'event-1', googleEventId: 'google-1' }] })
    expect(fetchImpl).toHaveBeenCalledWith('https://www.googleapis.com/calendar/v3/calendars/primary/events', expect.objectContaining({ method: 'POST' }))
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)
    expect(body).toMatchObject({ summary: 'Chemistry review', start: { date: '2026-09-10' }, end: { date: '2026-09-11' } })
  })

  it('updates an event already linked to Google', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: 'google-1' }), { status: 200 })) as unknown as typeof fetch
    await syncEventsToGoogle({ accessToken: 'private-token', events: [{ ...baseEvent, google_event_id: 'google-1' }], fetchImpl })
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('https://www.googleapis.com/calendar/v3/calendars/primary/events/google-1')
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'PATCH' }))
  })
})
