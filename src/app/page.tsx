import type { Metadata } from 'next'
import HomeClient from './HomeClient'

export const metadata: Metadata = {
  title: 'Alex Roginski',
}

export default function Home() {
  return <HomeClient />
}
