// Tiny static server rooted at the project so the lab can import ../src/*.
const http = require('http')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' }

http
  .createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0])
    if (rel === '/') rel = '/shader-lab/'
    if (rel.endsWith('/')) rel += 'index.html'
    let file = path.join(root, rel)
    if (!file.startsWith(root)) return res.writeHead(403).end()
    // Metro resolves extensionless imports; browsers do not. Bridge the gap so
    // src/ can keep idiomatic React Native import paths.
    if (!fs.existsSync(file) && fs.existsSync(`${file}.js`)) file += '.js'
    fs.readFile(file, (e, buf) => {
      if (e) return res.writeHead(404).end('not found')
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
      res.end(buf)
    })
  })
  .listen(5177, () => console.log('shader lab → http://localhost:5177/shader-lab/'))
