/**
 * Bandage Layout JavaScript Wrapper
 * Provides a clean API over the Emscripten-compiled WASM module
 */

import createBandageLayoutModule from './bandage-layout.js';

export class BandageLayout {
    constructor() {
        this.module = null;
        this.ready = false;
    }

    /**
     * Initialize the WASM module
     * Must be called before using computeLayout
     */
    async init() {
        if (this.ready) return;

        this.module = await createBandageLayoutModule();
        this.ready = true;
    }

    /**
     * Compute graph layout
     *
     * @param {Object} graph - Graph data structure
     * @param {Array} graph.nodes - Array of node objects {id, name, length, depth}
     * @param {Array} graph.edges - Array of edge objects {from, to, overlap?, type?}
     * @param {Object} options - Layout options
     * @param {number} options.quality - Layout quality (0-4, default: 1)
     * @param {boolean} options.linearLayout - Use linear layout (default: false)
     * @param {number} options.componentSeparation - Space between components (default: 15.0)
     * @param {number} options.aspectRatio - Desired aspect ratio (default: 1.333333)
     * @param {number} options.nodeLengthPerMegabase - Node length scaling (default: 1000.0)
     * @param {number} options.minimumNodeLength - Minimum node length (default: 1.0)
     * @param {number} options.nodeSegmentLength - Node segment length (default: 1.0)
     * @param {number} options.edgeLength - Edge length (default: 1.0)
     * @returns {Object} Layout result with nodePositions
     */
    computeLayout(graph, options = {}) {
        if (!this.ready) {
            throw new Error('BandageLayout not initialized. Call init() first.');
        }

        // Validate graph structure
        if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
            throw new Error('Invalid graph structure. Expected {nodes: [], edges: []}');
        }

        // Set default options
        const layoutOptions = {
            quality: 1,
            linearLayout: false,
            componentSeparation: 15.0,
            aspectRatio: 1.333333,
            nodeLengthPerMegabase: 1000.0,
            minimumNodeLength: 1.0,
            nodeSegmentLength: 1.0,
            edgeLength: 1.0,
            ...options
        };

        // Validate quality range
        if (layoutOptions.quality < 0 || layoutOptions.quality > 4) {
            throw new Error('Quality must be between 0 and 4');
        }

        // Call WASM function
        try {
            const result = this.module.computeLayout(graph, layoutOptions);
            return result;
        } catch (error) {
            throw new Error(`Layout computation failed: ${error.message}`);
        }
    }

    /**
     * Check if module is initialized
     */
    isReady() {
        return this.ready;
    }
}

/**
 * Convenience function to create and initialize layout engine
 */
export async function createBandageLayout() {
    const layout = new BandageLayout();
    await layout.init();
    return layout;
}

export default BandageLayout;
