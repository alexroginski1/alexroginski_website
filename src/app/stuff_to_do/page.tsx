import type { Metadata } from 'next'
import Image from 'next/image'
import PageHeader from '@/components/PageHeader'
import CalendarLink from '@/components/CalendarLink'
import SurveyForm from '@/components/SurveyForm'
import Footer from '@/components/Footer'
import TableOfContents from '@/components/TableOfContents'

export const metadata: Metadata = {
  title: 'Stuff To Do SF',
  description: 'Making it easier to find free community events in San Francisco.',
}

function CalendarEmbed({ title, src }: { title: string; src: string }) {
  return (
    <div className="std-calendar">
      <h2>{title}</h2>
      <iframe src={src} className="std-calendar-iframe" title={`${title} Calendar`} />
    </div>
  )
}

function cal(id: string) {
  return {
    id,
    add: `https://calendar.google.com/calendar/u/0/r?cid=${id}@group.calendar.google.com`,
    preview: `https://calendar.google.com/calendar/embed?src=${id}%40group.calendar.google.com&ctz=America%2FLos_Angeles&mode=AGENDA`,
  }
}

const CALENDARS = {
  funCheap:        cal('60a19fdad14c75dc604082f022416e48c2d30dc440502a5e80bf410d32570d1d'),
  luma:            cal('45264416fab34dddf5fff1ca40931d59a13f865ec441d158030be512b30d6b15'),
  partiful:        cal('9d7c77c609ffc954909e2a0cb72e2c2b5029048fe87d0ba6a035ccac18e1472a'),
  sports:          cal('2a8d48b484e0b7d54bd801ad4849798902dbb347781ab1371b06f6cddaad9a9f'),
  other:           cal('c40ce35591588f6a8cf1d14e96f4ec215f2d812857382a0fb7253eabea1a0154'),
  arts_and_culture:cal('7f66e10ca74622780fdf0db852f0dc8e4be2272cf206bfc8cf83f2eaefc8abdf'),
}

const CALENDAR_COLORS = ['%23F4511E', '%237986CB', '%2333B679', '%23D50000', '%23039BE5', '%238E24AA']

const combinedPreviewSrc = `https://calendar.google.com/calendar/embed?${Object.values(CALENDARS)
  .map((c, i) => `src=${c.id}%40group.calendar.google.com&color=${CALENDAR_COLORS[i % CALENDAR_COLORS.length]}`)
  .join('&')}&ctz=America%2FLos_Angeles&mode=AGENDA`

