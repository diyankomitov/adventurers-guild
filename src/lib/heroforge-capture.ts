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

  const browser = await chromium.launch({
    headless: true,
    // In dev/sandbox: use pre-installed Chromium. In production: auto-detected from PLAYWRIGHT_BROWSERS_PATH.
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
    ],
  })

  const page = await browser.newPage()

  try {
    await page.setViewportSize({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT })

    // Inject Three.js interceptor before navigation
    await page.addInitScript(() => {
      ;(window as Window & { __THREE_INTERCEPTED__?: unknown }).__THREE_INTERCEPTED__ =
        undefined
      const origDefine = Object.defineProperty.bind(Object)
      try {
        origDefine(window, 'THREE', {
          set(val: unknown) {
            ;(
              window as Window & { __THREE_INTERCEPTED__?: unknown }
            ).__THREE_INTERCEPTED__ = val
            origDefine(window, 'THREE', {
              value: val,
              writable: true,
              configurable: true,
            })
          },
          configurable: true,
        })
      } catch {
        // ignore if already defined
      }
    })

    await page.goto(heroforgeUrl, { waitUntil: 'networkidle', timeout: 60_000 })

    // Wait for canvas
    await page.waitForSelector('canvas', { timeout: 30_000 })

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
      { timeout: 60_000, polling: 500 }
    )

    // Extra stabilisation time for textures and lighting
    await page.waitForTimeout(2_500)

    const cx = VIEWPORT_WIDTH / 2
    const cy = VIEWPORT_HEIGHT / 2

    // Move mouse to center (no rotation, button is up)
    await page.mouse.move(cx, cy)

    for (let i = 0; i < FRAME_COUNT; i++) {
      if (i > 0) {
        // Incremental drag: reset to cx,cy then drag right by DRAG_PX
        // Each drag adds ~10° of rotation (OrbitControls accumulates delta)
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx + DRAG_PX, cy, { steps: 3 })
        await page.mouse.up()
        await page.waitForTimeout(150)
      }

      const frameName = `frame-${zeroPad(i)}.png`
      const framePath = path.join(outputDir, frameName)

      // Screenshot only the canvas element (avoids HeroForge UI chrome)
      const canvas = await page.$('canvas')
      if (!canvas) throw new Error('Canvas element disappeared during capture')
      await canvas.screenshot({ path: framePath, type: 'png' })

      onProgress(i + 1)
    }

    return { frameCount: FRAME_COUNT }
  } finally {
    await browser.close()
  }
}
