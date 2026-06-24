import Link from 'next/link'

interface PageHeaderProps {
  backHref?: string
  backLabel?: string
}

export default function PageHeader({
  backHref = '/',
  backLabel = '← Alex Roginski',
}: PageHeaderProps) {
  return (
    <nav className="std-nav">
      <Link href={backHref} className="std-back-link">
        {backLabel}
      </Link>
    </nav>
  )
}
