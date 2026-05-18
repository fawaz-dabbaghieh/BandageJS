import type { Graph, GraphEdge, GraphNode, NodeSegment } from '../types'

export interface DisplayNode {
  key: string
  representativeId: string
  node: GraphNode
  nodeIds: string[]
  segments: NodeSegment[]
}

export interface DisplayEdgeTraversal {
  edge: GraphEdge
  pathId: string
}

export interface DisplayEdge {
  key: string
  representativeEdge: GraphEdge
  edges: GraphEdge[]
  fromNodeKey: string
  toNodeKey: string
  pathIds: string[]
  pathTraversals: DisplayEdgeTraversal[]
}

export interface DisplayGraph {
  nodes: DisplayNode[]
  nodesByKey: Map<string, DisplayNode>
  edges: DisplayEdge[]
}

function getCanonicalEdgeKeyForPair(fromNodeId: string, toNodeId: string): string {
  const forwardKey = `${fromNodeId}->${toNodeId}`
  const reverseComplementKey = `${getReverseComplementNodeId(toNodeId)}->${getReverseComplementNodeId(fromNodeId)}`
  return forwardKey < reverseComplementKey ? forwardKey : reverseComplementKey
}

export function stripNodeOrientation(nodeId: string): string {
  return nodeId.endsWith('+') || nodeId.endsWith('-')
    ? nodeId.slice(0, -1)
    : nodeId
}

export function getReverseComplementNodeId(nodeId: string): string {
  if (nodeId.endsWith('+')) return `${nodeId.slice(0, -1)}-`
  if (nodeId.endsWith('-')) return `${nodeId.slice(0, -1)}+`
  return nodeId
}

export function reverseSegments(segments: NodeSegment[]): NodeSegment[] {
  // Reverse-complement nodes reuse the same visible contig geometry, but the
  // segment traversal order must flip so edge attachment points stay correct.
  return [...segments].reverse().map(segment => ({ ...segment }))
}

function chooseRepresentativeNodeId(
  nodeIds: string[],
  nodePositions: Record<string, NodeSegment[]>,
): string {
  const idsWithPositions = nodeIds.filter(nodeId => nodePositions[nodeId]?.length)
  const preferredIds = idsWithPositions.length > 0 ? idsWithPositions : nodeIds

  // Single-mode Bandage prefers positive nodes when they exist, but still
  // falls back to the only available orientation for one-sided graphs.
  return (
    preferredIds.find(nodeId => nodeId.endsWith('+')) ??
    [...preferredIds].sort()[0] ??
    nodeIds[0]!
  )
}

function getCanonicalEdgeKey(edge: GraphEdge): string {
  return getCanonicalEdgeKeyForPair(edge.from, edge.to)
}

function chooseRepresentativeEdge(
  edges: GraphEdge[],
  nodesByKey: Map<string, DisplayNode>,
): GraphEdge {
  return (
    edges.find(edge => {
      const fromNode = nodesByKey.get(stripNodeOrientation(edge.from))
      const toNode = nodesByKey.get(stripNodeOrientation(edge.to))

      return (
        edge.from === fromNode?.representativeId &&
        edge.to === toNode?.representativeId
      )
    }) ??
    edges[0]!
  )
}

export function buildDisplayGraph(
  graph: Graph,
  nodePositions: Record<string, NodeSegment[]>,
): DisplayGraph {
  const nodeGroups = new Map<string, GraphNode[]>()
  for (const node of graph.nodes) {
    const key = stripNodeOrientation(node.id)
    if (!nodeGroups.has(key)) {
      nodeGroups.set(key, [])
    }
    nodeGroups.get(key)!.push(node)
  }

  const nodes = Array.from(nodeGroups.entries(), ([key, groupedNodes]) => {
    const representativeId = chooseRepresentativeNodeId(
      groupedNodes.map(node => node.id),
      nodePositions,
    )
    const representativeNode =
      groupedNodes.find(node => node.id === representativeId) ?? groupedNodes[0]!

    return {
      key,
      representativeId,
      node: representativeNode,
      nodeIds: groupedNodes.map(node => node.id),
      segments: nodePositions[representativeId] ?? [],
    }
  })

  const nodesByKey = new Map(nodes.map(node => [node.key, node]))

  const edgeGroups = new Map<string, GraphEdge[]>()
  for (const edge of graph.edges) {
    const key = getCanonicalEdgeKey(edge)
    if (!edgeGroups.has(key)) {
      edgeGroups.set(key, [])
    }
    edgeGroups.get(key)!.push(edge)
  }

  const pathTraversalsByEdgeKey = new Map<string, DisplayEdgeTraversal[]>()
  for (const path of graph.paths ?? []) {
    for (let i = 0; i < path.nodeIds.length - 1; i++) {
      const from = path.nodeIds[i]!
      const to = path.nodeIds[i + 1]!
      const edgeKey = getCanonicalEdgeKeyForPair(from, to)
      const matchingEdges = edgeGroups.get(edgeKey) ?? []

      if (!pathTraversalsByEdgeKey.has(edgeKey)) {
        pathTraversalsByEdgeKey.set(edgeKey, [])
      }

      // A path can traverse the reverse-complement of a stored L-line. In that
      // case there is still only one displayed edge, but we synthesize an
      // oriented traversal so the overlay can keep the path direction.
      const edgeForTraversal =
        matchingEdges.find(edge => edge.from === from && edge.to === to) ??
        ({
          from,
          to,
          overlap: matchingEdges[0]?.overlap ?? 0,
        } satisfies GraphEdge)

      pathTraversalsByEdgeKey.get(edgeKey)!.push({
        edge: edgeForTraversal,
        pathId: path.name,
      })
    }
  }

  const edges = Array.from(edgeGroups.entries(), ([key, groupedEdges]) => {
    const representativeEdge = chooseRepresentativeEdge(groupedEdges, nodesByKey)
    const pathTraversals = pathTraversalsByEdgeKey.get(key) ?? []
    const pathIds = Array.from(new Set(pathTraversals.map(path => path.pathId)))

    return {
      key,
      representativeEdge,
      edges: groupedEdges,
      fromNodeKey: stripNodeOrientation(representativeEdge.from),
      toNodeKey: stripNodeOrientation(representativeEdge.to),
      pathIds,
      pathTraversals,
    }
  })

  return { nodes, nodesByKey, edges }
}

export function resolveDisplaySegments(
  nodeId: string,
  displayGraph: DisplayGraph,
): NodeSegment[] | null {
  const displayNode = displayGraph.nodesByKey.get(stripNodeOrientation(nodeId))
  if (!displayNode) return null

  if (nodeId === displayNode.representativeId) {
    return displayNode.segments
  }

  return reverseSegments(displayNode.segments)
}

export function getDisplayNodes(graph: Graph): GraphNode[] {
  const nodeGroups = new Map<string, GraphNode[]>()
  for (const node of graph.nodes) {
    const key = stripNodeOrientation(node.id)
    if (!nodeGroups.has(key)) {
      nodeGroups.set(key, [])
    }
    nodeGroups.get(key)!.push(node)
  }

  return Array.from(nodeGroups.values(), groupedNodes => {
    return (
      groupedNodes.find(node => node.id.endsWith('+')) ??
      [...groupedNodes].sort((a, b) => a.id.localeCompare(b.id))[0]!
    )
  })
}
