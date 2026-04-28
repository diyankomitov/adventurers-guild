import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs/promises'
import { zeroPad } from './utils'

const FRAME_COUNT = 36
const DEGREES_PER_FRAME = 360 / FRAME_COUNT // 10°
const PIXELS_PER_DEGREE = 2
const DRAG_PX = Math.round(DEGREES_PER_FRAME * PIXELS_PER_DEGREE) // 20px per frame
const VIEWPORT_WIDTH = 1200
const VIEWPORT_HEIGHT = 800

export async function captureHeroForgeFrames(
  heroforgeUrl: string,
  characterId: string,
  onProgress: (framesDone: number) => void
): Promise<{ frameCount: number }> {
  const outputDir = path.join(process.cwd(), 'data', 'characters', characterId)
  await fs.mkdir(outputDir, { recursive: true })

  // Decode URL in case it contains %3D instead of = (copied from browser address bar)
  const navigateUrl = decodeURIComponent(heroforgeUrl)

  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-angle=swiftshader',
      '--use-gl=angle',
      '--disable-gpu-sandbox',
      '--enable-webgl',
      '--enable-unsafe-webgl',
      '--ignore-gpu-blocklist',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      // Avoid headless detection
      '--disable-blink-features=AutomationControlled',
    ],
  })

  const context = await browser.newContext({
    // Spoof a real desktop browser to avoid bot detection
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
  })

  // Remove the webdriver property that headless Chrome exposes
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  const page = await context.newPage()

  try {
    await page.goto(navigateUrl, { waitUntil: 'networkidle', timeout: 90_000 })

    // Wait for canvas — extended timeout since HeroForge can be slow to init
    await page.waitForSelector('canvas', { timeout: 60_000 })

    // Wait until WebGL renders something (center pixel alpha > 0)
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
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels
        )
        return pixels[3] > 0
      },
      { timeout: 90_000, polling: 500 }
    )

    // Extra stabilisation time for textures and lighting
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

      const frameName = `frame-${zeroPad(i)}.png`
      const framePath = path.join(outputDir, frameName)

      const canvas = await page.$('canvas')
      if (!canvas) throw new Error('Canvas element disappeared during capture')
      await canvas.screenshot({ path: framePath, type: 'png' })

      onProgress(i + 1)
    }

    return { frameCount: FRAME_COUNT }
  } finally {
    await context.close()
    await browser.close()
  }
}
