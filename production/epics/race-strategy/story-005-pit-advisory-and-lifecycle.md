# Story 005: Pit Advisory & Lifecycle

> **Epic**: Race Strategy
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/pit-stop.md`
**Requirement**: `TR-pit-003` (PitThisLap advisory), `TR-pit-005` (pit transit/speed limit)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0011: Pit Stop Architecture (§Advisory, §Pipeline Position)
**ADR Decision Summary**: Advisory (after lap 1, before final lap): `predicted_fuel = currentFuel − lastLapFuelUse × remainingProgress`; `predicted_tire = (1 − currentWearFraction) − lastLapTireWear × remainingProgress`; `needed = 1.10 × lastLapUse`; `pitThisLap = not lap1 and not finalLap and (predictedFuel < neededFuel or predictedTire < neededTire)` (strict `<` — equality at 110% does NOT trigger). Warning window: `min(0.80, max(0, pitEntryProgress − 0.05))` → `pitEntryProgress`. Advisory suppressed on lap 1/final/while pitting; clears on pit-entry. Consumes RSM events through an event seam (RSM owns publication).

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C#.

**Control Manifest Rules (this layer)**:
- Required: advisory formula (fuel OR tire, 1.10× margin, strict `<`)
- Required: warning window clamped; suppressed lap 1/final/while pitting; clears on entry

---

## Acceptance Criteria

*From ADR-0011 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Consumes `lastLapFuelUse`, `lastLapTireWear`, current resources, progress, lap context, and an injected/read-only `pitProjectionMargin = 1.10`
- [ ] `pitThisLap` = not lap1 and not finalLap and (predictedFuel < 1.10×neededFuel OR predictedTire < 1.10×neededTire) — strict `<`; equality does not trigger
- [ ] Warning start = `min(0.80, max(0, pitEntryProgress − 0.05))` (entry 0.72 → start 0.67; entry > 0.85 caps at 0.80; negative floors at 0)
- [ ] Advisory suppressed on lap 1, final lap, and while already pitting (PitTransit/InPitBox/Exiting)
- [ ] Advisory clears on the pit-entry event seam (exactly once; duplicate entry no-op; exit event restores normal evaluation)
- [ ] Consumes RSM events through an event seam — RSM's event publication NOT tested here

---

## Implementation Notes

*Derived from ADR-0011 Implementation Guidelines:*

- The advisory is a PitStop-owned output consumed by HUD (display) and AI (projection — ai-rival epic owns the AI decision)
- `remainingProgress` = fraction of the lap remaining at evaluation
- The window clamps: `min(0.80, max(0, pitEntryProgress − 0.05))` — prevents early/late warnings
- HUD rendering, AI decision execution, RSM event emission → their owning epics

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [hud epic]: PIT THIS LAP rendering
- [ai-rival]: AI pit decision execution
- [race-flow]: RSM event publication
- [vehicle-physics/track]: pit speed enforcement, geometry

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (fuel advisory)**: predictedFuel < 1.10×neededFuel → pitThisLap true; edge: tire alone triggers, exact equality false (strict <), either resource sufficient
- **AC-2 (warning window)**: entry 0.72 → start 0.67; edge: entry > 0.85 caps 0.80, negative floors 0
- **AC-3 (suppression)**: lap 1 or final lap → false even when resources fail; edge: already pitting
- **AC-4 (clear on entry)**: pit-entry event → clears exactly once; edge: duplicate entry no-op, exit restores evaluation
- **AC-5 (consumer isolation)**: output published immutable; HUD/AI doubles consume without side effects

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/PitStopTests.cs` — advisory + lifecycle with fakes
- Logic companion: `Assets/tests/unit/simulation/PitStopTests.cs`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001/002 (fuel/tire deltas), Story 003 (service), race-flow (LapCompleted seam), Track (pitEntryProgress)
- Unlocks: hud (PIT THIS LAP), ai-rival (projection)
