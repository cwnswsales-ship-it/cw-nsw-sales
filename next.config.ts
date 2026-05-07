import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Keep xlsx (and its native deps) out of the webpack bundle — server only
  serverExternalPackages: ['xlsx'],
}

export default nextConfig
