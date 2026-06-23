# Story 005: Overtaking State Machine

> **Epic**: AI Driver
> **Status**: Ready
> **Layer**: Core B
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/ai-driver.md`
**Requirement**: `TR-AI-005`, `TR-AI-010`

- TR-AI-005: Overtaking FSM: Normal → Following → Outside → Inside → Normal; each transition has configurable distance and timing thresholds.
- TR-AI-010: Race Management position awareness: ai reads position delta to car ahead to trigger overtaking approach logic.

**ADR Governing Implementation**: ADR-0013: AI Driver Architecture
**ADR Decision Summary**: 3-state overtaking FSM (Normal → Following → Passing → Normal). No collision avoidance system — AI adjusts lateral offset within track surface. Passing offset formula guarantees track-fit. Speed diff, curvature, and gap distance gate transitions.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript — zero engine imports. State machine is a flat switch/if-else on progress and ahead-car data.

**Control Manifest Rules (this layer)**:

- Required: C43 (overtaking state machine — no collision avoidance)
- Required: C41 (deterministic via SeededRandom — FSM transitions are deterministic: same state + same input = same transition)
- Forbidden: C-F6 (never branch Physics on player vs AI — FSM applies identically to player and AI cars ahead)

---

## Acceptance Criteria

_From GDD `design/gdd/ai-driver.md`, scoped to this story:_

- [ ] Normal → Following: car ahead detected < `followDist` (configurable, default 25m) on spline
- [ ] Following → Normal: car ahead pulls away > 30m gap (hysteresis prevents oscillation)
- [ ] Following → Passing: `speedDiff > 5%` sustained for ≥3 ticks AND curvature open (corner radius > 50m or straight)
- [ ] Passing → Normal: pass completes when overtaking car is fully ahead with clearance > 30m (same as Following→Normal threshold — resolved gap quantification)
- [ ] Passing → Following: pass fails when (a) distance to next corner (radius < 50m) is < 25m, OR (b) gap to car ahead is closing at > 2m/s, OR (c) car ahead pulls away > 30m (resolved gap quantification)
- [ ] Passing offset: `offset = min(passingOffsetScale × halfWidth, halfWidth − carHalfWidth − 0.5m)` — guaranteed to fit within track surface
- [ ] Physical fit check before entering Passing: `(passingOffsetScale × halfWidth) + carHalfWidth < halfWidth` — if false, stay in Following
- [ ] Same FSM logic applies to player and AI cars ahead — no discrimination
- [ ] Macklen AI overtakes Layton Hall AI within 3 simulated laps on any mock spline
- [ ] At least 1 overtake (Passing → Normal transition) occurs in a 5-lap simulated race with all 7 AIs on Interlagos-like spline

---

## Implementation Notes

_Derived from ADR-0013 Implementation Guidelines:_

1. **State machine structure**: Implement as a `switch(state)` with three handlers. Each handler reads car-ahead data (distance diff, speed diff, upcoming curvature from spline lookahead) and returns the new state.

2. **Car-ahead detection**: During Following, the AI matches speed to the car ahead (targetSpeed = min(myTargetSpeed, aheadCarSpeed)). Lateral offset shifts toward the expected overtaking side (inside line if next corner is left, outside if right).

3. **Speed diff calculation**: `speedDiff = (myTargetSpeed - aheadCarSpeed) / myTargetSpeed`. Must exceed 0.05 (5%) for 3 consecutive ticks. If diff drops below 5% before 3 ticks, counter resets.

4. **Passing offset safety**: The offset formula guarantees the car stays on track. `passingOffsetScale` (default 0.35) × `halfWidth` (from Track) gives meters of offset. This is clamped against `halfWidth - carHalfWidth - 0.5m` (half meter safety margin from track edge).

5. **During Passing**: Throttle target increases: `min(targetSpeed × 1.05, maxSpeed)` — AI pushes harder during overtake.

6. **Collision handling**: If collision occurs during a pass, the Collision system handles it normally. AI does not have collision avoidance — it relies on the track-fit guarantee for safety.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 002: Spline following (lateral offset interpolation — this story SETS targetOffset, Story 002 interpolates toward it)
- Story 003: Speed target (this story MODULATES targetSpeed in Following/Passing states)
- Story 006: Mistake model (applied AFTER FSM each tick)
- Defensive driving (AI reacts the same regardless of who is ahead)

---

## QA Test Cases

- **AC-1**: Normal → Following transition at 25m
  - Given: State=Normal, car ahead at 26m on spline
  - When: Distance decreases to 24m (within followDist=25)
  - Then: State transitions to Following
  - Edge cases: Distance exactly 25m (should transition), distance oscillates around threshold (±1m noise — filtered, or transitions at each crossing)

- **AC-2**: Following → Normal at 30m gap
  - Given: State=Following, car ahead at 29m
  - When: Car ahead pulls away to 31m
  - Then: State returns to Normal
  - Edge cases: Hysteresis works (25m entry vs 30m exit prevents rapid oscillation), gap stabilises at 27m (stays in Following)

- **AC-3**: Following → Passing when speedDiff > 5% for 3 ticks and curvature open
  - Given: State=Following, speedDiff=8% for 3 consecutive ticks, curvature radius=100m (>50m)
  - When: All conditions met on the 3rd tick
  - Then: State transitions to Passing
  - Edge cases: speedDiff exactly 5.0% (NOT >5%, should NOT pass), curvature=50m exactly (should NOT pass), speedDiff sustained for 2 ticks only (counter reset), speedDiff counter in wrong direction

- **AC-4**: Passing → Normal on completion (gap > 30m)
  - Given: State=Passing, overtaking car ahead by 28m
  - When: Gap increases to 31m
  - Then: State returns to Normal
  - Edge cases: Gap exactly 30m (should NOT transition — must be > 30m), gap drops back to 25m after reaching 31m (stays Normal — pass considered complete)

- **AC-5**: Passing → Following on failure
  - Given: State=Passing
  - When: (a) distance to next sharp corner (< 50m radius) is < 25m, OR (b) gap closing at > 2m/s, OR (c) car ahead pulls away > 30m
  - Then: State returns to Following
  - Edge cases: Multiple failure conditions simultaneously, condition (c) triggers same as AC-2 but from Passing state

- **AC-6**: Passing offset formula fits within track
  - Given: passingOffsetScale=0.35, halfWidth=6m, carHalfWidth=0.9m
  - When: `computePassingOffset()` is called
  - Then: offset = min(0.35 × 6, 6 − 0.9 − 0.5) = min(2.1, 4.6) = 2.1m
  - Edge cases: Narrow track (passing offset clamped to 4.6m physical limit), zero halfWidth (degenerate — no passing)

- **AC-7**: Physical fit check prevents impossible pass
  - Given: halfWidth=2.0m, carHalfWidth=0.9m, passingOffsetScale=0.5
  - When: Fit check: (0.5 × 2.0) + 0.9 < 2.0 → (1.0 + 0.9 = 1.9) < 2.0
  - Then: Pass is permitted (fits)
  - Edge cases: halfWidth=1.5m, carHalfWidth=0.9m → 0.5×1.5+0.9=1.65 > 1.5 → pass denied; stays in Following

- **AC-8**: Same logic for player and AI cars ahead
  - Given: AI controller with a mock car ahead
  - When: Car ahead type is toggled between 'player' and 'ai'
  - Then: FSM transitions occur at identical distances/speeds regardless of type
  - Edge cases: N/A — structural parity test

- **AC-9**: Macklen overtakes Layton Hall within 3 simulated laps
  - Given: Macklen AI (tp=1.0) and Layton Hall AI (tp=0.08) on a 4000m mock spline, starting 20m apart
  - When: Both AIs tick for 3 laps
  - Then: Macklen leads Layton Hall by > 100m by end of lap 3
  - Edge cases: Very short track (need proportional lap count?), speedMult difference: 1.0 vs 0.862

- **AC-10**: At least 1 overtake in 5-lap simulated race (all 7 AIs)
  - Given: All 7 AI cars configured per team model, Interlagos-style mock spline (multiple corner types + straights)
  - When: 5 laps are simulated
  - Then: At least one Passing → Normal transition (completed overtake) is logged
  - Edge cases: Verify the overtake involves a faster car passing a slower one (not a lapped car)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/ai/overtaking_fsm_test.ts` — must exist and pass

**Note**: AC-9 and AC-10 are integration-level across Stories 001–005. These should be written as part of an integration test suite (`tests/integration/ai/`) that depends on all earlier stories being DONE.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (controller framework), Story 002 (spline following for offset), Story 003 (speed target for speedDiff), Story 004 (team performance for passingAggression)
- Unlocks: Story 006 (mistake model runs each tick regardless of FSM state)
