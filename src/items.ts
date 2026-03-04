/**
 * Constructors for the three item types.
 */

import type { Item, Edge, Clause, Literal } from "./types.js"

export function makeItem(name: string, content: string, source: string[] = []): Item {
  return { kind: "item", name, content, source, step: 0 }
}

export function makeEdge(
  subject: string,
  predicate: string,
  object: string,
  confidence = 0.7,
  source: string[] = [],
): Edge {
  return {
    kind: "edge",
    subject,
    predicate,
    object,
    confidence,
    source,
    step: 0,
    name: `(${subject} --${predicate}--> ${object})`,
    content: `${subject} ${predicate} ${object} [confidence: ${confidence}]`,
  }
}

export function makeClause(literals: Literal[], label = "", source: string[] = []): Clause {
  const literalSet = new Set(literals)
  const name = literals.length === 0
    ? "[]"
    : literals.map(lit => {
        const [sign, pred, ...args] = lit
        return `${sign ? "" : "~"}${pred}(${args.join(", ")})`
      }).sort().join(" | ")

  return {
    kind: "clause",
    literals: literalSet,
    label,
    source,
    step: 0,
    name: label ? `[${label}] ${name}` : name,
    content: name,
  }
}
