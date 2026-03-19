/**
 * Otter Trie — a trie that precipitates from the Otter loop.
 *
 * Items are observations: "in context C, symbol S appeared."
 * Combining two observations extends the context path.
 * The trie isn't built — it falls out of saturation.
 *
 * An observation at depth 1: "after 'h', saw 'e'"
 * An observation at depth 2: "after 'th', saw 'e'"  (from combining 't→h' with 'h→e')
 * Merge: when a path is predicted correctly, the path becomes a token.
 */

import { makeItem } from "../items.js"
import type { Item, OtterDomain, OtterState } from "../types.js"

const TARGET = 1 - 1 / Math.E

/** An observation item encodes: after this context, this symbol appeared N times. */
interface TrieItem extends Item {
  context: string[]
  symbol: string
  count: number
  predictions: number
  hits: number
}

function makeTrieItem(
  context: string[],
  symbol: string,
  count: number,
  source: string[] = [],
): TrieItem {
  const ctxStr = context.length > 0 ? context.join("→") : "∅"
  const name = `${ctxStr}|${symbol}`
  return {
    kind: "item",
    name,
    content: `after [${ctxStr}], saw '${symbol}' ×${count}`,
    source,
    step: 0,
    context,
    symbol,
    count,
    predictions: 0,
    hits: 0,
  }
}

/**
 * Combine two observations.
 *
 * If focus has context [A] and symbol B,
 * and other has context [B] (or ending in B) and symbol C,
 * then produce a deeper observation: context [A, B], symbol C.
 *
 * This IS trie construction — each combine extends a path by one step.
 */
function combine(focus: TrieItem, other: TrieItem): Item[] {
  // The focus's symbol must match the start of other's context
  // "after [A], saw B" + "after [B], saw C" → "after [A,B], saw C"
  if (other.context.length === 0) return []
  if (other.context[0] !== focus.symbol) return []

  // Don't build paths deeper than 15
  const newCtx = [...focus.context, focus.symbol]
  if (newCtx.length > 15) return []

  const newItem = makeTrieItem(
    newCtx,
    other.symbol,
    Math.min(focus.count, other.count),
    [focus.name, other.name],
  )

  return [newItem]
}

/**
 * Subsumption: a deeper context with enough evidence subsumes a shallower one
 * for the same symbol — if it predicts at least as well.
 */
function subsume(a: TrieItem, b: TrieItem): boolean {
  if (a.symbol !== b.symbol) return false
  if (a.context.length <= b.context.length) return false
  // a is deeper — does it end with b's context?
  const aEnd = a.context.slice(-b.context.length)
  if (b.context.length === 0) return a.count >= b.count
  return (
    aEnd.every((s, i) => s === b.context[i]) &&
    a.count >= b.count
  )
}

/**
 * Feed text into the Otter loop as initial observations.
 *
 * Depth-1 observations: for each position, "after [prev], saw current"
 * The Otter loop will combine these into deeper paths.
 */
export function textToObservations(text: string): TrieItem[] {
  const counts = new Map<string, { ctx: string[]; sym: string; count: number }>()

  for (let i = 0; i < text.length; i++) {
    const sym = text[i]
    const ctx = i > 0 ? [text[i - 1]] : []
    const key = `${ctx.join("")}|${sym}`
    const existing = counts.get(key)
    if (existing) {
      existing.count++
    } else {
      counts.set(key, { ctx, sym, count: 1 })
    }
  }

  return [...counts.values()].map(({ ctx, sym, count }) =>
    makeTrieItem(ctx, sym, count),
  )
}

export function otterTrie(text: string): OtterDomain<TrieItem> {
  const observations = textToObservations(text)

  return {
    initialState: (): OtterState<TrieItem> => ({
      setOfSupport: observations,
      usable: [],
      history: [],
      step: 0,
      halted: false,
      haltReason: "",
    }),
    combineFn: combine as (focus: TrieItem, other: TrieItem) => TrieItem[],
    subsumeFn: subsume,
    pruneFn: (item: TrieItem) => item.count < 2,
  }
}
