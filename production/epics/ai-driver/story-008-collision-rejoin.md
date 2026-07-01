# Story 008: Collision Reaction & Rejoin Detection

> **Epic**: AI Driver
> **Status**: Ready
> **Layer**: Core B
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/ai-driver.md`
**Requirement**: `TR-AI-009`, `TR-AI-011`

- TR-AI-009: Collision reaction: on collision.impact with impulse > aiReactionThreshold, ai reduces target speed for aiReactionDuration ms.
- TR-AI-011: Rejoin detection — AI checks if rejoining the racing line is safe after off-track excursion; yields (waits) if a car is approaching at high closing speed.

**ADR Governing Implementation**: ADR-0013: AI Driver Architecture
**ADR Decision Summary**: AI reacts to collision.impact events with configurable speed reduction. Rejoin detection uses spline error > track half-width to detect off-track, then checks closing speed before merging back. No collision avoidance system — physical contacts handled by Collision.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript — zero engine imports. Collision events arrive via Event Bus subscription (payload: impulse magnitude, carId, otherId).

**Control Manifest Rules (this layer)**:

- Required: C41 (deterministic via SeededRandom — collision reaction uses deterministic timers, not Date.now())
- Required: C47 (input suppressed during pit stop — rejoin logic is independent of pit state)
- Forbidden: C-F6 (never branch Physics — collision reaction only modulates AI target speed, not Physics behavior)

---

## Acceptance Criteria

_From GDD `design/gdd/ai-driver.md`, scoped to this story:_

- [ ] On `collision.impact` event with impulse > `aiReactionThreshold` (default 300 N·s), AI reduces targetSpeed by `reactionSlowdownFactor` (default 0.85) for `reactionDuration` (default 500ms) (resolved gaps)
- [ ] Off-track detection: `abs(splineError) > trackHalfWidth` triggers rejoin safety check
- [ ] Rejoin check: if closing speed of approaching car > `safeMergeThreshold` (configurable, default 30 m/s), AI yields at current position until gap opens — position-hold, no pit-entry-line dependency (resolved gap — simplified)
- [ ] If closing speed ≤ safeMergeThreshold, or no car detected within closing range (configurable, default 50m), AI merges back normally
- [ ] `aiReactionThreshold`, `reactionSlowdownFactor`, `reactionDuration`, `safeMergeThreshold` are all configurable tuning knobs in `src/config/ai.ts`

---

## Implementation Notes

_Derived from ADR-0013 Implementation Guidelines:_

1. **Collision reaction**: AI subscribes to `collision.impact` on Event Bus. When impulse > threshold, sets a timer for `reactionDuration` ms. During this window, all targetSpeed values are multiplied by `reactionSlowdownFactor`. Timer is edge-triggered — a new impact resets the timer, does NOT stack.

2. **Rejoin detection**: The AI tracks `splineError` each tick. When `abs(splineError) > trackHalfWidth`, the car is off-track. The AI then scans for approaching cars: for each detected car ahead/behind within `safeMergeRange` (50m), compute closing speed. If any car's closing speed > `safeMergeThreshold`, the AI holds current position (does not steer back toward spline) and waits one tick to re-evaluate.

3. **Simplified rejoin model**: No pit-entry-line dependency. The AI holds at its current position (not on any specific line) and waits for the gap. Once clear, the PID controller naturally steers back toward the spline.

4. **Timer implementation**: Use tick counting (`reactionDuration / FIXED_DT` ticks) rather than `Date.now()` — determinism requirement per ADR-0002.

5. **Performance**: Collision reaction is a simple comparison + timer set/clear. Rejoin check iterates over ~7 AI positions at most — negligible (< 0.001ms per tick).

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Collision system (emits collision.impact events — AI only consumes them)
- Story 007: Fuel/tire awareness (separate speed modulation mechanism)
- Physical damage effects (handled by Physics + Collision — AI just reacts to the event)

---

## QA Test Cases

- **AC-1**: Collision impact reaction reduces targetSpeed
  - Given: AI at full speed (targetSpeed=200), collision.impact event with impulse=500 N·s, aiReactionThreshold=300 N·s
  - When: The event is processed
  - Then: targetSpeed = 200 × 0.85 = 170 for 500ms (30 ticks at 60Hz)
  - Edge cases: Impulse below threshold (300 — no reaction), impulse exactly at threshold (300 — should react since threshold is ">"), second impact within reactionDuration (timer resets, no stacking)

- **AC-2**: Off-track detected by spline error > half-width
  - Given: AI position with spline error = 6m, track half-width = 5m
  - When: Rejoin check runs
  - Then: AI is detected as off-track → triggers rejoin safety check
  - Edge cases: Spline error exactly equals half-width (5m — should NOT be off-track), error slightly below (4.9m — on-track)

- **AC-3**: Rejoin yields when closing speed > safeMergeThreshold
  - Given: AI off-track (error=6m), approaching car closing speed = 40 m/s, safeMergeThreshold = 30 m/s
  - When: Rejoin check runs
  - Then: AI yields (holds position, does not steer toward spline)
  - Edge cases: Closing speed exactly 30 m/s (should NOT yield at threshold), closing speed 25 m/s (below threshold — merges), no approaching car detected (merges)

- **AC-4**: Rejoin merges when clear
  - Given: AI off-track, safeMergeCheck returns no approaching car within 50m
  - When: Rejoin check runs
  - Then: AI resumes normal steering toward spline (PID controller handles it)
  - Edge cases: Car detected but moving away (negative closing speed — merges), car detected at 55m (outside range — merges)

- **AC-5**: All thresholds are configurable
  - Given: ai.reaction config namespace in `src/config/ai.ts`
  - When: All tuning knobs are read
  - Then: aiReactionThreshold (300), reactionSlowdownFactor (0.85), reactionDuration (500ms), and safeMergeThreshold (30) are present with defaults
  - Edge cases: Overrides produce correct behavior

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/ai/collision_reaction.test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (controller framework — for AIController, targetSpeed modulation), Story 002 (spline following — for splineError computation)
- Unlocks: None (terminal AI behavior — sits between FSM and InputState output)
