import type { Graph, GraphNode, GraphEdge, GraphPath } from '../types'
import type { GFAGraph } from './gfaParser'

/**
 * Parse CIGAR string to extract overlap information
 * CIGAR format: [0-9]+[MIDNSHPX=]
 * For overlap, we typically care about M (match/mismatch)
 */
function parseCigarOverlap(cigar: string): number {
  if (!cigar || cigar === '*') return 0

  // Extract all match operations and sum them
  const matches = cigar.match(/(\d+)M/g)
  if (!matches) return 0

  return matches.reduce((sum, match) => {
    const num = parseInt(match.slice(0, -1))
    return sum + num
  }, 0)
}

/**
 * Convert GFA graph to Bandage app Graph format
 */
export function convertGFAToGraph(
  gfaGraph: GFAGraph,
  name: string = 'Imported GFA',
): Graph {
  // The app renders oriented nodes explicitly, so the converter expands each
  // GFA segment into + / - strand-specific node ids as needed by the links.
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  // First pass: determine which strand nodes are actually used
  const usedStrands = new Set<string>()
  for (const link of gfaGraph.links) {
    const sourceStrand = link.strand1 || '+'
    const targetStrand = link.strand2 || '+'
    usedStrands.add(`${link.source}${sourceStrand}`)
    usedStrands.add(`${link.target}${targetStrand}`)
  }
  for (const gfaPath of gfaGraph.paths) {
    // Both P-lines and normalized W-lines use the same internal
    // "node+,node-,..." representation here.
    for (const segment of gfaPath.path.split(',')) {
      if (segment) {
        usedStrands.add(segment)
      }
    }
  }

  // Convert nodes - only create strand versions that are actually used
  for (const gfaNode of gfaGraph.nodes) {
    // Extract depth from tags (common tags: dp, RC, FC, KC)
    const depth =
      (gfaNode.tags.dp as number) ||
      (gfaNode.tags.RC as number) ||
      (gfaNode.tags.FC as number) ||
      (gfaNode.tags.KC as number) ||
      1.0

    // Create positive strand node only if it's used in edges
    if (usedStrands.has(`${gfaNode.id}+`)) {
      nodes.push({
        id: `${gfaNode.id}+`,
        name: gfaNode.id,
        length: gfaNode.length,
        depth: typeof depth === 'number' ? depth : 1.0,
        sequence: gfaNode.sequence,
      })
    }

    // Create negative strand node only if it's used in edges
    if (usedStrands.has(`${gfaNode.id}-`)) {
      nodes.push({
        id: `${gfaNode.id}-`,
        name: gfaNode.id,
        length: gfaNode.length,
        depth: typeof depth === 'number' ? depth : 1.0,
        sequence: gfaNode.sequence,
      })
    }
  }

  // Convert links to edges
  for (const link of gfaGraph.links) {
    const overlap = parseCigarOverlap(link.cigar)

    // Determine the strand orientation
    const sourceStrand = link.strand1 || '+'
    const targetStrand = link.strand2 || '+'

    // Create edge with proper strand notation
    const from = `${link.source}${sourceStrand}`
    const to = `${link.target}${targetStrand}`

    edges.push({
      from,
      to,
      overlap,
    })
  }

  // Process paths
  const paths: GraphPath[] = []
  // Track which rendered edge belongs to which named paths so the canvas can
  // overlay and filter path-specific connectors later.
  const edgeToPathsMap = new Map<string, Set<string>>()

  for (const gfaPath of gfaGraph.paths) {
    // Parse path string (format: node1+,node2-,node3+,...)
    const pathSegments = gfaPath.path.split(',')
    const nodeIds: string[] = []

    for (const segment of pathSegments) {
      const strand = segment.slice(-1) // Last character is the strand
      const nodeName = segment.slice(0, -1) // Everything except last character
      nodeIds.push(`${nodeName}${strand}`)
    }

    paths.push({
      name: gfaPath.name,
      nodeIds,
    })

    // Mark which edges are used by this path
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const from = nodeIds[i]!
      const to = nodeIds[i + 1]!
      const edgeKey = `${from}->${to}`

      if (!edgeToPathsMap.has(edgeKey)) {
        edgeToPathsMap.set(edgeKey, new Set())
      }
      edgeToPathsMap.get(edgeKey)!.add(gfaPath.name)
    }
  }

  // Add path information to edges
  for (const edge of edges) {
    // The graph model stays edge-centric: each edge stores the path ids that
    // traverse it so rendering can stay local while the full path list remains
    // available for legends and selection UI.
    const edgeKey = `${edge.from}->${edge.to}`
    const pathIds = edgeToPathsMap.get(edgeKey)
    if (pathIds && pathIds.size > 0) {
      edge.pathIds = Array.from(pathIds)
    }
  }

  return {
    name,
    description: `Imported from GFA file with ${nodes.length} nodes and ${edges.length} links${paths.length > 0 ? ` and ${paths.length} paths` : ''}`,
    nodes,
    edges,
    paths: paths.length > 0 ? paths : undefined,
  }
}
