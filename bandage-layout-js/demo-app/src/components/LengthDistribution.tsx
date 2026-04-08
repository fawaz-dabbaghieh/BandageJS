import { useEffect, useRef } from 'react'
import type { Graph } from '../types'

interface LengthDistributionProps {
  graph: Graph
  width?: number
  height?: number
}

export function LengthDistribution({
  graph,
  width = 800,
  height = 200,
}: LengthDistributionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!graph || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas resolution
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    ctx.scale(dpr, dpr)

    // This chart only shows one strand per contig because the app stores both
    // orientations in the graph model, but the length distribution should count
    // each contig once.
    // Clear canvas
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, width, height)

    // Get unique nodes (positive strand only)
    const nodes = graph.nodes
      .filter(n => n.id.endsWith('+'))
      .sort((a, b) => b.length - a.length)

    if (nodes.length === 0) return

    const maxLength = nodes[0]!.length
    const padding = 40
    const chartWidth = width - 2 * padding
    const chartHeight = height - 2 * padding
    const barWidth = chartWidth / nodes.length

    // Draw bars
    nodes.forEach((node, i) => {
      const barHeight = (node.length / maxLength) * chartHeight
      const x = padding + i * barWidth
      const y = padding + chartHeight - barHeight

      // Color based on depth
      const depthFactor = Math.min(node.depth / 50, 2)
      const color =
        depthFactor > 1.5
          ? [231, 76, 60] // Red for high depth (repeats)
          : [52, 152, 219] // Blue for normal

      ctx.fillStyle = `rgba(${color.join(',')}, 0.8)`
      ctx.fillRect(x + 1, y, barWidth - 2, barHeight)

      // Draw node name if there's space
      if (barWidth > 40) {
        ctx.save()
        ctx.translate(x + barWidth / 2, padding + chartHeight + 5)
        ctx.rotate(-Math.PI / 4)
        ctx.fillStyle = '#ccc'
        ctx.font = '9px monospace'
        ctx.textAlign = 'right'
        ctx.fillText(node.name, 0, 0)
        ctx.restore()
      }
    })

    // Draw axes
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padding, padding)
    ctx.lineTo(padding, padding + chartHeight)
    ctx.lineTo(padding + chartWidth, padding + chartHeight)
    ctx.stroke()

    // Draw y-axis labels
    ctx.fillStyle = '#999'
    ctx.font = '10px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'

    for (let i = 0; i <= 4; i++) {
      const value = (maxLength / 4) * i
      const y = padding + chartHeight - (chartHeight / 4) * i
      const label =
        value >= 1000
          ? `${(value / 1000).toFixed(0)}kb`
          : `${value.toFixed(0)}bp`
      ctx.fillText(label, padding - 5, y)
    }

    // Title
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Contig Length Distribution', width / 2, 15)
  }, [graph, width, height])

  return (
    <canvas
      ref={canvasRef}
      style={{
        border: '1px solid #333',
        borderRadius: '8px',
        backgroundColor: '#1a1a1a',
      }}
    />
  )
}
