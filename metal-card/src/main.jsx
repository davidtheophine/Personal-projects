import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// No StrictMode: it double-mounts effects in dev, which duplicates the
// window-level device-orientation / pointer listeners in useDeviceTilt.
createRoot(document.getElementById('root')).render(<App />)
