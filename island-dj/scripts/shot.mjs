// Dev-only visual check: drives system Chrome headless (swiftshader for WebGL2)
// to grab a still of the running app, and reports any page/console errors.
//
//   node scripts/shot.mjs [url] [outPath] [waitMs]
import puppeteer from 'puppeteer-core'

const url = process.argv[2] || 'http://localhost:5173/'
const out = process.argv[3] || '/tmp/island.png'
const wait = Number(process.argv[4] || 2600)

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  userDataDir: '/tmp/island-pptr-profile',
  args: [
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--hide-scrollbars',
  ],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 480, height: 980, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console.error: ' + m.text())
  })
  await page.goto(url, { waitUntil: 'load', timeout: 30000 })
  await new Promise((r) => setTimeout(r, wait))
  await page.screenshot({ path: out })
  console.log('SHOT_OK ' + out)
  console.log(errors.length ? 'PAGE_ERRORS:\n' + errors.slice(0, 20).join('\n') : 'no page errors')
} finally {
  await browser.close()
}
