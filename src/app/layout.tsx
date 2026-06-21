import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600'],
})
// 

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
      <body className="font-sans bg-stone-50 text-stone-900 antialiased flex flex-col min-h-screen">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-stone-200 py-6 mt-12">
          <div className="max-w-2xl mx-auto px-6 flex gap-6 text-sm text-stone-500">
            <a href="https://www.linkedin.com/in/alex-roginski-68b40219a/" target="_blank" rel="noopener noreferrer" className="hover:text-stone-900 transition-colors">LinkedIn</a>
            <a href="mailto:roginskialexr@gmail.com" className="hover:text-stone-900 transition-colors">roginskialexr@gmail.com</a>
          </div>
        </footer>
      </body>
    </html>
  )
}
