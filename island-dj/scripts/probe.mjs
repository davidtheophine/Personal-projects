// Dev-only interaction check: drags the picker across the plane and confirms the
// genre label updates + captures the moved bloom.
//   node scripts/probe.mjs [url] [outPath] [fx0 fy0 fx1 fy1]
import puppeteer from 'puppeteer-core'

const url = process.argv[2] || 'http://localhost:5173/'
const out = process.argv[3] || '/tmp/island-drag.png'
const fx0 = Number(process.argv[4] ?? 0.8)
const fy0 = Number(process.argv[5] ?? 0.25)
const fx1 = Number(process.argv[6] ?? 0.22)
const fy1 = Number(process.argv[7] ?? 0.78)

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  userDataDir: '/tmp/island-pptr-profile',
  args: [
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  ],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 440, height: 900, deviceScaleFactor: 2 })
  await page.goto(url, { waitUntil: 'load', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 1400))
  const rect = await page.$eval('.plane', (el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  const at = (fx, fy) => ({ x: rect.x + fx * rect.w, y: rect.y + fy * rect.h })
  const s = at(fx0, fy0), e = at(fx1, fy1)
  await page.mouse.move(s.x, s.y)
  await page.mouse.down()
  const N = 24
  for (let i = 1; i <= N; i++) {
    const t = i / N
    await page.mouse.move(s.x + (e.x - s.x) * t, s.y + (e.y - s.y) * t)
    await new Promise((r) => setTimeout(r, 12))
  }
  await page.mouse.up()
  await new Promise((r) => setTimeout(r, 650)) // let the eased cursor settle
  const label = await page.$eval('.island__genre', (el) => el.textContent)
  const artist = await page.$eval('.island__artist', (el) => el.textContent)
  await page.screenshot({ path: out })
  console.log(`DRAG_OK label="${label}" artist="${artist}" -> ${out}`)
} finally {
  await browser.close()
}
