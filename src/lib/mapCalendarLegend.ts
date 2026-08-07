import type { MapCalendarKey } from './calendarIds'

export const MAP_CALENDAR_LEGEND: Record<MapCalendarKey, { label: string; color: string }> = {
  sf_arts_culture: { label: 'Arts / Culture', color: '#F4511E' },
  sf_community: { label: 'Community', color: '#7986CB' },
  sf_fun_cheap: { label: 'Fun Cheap', color: '#33B679' },
  sf_partiful: { label: 'Partiful', color: '#D50000' },
  sf_tech: { label: 'Tech', color: '#039BE5' },
  sf_bars: { label: 'Bars', color: '#8E24AA' },
  sf_dancing: { label: 'Dancing', color: '#E67C73' },
  sf_sports_exercise: { label: 'Sports / Exercise', color: '#F6BF26' },
}
