/**
 * Quantum superposition layer.
 *
 * QuantumItem wraps any value with a complex amplitude, enabling superpositions.
 * quantumCombine propagates amplitudes through any classical combine function,
 * allowing constructive and destructive interference between paths to the same product.
 *
 * The classical combineFn knows nothing about amplitudes — it operates on plain
 * values. That separation is the point: any existing combine function gains
 * quantum interference for free.
 *
 * Ported from otter-centaur/otter/core/quantum.py (Hallie Larsson / Johnicholas Hines).
 *
 * SPICES: Integrity — the phase assignment for each basis state is an input, not
 * an output. What quantumCombine computes: interference given those phases.
 * Whether the phases are physically correct is a separate question.
 */

export interface QuantumBasis<T> {
  state: T
  amplitude: Complex
}

/** Complex number: { re, im } */
export interface Complex {
  re: number
  im: number
}

export function complex(re: number, im = 0): Complex {
  return { re, im }
}

export function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im }
}

export function mul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  }
}

export function abs(z: Complex): number {
  return Math.sqrt(z.re * z.re + z.im * z.im)
}

export function absSquared(z: Complex): number {
  return z.re * z.re + z.im * z.im
}

/** A value that may exist in superposition over multiple basis states. */
export interface QuantumItem<T> {
  name: string
  bases: QuantumBasis<T>[]
}

/** Wrap a classical value as a definite (amplitude-1) quantum state. */
export function definite<T>(name: string, value: T): QuantumItem<T> {
  return { name, bases: [{ state: value, amplitude: complex(1) }] }
}

/** Create a named superposition from (value, amplitude) pairs. */
export function superpose<T>(
  name: string,
  ...states: [T, Complex][]
): QuantumItem<T> {
  return { name, bases: states.map(([state, amplitude]) => ({ state, amplitude })) }
}

/** Sum of |amplitude|² across all basis states. */
export function totalWeight<T>(q: QuantumItem<T>): number {
  return q.bases.reduce((s, b) => s + absSquared(b.amplitude), 0)
}

/**
 * Combine two QuantumItems, propagating complex amplitudes through
 * a classical combine function.
 *
 * For each pair (bx, by) of basis states, the classical combineFn is called.
 * Path amplitudes multiply: amp(bx) × amp(by).
 * Paths producing the same product key have their amplitudes SUMMED:
 *
 *   constructive interference: paths in phase   → large |ψ|² → preferred
 *   destructive interference:  paths out of phase → small |ψ|² → suppressed
 *
 * Products whose total amplitude falls below 1e-10 are pruned — they are
 * genuinely cancelled by interference, not just small.
 *
 * @param qx - first quantum item
 * @param qy - second quantum item
 * @param combineFn - classical function: (x, y) → list of {key, value} products
 * @returns list of QuantumItems, one per surviving product key
 */
export function quantumCombine<X, Y, P>(
  qx: QuantumItem<X>,
  qy: QuantumItem<Y>,
  combineFn: (x: X, y: Y) => Array<{ key: string; value: P }>,
): QuantumItem<P>[] {
  const amplitudeMap = new Map<string, Complex>()
  const valueMap = new Map<string, P>()

  for (const bx of qx.bases) {
    for (const by of qy.bases) {
      const pathAmplitude = mul(bx.amplitude, by.amplitude)
      for (const product of combineFn(bx.state, by.state)) {
        const prev = amplitudeMap.get(product.key) ?? complex(0)
        amplitudeMap.set(product.key, add(prev, pathAmplitude))
        valueMap.set(product.key, product.value)
      }
    }
  }

  const results: QuantumItem<P>[] = []
  for (const [key, amplitude] of amplitudeMap) {
    if (abs(amplitude) < 1e-10) continue
    results.push({
      name: key,
      bases: [{ state: valueMap.get(key)!, amplitude }],
    })
  }
  return results
}

/**
 * Collect |ψ|² weights by key across a list of results.
 * States with the same name have their weights summed.
 */
export function amplitudeMap<P>(results: QuantumItem<P>[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const q of results) {
    for (const b of q.bases) {
      totals.set(q.name, (totals.get(q.name) ?? 0) + absSquared(b.amplitude))
    }
  }
  return totals
}
