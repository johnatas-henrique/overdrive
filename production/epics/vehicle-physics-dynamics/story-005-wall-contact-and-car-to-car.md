# Story 005: Wall Contact & Car-to-Car

> **Epic**: Vehicle Physics — Dynamics
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 2.0h

## Context

**GDD**: `design/gdd/vehicle-physics.md`
**Requirement**: `TR-vp-004` (wall bounce), `TR-vp-010` (car-to-car)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0002: Vehicle Physics Implementation Pattern
**ADR Decision Summary**: `CarCollisionMonitor : MonoBehaviour` (OnCollisionEnter/Stay/Exit) forwards raw contact data to the standalone `VehiclePhysicsSystem` — the system cannot receive collision callbacks itself. WallHit state persists 0.2-0.5s; repeated bounce impulse reduced by 50%; car-to-car contact 15-25% speed loss + push impulse with cooldown. `Rigidbody.maxLinearVelocity` is the hard speed cap.

**Engine**: Unity 6000.3.22f1 | **Risk**: HIGH
**Engine Notes**: Collision events arrive on the Unity physics callback path — the monitor forwards; VP evaluates at the designated simulation step (event-to-tick handoff). Player retained speed after wall: `speed_after = speed_before × (1 − player_wall_speed_loss)` — player values come from DifficultyProfile (Very Easy 0.20 … Very Hard 0.60), AI uses 0.40 (selected by Settings — this story consumes the injected factor).

**Control Manifest Rules (this layer)**:
- Required: Wall bounce angle ≤30°; WallHit cooldown 0.2-0.5s; repeated bounce impulse reduction 50%
- Required: car-to-car 15-25% speed loss + push impulse; cooldown prevents repeated impulses
- Forbidden: CarCollisionMonitor must NOT mutate CarState or gameplay state inside collision callbacks — it forwards raw contact data only

---

## Acceptance Criteria

*From GDD + ADR-0002, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Given an **injected wall-loss factor** (player per-DifficultyProfile 0.20-0.60, AI 0.40), wall impact applies `speed_after = speed_before × (1 − loss)` before any separate bounce impulse (GDD AC-W1: 200 km/h Normal 0.40 → drop ~40%; AC-W4: 100 km/h Very Hard 0.60 → 40 km/h retained, Normal 0.40 → 60 km/h)
- [ ] Bounce angle ≤30° from the wall surface; car continues moving; never sticks/spins/stops from wall contact alone (GDD AC-W2)
- [ ] WallHit cooldown 0.2-0.5s with a deterministic configured default; repeated bounce impulse reduced by 50% (anti-jitter)
- [ ] Parallel scraping: bounce only on perpendicular impacts; parallel scraping applies small frictional speed penalty, no bounce
- [ ] No post-bounce lockout: after bounce, steer input is immediately responsive (GDD AC-W3)
- [ ] Wall hit at 0 speed: no impact, no bounce, no penalty (edge — velocity into wall ≈ 0)
- [ ] Car-to-car: combined speed >100 km/h → both lose 15-25% current speed (deterministic default within range) and receive opposing push impulses; cooldown prevents repeated impulses (GDD AC-CC1)
- [ ] Stopped car is pushed aside (not immovable) through the normal collision impulse (GDD AC-CC2)
- [ ] `CarCollisionMonitor` forwards raw contact data only — no CarState/gameplay mutation inside callbacks; VP evaluates at the designated simulation step (event-to-tick handoff contract)

---

## Implementation Notes

*Derived from ADR-0002 Implementation Guidelines:*

- The DifficultyProfile wall-loss factor and surface inputs are injected at the seam — selection lives in Settings/Difficulty; this story consumes values
- `WallHit` state is a brief 0.2-0.5s state after wall contact (GDD §4 Car States) — part of the 5-state machine from Story 001, driven here by the contact seam
- Cooldown configuration must be deterministic and reproducible (a fixed default within the 0.2-0.5s range, not a random draw)
- Car-to-car evaluation happens post-`Physics.Simulate` in pure C# (per ADR-0002: "post-collision speed evaluation in pure C# after Physics.Simulate")
- The event-to-tick handoff: `CarCollisionMonitor.OnCollisionEnter` queues raw contact data; VP consumes the queue at its designated step — never inside the callback

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 002]: driver seam (the monitor attaches to RigidbodyVehicleDriver bodies)
- [race-strategy epic]: pit speed limit enforcement (PitPhase transitions consume the contact seam)
- [Track epic]: surface boundary detection (off-track states consume surface input, not collision)
- [vehicle-physics-feel]: tuning values for bounce angle (15-45° range) — this story ships the canonical 30° default

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (wall speed loss)**: injected loss factor → retained `speedBefore × (1−loss)` before bounce impulse; edge: zero speed, loss at range limits
- **AC-2 (bounce + cooldown)**: perpendicular contact → bounce ≤30°, cooldown respected, repeated impulse −50%; edge: cooldown expiry exactly at boundary
- **AC-3 (parallel scraping)**: parallel contact → frictional loss, no bounce; edge: near-parallel threshold
- **AC-4 (no lockout)**: completed bounce + new steer → applied next eligible tick; edge: steer reversal
- **AC-5 (car-to-car)**: combined speed >100 km/h → both lose configured bounded % + opposing push; edge: repeated contact during cooldown
- **AC-6 (stopped car)**: zero-speed car hit → pushed, not immovable; edge: both stopped
- **AC-7 (monitor forwarding)**: Unity collision callback → raw contact forwarded, no CarState mutation in callback; edge: Enter/Stay/Exit, null other collider
- **AC-8 (zero-speed wall)**: ~0 velocity into wall → no impact/bounce/penalty; edge: epsilon incoming velocity

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/VehiclePhysicsTests.cs` (contact seam + monitor forwarding)
- Logic companion: `Assets/tests/unit/simulation/VehiclePhysicsTests.cs` (bounce/cooldown/contact math)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (CarState 5-state machine — WallHit), Story 002 (driver bodies), Story 003 (velocity path)
- Unlocks: [vehicle-physics-feel] (drift consumes velocity post-contact), [race-strategy epic] (pit entry/exit events)
