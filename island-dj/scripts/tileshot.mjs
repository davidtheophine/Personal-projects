// Dev-only: zoom into the genre tile (and the big grid reticle) to inspect the cursor.
import puppeteer from 'puppeteer-core'
const url = process.argv[2] || 'http://localhost:5173/?clean'
const b = await puppeteer.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  userDataDir: '/tmp/island-pptr-profile',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu', '--no-first-run', '--hide-scrollbars'],
})
try {
  const page = await b.newPage()
  await page.setViewport({ width: 480, height: 980, deviceScaleFactor: 8 })
  await page.goto(url, { waitUntil: 'load' })
  await new Promise((r) => setTimeout(r, 1200))
  await page.click('.island') // -> expanded
  await new Promise((r) => setTimeout(r, 900))
  const tile = await page.$('.controls__tile')
  await tile.screenshot({ path: '/tmp/tile.png' })
  console.log('TILE_OK -> /tmp/tile.png')
} finally {
  await b.close()
}
