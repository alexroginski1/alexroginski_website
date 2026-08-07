export type LatLng = { lat: number; lng: number }

const EARTH_RADIUS_MILES = 3958.8

export function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h))
}

// Rough in-city average speeds used only to turn "N minutes by X" into a
// straight-line search radius — not real routing/travel times.
export const TRANSPORT_SPEEDS_MPH = {
  walk: 3,
  bike: 10,
  bus: 12,
  car: 18,
} as const

export type TransportMode = keyof typeof TRANSPORT_SPEEDS_MPH

export function radiusMiles(mode: TransportMode, minutes: number): number {
  return TRANSPORT_SPEEDS_MPH[mode] * (minutes / 60)
}
