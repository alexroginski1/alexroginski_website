'use client'

import { useEffect, useRef } from 'react'
import CalendarLink from '@/components/CalendarLink'
import { CALENDARS } from '@/lib/googleCalendars'

// The "?" popup — background on the project and links to add each source
// calendar directly, without leaving the map. Anchored to the right edge so
// it sits alongside the button stack that opens it rather than the left
// side, where a clicked marker's own sidebar can appear.
export default function HelpSidebar({ onClose }: { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [onClose])

  return (
    <div ref={rootRef} className="std-map-sidebar std-map-sidebar-right std-map-help-sidebar">
      <button type="button" className="std-map-sidebar-close" onClick={onClose} aria-label="Close">
        ×
      </button>

      <div className="std-map-help-content">
        <p>Hi, I&apos;m Alex.</p>
        <p>I want to make it easier for people to find community in San Francisco.</p>
        <p>
          I automatically collect events happening across the city and organize them into Google
          Calendars (which get put on a map shown below), so you can discover what&apos;s going on
          without searching several websites.
        </p>
        <p>Everything is free. This is for you and your friends.</p>
        <p>I really hope this helps you.</p>

        <p>
          This project started as a{' '}
          <a href="https://docs.google.com/spreadsheets/d/1x1EeFDPKNDULmW1_EE-4xsTcPV0RQ7pdZd4oK_fh0Dg/edit?gid=545113219#gid=545113219">
            spreadsheet
          </a>
          , then moved to Google Calendars, and most recently uses a map to easily visualize events
          happening in your neighborhood.
        </p>

        <p>
          The rest of this page was written before I created the event map. Users had to manually go
          through the events in a list form and check the locations themselves. I&apos;ll leave it
          here in case anyone still uses this. All of the events on the map still come from these
          Google Calendars. You could still add them to your personal Google Calendar if you want,
          but it&apos;s not necessary.
        </p>

        <p>
          <b>Click these links to add to your Google Calendar:</b>
        </p>

        <table className="std-calendar-links std-map-help-calendar-links">
          <tbody>
            <tr>
              <td>
                <CalendarLink href={CALENDARS.other.add} label="Community" />
              </td>
              <td>third spaces, community events</td>
            </tr>
            <tr>
              <td>
                <CalendarLink href={CALENDARS.sports.add} label="Sports/Exercise" />
              </td>
              <td>run clubs, yoga, workouts</td>
            </tr>
            <tr>
              <td>
                <CalendarLink href={CALENDARS.luma.add} label="Tech" />
              </td>
              <td>Luma featured events</td>
            </tr>
            <tr>
              <td>
                <CalendarLink href={CALENDARS.funCheap.add} label="SF Fun Cheap" />
              </td>
              <td>well known aggregator</td>
            </tr>
            <tr>
              <td>
                <CalendarLink href={CALENDARS.partiful.add} label="Partiful" />
              </td>
              <td>featured public events</td>
            </tr>
            <tr>
              <td>
                <CalendarLink href={CALENDARS.arts_and_culture.add} label="Arts and Culture" />
              </td>
              <td>art openings, figure drawing</td>
            </tr>
            <tr>
              <td>
                <CalendarLink href={CALENDARS.dancing.add} label="Dancing" />
              </td>
              <td>salsa, bachata, swing dancing</td>
            </tr>
          </tbody>
        </table>

        <hr className="std-map-help-divider" />

        <p>Project made by Alex Roginski</p>
        <p>
          All code is open source here:
          <br />
          -{' '}
          <a href="https://github.com/alexroginski1/stuff_to_do" target="_blank" rel="noopener noreferrer">
            event scraping
          </a>
          <br />
          -{' '}
          <a
            href="https://github.com/alexroginski1/alexroginski_website"
            target="_blank"
            rel="noopener noreferrer"
          >
            website code
          </a>
        </p>
        <p>
          <a
            href="https://www.linkedin.com/in/alex-roginski-68b40219a/"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </a>
        </p>
      </div>
    </div>
  )
}
