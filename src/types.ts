/**
 * Core item types for the Otter loop.
 *
 * Item:   classic Otter — named, content-bearing
 * Edge:   relationship-first knowledge graph node (SPICES: Equality)
 * Clause: disjunction of literals for resolution domains
 *
 * All item types share the OtterItem interface.
 */

export interface OtterItem {
  readonly name: string
  readonly content: string
  readonly source: readonly string[]
  step: number
}

export interface Item extends OtterItem {
  kind: "item"
}

export interface Edge extends OtterItem {
  kind: "edge"
  subject: string
  predicate: string
  object: string
  confidence: number
}

export type Literal = [sign: boolean, predicate: string, ...args: unknown[]]

export interface Clause extends OtterItem {
  kind: "clause"
  literals: ReadonlySet<Literal>
  label: string
}

export interface OtterState<T extends OtterItem = OtterItem> {
  setOfSupport: T[]
  usable: T[]
  history: StepRecord[]
  step: number
  halted: boolean
  haltReason: string
}

export interface StepRecord {
  step: number
  focus: string
  combinedWith: number
  produced: string[]
  setOfSupportSize: number
  usableSize: number
}

/**
 * A domain bundles everything the Otter loop needs to run.
 * Implement this interface to define a new domain.
 */
export interface OtterDomain<T extends OtterItem = OtterItem> {
  initialState: () => OtterState<T>
  combineFn: (focus: T, other: T) => T[]
  stopFn?: (state: OtterState<T>) => boolean
  subsumeFn?: (a: T, b: T) => boolean
  pruneFn?: (item: T, state: OtterState<T>) => boolean
  chooseFocusFn?: (setOfSupport: T[]) => T
}
