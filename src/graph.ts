/**
 * Core graph primitives.
 *
 * Nodes and edges with phase markers. No opinions about what they represent —
 * could be files, knowledge, repos, anything with thermodynamic properties.
 */

import type { PhaseMarker } from "./thermal.js"

export interface Node {
  id: string
  phase: PhaseMarker
  /** Arbitrary metadata */
  meta?: Record<string, unknown>
}

export interface Edge {
  from: string
  to: string
  /** Confidence [0, 1). Never reaches 1.0. */
  confidence: number
  phase: PhaseMarker
  predicate?: string
  meta?: Record<string, unknown>
}

export interface Graph {
  nodes: Map<string, Node>
  edges: Edge[]
}

export function createGraph(): Graph {
  return { nodes: new Map(), edges: [] }
}

export function addNode(graph: Graph, node: Node): void {
  graph.nodes.set(node.id, node)
}

export function addEdge(graph: Graph, edge: Edge): void {
  graph.edges.push(edge)
}

export function edgesFrom(graph: Graph, id: string): Edge[] {
  return graph.edges.filter(e => e.from === id)
}

export function edgesTo(graph: Graph, id: string): Edge[] {
  return graph.edges.filter(e => e.to === id)
}

/** Parallax: edges where observers disagree on confidence */
export function parallax(edges: Edge[], minSpread = 0.05): Array<{
  edge: Edge
  spread: number
}> {
  const byKey = new Map<string, Edge[]>()
  for (const e of edges) {
    const key = `${e.from}|${e.predicate ?? ""}|${e.to}`
    const group = byKey.get(key) ?? []
    group.push(e)
    byKey.set(key, group)
  }
  const result = []
  for (const group of byKey.values()) {
    if (group.length < 2) continue
    const confidences = group.map(e => e.confidence)
    const spread = Math.max(...confidences) - Math.min(...confidences)
    if (spread >= minSpread) result.push({ edge: group[0], spread })
  }
  return result.sort((a, b) => b.spread - a.spread)
}
