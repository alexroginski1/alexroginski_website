import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Stuff To Do SF',
  description: 'Making it easier to find free community events in San Francisco.',
}

export default function StuffToDo() {
  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-2xl mx-auto px-6 py-20 md:py-32">

        {/* Back navigation */}
        <nav className="mb-16">
          <Link
            href="/"
            className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            ← Alex Roginski
          </Link>
        </nav>

        {/* Title */}
        <header className="mb-12">
          <h1 className="text-2xl font-semibold text-stone-900 mb-2">
            Stuff To Do SF
          </h1>
          <p className="text-stone-500">
            Free community events in San Francisco
          </p>
        </header>

        {/* Introduction */}
        <div className="space-y-5 mb-14">
          <p className="text-lg leading-relaxed text-stone-700">
            Hi, my name&apos;s Alex.
          </p>
          <p className="text-lg leading-relaxed text-stone-700">
            I want to make it easier for people to find community in San
            Francisco, for free.
          </p>
          <p className="text-lg leading-relaxed text-stone-700">
            One thing that could help is making event discovery much easier
            through public Google Calendars that aggregate events from across
            the city.
          </p>
        </div>

        {/* Example image */}
        <div className="mb-14">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-5">
            Check out this example
          </p>

          {/*
            REPLACE THIS IMAGE:
            - To swap in a different screenshot, replace arts_and_cultures_example.png
              in the /public folder and update the src below.
            - Adjust width/height to match your image's actual dimensions.
          */}
          <Image
            src="/arts_and_cultures_example.png"
            alt="Example of a community event calendar aggregating arts and culture events in San Francisco"
            width={1200}
            height={800}
            className="rounded-xl border border-stone-200 w-full h-auto"
            priority
          />
        </div>

        {/* Callout box */}
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-5 py-4 mb-14">
          <p className="text-stone-700 text-sm leading-relaxed">
            <span className="font-medium">Know a great community event source?</span>{' '}
            Let me know and I&apos;ll consider adding it.
          </p>
        </div>

        {/*
          ─────────────────────────────────────────────────
          ADD CALENDAR EMBEDS BELOW
          ─────────────────────────────────────────────────
          To embed a Google Calendar, replace the comment block
          with an iframe like:

          <iframe
            src="https://calendar.google.com/calendar/embed?src=YOUR_CALENDAR_ID&ctz=America%2FLos_Angeles"
            className="w-full rounded-xl border border-stone-200"
            height="600"
            frameBorder="0"
            scrolling="no"
          />
          ─────────────────────────────────────────────────
        */}
        <section className="mb-10" aria-label="Calendar embeds">
          {/* Calendar embeds go here */}
        </section>

        {/*
          ─────────────────────────────────────────────────
          ADD EVENT RESOURCES BELOW
          ─────────────────────────────────────────────────
          Example:
          <ul className="space-y-2 text-stone-700">
            <li><a href="..." className="text-orange-600 hover:underline">SF Parks Events</a></li>
          </ul>
          ─────────────────────────────────────────────────
        */}
        <section className="mb-10" aria-label="Event resources">
          {/* Event resource links go here */}
        </section>

        {/*
          ─────────────────────────────────────────────────
          ADD COMMUNITY LINKS BELOW
          ─────────────────────────────────────────────────
          Links to newsletters, community groups, subreddits, etc.
          ─────────────────────────────────────────────────
        */}
        <section className="mb-16" aria-label="Community links">
          {/* Community links go here */}
        </section>

        {/* Footer */}
        <div className="pt-8 border-t border-stone-200">
          <Link
            href="/"
            className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            ← Back home
          </Link>
        </div>

      </div>
    </main>
  )
}
