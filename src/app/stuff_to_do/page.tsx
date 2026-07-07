import type { Metadata } from 'next'
import Image from 'next/image'
import PageHeader from '@/components/PageHeader'
import CalendarLink from '@/components/CalendarLink'
import CalendarSourceGroup, { CalendarSource } from '@/components/CalendarSourceGroup'
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

const SOURCES: Record<string, CalendarSource> = {
  the_faight: {
    label: 'The Faight',
    location: 'Lower Haight',
    location_link: 'https://maps.app.goo.gl/sD1asWWUYL11KqmEA',
    emoji: '🔮',
    display_url: 'https://www.thefaight.com/events',
  },
  decentered_featured_events: {
    label: 'Decentered Featured Events',
    location: 'SOMA 8th St',
    location_link: 'https://maps.app.goo.gl/vzyNdBP39hJtJ2XC9',
    emoji: '😵‍💫',
    display_url: 'https://decentered.org/events',
  },
  funcheap: {
    label: 'SF Funcheap',
    emoji: '😜',
    display_url: 'https://sf.funcheap.com/region/san-francisco/',
  },
  luma: {
    label: 'Luma',
    emoji: '💡',
    display_url: 'https://luma.com/sf',
  },
  decentered_community_events: {
    label: 'Decentered Community Events',
    location: 'SOMA 8th St',
    location_link: 'https://maps.app.goo.gl/vzyNdBP39hJtJ2XC9',
    emoji: '👥',
    display_url: 'https://decentered.org/events',
  },
  mannys: {
    label: "Manny's: Community, Politics, and Culture",
    location: 'Mission 16th St',
    location_link: 'https://maps.app.goo.gl/wyEqhBaKK8M7sU1Q9',
    emoji: '👨‍🦰',
    display_url: 'https://www.eventbrite.com/o/mannys-community-politics-and-culture-15114280512',
  },
  the_sf_nook: {
    label: 'The SF Nook: SF Event Space',
    location: 'Civic Center on Market St',
    location_link: 'https://maps.app.goo.gl/MbiV4DbkXNUp12QLA',
    emoji: '🏠',
    display_url: 'https://www.thesfnook.com/events',
  },
  luma_the_commons: {
    label: 'The Commons: Third Space',
    location: 'Hayes Valley',
    location_link: 'https://maps.app.goo.gl/URPfH9ePaBTm3YRd9',
    emoji: '🏛️',
    display_url: 'https://luma.com/thecommons',
  },
  luma_future_of_us: {
    label: 'Future of Us',
    emoji: '⚡',
    display_url: 'https://luma.com/future-of-us',
  },
  the_sf_contemplarium: {
    label: 'The SF Contemplarium',
    emoji: '📓',
    display_url: 'https://luma.com/sfcontemplarium',
  },
  luma_tiat: {
    label: 'TIAT Art and Tech',
    location: "Downtown: Powell and O'Farrell",
    location_link: 'https://maps.app.goo.gl/phgTf8BvmnwwKht87',
    emoji: '🤖',
    display_url: 'https://luma.com/tiat',
  },
  partiful: {
    label: 'Partiful',
    emoji: '🥳',
    display_url: 'https://partiful.com/explore/sf',
  },
  mox: {
    label: 'Mox Event Space',
    location: 'Mission 13th St',
    location_link: 'https://maps.app.goo.gl/1rUtdL99NgpzCrcbA',
    emoji: '💻',
    display_url: 'https://moxsf.com/events',
  },
  artbae: {
    label: 'Art Bae',
    emoji: '🎨',
    display_url: 'https://www.artbae.info/map-calendar',
  },
  artbusiness: {
    label: 'SF Art Galleries - Openings & Events',
    emoji: '🖼️',
    display_url: 'https://calendar.google.com/calendar/embed?src=33alanb%40gmail.com&ctz=America%2FLos_Angeles',
  },
  marina_run_club: {
    label: 'Marina Run Club',
    location: 'Marina',
    emoji: '🏃',
    display_url: 'https://www.instagram.com/marinarunclub_sf/',
  },
  pac_heights_run_club: {
    label: 'Pac Heights Run Club',
    location: 'Pacific Heights',
    emoji: '🏃',
    display_url: 'https://pacrunclub.com',
  },
  page_street_fit: {
    label: 'Page Street Fit',
    location: 'Haight',
    emoji: '💪',
    display_url: 'https://www.heylo.com/g/6e3b8574-b970-4713-995a-1c641daeca26',
  },
  faight_collective_yoga: {
    label: 'Faight Collective Yoga',
    location: 'Haight',
    emoji: '🧘',
    display_url: 'https://www.thefaight.com/spaces/yoga-wellness#schedule',
  },
  midnight_runners_club: {
    label: 'Midnight Runners Club',
    location: 'Embarcadero or Golden Gate Park',
    emoji: '🏃',
    display_url: 'https://www.heylo.com/g/-LmBjhGfivWBeac11cNQ',
  },
  and_more: {
    label: 'And more',
    emoji: '➕',
  },
}

const ARTS_AND_CULTURE_SOURCES: CalendarSource[] = [
  SOURCES.the_faight,
  SOURCES.decentered_featured_events,
  SOURCES.luma_tiat,
  SOURCES.artbae,
  SOURCES.artbusiness,
]

const COMMUNITY_SOURCES: CalendarSource[] = [
  SOURCES.decentered_community_events,
  SOURCES.mannys,
  SOURCES.the_sf_nook,
  SOURCES.luma_the_commons,
  SOURCES.luma_future_of_us,
  SOURCES.the_sf_contemplarium,
]

const LUMA_SOURCES: CalendarSource[] = [SOURCES.luma, SOURCES.mox]

const SPORTS_SOURCES: CalendarSource[] = [
  SOURCES.marina_run_club,
  SOURCES.pac_heights_run_club,
  SOURCES.page_street_fit,
  SOURCES.faight_collective_yoga,
  SOURCES.midnight_runners_club,
  SOURCES.and_more,
]

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
          <CalendarLink href={CALENDARS.sports.add} label="Sports/Exercise" /><br></br>
          <CalendarLink href={CALENDARS.luma.add} label="Luma" /><br></br>
          <CalendarLink href={CALENDARS.funCheap.add} label="SF Fun Cheap" /><br></br>
          <CalendarLink href={CALENDARS.partiful.add} label="Partiful" />
        </div>

        <div className="std-intro">
          <p><b>See where each calendar's events come from:</b></p>

          <CalendarSourceGroup label="Arts and Culture" sources={ARTS_AND_CULTURE_SOURCES} />
          <CalendarSourceGroup label="Community" sources={COMMUNITY_SOURCES} />
          <CalendarSourceGroup label="Sports/Exercise" sources={SPORTS_SOURCES} />
          <CalendarSourceGroup label="Luma" sources={LUMA_SOURCES} />
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
          <br></br>
          <CalendarEmbed title="" src={CALENDARS.arts_and_culture.preview} />
        </div>
        
    
        <br></br>
        <h3>Sports</h3>
        <CalendarEmbed title="" src={CALENDARS.sports.preview} />


        <h3>Community</h3>
        <CalendarEmbed title="" src={CALENDARS.other.preview} />


        <h3>Partiful Discover Page</h3>

        <CalendarEmbed title="" src={CALENDARS.partiful.preview} />

        <h3>SF Fun Cheap</h3>
    
        <CalendarEmbed title="" src={CALENDARS.funCheap.preview} />
        
        <h3>Luma Discover Page</h3>
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
