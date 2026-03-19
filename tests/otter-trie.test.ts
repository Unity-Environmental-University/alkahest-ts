import { describe, it, expect } from "vitest"
import { runOtter } from "../src/engine.js"
import { otterTrie, textToObservations } from "../src/domains/otter-trie.js"

describe("otter trie", () => {
  it("creates depth-1 observations from text", () => {
    const obs = textToObservations("the cat")
    expect(obs.length).toBeGreaterThan(0)
    // Should have observations like: after [t], saw h
    const th = obs.find(o => o.context[0] === "t" && o.symbol === "h")
    expect(th).toBeDefined()
    expect(th!.count).toBe(1)
  })

  it("runs the otter loop and discovers deeper paths", () => {
    const text = "the cat sat on the mat. the cat sat on the mat. "
    const domain = otterTrie(text)
    const state = runOtter(domain, { maxSteps: 50, verbose: false })

    // Should have discovered paths deeper than 1
    const allItems = [...state.usable, ...state.setOfSupport]
    const deep = allItems.filter(
      (i: any) => i.context && i.context.length > 1,
    )
    expect(deep.length).toBeGreaterThan(0)

    console.log(`\nItems: ${allItems.length} (${deep.length} deep)`)
    console.log("Deep paths:")
    for (const d of deep.slice(0, 20) as any[]) {
      console.log(`  [${d.context.join("→")}] → ${d.symbol} (×${d.count})`)
    }
  })

  it("repeated text builds stronger paths", () => {
    const text = "abcabc abcabc abcabc"
    const domain = otterTrie(text)
    const state = runOtter(domain, { maxSteps: 100 })

    const allItems = [...state.usable, ...state.setOfSupport] as any[]
    const abc = allItems.filter(
      (i: any) => i.context?.length >= 2,
    )

    console.log(`\nRepeated 'abc': ${allItems.length} items, ${abc.length} depth≥2`)
    for (const item of abc.slice(0, 15)) {
      console.log(`  [${item.context.join("→")}] → ${item.symbol} (×${item.count})`)
    }
  })
})