export default function StuffToDo() {
  return (
    <>
    <main className="std-root">
      <TableOfContents />
      <div className="std-container">

        <div className="std-hero">
          <video
            src="/gifs/stuff_to_do_calendar_scroll.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="std-hero-video"
          />
          <div className="std-hero-title">
            <h1>Stuff To Do</h1>
          </div>
        </div>

        <div className="std-intro">
          <p>Hi, I'm Alex.</p>
          <p>I want to make it easier for people to find community in San Francisco.</p>
          <p>I automatically collect events happening across the city and organize them into Google Calendars, so you can discover what's going on without searching several websites.</p>
          <p>Everything is free. This is for you and your friends.</p>


          <p><b>Click these links to add to your Google Calendar:</b></p>

          <CalendarLink href={CALENDARS.arts_and_culture.add} label="Arts and Culture" /><br></br>
          <CalendarLink href={CALENDARS.other.add} label="Community" /><br></br>
          <CalendarLink href={CALENDARS.funCheap.add} label="SF Fun Cheap" /><br></br>
          <CalendarLink href={CALENDARS.partiful.add} label="Partiful" /><br></br>
          <CalendarLink href={CALENDARS.sports.add} label="Sports/Exercise" /><br></br>
          <CalendarLink href={CALENDARS.luma.add} label="Luma" />
        </div>
          
          
        <h2>Preview all events</h2>
        <CalendarEmbed title="" src={combinedPreviewSrc} />


        <br></br>
        <h2>Demo</h2>
        <video
          src="/gifs/using_calendar_example_iphone.MP4"
          autoPlay
          loop
          muted
          playsInline
          style={{ width: '100%', maxWidth: '320px', borderRadius: '12px', display: 'block', margin: '1rem auto' }}
        />


        <br></br>
        <h2>Quick Survey</h2>
        <SurveyForm />


        <h2>Preview each calendar</h2>
        <div>
          <h3>Arts and Culture</h3>
          <p>
            This is the Arts and Cultures event calendar. It tracks the events from three SF art venues and some other reoccuring art events.
          </p>
          <br></br>
          <CalendarEmbed title="" src={CALENDARS.arts_and_culture.preview} />
          <p>Here are the venues:</p>
          <ul>
            <li>🔮 <a href="https://www.thefaight.com/events">The Faight</a> (Haight)</li>
            <li>🤖 <a href="https://luma.com/tiat">TIAT Art and Tech</a> (Downtown)</li>
            <li>😵‍💫 <a href="https://decentered.org/events">Decentered Featured Events</a> (SOMA)</li>
          </ul>
          <br></br>
          <p>These venues all have their own websites. It's a headache to check each one manually whenever you want to find events.</p>
          <p>Web scrapers go through each art venue's calendar and add them to the Google Calendar.</p>
        </div>
        
    
        <br></br>
        <h3>Sports</h3>
        <p>Run Clubs, yoga, etc.   I added these events manually since they're weekly and consistent.</p>
        <CalendarEmbed title="" src={CALENDARS.sports.preview} />


        <h3>Community</h3>
        <ul>
          <li><a href="https://decentered.org/events">👥 Decentered Community Submitted Events</a> (Various Locations)</li>
          <li><a href="https://www.eventbrite.com/o/mannys-community-politics-and-culture-15114280512">👨‍🦰 Manny's: Community, Politics, and Culture</a> (Mission)</li>
          <li><a href="https://www.thesfnook.com/events">🏠 The SF Nook: Event Space</a> (on Market near Civic Center)</li>
          <li><a href="https://luma.com/thecommons">🏛️ The Commons: Third Space and Coworking</a> (Hayes Valley)</li>
  
        </ul>
        <CalendarEmbed title="" src={CALENDARS.other.preview} />

        <p>This calendar can get really dense. It's good to look at it on the "Day" or "Schedule" level.</p>
        <br></br>

        <p>
          There are some additional calendars not specifically for community events.
        </p>

        <h3>Partiful Discover Page</h3>
        <p>This scrapes some events on the Partiful discover page for San Francisco. I have found some really fun stuff here.
        </p>
        <CalendarEmbed title="" src={CALENDARS.partiful.preview} />

        <h3>SF Fun Cheap</h3>
        <p>SF Fun Cheap aggregates tons of stuff happening in the city. It's just hard to manually go through their calendar
          and find stuff to do. This calendar does that for you automatically.
        </p>
    
        <CalendarEmbed title="" src={CALENDARS.funCheap.preview} />
        
        <h3>Luma Discover Page</h3>
        <p>Mostly tech events. I haven't found this calendar useful yet.
        </p>
        <CalendarEmbed title="" src={CALENDARS.luma.preview} />


        

        

        <h2>Origins of this project</h2>
        <p>Last year, I lived in Sunnyvale where there wasn't much to do. Once I moved to the city,
          I started keeping track of the fun reoccuring events in <a href="https://docs.google.com/spreadsheets/d/1x1EeFDPKNDULmW1_EE-4xsTcPV0RQ7pdZd4oK_fh0Dg/edit?gid=545113219#gid=545113219">this spreadsheet</a>.
          There are more resources there for finding fun stuff like partner dancing, jamming (instruments), trivia, and unique clubs.

        </p>

        <h2></h2>

        <div className="std-footer">
          <PageHeader backLabel="← Back home" />
        </div>

      </div>
    </main>
    <Footer />
    </>
  )
}
