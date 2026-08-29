import { getCalendarEvents } from '@/app/actions/calendar-actions'
import YearCalendar from '@/components/calendar/YearCalendar'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const year = new Date().getFullYear()
  try {
    const events = await getCalendarEvents(year)
    return <YearCalendar initialEvents={events} initialYear={year} />
  } catch (error) {
    console.error('Calendar load failed:', error)
    return <YearCalendar initialEvents={[]} initialYear={year} loadError="We could not load saved events. You can still view the planner while RecallMate reconnects to calendar storage." />
  }
}
