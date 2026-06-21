import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: {
    default: 'Alex Roginski',
    template: '%s | Alex Roginski',
  },
  description: 'Alex Roginski — building tools for community in San Francisco.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-stone-50 text-stone-900 antialiased">
        {children}
      </body>
    </html>
  )
}
