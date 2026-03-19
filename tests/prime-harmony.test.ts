import { describe, it, expect } from "vitest"

// Assign primes to characters in order of first appearance
function assignPrimes(text: string): Map<string, number> {
  const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]
  const map = new Map<string, number>()
  let i = 0
  for (const ch of text) {
    if (!map.has(ch) && i < PRIMES.length) {
      map.set(ch, PRIMES[i++])
    }
  }
  return map
}

// Gödel number: product of primes for each character
function godel(chunk: string, primes: Map<string, number>): number {
  let n = 1
  for (const ch of chunk) {
    n *= primes.get(ch) ?? 1
  }
  return n
}

// Shared factors = GCD
function gcd(a: number, b: number): number {
  while (b) { [a, b] = [b, a % b] }
  return a
}

// Harmony: what fraction of factors are shared?
function harmony(a: number, b: number): number {
  const shared = gcd(a, b)
  return Math.log(shared) / Math.log(Math.max(a, b))
}

describe("prime harmony", () => {
  it("chunks that share characters have high harmony", () => {
    const text = "the cat sat on the mat"
    const primes = assignPrimes(text)

    console.log("\nPrime assignments:")
    for (const [ch, p] of primes) {
      console.log(`  '${ch}' = ${p}`)
    }

    const chunks = ["t", "th", "the", "the ", "cat", "sat", "mat", "at", "on"]
    const godels = chunks.map(c => [c, godel(c, primes)] as const)

    console.log("\nGödel numbers:")
    for (const [c, g] of godels) {
      console.log(`  '${c}' = ${g}`)
    }

    console.log("\nHarmonies (shared factor ratio):")
    for (let i = 0; i < godels.length; i++) {
      for (let j = i + 1; j < godels.length; j++) {
        const h = harmony(godels[i][1], godels[j][1])
        if (h > 0.3) {
          console.log(`  '${godels[i][0]}' ~ '${godels[j][0]}' = ${h.toFixed(3)}`)
        }
      }
    }

    // "cat", "sat", "mat" should harmonize — they share 'a' and 't'
    const catG = godel("cat", primes)
    const satG = godel("sat", primes)
    const matG = godel("mat", primes)
    const catSat = harmony(catG, satG)
    const catMat = harmony(catG, matG)
    const catThe = harmony(catG, godel("the", primes))

    console.log(`\ncat~sat: ${catSat.toFixed(3)}`)
    console.log(`cat~mat: ${catMat.toFixed(3)}`)
    console.log(`cat~the: ${catThe.toFixed(3)}`)

    // cat and sat should be more harmonious than cat and the
    expect(catSat).toBeGreaterThan(catThe)
  })
})
