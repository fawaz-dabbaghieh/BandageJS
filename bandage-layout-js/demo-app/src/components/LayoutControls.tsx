import { useState } from 'react'
import type { LayoutOptions, ColorScheme } from '../types'
import { MIN_ZOOM, MAX_ZOOM, formatZoomPercent } from '../utils/zoom'

interface LayoutControlsProps {
  options: LayoutOptions
  onChange: (options: LayoutOptions) => void
  onCompute: () => void
  isComputing: boolean
  colorScheme: ColorScheme
  onColorSchemeChange: (scheme: ColorScheme) => void
  zoom: number
  onZoomChange: (zoom: number) => void
  contigThickness: number
  onContigThicknessChange: (thickness: number) => void
  connectorThickness: number
  onConnectorThicknessChange: (thickness: number) => void
  drawLabels: boolean
  onDrawLabelsChange: (draw: boolean) => void
  labelLengthThreshold: number
  onLabelLengthThresholdChange: (threshold: number) => void
  drawPaths: boolean
  onDrawPathsChange: (draw: boolean) => void
  hasPathsInGraph: boolean
}

export function LayoutControls({
  options,
  onChange,
  onCompute,
  isComputing,
  colorScheme,
  onColorSchemeChange,
  zoom,
  onZoomChange,
  contigThickness,
  onContigThicknessChange,
  connectorThickness,
  onConnectorThicknessChange,
  drawLabels,
  onDrawLabelsChange,
  labelLengthThreshold,
  onLabelLengthThresholdChange,
  drawPaths,
  onDrawPathsChange,
  hasPathsInGraph,
}: LayoutControlsProps) {
  // The control panel is split into a "general" section for day-to-day viewing
  // tweaks and an "advanced" section for layout parameters that can change the
  // overall geometry more dramatically.
  const [generalExpanded, setGeneralExpanded] = useState(true)
  const [advancedExpanded, setAdvancedExpanded] = useState(false)

  return (
    <div className="layout-controls">
      <div className="advanced-settings">
        <button
          className="advanced-toggle"
          onClick={() => setGeneralExpanded(!generalExpanded)}
        >
          <span className={`arrow ${generalExpanded ? 'expanded' : ''}`}>
            ▶
          </span>
          General Settings
        </button>

        {generalExpanded && (
          <div className="advanced-content">
            <div className="control-group">
              <label>
                <strong>Color Scheme:</strong>
              </label>
              <select
                value={colorScheme}
                onChange={e =>
                  onColorSchemeChange(e.target.value as ColorScheme)
                }
                disabled={isComputing}
                className="color-scheme-select"
              >
                <option value="uniform">Uniform Color</option>
                <option value="random">Rainbow</option>
                <option value="depth">Color by Depth</option>
                <option value="gc-content">Color by Length (GC proxy)</option>
                <option value="grey">Grey</option>
              </select>
            </div>

            <div className="control-group">
              <label>
                <strong>Zoom:</strong>
                <span className="control-value">{formatZoomPercent(zoom)}</span>
              </label>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step="0.01"
                value={zoom}
                onChange={e => onZoomChange(parseFloat(e.target.value))}
                disabled={isComputing}
              />
              <div className="control-hint">
                Zoom in/out on the graph ({formatZoomPercent(MIN_ZOOM)} -{' '}
                {formatZoomPercent(MAX_ZOOM)})
              </div>
            </div>

            <div className="control-group">
              <label>
                <strong>Contig Thickness:</strong>
                <span className="control-value">
                  {contigThickness.toFixed(1)}px
                </span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={contigThickness}
                onChange={e =>
                  onContigThicknessChange(parseFloat(e.target.value))
                }
                disabled={isComputing}
              />
              <div className="control-hint">Thickness of contig lines</div>
            </div>

            <div className="control-group">
              <label>
                <strong>Connector Thickness:</strong>
                <span className="control-value">
                  {connectorThickness.toFixed(1)}px
                </span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={connectorThickness}
                onChange={e =>
                  onConnectorThicknessChange(parseFloat(e.target.value))
                }
                disabled={isComputing}
              />
              <div className="control-hint">
                Thickness of connector lines (edges)
              </div>
            </div>

            <div className="control-group">
              <label>
                <input
                  type="checkbox"
                  checked={options.linearLayout}
                  onChange={e =>
                    onChange({ ...options, linearLayout: e.target.checked })
                  }
                  disabled={isComputing}
                />{' '}
                Linear Layout
              </label>
              <div className="control-hint">
                Use linear positioning instead of force-directed
              </div>
            </div>

            <div className="control-group">
              <label>
                <input
                  type="checkbox"
                  checked={drawLabels}
                  onChange={e => onDrawLabelsChange(e.target.checked)}
                  disabled={isComputing}
                />{' '}
                Draw Labels
              </label>
              <div className="control-hint">Show contig names on the graph</div>
            </div>

            <div className="control-group">
              <label>
                <input
                  type="checkbox"
                  checked={drawPaths}
                  onChange={e => onDrawPathsChange(e.target.checked)}
                  disabled={isComputing || !hasPathsInGraph}
                />{' '}
                Draw Paths{!hasPathsInGraph && ' (no paths present)'}
              </label>
              <div className="control-hint">
                Show multiple colored lines for paths
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="advanced-settings">
        <button
          className="advanced-toggle"
          onClick={() => setAdvancedExpanded(!advancedExpanded)}
        >
          <span className={`arrow ${advancedExpanded ? 'expanded' : ''}`}>
            ▶
          </span>
          Advanced Settings
        </button>

        {advancedExpanded && (
          <div className="advanced-content">
            <div className="control-group">
              <label>
                <strong>Quality Level:</strong>
                <span className="control-value">{options.quality}</span>
              </label>
              <input
                type="range"
                min="0"
                max="4"
                value={options.quality}
                onChange={e =>
                  onChange({ ...options, quality: parseInt(e.target.value) })
                }
                disabled={isComputing}
              />
              <div className="control-hint">
                Higher = better layout, slower computation
              </div>
            </div>

            <div className="control-group">
              <label>
                <strong>Edge Length:</strong>
                <span className="control-value">
                  {options.edgeLength.toFixed(0)}
                </span>
              </label>
              <input
                type="range"
                min="1"
                max="100000"
                step="100"
                value={options.edgeLength}
                onChange={e =>
                  onChange({
                    ...options,
                    edgeLength: parseFloat(e.target.value),
                  })
                }
                disabled={isComputing}
              />
              <div className="control-hint">
                Distance between connected contigs (scales with node length)
              </div>
            </div>

            <div className="control-group">
              <label>
                <strong>Component Separation:</strong>
                <span className="control-value">
                  {options.componentSeparation.toFixed(1)}
                </span>
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={options.componentSeparation}
                onChange={e =>
                  onChange({
                    ...options,
                    componentSeparation: parseFloat(e.target.value),
                  })
                }
                disabled={isComputing}
              />
              <div className="control-hint">
                Space between disconnected components
              </div>
            </div>

            <div className="control-group">
              <label>
                <strong>Node Length Per Megabase:</strong>
                <span className="control-value">
                  {options.nodeLengthPerMegabase.toFixed(0)}
                </span>
              </label>
              <input
                type="range"
                min="500"
                max="5000"
                step="500"
                value={options.nodeLengthPerMegabase}
                onChange={e =>
                  onChange({
                    ...options,
                    nodeLengthPerMegabase: parseFloat(e.target.value),
                  })
                }
                disabled={isComputing}
              />
              <div className="control-hint">
                Controls visual scale based on sequence length
              </div>
            </div>

            <div className="control-group">
              <label>
                <strong>Label Length Threshold:</strong>
                <span className="control-value">
                  {labelLengthThreshold.toLocaleString()} bp
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="100000"
                step="1000"
                value={labelLengthThreshold}
                onChange={e =>
                  onLabelLengthThresholdChange(parseFloat(e.target.value))
                }
                disabled={isComputing}
              />
              <div className="control-hint">
                Only show labels on contigs longer than this
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        className="compute-button"
        onClick={onCompute}
        disabled={isComputing}
      >
        {isComputing ? 'Redrawing...' : 'Redraw'}
      </button>
    </div>
  )
}
