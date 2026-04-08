// Mock layout worker for development before WASM is built
// Generates fake layout positions for testing the UI

export class MockBandageLayoutWorker {
  constructor() {
    // Mirror the real worker API closely so the UI can swap between the mock
    // and WASM implementations without special cases.
    this._ready = Promise.resolve()
  }

  async ready() {
    return this._ready
  }

  async computeLayout(graph, options) {
    const startTime = performance.now()

    // Simulate computation delay based on graph size
    const nodeCount = graph.nodes.length
    const delay = Math.min(100 + nodeCount * 2, 1000)
    await new Promise(resolve => setTimeout(resolve, delay))

    // Generate deterministic-looking geometry that is "good enough" for UI
    // development without requiring the actual WASM layout engine.
    // Create mock positions with smooth curves
    const nodePositions = {}
    const uniqueNodes = graph.nodes.filter(n => n.id.endsWith('+'))

    // Create a force-directed-like layout with smooth curves
    const angleStep = (2 * Math.PI) / uniqueNodes.length
    const baseRadius = 150

    uniqueNodes.forEach((node, index) => {
      const angle = index * angleStep

      // Vary radius slightly for visual interest
      const radiusVariation = Math.sin(index * 1.3) * 30
      const radius = baseRadius + radiusVariation

      // Calculate start position on circle
      const startX = Math.cos(angle) * radius
      const startY = Math.sin(angle) * radius

      // Create many segments based on node length for smooth curves
      // Use nodeLengthPerMegabase to scale properly
      const lengthScale = options.nodeLengthPerMegabase / 1000000
      const visualLength = node.length * lengthScale
      const segmentLength = options.nodeSegmentLength || 5.0
      const segmentCount = Math.max(
        10,
        Math.floor(visualLength / segmentLength),
      )

      const segments = []

      // Create a smooth bezier-like curve
      for (let i = 0; i < segmentCount; i++) {
        const t = i / (segmentCount - 1)

        // Create curved path using sine wave perturbation
        const curveAmount = visualLength * 0.15
        const frequency = 2.0 + (index % 3) * 0.5

        // Tangent direction
        const tangentAngle = angle + Math.PI / 2
        const curvature = Math.sin(t * Math.PI * frequency) * curveAmount

        const x =
          startX +
          Math.cos(tangentAngle) * t * visualLength +
          Math.cos(tangentAngle + Math.PI / 2) * curvature
        const y =
          startY +
          Math.sin(tangentAngle) * t * visualLength +
          Math.sin(tangentAngle + Math.PI / 2) * curvature

        segments.push({ x, y })
      }

      nodePositions[node.id] = segments

      // Create reverse complement positions (offset slightly)
      const rcId = node.id.replace('+', '-')
      const rcOffset = 3
      nodePositions[rcId] = segments.map(s => ({
        x: s.x + Math.cos(angle) * rcOffset,
        y: s.y + Math.sin(angle) * rcOffset,
      }))
    })

    const duration = performance.now() - startTime

    return {
      result: {
        nodePositions,
        componentCount: 1,
      },
      duration,
    }
  }

  terminate() {
    // Mock terminate
  }
}
