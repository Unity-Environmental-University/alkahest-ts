import { describe, it, expect } from "vitest"
import { runOtter } from "../src/engine.js"
import { littleAlchemy } from "../src/domains/little-alchemy.js"

describe("runOtter", () => {
  it("discovers elements in little alchemy", () => {
    const state = runOtter(littleAlchemy, { maxSteps: 50 })
    const allItems = [...state.setOfSupport, ...state.usable]
    const names = new Set(allItems.map(x => x.name))

    expect(names.has("mud")).toBe(true)
    expect(names.has("steam")).toBe(true)
    expect(names.has("lava")).toBe(true)
    expect(names.has("brick")).toBe(true)
  })

  it("halts when set of support is exhausted", () => {
    const state = runOtter(littleAlchemy, { maxSteps: 200 })
    expect(state.halted).toBe(true)
  })
})
