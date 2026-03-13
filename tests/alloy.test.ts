import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { readGas } from "../src/gas.js"
import {
  OPTIMAL_SURPRISE_RATIO,
  reynoldsNumber,
  RE_LAMINAR, RE_TURBULENT,
  flowRegime,
  surpriseDrift,
  brittlenessRisk,
  classifyExtendedPhase,
} from "../src/entropy.js"
import { effectivePhase, buildThermalGraph } from "../src/thermal.js"
import { accumulateConfidence, observerParallax, observationPhase } from "../src/frames.js"

// ── Gas law ──────────────────────────────────────────────

describe("readGas", () => {
  it("stale repo with no activity reads as volatile", () => {
    const g = readGas({ daysSinceCommit: 30, unresolvedCount: 5, fileCount: 10, lineCount: 500, activityRate: 0.1 })
    assert.equal(g.phase, "volatile")
  })

  it("mid-flight repo reads as fluid", () => {
    const g = readGas({ daysSinceCommit: 5, unresolvedCount: 3, fileCount: 8, lineCount: 200, activityRate: 1.5 })
    assert.equal(g.phase, "fluid")
  })

  it("clean repo reads as salt", () => {
    const g = readGas({ daysSinceCommit: 0, unresolvedCount: 0, fileCount: 1, lineCount: 1, activityRate: 0.5 })
    assert.equal(g.phase, "salt")
  })

  it("GasReading includes Reynolds number", () => {
    const g = readGas({ daysSinceCommit: 2, unresolvedCount: 0, fileCount: 5, lineCount: 100, activityRate: 1.0 })
    assert.ok(g.Re > 0, "Re should be positive")
  })

  it("PV = nRT holds", () => {
    const g = readGas({ daysSinceCommit: 3, unresolvedCount: 0, fileCount: 8, lineCount: 200, activityRate: 1.0 })
    assert.ok(Math.abs(g.P * g.V - g.n * g.R * g.T) < 0.001)
  })
})

// ── Entropy / flow ───────────────────────────────────────

describe("OPTIMAL_SURPRISE_RATIO", () => {
  it("is 1/e", () => {
    assert.ok(Math.abs(OPTIMAL_SURPRISE_RATIO - 1 / Math.E) < 1e-10)
  })
})

describe("reynoldsNumber", () => {
  it("returns Infinity for zero viscosity", () => {
    assert.equal(reynoldsNumber({ density: 1, velocity: 1, length: 1, viscosity: 0 }), Infinity)
  })

  it("laminar below 2300", () => {
    const re = reynoldsNumber({ density: 1, velocity: 1, length: 1, viscosity: 1 })
    assert.equal(flowRegime(re), "laminar")
  })

  it("turbulent above 4000", () => {
    const re = reynoldsNumber({ density: 100, velocity: 50, length: 10, viscosity: 0.1 })
    assert.equal(flowRegime(re), "turbulent")
  })
})

describe("surpriseDrift", () => {
  it("negative when under-stimulated", () => {
    assert.ok(surpriseDrift(0.1) < 0)
  })
  it("positive when over-stimulated", () => {
    assert.ok(surpriseDrift(0.9) > 0)
  })
  it("near zero at 1/e", () => {
    assert.ok(Math.abs(surpriseDrift(OPTIMAL_SURPRISE_RATIO)) < 1e-10)
  })
})

describe("brittlenessRisk", () => {
  it("lower when structure exists", () => {
    const withStructure = brittlenessRisk({ viscosity: 0.8, coolingRate: 0.8, hasStructure: true })
    const without = brittlenessRisk({ viscosity: 0.8, coolingRate: 0.8, hasStructure: false })
    assert.ok(withStructure < without)
  })
})

describe("classifyExtendedPhase", () => {
  it("volatile at high surprise", () => {
    assert.equal(classifyExtendedPhase({ surpriseRatio: 0.8, re: 1000, viscosity: 0.3, brittlenessRisk: 0.1 }), "volatile")
  })
  it("glass at low surprise + high viscosity + high brittleness", () => {
    assert.equal(classifyExtendedPhase({ surpriseRatio: 0.05, re: 500, viscosity: 0.9, brittlenessRisk: 0.8 }), "glass")
  })
  it("salt at low surprise + low viscosity", () => {
    assert.equal(classifyExtendedPhase({ surpriseRatio: 0.05, re: 500, viscosity: 0.2, brittlenessRisk: 0.1 }), "salt")
  })
})

// ── Thermal ──────────────────────────────────────────────

describe("effectivePhase", () => {
  it("volatile above boiling point", () => {
    const graph = buildThermalGraph([{ id: "a", phase: "salt", temperature: 100 }], [])
    const node = graph.nodes.get("a")!
    assert.equal(effectivePhase(node), "volatile")
  })

  it("glass node stays glass when cold", () => {
    const graph = buildThermalGraph([{ id: "a", phase: "glass", temperature: 0 }], [])
    const node = graph.nodes.get("a")!
    assert.equal(effectivePhase(node), "glass")
  })
})

// ── Frames ───────────────────────────────────────────────

describe("accumulateConfidence", () => {
  it("returns 0 for empty observations", () => {
    assert.equal(accumulateConfidence([]), 0)
  })

  it("never reaches 1.0", () => {
    const obs = Array.from({ length: 100 }, (_, i) => ({
      subject: "x", predicate: "is", object: "true",
      confidence: 0.99, frame: `f${i}`, timestamp: i,
    }))
    assert.ok(accumulateConfidence(obs) < 1.0)
  })

  it("accumulates — more observations = higher confidence", () => {
    const one = [{ subject: "x", predicate: "is", object: "true", confidence: 0.7, frame: "f1", timestamp: 1 }]
    const two = [...one, { subject: "x", predicate: "is", object: "true", confidence: 0.7, frame: "f2", timestamp: 2 }]
    assert.ok(accumulateConfidence(two) > accumulateConfidence(one))
  })
})

describe("observerParallax", () => {
  it("finds spread between observers", () => {
    const obs = [
      { subject: "x", predicate: "is", object: "good", confidence: 0.9, frame: "a", timestamp: 1 },
      { subject: "x", predicate: "is", object: "good", confidence: 0.4, frame: "b", timestamp: 2 },
    ]
    const p = observerParallax(obs)
    assert.ok(p.length > 0)
    assert.ok(Math.abs(p[0].spread - 0.5) < 0.01)
  })
})

describe("observationPhase", () => {
  it("volatile below 0.4", () => assert.equal(observationPhase(0.3), "volatile"))
  it("fluid between 0.4 and 0.75", () => assert.equal(observationPhase(0.6), "fluid"))
  it("salt above 0.75", () => assert.equal(observationPhase(0.8), "salt"))
})
