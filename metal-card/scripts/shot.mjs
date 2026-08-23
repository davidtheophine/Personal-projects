// Dev-only visual check: drives the system Chrome via puppeteer-core to grab a
// still of the running app. Captures after a real-time wait (so R3F's render
// loop + the env PMREM step have settled) and reports any page/console errors.
//
//   node scripts/shot.mjs [url] [outPath] [waitMs]
import puppeteer from 'puppeteer-core'

const url = process.argv[2] || 'http://localhost:5173/'
const out = process.argv[3] || '/tmp/mc.png'
const wait = Number(process.argv[4] || 6500)

const browser = await puppeteer.launch({
  headless: true,
  executablePath:
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  userDataDir: '/tmp/mc-pptr-profile',
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
  await page.setCacheEnabled(false) // always fetch fresh assets (e.g. bird.png)
  await page.setViewport({ width: 1280, height: 832, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console.error: ' + m.text())
  })
  await page.goto(url, { waitUntil: 'load', timeout: 30000 })
  await new Promise((r) => setTimeout(r, wait))
  await page.screenshot({ path: out })
  console.log('SHOT_OK ' + out)
  if (errors.length) console.log('PAGE_ERRORS:\n' + errors.slice(0, 20).join('\n'))
  else console.log('no page errors')
} finally {
  await browser.close()
}
