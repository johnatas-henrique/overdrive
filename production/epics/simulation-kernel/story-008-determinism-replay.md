# Story 008: Determinism & MVP Recordable Buffer

> **Epic**: Simulation Kernel
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: M (~4-6h — PCG32 golden test + buffer lifecycle + ReplayInitialState capture)

## Context

**GDD**: `design/gdd/simulation-architecture.md`
**Requirement**: `TR-sim-007` (Determinism: PCG32 for all randomness, Unity.Mathematics, no UnityEngine.Random on sim path); cross-references `TR-ghost-003/004/007` (MVP recordable buffer is Kernel-owned acceptance)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0001 (Manual Simulation Authority and Determinism Boundary), ADR-0008 (Ghost Recording Data Format and MVP Buffer)
**ADR Decision Summary**: PCG32 is the only gameplay PRNG with an explicit `uint64` seed, deterministic state transition, and named `NextUInt`/`NextFloat01`/range helpers; `UnityEngine.Random` is prohibited on the simulation path. At GO, before the first Racing tick, Simulation captures immutable `ReplayInitialState` (race/content identity, seed, DifficultyProfile, GridAssignment, car IDs, initial Fuel/Tire state, Perfect Start remaining ticks). MVP records only completed Racing continuous inputs plus ordered standalone Pause/Resume lifecycle events and always discards the buffer (12 bytes/tick continuous, 22,500-tick cap, parallel EdgeEvent stream per ADR-0008).

**Engine**: Unity 6000.3.19f1 | **Risk**: HIGH (Unity 6.3 is post-LLM-cutoff)
**Engine Notes**: PCG32 and the buffer are pure C# — no Unity scene required. `Unity.Mathematics` (`math`, `float3`, `quaternion`) on the sim path. `UnityEngine.Random`/`System.Random` prohibited on the sim path. Golden vectors below were computed against the O'Neill reference and verified against pcg-random.org.

**Control Manifest Rules (Foundation + Core layers, v2026-08-05)**:
- Required: PCG32 is the only gameplay PRNG; no `UnityEngine.Random`/`System.Random` on the simulation path — source: ADR-0001
- Required: Simulation path math uses `Unity.Mathematics` (`float3`, `math.*`) consistently; no mixing with `System.MathF` — source: ADR-0001
- Required: Ghost Recording: continuous input stream (12 bytes/tick × 3 float32) + edge event stream (5 bytes/event); exactly one SimulationInput per completed Racing tick; Pause edge events as separate stream; cap 22,500 ticks; pure C# — no Unity engine types — source: ADR-0008
- Required: `header.sim_seed` is authoritative; `ReplayInitialState.SimSeed` MUST match for valid replay — source: ADR-0008
- Required: Ghost Recording MVP keeps the buffer in-memory and discards it unconditionally on Results/Forfeit/Idle/load failure; no file I/O during MVP racing — source: ADR-0008
- Forbidden: No per-tick file write (ghost recording) — file IO during gameplay ticks, 60 writes/second — source: ADR-0008

---

## Acceptance Criteria

*From GDD `design/gdd/simulation-architecture.md`, scoped to this story:*

