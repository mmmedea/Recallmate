import { describe, expect, it, vi } from 'vitest'
import { GOOGLE_CALENDAR_SYNC_SCOPE, syncEventsToGoogle } from '@/lib/integrations/google-calendar'
import { verifyGoogleOAuthProvider } from '@/lib/integrations/google-oauth'

const baseEvent = {
  id: 'event-1', title: 'Chemistry review', description: 'Chapter 4',
  starts_at: '2026-09-10T12:00:00.000Z', ends_at: null, all_day: true,
  event_type: 'review', priority: 'important', google_calendar_id: null, google_event_id: null,
}

describe('Google Calendar synchronization', () => {
  it('uses the app-created Calendar scope for sync consent', () => {
    expect(GOOGLE_CALENDAR_SYNC_SCOPE).toBe('https://www.googleapis.com/auth/calendar.app.created')
  })

  it('turns a disabled-provider response into a safe in-app setup message', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ code: 400, msg: 'Unsupported provider: provider is not enabled' }), { status: 400 })) as unknown as typeof fetch
    await expect(verifyGoogleOAuthProvider('https://example.supabase.co/auth/v1/authorize', fetchImpl)).rejects.toThrow(/not configured yet/i)
  })

  it('blocks OAuth URLs that would send users to localhost', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    await expect(
      verifyGoogleOAuthProvider(
        'https://example.supabase.co/auth/v1/authorize?redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback',
        fetchImpl,
        { purpose: 'sign-in', featureLabel: 'Google sign-in' },
      ),
    ).rejects.toThrow(/localhost instead of the production RecallMate site/i)
  })

  it('blocks Calendar permissions on normal Google sign-in', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 302,
      headers: {
        location: 'https://accounts.google.com/o/oauth2/v2/auth?scope=openid%20email%20profile%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.app.created',
      },
    })) as unknown as typeof fetch
    await expect(
      verifyGoogleOAuthProvider(
        'https://example.supabase.co/auth/v1/authorize?redirect_to=https%3A%2F%2Frecallmate-ai.vercel.app%2Fauth%2Fcallback',
        fetchImpl,
        { purpose: 'sign-in', featureLabel: 'Google sign-in' },
      ),
    ).rejects.toThrow(/profile scopes/i)
  })

  it('allows only the app-created Calendar permission for sync', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 302,
      headers: {
        location: `https://accounts.google.com/o/oauth2/v2/auth?scope=openid%20email%20profile%20${encodeURIComponent(GOOGLE_CALENDAR_SYNC_SCOPE)}`,
      },
    })) as unknown as typeof fetch

    await expect(
      verifyGoogleOAuthProvider(
        `https://example.supabase.co/auth/v1/authorize?redirect_to=https%3A%2F%2Frecallmate-ai.vercel.app%2Fauth%2Fcallback&scopes=${encodeURIComponent(`openid email profile ${GOOGLE_CALENDAR_SYNC_SCOPE}`)}`,
        fetchImpl,
        { purpose: 'calendar-sync', requiredScopes: [GOOGLE_CALENDAR_SYNC_SCOPE], allowedCalendarScopes: [GOOGLE_CALENDAR_SYNC_SCOPE] },
      ),
    ).resolves.toBeUndefined()
  })

  it('rejects broader Calendar scopes during sync', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 302,
      headers: {
        location: 'https://accounts.google.com/o/oauth2/v2/auth?scope=openid%20email%20profile%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events',
      },
    })) as unknown as typeof fetch

    await expect(
      verifyGoogleOAuthProvider(
        `https://example.supabase.co/auth/v1/authorize?redirect_to=https%3A%2F%2Frecallmate-ai.vercel.app%2Fauth%2Fcallback&scopes=${encodeURIComponent('openid email profile https://www.googleapis.com/auth/calendar.events')}`,
        fetchImpl,
        { purpose: 'calendar-sync', requiredScopes: [GOOGLE_CALENDAR_SYNC_SCOPE], allowedCalendarScopes: [GOOGLE_CALENDAR_SYNC_SCOPE] },
      ),
    ).rejects.toThrow(/broader Calendar access/i)
  })

  it('creates a RecallMate-owned secondary Google Calendar before inserting events', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'calendar-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'google-1' }), { status: 200 })) as unknown as typeof fetch
    const result = await syncEventsToGoogle({ accessToken: 'private-token', events: [baseEvent], fetchImpl })
    expect(result).toEqual({ synced: 1, mappings: [{ recallmateEventId: 'event-1', googleCalendarId: 'calendar-1', googleEventId: 'google-1' }] })
    expect(fetchImpl).toHaveBeenNthCalledWith(1, 'https://www.googleapis.com/calendar/v3/calendars', expect.objectContaining({ method: 'POST' }))
    expect(fetchImpl).toHaveBeenNthCalledWith(2, 'https://www.googleapis.com/calendar/v3/calendars/calendar-1/events', expect.objectContaining({ method: 'POST' }))
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[1][1].body as string)
    expect(body).toMatchObject({ summary: 'Chemistry review', start: { date: '2026-09-10' }, end: { date: '2026-09-11' } })
  })

  it('updates an event already linked to Google', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: 'google-1' }), { status: 200 })) as unknown as typeof fetch
    await syncEventsToGoogle({ accessToken: 'private-token', events: [{ ...baseEvent, google_calendar_id: 'calendar-1', google_event_id: 'google-1' }], fetchImpl })
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('https://www.googleapis.com/calendar/v3/calendars/calendar-1/events/google-1')
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'PATCH' }))
  })
})
