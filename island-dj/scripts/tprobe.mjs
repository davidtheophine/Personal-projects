// Dev-only: verify the grid-plane actually animates (transform matrix over time).
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
  await page.setViewport({ width: 480, height: 980, deviceScaleFactor: 1 })
  await page.goto(url, { waitUntil: 'load' })
  await new Promise((r) => setTimeout(r, 1200))
  await page.click('.island')
  await new Promise((r) => setTimeout(r, 700))
  await page.click('.controls__tile')
  const samples = await page.evaluate(
    () =>
      new Promise((res) => {
        const el = document.querySelector('.grid-plane')
        const out = []
        const t0 = performance.now()
        function tick() {
          const m = getComputedStyle(el).transform
          const sx = m.startsWith('matrix') ? m.slice(7).split(',')[0] : m
          out.push(Math.round(performance.now() - t0) + 'ms scaleX=' + sx)
          if (performance.now() - t0 < 450) requestAnimationFrame(tick)
          else res(out)
        }
        requestAnimationFrame(tick)
      }),
  )
  console.log(samples.filter((_, i) => i % 5 === 0).join('\n'))
} finally {
  await b.close()
}
