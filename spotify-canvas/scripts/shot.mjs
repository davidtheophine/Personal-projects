// Dev-only headless screenshot/smoke helper (Chrome via puppeteer-core), used to
// verify the canvas when the Claude browser extension isn't connected.
// Usage: node scripts/shot.mjs [url]
import puppeteer from 'puppeteer-core'

const URL = process.argv[2] || 'http://127.0.0.1:5174/'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
})

const page = await browser.newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error' && !/404/.test(m.text())) errors.push(`console.error: ${m.text()}`)
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
await page.waitForSelector('.song-card', { timeout: 10000 })
await wait(700)
await page.screenshot({ path: '/tmp/shot-1-seed.png' })

// Expand the seed.
await page.click('.more-btn')
await wait(1500)
await page.screenshot({ path: '/tmp/shot-2-fan.png' })

// Play a visible child card (index 1) to show the live progress bar.
const plays = await page.$$('.play-btn')
if (plays.length > 1) {
  await plays[1].click()
  await wait(1600)
  await page.screenshot({ path: '/tmp/shot-3-playing.png' })
}

// Expand a child to grow the web.
const mores = await page.$$('.more-btn')
if (mores.length > 2) {
  await mores[2].click()
  await wait(1500)
  await page.screenshot({ path: '/tmp/shot-4-web.png' })
}

const cardCount = (await page.$$('.song-card')).length
const edgeCount = (await page.$$('.react-flow__edge')).length
console.log(`RESULT cards=${cardCount} edges=${edgeCount} errors=${errors.length}`)
if (errors.length) console.log(errors.slice(0, 20).join('\n'))

await browser.close()
