# Prime Harmony: why shared factors predict shared behavior

## The setup

Every character gets a prime number. First character you see gets 2, second gets 3, third gets 5, etc.

Every chunk of text gets a **Gödel number**: multiply the primes of its characters together.

```
't' = 2, 'h' = 3, 'e' = 5, ' ' = 7, 'a' = 13, 'c' = 11

"the"  = 2 × 3 × 5       = 30
"cat"  = 11 × 13 × 2     = 286
"sat"  = 17 × 13 × 2     = 442
"mat"  = 29 × 13 × 2     = 754
```

## The observation

Chunks that share characters share prime factors. "cat", "sat", "mat" all have 13 × 2 (a × t) in them. Their Gödel numbers all divide by 26.

**Harmony** measures this: what fraction of a chunk's prime structure is shared with another chunk? High harmony = structurally related. Low harmony = strangers.

```
cat ~ sat  = 0.535   (share a, t)
cat ~ mat  = 0.492   (share a, t)
cat ~ the  = 0.123   (share only t)
cat ~ at   = 0.576   (at is literally inside cat)
```

## Why this matters

In a trie, "cat", "sat", "mat" all tend to appear in similar contexts ("the ___ sat on the mat"). The trie discovers this slowly by accumulating statistics across many observations.

But the prime factors already know it. Before any statistics. The shared structure IS the shared behavior, encoded in the number itself.

## The two geometries

Every chunk lives in two spaces simultaneously:

1. **What comes before it** (context geometry, position). "cat" and "dog" are near each other because similar words precede them. This is what the trie measures.

2. **What it's made of** (compositional geometry, momentum). "cat" and "sat" are near each other because they share characters. This is what the Gödel number encodes.

These are conjugate variables — connected by Fourier transform, like position and momentum in physics.

**Simple chunks** (few primes) appear everywhere — 'e' is in almost every context. Precise composition, spread-out position.

**Complex chunks** (many primes) appear rarely — "for the use of" shows up in very specific contexts. Spread-out composition, precise position.

You can't be both maximally specific and maximally everywhere. That's the uncertainty principle, and it falls out of the prime structure for free.

## The cheat

Instead of building up a trie observation by observation and waiting for statistics to reveal which chunks are related, you can look at the prime factors and already know. Chunks that share factors are harmonics of each other. Their predictions should blend.

This turns blind BFS search into resonance-guided search: try combinations where the harmonics are strong, skip where they're silent.

## Connection to wave physics

A distribution over chunks is a function on positive integers: ψ(n) = amplitude of chunk with Gödel number n.

The Fourier transform of this function decomposes it into prime frequencies. This is the Euler product form of the Riemann zeta function:

```
ζ(s) = Π (1 - p⁻ˢ)⁻¹   over all primes p
```

The primes are the fundamental frequencies. Everything else is harmonics. A "category" like "fruit" is an interference pattern — the wave function that results from superposing all fruit-words, which share enough prime factors to constructively interfere.
