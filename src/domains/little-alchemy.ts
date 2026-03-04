/**
 * Little Alchemy domain — a direct port of the Python original.
 *
 * Items are elements. Combining two elements may produce a new one.
 * The goal is to discover as many elements as possible.
 *
 * This is the simplest possible domain and a good sanity check.
 */

import { makeItem } from "../items.js"
import type { Item, OtterDomain, OtterState } from "../types.js"

const RECIPES: Record<string, string> = {
  "earth+water": "mud",
  "fire+water": "steam",
  "earth+fire": "lava",
  "air+fire": "energy",
  "earth+air": "dust",
  "water+air": "mist",
  "mud+fire": "brick",
  "lava+water": "stone",
  "steam+air": "cloud",
  "cloud+water": "rain",
  "rain+earth": "plant",
  "plant+fire": "smoke",
  "stone+air": "sand",
  "sand+fire": "glass",
  "energy+glass": "light",
}

function combine(a: Item, b: Item): Item[] {
  const key1 = `${a.name}+${b.name}`
  const key2 = `${b.name}+${a.name}`
  const result = RECIPES[key1] ?? RECIPES[key2]
  if (!result) return []
  return [makeItem(result, `${a.name} + ${b.name} = ${result}`, [a.name, b.name])]
}

export const littleAlchemy: OtterDomain<Item> = {
  initialState: (): OtterState<Item> => ({
    setOfSupport: [
      makeItem("earth", "earth"),
      makeItem("water", "water"),
      makeItem("fire", "fire"),
      makeItem("air", "air"),
    ],
    usable: [],
    history: [],
    step: 0,
    halted: false,
    haltReason: "",
  }),
  combineFn: combine,
}
