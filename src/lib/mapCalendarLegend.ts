import type { MapCalendarKey } from './calendarIds'

// Shared between the map's radius circle and the matching highlighted
// event tiles/markers so they visually read as the same "within range" set.
// The circle uses two shades: a saturated stroke for its edge, and a pale
// fill for its interior. Highlighted tiles/markers match the pale fill —
// that's the color that actually reads as "inside the radius" — not the
// stroke, which is comparatively dark and only ever traces the boundary.
export const RADIUS_HIGHLIGHT_COLOR = '#bae6fd'
export const RADIUS_HIGHLIGHT_FILL_COLOR = '#e0f2fe'

// Shown instead of the calendar color/radius highlight once an event's end
// time has passed, so past events read as inactive everywhere they appear.
export const EVENT_ENDED_BACKGROUND_COLOR = '#e7e5e4'

type CalendarStyle = { color: string; emoji: string }

// Calendar keys themselves come from the stats API at runtime (see
// calendarIds.ts) — this table only supplies curated color/emoji styling for
// the calendars we know about today. A calendar not listed here still shows
// up everywhere (see the fallback below), just with a generated style
// instead of a hand-picked one.
const KNOWN_CALENDAR_STYLES: Record<string, CalendarStyle> = {
  'Arts/Culture': { color: '#F4511E', emoji: '🎭' },
  Community: { color: '#7986CB', emoji: '👥' },
  'Fun Cheap': { color: '#33B679', emoji: '🎉' },
  Partiful: { color: '#D50000', emoji: '🎈' },
  Tech: { color: '#039BE5', emoji: '💻' },
  Bars: { color: '#8E24AA', emoji: '🍸' },
  Dancing: { color: '#E67C73', emoji: '💃' },
  Exercise: { color: '#F6BF26', emoji: '🏃' },
  Mindfulness: { color: '#26A69A', emoji: '🧘' },
  Shows: { color: '#AB47BC', emoji: '🎟️' },
}

const FALLBACK_COLORS = ['#78716c', '#0d9488', '#c2410c', '#4338ca', '#be123c', '#0891b2']
const FALLBACK_EMOJI = '📍'

// Deterministic (not random) so a given calendar's marker color stays
// stable across page loads until it earns a spot in KNOWN_CALENDAR_STYLES.
function fallbackStyle(key: string): CalendarStyle {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return { color: FALLBACK_COLORS[hash % FALLBACK_COLORS.length], emoji: FALLBACK_EMOJI }
}

export function getCalendarStyle(key: MapCalendarKey): { label: string; color: string; emoji: string } {
  return { label: key, ...(KNOWN_CALENDAR_STYLES[key] ?? fallbackStyle(key)) }
}
