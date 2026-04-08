import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppLoader } from './AppLoader.tsx'

// The app boots through AppLoader so the worker/WASM runtime is ready before
// the main UI starts issuing layout requests.
const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to find the root element')

createRoot(rootElement).render(
  <StrictMode>
    <AppLoader />
  </StrictMode>,
)
