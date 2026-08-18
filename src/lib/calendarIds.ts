// Calendar keys are derived at runtime from the stats API's "Source Google
// Calendar" column (see functions/_shared/statsApi.ts) — that column is the
// source of truth for which calendars exist, so this can't be a fixed union.
export type MapCalendarKey = string
