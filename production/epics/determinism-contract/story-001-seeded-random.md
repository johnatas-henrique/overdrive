# Story 001: SeededRandom

> **Epic**: Determinism Contract
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/determinism-contract.md`
**Requirements**: `TR-DET-003`

**ADR Governing Implementation**: ADR-0002: Fixed Timestep & Determinism Pipeline
**ADR Decision Summary**: SeededRandom LCG with Numerical Recipes constants 1664525/1013904223, three methods (`random()`, `randomRange(min, max)`, `randomSign()`), configurable seed parameter, snapshot support via `getState()`/`setState()`.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer. No engine imports permitted anywhere in this file.

**Control Manifest Rules (this layer)**:

- Required: F16 — SeededRandom LCG with constants 1664525, 1013904223 (Numerical Recipes). Three methods: `random()`, `randomRange(min, max)`, `randomSign()`.
- Forbidden: F-F7 — Never use third-party library for Foundation layer.
- Guardrail: F-G2 — Pipeline overhead < 0.001ms per tick.

---

## Acceptance Criteria

_From GDD `design/gdd/determinism-contract.md`, scoped to this story:_

- [ ] AC-1: `new SeededRandom(42).random()` returns the same sequence of 1000 floats on every platform and every run — verified by instantiating two instances with seed 42 and asserting all 1000 values are identical.
- [ ] AC-2: `new SeededRandom(42).random()` and `new SeededRandom(99).random()` produce different sequences — at least one of the first 10 values differs.
- [ ] AC-3: `randomRange(5, 10)` with seed 42 returns values in [5, 10) over 10000 calls — min observed ≥ 5, max observed < 10.
- [ ] AC-4: `randomSign()` with seed 42 returns only -1 or 1 over 10000 calls.
- [ ] AC-5: `getState()` returns the internal `state` value; `setState(state)` resumes the sequence from that exact point — the Nth value after setState matches the Nth value of a fresh instance after N advances.
- [ ] AC-6: Zero imports from Babylon.js, `@babylonjs/*`, or any npm package — verified by `tsc --noEmit` on Foundation directory.

---

## Implementation Notes

_Derived from ADR-0002 Implementation Guidelines:_

- LCG formula: `state = (state * 1664525 + 1013904223) >>> 0` — unsigned 32-bit truncation via `>>> 0` ensures cross-platform identical results.
- `random()`: returns `(state >>> 0) / 0xffffffff` — float in [0, 1).
- `randomRange(min, max)`: returns `min + random() * (max - min)` — float in [min, max).
- `randomSign()`: returns `this.random() < 0.5 ? -1 : 1`.
- `getState()` / `setState()`: expose the internal `state` field for serialization in SimulationSnapshot.
- Constructor: if seed is negative, take absolute value: `seed = Math.abs(seed)`. If seed is 0, use 1 as a fallback (LCG seed 0 produces an all-zero sequence).
- File location: `src/foundation/determinism/seeded-random.ts`.
- Zero-dependency verification: run `tsc --noEmit` on the Foundation directory. Any import from outside Foundation is a build error.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 002]: FixedUpdatePipeline — slot management, lifecycle, call order
- [Story 006]: Determinism Enforcement — runtime guards for `Math.random`/`Date.now`/`performance.now` during pipeline execution

---

## QA Test Cases

**AC-1: Deterministic sequence from same seed**

- Given: Two `SeededRandom` instances constructed with seed `42`
- When: `random()` is called 1000 times on each instance
- Then: Every value at index N matches between the two instances (assert `for i in 0..999: a.random() === b.random()`)
- Edge cases: seed `0` (LCG degenerate — all-zero sequence, still deterministic); seed `2^32 - 1` (max unsigned 32-bit); negative seed

**AC-2: Different seeds produce different sequences**

- Given: `SeededRandom(42)` and `SeededRandom(99)`
- When: `random()` is called 10 times on each
- Then: At least one of the first 10 values differs between the two instances
- Edge cases: seed `42` vs seed `42` (must be identical — regression check); adjacent seeds `42` vs `43`

**AC-3: randomRange returns values within bounds**

- Given: `SeededRandom(42)`
- When: `randomRange(5, 10)` is called 10000 times
- Then: All returned values satisfy `5 <= value < 10` (min ≥ 5, max < 10)
- Edge cases: `randomRange(0, 0)` returns 0; `randomRange(5, 2)` — degenerate call, clamp/swap to valid range

**AC-4: randomSign returns only valid values**

- Given: `SeededRandom(42)`
- When: `randomSign()` is called 10000 times
- Then: All returned values are either `-1` or `1` — no other value appears
- Edge cases: with an all-0.5 random sequence (mathematically impossible for LCG but test defensively)

**AC-5: getState/setState round-trip**

- Given: `SeededRandom(42)`, after calling `random()` 5 times
- When: `state = seededRandom.getState()` is saved, then `seededRandom.setState(state)` is called
- Then: The next `random()` value matches the 6th call of a fresh `SeededRandom(42)` that has also been advanced 5 times
- Edge cases: `setState(0)` — LCG state 0 produces all-zero sequence; `setState(2^32 - 1)`

**AC-6: Zero dependencies**

- Given: All SeededRandom source files in `src/foundation/determinism/`
- When: The files are checked for import statements
- Then: No imports from `'babylonjs'`, `'@babylonjs/*'`, or any npm package
- Edge cases: Import of local sibling file (`'./seeded-random'`, `'./errors'`) is allowed

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/determinism/seeded-random.test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None (Foundation root — pure math)
- Unlocks: Story 006 (Determinism Enforcement uses SeededRandom for seed generation during tests)
