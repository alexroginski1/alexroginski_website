import Link from 'next/link'

interface BackLinkProps {
  href?: string
  label?: string
}

export default function BackLink({ href = '/', label = '← Back home' }: BackLinkProps) {
  return (
    <Link href={href} className="std-back-link">
      {label}
    </Link>
  )
}
