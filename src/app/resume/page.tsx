import type { Metadata } from 'next'
import Link from 'next/link'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Resume',
  description: 'Resume of Alex Roginski.',
}

const DOC_ID = '1QtaXEjWNsysm1Wphmy6Y0841qgl7HSQg4gr_fLiD6hY'
const DOC_EMBED_URL = `https://docs.google.com/document/d/${DOC_ID}/preview`
const DOC_DOWNLOAD_URL = `https://docs.google.com/document/d/${DOC_ID}/export?format=pdf`

export default function Resume() {
  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fafaf9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '0.75rem 1.5rem', borderBottom: '1px solid #e7e5e4', flexShrink: 0 }}>
        <Link
          href="/"
          style={{ fontSize: '0.875rem', color: '#78716c', textDecoration: 'none' }}
        >
          ← Alex Roginski
        </Link>
        <a
          href={DOC_DOWNLOAD_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '0.875rem',
            color: '#fff',
            background: '#292524',
            padding: '0.35rem 0.85rem',
            borderRadius: '6px',
            textDecoration: 'none',
          }}
        >
          Download PDF
        </a>
      </div>
      <iframe
        src={DOC_EMBED_URL}
        title="Alex Roginski Resume"
        style={{ flex: 1, width: '100%', border: 'none' }}
        allowFullScreen
      />
    </div>
    <Footer />
    </>
  )
}
