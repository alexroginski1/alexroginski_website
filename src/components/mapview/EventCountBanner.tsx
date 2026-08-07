export default function EventCountBanner({ count }: { count: number | null }) {
  return (
    <div className="std-count-banner">
      <div className="std-count-number">{count === null ? '—' : count}</div>
      <div className="std-count-label">events happening this week</div>
    </div>
  )
}
