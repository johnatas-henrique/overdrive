# Story 002: Pit Entry Guidance & Garage Stop

> **Epic**: Pit Stop
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/pit-stop.md`
**Requirement**: `TR-PIT-003`
_(TR-PIT-003: "On pit entry: calls physics.setPit(carId, true) for pit speed limiter; physics.brakeCar(carId, brakeForce) to decelerate; velocity-driven spline guidance via setPitVelocity; setLocked(carId, true) at garage stop.")_

**ADR Governing Implementation**: ADR-0014: Pit Stop Flow (velocity-driven approach)
**ADR Decision Summary**: Pit Stop drives via velocity targets (`IPhysics.setPitVelocity`), NOT position override (which causes oscillation with Havok's velocity snap). Physics Phase 3 applies the velocity target. Garage stop calls `IPhysics.setLocked(carId, true)` to zero velocity and prevent further integration.

**Engine**: Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12 | **Risk**: MEDIUM
**Engine Notes**: `IPhysics.setPitVelocity()` delegates to `PhysicsBody.setLinearVelocity()` in Physics Phase 3 — confirmed working by engine specialist. `IPhysics.setLocked()` is an application-level method on the `IPhysics` interface (defined in ADR-0008), NOT `physicsBody.setLocked()` which does not exist on `PhysicsBody`. Velocity-driven approach confirmed sound by engine specialist.

**Control Manifest Rules (this layer)**:

- Required: C47 — Pit Stop: velocity-driven — no position override
- Required: C24 — `setLocked(carId, bool)` — used for pit stop lock
- Required: C25 — `setPit(carId, bool)` — pit speed limiter
- Forbidden: C-F3 — Never set position/heading directly on a DYNAMIC PhysicsBody during pit entry/exit
- Guardrail: C-G6 — Pit Stop: ~0.001ms/car/tick

---

## Acceptance Criteria

_From GDD `design/gdd/pit-stop.md`, scoped to this story:_

- [ ] **AC-1**: Car speed limited to `physics.pitSpeedLimit` (80 km/h) during **pit entry** — velocity target magnitude ≤ `pitSpeedLimit`, direction matches spline tangent
- [ ] **AC-2**: Car follows `pitLaneSpline` waypoints automatically during pit — velocity direction changes to follow spline tangent at each progress point
- [ ] **AC-3**: Car stops at assigned garage slot when spline progress reaches `pitGarageSlots[teamIndex]` — calls `IPhysics.setLocked(carId, true)` and transitions to `pitStopped`

---

## Implementation Notes

_Derived from ADR-0014 Implementation Guidelines:_

### Critical: Velocity-Driven (No Position Override) ⚠️

**The core architectural decision**: Pit Stop MUST NOT set `body.position` or `body.rotation` directly on a DYNAMIC PhysicsBody during `pitEntry` or `departing`. Direct position override creates a per-tick oscillation cycle:

```
Tick N:
  Slot #2: Physics → body.setLinearVelocity(forward × 22.2 m/s)
  Slot #8: Pit Stop → body.setPosition(splinePos)           ← VIBRATION STARTS
Tick N+1:
  Slot #2: Physics → integrates velocity: pos' = splinePos + 0.37m
  Slot #8: Pit Stop → body.setPosition(splinePos')          ← CORRECTS BACK
```

This produces visible vibration. Instead:

### Correct Approach (ADR-0014)

```typescript
// Pit Stop tick() during pitEntry:
const progress = pitProgress.get(carId);
const newProgress = progress + pitSpeedLimit * dt;
pitProgress.set(carId, newProgress);

const direction = spline.tangent(newProgress);
const targetVelocity = direction.scale(pitSpeedLimit);

// Use IPhysics.setPitVelocity — NOT direct position override
physics.setPitVelocity(carId, { velocity: targetVelocity, forward: direction });

// Physics Phase 3 (ADR-0008) applies:
//   body.setLinearVelocity(targetVelocity);
```

### State Transitions

| From       | To           | Trigger                                    | Action                                                                                          |
| ---------- | ------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `onTrack`  | `pitEntry`   | Track detects car center in `pitEntryZone` | Call `physics.setPit(carId, true)`. Emit `pit.entry(carId)`. Set progress=0.                    |
| `pitEntry` | `pitStopped` | Spline progress >= garageStopPoint         | Call `IPhysics.setLocked(carId, true)`. Start services. Emit `pit.status(carId, 'pitStopped')`. |

### API Correctness

- `IPhysics.setLocked(carId, true)` — system-level method on IPhysics, NOT `physicsBody.setLocked()` ❌
- `IPhysics.setPitVelocity()` — defined on IPhysics, delegates to `body.setLinearVelocity()` in Physics Phase 3
- `IPhysics.setPit(carId, true)` — enables pit speed limiter with smooth deceleration
- `IPhysics.brakeCar(carId, brakeForce)` — applies brake force over `speedTransitionTime` (default 2s)
- 1-tick delay accepted: Pit Stop operates at slot #8, Physics at slot #2. Velocity target set at slot #8 takes effect at slot #2 next tick.

### Speed Transition

```typescript
// Physics applies smooth deceleration over speedTransitionTime:
speed_kmh = lerp(currentSpeed, pitSpeedLimit, dt / speedTransitionTime);
```

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 003: Refuel + tire change during `pitStopped`
- Story 005: Pit exit, merge check, return to track (uses `departing` state, `setLocked(false)`, `setPitVelocity`)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these._

- **AC-1**: Car speed limited to pitSpeedLimit
  - Given: A car transitions from onTrack to pitEntry
  - When: `physics.setPit(carId, true)` is called and `setPitVelocity` receives velocity target
  - Then: The velocity target magnitude passed to `setPitVelocity` is ≤ `physics.pitSpeedLimit` (80 km/h)
  - Edge cases: Car entering pit at 300+ km/h — smooth deceleration over `speedTransitionTime` (2s default); pit speed limit set to 0 (dev/zero) — car attempts to stop

- **AC-2**: Car follows pitLaneSpline waypoints
  - Given: A car is in pitEntry state with progress offset at 0
  - When: Multiple ticks of `tick()` are called
  - Then: The forward direction passed to `setPitVelocity` matches `spline.tangent(progress)` at each tick; progress advances at `pitSpeedLimit * dt` per tick
  - Edge cases: Spline with only 2 points (degenerate); spline with tight corners

- **AC-3**: Car stops at assigned garage slot
  - Given: A car in pitEntry progressing along the spline
  - When: `progress >= garageStopPoint[teamIndex]`
  - Then: `IPhysics.setLocked(carId, true)` is called, `getPitState(carId)` returns `'pitStopped'`
  - Edge cases: Car enters pit on final lap (pit stop still happens); garageStopPoint is at index 0 (immediate stop)

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/pit-stop/story-002-entry-guidance.test.ts` — must exist and pass (~6 tests)
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (state machine + zone detection), ADR-0008 (IPhysics — setPit, setLocked, setPitVelocity, brakeCar), ADR-0025 (Track — pitLaneSpline, pitGarageSlots)
- Unlocks: Story 003, Story 004, Story 005
