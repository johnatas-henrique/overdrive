# Story 005: Pit Lifecycle Adapter

> **Epic**: AI Rival
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.0h

## Context

**GDD**: `design/gdd/ai-rival.md`
**Requirement**: `TR-ai-003` (pit lifecycle — adapter half, split per QL-STORY-READY 2026-08-16)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0009: AI Rival Deterministic Architecture (§Lifecycle Integration)
**ADR Decision Summary**: `lastLapTireWear` and `lastLapFuelUse` are consumed from FuelState/TireState (updated via RSM `LapCompleted` event at Step 10). `LapCompleted` from RSM triggers AI pit-decision re-evaluation — not per-tick polling. AI waits for full fuel in MVP.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C# — event seam consumption.

**Control Manifest Rules (this layer)**:
- Required: re-evaluation once per LapCompleted event; never per-tick polling
- Required: adapter emits pit commitment/wait state without mutating Fuel/Tire state

---

## Acceptance Criteria

*From ADR-0009 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] A supplied `LapCompleted` event carries the completed-lap fuel/tire deltas consumed by the pit projection seam (Story 004)
- [ ] Re-evaluation occurs once per `LapCompleted` event; repeated ticks without an event cause zero evaluations
- [ ] The adapter emits a pit commitment or wait-for-full-fuel state without mutating Fuel/Tire state
- [ ] If service requires a full tank, the AI remains in wait-for-full-fuel until the shared pit-service seam reports completion

---

## Implementation Notes

*Derived from ADR-0009 Implementation Guidelines:*

- The adapter wires RSM's `LapCompleted` (Step 10) to the projection (Story 004) — no polling
- Full-fuel wait: the AI's pit commitment becomes a wait state consumed by the pit-service seam (race-strategy epic owns the service)
- Fuel/Tire deltas ride the event payload (RSM publishes them — race-flow Story 001's event sink)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 004]: the projection math (consumed)
- [race-strategy epic]: pit service execution
- [race-flow Story 001]: LapCompleted event production

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (event-driven)**: one LapCompleted → exactly one evaluation; repeated ticks without event → zero evaluations
- **AC-2 (deltas)**: event payload deltas consumed by the projection; edge: missing deltas
- **AC-3 (wait state)**: full-tank requirement → wait-for-full-fuel until the pit-service completion seam fires
- **AC-4 (no mutation)**: adapter emits state without mutating Fuel/Tire

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/AiRivalTests.cs` — event-driven re-evaluation with fakes
- Logic companion: `Assets/tests/unit/simulation/AiRivalTests.cs`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 004 (projection), race-flow Story 001 (LapCompleted sink)
- Unlocks: race-strategy pit interplay (AI pits in real races)
