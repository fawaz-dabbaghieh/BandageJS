// Example assembly graphs with varied sequence lengths

import type { Graph, GraphStats } from '../types'
import { buildDisplayGraph, getDisplayNodes } from '../utils/displayGraph'

export const exampleGraphs: Record<string, Graph> = {
  simple: {
    name: 'Simple Linear Path',
    description: '4 contigs in a simple linear arrangement',
    nodes: [
      { id: '1+', name: 'CONTIG_1', length: 50000, depth: 25.3 },
      { id: '1-', name: 'CONTIG_1', length: 50000, depth: 25.3 },
      { id: '2+', name: 'CONTIG_2', length: 75000, depth: 28.1 },
      { id: '2-', name: 'CONTIG_2', length: 75000, depth: 28.1 },
      { id: '3+', name: 'CONTIG_3', length: 100000, depth: 26.7 },
      { id: '3-', name: 'CONTIG_3', length: 100000, depth: 26.7 },
      { id: '4+', name: 'CONTIG_4', length: 150000, depth: 27.4 },
      { id: '4-', name: 'CONTIG_4', length: 150000, depth: 27.4 },
    ],
    edges: [
      { from: '1+', to: '2+', overlap: 0 },
      { from: '2-', to: '1-', overlap: 0 },
      { from: '2+', to: '3+', overlap: 0 },
      { from: '3-', to: '2-', overlap: 0 },
      { from: '3+', to: '4+', overlap: 0 },
      { from: '4-', to: '3-', overlap: 0 },
    ],
  },

  complex: {
    name: 'Complex Branching',
    description: '12 contigs with branches showing varied lengths',
    nodes: [
      { id: '1+', name: 'CONTIG_1', length: 85000, depth: 32.1 },
      { id: '1-', name: 'CONTIG_1', length: 85000, depth: 32.1 },
      { id: '2+', name: 'CONTIG_2', length: 125000, depth: 31.5 },
      { id: '2-', name: 'CONTIG_2', length: 125000, depth: 31.5 },
      { id: '3+', name: 'CONTIG_3', length: 45000, depth: 30.8 },
      { id: '3-', name: 'CONTIG_3', length: 45000, depth: 30.8 },
      { id: '4+', name: 'CONTIG_4', length: 15000, depth: 65.3 },
      { id: '4-', name: 'CONTIG_4', length: 15000, depth: 65.3 },
      { id: '5+', name: 'CONTIG_5', length: 95000, depth: 29.7 },
      { id: '5-', name: 'CONTIG_5', length: 95000, depth: 29.7 },
      { id: '6+', name: 'CONTIG_6', length: 55000, depth: 33.2 },
      { id: '6-', name: 'CONTIG_6', length: 55000, depth: 33.2 },
    ],
    edges: [
      { from: '1+', to: '2+', overlap: 0 },
      { from: '2-', to: '1-', overlap: 0 },
      { from: '2+', to: '3+', overlap: 0 },
      { from: '3-', to: '2-', overlap: 0 },
      { from: '2+', to: '4+', overlap: 0 },
      { from: '4-', to: '2-', overlap: 0 },
      { from: '3+', to: '5+', overlap: 0 },
      { from: '5-', to: '3-', overlap: 0 },
      { from: '4+', to: '6+', overlap: 0 },
      { from: '6-', to: '4-', overlap: 0 },
    ],
  },

  realistic: {
    name: 'Realistic Bacterial Assembly',
    description:
      '20 contigs mimicking real assembly with wide length variation',
    nodes: [
      { id: '1+', name: 'CONTIG_1', length: 324567, depth: 45.2 },
      { id: '1-', name: 'CONTIG_1', length: 324567, depth: 45.2 },
      { id: '2+', name: 'CONTIG_2', length: 234567, depth: 43.8 },
      { id: '2-', name: 'CONTIG_2', length: 234567, depth: 43.8 },
      { id: '3+', name: 'CONTIG_3', length: 156789, depth: 44.5 },
      { id: '3-', name: 'CONTIG_3', length: 156789, depth: 44.5 },
      { id: '4+', name: 'CONTIG_4', length: 87654, depth: 46.1 },
      { id: '4-', name: 'CONTIG_4', length: 87654, depth: 46.1 },
      { id: '5+', name: 'CONTIG_5', length: 45678, depth: 42.3 },
      { id: '5-', name: 'CONTIG_5', length: 45678, depth: 42.3 },
      { id: '6+', name: 'CONTIG_6', length: 12345, depth: 91.2 },
      { id: '6-', name: 'CONTIG_6', length: 12345, depth: 91.2 },
      { id: '7+', name: 'CONTIG_7', length: 56789, depth: 43.7 },
      { id: '7-', name: 'CONTIG_7', length: 56789, depth: 43.7 },
      { id: '8+', name: 'CONTIG_8', length: 23456, depth: 44.9 },
      { id: '8-', name: 'CONTIG_8', length: 23456, depth: 44.9 },
      { id: '9+', name: 'CONTIG_9', length: 3456, depth: 88.5 },
      { id: '9-', name: 'CONTIG_9', length: 3456, depth: 88.5 },
      { id: '10+', name: 'CONTIG_10', length: 567890, depth: 46.8 },
      { id: '10-', name: 'CONTIG_10', length: 567890, depth: 46.8 },
    ],
    edges: [
      { from: '1+', to: '2+', overlap: 127 },
      { from: '2-', to: '1-', overlap: 127 },
      { from: '2+', to: '3+', overlap: 98 },
      { from: '3-', to: '2-', overlap: 98 },
      { from: '3+', to: '4+', overlap: 65 },
      { from: '4-', to: '3-', overlap: 65 },
      { from: '4+', to: '5+', overlap: 0 },
      { from: '5-', to: '4-', overlap: 0 },
      { from: '4+', to: '6+', overlap: 0 },
      { from: '6-', to: '4-', overlap: 0 },
      { from: '5+', to: '7+', overlap: 45 },
      { from: '7-', to: '5-', overlap: 45 },
      { from: '7+', to: '8+', overlap: 0 },
      { from: '8-', to: '7-', overlap: 0 },
      { from: '8+', to: '9+', overlap: 0 },
      { from: '9-', to: '8-', overlap: 0 },
      { from: '6+', to: '10+', overlap: 0 },
      { from: '10-', to: '6-', overlap: 0 },
    ],
  },

  circular: {
    name: 'Circular Plasmid',
    description: '8 contigs forming a circular plasmid with varied sizes',
    nodes: [
      { id: 'P1+', name: 'PLASMID_1', length: 5678, depth: 95.2 },
      { id: 'P1-', name: 'PLASMID_1', length: 5678, depth: 95.2 },
      { id: 'P2+', name: 'PLASMID_2', length: 12345, depth: 98.7 },
      { id: 'P2-', name: 'PLASMID_2', length: 12345, depth: 98.7 },
      { id: 'P3+', name: 'PLASMID_3', length: 890, depth: 102.4 },
      { id: 'P3-', name: 'PLASMID_3', length: 890, depth: 102.4 },
      { id: 'P4+', name: 'PLASMID_4', length: 23456, depth: 96.1 },
      { id: 'P4-', name: 'PLASMID_4', length: 23456, depth: 96.1 },
    ],
    edges: [
      { from: 'P1+', to: 'P2+', overlap: 0 },
      { from: 'P2-', to: 'P1-', overlap: 0 },
      { from: 'P2+', to: 'P3+', overlap: 0 },
      { from: 'P3-', to: 'P2-', overlap: 0 },
      { from: 'P3+', to: 'P4+', overlap: 0 },
      { from: 'P4-', to: 'P3-', overlap: 0 },
      { from: 'P4+', to: 'P1+', overlap: 0 },
      { from: 'P1-', to: 'P4-', overlap: 0 },
    ],
  },
}

export function getGraphStats(graph: Graph): GraphStats {
  // Stats are derived from the same single-mode display abstraction as the
  // canvas so counts stay correct even when only one orientation is present.
  const uniqueNodes = getDisplayNodes(graph)
  const lengths = uniqueNodes.map(n => n.length).sort((a, b) => a - b)
  const depths = uniqueNodes.map(n => n.depth)
  const displayGraph = buildDisplayGraph(graph, {})

  const totalLength = lengths.reduce((sum, l) => sum + l, 0)
  const minLength = lengths[0]!
  const maxLength = lengths[lengths.length - 1]!
  const avgLength = totalLength / lengths.length
  const medianLength = lengths[Math.floor(lengths.length / 2)]!

  const avgDepth = depths.reduce((sum, d) => sum + d, 0) / depths.length
  const minDepth = Math.min(...depths)
  const maxDepth = Math.max(...depths)

  return {
    nodeCount: uniqueNodes.length,
    edgeCount: displayGraph.edges.length,
    totalLength,
    minLength,
    maxLength,
    avgLength,
    medianLength,
    lengthRatio: (maxLength / minLength).toFixed(1),
    avgDepth,
    minDepth,
    maxDepth,
    uniqueNodes,
  }
}
