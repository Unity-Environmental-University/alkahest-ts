/**
 * Observer frames — the math, not the CLI.
 *
 * Every observation is positioned. Confidence accumulates but never reaches 1.0.
 * Parallax is where observers disagree — that's the most valuable signal.
 *
 * This is the physics of knowing. rhizome-alkahest builds the UX on top.
 */

export interface Frame {
  id: string
  /** Who is observing */
  observer: string
  /** What they can see from here */
  position?: string
  created: number
}

export interface Observation {
  subject: string
  predicate: string
  object: string
  confidence: number
  frame: string
  timestamp: number
  note?: string
}

/** Confidence ceiling — approaches but never reaches */
export const CONFIDENCE_CEILING = 0.99

/**
 * Accumulate confidence from multiple observations.
 * Each new observation nudges toward ceiling but never arrives.
 * Bayesian-ish: treat each observation as independent evidence.
 */
export function accumulateConfidence(observations: Observation[]): number {
  if (observations.length === 0) return 0
  // Product of doubts: P(wrong) = Π(1 - ci)
  const doubt = observations.reduce((d, o) => d * (1 - o.confidence), 1)
  return Math.min(1 - doubt, CONFIDENCE_CEILING)
}

/**
 * Parallax: where do observers disagree?
 * Spread is the signal. Walk toward the deepest spread.
 */
export function observerParallax(
  observations: Observation[],
  minSpread = 0.05,
): Array<{ subject: string; predicate: string; object: string; spread: number; observers: string[] }> {
  const byTriple = new Map<string, Observation[]>()
  for (const o of observations) {
    const key = `${o.subject}|${o.predicate}|${o.object}`
    const group = byTriple.get(key) ?? []
    group.push(o)
    byTriple.set(key, group)
  }

  const result = []
  for (const [key, group] of byTriple) {
    const frames = [...new Set(group.map(o => o.frame))]
    if (frames.length < 2) continue
    const confidences = group.map(o => o.confidence)
    const spread = Math.max(...confidences) - Math.min(...confidences)
    if (spread < minSpread) continue
    const [subject, predicate, object] = key.split("|")
    result.push({ subject, predicate, object, spread, observers: frames })
  }

  return result.sort((a, b) => b.spread - a.spread)
}

/** Phase of an observation based on confidence */
export function observationPhase(confidence: number): "volatile" | "fluid" | "salt" {
  if (confidence < 0.4) return "volatile"
  if (confidence < 0.75) return "fluid"
  return "salt"
}
