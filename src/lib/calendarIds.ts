export type MapCalendarKey =
  | 'sf_arts_culture'
  | 'sf_community'
  | 'sf_fun_cheap'
  | 'sf_partiful'
  | 'sf_tech'
  | 'sf_bars'
  | 'sf_dancing'
  | 'sf_sports_exercise'

export const CALENDAR_IDS: Record<MapCalendarKey, string> = {
  sf_arts_culture: '7f66e10ca74622780fdf0db852f0dc8e4be2272cf206bfc8cf83f2eaefc8abdf@group.calendar.google.com',
  sf_community: 'c40ce35591588f6a8cf1d14e96f4ec215f2d812857382a0fb7253eabea1a0154@group.calendar.google.com',
  sf_fun_cheap: '60a19fdad14c75dc604082f022416e48c2d30dc440502a5e80bf410d32570d1d@group.calendar.google.com',
  sf_partiful: '9d7c77c609ffc954909e2a0cb72e2c2b5029048fe87d0ba6a035ccac18e1472a@group.calendar.google.com',
  sf_tech: '45264416fab34dddf5fff1ca40931d59a13f865ec441d158030be512b30d6b15@group.calendar.google.com',
  sf_bars: '9c8685a68b697409a5bffa6ce3011651930fa18572dad9ef435215753a43de22@group.calendar.google.com',
  sf_dancing: '704367c0fe7ec0383a79ab3bd6a4388d8c867642120862ffa11191fdb27e407f@group.calendar.google.com',
  sf_sports_exercise: '2a8d48b484e0b7d54bd801ad4849798902dbb347781ab1371b06f6cddaad9a9f@group.calendar.google.com',
}

export function icsUrl(calendarId: string): string {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`
}
