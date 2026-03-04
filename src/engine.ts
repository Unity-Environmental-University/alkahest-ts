/**
 * The Otter main loop.
 *
 * Based on Johnicholas Hines' formulation: pick a focus from set_of_support,
 * combine it with everything in usable, add new results back to set_of_support.
 * The combination function is entirely pluggable — this loop knows nothing
 * about what the items mean.
 *
 * SPICES: Simplicity — the algorithm stripped to its essence.
 * SPICES: Community — the pluggable combineFn invites human, LLM, or centaur.
 */

import type { OtterItem, OtterState, OtterDomain } from "./types.js"

export interface StepOptions {
  maxNewItems?: number
  verbose?: boolean
}

export function otterStep<T extends OtterItem>(
  state: OtterState<T>,
  domain: Pick<OtterDomain<T>, "combineFn" | "subsumeFn" | "pruneFn" | "chooseFocusFn">,
  options: StepOptions = {},
): OtterState<T> {
  const { maxNewItems = 50, verbose = false } = options

  if (state.setOfSupport.length === 0) {
    return { ...state, halted: true, haltReason: "set_of_support empty" }
  }

  let focus: T
  if (domain.chooseFocusFn) {
    focus = domain.chooseFocusFn(state.setOfSupport)
    state = { ...state, setOfSupport: state.setOfSupport.filter(x => x !== focus) }
  } else {
    const [head, ...rest] = state.setOfSupport
    focus = head
    state = { ...state, setOfSupport: rest }
  }

  const nextStep = state.step + 1
  if (verbose) console.log(`\n--- Step ${nextStep}: Focus on ${focus.name} ---`)

  const newItems: T[] = []
  const allKnown = () => new Set([...state.setOfSupport, ...state.usable, ...newItems].map(x => x.name))

  outer: for (const y of state.usable) {
    const results = domain.combineFn(focus, y)
    for (const result of results) {
      if (allKnown().has(result.name)) continue

      if (domain.subsumeFn) {
        const known = [...state.setOfSupport, ...state.usable, ...newItems]
        if (known.some(k => domain.subsumeFn!(k, result))) {
          if (verbose) console.log(`  [subsumed] ${result.name}`)
          continue
        }
      }

      if (domain.pruneFn && domain.pruneFn(result, state)) {
        if (verbose) console.log(`  [pruned] ${result.name}`)
        continue
      }

      newItems.push({ ...result, step: nextStep })
      if (verbose) console.log(`  [new] ${result.name} (from ${focus.name} + ${y.name})`)

      if (newItems.length >= maxNewItems) {
        if (verbose) console.log(`  [safety valve] maxNewItems reached`)
        break outer
      }
    }
  }

  // Back-subsumption
  let { setOfSupport, usable } = state
  if (domain.subsumeFn) {
    for (const newItem of newItems) {
      setOfSupport = setOfSupport.filter(x => !domain.subsumeFn!(newItem, x))
      usable = usable.filter(x => !domain.subsumeFn!(newItem, x))
    }
  }

  const record = {
    step: nextStep,
    focus: focus.name,
    combinedWith: usable.length,
    produced: newItems.map(x => x.name),
    setOfSupportSize: setOfSupport.length + newItems.length,
    usableSize: usable.length + 1,
  }

  if (verbose) {
    console.log(`  Set of support: ${record.setOfSupportSize} | Usable: ${record.usableSize}`)
  }

  return {
    ...state,
    step: nextStep,
    setOfSupport: [...setOfSupport, ...newItems],
    usable: [...usable, { ...focus, step: nextStep }],
    history: [...state.history, record],
  }
}

export function runOtter<T extends OtterItem>(
  domain: OtterDomain<T>,
  options: StepOptions & { maxSteps?: number } = {},
): OtterState<T> {
  const { maxSteps = 100, ...stepOptions } = options
  let state = domain.initialState()

  for (let i = 0; i < maxSteps; i++) {
    if (state.halted) break
    if (domain.stopFn?.(state)) {
      state = { ...state, halted: true, haltReason: "stop condition met" }
      break
    }
    state = otterStep(state, domain, stepOptions)
  }

  return state
}
