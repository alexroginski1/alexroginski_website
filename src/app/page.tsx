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
          </ul>
        </div>

        <div className="page-links">
          <a
            href="https://www.linkedin.com/in/alex-roginski-68b40219a/"
            className="page-link"
          >
            LinkedIn
          </a>
          
        </div>

      </div>
    </main>
  )
}
