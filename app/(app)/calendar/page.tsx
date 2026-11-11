import { getCalendarEvents } from '@/app/actions/calendar-actions'
import YearCalendar from '@/components/calendar/YearCalendar'
import { SecurityError } from '@/lib/security'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const year = new Date().getFullYear()
  try {
    const events = await getCalendarEvents(year)
    return <YearCalendar initialEvents={events} initialYear={year} />
  } catch (error) {
    // The authenticated layout redirects signed-out visitors. Child server
    // components can render in parallel, so an expected 401 must not pollute
    // production error logs while that redirect is being resolved.
    if (!(error instanceof SecurityError) || error.status !== 401) console.error('Calendar load failed:', error)
    return <YearCalendar initialEvents={[]} initialYear={year} loadError="We could not load saved events. You can still view the planner while RecallMate reconnects to calendar storage." />
  }
}
