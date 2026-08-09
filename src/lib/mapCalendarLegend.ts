import type { MapCalendarKey } from './calendarIds'

// Shared between the map's radius circle and the matching highlighted
// event tiles/markers so they visually read as the same "within range" set.
export const RADIUS_HIGHLIGHT_COLOR = '#bae6fd'

export const MAP_CALENDAR_LEGEND: Record<MapCalendarKey, { label: string; color: string; emoji: string }> = {
  sf_arts_culture: { label: 'Arts / Culture', color: '#F4511E', emoji: '🎭' },
  sf_community: { label: 'Community', color: '#7986CB', emoji: '👥' },
  sf_fun_cheap: { label: 'Fun Cheap', color: '#33B679', emoji: '🎉' },
  sf_partiful: { label: 'Partiful', color: '#D50000', emoji: '🎈' },
  sf_tech: { label: 'Tech', color: '#039BE5', emoji: '💻' },
  sf_bars: { label: 'Bars', color: '#8E24AA', emoji: '🍸' },
  sf_dancing: { label: 'Dancing', color: '#E67C73', emoji: '💃' },
  sf_sports_exercise: { label: 'Sports / Exercise', color: '#F6BF26', emoji: '🏃' },
}
