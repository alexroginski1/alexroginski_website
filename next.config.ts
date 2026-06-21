import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Static export for Cloudflare Pages — no server required
  output: 'export',
  // Cloudflare Pages serves index.html at /path/ automatically
  trailingSlash: true,
  images: {
    // Required for static export (no Next.js image optimization server)
    unoptimized: true,
  },
}

export default nextConfig
