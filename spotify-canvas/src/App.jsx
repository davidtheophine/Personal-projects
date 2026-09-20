import { ReactFlowProvider } from '@xyflow/react'
import CanvasApp from './web/CanvasApp.jsx'

export default function App() {
  return (
    <ReactFlowProvider>
      <CanvasApp />
    </ReactFlowProvider>
  )
}
