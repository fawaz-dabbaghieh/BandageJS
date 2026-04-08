import { useEffect, useRef, useState, useCallback } from 'react'
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
} from '@floating-ui/react'
import type {
  LayoutResult,
  Graph,
  Transform,
  ContextMenu,
  DetailsDialog,
  GraphNode,
  ColorScheme,
} from '../types'
import { clampZoom } from '../utils/zoom'

interface GraphCanvasProps {
  layoutResult: LayoutResult
  graph: Graph
  width?: number
  height?: number
  isDarkMode?: boolean
  colorScheme?: ColorScheme
  zoom?: number
  onZoomChange?: (zoom: number) => void
  onInternalZoomChange?: (zoom: number) => void // For display only, doesn't control zoom
  contigThickness?: number
  connectorThickness?: number
  drawLabels?: boolean
  labelLengthThreshold?: number
  drawPaths?: boolean
  // The selector hands the canvas the exact set of path IDs that should remain
  // visible without changing the underlying graph model.
  visiblePathIds?: Set<string>
  debugHitboxes?: boolean // Hidden flag to visualize edge hit areas
}

export function GraphCanvas({
  layoutResult,
  graph,
  width = 800,
  height = 600,
  isDarkMode = true,
  colorScheme = 'uniform',
  zoom,
  onZoomChange,
  onInternalZoomChange,
  contigThickness = 6,
  connectorThickness = 3,
  drawLabels = true,
  labelLengthThreshold = 0,
  drawPaths = true,
  visiblePathIds,
  debugHitboxes = false,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  })
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })

  // Floating UI for tooltip
  const { refs, floatingStyles } = useFloating({
    placement: 'top',
    middleware: [offset(10), flip(), shift({ padding: 5 })],
    whileElementsMounted: autoUpdate,
  })
  const [isDraggingNode, setIsDraggingNode] = useState(false)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [modifiedNodePositions, setModifiedNodePositions] = useState<Record<
    string,
    { x: number; y: number }[]
  > | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenu>({
    visible: false,
    x: 0,
    y: 0,
    nodeId: null,
  })
  const [detailsDialog, setDetailsDialog] = useState<DetailsDialog>({
    visible: false,
    nodeId: null,
  })
  const boundsRef = useRef<{
    minX: number
    maxX: number
    minY: number
    maxY: number
    fitScale: number
    offsetX: number
    offsetY: number
  } | null>(null)

  // Calculate bounds once when layout changes
  useEffect(() => {
    if (!layoutResult) return

    const { nodePositions } = layoutResult
    let minX = Infinity,
      maxX = -Infinity
    let minY = Infinity,
      maxY = -Infinity

    Object.values(nodePositions).forEach(segments => {
      segments.forEach(({ x, y }) => {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      })
    })

    const graphWidth = maxX - minX
    const graphHeight = maxY - minY
    const padding = 40
    const fitScale = Math.min(
      (width - 2 * padding) / graphWidth,
      (height - 2 * padding) / graphHeight,
    )
    const offsetX = (width - graphWidth * fitScale) / 2 - minX * fitScale
    const offsetY = (height - graphHeight * fitScale) / 2 - minY * fitScale

    boundsRef.current = { minX, maxX, minY, maxY, fitScale, offsetX, offsetY }
    setTransform({ scale: fitScale, translateX: offsetX, translateY: offsetY })

    // Notify parent of internal zoom change (for display only)
    if (onInternalZoomChange) {
      onInternalZoomChange(fitScale)
    }

    // Reset modified positions when layout changes
    setModifiedNodePositions(null)
  }, [layoutResult, width, height, onInternalZoomChange])

  // Sync zoom prop to transform (from slider only, no feedback loop)
  useEffect(() => {
    if (zoom === undefined) return

    // Only update if zoom has meaningfully changed
    if (Math.abs(zoom - transform.scale) < 0.0001) {
      return
    }

    // External zoom change (from slider), update transform
    setTransform(prev => {
      const scaleFactor = zoom / prev.scale
      const centerX = width / 2
      const centerY = height / 2

      return {
        scale: zoom,
        translateX: centerX - (centerX - prev.translateX) * scaleFactor,
        translateY: centerY - (centerY - prev.translateY) * scaleFactor,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, width, height])

  // Generate path colors (same logic as in draw function)
  const getPathColor = useCallback(
    (pathName: string): string => {
      if (!graph.paths) return '#888'
      const pathIndex = graph.paths.findIndex(p => p.name === pathName)
      if (pathIndex === -1) return '#888'
      const hueStep = 360 / graph.paths.length
      const hue = pathIndex * hueStep
      return `hsl(${hue}, 70%, 50%)`
    },
    [graph.paths],
  )

  const getVisibleEdgePathIds = useCallback(
    (pathIds?: string[]) => {
      if (!drawPaths || !pathIds || pathIds.length === 0) {
        return []
      }

      if (!visiblePathIds) {
        return pathIds
      }

      // Use one shared filter for drawing, hit testing, and tooltips so every
      // edge interaction reflects the same subset of visible paths.
      return pathIds.filter(pathId => visiblePathIds.has(pathId))
    },
    [drawPaths, visiblePathIds],
  )

  // Color computation based on scheme
  const getNodeColor = useCallback(
    (node: GraphNode): [number, number, number] => {
      switch (colorScheme) {
        case 'uniform':
          // Bandage default: rgb(178, 34, 34) - firebrick red
          return [52, 152, 219]

        case 'random': {
          // Use node ID to generate consistent random color
          let hash = 0
          for (let i = 0; i < node.id.length; i++) {
            hash = node.id.charCodeAt(i) + ((hash << 5) - hash)
          }
          const hue = Math.abs(hash % 360)
          // Convert HSL to RGB
          const s = 0.7
          const l = 0.5
          const c = (1 - Math.abs(2 * l - 1)) * s
          const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
          const m = l - c / 2
          let r = 0,
            g = 0,
            b = 0
          if (hue < 60) {
            r = c
            g = x
            b = 0
          } else if (hue < 120) {
            r = x
            g = c
            b = 0
          } else if (hue < 180) {
            r = 0
            g = c
            b = x
          } else if (hue < 240) {
            r = 0
            g = x
            b = c
          } else if (hue < 300) {
            r = x
            g = 0
            b = c
          } else {
            r = c
            g = 0
            b = x
          }
          return [
            Math.round((r + m) * 255),
            Math.round((g + m) * 255),
            Math.round((b + m) * 255),
          ]
        }

        case 'depth': {
          // Color based on depth - use viridis-like color map
          const allDepths = graph.nodes.map(n => n.depth)
          const minDepth = Math.min(...allDepths)
          const maxDepth = Math.max(...allDepths)
          const normalizedDepth =
            maxDepth > minDepth
              ? (node.depth - minDepth) / (maxDepth - minDepth)
              : 0.5

          // Simple viridis-like gradient
          const t = Math.max(0, Math.min(1, normalizedDepth))
          if (t < 0.25) {
            const s = t / 0.25
            return [
              Math.round(68 + (59 - 68) * s),
              Math.round(1 + (82 - 1) * s),
              Math.round(84 + (139 - 84) * s),
            ]
          } else if (t < 0.5) {
            const s = (t - 0.25) / 0.25
            return [
              Math.round(59 + (33 - 59) * s),
              Math.round(82 + (145 - 82) * s),
              Math.round(139 + (140 - 139) * s),
            ]
          } else if (t < 0.75) {
            const s = (t - 0.5) / 0.25
            return [
              Math.round(33 + (94 - 33) * s),
              Math.round(145 + (201 - 145) * s),
              Math.round(140 + (98 - 140) * s),
            ]
          } else {
            const s = (t - 0.75) / 0.25
            return [
              Math.round(94 + (253 - 94) * s),
              Math.round(201 + (231 - 201) * s),
              Math.round(98 + (37 - 98) * s),
            ]
          }
        }

        case 'gc-content': {
          // For demo purposes, use length as proxy for GC content (would need actual sequence data)
          const allLengths = graph.nodes.map(n => n.length)
          const minLen = Math.min(...allLengths)
          const maxLen = Math.max(...allLengths)
          const normalized =
            maxLen > minLen ? (node.length - minLen) / (maxLen - minLen) : 0.5

          // Red to blue gradient
          const t = Math.max(0, Math.min(1, normalized))
          return [
            Math.round(220 + (50 - 220) * t),
            Math.round(50 + (120 - 50) * t),
            Math.round(50 + (220 - 50) * t),
          ]
        }

        case 'grey':
          // Medium grey color
          return [160, 160, 160]

        default:
          return [52, 152, 219]
      }
    },
    [colorScheme, isDarkMode, graph],
  )

  // Drawing function
  const draw = useCallback(() => {
    if (!layoutResult || !canvasRef.current || !boundsRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas resolution (force redraw by resetting dimensions)
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    ctx.scale(dpr, dpr)

    // Clear canvas with theme-appropriate background
    ctx.fillStyle = isDarkMode ? '#1a1a1a' : '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // Use modified positions if available, otherwise use layout result
    const nodePositions = modifiedNodePositions || layoutResult.nodePositions
    const { scale, translateX, translateY } = transform

    // Helper to transform coordinates
    const transformPoint = (x: number, y: number) => ({
      x: x * scale + translateX,
      y: y * scale + translateY,
    })

    // Helper function to project a point forward from a line segment
    const projectLine = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      distance: number,
    ): [number, number] => {
      const d = Math.hypot(y2 - y1, x2 - x1)
      if (d === 0) return [x2, y2]
      const vx = (x2 - x1) / d
      const vy = (y2 - y1) / d
      return [x2 + distance * vx, y2 + distance * vy]
    }

    // Helper function to draw an arrowhead at a point
    const drawArrowhead = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      angle: number,
      color: string,
      size: number = 12,
    ) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-size, -size / 2)
      ctx.lineTo(-size, size / 2)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    // Helper function to draw a single edge with offset
    const drawEdge = (
      edge: (typeof graph.edges)[0],
      offsetX: number,
      offsetY: number,
      color: string,
      lineWidth: number,
    ) => {
      const fromSegments = nodePositions[edge.from]
      const toSegments = nodePositions[edge.to]

      if (!fromSegments || !toSegments) return

      const fromEnd = fromSegments[fromSegments.length - 1]
      const toStart = toSegments[0]

      if (!fromEnd || !toStart) return

      // Helper to convert color to rgba with transparency
      const addAlphaToColor = (color: string, alpha: number): string => {
        if (color.startsWith('#')) {
          // Handle hex colors - convert to 8-char format (#rrggbbaa)
          const alphaHex = Math.round(alpha * 255)
            .toString(16)
            .padStart(2, '0')
          if (color.length === 4) {
            // #rgb -> #rrggbbaa
            const r = color[1]
            const g = color[2]
            const b = color[3]
            return `#${r}${r}${g}${g}${b}${b}${alphaHex}`
          } else {
            // #rrggbb -> #rrggbbaa
            return `${color}${alphaHex}`
          }
        } else if (color.startsWith('rgb(')) {
          return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
        } else if (color.startsWith('hsl(')) {
          return color.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`)
        } else {
          return color
        }
      }

      // Use slight transparency for lines
      ctx.strokeStyle = addAlphaToColor(color, 0.85)
      ctx.lineWidth = lineWidth

      // Check if this is a self-loop (node connecting to itself)
      const isSelfLoop = edge.from === edge.to

      // Apply offset to all coordinates
      const p1 = transformPoint(fromEnd.x + offsetX, fromEnd.y + offsetY)
      const p2 = transformPoint(toStart.x + offsetX, toStart.y + offsetY)

      if (isSelfLoop) {
        // Use Bandage's approach for self-loops:
        // - Get the last segment of the node to determine direction
        // - Extend it forward to create control points
        // - Calculate perpendicular shift using normal vector
        // - Create two cubic bezier curves forming the loop

        const startLocation = { x: p1.x, y: p1.y }
        const endLocation = { x: p2.x, y: p2.y }

        // Get the direction of the last segment of the node
        let segmentDirX = 1,
          segmentDirY = 0
        if (fromSegments.length >= 2) {
          const prevSeg = fromSegments[fromSegments.length - 2]!
          const lastSeg = fromSegments[fromSegments.length - 1]!
          const dx = lastSeg.x - prevSeg.x
          const dy = lastSeg.y - prevSeg.y
          const len = Math.hypot(dx, dy)
          if (len > 0) {
            segmentDirX = dx / len
            segmentDirY = dy / len
          }
        }

        // Extension length for control points (in graph coordinates)
        const extensionLength = 50 / scale

        // Control points extended along the node direction (with offset)
        const cp1x = fromEnd.x + offsetX + segmentDirX * extensionLength
        const cp1y = fromEnd.y + offsetY + segmentDirY * extensionLength
        const cp2x = toStart.x + offsetX - segmentDirX * extensionLength
        const cp2y = toStart.y + offsetY - segmentDirY * extensionLength

        // Perpendicular shift (normal vector)
        const perpX = -segmentDirY
        const perpY = segmentDirX
        const perpShift = extensionLength

        // Node midpoint in graph coordinates (with offset)
        const nodeMidX = (fromEnd.x + toStart.x) / 2 + offsetX
        const nodeMidY = (fromEnd.y + toStart.y) / 2 + offsetY

        // Transform all points to screen space
        const controlPoint1 = transformPoint(cp1x, cp1y)
        const controlPoint2 = transformPoint(cp2x, cp2y)
        const cp1Shifted = transformPoint(
          cp1x + perpX * perpShift,
          cp1y + perpY * perpShift,
        )
        const nodeMidShifted = transformPoint(
          nodeMidX + perpX * perpShift,
          nodeMidY + perpY * perpShift,
        )
        const cp2Shifted = transformPoint(
          cp2x + perpX * perpShift,
          cp2y + perpY * perpShift,
        )

        // Draw the loop as two cubic bezier curves
        ctx.beginPath()
        ctx.moveTo(startLocation.x, startLocation.y)
        ctx.bezierCurveTo(
          controlPoint1.x,
          controlPoint1.y,
          cp1Shifted.x,
          cp1Shifted.y,
          nodeMidShifted.x,
          nodeMidShifted.y,
        )
        ctx.bezierCurveTo(
          cp2Shifted.x,
          cp2Shifted.y,
          controlPoint2.x,
          controlPoint2.y,
          endLocation.x,
          endLocation.y,
        )
        ctx.stroke()

        // Draw arrowhead at the end of the self-loop
        const angle = Math.atan2(
          endLocation.y - controlPoint2.y,
          endLocation.x - controlPoint2.x,
        )
        drawArrowhead(
          ctx,
          endLocation.x,
          endLocation.y,
          angle,
          addAlphaToColor(color, 0.85),
        )
      } else {
        // Regular edge between different nodes
        // Get trajectory vectors from the node segments
        // For source node: use last two segments to determine exit direction
        let fromPrev = fromSegments[fromSegments.length - 2]
        if (!fromPrev && fromSegments.length > 0) {
          fromPrev = fromSegments[0]
        }

        // For target node: use first two segments to determine entry direction
        let toNext = toSegments[1]
        if (!toNext && toSegments.length > 0) {
          toNext = toSegments[0]
        }

        // Calculate control points by projecting forward along node trajectories
        const projectionDistance = Math.min(
          Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.5,
          80,
        )

        // Project from source node end, following its trajectory
        const [cx1, cy1] = projectLine(
          fromPrev.x,
          fromPrev.y,
          fromEnd.x,
          fromEnd.y,
          projectionDistance / scale,
        )
        const cp1 = transformPoint(cx1 + offsetX, cy1 + offsetY)

        // Project from target node start, following its trajectory backwards
        const [cx2, cy2] = projectLine(
          toNext.x,
          toNext.y,
          toStart.x,
          toStart.y,
          projectionDistance / scale,
        )
        const cp2 = transformPoint(cx2 + offsetX, cy2 + offsetY)

        // Draw cubic bezier curve
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y)
        ctx.stroke()

        // Draw arrowhead at the end point
        // Calculate angle from control point 2 to end point
        const angle = Math.atan2(p2.y - cp2.y, p2.x - cp2.x)
        drawArrowhead(ctx, p2.x, p2.y, angle, addAlphaToColor(color, 0.85))
      }
    }

    // Generate colors for paths (using a simple color scheme)
    const pathColors = new Map<string, string>()
    if (graph.paths) {
      const hueStep = 360 / graph.paths.length
      graph.paths.forEach((path, idx) => {
        const hue = idx * hueStep
        pathColors.set(path.name, `hsl(${hue}, 70%, 50%)`)
      })
    }

    // Draw edges with path offsets
    graph.edges.forEach((edge, edgeIdx) => {
      const isHovered = hoveredEdge === edgeIdx
      const visibleEdgePathIds = getVisibleEdgePathIds(edge.pathIds)
      const numPaths = visibleEdgePathIds.length

      if (!drawPaths || numPaths === 0) {
        // If all paths on this edge are filtered out, fall back to the base
        // connector instead of hiding the underlying topology.
        // No paths or paths disabled - draw single edge with default color
        const edgeColor = isHovered ? '#aaa' : '#777'
        const lineWidth = isHovered
          ? connectorThickness + 1
          : connectorThickness
        drawEdge(edge, 0, 0, edgeColor, lineWidth)
      } else {
        // Multiple paths - draw offset edges for each path
        const fromSegments = nodePositions[edge.from]
        const toSegments = nodePositions[edge.to]
        if (!fromSegments || !toSegments) return

        const fromEnd = fromSegments[fromSegments.length - 1]
        const toStart = toSegments[0]
        if (!fromEnd || !toStart) return

        // Calculate perpendicular offset direction
        const dx = toStart.x - fromEnd.x
        const dy = toStart.y - fromEnd.y
        const len = Math.hypot(dx, dy)
        if (len === 0) return

        // Perpendicular vector (rotated 90 degrees)
        const perpX = -dy / len
        const perpY = dx / len

        // Offset distance in graph coordinates
        const offsetDist = 3 / scale // 3 pixels in screen space

        // Draw each path's edge with offset
        visibleEdgePathIds.forEach((pathId, pathIdx) => {
          // Calculate offset position (spread evenly around center)
          const offset = (pathIdx - (numPaths - 1) / 2) * offsetDist
          const offsetX = perpX * offset
          const offsetY = perpY * offset

          const color = pathColors.get(pathId) ?? '#888'
          const lineWidth = isHovered
            ? connectorThickness + 1
            : connectorThickness
          drawEdge(edge, offsetX, offsetY, color, lineWidth)
        })
      }
    })

    // DEBUG: Draw edge hit areas in transparent pink
    if (debugHitboxes) {
      const edgeThreshold = 10 / scale

      graph.edges.forEach((edge, edgeIdx) => {
        const fromSegments = nodePositions[edge.from]
        const toSegments = nodePositions[edge.to]
        if (!fromSegments || !toSegments) return

        const fromEnd = fromSegments[fromSegments.length - 1]
        const toStart = toSegments[0]
        if (!fromEnd || !toStart) return

        const isSelfLoop = edge.from === edge.to
        const visibleEdgePathIds = getVisibleEdgePathIds(edge.pathIds)
        const numPaths = visibleEdgePathIds.length

        // Helper to draw hit area for edge with offset
        const drawHitArea = (offsetX: number, offsetY: number) => {
          if (isSelfLoop) {
            // Self-loop hit area
            let segmentDirX = 1,
              segmentDirY = 0
            if (fromSegments.length >= 2) {
              const prevSeg = fromSegments[fromSegments.length - 2]!
              const lastSeg = fromSegments[fromSegments.length - 1]!
              const dx = lastSeg.x - prevSeg.x
              const dy = lastSeg.y - prevSeg.y
              const len = Math.hypot(dx, dy)
              if (len > 0) {
                segmentDirX = dx / len
                segmentDirY = dy / len
              }
            }

            const extensionLength = 50 / scale
            const cp1x = fromEnd.x + offsetX + segmentDirX * extensionLength
            const cp1y = fromEnd.y + offsetY + segmentDirY * extensionLength
            const cp2x = toStart.x + offsetX - segmentDirX * extensionLength
            const cp2y = toStart.y + offsetY - segmentDirY * extensionLength

            const perpX = -segmentDirY
            const perpY = segmentDirX
            const perpShift = extensionLength

            const nodeMidX = (fromEnd.x + toStart.x) / 2 + offsetX
            const nodeMidY = (fromEnd.y + toStart.y) / 2 + offsetY

            const cp1ShiftedX = cp1x + perpX * perpShift
            const cp1ShiftedY = cp1y + perpY * perpShift
            const nodeMidShiftedX = nodeMidX + perpX * perpShift
            const nodeMidShiftedY = nodeMidY + perpY * perpShift
            const cp2ShiftedX = cp2x + perpX * perpShift
            const cp2ShiftedY = cp2y + perpY * perpShift

            const p1 = transformPoint(fromEnd.x + offsetX, fromEnd.y + offsetY)
            const cp1 = transformPoint(cp1x, cp1y)
            const cp1s = transformPoint(cp1ShiftedX, cp1ShiftedY)
            const mid = transformPoint(nodeMidShiftedX, nodeMidShiftedY)
            const cp2s = transformPoint(cp2ShiftedX, cp2ShiftedY)
            const cp2 = transformPoint(cp2x, cp2y)
            const p2 = transformPoint(toStart.x + offsetX, toStart.y + offsetY)

            ctx.strokeStyle = 'rgba(255, 105, 180, 0.3)'
            ctx.lineWidth = edgeThreshold * scale
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.bezierCurveTo(cp1.x, cp1.y, cp1s.x, cp1s.y, mid.x, mid.y)
            ctx.bezierCurveTo(cp2s.x, cp2s.y, cp2.x, cp2.y, p2.x, p2.y)
            ctx.stroke()
          } else {
            // Regular edge hit area
            let fromPrev = fromSegments[fromSegments.length - 2]
            if (!fromPrev && fromSegments.length > 0) {
              fromPrev = fromSegments[0]
            }

            let toNext = toSegments[1]
            if (!toNext && toSegments.length > 0) {
              toNext = toSegments[0]
            }

            const distance = Math.hypot(
              toStart.x - fromEnd.x,
              toStart.y - fromEnd.y,
            )
            const projectionDistance = Math.min(distance * 0.5, 80 / scale)

            const projectLine = (
              x1: number,
              y1: number,
              x2: number,
              y2: number,
              dist: number,
            ): [number, number] => {
              const d = Math.hypot(y2 - y1, x2 - x1)
              if (d === 0) return [x2, y2]
              const vx = (x2 - x1) / d
              const vy = (y2 - y1) / d
              return [x2 + dist * vx, y2 + dist * vy]
            }

            const [cx1, cy1] = projectLine(
              fromPrev.x,
              fromPrev.y,
              fromEnd.x,
              fromEnd.y,
              projectionDistance,
            )
            const [cx2, cy2] = projectLine(
              toNext.x,
              toNext.y,
              toStart.x,
              toStart.y,
              projectionDistance,
            )

            const p1 = transformPoint(fromEnd.x + offsetX, fromEnd.y + offsetY)
            const cp1 = transformPoint(cx1 + offsetX, cy1 + offsetY)
            const cp2 = transformPoint(cx2 + offsetX, cy2 + offsetY)
            const p2 = transformPoint(toStart.x + offsetX, toStart.y + offsetY)

            ctx.strokeStyle = 'rgba(255, 105, 180, 0.3)'
            ctx.lineWidth = edgeThreshold * scale
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y)
            ctx.stroke()
          }
        }

        // Draw hit areas for all path offsets or single edge
        if (!drawPaths || numPaths === 0) {
          drawHitArea(0, 0)
        } else {
          const dx = toStart.x - fromEnd.x
          const dy = toStart.y - fromEnd.y
          const len = Math.hypot(dx, dy)
          if (len === 0) return

          const perpX = -dy / len
          const perpY = dx / len
          const offsetDist = 3 / scale

          for (let pathIdx = 0; pathIdx < numPaths; pathIdx++) {
            const offset = (pathIdx - (numPaths - 1) / 2) * offsetDist
            const offsetX = perpX * offset
            const offsetY = perpY * offset
            drawHitArea(offsetX, offsetY)
          }
        }
      })
    }

    // Draw nodes
    Object.entries(nodePositions).forEach(([nodeId, segments]) => {
      const node = graph.nodes.find(n => n.id === nodeId)
      if (!node) return

      // Get color based on selected scheme
      const color = getNodeColor(node)

      const isHovered = hoveredNode === nodeId
      const isSelected = selectedNode === nodeId

      ctx.strokeStyle = `rgb(${color.join(',')})`
      ctx.lineWidth = isSelected
        ? contigThickness + 2
        : isHovered
          ? contigThickness + 1
          : contigThickness
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      ctx.beginPath()
      segments.forEach((segment, i) => {
        const p = transformPoint(segment.x, segment.y)
        if (i === 0) {
          ctx.moveTo(p.x, p.y)
        } else {
          ctx.lineTo(p.x, p.y)
        }
      })
      ctx.stroke()

      // Draw node label if labels are enabled and node is long enough
      if (
        drawLabels &&
        node.length >= labelLengthThreshold &&
        segments.length > 0
      ) {
        const midIdx = Math.floor(segments.length / 2)
        const midPoint = transformPoint(
          segments[midIdx]!.x,
          segments[midIdx]!.y,
        )

        ctx.fillStyle = isDarkMode ? '#fff' : '#000'
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(node.name, midPoint.x, midPoint.y - 5)
      }
    })
  }, [
    layoutResult,
    graph,
    width,
    height,
    transform,
    hoveredNode,
    hoveredEdge,
    selectedNode,
    isDarkMode,
    getNodeColor,
    getVisibleEdgePathIds,
    modifiedNodePositions,
    contigThickness,
    connectorThickness,
    drawLabels,
    labelLengthThreshold,
    drawPaths,
    visiblePathIds,
  ])

  // Redraw when any state changes
  useEffect(() => {
    draw()
  }, [draw])

  // Add wheel event listener with passive: false to prevent page scroll
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const delta = -e.deltaY * 0.001
      const scaleFactor = Math.exp(delta)

      setTransform(prev => {
        const newScale = clampZoom(prev.scale * scaleFactor)
        const actualFactor = newScale / prev.scale

        // Notify parent of internal zoom change (for display only)
        if (onInternalZoomChange && newScale !== prev.scale) {
          onInternalZoomChange(newScale)
        }

        return {
          scale: newScale,
          translateX: mouseX - (mouseX - prev.translateX) * actualFactor,
          translateY: mouseY - (mouseY - prev.translateY) * actualFactor,
        }
      })
    }

    canvas.addEventListener('wheel', wheelHandler, { passive: false })
    return () => canvas.removeEventListener('wheel', wheelHandler)
  }, [onInternalZoomChange])

  // Hit detection helper - distance from point to line segment
  const distanceToSegment = (
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): number => {
    const dx = x2 - x1
    const dy = y2 - y1
    const lenSq = dx * dx + dy * dy

    if (lenSq === 0) return Math.hypot(px - x1, py - y1)

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))

    const closestX = x1 + t * dx
    const closestY = y1 + t * dy

    return Math.hypot(px - closestX, py - closestY)
  }

  // Hit detection helper - distance from point to cubic bezier curve
  const distanceToCubicBezier = (
    px: number,
    py: number,
    x1: number,
    y1: number,
    cx1: number,
    cy1: number,
    cx2: number,
    cy2: number,
    x2: number,
    y2: number,
  ): number => {
    // Sample points along the bezier curve and find minimum distance
    let minDist = Infinity
    const samples = 20 // Number of samples along the curve

    for (let i = 0; i <= samples; i++) {
      const t = i / samples
      const oneMinusT = 1 - t

      // Cubic bezier formula: B(t) = (1-t)^3 * P0 + 3(1-t)^2*t * P1 + 3(1-t)*t^2 * P2 + t^3 * P3
      const bx =
        oneMinusT * oneMinusT * oneMinusT * x1 +
        3 * oneMinusT * oneMinusT * t * cx1 +
        3 * oneMinusT * t * t * cx2 +
        t * t * t * x2
      const by =
        oneMinusT * oneMinusT * oneMinusT * y1 +
        3 * oneMinusT * oneMinusT * t * cy1 +
        3 * oneMinusT * t * t * cy2 +
        t * t * t * y2

      const dist = Math.hypot(px - bx, py - by)
      minDist = Math.min(minDist, dist)
    }

    return minDist
  }

  // Helper function to project a point forward from a line segment (for hit detection)
  const projectLineForHitDetection = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    distance: number,
  ): [number, number] => {
    const d = Math.hypot(y2 - y1, x2 - x1)
    if (d === 0) return [x2, y2]
    const vx = (x2 - x1) / d
    const vy = (y2 - y1) / d
    return [x2 + distance * vx, y2 + distance * vy]
  }

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button === 0) {
        // Left click
        setDragStart({ x: e.clientX, y: e.clientY })
        setContextMenu({ visible: false, x: 0, y: 0, nodeId: null })

        if (hoveredNode) {
          // Prepare for node dragging
          setDraggingNodeId(hoveredNode)
          setSelectedNode(hoveredNode)
        } else {
          // Prepare for view panning
          setIsDragging(true)
        }
      }
    },
    [hoveredNode],
  )

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!layoutResult || !canvasRef.current) return

      const rect = canvasRef.current.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      if (draggingNodeId) {
        // Node dragging - start dragging on first movement
        if (!isDraggingNode) {
          setIsDraggingNode(true)
          // Initialize modified positions if not already done
          if (!modifiedNodePositions) {
            setModifiedNodePositions({ ...layoutResult.nodePositions })
          }
        }

        // Calculate delta in graph coordinates
        const dx = (e.clientX - dragStart.x) / transform.scale
        const dy = (e.clientY - dragStart.y) / transform.scale

        setModifiedNodePositions(prev => {
          const current = prev || layoutResult.nodePositions
          const nodeSegments = current[draggingNodeId]
          if (!nodeSegments) return current

          // Translate all segments of this node
          const updatedSegments = nodeSegments.map(seg => ({
            x: seg.x + dx,
            y: seg.y + dy,
          }))

          return {
            ...current,
            [draggingNodeId]: updatedSegments,
          }
        })

        setDragStart({ x: e.clientX, y: e.clientY })
      } else if (isDragging) {
        // View panning
        const dx = e.clientX - dragStart.x
        const dy = e.clientY - dragStart.y

        setTransform(prev => ({
          ...prev,
          translateX: prev.translateX + dx,
          translateY: prev.translateY + dy,
        }))

        setDragStart({ x: e.clientX, y: e.clientY })
      } else {
        // Hit detection for hover
        const nodePositions =
          modifiedNodePositions || layoutResult.nodePositions
        const { scale, translateX, translateY } = transform

        // Inverse transform to get graph coordinates
        const graphX = (mouseX - translateX) / scale
        const graphY = (mouseY - translateY) / scale

        // Check nodes
        let foundNode: string | null = null
        const nodeThreshold = 5 / scale // Adjust with zoom

        for (const [nodeId, segments] of Object.entries(nodePositions)) {
          for (let i = 0; i < segments.length - 1; i++) {
            const dist = distanceToSegment(
              graphX,
              graphY,
              segments[i]!.x,
              segments[i]!.y,
              segments[i + 1]!.x,
              segments[i + 1]!.y,
            )

            if (dist < nodeThreshold) {
              foundNode = nodeId
              break
            }
          }
          if (foundNode) break
        }

        setHoveredNode(foundNode)

        // Update tooltip position
        if (foundNode) {
          setTooltipPosition({ x: e.clientX, y: e.clientY })
          // Update virtual reference element for floating-ui
          refs.setPositionReference({
            getBoundingClientRect: () => ({
              width: 0,
              height: 0,
              x: e.clientX,
              y: e.clientY,
              top: e.clientY,
              left: e.clientX,
              right: e.clientX,
              bottom: e.clientY,
            }),
          })
        }

        // Check edges
        let foundEdge: number | null = null
        const edgeThreshold = 10 / scale

        for (let edgeIdx = 0; edgeIdx < graph.edges.length; edgeIdx++) {
          const edge = graph.edges[edgeIdx]!

          const fromSegments = nodePositions[edge.from]
          const toSegments = nodePositions[edge.to]

          if (!fromSegments || !toSegments) continue

          const fromEnd = fromSegments[fromSegments.length - 1]
          const toStart = toSegments[0]

          if (!fromEnd || !toStart) continue

          const isSelfLoop = edge.from === edge.to
          const visibleEdgePathIds = getVisibleEdgePathIds(edge.pathIds)
          const numPaths = visibleEdgePathIds.length

          let dist: number

          // Helper to check distance for edge with offset
          const checkEdgeDistance = (
            offsetX: number,
            offsetY: number,
          ): number => {
            if (isSelfLoop) {
              // Hit detection for self-loops (matches the drawing code)
              // Get the direction of the last segment of the node
              let segmentDirX = 1,
                segmentDirY = 0
              if (fromSegments.length >= 2) {
                const prevSeg = fromSegments[fromSegments.length - 2]!
                const lastSeg = fromSegments[fromSegments.length - 1]!
                const dx = lastSeg.x - prevSeg.x
                const dy = lastSeg.y - prevSeg.y
                const len = Math.hypot(dx, dy)
                if (len > 0) {
                  segmentDirX = dx / len
                  segmentDirY = dy / len
                }
              }

              // Extension length for control points (in graph coordinates)
              const extensionLength = 50 / scale

              // Control points extended along the node direction (with offset)
              const cp1x = fromEnd.x + offsetX + segmentDirX * extensionLength
              const cp1y = fromEnd.y + offsetY + segmentDirY * extensionLength
              const cp2x = toStart.x + offsetX - segmentDirX * extensionLength
              const cp2y = toStart.y + offsetY - segmentDirY * extensionLength

              // Perpendicular shift (normal vector)
              const perpX = -segmentDirY
              const perpY = segmentDirX
              const perpShift = extensionLength

              // Node midpoint (with offset)
              const nodeMidX = (fromEnd.x + toStart.x) / 2 + offsetX
              const nodeMidY = (fromEnd.y + toStart.y) / 2 + offsetY

              // Shifted control points
              const cp1ShiftedX = cp1x + perpX * perpShift
              const cp1ShiftedY = cp1y + perpY * perpShift
              const nodeMidShiftedX = nodeMidX + perpX * perpShift
              const nodeMidShiftedY = nodeMidY + perpY * perpShift
              const cp2ShiftedX = cp2x + perpX * perpShift
              const cp2ShiftedY = cp2y + perpY * perpShift

              // Check distance to both halves of the loop
              const dist1 = distanceToCubicBezier(
                graphX,
                graphY,
                fromEnd.x + offsetX,
                fromEnd.y + offsetY,
                cp1x,
                cp1y,
                cp1ShiftedX,
                cp1ShiftedY,
                nodeMidShiftedX,
                nodeMidShiftedY,
              )

              const dist2 = distanceToCubicBezier(
                graphX,
                graphY,
                nodeMidShiftedX,
                nodeMidShiftedY,
                cp2ShiftedX,
                cp2ShiftedY,
                cp2x,
                cp2y,
                toStart.x + offsetX,
                toStart.y + offsetY,
              )

              return Math.min(dist1, dist2)
            } else {
              // Regular edge hit detection
              // Get trajectory vectors (same as drawing)
              let fromPrev = fromSegments[fromSegments.length - 2]
              if (!fromPrev && fromSegments.length > 0) {
                fromPrev = fromSegments[0]
              }

              let toNext = toSegments[1]
              if (!toNext && toSegments.length > 0) {
                toNext = toSegments[0]
              }

              // Calculate control points (same as drawing)
              const distance = Math.hypot(
                toStart.x - fromEnd.x,
                toStart.y - fromEnd.y,
              )
              const projectionDistance = Math.min(distance * 0.5, 80 / scale)

              const [cx1, cy1] = projectLineForHitDetection(
                fromPrev.x,
                fromPrev.y,
                fromEnd.x,
                fromEnd.y,
                projectionDistance,
              )

              const [cx2, cy2] = projectLineForHitDetection(
                toNext.x,
                toNext.y,
                toStart.x,
                toStart.y,
                projectionDistance,
              )

              return distanceToCubicBezier(
                graphX,
                graphY,
                fromEnd.x + offsetX,
                fromEnd.y + offsetY,
                cx1 + offsetX,
                cy1 + offsetY,
                cx2 + offsetX,
                cy2 + offsetY,
                toStart.x + offsetX,
                toStart.y + offsetY,
              )
            }
          }

          // Check hit detection - either for single edge or all path offsets
          if (!drawPaths || numPaths === 0) {
            // Single edge, no offsets
            dist = checkEdgeDistance(0, 0)
          } else {
            // Multiple paths - check each offset
            const dx = toStart.x - fromEnd.x
            const dy = toStart.y - fromEnd.y
            const len = Math.hypot(dx, dy)

            if (len === 0) continue

            // Perpendicular vector (rotated 90 degrees)
            const perpX = -dy / len
            const perpY = dx / len

            // Offset distance in graph coordinates
            const offsetDist = 3 / scale

            let minDist = Infinity
            for (let pathIdx = 0; pathIdx < numPaths; pathIdx++) {
              const offset = (pathIdx - (numPaths - 1) / 2) * offsetDist
              const offsetX = perpX * offset
              const offsetY = perpY * offset
              const d = checkEdgeDistance(offsetX, offsetY)
              minDist = Math.min(minDist, d)
            }
            dist = minDist
          }

          if (dist < edgeThreshold) {
            foundEdge = edgeIdx
            break
          }
        }

        setHoveredEdge(foundEdge)

        // Update tooltip position for edges
        if (foundEdge !== null && !foundNode) {
          setTooltipPosition({ x: e.clientX, y: e.clientY })
          // Update virtual reference element for floating-ui
          refs.setPositionReference({
            getBoundingClientRect: () => ({
              width: 0,
              height: 0,
              x: e.clientX,
              y: e.clientY,
              top: e.clientY,
              left: e.clientX,
              right: e.clientX,
              bottom: e.clientY,
            }),
          })
        }

        // Update cursor
        canvasRef.current.style.cursor =
          foundNode || foundEdge
            ? 'pointer'
            : isDragging || isDraggingNode
              ? 'grabbing'
              : 'default'
      }
    },
    [
      layoutResult,
      isDragging,
      isDraggingNode,
      draggingNodeId,
      dragStart,
      transform,
      graph,
      modifiedNodePositions,
      refs,
    ],
  )

  // Handle mouse up
  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // If we were preparing to drag a node but didn't actually drag, show context menu
      if (draggingNodeId && !isDraggingNode && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        setContextMenu({
          visible: true,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          nodeId: draggingNodeId,
        })
      }

      setIsDragging(false)
      setIsDraggingNode(false)
      setDraggingNodeId(null)
    },
    [draggingNodeId, isDraggingNode],
  )

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu.visible) return

    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.context-menu')) {
        setContextMenu({ visible: false, x: 0, y: 0, nodeId: null })
      }
    }

    // Delay attaching the handler to avoid immediate closure
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu.visible])

  // Close details dialog with Escape key
  useEffect(() => {
    if (!detailsDialog.visible) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetailsDialog({ visible: false, nodeId: null })
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [detailsDialog.visible])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          border: isDarkMode ? '1px solid #333' : '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
          cursor: 'default',
          display: 'block',
        }}
      />

      {/* Context menu */}
      {contextMenu.visible && (
        <div
          className="context-menu"
          style={{
            position: 'absolute',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            background: isDarkMode ? '#2a2a2a' : 'white',
            border: isDarkMode ? '1px solid #555' : '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            zIndex: 1000,
            minWidth: '150px',
          }}
        >
          <button
            onClick={e => {
              e.stopPropagation()
              setDetailsDialog({ visible: true, nodeId: contextMenu.nodeId })
              setContextMenu({ visible: false, x: 0, y: 0, nodeId: null })
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              color: isDarkMode ? '#e0e0e0' : '#333',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = isDarkMode
                ? '#3a3a3a'
                : '#f0f0f0'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            View Details
          </button>
        </div>
      )}

      {/* Details dialog */}
      {detailsDialog.visible &&
        (() => {
          const node = graph.nodes.find(n => n.id === detailsDialog.nodeId)
          if (!node) return null

          return (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000,
              }}
              onClick={() => setDetailsDialog({ visible: false, nodeId: null })}
            >
              <div
                style={{
                  background: isDarkMode ? '#2a2a2a' : 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  maxWidth: '500px',
                  width: '90%',
                  color: isDarkMode ? '#e0e0e0' : '#333',
                }}
                onClick={e => e.stopPropagation()}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '15px',
                    borderBottom: isDarkMode
                      ? '1px solid #444'
                      : '1px solid #ddd',
                    paddingBottom: '10px',
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '18px' }}>Node Details</h3>
                  <button
                    onClick={() =>
                      setDetailsDialog({ visible: false, nodeId: null })
                    }
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '24px',
                      cursor: 'pointer',
                      color: isDarkMode ? '#aaa' : '#666',
                      padding: 0,
                      width: '30px',
                      height: '30px',
                    }}
                  >
                    ×
                  </button>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div>
                    <strong>ID:</strong> {node.id}
                  </div>
                  <div>
                    <strong>Name:</strong> {node.name}
                  </div>
                  <div>
                    <strong>Length:</strong> {node.length.toLocaleString()} bp
                  </div>
                  <div>
                    <strong>Depth:</strong> {node.depth.toFixed(2)}×
                  </div>
                  <div>
                    <strong>Strand:</strong>{' '}
                    {node.id.endsWith('+') ? 'Positive (+)' : 'Negative (-)'}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

      {/* Tooltip for nodes */}
      {hoveredNode &&
        !isDragging &&
        !isDraggingNode &&
        (() => {
          const node = graph.nodes.find(n => n.id === hoveredNode)
          if (!node) return null

          return (
            <div
              ref={refs.setFloating}
              style={{
                ...floatingStyles,
                position: 'absolute',
                background: isDarkMode ? '#2a2a2a' : 'white',
                border: isDarkMode ? '1px solid #555' : '1px solid #ccc',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '13px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                zIndex: 1000,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <div style={{ color: isDarkMode ? '#fff' : '#000' }}>
                <div>
                  <strong>{node.name}</strong>
                </div>
                <div
                  style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}
                >
                  {node.length.toLocaleString()} bp • {node.depth.toFixed(2)}×
                  depth
                </div>
              </div>
            </div>
          )
        })()}

      {/* Tooltip for edges */}
      {hoveredEdge !== null &&
        !hoveredNode &&
        !isDragging &&
        !isDraggingNode &&
        (() => {
          const edge = graph.edges[hoveredEdge]
          if (!edge) return null
          // When path overlays are enabled, the tooltip mirrors the filtered
          // set so the count matches what the user can currently see.
          const visibleEdgePathIds = drawPaths
            ? getVisibleEdgePathIds(edge.pathIds)
            : edge.pathIds ?? []

          const fromNode = graph.nodes.find(n => n.id === edge.from)
          const toNode = graph.nodes.find(n => n.id === edge.to)
          if (!fromNode || !toNode) return null

          return (
            <div
              ref={refs.setFloating}
              style={{
                ...floatingStyles,
                position: 'absolute',
                background: isDarkMode ? '#2a2a2a' : 'white',
                border: isDarkMode ? '1px solid #555' : '1px solid #ccc',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '13px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                zIndex: 1000,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <div style={{ color: isDarkMode ? '#fff' : '#000' }}>
                <div>
                  <strong>Connection</strong>
                </div>
                <div
                  style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}
                >
                  {fromNode.name} → {toNode.name}
                </div>
                {edge.pathIds && edge.pathIds.length > 0 && (
                  <div
                    style={{
                      fontSize: '11px',
                      marginTop: '6px',
                      paddingTop: '6px',
                      borderTop: isDarkMode
                        ? '1px solid #444'
                        : '1px solid #ddd',
                    }}
                  >
                    <div style={{ marginBottom: '3px', opacity: 0.9 }}>
                      <strong>
                        Paths ({visibleEdgePathIds.length}
                        {visibleEdgePathIds.length !== edge.pathIds.length
                          ? ` visible / ${edge.pathIds.length} total`
                          : ''}
                        ):
                      </strong>
                    </div>
                    {visibleEdgePathIds.map(pathId => (
                      <div
                        key={pathId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginLeft: '8px',
                          opacity: 0.8,
                        }}
                      >
                        <div
                          style={{
                            width: '12px',
                            height: '12px',
                            backgroundColor: getPathColor(pathId),
                            borderRadius: '2px',
                            flexShrink: 0,
                          }}
                        />
                        {pathId}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })()}
    </div>
  )
}
