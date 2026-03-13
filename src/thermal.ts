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

/** Four states of matter. Glass is not salt — it has no crystal structure. */
export type PhaseMarker = "volatile" | "fluid" | "salt" | "glass"

export interface ThermalNode {
  id: string
  phase: PhaseMarker       // intrinsic material type
  temperature: number      // current heat (decays each changelog step)
  meltingPoint: number     // temp above which solid → liquid behavior
  boilingPoint: number     // temp above which → gas behavior
}

export interface ThermalEdge {
  from: string       // dependency
  to: string         // dependent (heat flows this direction)
  conductance: number
  crossCut?: boolean // cross-subsystem edge — symmetric, medium conductance
}

export interface ThermalGraph {
  nodes: Map<string, ThermalNode>
  edges: ThermalEdge[]
}

/** What a node is behaviorally doing, regardless of its material phase */
export type EffectivePhase = PhaseMarker

export function effectivePhase(node: ThermalNode): EffectivePhase {
  if (node.temperature >= node.boilingPoint) return "volatile"
  if (node.temperature >= node.meltingPoint) return "fluid"
  // Glass: intrinsic phase is glass (high viscosity, amorphous) — cold but brittle
  if (node.phase === "glass") return "glass"
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

// ── Fourier heat equation on a graph ────────────────────
// dT_i/dt = Σ_j κ_ij (T_j - T_i) - λ·T_i
//
// Exchange term is conservative: energy leaving one node enters neighbors.
// λ term drains energy to environment (changelog cooling).
// Asymmetric conductance: heat flows more easily downstream than back up.

const LAMBDA   = 0.08  // cooling rate (loss to environment per step)
const DT       = 0.4   // Euler time-step
const SUBSTEPS = 4     // substeps per changelog tick for numerical stability

function edgeConductance(edge: ThermalEdge, forward: boolean): number {
  if (edge.crossCut) return 0.55
  return forward ? edge.conductance : edge.conductance * 0.3
}

function fourierStep(graph: ThermalGraph, dt: number): void {
  const dT = new Map<string, number>()
  for (const id of graph.nodes.keys()) dT.set(id, 0)

  for (const edge of graph.edges) {
    const Ti = graph.nodes.get(edge.from)?.temperature ?? 0
    const Tj = graph.nodes.get(edge.to)?.temperature   ?? 0
    const kFwd = edgeConductance(edge, true)
    const kBwd = edgeConductance(edge, false)
    // Forward flux: from → to
    dT.set(edge.to,   (dT.get(edge.to)   ?? 0) + kFwd * (Ti - Tj) * dt)
    dT.set(edge.from, (dT.get(edge.from) ?? 0) - kFwd * (Ti - Tj) * dt)
    // Backward flux: to → from
    dT.set(edge.from, (dT.get(edge.from) ?? 0) + kBwd * (Tj - Ti) * dt)
    dT.set(edge.to,   (dT.get(edge.to)   ?? 0) - kBwd * (Tj - Ti) * dt)
  }

  for (const [id, delta] of dT) {
    const node = graph.nodes.get(id)
    if (!node) continue
    const cooling = LAMBDA * node.temperature * dt
    node.temperature = Math.max(0, node.temperature + delta - cooling)
  }
}

/**
 * One changelog step of Fourier heat diffusion.
 * Energy is conserved between nodes; λ drains slowly to environment.
 */
export function propagate(graph: ThermalGraph): void {
  const dt = DT / SUBSTEPS
  for (let i = 0; i < SUBSTEPS; i++) fourierStep(graph, dt)
}

export interface ChangelogEvent {
  nodeId: string
  kind: HeatEventKind
}

/**
 * Process one changelog step: emit heat for events, then diffuse.
 */
export function thermalStep(
  graph: ThermalGraph,
  events: ChangelogEvent[],
): void {
  for (const event of events) {
    emitHeat(graph, event.nodeId, event.kind)
  }
  propagate(graph)
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
