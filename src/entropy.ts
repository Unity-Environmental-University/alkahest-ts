/**
 * Entropy, flow, and optimal dynamics.
 *
 * The same shape keeps appearing across domains:
 *   - Optimal stopping (1/e threshold)
 *   - Flow theory (Csikszentmihalyi — fluid band between boredom and anxiety)
 *   - Zone of proximal development (Vygotsky — just beyond current capability)
 *   - Failure/success ratio in game design (~70-80% success = flow)
 *   - Variable ratio reinforcement (gambling, the slot machine)
 *   - Reynolds number (laminar vs turbulent flow)
 *
 * All of them: there is an optimal surprise ratio, systems that hold
 * themselves there learn, grow, stay alive.
 *
 * The four phases of matter — extended:
 *
 *   volatile  — gas: too hot, chaotic, pressure without direction
 *   fluid     — liquid: the zone, cooking, maximum learning
 *   salt      — crystalline solid: precipitated correctly, stable, real
 *   glass     — amorphous solid: overcooled or too viscous, brittle, shatters
 *
 * Glass is not salt. Salt has crystal structure — it found its form.
 * Glass was liquid that cooled too fast or was too viscous to find structure.
 * Looks solid. Fractures under stress instead of deforming.
 * Over-engineered codebases. Institutions that can't absorb change.
 */

import type { PhaseMarker } from "./thermal.js"

/** The natural threshold — 1/e ≈ 0.3679 */
export const OPTIMAL_SURPRISE_RATIO = 1 / Math.E

/** Phase markers — glass included. Re-exported from thermal for convenience. */
export type { PhaseMarker }
/** @deprecated use PhaseMarker */
export type ExtendedPhase = PhaseMarker

export interface FlowState {
  /** Ratio of unpredictable to total outcomes [0, 1] */
  surpriseRatio: number
  /** Reynolds number — laminar vs turbulent */
  reynoldsNumber: number
  /** Viscosity — resistance to flow; high viscosity risks glass on cooling */
  viscosity: number
  /** Current phase */
  phase: PhaseMarker
}

/**
 * Reynolds number: Re = ρvL/μ
 *
 *   ρ (density)   — amount of substance per unit volume (n/V from gas law)
 *   v (velocity)  — rate of change (activity rate, T)
 *   L (length)    — characteristic scale (V, file count)
 *   μ (viscosity) — resistance to flow (type rigidity, process friction)
 *
 * Re < 2300: laminar — ordered, predictable, low mixing
 * Re > 4000: turbulent — chaotic, high mixing, volatile
 * 2300–4000: transition — the fluid band, maximum productive flow
 */
export function reynoldsNumber(params: {
  density: number      // n/V — lines per file
  velocity: number     // T — activity rate
  length: number       // V — file count (characteristic scale)
  viscosity: number    // μ — resistance to flow
}): number {
  const { density, velocity, length, viscosity } = params
  if (viscosity <= 0) return Infinity
  return (density * velocity * length) / viscosity
}

/** Laminar flow — ordered, below transition */
export const RE_LAMINAR = 2300
/** Turbulent flow — chaotic, above transition */
export const RE_TURBULENT = 4000

export function flowRegime(re: number): "laminar" | "transition" | "turbulent" {
  if (re < RE_LAMINAR) return "laminar"
  if (re > RE_TURBULENT) return "turbulent"
  return "transition"
}

/**
 * Surprise ratio: fraction of outcomes that weren't predicted.
 *
 * Target: 1/e ≈ 0.368
 *
 * Below 1/e: boring, too predictable, learning slows (boredom)
 * Above 1/e: overwhelming, signal collapses (anxiety)
 * At 1/e:    maximum productive surprise — flow zone
 *
 * This is also the optimal stopping threshold: after seeing 1/e
 * of the candidates, take the next one that exceeds all prior.
 */
export function surpriseRatio(params: {
  /** Outcomes that surprised (unpredicted) */
  surprises: number
  /** Total outcomes observed */
  total: number
}): number {
  if (params.total === 0) return 0
  return params.surprises / params.total
}

/**
 * Distance from optimal surprise ratio.
 * Negative: under-stimulated (toward boredom, salt, laminar)
 * Positive: over-stimulated (toward anxiety, volatile, turbulent)
 */
export function surpriseDrift(ratio: number): number {
  return ratio - OPTIMAL_SURPRISE_RATIO
}

