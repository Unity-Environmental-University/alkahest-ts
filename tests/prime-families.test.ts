import { describe, it } from "vitest"

const PRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47,
  53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107,
]

function assignPrimes(text: string): Map<string, number> {
  const map = new Map<string, number>()
  let i = 0
  for (const ch of text) {
    if (!map.has(ch) && i < PRIMES.length) {
      map.set(ch, PRIMES[i++])
    }
  }
  return map
}

// Use BigInt for real words — products overflow fast
function godelBig(chunk: string, primes: Map<string, number>): bigint {
  let n = 1n
  for (const ch of chunk) {
    n *= BigInt(primes.get(ch) ?? 1)
  }
  return n
}

function gcdBig(a: bigint, b: bigint): bigint {
  while (b) { [a, b] = [b, a % b] }
  return a
}

function harmonyBig(a: bigint, b: bigint): number {
  const shared = gcdBig(a, b)
  if (shared <= 1n) return 0
  const logShared = Number(shared.toString().length) // rough proxy
  const logMax = Number((a > b ? a : b).toString().length)
  return logShared / logMax
}

// Better harmony using actual prime factor overlap
function primeVector(chunk: string, primes: Map<string, number>): Map<number, number> {
  const v = new Map<number, number>()
  for (const ch of chunk) {
    const p = primes.get(ch)
    if (p) v.set(p, (v.get(p) ?? 0) + 1)
  }
  return v
}

function cosine(a: Map<number, number>, b: Map<number, number>): number {
  let dot = 0, magA = 0, magB = 0
  for (const [k, v] of a) { magA += v * v; if (b.has(k)) dot += v * b.get(k)! }
  for (const [, v] of b) { magB += v * v }
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

describe("prime families", () => {
  it("finds word families by prime vector cosine similarity", () => {
    const text = "the cat sat on the mat and the dog ran to the hut but the cat sat and the dog ran"
    const primes = assignPrimes(text)

    const words = [...new Set(text.split(" "))]
    const vectors = new Map(words.map(w => [w, primeVector(w, primes)]))

    console.log("\nWord families (cosine > 0.5 in prime vector space):\n")
    const families: [string, string, number][] = []

    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j < words.length; j++) {
        const sim = cosine(vectors.get(words[i])!, vectors.get(words[j])!)
        if (sim > 0.3) {
          families.push([words[i], words[j], sim])
        }
      }
    }

    families.sort((a, b) => b[2] - a[2])
    for (const [a, b, sim] of families) {
      console.log(`  ${a.padEnd(6)} ~ ${b.padEnd(6)} = ${sim.toFixed(3)}`)
    }
  })

  it("finds families in richer text", () => {
    const text = [
      "the cat sat on the mat",
      "the dog sat on the log",
      "the bat sat in the hat",
      "the rat ran on the mat",
      "she ate the cake by the lake",
      "he ate the date by the gate",
      "they walked and they talked",
      "they baked and they raked",
    ].join(" ")

    const primes = assignPrimes(text)
    const words = [...new Set(text.split(" "))]
    const vectors = new Map(words.map(w => [w, primeVector(w, primes)]))

    // Cluster: for each word, find its nearest neighbors
    console.log("\nNearest neighbors in prime space:\n")
    for (const word of words) {
      const sims: [string, number][] = []
      for (const other of words) {
        if (other === word) continue
        sims.push([other, cosine(vectors.get(word)!, vectors.get(other)!)])
      }
      sims.sort((a, b) => b[1] - a[1])
      const top3 = sims.slice(0, 3).filter(s => s[1] > 0.2)
      if (top3.length > 0) {
        console.log(`  ${word.padEnd(8)} → ${top3.map(([w, s]) => `${w}(${s.toFixed(2)})`).join("  ")}`)
      }
    }
  })
})
