interface Zaraz {
  track(eventName: string, properties?: Record<string, string | number | boolean>): void
}

interface Window {
  zaraz?: Zaraz
}
