import { exampleGraphs } from '../data/exampleGraphs'

interface GraphSelectorProps {
  selectedGraph: string
  onSelectGraph: (key: string) => void
}

export function GraphSelector({
  selectedGraph,
  onSelectGraph,
}: GraphSelectorProps) {
  // This selector is for the built-in sample graphs defined in exampleGraphs;
  // loading real GFA files goes through the main App file menu instead.
  return (
    <div className="graph-selector">
      <label>
        <strong>Select Graph:</strong>
      </label>
      <div className="graph-buttons">
        {Object.entries(exampleGraphs).map(([key, graph]) => (
          <button
            key={key}
            className={`graph-button ${selectedGraph === key ? 'active' : ''}`}
            onClick={() => onSelectGraph(key)}
          >
            <div className="graph-button-title">{graph.name}</div>
            <div className="graph-button-desc">{graph.description}</div>
            <div className="graph-button-stats">
              {graph.nodes.filter(n => n.id.endsWith('+')).length} contigs,{' '}
              {graph.edges.length / 2} edges
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
