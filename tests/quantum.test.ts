import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  complex, definite, superpose, quantumCombine, amplitudeMap,
  totalWeight, abs,
} from "../src/quantum.js"

// ── helpers ───────────────────────────────────────────────────────────────────

type Item = { name: string }
const item = (name: string): Item => ({ name })

/** Combine: if one item is "E+" and the other is a Kekulé structure, attack. */
const K1_BONDS = new Set(["C1", "C2", "C3", "C4"])
const K2_BONDS = new Set(["C2", "C3", "C4", "C5"])

function easCombine(x: Item, y: Item): Array<{ key: string; value: Item }> {
  const hasE = x.name === "E+" || y.name === "E+"
  if (!hasE) return []
  const struct = x.name !== "E+" ? x : y
  if (struct.name === "K1") {
    return [...K1_BONDS].map(c => ({ key: c + "+", value: item(c + "+") }))
  }
  if (struct.name === "K2") {
    return [...K2_BONDS].map(c => ({ key: c + "+", value: item(c + "+") }))
  }
  if (struct.name === "donor_C3") {
    return [{ key: "C3+", value: item("C3+") }]
  }
  if (struct.name === "donor_neg_C2") {
    return [{ key: "C2+", value: item("C2+") }]
  }
  return []
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("quantumCombine", () => {
  it("definite × definite: no interference, classic result", () => {
    const mol = definite("K1", item("K1"))
    const e   = definite("E+", item("E+"))
    const results = quantumCombine(mol, e, easCombine)
    assert.equal(results.length, 4)
    const keys = new Set(results.map(r => r.name))
    assert.ok(keys.has("C1+"))
    assert.ok(keys.has("C4+"))
  })

  it("equal superposition: overlapping positions constructively interfere", () => {
    const INV_SQRT2 = 1 / Math.sqrt(2)
    const mol = superpose("benzene",
      [item("K1"), complex(INV_SQRT2)],
      [item("K2"), complex(INV_SQRT2)],
    )
    const e = definite("E+", item("E+"))
    const results = quantumCombine(mol, e, easCombine)
    const weights = amplitudeMap(results)

    // C2, C3, C4 appear in both K1 and K2 — higher weight
    const sharedWeight = (weights.get("C2+") ?? 0)
    const uniqueWeight = (weights.get("C1+") ?? 0)
    assert.ok(sharedWeight > uniqueWeight, `shared ${sharedWeight} should exceed unique ${uniqueWeight}`)
  })

  it("opposite-phase superposition: shared positions destructively interfere", () => {
    const INV_SQRT2 = 1 / Math.sqrt(2)
    const mol = superpose("anti",
      [item("K1"), complex( INV_SQRT2)],
      [item("K2"), complex(-INV_SQRT2)],
    )
    const e = definite("E+", item("E+"))
    const results = quantumCombine(mol, e, easCombine)
    const weights = amplitudeMap(results)

    // C2, C3, C4 are in both structures with opposite signs → cancel
    assert.ok(!weights.has("C2+"), "C2+ should be cancelled")
    assert.ok(!weights.has("C3+"), "C3+ should be cancelled")
    assert.ok(!weights.has("C4+"), "C4+ should be cancelled")
    // C1 only in K1 (positive) — survives
    assert.ok(weights.has("C1+"), "C1+ should survive")
  })

  it("positive donor boosts a position", () => {
    const INV_SQRT2 = 1 / Math.sqrt(2)
    const DONOR = 0.4
    const mol = superpose("phenol-like",
      [item("K1"),       complex(INV_SQRT2)],
      [item("K2"),       complex(INV_SQRT2)],
      [item("donor_C3"), complex(DONOR)],
    )
    const e = definite("E+", item("E+"))
    const results = quantumCombine(mol, e, easCombine)
    const weights = amplitudeMap(results)

    // C3 appears in K2 + donor → larger amplitude than C1 (K1 only)
    assert.ok((weights.get("C3+") ?? 0) > (weights.get("C1+") ?? 0))
  })

  it("negative donor suppresses a position relative to unsuppressed baseline", () => {
    const INV_SQRT2 = 1 / Math.sqrt(2)
    const WITHDRAW = 0.4

    // Baseline: equal Kekulé only
    const baseline = superpose("baseline",
      [item("K1"), complex(INV_SQRT2)],
      [item("K2"), complex(INV_SQRT2)],
    )
    const e = definite("E+", item("E+"))
    const baseWeights = amplitudeMap(quantumCombine(baseline, e, easCombine))

    // With negative donor suppressing C2
    const mol = superpose("nitro-like",
      [item("K1"),            complex( INV_SQRT2)],
      [item("K2"),            complex( INV_SQRT2)],
      [item("donor_neg_C2"),  complex(-WITHDRAW)],
    )
    const weights = amplitudeMap(quantumCombine(mol, e, easCombine))

    // C2 weight should be lower than baseline (destructive interference at C2)
    const c2Base = baseWeights.get("C2+") ?? 0
    const c2After = weights.get("C2+") ?? 0
    assert.ok(c2After < c2Base, `C2 weight (${c2After}) should be reduced below baseline (${c2Base})`)
  })

  it("totalWeight sums |amplitude|² across bases", () => {
    const INV_SQRT2 = 1 / Math.sqrt(2)
    const q = superpose("test",
      [item("a"), complex(INV_SQRT2)],
      [item("b"), complex(INV_SQRT2)],
    )
    assert.ok(Math.abs(totalWeight(q) - 1.0) < 1e-10)
  })

  it("abs: |3+4i| = 5", () => {
    assert.ok(Math.abs(abs(complex(3, 4)) - 5) < 1e-10)
  })
})
