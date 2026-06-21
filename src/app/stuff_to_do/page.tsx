import type { Metadata } from 'next'
import Image from 'next/image'
import BackLink from '@/components/BackLink'

export const metadata: Metadata = {
  title: 'Stuff To Do SF',
  description: 'Making it easier to find free community events in San Francisco.',
}

const BASE_CALENDAR_URL = 'https://calendar.google.com/calendar/embed'
const TIMEZONE = 'America%2FLos_Angeles'

function CalendarEmbed({ title, src }: { title: string; src: string }) {
  const url = `${BASE_CALENDAR_URL}?mode=WEEK&src=${src}&ctz=${TIMEZONE}`
  return (
    <div className="std-calendar">
      <h2>{title}</h2>
      <iframe src={url} className="std-calendar-iframe" title={`${title} Calendar`} />
    </div>
  )
}

const CALENDARS = {
  funCheap: '60a19fdad14c75dc604082f022416e48c2d30dc440502a5e80bf410d32570d1d%40group.calendar.google.com',
  luma: '45264416fab34dddf5fff1ca40931d59a13f865ec441d158030be512b30d6b15%40group.calendar.google.com',
  partiful: '9d7c77c609ffc954909e2a0cb72e2c2b5029048fe87d0ba6a035ccac18e1472a%40group.calendar.google.com',
  sports: '2a8d48b484e0b7d54bd801ad4849798902dbb347781ab1371b06f6cddaad9a9f%40group.calendar.google.com',
  other: 'c40ce35591588f6a8cf1d14e96f4ec215f2d812857382a0fb7253eabea1a0154%40group.calendar.google.com',
  arts_and_culture: "7f66e10ca74622780fdf0db852f0dc8e4be2272cf206bfc8cf83f2eaefc8abdf%40group.calendar.google.com"
}

export default function StuffToDo() {
  return (
    <main className="std-root">
      <div className="std-container">

        <nav className="std-nav">
          <BackLink label="← Alex Roginski" />
        </nav>

        <h1>Stuff To Do SF</h1>

        <div className="std-intro">
          <p>Hi, my name's Alex.</p>
          <p>I want to make it easier for people to find community in San Francisco.</p>
          <p>I take many events from across the city and put them into Google Calendars automatically.</p>
          <p>It's all free. It's for you and your friends.</p>
          <p>
            For example, here's the Arts and Cultures event calendar. It takes the events from three SF arts
            venues' calendars so that you don't have to go manually searching yourself:
          </p>
        </div>

        <CalendarEmbed title="Arts and Culture" src={CALENDARS.arts_and_culture} />

        <p>The calendar above includes three venues:</p>
        <ul>
          <li>🔮 <a href="https://www.thefaight.com/events">The Faight</a> (Haight)</li>
          <li>🤖 <a href="https://luma.com/tiat">TIAT Art and Tech</a> (Downtown)</li>
          <li>😵‍💫 <a href="https://decentered.org/events">Decentered Featured Events</a> (SOMA)</li>
        </ul>
        <br></br>
        <p>Web scrapers go through each art venue's calendar and add them to the Google Calendar.</p>

        <p><b>Click on the + on the bottom right corner of the calendar to add it to your Google Calendar as shown in the red box here:</b></p>
        <img src="/add_calendar_button.png" alt="Add to Google Calendar button" />

        <br></br>
        <p>Here are some more community calendars. I added these events manually since they're weekly and consistent.</p>
        <br></br>
        <h2>Sports</h2>
        <p>Run Clubs, yoga, etc.</p>
        <CalendarEmbed title="" src={CALENDARS.sports} />


        <h2>Other</h2>
        <p>This calendar includes a few other venues I wasn't sure how to categorize: </p>
        <ul>
          <li><a href="https://decentered.org/events">👥 Decentered Community Submitted Events</a> (Various Locations)</li>
          <li><a href="https://www.eventbrite.com/o/mannys-community-politics-and-culture-15114280512">👨‍🦰 Manny's: Community, Politics, and Culture</a> (Mission)</li>
          <li><a href="https://www.thesfnook.com/events">🏠 The SF Nook: SF Event Space</a> (on Market near Civic Center)</li>
  
        </ul>
        <CalendarEmbed title="" src={CALENDARS.other} />


        <h1>Non-Community Google Calendars</h1>
        <p>
          There are some additional calendars not specifically for community events.
        </p>





        <h2>Fun Cheap</h2>
        <p>SF Fun Cheap is a good aggregator. It's just hard to manually go through their calendar
          and find stuff to do. This calendar does that for you automatically.
        </p>
    
        <CalendarEmbed title="" src={CALENDARS.funCheap} />
        <h2>Luma</h2>
        <p>I found a way to scrape Luma for events. They are mostly tech events.
        </p>
        <CalendarEmbed title="" src={CALENDARS.luma} />


        <h2>Partiful</h2>
        <p>This scrapes some events on the Partiful discover page for San Francisco.
        </p>
        <CalendarEmbed title="" src={CALENDARS.partiful} />

        

        <div className="std-callout">
          <p>
            <span className="font-medium">Know a great community event source?</span>{' '}
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSd9Wt0kFxIYOafqI-jn7lMs7IQ95XxQ7aZk7P_fup24Ng4clw/viewform?usp=sharing&ouid=101189593015983846180" target="_blank" rel="noopener noreferrer">Let me know</a> and I'll consider adding it.
          </p>
        </div>


        <h2></h2>

        <div className="std-footer">
          <BackLink />
        </div>

      </div>
    </main>
  )
}
