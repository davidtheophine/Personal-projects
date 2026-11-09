import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// No StrictMode: its double-mount would build the puzzle twice and leak a set
// of geometries and GPU-side materials on every edit.
createRoot(document.getElementById('root')).render(<App />)
