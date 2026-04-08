import { useState, useEffect } from 'react'
import { BandageLayoutWorker } from './utils/BandageLayoutWorker'
import App from './App'
import './App.css'

export function AppLoader() {
  // AppLoader owns the WASM worker lifecycle so App can assume the layout
  // backend already exists and focus on UI state only.
  const [worker, setWorker] = useState<BandageLayoutWorker | null>(null)
  const [isWorkerReady, setIsWorkerReady] = useState(false)
  const [workerError, setWorkerError] = useState<string | null>(null)

  // Initialize worker
  useEffect(() => {
    let currentWorker: BandageLayoutWorker | null = null

    const initWorker = async () => {
      try {
        console.log('Initializing Bandage Layout worker...')
        const newWorker = new BandageLayoutWorker()

        await newWorker.ready()
        console.log('Worker initialized successfully')

        currentWorker = newWorker
        setWorker(newWorker)
        setIsWorkerReady(true)
      } catch (error) {
        console.error('Failed to initialize worker:', error)
        setWorkerError(
          error instanceof Error ? error.message : 'Unknown error occurred',
        )
      }
    }

    initWorker()

    return () => {
      if (currentWorker) {
        // Tear the worker down when the React tree unmounts to avoid leaving a
        // background thread alive during navigation or hot reloads.
        currentWorker.terminate()
      }
    }
  }, [])

  // Show loading screen while initializing
  if (!isWorkerReady && !workerError) {
    return (
      <div className="app">
        <div className="init-loading">
          <div className="spinner"></div>
          <h2>Loading Bandage Layout Engine...</h2>
          <p>Initializing WebAssembly module with OGDF + FMMM algorithm</p>
        </div>
      </div>
    )
  }

  // Show error screen if initialization failed
  if (workerError) {
    return (
      <div className="app">
        <div className="init-error">
          <h2>Failed to Initialize Layout Engine</h2>
          <p>Error: {workerError}</p>
          <p>
            Make sure WASM files are present in <code>public/js/</code>:
          </p>
          <ul>
            <li>bandage-layout.wasm</li>
            <li>bandage-layout.js</li>
            <li>bandage-layout.worker.js</li>
            <li>bandage-layout-wrapper.js</li>
            <li>bandage-layout-worker-interface.js</li>
          </ul>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    )
  }

  // Render App once worker is ready
  return <App worker={worker!} />
}
