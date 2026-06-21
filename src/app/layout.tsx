import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const momsTypewriter = localFont({
  src: '../fonts/moms_typewriter/Mom差___.ttf',
  variable: '--font-moms-typewriter',
  display: 'swap',
})

const roughTypewriter = localFont({
  src: [
    {
      path: '../fonts/rough_typewriter/rough_typewriter.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/rough_typewriter/rough_typewriter-itl.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../fonts/rough_typewriter/rough_typewriter-bld-itl.otf',
      weight: '700',
      style: 'italic',
    },
  ],
  variable: '--font-rough-typewriter',
  display: 'swap',
})

const f25BankPrinter = localFont({
  src: [
    {
      path: '../fonts/f25_bank_printer/F25_Bank_Printer.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/f25_bank_printer/F25_Bank_Printer_Bold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-f25',
  display: 'swap',
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
    <html lang="en">
      <body className={`${f25BankPrinter.className} bg-stone-50 text-stone-900 antialiased flex flex-col min-h-screen`}>
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
