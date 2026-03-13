/**
 * Thermal phase model for alkahest.
 *
 * Nodes are cells in a cellular automaton over a dependency graph.
 * Heat is emitted by changelog events and propagates toward dependents.
 * Temperature decays each changelog step (commit = one tick).
 *
 * Phase is material type (intrinsic). Temperature is current state (extrinsic).
 * effectivePhase = what the node is actually doing right now.
 *
 * Heat sources:
 *   - Fluid recompile/break  → moderate heat
 *   - Salt type change        → high heat
 *
 * Heat flows: from dependency → dependent (outward to edges).
 * Thermal mass: nodes with many dependents conduct heat more slowly (higher thresholds).
 */

export type PhaseMarker = "volatile" | "fluid" | "salt"

export interface ThermalNode {
  id: string
  phase: PhaseMarker       // intrinsic material type
  temperature: number      // current heat (decays each changelog step)
  meltingPoint: number     // temp above which solid → liquid behavior
  boilingPoint: number     // temp above which → gas behavior
}

export interface ThermalEdge {
  from: string   // dependency
  to: string     // dependent (heat flows this direction)
  conductance: number  // 0–1, how much heat transfers along this edge
}

export interface ThermalGraph {
  nodes: Map<string, ThermalNode>
  edges: ThermalEdge[]
}

/** What a node is behaviorally doing, regardless of its material phase */
export type EffectivePhase = "volatile" | "fluid" | "salt"

export function effectivePhase(node: ThermalNode): EffectivePhase {
  if (node.temperature >= node.boilingPoint) return "volatile"
  if (node.temperature >= node.meltingPoint) return "fluid"
  return "salt"
}

/** Default thresholds based on how many dependents a node has (thermal mass) */
export function defaultThresholds(dependentCount: number): { meltingPoint: number; boilingPoint: number } {
  // More dependents = more locked in = higher thresholds
  const base = 1 + dependentCount * 0.5
  return {
    meltingPoint: base,
    boilingPoint: base * 2,
  }
}

export type HeatEventKind = "fluid-recompile" | "salt-type-change"

const HEAT_EMISSION: Record<HeatEventKind, number> = {
  "fluid-recompile": 1.0,
  "salt-type-change": 2.5,
}

/** Emit heat onto a node in place */
export function emitHeat(graph: ThermalGraph, nodeId: string, kind: HeatEventKind): void {
  const node = graph.nodes.get(nodeId)
  if (!node) return
  node.temperature += HEAT_EMISSION[kind]
}

/**
 * One CA propagation step.
 * Each node receives heat from its dependencies, scaled by conductance and a global decay.
 * Run after emitting heat for a changelog step.
 */
export function propagate(graph: ThermalGraph, decay: number = 0.6): void {
  const delta = new Map<string, number>()

  for (const edge of graph.edges) {
    const source = graph.nodes.get(edge.from)
    if (!source || source.temperature <= 0) continue
    const transferred = source.temperature * edge.conductance * decay
    delta.set(edge.to, (delta.get(edge.to) ?? 0) + transferred)
  }

  for (const [id, heat] of delta) {
    const node = graph.nodes.get(id)
    if (node) node.temperature += heat
  }
}

/**
 * Cool all nodes by one changelog step.
 * Temperature decays toward zero; never goes negative.
 */
export function cool(graph: ThermalGraph, coolingRate: number = 0.4): void {
  for (const node of graph.nodes.values()) {
    node.temperature = Math.max(0, node.temperature - coolingRate)
  }
}

export interface ChangelogEvent {
  nodeId: string
  kind: HeatEventKind
}

/**
 * Process one changelog step (one commit's worth of changes).
 * Emits heat for all events, propagates, then cools.
 */
export function thermalStep(
  graph: ThermalGraph,
  events: ChangelogEvent[],
  opts: { decay?: number; coolingRate?: number } = {},
): void {
  for (const event of events) {
    emitHeat(graph, event.nodeId, event.kind)
  }
  propagate(graph, opts.decay)
  cool(graph, opts.coolingRate)
}

/** Build a ThermalGraph from a flat node/edge description */
export function buildThermalGraph(
  nodes: Array<{ id: string; phase: PhaseMarker; temperature?: number }>,
  edges: Array<{ from: string; to: string; conductance?: number }>,
): ThermalGraph {
  // Count dependents per node to set thresholds
  const dependentCount = new Map<string, number>()
  for (const n of nodes) dependentCount.set(n.id, 0)
  for (const e of edges) {
    dependentCount.set(e.from, (dependentCount.get(e.from) ?? 0) + 1)
  }

  const nodeMap = new Map<string, ThermalNode>()
  for (const n of nodes) {
    const { meltingPoint, boilingPoint } = defaultThresholds(dependentCount.get(n.id) ?? 0)
    nodeMap.set(n.id, {
      id: n.id,
      phase: n.phase,
      temperature: n.temperature ?? 0,
      meltingPoint,
      boilingPoint,
    })
  }

  return {
    nodes: nodeMap,
    edges: edges.map(e => ({ from: e.from, to: e.to, conductance: e.conductance ?? 0.5 })),
  }
}

/** Snapshot of the thermal state for inspection / replay */
export interface ThermalSnapshot {
  step: number
  nodes: Array<{ id: string; phase: PhaseMarker; temperature: number; effective: EffectivePhase }>
}

export function snapshot(graph: ThermalGraph, step: number): ThermalSnapshot {
  return {
    step,
    nodes: Array.from(graph.nodes.values()).map(n => ({
      id: n.id,
      phase: n.phase,
      temperature: n.temperature,
      effective: effectivePhase(n),
    })),
  }
}
