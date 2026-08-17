# Story 001: Archetypes & Deterministic Draws

> **Epic**: AI Rival
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/ai-rival.md`
**Requirement**: `TR-ai-001` (counter-based noise), `TR-ai-002` (4 archetypes)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0009: AI Rival Deterministic Architecture (§Determinism, §Key Interfaces)
**ADR Decision Summary**: AI randomness is counter-based, not stateful: `PCG32Hash(SimSeed, carId, simulationStepCount, slotId)` — a pure function of the race seed, car ID, simulation step, and a per-tick slot counter. There is no mutable per-car RNG stream, so branch-dependent consumption cannot desync future draws. 4 data-driven archetypes (Consistent/Aggressive/Inconsistent/Cautious) with documented parameter ranges. No `UnityEngine.Random`, no `System.Random`, no stateful `Pcg32` on the AI path.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C#.

**Control Manifest Rules (this layer)**:
- Required: counter-based `PCG32Hash(SimSeed, carId, simulationStepCount, slotId)` only — never a stateful RNG stream
- Required: archetypes data-driven; same seed + same snapshot = same AIInput

---

## Acceptance Criteria

*From ADR-0009 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] `PCG32Hash(SimSeed, carId, simulationStepCount, slotId)` is a pure function with no mutable per-car RNG stream
- [ ] Repeating the same four-key tuple returns the identical value
- [ ] Changing `carId` for one draw does not change another car's draw when SimSeed/step/slot are unchanged (isolation keyed by `SimSeed + carId` — no per-car seed)
- [ ] Draw results are independent of evaluation order or branch-dependent draw count (order A→B vs B→A identical)
- [ ] Four data-driven archetypes exist with the documented IDs and parameter ranges/exact values (personalityModifier 0.95-1.05, steeringErrorAmplitude 0.02-0.10, brakeErrorMeters 1.5-6.0, throttleErrorPercent 1.5-5.0%, overtakeAggression 0.6-1.3×, defendAggression 0.5-1.4×, pitProjectionMargin 1.10)
- [ ] The AI path does not reference `UnityEngine.Random`, `System.Random`, or a stateful `Pcg32` instance

---

## Implementation Notes

*Derived from ADR-0009 Implementation Guidelines:*

- The four-key tuple is the draw contract: SimSeed (per-race), carId (0-15), simulationStepCount (per ADR-0001), slotId (draw ordinal within the tick — stable per call site)
- Consumption order within a tick is fixed (declared per archetype); no AI code path may draw with a different slot count than its declared schedule
- `ReplayInitialState` captures only SimSeed — every AI draw is re-derivable
- Archetypes are data records (AiArchetype struct) — adding a new archetype = data change, no code

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 002/003]: target-speed and error application (consume the draws)
- [race-flow Story 007]: qualifying AI times (ADR-0013 formula — separate offline projection)
- [Simulation Kernel]: Pcg32 hash implementation (shipped — consumed)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (repeatability)**: fixed seed/car/step/slot → identical results across repeated calls
- **AC-2 (car isolation)**: two cars same seed/step/slot, only car A's carId changes → car B's result unchanged
- **AC-3 (branch-order independence)**: schedules A→B and B→A → each car/slot result matches
- **AC-4 (archetype data)**: four records validated — IDs, ranges, exact values, pitProjectionMargin 1.10
- **AC-5 (no RNG)**: static scan — no UnityEngine.Random/System.Random/stateful Pcg32 on the AI path; edge: zero/max seed, step zero, car IDs 0/15, slot IDs 0/1, reversed calls

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/simulation/AiRivalTests.cs` — draw determinism, isolation, archetype validation

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Simulation Kernel (Pcg32, ReplayInitialState SimSeed)
- Unlocks: Stories 002-007 (all consume draws/archetypes)
