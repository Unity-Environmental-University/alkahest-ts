// Otter loop
export type { OtterItem, Item, Edge, Clause, Literal, OtterState, OtterDomain, StepRecord, Volatile, Fluid, Salt, Alkahest } from "./types.js"
export { otterStep, runOtter } from "./engine.js"
export { makeItem, makeEdge, makeClause } from "./items.js"

// Thermal
export type { PhaseMarker, ThermalNode, ThermalEdge, ThermalGraph, EffectivePhase, HeatEventKind, ChangelogEvent, ThermalSnapshot } from "./thermal.js"
export { effectivePhase, defaultThresholds, emitHeat, propagate, thermalStep, buildThermalGraph, snapshot } from "./thermal.js"

// Gas law
export type { GasState, GasReading } from "./gas.js"
export { readGas, readRepoGas } from "./gas.js"

// Graph primitives
export type { Node, Graph, BondType } from "./graph.js"
export { createGraph, addNode, addEdge, edgesFrom, edgesTo, parallax } from "./graph.js"

// Observer frames
export type { Frame, Observation } from "./frames.js"
export { accumulateConfidence, observerParallax, observationPhase, CONFIDENCE_CEILING } from "./frames.js"

// Quantum superposition
export type { QuantumBasis, QuantumItem, Complex } from "./quantum.js"
export { complex, add, mul, abs, absSquared, definite, superpose, totalWeight, quantumCombine, amplitudeMap } from "./quantum.js"

// Entropy / flow
export type { FlowState, ViscosityFactors, ExtendedPhase } from "./entropy.js"
export {
  OPTIMAL_SURPRISE_RATIO,
  reynoldsNumber, RE_LAMINAR, RE_TURBULENT, flowRegime,
  surpriseRatio, surpriseDrift,
  computeViscosity, brittlenessRisk,
  classifyExtendedPhase, isInZone, diagnoseFlow,
} from "./entropy.js"
