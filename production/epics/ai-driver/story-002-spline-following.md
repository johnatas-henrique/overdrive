# Story 002: Spline Following (PID Steer & Lateral Offset)

> **Epic**: AI Driver
> **Status**: Ready
> **Layer**: Core B
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/ai-driver.md`
**Requirement**: `TR-AI-001`

- TR-AI-001: Per-car AIFollower with spline position, target following, speed decision, and overtaking FSM.

**ADR Governing Implementation**: ADR-0013: AI Driver Architecture
**ADR Decision Summary**: Spline follower uses PID(lateralError) + curvatureFeedforward to produce steer output (-1..1). Dynamic lateral offset target with smooth interpolation and configurable rate cap.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript — zero engine imports. Spline is `SplineSegment[]` custom array (per ADR-0025), NOT `Curve3`/`CatmullRomCurve3`/`Path3D`.

**Control Manifest Rules (this layer)**:

- Required: C42 (spline-based path following — PID + curvature)
- Required: C46 (AIDriverParams open set — params used for steer computation)
- Forbidden: C-F1 (never use Curve3/CatmullRomCurve3/Path3D for spline data)

---

## Acceptance Criteria

_From GDD `design/gdd/ai-driver.md`, scoped to this story:_

- [ ] PID(lateralError) + curvatureFeedforward produces steer in -1..1 range
- [ ] Spline progress tracks correctly (0.0–1.0, wraps at end of lap)
- [ ] Lateral offset interpolates smoothly toward targetOffset at configurable rate
- [ ] Lateral offset change capped to `maxOffsetDeltaPerTick` (configurable, default 0.05m)
- [ ] Steer output keeps car on track — lateral distance from spline center < track half-width at all points
- [ ] AI recovers from a missed braking point within one corner: _lateral error returns to < 1.0m within 200 spline meters of entry_ (quantified resolution)

---

## Implementation Notes

_Derived from ADR-0013 Implementation Guidelines:_

1. **Steer formula**:

   ```
   steer = clamp(PID(lateralError) + curvatureFeedforward, -1, 1)
   PID(lateralError) = Kp × latError + Kd × dLatErrorDt
   curvatureFeedforward = lookaheadCurvature × speed × Kff
   ```

2. **Lookahead point**: 5m ahead on spline from current progress. Curvature derived from heading difference between that segment's `point` and `next`.

3. **Lateral offset**: each AI has a dynamic `targetOffset` (meters left/right of center spline).
   - Base offset: determined by `offsetPreference` mapped to meters
   - During overtaking: shifts to ±2.5m temporarily
   - Smooth interpolation: `currentOffset += sign(targetOffset - currentOffset) × min(|targetOffset - currentOffset|, maxOffsetDeltaPerTick)`
   - Erratic behavior prevented by capping to `maxOffsetDeltaPerTick`

4. **Recovery metric**: If the AI overcooks a corner (enters too fast → understeers → lateral error spikes), the PID controller should bring lateral error below 1.0m within 200m of spline travel from the corner entry point. No separate recovery logic needed — the PID naturally corrects.

5. **Spline progress**: Per-car cached segment index for O(1) lookup. Progress advances by `(speed × dt) / trackLength` each tick. Wraps at 1.0 → 0.0.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 001: Controller framework, IAIDriver interface, input buffer
- Story 003: Speed target calculation (this story only covers steer)
- Story 005: Overtaking state machine (offset changes from FSM are handled here, but FSM transitions are in Story 005)

---

## QA Test Cases

- **AC-1**: PID + curvatureFeedforward produces steer in [-1, 1]
  - Given: A straight spline segment (zero curvature) and a car offset by 2m laterally
  - When: `computeSteer(lateralError=2, speed=50)` is called
  - Then: Result ∈ [-1, 1]
  - Edge cases: Very large lateral error (10m — clamped), zero error, negative curvature (left vs right), curvature alone causes over-1 without clamp

- **AC-2**: Spline progress tracks 0.0–1.0 and wraps
  - Given: A circular spline of length 500m
  - When: AI progresses 600m over multiple ticks
  - Then: Progress = 0.2 (wrapped past 1.0 back to 0.0)
  - Edge cases: Progress exactly 0.0, exactly 1.0, wraps multiple times, backwards progress (should not regress — or wrap backward depending on design)

- **AC-3**: Lateral offset interpolates toward targetOffset at configurable rate
  - Given: targetOffset = +2.0m, current offset = 0.0m, maxOffsetDeltaPerTick = 0.05m
  - When: tick() is called 40 times
  - Then: offset approaches 2.0m monotonically; after 40 ticks, offset ≈ 2.0m (2.0 / 0.05 = 40); each Δ ≤ 0.05m
  - Edge cases: targetOffset = currentOffset (no movement), max delta reached exactly

- **AC-4**: Lateral offset change capped to maxOffsetDeltaPerTick
  - Given: A sudden targetOffset change of 10m, maxOffsetDeltaPerTick = 0.05m
  - When: A single tick occurs
  - Then: offset changes by exactly 0.05m (capped), not 10m
  - Edge cases: delta exactly at cap, delta below cap (no capping needed)

- **AC-5**: Steer output keeps car on track (spline error < track half-width)
  - Given: A simulated race on a known spline with track half-width = 5m
  - When: AI ticks for one full lap
  - Then: At every tick, lateral distance from spline center < 5m
  - Edge cases: Sharpest corner on the track, highest-speed section, zero lateral error (perfect center)

- **AC-6**: AI recovers from missed braking point
  - Given: AI enters corner at 1.5× cornerSpeed (simulated braking miss at corner entry)
  - When: AI continues for 200 spline meters after entry
  - Then: Lateral error < 1.0m within those 200m
  - Edge cases: Very tight hairpin (recovery may take longer — test configurable), low-speed entry (no miss, recovery trivially satisfied)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/ai/spline_following.test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (controller framework — for AIController interface and spline reference)
- Unlocks: Story 003 (speed target needs spline curvature data), Story 005 (overtaking needs steer)
