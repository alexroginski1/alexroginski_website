import type { Metadata } from 'next'
import ScreenzenClient from './ScreenzenClient'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Save time: Screenzen',
}

export default function ScreenzenPage() {
  return (
    <>
      <ScreenzenClient />
      <Footer />
    </>
  )
}
