import { describe, it, expect } from "vitest"
import {
  buildThermalGraph,
  effectivePhase,
  emitHeat,
  propagate,
  cool,
  thermalStep,
  snapshot,
  defaultThresholds,
} from "../src/thermal.js"

// Simple graph: core-types → parser → cli
function makeGraph() {
  return buildThermalGraph(
    [
      { id: "core-types", phase: "salt" },
      { id: "parser",     phase: "fluid" },
      { id: "cli",        phase: "volatile" },
    ],
    [
      { from: "core-types", to: "parser",     conductance: 0.8 },
      { from: "parser",     to: "cli",        conductance: 0.8 },
    ],
  )
}

describe("defaultThresholds", () => {
  it("increases thresholds with more dependents", () => {
    const few  = defaultThresholds(1)
    const many = defaultThresholds(5)
    expect(many.meltingPoint).toBeGreaterThan(few.meltingPoint)
    expect(many.boilingPoint).toBeGreaterThan(few.boilingPoint)
  })

  it("boiling point is always above melting point", () => {
    for (const n of [0, 1, 3, 10]) {
      const { meltingPoint, boilingPoint } = defaultThresholds(n)
      expect(boilingPoint).toBeGreaterThan(meltingPoint)
    }
  })
})

describe("buildThermalGraph", () => {
  it("sets higher thresholds for nodes with more dependents", () => {
    const g = makeGraph()
    const coreTypes = g.nodes.get("core-types")!
    const cli       = g.nodes.get("cli")!
    // core-types has 1 dependent; cli has 0
    expect(coreTypes.meltingPoint).toBeGreaterThan(cli.meltingPoint)
  })

  it("starts all nodes at zero temperature", () => {
    const g = makeGraph()
    for (const node of g.nodes.values()) {
      expect(node.temperature).toBe(0)
    }
  })
})

describe("effectivePhase", () => {
  it("returns salt when cold", () => {
    const g = makeGraph()
    const node = g.nodes.get("parser")!
    expect(effectivePhase(node)).toBe("salt")
  })

  it("returns fluid when above melting point", () => {
    const g = makeGraph()
    const node = g.nodes.get("parser")!
    node.temperature = node.meltingPoint + 0.1
    expect(effectivePhase(node)).toBe("fluid")
  })

  it("returns volatile when above boiling point", () => {
    const g = makeGraph()
    const node = g.nodes.get("parser")!
    node.temperature = node.boilingPoint + 0.1
    expect(effectivePhase(node)).toBe("volatile")
  })

  it("volatile material at zero temperature is still effectively salt", () => {
    // phase is intrinsic; effective is driven by temperature
    const g = makeGraph()
    const cli = g.nodes.get("cli")!
    expect(cli.phase).toBe("volatile")
    expect(effectivePhase(cli)).toBe("salt")
  })
})

describe("emitHeat", () => {
  it("increases temperature of the target node", () => {
    const g = makeGraph()
    emitHeat(g, "core-types", "salt-type-change")
    expect(g.nodes.get("core-types")!.temperature).toBeGreaterThan(0)
  })

  it("salt-type-change emits more heat than fluid-recompile", () => {
    const g1 = makeGraph()
    const g2 = makeGraph()
    emitHeat(g1, "parser", "salt-type-change")
    emitHeat(g2, "parser", "fluid-recompile")
    expect(g1.nodes.get("parser")!.temperature).toBeGreaterThan(g2.nodes.get("parser")!.temperature)
  })

  it("does not affect other nodes", () => {
    const g = makeGraph()
    emitHeat(g, "core-types", "fluid-recompile")
    expect(g.nodes.get("parser")!.temperature).toBe(0)
    expect(g.nodes.get("cli")!.temperature).toBe(0)
  })
})

describe("propagate", () => {
  it("transfers heat from dependency to dependent", () => {
    const g = makeGraph()
    emitHeat(g, "core-types", "salt-type-change")
    propagate(g)
    expect(g.nodes.get("parser")!.temperature).toBeGreaterThan(0)
  })

  it("heat attenuates over distance (cli gets less than parser)", () => {
    const g = makeGraph()
    emitHeat(g, "core-types", "salt-type-change")
    propagate(g)
    const parserTemp = g.nodes.get("parser")!.temperature
    const cliTemp    = g.nodes.get("cli")!.temperature
    // cli is two hops away; after one propagation step it gets nothing yet
    // (needs two steps to reach cli)
    expect(parserTemp).toBeGreaterThan(cliTemp)
  })

  it("heat reaches cli after two propagation steps", () => {
    const g = makeGraph()
    emitHeat(g, "core-types", "salt-type-change")
    propagate(g)
    propagate(g)
    expect(g.nodes.get("cli")!.temperature).toBeGreaterThan(0)
  })
})

describe("cool", () => {
  it("reduces all temperatures", () => {
    const g = makeGraph()
    emitHeat(g, "core-types", "salt-type-change")
    emitHeat(g, "parser", "fluid-recompile")
    const before = g.nodes.get("core-types")!.temperature
    cool(g)
    expect(g.nodes.get("core-types")!.temperature).toBeLessThan(before)
  })

  it("does not go below zero", () => {
    const g = makeGraph()
    cool(g, 999)
    for (const node of g.nodes.values()) {
      expect(node.temperature).toBeGreaterThanOrEqual(0)
    }
  })
})

describe("thermalStep", () => {
  it("a salt type change heats the core and propagates outward", () => {
    const g = makeGraph()
    thermalStep(g, [{ nodeId: "core-types", kind: "salt-type-change" }])
    expect(g.nodes.get("parser")!.temperature).toBeGreaterThan(0)
  })

  it("repeated steps with no events cool the graph to zero", () => {
    const g = makeGraph()
    thermalStep(g, [{ nodeId: "core-types", kind: "salt-type-change" }])
    for (let i = 0; i < 20; i++) thermalStep(g, [])
    for (const node of g.nodes.values()) {
      expect(node.temperature).toBe(0)
    }
  })

  it("churn on core eventually makes cli volatile in behavior", () => {
    const g = makeGraph()
    // Hammer core-types with salt changes across several changelog steps
    for (let i = 0; i < 8; i++) {
      thermalStep(g, [{ nodeId: "core-types", kind: "salt-type-change" }], { decay: 0.9, coolingRate: 0.1 })
    }
    const cli = g.nodes.get("cli")!
    expect(effectivePhase(cli)).toBe("volatile")
  })
})

describe("snapshot", () => {
  it("captures step number and all node states", () => {
    const g = makeGraph()
    emitHeat(g, "parser", "fluid-recompile")
    const snap = snapshot(g, 3)
    expect(snap.step).toBe(3)
    expect(snap.nodes).toHaveLength(3)
    const parserSnap = snap.nodes.find(n => n.id === "parser")!
    expect(parserSnap.temperature).toBeGreaterThan(0)
    expect(parserSnap.phase).toBe("fluid")
  })
})
