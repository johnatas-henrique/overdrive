# Story 005: Pit Exit, Merge Check & Return to Track

> **Epic**: Pit Stop
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/pit-stop.md`
**Requirement**: `TR-PIT-005`, `TR-PIT-007`
_(TR-PIT-005: "On pit exit: calls physics.setPit(carId, false) to release speed limiter; emits pit.exit on Event Bus.")_
_(TR-PIT-007: "Pit merge check: timer starts on pit exit; if another car is approaching pit exit at > mergeSpeedThreshold, holds car at exit.")_

**ADR Governing Implementation**: ADR-0014: Pit Stop Flow
**ADR Decision Summary**: Departing state uses same velocity-driven approach as entry. Merge check via distance check against other pitting cars (not Havok overlap). Force-merge after `forceMergeTimeout` (5s) with jittered insertion. At pit exit zone, control returns to player via `physics.setPit(carId, false)`.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript logic + IPhysics interface calls. No direct Babylon APIs.

**Control Manifest Rules (this layer)**:

- Required: C51 — Pit Stop: merge check — config-driven via `mergeCheckDistance`, `forceMergeTimeout`
- Required: C47 — Velocity-driven, no position override
- Required: C49 — `confirm` gatekept (Story 004)
- Forbidden: C-F3 — Never set position/heading directly on a DYNAMIC PhysicsBody
- Guardrail: C-G6 — Pit Stop: ~0.001ms/car/tick

---

## Acceptance Criteria

_From GDD `design/gdd/pit-stop.md`, scoped to this story:_

- [ ] **AC-1**: Merge check waits 200 ms if car ahead within `pit.mergeCheckDistance` — car holds position, retries each tick
- [ ] **AC-2**: After `pit.forceMergeTimeout` (5s default) with no gap, car force-merges — inserts sequentially (one per tick) with staggered timeout (jitter ±100ms)
- [ ] **AC-3**: Car exiting pit exit BoundingBox returns to `onTrack` — full control restored via `physics.setPit(carId, false)`, emit `pit.exit(carId, totalTimeMs)`
- [ ] **AC-4**: When no car is ahead within `pit.mergeCheckDistance`, departing car proceeds immediately without delay

---

## Implementation Notes

_Derived from ADR-0014 Implementation Guidelines:_

### State Transitions

| From         | To          | Trigger                                         | Action                                                                                                                      |
| ------------ | ----------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `pitStopped` | `departing` | confirm OR (both services done + grace timeout) | `physics.setLocked(carId, false)`, `physics.setPitVelocity(carId, forward·pitSpeed)`, emit `pit.status(carId, 'departing')` |
| `departing`  | `onTrack`   | Crosses `pitExitZone` BoundingBox               | `physics.setPit(carId, false)`, emit `pit.exit(carId, totalTimeMs)`, clear pit state                                        |

### Merge Check Logic

```typescript
function canMerge(carId: string): boolean {
  const exitProgress = pitProgress.get(carId);
  for each otherCar in pitStates:
    if otherCar.state === 'departing' || otherCar.state === 'pitEntry':
      const aheadDistance = pitProgress.get(otherCar) - exitProgress;
      if (0 < aheadDistance < mergeCheckDistance) {
        return false;  // AC-1: car ahead too close
      }
  return true;  // AC-4: clear
}
```

During `departing`:

1. Each tick: if `canMerge()`, advance progress at `pitSpeedLimit` and set velocity
2. If blocked: car holds position, increment `mergeWaitTimer`
3. If `mergeWaitTimer >= forceMergeTimeout`: force-merge (AC-2)
4. Force-merge staggered: ±100ms jitter per car to prevent simultaneous insertion
5. At `pitExitZone`: call `physics.setPit(carId, false)` to restore normal control (AC-3)

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 002: Pit entry guidance (mirrors exit guidance but uses same pattern)
- Story 004: Confirm gatekeeping (departing is triggered by Story 004)
- Story 006: AI departure (same mechanics, but AI timer-based not confirm-based)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these._

- **AC-1**: Merge check waits when car ahead
  - Given: Car A is departing ahead of Car B with `distance < mergeCheckDistance`
  - When: Car B calls `tick()`
  - Then: Car B does not advance progress; mergeWaitTimer increments by dt
  - Edge cases: Car A exactly at `mergeCheckDistance` boundary — Car B proceeds; Car A is in pitEntry (ahead on spline) — Car B waits

- **AC-2**: Force-merge after timeout
  - Given: Car B has been blocked for `forceMergeTimeout` seconds
  - When: mergeWaitTimer >= forceMergeTimeout
  - Then: Car B proceeds despite blocked condition — advances progress, no longer blocked
  - Edge cases: Multiple cars force-merging simultaneously — they insert one per tick (sequential); forceMergeTimeout with ±100ms jitter prevents same-tick collision

- **AC-3**: Return to track at pit exit
  - Given: Car is departing, progress >= splineTotalLength
  - When: Track detects car center in `pitExitZone`
  - Then: `physics.setPit(carId, false)` is called; `getPitState(carId)` returns `'onTrack'`; `pit.exit(carId, totalTimeMs)` emitted
  - Edge cases: pitExitZone crossed at speed — snapping to onTrack is frame-perfect (position check each tick); zone is very narrow — car might skip detection (tunneling guard: check per tick)

- **AC-4**: Clear exit proceeds immediately
  - Given: Car is departing, no cars ahead within `mergeCheckDistance`
  - When: `canMerge()` is evaluated
  - Then: Returns `true`; car advances progress at `pitSpeedLimit * dt`
  - Edge cases: Merge check runs every tick — `canMerge()` returns true even if car enters range later (re-evaluated)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/pit-stop/story-005-exit-merge.test.ts` — must exist and pass (~7 tests)
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (state machine), Story 003 (services complete), Story 004 (triggers departing), ADR-0008 (IPhysics — setPit, setLocked, setPitVelocity), ADR-0025 (Track — pitExitZone, pitLaneSpline)
- Unlocks: None (final state machine story)
