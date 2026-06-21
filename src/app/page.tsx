import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Alex Roginski',
}

export default function Home() {
  return (
    <main className="page-root">
      <div className="page-container">

        <h1>Alex Roginski</h1>

        <div className="page-intro">
          <p>Hi, my name's Alex.</p>
          <p>
            I'm a data analyst and software engineer based in San Francisco.
          </p>
        </div>

        <div className="page-projects">
          <h2>Current projects</h2>
          <ul className="page-projects-list">
            <li>
              <Link href="/stuff_to_do" className="page-project-link">
                Stuff To Do SF →
              </Link>
            </li>
            {/* <li>Community event calendars</li> */}
            {/* <li>Workflow automation</li> */}
            {/* <li>Data and software projects</li> */}
          </ul>
        </div>

        <div className="page-links">
          <a
            href="https://www.linkedin.com/in/alex-roginski-68b40219a/"
            target="_blank"
            rel="noopener noreferrer"
            className="page-link"
          >
            LinkedIn
          </a>
          {/* <a
            href="https://github.com/alexroginski1"
            target="_blank"
            rel="noopener noreferrer"
            className="page-link"
          >
            GitHub
          </a> */}
        </div>

      </div>
    </main>
  )
}
