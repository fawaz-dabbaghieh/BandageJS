import { getGraphStats } from '../data/exampleGraphs'
import type { Graph } from '../types'

interface StatsPanelProps {
  graph: Graph
  layoutDuration: number | null
}

export function StatsPanel({ graph, layoutDuration }: StatsPanelProps) {
  // Stats are derived on demand from the currently loaded graph rather than
  // cached in App state because the computation is small and keeps this panel
  // self-contained.
  const stats = getGraphStats(graph)

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
    return num.toFixed(0)
  }

  return (
    <div className="stats-panel">
      <h3>Graph Statistics</h3>

      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-label">Contigs</div>
          <div className="stat-value">{stats.nodeCount}</div>
        </div>

        <div className="stat-item">
          <div className="stat-label">Edges</div>
          <div className="stat-value">{stats.edgeCount}</div>
        </div>

        <div className="stat-item">
          <div className="stat-label">Total Length</div>
          <div className="stat-value">{formatNumber(stats.totalLength)}bp</div>
        </div>

        <div className="stat-item">
          <div className="stat-label">Length Range</div>
          <div className="stat-value">
            {formatNumber(stats.minLength)} - {formatNumber(stats.maxLength)}bp
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-label">Length Ratio</div>
          <div className="stat-value">{stats.lengthRatio}:1</div>
        </div>

        <div className="stat-item">
          <div className="stat-label">Avg Length</div>
          <div className="stat-value">{formatNumber(stats.avgLength)}bp</div>
        </div>

        <div className="stat-item">
          <div className="stat-label">Median Length</div>
          <div className="stat-value">{formatNumber(stats.medianLength)}bp</div>
        </div>

        <div className="stat-item">
          <div className="stat-label">Depth Range</div>
          <div className="stat-value">
            {stats.minDepth.toFixed(1)}x - {stats.maxDepth.toFixed(1)}x
          </div>
        </div>

        {layoutDuration && (
          <div className="stat-item highlight">
            <div className="stat-label">Layout Time</div>
            <div className="stat-value">{layoutDuration.toFixed(1)}ms</div>
          </div>
        )}
      </div>

      <div className="contigs-list">
        <h4>Contigs (sorted by length)</h4>
        <div className="contigs-scroll">
          {stats.uniqueNodes.map(node => (
            <div key={node.id} className="contig-item">
              <span className="contig-name">{node.name}</span>
              <span className="contig-length">
                {formatNumber(node.length)}bp
              </span>
              <span className="contig-depth">{node.depth.toFixed(1)}x</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
