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

/**
 * Bond types for module graphs.
 *
 * TODO(periodic-table): when feeding a TypeScript module graph in, classify
 * each import edge by bond type. The TS compiler/language service has all the
 * data needed; this field is the landing pad.
 *
 * - "import"   — one-directional import (ionic: asymmetric, brittle in long chains)
 * - "type"     — type-only import (weaker ionic — no runtime charge transfer)
 * - "reexport" — module re-exports the symbol (metallic: delocalised, conducts)
 * - "shared"   — both files speak a common interface neither owns (covalent)
 * - "ambient"  — reads/writes shared mutable state, e.g. a store (van der Waals)
 *
 * HINT: electronegativity of a node = (types it defines) / (types it consumes).
 * High electronegativity → pulls imports toward itself. Low → donates outward.
 *
 * HINT: strongly connected components (Tarjan) on the import graph reveal
 * intentional molecules — groups of files whose concept doesn't decompose.
 * An SCC with a shared interface.ts at its nucleus is not a bug; it is the
 * correct representation of the concept's topology.
 *
 * HINT: binding energy = cohesion within an SCC / coupling to nodes outside it.
 * Moving away from the stable configuration (splitting or merging) costs energy.
 * cf. nuclear binding energy curve — iron is the trough.
 */
export type BondType = "import" | "type" | "reexport" | "shared" | "ambient"

export interface Edge {
  from: string
  to: string
  /** Confidence [0, 1). Never reaches 1.0. */
  confidence: number
  phase: PhaseMarker
  predicate?: string
  /**
   * Bond type for module graphs. Optional — generic graphs leave this unset.
   * TODO(periodic-table): populate from tsc AST analysis pass.
   */
  bondType?: BondType
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
