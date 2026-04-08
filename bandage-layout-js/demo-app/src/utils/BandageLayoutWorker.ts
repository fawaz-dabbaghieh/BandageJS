// Real Bandage Layout Worker using WASM
// This wraps the bandage-layout-worker-interface.js to work with the React app

import type {
  Graph,
  LayoutOptions,
  LayoutResult,
  LayoutComputation,
} from '../types'

interface PendingPromise {
  resolve: (value: LayoutResult) => void
  reject: (error: Error) => void
}

interface WorkerMessage {
  id?: number
  type: string
  result?: LayoutResult
  error?: string
  success?: boolean
  data?: {
    graph: Graph
    options: LayoutOptions
  }
}

export class BandageLayoutWorker {
  // This class adapts the low-level worker messaging protocol into a small
  // Promise-based API that the React components can await directly.
  private _worker: Worker | null = null
  private _ready = false
  private _messageId = 0
  private _pending: Map<number, PendingPromise> = new Map()
  private _initPromise: Promise<void>

  constructor() {
    // Initialize the worker
    this._initPromise = this._init()
  }

  private async _init(): Promise<void> {
    try {
      // Create worker from the public JS file using relative path
      // This works with subdirectory deployments like /demos/bandagejs/
      this._worker = new Worker('./js/bandage-layout.worker.js', {
        type: 'module',
      })

      // Set up message handler
      this._worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
        const { id, type, result, error, success } = e.data

        // Handle initialization complete
        if (type === 'init-complete') {
          if (success) {
            this._ready = true
          } else {
            console.error('Worker initialization failed:', error)
          }
          return
        }

        // Handle layout result
        if (type === 'layout-result' && id !== undefined) {
          const pending = this._pending.get(id)
          if (pending) {
            this._pending.delete(id)
            // Each request is matched back to the Promise created in
            // computeLayout() using the monotonically increasing message id.
            if (success && result) {
              pending.resolve(result)
            } else {
              pending.reject(new Error(error || 'Unknown error'))
            }
          }
          return
        }

        // Handle progress updates (optional, could add callback support later)
        if (type === 'layout-progress') {
          console.log('Layout progress:', e.data)
          return
        }
      }

      this._worker.onerror = (error: ErrorEvent) => {
        console.error('Worker error:', error)
        // Reject all pending promises
        for (const [id, pending] of this._pending.entries()) {
          pending.reject(new Error(error.message))
          this._pending.delete(id)
        }
      }

      // Send init message
      this._worker.postMessage({ type: 'init' })

      // Wait for ready
      await this._waitForReady()
    } catch (error) {
      console.error('Failed to initialize WASM worker:', error)
      throw error
    }
  }

  private async _waitForReady(): Promise<void> {
    // Wait indefinitely for worker to be ready
    while (!this._ready) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  async ready(): Promise<boolean> {
    await this._initPromise
    return this._ready
  }

  async computeLayout(
    graph: Graph,
    options: LayoutOptions,
  ): Promise<LayoutComputation> {
    await this.ready()

    // Measure duration on the UI side so callers get a consistent timing value
    // even if the worker protocol changes later.
    const id = this._messageId++
    const startTime = performance.now()

    return new Promise<LayoutResult>((resolve, reject) => {
      this._pending.set(id, { resolve, reject })

      this._worker!.postMessage({
        type: 'compute-layout',
        id,
        data: { graph, options },
      })
    }).then(result => {
      const duration = performance.now() - startTime
      return { result, duration }
    })
  }

  terminate(): void {
    if (this._worker) {
      this._worker.terminate()
      this._worker = null
      this._ready = false
    }
  }
}
