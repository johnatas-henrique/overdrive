# Story 002: Tire System

> **Epic**: Race Strategy
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 2.0h

## Context

**GDD**: `design/gdd/tire-system.md`
**Requirement**: `TR-tire-001..005`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0006: Fuel/Tire State Ownership and Tick Timing
**ADR Decision Summary**: TireSystem (pure C#) at Step 5b: wear = base_rate × distanceFactor × aggression × surfaceMultiplier × efficiencyModifier × wearRateMultiplier; `distanceFactor = clamp(speedKmh / 300, 0, 1)` (normalized seam — resolved 2026-08-16 gate). TireState { wearFraction 0-1, runtimeGripMultiplier linear 1.0 at 0% → 0.20 at 100%, compoundId, lastLapTireWear }. Grip floor 0.20. Countdown/qualifying gating via the state param. Pit mode: no wear accumulates; reset after exactly 2s of continuous eligible service (interruption does not complete the swap). `lastLapTireWear` via RSM LapCompleted seam. Consumes plain immutable tire data (compound fields), not a Unity ScriptableObject directly.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C# — no Unity APIs (EditMode test).

**Control Manifest Rules (this layer)**:
- Required: `runtimeGripMultiplier` linear 1.0 → 0.20; grip floor 0.20; continuous linear wear
- Required: Countdown/qualifying no wear; pit reset after 2s continuous service
- Forbidden: Tire must never write CarState fields

---

## Acceptance Criteria

*From ADR-0006 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Grip curve: 0% wear → 1.00; 50% → 0.60 ±0.01; 100% → 0.20 ±0.01; wear clamped 0..1
- [ ] Wear multipliers: off-track ≈ 2.5× (surface 2.5); aggression 2.0 ≈ 2×; Efficiency 20 vs 4 → ≈ 50% vs 90% base rate
- [ ] Countdown (300 ticks) and qualifying produce no wear; first Racing tick begins wear
- [ ] Pit service: no wear accumulates during active service; reset after exactly 2s continuous eligible service; interruption at 1.9s does not complete the swap
- [ ] `LapCompleted` updates `lastLapTireWear` (boundary delta) once; edge: pit reset between boundaries, duplicate event, zero wear
- [ ] Consumes immutable compound data (gripBase, wearRateMultiplier, compoundId) — no direct ScriptableObject dependency

---

## Implementation Notes

*Derived from ADR-0006 Implementation Guidelines:*

- Tire consumes speed/surface/slideState from prior CarState in TickStartSnapshot at Step 5b (before physics)
- Pit swap gated by `PitServiceCommand[carId].active` (NOT CarState.PitPhase)
- `runtimeGripMultiplier` feeds the VP grip stack at Step 6
- Qualifying no-wear is a mode policy (race-flow qualifying emits it — consumed here)
- Tire asset validation/authoring → car-definition-data epic

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [car-definition-data]: compound asset validation/authoring
- [vehicle-physics]: grip application, "remains controllable"
- [hud/audio/vfx]: presentation

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (grip curve)**: wear 0/50/100% → grip 1.00/0.60±0.01/0.20±0.01; edge: wear below 0 / above 1 clamped
- **AC-2 (wear multipliers)**: Asphalt → off-track ≈ 2.5×; aggression 1 vs 2 ≈ 2×; Eff20 vs Eff4 ≈ 50% vs 90%
- **AC-3 (mode gating)**: 300 Countdown ticks / Qualifying → no wear; edge: first Racing tick begins, qualifying input can't bypass the gate
- **AC-4 (pit reset)**: active service + nonzero wear → exactly 2s continuous → 0%; edge: interrupted at 1.9s, active false stops, no wear during service
- **AC-5 (LapCompleted)**: lastLapTireWear = boundary delta once; edge: pit reset between boundaries, duplicate, zero wear

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/simulation/TireSystemTests.cs`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: car-definition-data (compound/efficiency), Simulation Kernel (Step 5b seam), Track (surface wear multiplier)
- Unlocks: Story 003 (pit service), VP (runtimeGripMultiplier), hud (tire %)
