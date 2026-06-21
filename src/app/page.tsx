import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Alex Roginski',
}

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-2xl mx-auto px-6 py-20 md:py-32">

        {/* Name */}
        <h1 className="text-lg font-semibold text-stone-900 mb-20">
          Alex Roginski
        </h1>

        {/* Introduction */}
        <div className="space-y-5 mb-16">
          <p className="text-xl leading-relaxed text-stone-700">
            Hi, my name&apos;s Alex.
          </p>
          <p className="text-xl leading-relaxed text-stone-700">
            I&apos;m interested in building tools that help people find community
            and make it easier to discover things happening around San Francisco.
          </p>
        </div>

        {/* Current projects */}
        <div className="mb-20">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-5">
            Current projects
          </p>
          <ul className="space-y-3">
            <li>
              <Link
                href="/stuff_to_do"
                className="text-orange-600 hover:text-orange-700 font-medium transition-colors"
              >
                Stuff To Do SF →
              </Link>
            </li>
            <li className="text-stone-600">Community event calendars</li>
            <li className="text-stone-600">Workflow automation</li>
            <li className="text-stone-600">Data and software projects</li>
          </ul>
        </div>

        {/* Links */}
        {/* UPDATE: Replace these placeholder URLs with your real profiles */}
        <div className="flex gap-6 text-sm border-t border-stone-200 pt-8">
          <a
            href="https://linkedin.com/in/alexroginski"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-500 hover:text-stone-800 transition-colors"
          >
            LinkedIn
          </a>
          <a
            href="https://github.com/alexroginski"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-500 hover:text-stone-800 transition-colors"
          >
            GitHub
          </a>
        </div>

      </div>
    </main>
  )
}
