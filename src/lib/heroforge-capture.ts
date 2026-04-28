import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs/promises'
import { zeroPad } from './utils'

const FRAME_COUNT = 36
const DEGREES_PER_FRAME = 360 / FRAME_COUNT // 10°
const PIXELS_PER_DEGREE = 2
const DRAG_PX = Math.round(DEGREES_PER_FRAME * PIXELS_PER_DEGREE) // 20px per frame
// Smaller viewport = less GPU memory. 800×800 is plenty for gallery thumbnails.
const VIEWPORT_WIDTH = 800
const VIEWPORT_HEIGHT = 800

async function runCapture(
  navigateUrl: string,
  outputDir: string,
  onProgress: (framesDone: number) => void
): Promise<void> {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',      // write shared mem to /tmp, not /dev/shm
      '--use-angle=swiftshader',      // CPU-based WebGL via SwiftShader
      '--use-gl=angle',
      '--ignore-gpu-blocklist',
      '--disable-gpu-sandbox',
      '--disable-blink-features=AutomationControlled',
      // Reduce renderer memory usage
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

  try {
    // domcontentloaded fires once HTML is parsed — does NOT wait for all 3D
    // assets to finish downloading, which avoids OOM during initial load.
    await page.goto(navigateUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Wait for the WebGL canvas to appear
    await page.waitForSelector('canvas', { timeout: 60_000 })

    // Wait until the GPU has rendered at least one frame (center pixel alpha > 0)
    await page.waitForFunction(
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
      { timeout: 90_000, polling: 500 }
    )

    // Let textures and lighting stabilise
    await page.waitForTimeout(3_000)

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
      if (!canvas) throw new Error('Canvas element disappeared during capture')
      const framePath = path.join(outputDir, `frame-${zeroPad(i)}.png`)
      await canvas.screenshot({ path: framePath, type: 'png' })
      onProgress(i + 1)
    }
  } finally {
    await context.close()
    await browser.close()
  }
}

export async function captureHeroForgeFrames(
  heroforgeUrl: string,
  characterId: string,
  onProgress: (framesDone: number) => void
): Promise<{ frameCount: number }> {
  const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
  const outputDir = path.join(dataDir, 'characters', characterId)
  await fs.mkdir(outputDir, { recursive: true })

  const navigateUrl = decodeURIComponent(heroforgeUrl)

  // Retry once — page crashes are often transient OOM spikes
  let lastError: Error = new Error('Unknown capture error')
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await runCapture(navigateUrl, outputDir, onProgress)
      return { frameCount: FRAME_COUNT }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < 2) {
        onProgress(0) // reset progress indicator
        await new Promise((r) => setTimeout(r, 3_000))
      }
    }
  }
  throw lastError
}