/**
 * Viscosity — resistance to flow.
 *
 * High viscosity systems resist change. Under heat they may not flow at all —
 * they become glass instead of salt when they cool.
 *
 * Sources of viscosity:
 *   - Type rigidity (strict types, many constraints)
 *   - Process friction (review cycles, approval gates)
 *   - Test coverage (resistance to broken changes — healthy viscosity)
 *   - Institutional inertia (org structure, legacy expectations)
 *
 * Viscosity is not bad. It determines what you become when you cool.
 * Low viscosity + slow cooling = salt (crystal structure)
 * High viscosity + fast cooling = glass (amorphous, brittle)
 */
export interface ViscosityFactors {
  /** Type strictness [0, 1] */
  typeRigidity: number
  /** Process friction [0, 1] */
  processFriction: number
  /** Test coverage [0, 1] — healthy viscosity */
  testCoverage: number
  /** Institutional inertia [0, 1] */
  institutionalInertia: number
}

export function computeViscosity(factors: ViscosityFactors): number {
  return (
    factors.typeRigidity * 0.25 +
    factors.processFriction * 0.35 +
    factors.testCoverage * 0.15 +
    factors.institutionalInertia * 0.25
  )
}

/**
 * Brittleness risk: will this system shatter under stress?
 *
 * Glass forms when viscosity is high and the system cools fast
 * (pressure drops suddenly without the structure to absorb it).
 *
 * A system that looks solid but has no crystal structure —
 * no underlying order, just frozen rigidity — will fracture.
 */
export function brittlenessRisk(params: {
  viscosity: number
  coolingRate: number  // how fast pressure is dropping
  hasStructure: boolean  // does it have underlying order (tests, types, docs)?
}): number {
  const { viscosity, coolingRate, hasStructure } = params
  const baseRisk = viscosity * coolingRate
  return hasStructure ? baseRisk * 0.3 : baseRisk
}

/**
 * Classify extended phase from flow state.
 *
 * volatile: high surprise, turbulent Re — gas
 * fluid:    surprise near 1/e, transition Re — liquid, the zone
 * glass:    low surprise, high viscosity, laminar — frozen, brittle risk
 * salt:     low surprise, low viscosity, laminar — crystallized, stable
 */
export function classifyExtendedPhase(state: {
  surpriseRatio: number
  re: number
  viscosity: number
  brittlenessRisk: number
}): PhaseMarker {
  const { surpriseRatio: sr, re, viscosity, brittlenessRisk: br } = state

  if (sr > 0.6 || re > RE_TURBULENT) return "volatile"

  if (Math.abs(sr - OPTIMAL_SURPRISE_RATIO) < 0.15 && re >= RE_LAMINAR) return "fluid"

  // Solid — but which kind?
  if (br > 0.5 || (viscosity > 0.7 && sr < 0.2)) return "glass"

  return "salt"
}

/**
 * Are you in the zone?
 *
 * The fluid band: surprise near 1/e, Reynolds in transition,
 * viscosity moderate, brittleness low.
 */
export function isInZone(state: FlowState): boolean {
  return (
    state.phase === "fluid" &&
    Math.abs(state.surpriseRatio - OPTIMAL_SURPRISE_RATIO) < 0.15 &&
    flowRegime(state.reynoldsNumber) === "transition"
  )
}

/**
 * Diagnosis: where are you and which direction is the zone?
 */
export function diagnoseFlow(state: FlowState): string {
  const regime = flowRegime(state.reynoldsNumber)
  const drift = surpriseDrift(state.surpriseRatio)

  if (state.phase === "glass") {
    return `glass — frozen, brittleness risk ${(brittlenessRisk({
      viscosity: state.viscosity,
      coolingRate: 0.5,
      hasStructure: false,
    }) * 100).toFixed(0)}%. Lower viscosity or introduce structure before stress arrives.`
  }

  if (state.phase === "volatile") {
    return `volatile — turbulent (Re=${state.reynoldsNumber.toFixed(0)}), surprise too high (${(state.surpriseRatio * 100).toFixed(0)}%). Reduce scope or increase viscosity.`
  }

  if (isInZone(state)) {
    return `in the zone — surprise ${(state.surpriseRatio * 100).toFixed(0)}% (target ${(OPTIMAL_SURPRISE_RATIO * 100).toFixed(0)}%), ${regime} flow.`
  }

  if (drift < 0) {
    return `drifting toward boredom — surprise too low (${(state.surpriseRatio * 100).toFixed(0)}%). Increase challenge or reduce viscosity.`
  }

  return `approaching volatile — surprise rising (${(state.surpriseRatio * 100).toFixed(0)}%). Watch the Reynolds number.`
}
