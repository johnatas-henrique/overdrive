# Story 005: Qualifying Core

> **Epic**: Race Flow
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/qualifying.md`
**Requirement**: `TR-qual-001` (single flying lap), `TR-qual-004` (no Countdown), `TR-qual-007` (out-lap/flying-lap timer)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0013: Qualifying Session Format
**ADR Decision Summary**: Single flying lap, one chance, no retry. Player spawns at the pit box (boxId from TrackData), stationary, engine running, full driving controls. Out-lap: no fuel/tire/timer; flying-lap timer starts on rising-edge spline wrap, stops on second crossing. Qualifying enters Racing/GameplayQualifying directly after `RaceLoadReady(RaceMode.Qualifying)` — no Countdown.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C# — Track provides wrap/boundary signals via seam.

**Control Manifest Rules (this layer)**:
- Required: single flying lap, no retry; no Countdown (Racing/GameplayQualifying direct)
- Required: timer start/stop on rising-edge spline wrap; out-lap keeps timer inactive

---

## Acceptance Criteria

*From ADR-0013 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Given Track boundary signals (seam), the first qualifying crossing starts the flying-lap timer and the second crossing stops it (Track owns wrap detection; Qualifying owns rising-edge/attempt state)
- [ ] Out-lap state keeps the timer inactive and prevents Qualifying from issuing consumption commands (Fuel/Tire behavior tested by those systems — consumed here as suppression policy)
- [ ] Completed, failed, and skipped sessions transition to ONE terminal qualifying result with no retry
- [ ] Timer boundaries: crossing before the attempt starts does not start the timer (rising-edge semantics)

---

## Implementation Notes

*Derived from ADR-0013 Implementation Guidelines:*

- The attempt state machine: OutLap → FlyingLap (timer armed on rising edge) → Completed/Failed/Skipped (terminal, no retry)
- The rising-edge rule: the timer arms only on the boundary transition (previous tick not crossed → current tick crossed), not on a continuous hold
- Consumption suppression during out-lap is a policy emitted by Qualifying (fuel/tire consumption commands withheld) — the actual fuel/tire behavior is the race-strategy epic's
- `QualifyingSpawnSpec` (pit box spawn) is Story 006's lifecycle deliverable — the core story owns attempt/timer state only

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 006]: qualifying lifecycle (RaceLoadReady, spawn spec, Finished Presentation)
- [Story 007]: fuel load formula, AI times, skip/fail result
- [race-strategy epic]: fuel/tire consumption suppression implementation

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (timer start/stop)**: Track boundary signals → first crossing starts, second stops; edge: crossing before attempt (rising-edge only), wrap 0.94→0.01
- **AC-2 (out-lap suppression)**: out-lap state → timer inactive + no consumption commands; edge: out-lap → flying transition
- **AC-3 (terminal result)**: completed/failed/skipped → one terminal result, no retry; edge: crash mid-lap (no time), slow completion (time recorded)
- **AC-4 (rising-edge)**: continuous hold does not re-trigger the timer; edge: boundary flicker

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/simulation/QualifyingTests.cs` — timer semantics, rising-edge, terminal results

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Track epic (boundary seam), Simulation Kernel (Racing/GameplayQualifying state)
- Unlocks: Story 006 (lifecycle), Story 007 (rules)
