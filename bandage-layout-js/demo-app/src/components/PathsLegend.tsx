import { useMemo, useState } from 'react'
import type { GraphPath } from '../types'

interface PathsLegendProps {
  paths: GraphPath[]
  isDarkMode?: boolean
  selectedPathNames: string[]
  onTogglePath: (pathName: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}

export function PathsLegend({
  paths,
  isDarkMode = true,
  selectedPathNames,
  onTogglePath,
  onSelectAll,
  onDeselectAll,
}: PathsLegendProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Generate colors matching GraphCanvas
  const hueStep = 360 / paths.length
  const pathColors = paths.map((_, idx) => {
    const hue = idx * hueStep
    return `hsl(${hue}, 70%, 50%)`
  })
  const selectedPathNameSet = new Set(selectedPathNames)
  // Search narrows the list in the panel only; selection state still lives in
  // App so filtering the list never clears an existing selection.
  const filteredPaths = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) {
      return paths
    }

    return paths.filter(path => path.name.toLowerCase().includes(normalizedQuery))
  }, [paths, searchQuery])

  return (
    <div
      style={{
        background: isDarkMode ? '#2a2a2a' : '#f5f5f5',
        border: isDarkMode ? '1px solid #444' : '1px solid #ddd',
        borderRadius: '8px',
        padding: '12px',
        marginTop: '10px',
      }}
    >
      <div
        style={{
          fontSize: '13px',
          fontWeight: 'bold',
          marginBottom: '8px',
          color: isDarkMode ? '#e0e0e0' : '#333',
        }}
      >
        Paths
      </div>
      {/* Large path sets are easier to work with when the panel can be filtered
          independently of the graph rendering state. */}
      <input
        type="search"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search paths..."
        style={{
          width: '100%',
          boxSizing: 'border-box',
          marginBottom: '10px',
          padding: '8px 10px',
          borderRadius: '6px',
          border: isDarkMode ? '1px solid #555' : '1px solid #ccc',
          background: isDarkMode ? '#1f1f1f' : '#fff',
          color: isDarkMode ? '#e0e0e0' : '#333',
          fontSize: '13px',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={onSelectAll}
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            border: isDarkMode ? '1px solid #555' : '1px solid #ccc',
            background: isDarkMode ? '#3a3a3a' : '#fff',
            color: isDarkMode ? '#e0e0e0' : '#333',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Select all
        </button>
        <button
          type="button"
          onClick={onDeselectAll}
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            border: isDarkMode ? '1px solid #555' : '1px solid #ccc',
            background: isDarkMode ? '#3a3a3a' : '#fff',
            color: isDarkMode ? '#e0e0e0' : '#333',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Deselect all
        </button>
        <span
          style={{
            color: isDarkMode ? '#aaa' : '#666',
            fontSize: '12px',
            marginLeft: 'auto',
          }}
        >
          {selectedPathNames.length} / {paths.length} selected
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          maxHeight: '320px',
          overflowY: 'auto',
          paddingRight: '4px',
        }}
      >
        {filteredPaths.map(path => {
          // Keep each path's color stable even when the visible list is filtered
          // or reordered by search.
          const idx = paths.findIndex(candidate => candidate.name === path.name)

          return (
          <label
            key={path.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              opacity: selectedPathNameSet.has(path.name) ? 1 : 0.55,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={selectedPathNameSet.has(path.name)}
              onChange={() => onTogglePath(path.name)}
            />
            <div
              style={{
                width: '30px',
                height: '3px',
                backgroundColor: pathColors[idx],
                borderRadius: '2px',
                flexShrink: 0,
              }}
            />
            <span
              title={path.name}
              style={{
                color: isDarkMode ? '#ccc' : '#555',
                // Long path names are truncated in the row, but the full value
                // remains available via the title tooltip.
                minWidth: 0,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {path.name}
            </span>
            <span
              style={{
                color: isDarkMode ? '#888' : '#999',
                fontSize: '11px',
                marginLeft: 'auto',
                flexShrink: 0,
              }}
            >
              {path.nodeIds.length} nodes
            </span>
          </label>
          )
        })}
        {filteredPaths.length === 0 && (
          <div
            style={{
              color: isDarkMode ? '#888' : '#777',
              fontSize: '12px',
              padding: '8px 2px',
            }}
          >
            No paths match "{searchQuery}".
          </div>
        )}
      </div>
    </div>
  )
}
