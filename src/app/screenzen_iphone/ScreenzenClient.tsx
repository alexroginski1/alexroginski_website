'use client'

import { useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'

type StepData = { img: string; text: string }

const IPHONE_IMG_BASE = '/pictures/screenzen_page/'
const MAC_IMG_BASE = '/pictures/screenzen_mac_page/'

const IPHONE_STEPS: StepData[] = [
  { img: 'IMG-7069.PNG', text: `
Do you have problems with scrolling? Wasting time on your phone?
This might fix that. It did for me.

This tutorial will:
1. Set a bedtime for you to block most apps
(no more night time scrolling)
2. Strict block specific apps you want to cut out of your life (Reddit, Instagram, etc.)
3. Set up a lock on the app so that you cannot unblock it when you're in a scrolling mood.
A friend must set up the lock and remember the password (send an email with the code or something to themselves)
and vow to never unlock without a good justification.

I believe Step 3 is essential to any app blocker. If you are able to bypass the block, it's not a real block.

This helps me save time and focus on more important things in my life.

Step 1: look up ScreenZen on the App Store and download it.` },

  { img: 'IMG-7090.PNG', text: `
    Quick setup: setting a bedtime block for most apps.
    On your IPhone, go to Settings -> Screen Time -> Always Allowed
    Any apps added here will bypass ScreenZen blocking.
    Scroll down to "Choose Apps" and select apps you would like to always have enabled, such as:
    Messages, Maps, Camera, Calculator, Contacts, Docs, Google Calendar, Google Maps, Notes, Weather, etc.
    ` },

  { img: 'IMG-7070.jpg', text: `
    Now, go to the Screenzen app and press Skip here` },

  { img: 'IMG-7071.PNG', text: `Press "Continue"` },

  { img: 'IMG-7072.PNG', text: `Allow` },

  { img: 'IMG-7073.PNG', text: `
    At this point, ScreenZen forces you do test out how the blocking works.
    You have to choose a website just for this example, any website.

    Important note: This app/website search (shown in the screenshot) is really buggy.
    Sometimes it just loses your search. If you type really fast, you are less likely to lose your search.
    ` },

  { img: 'IMG-7074.PNG', text: `If you chose a website, tap "Keep Website"` },

  { img: 'IMG-7075.PNG', text: `Now you have to go to that site and see the Screenzen block screen.` },

  { img: 'IMG-7076.PNG', text: `Once you've seen the block screen, return to app and you'll see this example block.` },

  { img: 'IMG-7077.PNG', text: `Press the x to delete the example block.` },

  { img: 'IMG-7078.PNG', text: `
    Task 1: setting up the bedtime block.

    Select "All Apps and Categories" here to select all apps. Your apps in "Always Allowed" will not be included.
    ` },

  { img: 'IMG-7079.PNG', text: `Choose "Strict Block"` },

  { img: 'IMG-7080.PNG', text: `Just choose "Done" here or set it to the hours you would like. ` },

  { img: 'IMG-7081.PNG', text: `Now that block is working!` },

  { img: 'IMG-7082.PNG', text: `Task 2: strict blocking specific apps.

    On the screen on the previous step, press the + button to add a new app, then "Select apps".
    Within the "select apps" screen, you can search for websites and apps. As noted before, it's important that you type fast.
    For some reason, the search sometimes clears and you have refresh the search page.

    Go one by one adding all the apps that are wasting your time. Reddit, Instagram, etc.

    Here are mine: reddit.com, instagram.com, x.com, youtube.com, mt-unpleasant.com (I have a Blood on the Clocktower addiction)

    In my case, I only selected websites (since I deleted the apps). So I'll press "Keep websites".
    ` },

  { img: 'IMG-7083.PNG', text: `
    Press strict block.
    ` },

  { img: 'IMG-7084.PNG', text: `
    24/7 blocking.
    ` },

  { img: 'IMG-7085.PNG', text: `
    Press done here.` },

  { img: 'IMG-7086.PNG', text: `
    Task 3: Lock Settings Passcode (requires a friend nearby)

    Don't skip this step! This is the only way to make sure you hold yourself to your app blocks.

    Press the "Lock Settings Passcode". Have the friend input a password. Then make them email to themselves or something.
    ` },

  { img: 'IMG-7087.PNG', text: `
    Complete! Now the app should be locked and your app blocks must be respected.

    I hope this helps you dedicate more time to what really matters in your life.
    ` },
]

const MAC_STEPS: StepData[] = [
  { img: 'step1.png', text: `Coming soon — Mac screenshots will go here.` },
]

function StepWizard({
  steps,
  imgBase,
  imgWidth,
  imgHeight,
  layout = 'portrait',
}: {
  steps: StepData[]
  imgBase: string
  imgWidth: number
  imgHeight: number
  layout?: 'portrait' | 'landscape'
}) {
  const [current, setCurrent] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const prev = useCallback(() => setCurrent(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setCurrent(i => Math.min(steps.length - 1, i + 1)), [steps.length])

  const imgSrc = imgBase + steps[current].img
  const isFirst = current === 0
  const isLast = current === steps.length - 1
  const progress = ((current + 1) / steps.length) * 100

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (delta > 50) prev()
    else if (delta < -50) next()
    touchStartX.current = null
  }

  const controls = (
    <div className="screenzen-section">
      <div className="screenzen-btn-row">
        <button onClick={prev} disabled={isFirst} className="screenzen-btn">← Prev</button>
        <button onClick={next} disabled={isLast} className="screenzen-btn">Next →</button>
      </div>
      <div className="screenzen-progress">
        <div className="screenzen-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )

  const stepText = (
    <div className="screenzen-section">
      <h5>Step {current + 1} of {steps.length}</h5>
      {steps[current].text.trim() ? (
        <div className="screenzen-directions">
          {steps[current].text.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      ) : (
        <p className="screenzen-step-text-empty">No description yet.</p>
      )}
    </div>
  )

  if (layout === 'landscape') {
    return (
      <div className="screenzen-layout-landscape">
        <div
          className="screenzen-image-wrapper-landscape"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <Image
            key={imgSrc}
            src={imgSrc}
            alt={`Step ${current + 1}`}
            width={imgWidth}
            height={imgHeight}
            className="screenzen-image"
          />
        </div>
        <div className="screenzen-text-col">
          {stepText}
          {controls}
        </div>
      </div>
    )
  }

  return (
    <div className="screenzen-layout">
      <div
        className="screenzen-image-wrapper"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          key={imgSrc}
          src={imgSrc}
          alt={`Step ${current + 1}`}
          width={imgWidth}
          height={imgHeight}
          className="screenzen-image"
        />
      </div>
      <div className="screenzen-text-col">
        {stepText}
        {controls}
      </div>
    </div>
  )
}

export default function ScreenzenClient() {
  return (
    <div className="std-root">
      <div className="std-container screenzen-page">
        <nav className="std-nav">
          <Link href="/" className="std-back-link">← Alex Roginski</Link>
        </nav>

        <div className="std-intro">
          <h1>Save time: Screenzen</h1>
        </div>

        <section className="screenzen-section-block">
          <h2>App Blocker iPhone Setup</h2>
          <StepWizard
            steps={IPHONE_STEPS}
            imgBase={IPHONE_IMG_BASE}
            imgWidth={390}
            imgHeight={844}
            layout="portrait"
          />
        </section>

        <section className="screenzen-section-block">
          <h2>App Blocker Mac Setup</h2>
          <StepWizard
            steps={MAC_STEPS}
            imgBase={MAC_IMG_BASE}
            imgWidth={1280}
            imgHeight={800}
            layout="landscape"
          />
        </section>
      </div>
    </div>
  )
}
