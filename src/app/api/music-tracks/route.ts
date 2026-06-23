import { readdirSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'

export function GET() {
  const dir = join(process.cwd(), 'public/music/homepage_background_music')
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.mp3'))
    .map(f => `/music/homepage_background_music/${f}`)
  return NextResponse.json(files)
}
