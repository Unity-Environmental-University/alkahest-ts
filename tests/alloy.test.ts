import { describe, it, expect } from "vitest"

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
    expect(g.phase).toBe("volatile")
  })

  it("mid-flight repo reads as fluid", () => {
    const g = readGas({ daysSinceCommit: 5, unresolvedCount: 3, fileCount: 8, lineCount: 200, activityRate: 1.5 })
    expect(g.phase).toBe("fluid")
  })

  it("clean repo reads as salt", () => {
    const g = readGas({ daysSinceCommit: 0, unresolvedCount: 0, fileCount: 1, lineCount: 1, activityRate: 0.5 })
    expect(g.phase).toBe("salt")
  })

  it("GasReading includes Reynolds number", () => {
    const g = readGas({ daysSinceCommit: 2, unresolvedCount: 0, fileCount: 5, lineCount: 100, activityRate: 1.0 })
    expect(g.Re).toBeGreaterThan(0)
  })

  it("PV = nRT holds", () => {
    const g = readGas({ daysSinceCommit: 3, unresolvedCount: 0, fileCount: 8, lineCount: 200, activityRate: 1.0 })
    expect(Math.abs(g.P * g.V - g.n * g.R * g.T)).toBeLessThan(0.001)
  })
})

// ── Entropy / flow ───────────────────────────────────────

describe("OPTIMAL_SURPRISE_RATIO", () => {
  it("is 1/e", () => {
    expect(OPTIMAL_SURPRISE_RATIO).toBeCloseTo(1 / Math.E, 10)
  })
})

describe("reynoldsNumber", () => {
  it("returns Infinity for zero viscosity", () => {
    expect(reynoldsNumber({ density: 1, velocity: 1, length: 1, viscosity: 0 })).toBe(Infinity)
  })

  it("laminar below 2300", () => {
    const re = reynoldsNumber({ density: 1, velocity: 1, length: 1, viscosity: 1 })
    expect(flowRegime(re)).toBe("laminar")
  })

  it("turbulent above 4000", () => {
    const re = reynoldsNumber({ density: 100, velocity: 50, length: 10, viscosity: 0.1 })
    expect(flowRegime(re)).toBe("turbulent")
  })
})

describe("surpriseDrift", () => {
  it("negative when under-stimulated", () => {
    expect(surpriseDrift(0.1)).toBeLessThan(0)
  })
  it("positive when over-stimulated", () => {
    expect(surpriseDrift(0.9)).toBeGreaterThan(0)
  })
  it("near zero at 1/e", () => {
    expect(surpriseDrift(OPTIMAL_SURPRISE_RATIO)).toBeCloseTo(0, 10)
  })
})

describe("brittlenessRisk", () => {
  it("lower when structure exists", () => {
    const withStructure = brittlenessRisk({ viscosity: 0.8, coolingRate: 0.8, hasStructure: true })
    const without = brittlenessRisk({ viscosity: 0.8, coolingRate: 0.8, hasStructure: false })
    expect(withStructure).toBeLessThan(without)
  })
})

describe("classifyExtendedPhase", () => {
  it("volatile at high surprise", () => {
    expect(classifyExtendedPhase({ surpriseRatio: 0.8, re: 1000, viscosity: 0.3, brittlenessRisk: 0.1 })).toBe("volatile")
  })
  it("glass at low surprise + high viscosity + high brittleness", () => {
    expect(classifyExtendedPhase({ surpriseRatio: 0.05, re: 500, viscosity: 0.9, brittlenessRisk: 0.8 })).toBe("glass")
  })
  it("salt at low surprise + low viscosity", () => {
    expect(classifyExtendedPhase({ surpriseRatio: 0.05, re: 500, viscosity: 0.2, brittlenessRisk: 0.1 })).toBe("salt")
  })
})

// ── Thermal ──────────────────────────────────────────────

describe("effectivePhase with glass", () => {
  it("volatile above boiling point", () => {
    const graph = buildThermalGraph([{ id: "a", phase: "salt", temperature: 100 }], [])
    const node = graph.nodes.get("a")!
    expect(effectivePhase(node)).toBe("volatile")
  })

  it("glass node stays glass when cold", () => {
    const graph = buildThermalGraph([{ id: "a", phase: "glass", temperature: 0 }], [])
    const node = graph.nodes.get("a")!
    expect(effectivePhase(node)).toBe("glass")
  })
})

// ── Frames ───────────────────────────────────────────────

describe("accumulateConfidence", () => {
  it("returns 0 for empty observations", () => {
    expect(accumulateConfidence([])).toBe(0)
  })

  it("never reaches 1.0", () => {
    const obs = Array.from({ length: 100 }, (_, i) => ({
      subject: "x", predicate: "is", object: "true",
      confidence: 0.99, frame: `f${i}`, timestamp: i,
    }))
    expect(accumulateConfidence(obs)).toBeLessThan(1.0)
  })

  it("accumulates — more observations = higher confidence", () => {
    const one = [{ subject: "x", predicate: "is", object: "true", confidence: 0.7, frame: "f1", timestamp: 1 }]
    const two = [...one, { subject: "x", predicate: "is", object: "true", confidence: 0.7, frame: "f2", timestamp: 2 }]
    expect(accumulateConfidence(two)).toBeGreaterThan(accumulateConfidence(one))
  })
})

describe("observerParallax", () => {
  it("finds spread between observers", () => {
    const obs = [
      { subject: "x", predicate: "is", object: "good", confidence: 0.9, frame: "a", timestamp: 1 },
      { subject: "x", predicate: "is", object: "good", confidence: 0.4, frame: "b", timestamp: 2 },
    ]
    const p = observerParallax(obs)
    expect(p.length).toBeGreaterThan(0)
    expect(p[0].spread).toBeCloseTo(0.5, 2)
  })
})

describe("observationPhase", () => {
  it("volatile below 0.4", () => expect(observationPhase(0.3)).toBe("volatile"))
  it("fluid between 0.4 and 0.75", () => expect(observationPhase(0.6)).toBe("fluid"))
  it("salt above 0.75", () => expect(observationPhase(0.8)).toBe("salt"))
})
