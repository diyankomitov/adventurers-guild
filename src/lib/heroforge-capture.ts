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

export interface CaptureHooks {
  /** Called with each base64-JPEG screencast frame while user verification is active */
  onScreencastFrame?: (frame: string) => void
  /** Called to register/unregister the live mouse-click relay handler */
  setRelayHandler?: (handler: ((x: number, y: number) => void) | null) => void
}

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

async function isCloudflareChallenge(page: { evaluate: Function }): Promise<boolean> {
  return page.evaluate(() => {
    const title = document.title.toLowerCase()
    return (
      title.includes('just a moment') ||
      title.includes('checking your browser') ||
      title.includes('attention required') ||
      !!document.getElementById('challenge-form') ||
      !!document.querySelector('[data-cf-turnstile]')
    )
  }).catch(() => false)
}

async function runCapture(
  navigateUrl: string,
  outputDir: string,
  onProgress: ProgressCallback,
  hooks: CaptureHooks = {},
): Promise<void> {
  const proxyServer = process.env.PLAYWRIGHT_PROXY

  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
    ...(proxyServer ? { proxy: { server: proxyServer } } : {}),
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
  const livePath = path.join(outputDir, 'debug-live.png')

  async function saveLive(): Promise<void> {
    try { await page.screenshot({ path: livePath }) } catch { /* non-critical */ }
  }

  async function debugSnapshot(label: string): Promise<string> {
    try {
      const screenshotPath = path.join(outputDir, `debug-${label}.png`)
      await page.screenshot({ path: screenshotPath, fullPage: true })
      await fs.copyFile(screenshotPath, livePath).catch(() => {})
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cdpSession: any = null

  async function startScreencast(): Promise<void> {
    if (cdpSession) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cdpSession = await (context as any).newCDPSession(page)
      await cdpSession.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 70,
        maxWidth: VIEWPORT_WIDTH,
        maxHeight: VIEWPORT_HEIGHT,
        everyNthFrame: 1,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cdpSession.on('Page.screencastFrame', (params: any) => {
        hooks.onScreencastFrame?.(params.data)
        void cdpSession.send('Page.screencastFrameAck', { sessionId: params.sessionId })
      })
    } catch {
      cdpSession = null
    }
  }

  async function stopScreencast(): Promise<void> {
    if (cdpSession) {
      await cdpSession.send('Page.stopScreencast').catch(() => {})
      cdpSession = null
    }
  }

  function enableInteractive(): void {
    hooks.setRelayHandler?.((x: number, y: number) => {
      void page.mouse.click(x, y)
    })
  }

  function disableInteractive(): void {
    hooks.setRelayHandler?.(null)
  }

  try {
    onProgress(0, 'Navigating to HeroForge...')
    await page
      .goto(navigateUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 })
      .catch(async (err: Error) => {
        const debug = await debugSnapshot('nav-failed')
        throw new Error(`Navigation failed: ${err.message}\n${debug}`)
      })

    // Start screencast after navigation so the CDP session attaches to a live page
    await startScreencast()
    await saveLive()

    // Give Cloudflare up to 20s to self-resolve
    let elapsed = 0
    while (elapsed < 20_000) {
      if (!await isCloudflareChallenge(page)) break
      await saveLive()
      await page.waitForTimeout(2_000)
      elapsed += 2_000
      onProgress(0, `Waiting for security check... (${elapsed / 1000}s)`)
    }

    // If still challenged, enable click relay so the user can interact
    if (await isCloudflareChallenge(page)) {
      enableInteractive()
      onProgress(0, 'Click the verification checkbox in the live window below ↓')

      const deadline = Date.now() + 5 * 60 * 1000
      while (Date.now() < deadline) {
        if (!await isCloudflareChallenge(page)) break
        await page.waitForTimeout(500)
      }

      disableInteractive()

      if (await isCloudflareChallenge(page)) {
        const debug = await debugSnapshot('cloudflare-challenge')
        throw new Error(
          `Cloudflare verification not completed within 5 minutes.\n` +
          `Fix: set PLAYWRIGHT_PROXY=http://user:pass@host:port for a residential IP.\n${debug}`
        )
      }

      onProgress(0, 'Verification passed — continuing...')
    }

    onProgress(0, 'Waiting for 3D viewer canvas...')
    await saveLive()

    await page
      .waitForSelector('canvas', { timeout: 60_000 })
      .catch(async () => {
        const debug = await debugSnapshot('no-canvas')
        throw new Error(`3D viewer canvas never appeared after 60 seconds.\n${debug}`)
      })

    onProgress(0, 'Canvas found — clicking to activate viewer...')
    await saveLive()

    const cx = VIEWPORT_WIDTH / 2
    const cy = VIEWPORT_HEIGHT / 2
    await page.mouse.click(cx, cy)
    await page.waitForTimeout(1_000)

    onProgress(0, 'Waiting for 3D render...')
    const renderDeadline = Date.now() + 60_000
    let rendered = false
    while (Date.now() < renderDeadline) {
      rendered = await page.evaluate(WEBGL_GRID_CHECK).catch(() => false)
      if (rendered) break
      await saveLive()
      const secondsElapsed = Math.round((60_000 - (renderDeadline - Date.now())) / 1000)
      onProgress(0, `Waiting for 3D render... (${secondsElapsed}s)`)
      await page.waitForTimeout(2_000)
    }

    if (!rendered) {
      await debugSnapshot('no-webgl-render')
      onProgress(0, 'Render check inconclusive — proceeding with capture...')
    }

    onProgress(0, 'Letting scene stabilise...')
    await saveLive()
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
      await fs.copyFile(framePath, livePath).catch(() => {})
      onProgress(i + 1, `Capturing pose ${i + 1} of ${FRAME_COUNT}...`)
    }
  } finally {
    disableInteractive()
    await stopScreencast()
    await context.close()
    await browser.close()
  }
}

export async function captureHeroForgeFrames(
  heroforgeUrl: string,
  characterId: string,
  onProgress: ProgressCallback,
  hooks: CaptureHooks = {},
): Promise<{ frameCount: number }> {
  const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
  const outputDir = path.join(dataDir, 'characters', characterId)
  await fs.mkdir(outputDir, { recursive: true })

  const navigateUrl = decodeURIComponent(heroforgeUrl)

  let lastError: Error = new Error('Unknown capture error')
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (attempt === 2) onProgress(0, 'Retrying capture...')
      await runCapture(navigateUrl, outputDir, onProgress, hooks)
      return { frameCount: FRAME_COUNT }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < 2) await new Promise((r) => setTimeout(r, 3_000))
    }
  }
  throw lastError
}
