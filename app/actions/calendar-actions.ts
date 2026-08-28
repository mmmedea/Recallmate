'use server'

import { revalidatePath } from 'next/cache'
import { requireUser, SecurityError } from '@/lib/security'

export type CalendarEvent = {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  all_day: boolean
  event_type: 'study' | 'review' | 'quiz' | 'exam' | 'assignment' | 'custom'
  color: 'indigo' | 'violet' | 'blue' | 'emerald' | 'amber' | 'rose' | 'slate'
  priority: 'normal' | 'important' | 'urgent'
  completed_at: string | null
}

export type CalendarEventInput = Omit<CalendarEvent, 'id' | 'completed_at'> & {
  reminderMinutes?: number | null
}

const eventTypes = new Set<CalendarEvent['event_type']>(['study', 'review', 'quiz', 'exam', 'assignment', 'custom'])
const colors = new Set<CalendarEvent['color']>(['indigo', 'violet', 'blue', 'emerald', 'amber', 'rose', 'slate'])
const priorities = new Set<CalendarEvent['priority']>(['normal', 'important', 'urgent'])

export async function getCalendarEvents(year: number): Promise<CalendarEvent[]> {
  const { supabase, user } = await requireUser()
  const from = new Date(Date.UTC(year, 0, 1)).toISOString()
  const to = new Date(Date.UTC(year + 1, 0, 1)).toISOString()
  const { data, error } = await supabase.from('calendar_events').select('id,title,description,starts_at,ends_at,all_day,event_type,color,priority,completed_at')
    .eq('user_id', user.id).gte('starts_at', from).lt('starts_at', to).order('starts_at')
  if (error) throw new Error('Could not load calendar events')
  return (data ?? []) as CalendarEvent[]
}

function validate(input: CalendarEventInput) {
  if (!input.title.trim() || input.title.trim().length > 160) throw new SecurityError('Event title must be between 1 and 160 characters', 400)
  if (!eventTypes.has(input.event_type) || !colors.has(input.color) || !priorities.has(input.priority)) throw new SecurityError('Invalid event type, color, or priority', 400)
  const start = new Date(input.starts_at)
  const end = input.ends_at ? new Date(input.ends_at) : null
  if (Number.isNaN(start.getTime()) || (end && (Number.isNaN(end.getTime()) || end < start))) throw new SecurityError('Invalid event date or time', 400)
  if (input.reminderMinutes != null && (!Number.isInteger(input.reminderMinutes) || input.reminderMinutes < 0 || input.reminderMinutes > 525600)) throw new SecurityError('Invalid reminder', 400)
}

export async function saveCalendarEvent(input: CalendarEventInput, id?: string) {
  try {
    validate(input)
    const { supabase, user } = await requireUser()
    const event = { user_id: user.id, title: input.title.trim(), description: input.description?.trim() || null, starts_at: input.starts_at, ends_at: input.ends_at || null, all_day: input.all_day, event_type: input.event_type, color: input.color, priority: input.priority }
    const query = id
      ? supabase.from('calendar_events').update(event).eq('id', id).eq('user_id', user.id).select().single()
      : supabase.from('calendar_events').insert(event).select().single()
    const { data, error } = await query
    if (error || !data) throw new Error('Could not save calendar event')

    await supabase.from('calendar_reminders').delete().eq('event_id', data.id).eq('user_id', user.id)
    if (input.reminderMinutes != null) {
      const remindAt = new Date(new Date(input.starts_at).getTime() - input.reminderMinutes * 60_000)
      if (remindAt > new Date()) await supabase.from('calendar_reminders').insert({ event_id: data.id, user_id: user.id, remind_at: remindAt.toISOString() })
    }
    revalidatePath('/calendar')
    return { success: true, event: data as CalendarEvent }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Could not save calendar event' }
  }
}

export async function deleteCalendarEvent(id: string) {
  const { supabase, user } = await requireUser()
  const { error } = await supabase.from('calendar_events').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { success: false, error: 'Could not delete calendar event' }
  revalidatePath('/calendar')
  return { success: true }
}

export async function toggleCalendarEventCompletion(id: string, completed: boolean) {
  const { supabase, user } = await requireUser()
  const { error } = await supabase.from('calendar_events').update({ completed_at: completed ? new Date().toISOString() : null }).eq('id', id).eq('user_id', user.id)
  if (error) return { success: false, error: 'Could not update calendar event' }
  revalidatePath('/calendar')
  return { success: true }
}
