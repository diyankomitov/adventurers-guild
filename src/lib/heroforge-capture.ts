import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs/promises'
import { zeroPad } from './utils'

const FRAME_COUNT = 36
const DEGREES_PER_FRAME = 360 / FRAME_COUNT
const PIXELS_PER_DEGREE = 2
const DRAG_PX = Math.round(DEGREES_PER_FRAME * PIXELS_PER_DEGREE)
const VIEWPORT_WIDTH = 800
const VIEWPORT_HEIGHT = 800

export type ProgressCallback = (framesDone: number, stage: string) => void

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
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  const page = await context.newPage()

  // Save a full-page screenshot + page info on any failure so we can diagnose
  async function debugSnapshot(label: string): Promise<string> {
    try {
      const screenshotPath = path.join(outputDir, `debug-${label}.png`)
      await page.screenshot({ path: screenshotPath, fullPage: true })
      const title = await page.title().catch(() => '(no title)')
      const url = page.url()
      const bodyText = await page
        .evaluate(() => document.body?.innerText?.slice(0, 400) ?? '')
        .catch(() => '')
      return `Page: "${title}" at ${url}\nBody preview: ${bodyText}\nDebug screenshot saved: ${screenshotPath}`
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

    onProgress(0, 'Page loaded — waiting for 3D viewer to initialise...')

    // Wait for a canvas element to exist in the DOM
    await page
      .waitForSelector('canvas', { timeout: 120_000 })
      .catch(async (err: Error) => {
        const debug = await debugSnapshot('no-canvas')
        throw new Error(
          `3D viewer canvas never appeared after 2 minutes. ` +
            `HeroForge may be blocking the headless browser or showing an error page.\n${debug}`
        )
      })

    onProgress(0, 'Canvas found — waiting for WebGL render...')

    // Wait until WebGL has rendered at least one non-transparent pixel
    await page
      .waitForFunction(
        () => {
          const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
          if (!canvas) return false
          const gl =
            canvas.getContext('webgl2') ??
            (canvas.getContext('webgl') as WebGLRenderingContext | null)
          if (!gl) return false
          const pixels = new Uint8Array(4)
          gl.readPixels(
            Math.floor(canvas.width / 2),
            Math.floor(canvas.height / 2),
            1, 1,
            gl.RGBA, gl.UNSIGNED_BYTE,
            pixels
          )
          return pixels[3] > 0
        },
        { timeout: 180_000, polling: 500 }
      )
      .catch(async (err: Error) => {
        const debug = await debugSnapshot('no-webgl-render')
        throw new Error(
          `Canvas appeared but WebGL never rendered any pixels after 3 minutes. ` +
            `SwiftShader may not be initialising correctly.\n${debug}`
        )
      })

    onProgress(0, 'Render detected — letting scene stabilise...')
    await page.waitForTimeout(3_000)

    onProgress(0, 'Starting frame capture...')
    const cx = VIEWPORT_WIDTH / 2
    const cy = VIEWPORT_HEIGHT / 2
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
