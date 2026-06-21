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
    <nav className="mb-16">
      <Link
        href={backHref}
        className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
      >
        {backLabel}
      </Link>
    </nav>
  )
}
