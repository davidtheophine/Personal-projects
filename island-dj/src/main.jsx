import { createRoot } from 'react-dom/client'
import { DialRoot } from 'dialkit'
import 'dialkit/styles.css'
import App from './App.jsx'
import './styles.css'

// No StrictMode: it double-mounts effects in dev, which would duplicate the
// WebGL contexts + rAF loops in the shader hook.
// `?clean` hides the DialKit panel (used for clean screenshots).
const clean = typeof location !== 'undefined' && location.search.includes('clean')

createRoot(document.getElementById('root')).render(
  <>
    <App />
    {!clean && <DialRoot />}
  </>,
)
