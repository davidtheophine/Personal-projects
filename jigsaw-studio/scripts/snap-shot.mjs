// Dev-only interaction check: drives a real drag with the mouse so the magnet,
// the click-together and the sparks can be seen in a still.
//
//   node scripts/snap-shot.mjs [url] [outDir]
import puppeteer from 'puppeteer-core'

const url = process.argv[2] || 'http://localhost:5181/?pieces=3'
const outDir = process.argv[3] || '/tmp'

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  userDataDir: '/tmp/jigsaw-pptr-profile',
  args: [
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--disable-gpu',
    '--no-first-run',
    '--hide-scrollbars',
  ],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 832, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push('console.error: ' + m.text()))
  await page.goto(url, { waitUntil: 'load', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 9000))

  // Park two neighbouring pieces a short distance out of alignment, then grab
  // the second one: close enough that the magnet should reel it in.
  const spot = await page.evaluate(() => {
    const { pieces, posOf, camera, puzzle } = window.__jigsaw
    const a = pieces.find((p) => p.col === 0 && p.row === 0)
    const b = pieces.find((p) => p.col === 1 && p.row === 0)
    a.group.anchor.set(-1.2, 0, 1.4)
    b.group.anchor.set(-1.2 + puzzle.sx + 0.42, 0, 1.4 + 0.3)
    const v = posOf(b, b.group.anchor.clone())
    v.y = puzzle.depth
    v.project(camera)
    return {
      x: ((v.x + 1) / 2) * window.innerWidth,
      y: ((1 - v.y) / 2) * window.innerHeight,
    }
  })

  const shot = async (name) => {
    const alive = await page.evaluate(() => window.__sparks?.state.alive ?? -1)
    console.log(`${name}: ${alive} sparks alive`)
    await page.screenshot({ path: `${outDir}/${name}.png` })
  }
  await page.mouse.move(spot.x, spot.y)
  await new Promise((r) => setTimeout(r, 400))
  await shot('snap-1-before')
  await page.mouse.down()
  const status = () => page.evaluate(() => document.querySelector('.status span').textContent)
  const before = await status()
  // a small drag towards the neighbour, inside the magnet's reach
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(spot.x - i * 3, spot.y - i * 1.5)
    await new Promise((r) => setTimeout(r, 90))
    if ((await status()) !== before) break // shoot the moment it clicks
  }
  await shot('snap-2-click')
  await page.mouse.up()
  await new Promise((r) => setTimeout(r, 900))
  await shot('snap-3-after')

  const joined = await page.evaluate(() => document.querySelector('.status span').textContent)
  console.log('status after snap:', joined)
  console.log(errors.length ? 'PAGE_ERRORS:\n' + errors.slice(0, 10).join('\n') : 'no page errors')
} finally {
  await browser.close()
}
