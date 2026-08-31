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

// Nominatim's free-text search matches on whole tokens, so a unit/suite/
// apartment number stuck onto a street address (e.g. "14 Hagiwara Tea
// Garden Dr #2") reliably fails to match anything even though the same
// address without it resolves fine — Nominatim's data doesn't carry unit
// numbers at all. Dropping it is always safe here since it isn't needed to
// disambiguate a single lat/lng for a whole building.
function stripUnitSuffix(text: string): string | null {
  const stripped = text.replace(/\s*#\s*[0-9A-Za-z]+\b/g, '').trim()
  return stripped && stripped !== text ? stripped : null
}

// The stats API's source data occasionally misspells "San Francisco" (e.g.
// "San Franciso") — Nominatim's free-text search doesn't fuzzy-match city
// names, so a query carrying the typo fails even when the rest of the
// address is perfectly resolvable.
function fixCommonMisspellings(text: string): string | null {
  const fixed = text.replace(/\bfranciso\b/gi, (m) => (m[0] === m[0].toUpperCase() ? 'Francisco' : 'francisco'))
  return fixed !== text ? fixed : null
}

// Builds the ordered list of free-text queries worth trying for a single
// cleaned location, from most to least likely to succeed.
export function buildGeocodeCandidates(raw: string): string[] {
  const candidates = [raw]

  // A combined "name + address" free-text query can fail on Nominatim even
  // when the address alone would succeed, and sources vary in how many
  // name-like segments come before the real address — a Google Calendar
  // entry mashing a POI name into an unrelated cross-street (e.g. "Duboce
  // Park, Scott St") needs the name kept and the tail dropped, a "Venue
  // Name, Street Address" entry (e.g. "Choquet's, 2500 Washington St")
  // needs the opposite, and some sources stack a venue name *and* a
  // sub-venue before the address (e.g. "Lindy in the Park, Golden Gate
  // Park, 14 Hagiwara Tea Garden Dr"). Try the full string, the leading
  // segment alone, and the address itself with every non-address segment
  // before it dropped.
  //
  // "Where the address starts" is taken to be the first segment that
  // starts with a number — i.e. a street number — rather than blindly
  // stripping down to whatever's left after the last comma: a location
  // with no street number at all (e.g. "Golden Gate Park, San Francisco,
  // CA") would otherwise keep shedding segments past the point of being a
  // useful query, down to a bare "CA" — which Nominatim happily "resolves"
  // to some unrelated place, plotting the event nowhere near where it
  // actually is instead of correctly leaving it unplaced.
  const segments = raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (segments.length > 1) {
    if (!candidates.includes(segments[0])) candidates.push(segments[0])
    let addressStart = 1
    while (addressStart < segments.length && !/^\d/.test(segments[addressStart])) addressStart++
    if (addressStart > 0 && addressStart < segments.length) {
      const suffix = segments.slice(addressStart).join(', ')
      if (suffix && !candidates.includes(suffix)) candidates.push(suffix)
    }
  }

  for (const candidate of [...candidates]) {
    const expanded = expandOrdinalStreetWords(candidate)
    if (expanded && !candidates.includes(expanded)) candidates.push(expanded)
  }

  for (const candidate of [...candidates]) {
    const stripped = stripUnitSuffix(candidate)
    if (stripped && !candidates.includes(stripped)) candidates.push(stripped)
  }

  for (const candidate of [...candidates]) {
    const fixed = fixCommonMisspellings(candidate)
    if (fixed && !candidates.includes(fixed)) candidates.push(fixed)
  }

  return candidates
}
