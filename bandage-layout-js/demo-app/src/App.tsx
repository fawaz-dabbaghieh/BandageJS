import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { GraphCanvas } from './components/GraphCanvas'
import { LengthDistribution } from './components/LengthDistribution'
import { LayoutControls } from './components/LayoutControls'
import { PathsLegend } from './components/PathsLegend'
import { StatsPanel } from './components/StatsPanel'
import { urlExamples } from './data/urlExamples'
import { BandageLayoutWorker } from './utils/BandageLayoutWorker'
import { parseGFA } from './utils/gfaParser'
import { convertGFAToGraph } from './utils/gfaConverter'
import { clampZoom } from './utils/zoom'
import type { LayoutOptions, LayoutResult, ColorScheme, Graph } from './types'
import './App.css'

interface AppProps {
  worker: BandageLayoutWorker
}

function App({ worker }: AppProps) {
  const [layoutOptions, setLayoutOptions] = useState<LayoutOptions>({
    quality: 2,
    linearLayout: false,
    componentSeparation: 15.0,
    aspectRatio: 1.5,
    nodeLengthPerMegabase: 2000.0,
    minimumNodeLength: 3.0,
    nodeSegmentLength: 5.0,
    edgeLength: 2.0,
  })
  const [layoutResult, setLayoutResult] = useState<LayoutResult | null>(null)
  const [layoutDuration, setLayoutDuration] = useState<number | null>(null)
  const [isComputing, setIsComputing] = useState(false)
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [examplesMenuOpen, setExamplesMenuOpen] = useState(false)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [statsDialogOpen, setStatsDialogOpen] = useState(false)
  const [urlDialogOpen, setUrlDialogOpen] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentGraph, setCurrentGraph] = useState<Graph | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved !== null ? JSON.parse(saved) : true
  })
  const [colorScheme, setColorScheme] = useState<ColorScheme>('random')
  const [zoom, setZoom] = useState<number>(1) // Controls zoom (from slider)
  const [displayZoom, setDisplayZoom] = useState<number>(1) // Shows current zoom (from canvas)
  const [contigThickness, setContigThickness] = useState<number>(6)
  const [connectorThickness, setConnectorThickness] = useState<number>(3)
  const [drawLabels, setDrawLabels] = useState<boolean>(true)
  const [labelLengthThreshold, setLabelLengthThreshold] = useState<number>(0)
  const [drawPaths, setDrawPaths] = useState<boolean>(false)
  // Keep path visibility in the React layer so toggling paths never requires
  // recomputing the layout itself.
  const [selectedPathNames, setSelectedPathNames] = useState<string[]>([])

  // Drop any stale selections from a previous graph load and preserve the
  // current graph's path ordering for the selector.
  const visiblePathNames = useMemo(() => {
    if (!currentGraph?.paths) return []

    const availablePathNames = new Set(currentGraph.paths.map(path => path.name))
    return selectedPathNames.filter(pathName => availablePathNames.has(pathName))
  }, [currentGraph?.paths, selectedPathNames])

  const visiblePathNameSet = useMemo(
    () => new Set(visiblePathNames),
    [visiblePathNames],
  )

  // Handle loading GFA from text
  const loadGFAFromText = useCallback((text: string, filename: string) => {
    try {
      setLoadingFile(true)
      setLoadError(null)

      const gfaGraph = parseGFA(text)
      const graph = convertGFAToGraph(gfaGraph, filename)

      setCurrentGraph(graph)
      setFileMenuOpen(false)
      setExamplesMenuOpen(false)
    } catch (error) {
      console.error('Failed to parse GFA:', error)
      setLoadError(
        error instanceof Error ? error.message : 'Failed to parse GFA file',
      )
    } finally {
      setLoadingFile(false)
    }
  }, [])

  // Handle loading from URL
  const handleLoadFromURL = useCallback(async () => {
    if (!urlInput.trim()) return

    try {
      setLoadingFile(true)
      setLoadError(null)

      const response = await fetch(urlInput)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const text = await response.text()
      const filename = urlInput.split('/').pop() || 'URL Graph'
      loadGFAFromText(text, filename)
      setUrlDialogOpen(false)
      setUrlInput('')
    } catch (error) {
      console.error('Failed to load from URL:', error)
      setLoadError(
        error instanceof Error ? error.message : 'Failed to load from URL',
      )
    } finally {
      setLoadingFile(false)
    }
  }, [urlInput, loadGFAFromText])

  // Handle loading from predefined URL example
  const handleLoadURLExample = useCallback(
    async (url: string, name: string) => {
      try {
        setLoadingFile(true)
        setLoadError(null)
        setFileMenuOpen(false)

        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const text = await response.text()
        loadGFAFromText(text, name)
      } catch (error) {
        console.error('Failed to load example from URL:', error)
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Failed to load example from URL',
        )
      } finally {
        setLoadingFile(false)
      }
    },
    [loadGFAFromText],
  )

  // Handle loading from local file
  const handleLoadFromFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = e => {
        const text = e.target?.result as string
        if (text) {
          loadGFAFromText(text, file.name)
        }
      }
      reader.onerror = () => {
        setLoadError('Failed to read file')
      }
      reader.readAsText(file)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [loadGFAFromText],
  )

  // Load MT.gfa by default on first load
  useEffect(() => {
    if (!currentGraph) {
      const mtExample = urlExamples.find(
        ex => ex.name === 'MT GFA-spec example',
      )
      if (mtExample) {
        handleLoadURLExample(mtExample.url, mtExample.name)
      }
    }
  }, [currentGraph, handleLoadURLExample])

  useEffect(() => {
    if (!currentGraph?.paths) {
      setSelectedPathNames([])
      return
    }

    // New graphs start with every path visible so the default behavior matches
    // the original "draw all paths" view until the user filters it down.
    setSelectedPathNames(currentGraph.paths.map(path => path.name))
  }, [currentGraph])

  // Compute layout when graph or options change
  const computeLayout = useCallback(async () => {
    if (!worker) {
      console.warn('Worker not ready')
      return
    }

    setIsComputing(true)
    try {
      if (!currentGraph) return

      const { result, duration } = await worker.computeLayout(
        currentGraph,
        layoutOptions,
      )
      setLayoutResult(result)
      setLayoutDuration(duration)
    } catch (error) {
      console.error('Layout computation failed:', error)
    } finally {
      setIsComputing(false)
    }
  }, [worker, currentGraph, layoutOptions])

  // Use a ref to track the current request ID
  const requestIdRef = useRef(0)

  // Auto-compute on graph change (but not on layout options change)
  useEffect(() => {
    if (!worker) return

    // Increment request ID for this new computation
    const currentRequestId = ++requestIdRef.current

    const runLayout = async () => {
      setIsComputing(true)
      try {
        if (!currentGraph) return

        const { result, duration } = await worker.computeLayout(
          currentGraph,
          layoutOptions,
        )

        // Only update state if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          setLayoutResult(result)
          setLayoutDuration(duration)
          setIsComputing(false)
        }
      } catch (error) {
        if (currentRequestId === requestIdRef.current) {
          console.error('Layout computation failed:', error)
          setIsComputing(false)
        }
      }
    }

    runLayout()
    // Note: layoutOptions is intentionally not in deps
    // This effect only runs when the graph changes, not when changing options
    // The Redraw button is for recomputing with new options
  }, [currentGraph, worker])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!fileMenuOpen && !viewMenuOpen && !examplesMenuOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        !(e.target as Element).closest('.menu-item') &&
        !(e.target as Element).closest('.dropdown-item')
      ) {
        setFileMenuOpen(false)
        setViewMenuOpen(false)
        setExamplesMenuOpen(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [fileMenuOpen, viewMenuOpen, examplesMenuOpen])

  // Close dialog with Escape key
  useEffect(() => {
    if (!statsDialogOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStatsDialogOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [statsDialogOpen])

  // Close URL dialog with Escape key
  useEffect(() => {
    if (!urlDialogOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUrlDialogOpen(false)
        setLoadError(null)
        setUrlInput('')
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [urlDialogOpen])

  // Save dark mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode))
  }, [isDarkMode])

  return (
    <div className={`app ${isDarkMode ? 'dark-mode' : ''}`}>
      <header className="app-header">
        <div className="header-top">
          <h1>BandageJS</h1>
          <div className="menu-bar">
            <div className="menu-item">
              <button
                className="menu-button"
                onClick={() => setFileMenuOpen(!fileMenuOpen)}
              >
                File
              </button>
              {fileMenuOpen && (
                <div className="dropdown-menu">
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setUrlDialogOpen(true)
                      setFileMenuOpen(false)
                    }}
                  >
                    <div className="dropdown-item-title">Open URL</div>
                    <div className="dropdown-item-desc">
                      Load GFA from a URL
                    </div>
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      fileInputRef.current?.click()
                      setFileMenuOpen(false)
                    }}
                  >
                    <div className="dropdown-item-title">Open Local File</div>
                    <div className="dropdown-item-desc">
                      Load GFA from your computer
                    </div>
                  </button>
                  <div style={{ position: 'relative' }}>
                    <button
                      className="dropdown-item"
                      onClick={e => {
                        e.stopPropagation()
                        setExamplesMenuOpen(!examplesMenuOpen)
                      }}
                    >
                      <div className="dropdown-item-title">Examples →</div>
                      <div className="dropdown-item-desc">
                        Load example GFA files
                      </div>
                    </button>
                    {examplesMenuOpen && (
                      <div
                        className="dropdown-menu"
                        style={{ position: 'absolute', left: '100%', top: 0 }}
                      >
                        {urlExamples.map(example => (
                          <button
                            key={example.url}
                            className="dropdown-item"
                            onClick={() => {
                              handleLoadURLExample(example.url, example.name)
                            }}
                            disabled={loadingFile}
                          >
                            <div className="dropdown-item-title">
                              {example.name}
                            </div>
                            <div className="dropdown-item-desc">
                              {example.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="menu-item">
              <button
                className="menu-button"
                onClick={() => setViewMenuOpen(!viewMenuOpen)}
              >
                View
              </button>
              {viewMenuOpen && (
                <div className="dropdown-menu">
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setStatsDialogOpen(true)
                      setViewMenuOpen(false)
                    }}
                    disabled={!currentGraph}
                  >
                    Statistics
                  </button>
                  <label className="dropdown-checkbox-item">
                    <input
                      type="checkbox"
                      checked={isDarkMode}
                      onChange={e => setIsDarkMode(e.target.checked)}
                    />
                    <span>Dark Mode</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="left-panel">
          <LayoutControls
            options={layoutOptions}
            onChange={setLayoutOptions}
            onCompute={computeLayout}
            isComputing={isComputing}
            colorScheme={colorScheme}
            onColorSchemeChange={setColorScheme}
            zoom={displayZoom}
            onZoomChange={z => setZoom(clampZoom(z))}
            contigThickness={contigThickness}
            onContigThicknessChange={setContigThickness}
            connectorThickness={connectorThickness}
            onConnectorThicknessChange={setConnectorThickness}
            drawLabels={drawLabels}
            onDrawLabelsChange={setDrawLabels}
            labelLengthThreshold={labelLengthThreshold}
            onLabelLengthThresholdChange={setLabelLengthThreshold}
            drawPaths={drawPaths}
            onDrawPathsChange={setDrawPaths}
            hasPathsInGraph={
              !!currentGraph?.paths && currentGraph.paths.length > 0
            }
          />
        </div>

        <div className="right-panel">
          <div className="visualization-section">
            <h3>Graph Layout</h3>
            {isComputing ? (
              <div className="loading">
                <div className="spinner"></div>
                <p>Computing layout...</p>
              </div>
            ) : layoutResult ? (
              <>
                <GraphCanvas
                  layoutResult={layoutResult}
                  graph={currentGraph}
                  width={1200}
                  height={800}
                  isDarkMode={isDarkMode}
                  colorScheme={colorScheme}
                  zoom={zoom}
                  onZoomChange={z => setZoom(clampZoom(z))}
                  onInternalZoomChange={setDisplayZoom}
                  contigThickness={contigThickness}
                  connectorThickness={connectorThickness}
                  drawLabels={drawLabels}
                  labelLengthThreshold={labelLengthThreshold}
                  drawPaths={drawPaths}
                  visiblePathIds={visiblePathNameSet}
                />
                {/* Keep path selection close to the rendered graph so long path
                    names and search results are easier to scan. */}
                {drawPaths &&
                  currentGraph?.paths &&
                  currentGraph.paths.length > 0 && (
                    <PathsLegend
                      paths={currentGraph.paths}
                      isDarkMode={isDarkMode}
                      selectedPathNames={visiblePathNames}
                      onTogglePath={pathName =>
                        setSelectedPathNames(currentSelected =>
                          currentSelected.includes(pathName)
                            ? currentSelected.filter(name => name !== pathName)
                            : [...currentSelected, pathName],
                        )
                      }
                      onSelectAll={() =>
                        setSelectedPathNames(
                          currentGraph.paths?.map(path => path.name) ?? [],
                        )
                      }
                      onDeselectAll={() => setSelectedPathNames([])}
                    />
                  )}
              </>
            ) : currentGraph ? (
              <div className="placeholder">
                <p>Click "Redraw" to visualize the graph</p>
              </div>
            ) : (
              <div className="placeholder">
                <p>Load a GFA file from the File menu to get started</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".gfa,.gfa1,.gfa2"
        style={{ display: 'none' }}
        onChange={handleLoadFromFile}
      />

      {/* URL Dialog */}
      {urlDialogOpen && (
        <div
          className="dialog-overlay"
          onClick={() => {
            setUrlDialogOpen(false)
            setLoadError(null)
            setUrlInput('')
          }}
        >
          <div className="dialog-content" onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h2>Open GFA from URL</h2>
              <button
                className="dialog-close"
                onClick={() => {
                  setUrlDialogOpen(false)
                  setLoadError(null)
                  setUrlInput('')
                }}
              >
                ×
              </button>
            </div>
            <div className="dialog-body">
              <div style={{ marginBottom: '15px' }}>
                <label
                  htmlFor="url-input"
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 500,
                  }}
                >
                  GFA File URL:
                </label>
                <input
                  id="url-input"
                  type="text"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://example.com/graph.gfa"
                  disabled={loadingFile}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !loadingFile) {
                      handleLoadFromURL()
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: isDarkMode ? '1px solid #444' : '1px solid #ddd',
                    borderRadius: '4px',
                    background: isDarkMode ? '#1a1a1a' : 'white',
                    color: isDarkMode ? '#e0e0e0' : '#333',
                  }}
                />
              </div>
              {loadError && (
                <div
                  style={{
                    padding: '10px',
                    marginBottom: '15px',
                    background: '#fee',
                    border: '1px solid #fcc',
                    borderRadius: '4px',
                    color: '#c33',
                    fontSize: '13px',
                  }}
                >
                  {loadError}
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  onClick={() => {
                    setUrlDialogOpen(false)
                    setLoadError(null)
                    setUrlInput('')
                  }}
                  disabled={loadingFile}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    border: isDarkMode ? '1px solid #444' : '1px solid #ddd',
                    borderRadius: '4px',
                    background: isDarkMode ? '#2a2a2a' : '#f5f5f5',
                    color: isDarkMode ? '#e0e0e0' : '#333',
                    cursor: loadingFile ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLoadFromURL}
                  disabled={loadingFile || !urlInput.trim()}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    border: 'none',
                    borderRadius: '4px',
                    background:
                      loadingFile || !urlInput.trim() ? '#ccc' : '#0066cc',
                    color: 'white',
                    cursor:
                      loadingFile || !urlInput.trim()
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  {loadingFile ? 'Loading...' : 'Load'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Dialog */}
      {statsDialogOpen && currentGraph && (
        <div
          className="dialog-overlay"
          onClick={() => setStatsDialogOpen(false)}
        >
          <div className="dialog-content" onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h2>Graph Statistics</h2>
              <button
                className="dialog-close"
                onClick={() => setStatsDialogOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="dialog-body">
              <StatsPanel
                graph={currentGraph}
                layoutDuration={layoutDuration}
              />
              <div className="stats-section">
                <h3>Length Distribution</h3>
                <LengthDistribution
                  graph={currentGraph}
                  width={700}
                  height={200}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
