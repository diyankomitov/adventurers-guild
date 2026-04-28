import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import path from 'path'
import fs from 'fs/promises'
import { zeroPad } from './utils'

chromium.use(StealthPlugin())

const FRAME_COUNT = 36
const DEGREES_PER_FRAME = 360 / FRAME_COUNT
const PIXELS_PER_DEGREE = 2
const DRAG_PX = Math.round(DEGREES_PER_FRAME * PIXELS_PER_DEGREE)
const VIEWPORT_WIDTH = 800
const VIEWPORT_HEIGHT = 800

export type ProgressCallback = (framesDone: number, stage: string) => void

// Sample a 3x3 grid across the canvas — true if any non-transparent pixel found
const WEBGL_GRID_CHECK = () => {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
  if (!canvas) return false
  const gl =
    canvas.getContext('webgl2') ??
    (canvas.getContext('webgl') as WebGLRenderingContext | null)
  if (!gl) return false
  const pixels = new Uint8Array(4)
  const points = [0.25, 0.5, 0.75]
  for (const fx of points) {
    for (const fy of points) {
      gl.readPixels(
        Math.floor(fx * canvas.width),
        Math.floor(fy * canvas.height),
        1, 1,
        gl.RGBA, gl.UNSIGNED_BYTE,
        pixels
      )
      if (pixels[3] > 0) return true
    }
  }
  return false
}

async function runCapture(
  navigateUrl: string,
  outputDir: string,
  onProgress: ProgressCallback
): Promise<void> {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--use-angle=swiftshader',
      '--use-gl=angle',
      '--ignore-gpu-blocklist',
      '--disable-gpu-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--js-flags=--max-old-space-size=256',
      '--disable-features=VizDisplayCompositor',
      '--disable-crash-reporter',
    ],
  })

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  })

  const page = await context.newPage()

  async function debugSnapshot(label: string): Promise<string> {
    try {
      const screenshotPath = path.join(outputDir, `debug-${label}.png`)
      await page.screenshot({ path: screenshotPath, fullPage: true })
      const title = await page.title().catch(() => '(no title)')
      const url = page.url()
      const bodyText = await page
        .evaluate(() => document.body?.innerText?.slice(0, 400) ?? '')
        .catch(() => '')
      return `Page: "${title}" at ${url}\nBody preview: ${bodyText}\nDebug screenshot: ${screenshotPath}`
    } catch {
      return '(could not take debug snapshot)'
    }
  }

  try {
    onProgress(0, 'Navigating to HeroForge...')
    await page
      .goto(navigateUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 })
      .catch(async (err: Error) => {
        const debug = await debugSnapshot('nav-failed')
        throw new Error(`Navigation failed: ${err.message}\n${debug}`)
      })

    onProgress(0, 'Page loaded — checking for bot challenges...')

    // Give Cloudflare up to 15s to resolve if the challenge page is showing
    let elapsed = 0
    while (elapsed < 15_000) {
      const isChallenge = await page.evaluate(() => {
        const title = document.title.toLowerCase()
        const body = document.body?.innerText?.toLowerCase() ?? ''
        return (
          title.includes('just a moment') ||
          title.includes('checking your browser') ||
          title.includes('attention required') ||
          body.includes('checking if the site connection is secure') ||
          body.includes('verifying you are human') ||
          !!document.getElementById('challenge-form') ||
          !!document.querySelector('[data-cf-turnstile]')
        )
      }).catch(() => false)

      if (!isChallenge) break
      await page.waitForTimeout(2_000)
      elapsed += 2_000
      onProgress(0, `Waiting for security check... (${elapsed / 1000}s)`)
    }

    // Final check — if still on challenge page after waiting, fail fast
    const stillChallenge = await page.evaluate(() => {
      return (
        document.title.toLowerCase().includes('just a moment') ||
        !!document.getElementById('challenge-form')
      )
    }).catch(() => false)

    if (stillChallenge) {
      const debug = await debugSnapshot('cloudflare-challenge')
      throw new Error(
        `Cloudflare bot detection triggered — headless browser identified as a bot.\n${debug}`
      )
    }

    onProgress(0, 'Waiting for 3D viewer canvas...')

    await page
      .waitForSelector('canvas', { timeout: 60_000 })
      .catch(async () => {
        const debug = await debugSnapshot('no-canvas')
        throw new Error(
          `3D viewer canvas never appeared after 60 seconds.\n${debug}`
        )
      })

    onProgress(0, 'Canvas found — clicking to activate viewer...')

    // Click the canvas center to trigger any "click to start" interaction
    const cx = VIEWPORT_WIDTH / 2
    const cy = VIEWPORT_HEIGHT / 2
    await page.mouse.click(cx, cy)
    await page.waitForTimeout(1_000)

    // Wait up to 60s for WebGL to render something, sampling a 3×3 grid
    onProgress(0, 'Waiting for 3D render...')
    const renderDeadline = Date.now() + 60_000
    let rendered = false
    while (Date.now() < renderDeadline) {
      rendered = await page.evaluate(WEBGL_GRID_CHECK).catch(() => false)
      if (rendered) break
      const remaining = Math.ceil((renderDeadline - Date.now()) / 1000)
      onProgress(0, `Waiting for 3D render... (${60 - remaining}s)`)
      await page.waitForTimeout(2_000)
    }

    if (!rendered) {
      // Take a snapshot but proceed anyway — maybe the background is transparent
      // and the model is rendered with a different blend mode
      await debugSnapshot('no-webgl-render')
      onProgress(0, 'Render check inconclusive — proceeding with capture...')
    }

    onProgress(0, 'Letting scene stabilise...')
    await page.waitForTimeout(3_000)

    onProgress(0, 'Starting frame capture...')
    await page.mouse.move(cx, cy)

    for (let i = 0; i < FRAME_COUNT; i++) {
      if (i > 0) {
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx + DRAG_PX, cy, { steps: 3 })
        await page.mouse.up()
        await page.waitForTimeout(150)
      }

      const canvas = await page.$('canvas')
      if (!canvas) throw new Error(`Canvas disappeared at frame ${i}`)
      const framePath = path.join(outputDir, `frame-${zeroPad(i)}.png`)
      await canvas.screenshot({ path: framePath, type: 'png' })
      onProgress(i + 1, `Capturing pose ${i + 1} of ${FRAME_COUNT}...`)
    }
  } finally {
    await context.close()
    await browser.close()
  }
}

export async function captureHeroForgeFrames(
  heroforgeUrl: string,
  characterId: string,
  onProgress: ProgressCallback
): Promise<{ frameCount: number }> {
  const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
  const outputDir = path.join(dataDir, 'characters', characterId)
  await fs.mkdir(outputDir, { recursive: true })

  const navigateUrl = decodeURIComponent(heroforgeUrl)

  let lastError: Error = new Error('Unknown capture error')
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (attempt === 2) onProgress(0, 'Retrying capture...')
      await runCapture(navigateUrl, outputDir, onProgress)
      return { frameCount: FRAME_COUNT }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < 2) await new Promise((r) => setTimeout(r, 3_000))
    }
  }
  throw lastError
}
