// Dev-only: step through the whole flow (home -> expanded -> grid -> drag) and
// screenshot each state, reporting any page/console errors.
//   node scripts/flow.mjs [url] [outDir]
import puppeteer from 'puppeteer-core'

const url = process.argv[2] || 'http://localhost:5173/'
const dir = process.argv[3] || '/tmp'

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  userDataDir: '/tmp/island-pptr-profile',
  args: [
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  ],
})
const errors = []
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 480, height: 980, deviceScaleFactor: 2 })
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()) })
  await page.goto(url, { waitUntil: 'load', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 1500))
  await page.screenshot({ path: `${dir}/state-home.png` })

  // home -> expanded
  await page.click('.island')
  await new Promise((r) => setTimeout(r, 900))
  await page.screenshot({ path: `${dir}/state-expanded.png` })

  // expanded -> grid (tap the genre tile) — capture mid-morph + settled
  await page.click('.controls__tile')
  await new Promise((r) => setTimeout(r, 45))
  await page.screenshot({ path: `${dir}/state-grid-mid.png` })
  await new Promise((r) => setTimeout(r, 700))
  await page.screenshot({ path: `${dir}/state-grid.png` })

  // drag the picker on the plane
  const rect = await page.$eval('.grid-plane', (el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  const at = (fx, fy) => ({ x: rect.x + fx * rect.w, y: rect.y + fy * rect.h })
  const s = at(0.83, 0.17), e = at(0.08, 0.92)
  await page.mouse.move(s.x, s.y)
  await page.mouse.down()
  for (let i = 1; i <= 22; i++) {
    const t = i / 22
    await page.mouse.move(s.x + (e.x - s.x) * t, s.y + (e.y - s.y) * t)
    await new Promise((r) => setTimeout(r, 12))
  }
  await page.mouse.up()
  await new Promise((r) => setTimeout(r, 650))
  const label = await page.$eval('.grid-label__genre', (el) => el.textContent).catch(() => '(none)')
  await page.screenshot({ path: `${dir}/state-grid-drag.png` })

  // collapse then re-open expanded → verify now-playing reflects the dragged genre
  await page.click('.grid-label')
  await new Promise((r) => setTimeout(r, 700))
  await page.screenshot({ path: `${dir}/state-compact-after.png` })
  await page.click('.island')
  await new Promise((r) => setTimeout(r, 700))
  const npSong = await page.$eval('.expanded__title', (el) => el.textContent).catch(() => '(none)')
  const npArtist = await page.$eval('.expanded__artist', (el) => el.textContent).catch(() => '(none)')
  await page.screenshot({ path: `${dir}/state-expanded-after.png` })

  console.log(`FLOW_OK draggedLabel="${label}" nowPlaying="${npSong} / ${npArtist}"`)
  console.log(errors.length ? 'PAGE_ERRORS:\n' + errors.slice(0, 20).join('\n') : 'no page errors')
} catch (err) {
  console.log('FLOW_FAIL ' + err.message)
  if (errors.length) console.log('PAGE_ERRORS:\n' + errors.slice(0, 20).join('\n'))
} finally {
  await browser.close()
}
