import { getCalendarEvents } from '@/app/actions/calendar-actions'
import YearCalendar from '@/components/calendar/YearCalendar'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const year = new Date().getFullYear()
  const events = await getCalendarEvents(year)
  return <YearCalendar initialEvents={events} initialYear={year} />
}
