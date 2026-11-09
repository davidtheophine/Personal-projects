// Downloads the bundled starter paintings from Wikimedia Commons into
// public/paintings/ and writes credits.json next to them.
//
// Everything here is public domain (all painters died well before 1950 and the
// photographs are faithful 2D reproductions), but we still record the source
// file and license string that Commons reports, so the provenance ships with
// the pixels.
//
//   node scripts/fetch-paintings.mjs
import { execFileSync } from 'node:child_process'
import { writeFile, mkdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/paintings')
const UA = 'jigsaw-studio/0.1 (https://github.com/; davidtheophine@gmail.com)'
const WIDTH = 1280

// slug -> Commons file title + display metadata
const WANTED = [
  {
    slug: 'starry-night',
    title: 'File:Van Gogh - Starry Night - Google Art Project.jpg',
    name: 'The Starry Night',
    artist: 'Vincent van Gogh',
    year: 1889,
  },
  {
    slug: 'great-wave',
    title: 'File:Tsunami by hokusai 19th century.jpg',
    name: 'The Great Wave off Kanagawa',
    artist: 'Katsushika Hokusai',
    year: 1831,
  },
  {
    slug: 'pearl-earring',
    title: 'File:1665 Girl with a Pearl Earring.jpg',
    name: 'Girl with a Pearl Earring',
    artist: 'Johannes Vermeer',
    year: 1665,
  },
  {
    slug: 'the-kiss',
    title: 'File:The Kiss - Gustav Klimt - Google Cultural Institute.jpg',
    name: 'The Kiss',
    artist: 'Gustav Klimt',
    year: 1908,
  },
  {
    slug: 'water-lilies',
    title: 'File:Claude Monet - Water Lilies - 1906, Ryerson.jpg',
    name: 'Water Lilies',
    artist: 'Claude Monet',
    year: 1906,
  },
  {
    slug: 'composition-viii',
    title: 'File:Kandinsky - Composition 8, July 1923.jpg',
    name: 'Composition VIII',
    artist: 'Wassily Kandinsky',
    year: 1923,
  },
]

// Commons thumbs are generous JPEGs; re-encoding at q70 drops each file to a
// couple hundred KB with no visible loss at puzzle-piece scale. sips is macOS
// only, so this is best-effort: elsewhere the originals ship as downloaded.
const shrink = (file) => {
  try {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '70', file, '--out', file], {
      stdio: 'ignore',
    })
  } catch {
    /* sips unavailable - keep the original bytes */
  }
}

const api = async (title) => {
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(WIDTH),
    titles: title,
  })
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`api ${res.status} for ${title}`)
  const page = Object.values((await res.json()).query.pages)[0]
  if (!page?.imageinfo) throw new Error(`no imageinfo for ${title}`)
  const info = page.imageinfo[0]
  return {
    src: info.thumburl || info.url,
    page: info.descriptionurl,
    license: info.extmetadata?.LicenseShortName?.value ?? 'unknown',
  }
}

await mkdir(OUT, { recursive: true })
const credits = []
for (const want of WANTED) {
  const info = await api(want.title)
  const res = await fetch(info.src, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`download ${res.status} for ${want.slug}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  const file = `${want.slug}.jpg`
  await writeFile(`${OUT}/${file}`, bytes)
  shrink(`${OUT}/${file}`) // keep the repo light; no-op off macOS
  credits.push({ ...want, file, source: info.page, license: info.license })
  const size = (await stat(`${OUT}/${file}`)).size
  console.log(`${file}  ${(size / 1024).toFixed(0)} KB  ${info.license}`)
}
await writeFile(`${OUT}/credits.json`, JSON.stringify(credits, null, 2) + '\n')
console.log(`wrote ${credits.length} paintings + credits.json`)
