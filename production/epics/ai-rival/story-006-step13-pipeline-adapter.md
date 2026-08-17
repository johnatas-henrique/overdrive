# Story 006: Step-13 Pipeline Adapter

> **Epic**: AI Rival
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 2.0h

## Context

**GDD**: `design/gdd/ai-rival.md` + `simulation-architecture.md`
**Requirement**: `TR-ai-004` (published-snapshot read + AIInput cache), `TR-ai-006` (same physics path)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0009: AI Rival Deterministic Architecture (§Pipeline Position, §Key Interfaces)
**ADR Decision Summary**: `AiRivalSystem.Tick(PublishedSimulationSnapshot) → AIInput[16]` runs at Step 13 after snapshot publish at Step 12; Step 14 resolves `ResolvedCarInput[16]` (player SimulationInput + cached AIInput) for the NEXT tick — canonical 1-tick latency between AI decision and physics effect. AI uses exactly the same VehiclePhysicsSystem as the player — no AI-only physics. `AIInput { CarId, AccelerateOut, BrakeOut, SteerOut }`.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C# pipeline step.

**Control Manifest Rules (this layer)**:
- Required: AI reads published snapshot at Step 13, writes cached AIInput; Step 14 resolves for next tick
- Required: same Vehicle Physics path as the player — no AI-only physics

---

## Acceptance Criteria

*From ADR-0009 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] **AIInput contract expanded**: the Foundation `AIInput` currently carries CarId + Accelerate — this story expands/validates it to the ADR-0009 schema (CarId, AccelerateOut 0-1, BrakeOut 0-1, SteerOut -1..1) without breaking the kernel's cached-AI step
- [ ] During an active tick, the adapter invokes AI evaluation after snapshot publication and writes the 16-entry AI cache (player slot unused/default)
- [ ] Step 14 combines player input and cached AI input into `ResolvedCarInput` in ascending car-ID order
- [ ] Cached AI input observed at tick N is consumed by physics at tick N+1 (canonical one-tick latency — proven with distinct tick-N/N+1 inputs)
- [ ] Fuel, Tire, and Vehicle Physics receive the same `ResolvedCarInput` sequence — no AI-only physics path exists
- [ ] AI evaluation skipped and stale cache cleared outside active Countdown/Racing states

---

## Implementation Notes

*Derived from ADR-0009 Implementation Guidelines:*

- The adapter is the Step-13 seam: snapshot in, AIInput cache out — no simulation-state writes
- The AIInput expansion must preserve kernel compatibility (the ResolvedCarInput assembly already caches AI input — extend the payload, not the mechanics)
- Zero-allocation: the cache is a caller-owned buffer (fixed `AIInput[16]` field), not a fresh array per tick — resolved per QL-STORY-READY 2026-08-16 (the ADR-style `Tick(...)` returning a new array would allocate)
- Player slot: `AiSkipStep` semantics (kernel step 12) — the player is skipped; the AI slot for the player's carId remains unused

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 007]: determinism verification harness (uses this adapter)
- [vehicle-physics-dynamics]: physics execution (consumes ResolvedCarInput)
- [Simulation Kernel]: the step spine (this adapter plugs in)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (order)**: publish → AI evaluation → cache → resolve recorded in order
- **AC-2 (latency)**: distinct tick-N and tick-N+1 inputs prove the one-tick latency
- **AC-3 (player slot)**: player carId excluded, AI slot unused/default
- **AC-4 (same path)**: Fuel/Tire/VP spies receive identical ordered resolved inputs
- **AC-5 (state gating)**: Finished/Paused/Idle states do not evaluate AI; stale cache cleared
- **AC-6 (zero-allocation)**: cache is a caller-owned buffer (no per-tick array allocation)

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/AiRivalTests.cs` — pipeline order, latency, gating with fakes
- Logic companion: `Assets/tests/unit/simulation/AiRivalTests.cs`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Stories 001-003 (draws, target speed, errors), Simulation Kernel (step seams)
- Unlocks: Story 007 (determinism harness), 16-car AI races