- [ ] **AC-5.1 (DECLARED — deferred):** Given two fresh runs on the same executable and physical machine/environment with identical PCG32 seed, inputs and track, When both run for 300 ticks, Then vehicle positions at tick 300 differ by ≤ 0.001 units. *(Verification deferred to the MVP-assembly determinism harness gate — the ADR-0001 same-environment determinism harness artifact, TR-sim-005 precedent, EPIC.md:71. The Kernel declares, does not claim to pass. The harness scaffold — seed injection seam + pair-run comparator + evidence output — IS delivered by this story per AC-5.1's QA case.)*
- [ ] **AC-5.2:** Given PCG32 initializes with seed = 12345, When its named methods are sampled in a standalone test, Then the documented sequence of `NextUInt` values matches exactly; UnityEngine.Random is not called.
- [ ] **AC-5.4:** Given scalar or vector math executes on the simulation path, When it clamps, normalizes or otherwise mutates authoritative state, Then it uses Unity.Mathematics types (`math`, `float3`, `quaternion`) rather than UnityEngine.Vector3/Mathf. Visual-only interpolation remains outside this simulation-path rule.
- [ ] **AC-5.5 (DECLARED — deferred):** Given five fresh-process runs on the same executable and physical machine/environment with the same seed and inputs, When each completes a 5-lap race, Then final CarStates of all 16 cars differ by ≤ 0.001 units; no cross-machine claim is made. *(Deferred to the MVP-assembly determinism harness gate — ADR-0001 same-environment determinism harness, TR-sim-005 precedent. The harness scaffold delivered here supports this run family.)*
- [ ] **AC-6.1 (MVP architecture constraint):** Given Racing is active, When a tick completes, Then the authoritative continuous SimulationInput and tick index are appended once to an in-memory recordable buffer; consumed Pause edges use the parallel event stream, and the complete buffer is discarded without serialization or UI when Results, Forfeit, load failure, or Idle is reached.
- [ ] **AC-3.9:** Given GO releases grid lock, When the first Racing tick is about to begin, Then ReplayInitialState contains the locked race configuration, content hash, seed, GridAssignment, car IDs, initial resources, and `perfectStartRemainingTicks` before any continuous record is appended. The `DifficultyProfile` field is captured with a stub now — the Kernel verifies its presence and immutable capture; schema validity (Settings epic) and end-to-end use are DEFERRED to the MVP-assembly gate.
- [ ] **AC-3.10:** Given a Racing Pause edge is consumed at a tick boundary, When the lifecycle boundary is recorded, Then one standalone EdgeEvent is appended for that tick index and no continuous input sample is appended for that same simulationStepCount. *(Semantics per ADR-0008:180 — `RecordEdgeEvent(tickIndex, Pause)` fires at edge consumption in Step 3; the tickIndex is the current simulationStepCount; continuous and edge streams are parallel, no continuous sample for the same step.)*

---

## Implementation Notes

*Derived from ADR-0001 and ADR-0008 Implementation Guidelines:*

- **PCG32** (O'Neill reference implementation): `Pcg32(initState: uint64, initSeq: uint64)`; `inc = (initSeq << 1) | 1`. Named methods: `NextUInt()`, `NextFloat01()` (standard `pcg32_random_f`: `(NextUInt >> 8) * (1.0f / 16777216.0f)`), range helpers. Golden vectors (computed and verified against the O'Neill reference and pcg-random.org; each sequence is sampled from a FRESH `Pcg32(12345, 0)` instance — the float sequence is NOT a continuation of the uint sequence):
  - `Pcg32(12345, 0)` NextUInt (8), fresh instance: `304133009, 2564000426, 1539170214, 2267019874, 321857903, 29877282, 4241239986, 528810775`
  - `Pcg32(12345, 0)` NextFloat01 (8), FRESH instance (not a continuation): `0.0708114505, 0.5969778299, 0.3583659530, 0.5278316736, 0.0749383569, 0.0069563389, 0.9874905944, 0.1231233478`
  - Cross-check `Pcg32(42, 54)` NextUInt (5): `2707161783, 2068313097, 3122475824, 2211639955, 3215226955` (official pcg-random.org vector)
- **Determinism harness scaffold** (delivers AC-5.1/5.5's seed-injection seam + comparison methodology; the full 16-car gate runs at the MVP-assembly gate): `IDeterminismHarness` interface — `RunPairComparison(seed, trackId, tickCount)` returns a `DeterminismComparisonReport` (per-tick max position delta + PASS/FAIL vs the ≤0.001 tolerance); `SeedInjection` seam that forces the race's PCG32 seed and the sim pipeline's RNG consumption order; runner API usable from an assembly-gate test. The harness is a Kernel-owned scaffold — it wires seeds and compares outputs, it does NOT produce vehicle positions (Vehicle Physics epic supplies those at the gate).
- **MVP recordable buffer** (ADR-0008): continuous stream = authoritative `accelerateOut`, `brakeOut`, `steerOut` consumed by Vehicle Physics (3 × float32 = 12 bytes/tick) + a SEPARATE `uint tickIndex` per record (GDD ghost requirement — the index is the simulationStepCount of the completed Racing tick, captured POST-increment so the record carries the index of the tick that just completed); exactly one record per completed Racing tick (Step 12). Record shape: `GhostBuffer.RecordTick(SimulationInput input, uint tickIndex)` (ADR-0008's `RecordTick` omits the index; the GDD requires it — the index lives in the record, not the header). Pause edges go to a parallel standalone `EdgeEvent` stream (5 bytes/event, `simulationStepCount` + type). Cap 22,500 ticks — never discard oldest, never replay without `ReplayInitialState`. Pure C# — no Unity engine types. MVP always discards on Results, Forfeit, load failure, or Idle; never serialized, never compared, never shown in UI, never uploaded.
- **ReplayInitialState** (GO boundary, before first Racing tick): version, race configuration ID, content version hash, race seed, DifficultyProfile ID (Settings epic schema — declared), immutable GridAssignment, ascending car IDs, initial Fuel/Tire state, `perfectStartRemainingTicks` (Grid & Start). Captured once; source mutation after capture never mutates the snapshot.
- **ReplayInitialState capture seam** (AC-3.9): a capture hook fires at the GO boundary (first Racing tick about to begin), receiving a `ReplayInitialStateCaptureInput` (race config ID, content hash, seed, GridAssignment, car IDs, initial Fuel/Tire state, perfectStartRemainingTicks, DifficultyProfile stub). The snapshot is built by deep-copying every field — no reference to mutable source state survives capture. The hook is a new seam on the state machine (or driver) exposed via `ISimulationStateGate`; the Settings epic owns DifficultyProfile schema validity (deferred), the Kernel verifies field presence + immutable capture.
- **Sim-path math rule** (AC-5.4): authoritative state math uses `Unity.Mathematics` (`math`, `float3`, `quaternion`); no `UnityEngine.Vector3`/`Mathf`/`System.MathF` on the sim path. Visual-only interpolation is outside this rule (Story 006).

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- [Story 001]: the lifecycle state-change events the buffer consumes for discard, the ReplayInitialState schema shape
- [Story 003]: the GO event that triggers ReplayInitialState capture
- [Story 004]: the Pause edge consumption that produces EdgeEvents
- [Story 005]: Results/Forfeit transitions that trigger buffer discard
- Ghost persistence, serialization, UI, playback, CloudStorage coupling (Alpha scope); corrective-snapshot stream (Alpha); LZ4 compression (Alpha)
- The 16-car determinism gates (AC-5.1/5.5 — declared, deferred to MVP-assembly gate)

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-5.2**: PCG32 golden sequence
  - Given: standalone PCG32 instance initialized with seed 12345 (`Pcg32(initState: 12345u, initSeq: 0u)`)
  - When: named methods sampled in documented order (NextUInt × 8, NextFloat01 × 8)
  - Then: every returned value matches the approved golden vector exactly; UnityEngine.Random never called
  - Edge cases: repeated initialization with same seed; zero seed; maximum seed; full documented sample length; cross-check `Pcg32(42, 54)` vector

- **AC-5.4**: Unity.Mathematics simulation-path scan
  - Given: all authoritative simulation-path source files
  - When: static source scan runs
  - Then: scalar/vector authoritative math uses Unity.Mathematics (math, float3, quaternion); sim-path usage of UnityEngine.Vector3, UnityEngine.Quaternion, or Mathf reported as failure; visual-only interpolation excluded
  - Edge cases: aliased namespaces; fully qualified type names; comments/strings; test-only code; presentation/rendering-only files

- **AC-6.1**: Racing-tick record buffer lifecycle
  - Given: Racing active with in-memory recordable buffer
  - When: a Racing tick completes
  - Then: authoritative SimulationInput and tick index appended exactly once; consumed Pause edge recorded once in parallel EdgeEvent stream with no continuous sample for same simulationStepCount
  - Edge cases: multiple ticks per frame; repeated/held Pause; Pause and Resume boundaries; exactly 22,500 ticks; attempted overflow; transitions to Results, Forfeit, load failure, or Idle — buffer discarded without serialization or UI in every discard path

- **AC-3.9**: ReplayInitialState capture at GO
  - Given: GO releases grid lock; stub supplies race configuration, content hash, seed, grid assignment, car IDs, initial resources, Perfect Start state, DifficultyProfile
  - When: first Racing tick about to begin
  - Then: immutable ReplayInitialState captured before any continuous record appended, containing all supplied fields incl. perfectStartRemainingTicks; DifficultyProfile field DECLARED/deferred (stub)
  - Edge cases: capture exactly once; no capture during Countdown; zero/nonzero Perfect Start ticks; empty or reordered grid data; source mutation after capture does not mutate snapshot

- **AC-3.10**: Pause EdgeEvent
  - Given: Racing active; Pause rising edge consumed at tick boundary
  - When: lifecycle boundary recorded
  - Then: exactly one standalone EdgeEvent appended for that tick index; no continuous input sample for that same simulationStepCount
  - Edge cases: held Pause; repeated presses before consumption; Pause on first or last Racing tick; Pause followed by Resume; multiple lifecycle edges sharing a tick index

- **AC-5.1**: **DECLARED/deferred** — same-environment 300-tick vehicle-position determinism gate (MVP-assembly). Not tested in this story; the two-run harness scaffold (seed injection, comparison methodology) is delivered here for later use.
- **AC-5.5**: **DECLARED/deferred** — five fresh-process, same-environment, five-lap final CarState determinism gate (MVP-assembly). Not tested in this story.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `Assets/tests/unit/simulation/DeterminismReplayTests.cs` — must exist and pass. Verifies: PCG32 golden vectors (5.2), Unity.Mathematics scan (5.4), buffer append/discard/EdgeEvent (6.1, 3.10), ReplayInitialState capture (3.9 with profile stub — field presence + immutable capture ARE Kernel-tested; only schema validity and end-to-end DifficultyProfile use are deferred). AC-5.1/5.5 recorded as DECLARED (deferred to MVP-assembly gate, TR-sim-005 precedent).

**Status**: [x] Created and passing — 44 tests, 418/418 PlayMode green (2026-08-12)

---

## Completion Notes

**Completed**: 2026-08-12
**Criteria**: 5/5 testable passing + 2 DECLARED (AC-5.1/5.5 — MVP-assembly determinism harness gate, harness scaffold delivered and tested here)
**Deviations**:
- ADVISORY: `Update()` ~40-45 effective lines (borderline vs 40-line limit; ghost-lifecycle and forfeit blocks extracted to helpers; next extraction when new logic is added).
- ADVISORY: AC-5.4 scan does not catch explicit namespace aliases (`using UE = UnityEngine;`) — documented limitation; the scan catches the forbidden import.
- ADVISORY: the same-frame Racing→Countdown without an observed terminal state is undetectable by the driver (forfeit + re-race are inputs from different screens; transitions between frames are observed).
**Test Evidence**: `Assets/tests/unit/simulation/DeterminismReplayTests.cs` — 44 tests, 418/418 PlayMode green
**Code Review**: Complete — unity-specialist APPROVED (R2), qa-tester TESTABLE (R3), LP-CODE-REVIEW APPROVED (R2)
**QA Coverage Gate**: ADEQUATE (R3)

---

## Dependencies

- Depends on: Story 001 (lifecycle state-change events, ReplayInitialState schema), Story 002 (per-tick loop for buffer append), Story 003 (GO event), Story 004 (Pause edge consumption), Story 005 (Results/Forfeit discard triggers)
- Unlocks: None (Alpha Ghost Recording epic consumes the buffer format; MVP-assembly determinism gate consumes the harness)
