/**
 * Bandage Layout Worker Interface
 * Provides a Promise-based API for using the Web Worker
 */

export class BandageLayoutWorker {
    constructor(workerPath = './bandage-layout.worker.js') {
        this.worker = new Worker(workerPath, { type: 'module' });
        this.messageId = 0;
        this.pendingRequests = new Map();
        this.progressCallbacks = new Map();
        this.isReady = false;

        this.worker.onmessage = this.handleMessage.bind(this);
        this.worker.onerror = this.handleError.bind(this);

        // Wait for initialization
        this.initPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Worker initialization timeout'));
            }, 30000); // 30 second timeout

            const checkInit = (e) => {
                if (e.data.type === 'init-complete') {
                    clearTimeout(timeout);
                    this.worker.removeEventListener('message', checkInit);

                    if (e.data.success) {
                        this.isReady = true;
                        resolve();
                    } else {
                        reject(new Error(`Worker initialization failed: ${e.data.error}`));
                    }
                }
            };

            this.worker.addEventListener('message', checkInit);
        });
    }

    /**
     * Wait for worker to be ready
     */
    async ready() {
        return this.initPromise;
    }

    /**
     * Handle messages from worker
     */
    handleMessage(e) {
        const { type, id, success, result, error, progress, stage, duration } = e.data;

        switch (type) {
            case 'layout-progress':
                const progressCallback = this.progressCallbacks.get(id);
                if (progressCallback) {
                    progressCallback({ progress, stage });
                }
                break;

            case 'layout-result':
                const request = this.pendingRequests.get(id);
                if (request) {
                    this.pendingRequests.delete(id);
                    this.progressCallbacks.delete(id);

                    if (success) {
                        request.resolve({ result, duration });
                    } else {
                        request.reject(new Error(error));
                    }
                }
                break;
        }
    }

    /**
     * Handle worker errors
     */
    handleError(error) {
        console.error('Worker error:', error);

        // Reject all pending requests
        for (const [id, request] of this.pendingRequests) {
            request.reject(new Error(`Worker error: ${error.message}`));
        }

        this.pendingRequests.clear();
        this.progressCallbacks.clear();
    }

    /**
     * Compute graph layout in background thread
     *
     * @param {Object} graph - Graph data structure
     * @param {Object} options - Layout options
     * @param {Function} onProgress - Optional progress callback
     * @returns {Promise<Object>} Layout result
     */
    async computeLayout(graph, options = {}, onProgress = null) {
        if (!this.isReady) {
            await this.ready();
        }

        const id = this.messageId++;

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });

            if (onProgress) {
                this.progressCallbacks.set(id, onProgress);
            }

            this.worker.postMessage({
                type: 'compute-layout',
                id,
                data: { graph, options }
            });
        });
    }

    /**
     * Terminate the worker
     */
    terminate() {
        this.worker.postMessage({ type: 'terminate' });
        this.worker.terminate();
    }
}

export default BandageLayoutWorker;
