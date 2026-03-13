import { describe, it, expect } from "vitest"

import {
  complex, definite, superpose, quantumCombine, amplitudeMap,
  totalWeight, abs,
} from "../src/quantum.js"

type Item = { name: string }
const item = (name: string): Item => ({ name })

const K1_BONDS = new Set(["C1", "C2", "C3", "C4"])
const K2_BONDS = new Set(["C2", "C3", "C4", "C5"])

function easCombine(x: Item, y: Item): Array<{ key: string; value: Item }> {
  const hasE = x.name === "E+" || y.name === "E+"
  if (!hasE) return []
  const struct = x.name !== "E+" ? x : y
  if (struct.name === "K1") return [...K1_BONDS].map(c => ({ key: c + "+", value: item(c + "+") }))
  if (struct.name === "K2") return [...K2_BONDS].map(c => ({ key: c + "+", value: item(c + "+") }))
  if (struct.name === "donor_C3") return [{ key: "C3+", value: item("C3+") }]
  if (struct.name === "donor_neg_C2") return [{ key: "C2+", value: item("C2+") }]
  return []
}

describe("quantumCombine", () => {
  it("definite × definite: no interference, classic result", () => {
    const mol = definite("K1", item("K1"))
    const e   = definite("E+", item("E+"))
    const results = quantumCombine(mol, e, easCombine)
    expect(results.length).toBe(4)
    const keys = new Set(results.map(r => r.name))
    expect(keys.has("C1+")).toBe(true)
    expect(keys.has("C4+")).toBe(true)
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
    const sharedWeight = weights.get("C2+") ?? 0
    const uniqueWeight = weights.get("C1+") ?? 0
    expect(sharedWeight).toBeGreaterThan(uniqueWeight)
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
    expect(weights.has("C2+")).toBe(false)
    expect(weights.has("C3+")).toBe(false)
    expect(weights.has("C4+")).toBe(false)
    expect(weights.has("C1+")).toBe(true)
  })

  it("positive donor boosts a position", () => {
    const INV_SQRT2 = 1 / Math.sqrt(2)
    const mol = superpose("phenol-like",
      [item("K1"),       complex(INV_SQRT2)],
      [item("K2"),       complex(INV_SQRT2)],
      [item("donor_C3"), complex(0.4)],
    )
    const e = definite("E+", item("E+"))
    const results = quantumCombine(mol, e, easCombine)
    const weights = amplitudeMap(results)
    expect(weights.get("C3+") ?? 0).toBeGreaterThan(weights.get("C1+") ?? 0)
  })

  it("negative donor suppresses a position relative to baseline", () => {
    const INV_SQRT2 = 1 / Math.sqrt(2)
    const baseline = superpose("baseline",
      [item("K1"), complex(INV_SQRT2)],
      [item("K2"), complex(INV_SQRT2)],
    )
    const e = definite("E+", item("E+"))
    const baseWeights = amplitudeMap(quantumCombine(baseline, e, easCombine))

    const mol = superpose("nitro-like",
      [item("K1"),           complex( INV_SQRT2)],
      [item("K2"),           complex( INV_SQRT2)],
      [item("donor_neg_C2"), complex(-0.4)],
    )
    const weights = amplitudeMap(quantumCombine(mol, e, easCombine))
    expect(weights.get("C2+") ?? 0).toBeLessThan(baseWeights.get("C2+") ?? 0)
  })

  it("totalWeight sums |amplitude|² across bases", () => {
    const INV_SQRT2 = 1 / Math.sqrt(2)
    const q = superpose("test",
      [item("a"), complex(INV_SQRT2)],
      [item("b"), complex(INV_SQRT2)],
    )
    expect(totalWeight(q)).toBeCloseTo(1.0, 10)
  })

  it("abs: |3+4i| = 5", () => {
    expect(abs(complex(3, 4))).toBeCloseTo(5, 10)
  })
})
