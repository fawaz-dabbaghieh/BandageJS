/**
 * Bandage Layout Web Worker
 * Performs graph layout computation in a background thread
 */

import { BandageLayout } from './bandage-layout-wrapper.js';

let layoutEngine = null;
let isInitialized = false;

// Initialize the layout engine
async function initialize() {
    if (isInitialized) return;

    try {
        layoutEngine = new BandageLayout();
        await layoutEngine.init();
        isInitialized = true;

        self.postMessage({
            type: 'init-complete',
            success: true
        });
    } catch (error) {
        self.postMessage({
            type: 'init-complete',
            success: false,
            error: error.message
        });
    }
}

// Handle messages from main thread
self.onmessage = async function(e) {
    const { type, id, data } = e.data;

    switch (type) {
        case 'init':
            await initialize();
            break;

        case 'compute-layout':
            if (!isInitialized) {
                self.postMessage({
                    type: 'layout-result',
                    id,
                    success: false,
                    error: 'Worker not initialized'
                });
                return;
            }

            try {
                const { graph, options } = data;

                // Send progress update
                self.postMessage({
                    type: 'layout-progress',
                    id,
                    progress: 0,
                    stage: 'Starting layout computation'
                });

                const startTime = performance.now();

                // Compute layout
                const result = layoutEngine.computeLayout(graph, options);

                const endTime = performance.now();
                const duration = endTime - startTime;

                // Send result
                self.postMessage({
                    type: 'layout-result',
                    id,
                    success: true,
                    result,
                    duration
                });
            } catch (error) {
                self.postMessage({
                    type: 'layout-result',
                    id,
                    success: false,
                    error: error.message
                });
            }
            break;

        case 'terminate':
            self.close();
            break;

        default:
            console.error('Unknown message type:', type);
    }
};

// Auto-initialize when worker is created
initialize();
