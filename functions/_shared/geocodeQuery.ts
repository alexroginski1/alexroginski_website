// Bay Area city names — mirrors stuff_to_do/app/location_service.py's
// `_BAY_AREA_CITIES`. A cleaned location naming one of these already pins
// itself to a real city; forcing "San Francisco, CA" onto it as well (e.g.
// turning "601 Westline Dr, alameda" into "...alameda, San Francisco, CA")
// produces a nonsensical query that can't resolve anywhere.
const OTHER_BAY_AREA_CITIES = [
  'oakland', 'berkeley', 'daly city', 'south san francisco', 'san mateo',
  'emeryville', 'alameda', 'richmond', 'sausalito', 'mill valley',
  'san rafael', 'redwood city', 'palo alto', 'mountain view', 'san jose',
  'marin city', 'novato', 'petaluma', 'burlingame', 'colma', 'brisbane',
  'pacifica', 'menlo park',
]
const OTHER_BAY_AREA_CITY_RE = new RegExp(`\\b(${OTHER_BAY_AREA_CITIES.join('|')})\\b`, 'i')
const SF_OR_STATE_RE = /san francisco|,\s*ca\b|\bcalifornia\b/i

// Most events on this site have no city/state in their raw location at
// all (just a venue name and/or street address) and default to SF — but if
// the cleaned location already names a different Bay Area city, only the
// state should be appended, not "San Francisco" on top of it.
export function withCityStateContext(candidate: string): string {
  if (SF_OR_STATE_RE.test(candidate)) return candidate
  if (OTHER_BAY_AREA_CITY_RE.test(candidate)) return `${candidate}, CA`
  return `${candidate}, San Francisco, CA`
}

// OSM/Nominatim indexes SF's numbered streets by their abbreviated numeral
// form ("3rd Street"), but event sources commonly spell them out ("Third
// Street") — the two don't match as free text no matter how the rest of
// the query is phrased. Only covers the range actually used as street names
// in SF (numbered streets run up to the 40s, but they're essentially always
// written numerically past the low teens).
const ORDINAL_WORDS: Record<string, string> = {
  first: '1st', second: '2nd', third: '3rd', fourth: '4th', fifth: '5th',
  sixth: '6th', seventh: '7th', eighth: '8th', ninth: '9th', tenth: '10th',
  eleventh: '11th', twelfth: '12th', thirteenth: '13th', fourteenth: '14th',
  fifteenth: '15th', sixteenth: '16th', seventeenth: '17th', eighteenth: '18th',
  nineteenth: '19th', twentieth: '20th',
}

function expandOrdinalStreetWords(text: string): string | null {
  let changed = false
  const next = text.replace(/\b[A-Za-z]+\b/g, (word) => {
    const numeral = ORDINAL_WORDS[word.toLowerCase()]
    if (!numeral) return word
    changed = true
    return numeral
  })
  return changed ? next : null
}

// Builds the ordered list of free-text queries worth trying for a single
// cleaned location, from most to least likely to succeed.
export function buildGeocodeCandidates(raw: string): string[] {
  const candidates = [raw]

  // A combined "name + address" free-text query can fail on Nominatim even
  // when either half would succeed alone, and the useful half differs by
  // source shape — a Google Calendar entry mashing a POI name into an
  // unrelated cross-street (e.g. "Duboce Park, Scott St") needs the name
  // kept and the tail dropped, while a "Venue Name, Street Address" entry
  // (e.g. "Choquet's, 2500 Washington St") needs the opposite: the address
  // is what Nominatim can actually resolve, and the venue name is what's
  // confusing it. Try the full string first, then both halves split on the
  // first comma.
  const firstComma = raw.indexOf(',')
  if (firstComma !== -1) {
    const leadingSegment = raw.slice(0, firstComma).trim()
    const trailingSegment = raw.slice(firstComma + 1).trim()
    if (leadingSegment && !candidates.includes(leadingSegment)) candidates.push(leadingSegment)
    if (trailingSegment && !candidates.includes(trailingSegment)) candidates.push(trailingSegment)
  }

  for (const candidate of [...candidates]) {
    const expanded = expandOrdinalStreetWords(candidate)
    if (expanded && !candidates.includes(expanded)) candidates.push(expanded)
  }

  return candidates
}
