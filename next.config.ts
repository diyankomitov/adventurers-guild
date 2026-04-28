import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'better-sqlite3',
    'playwright',
    'playwright-core',
    'playwright-extra',
    'rebrowser-playwright',
    'rebrowser-playwright-core',
    'puppeteer-extra',
    'puppeteer-extra-plugin-stealth',
    'puppeteer-extra-plugin-user-preferences',
  ],
}

export default nextConfig
