# Story 003: Speed Target & Throttle/Brake Control

> **Epic**: AI Driver
> **Status**: Ready
> **Layer**: Core B
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/ai-driver.md`
**Requirement**: `TR-AI-001`

- TR-AI-001: Per-car AIFollower with spline position, target following, speed decision, and overtaking FSM.

**ADR Governing Implementation**: ADR-0013: AI Driver Architecture
**ADR Decision Summary**: Speed target = `min(maxSpeed, cornerSpeed)`. Throttle/brake output derived from speed error via proportional control. Auto-gear at fixed RPM thresholds.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript — zero engine imports. All formulas are deterministic math.

**Control Manifest Rules (this layer)**:

- Required: C41 (deterministic via SeededRandom — speed target is purely deterministic: same params → same speed)
- Required: C42 (spline following — speed target informed by spline curvature)

---

## Acceptance Criteria

_From GDD `design/gdd/ai-driver.md`, scoped to this story:_

- [ ] `targetSpeed = min(maxSpeed, cornerSpeed)` computed correctly each tick
- [ ] `cornerSpeed` uses formula: `sqrt(gripMax × gripMargin × curvatureRadius)`
- [ ] `maxSpeed` = car topSpeed stat × `params.speedMult`
- [ ] `brakeStartDistance = (vCurr² - vTarget²) / (2 × brakeDecel × brakingAggression)` — AI brakes when this distance > distance to corner entry
- [ ] Throttle output: `throttle = clamp(speedError × K_throttle, 0, 1)` where `K_throttle = 0.02` (proportional control — resolved gap)
- [ ] Brake output: `brake = clamp(speedError × K_brake, 0, 1)` where `K_brake = 0.03` (proportional control — resolved gap)
- [ ] Throttle on corner exit: rises smoothly at `params.throttleRampRate`
- [ ] Auto-gear: upshift at 95% maxRpm, downshift at 30% maxRpm; gear changes produce gearDelta pulse
- [ ] Lap time on a known spline with fixed params is within ±15% of reference

---

## Implementation Notes

_Derived from ADR-0013 Implementation Guidelines:_

1. **Speed target priority**: The AI always wants `maxSpeed` (top speed of the car). The `cornerSpeed` constraint may reduce it when curvature requires grip.

2. **Corner speed formula**: `cornerSpeed = sqrt(gripMax × gripMargin × curvatureRadius)`. Same formula the player experiences. `gripMax` comes from Physics (tireCondition-adjusted); `gripMargin` from AI params (0.75–0.95); `curvatureRadius` from spline lookahead (inverse of curvature).

3. **Braking**: The AI compares `brakeStartDistance` to `distanceToCornerEntry` (distance along spline to the point where curvature begins to increase). If `brakeStartDistance > distanceToCornerEntry`, braking begins. Brake output is proportional to how much the AI needs to slow.

4. **Throttle on exit**: After the corner apex, throttle rises at `throttleRampRate` (0.4–0.9). A higher rate means the AI gets on power earlier, carrying more exit speed. The ramp caps at the computed throttle value for the target speed.

5. **Gear changes**: Instantaneous (no clutch delay, no missed shifts). `upshiftRpm = 0.95 × maxRpm`, `downshiftRpm = 0.30 × maxRpm`. GearDelta is a pulse: +1 for upshift, -1 for downshift, 0 otherwise. One shift per tick max.

6. **Throttle/brake blending**: When both speedError > 0 (need to slow) and coasting would be appropriate, brake takes priority. No simultaneous throttle+brake.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 002: Spline following (steer output)
- Story 004: Team performance model (provides speedMult, gripMargin, etc.)
- Story 007: Fuel/tire awareness (modulates target speed based on fuel/tire state)

---

## QA Test Cases

- **AC-1**: targetSpeed selects min of maxSpeed and cornerSpeed
  - Given: maxSpeed=200, cornerSpeed=150 (tight corner)
  - When: `computeTargetSpeed()` is called
  - Then: targetSpeed = 150
  - Edge cases: maxSpeed < cornerSpeed (straight → maxSpeed wins), equal values, near-zero values, very large values

- **AC-2**: cornerSpeed uses sqrt(gripMax × gripMargin × curvatureRadius)
  - Given: gripMax=1.0, gripMargin=0.85, curvatureRadius=50m
  - When: `computeCornerSpeed()` is called
  - Then: result = sqrt(1.0 × 0.85 × 50) ≈ 6.52
  - Edge cases: curvatureRadius=0 (should handle gracefully — infinite curvature = speed 0), gripMargin=1.0 (no safety margin), extremely high curvatureRadius (essentially straight)

- **AC-3**: brakeStartDistance computes correctly
  - Given: vCurr=100, vTarget=50, brakeDecel=10, brakingAggression=1.0
  - When: `computeBrakeDistance()` is called
  - Then: result = (100² - 50²) / (2 × 10 × 1.0) = 375
  - Edge cases: vCurr < vTarget (negative distance → 0, no braking), brakingAggression=0 (infinite distance → never brakes), aggressive brakingAggression=1.2 (later braking)

- **AC-4**: Throttle output via proportional control
  - Given: currentSpeed=100, targetSpeed=150, K_throttle=0.02
  - When: `computeThrottle()` is called
  - Then: throttle = clamp(50 × 0.02, 0, 1) = 1.0
  - Edge cases: speedError=0 (throttle=0 — coast), speedError negative (AI above target — throttle=0), clamp at 1.0

- **AC-5**: Brake output via proportional control
  - Given: currentSpeed=150, targetSpeed=100, K_brake=0.03
  - When: `computeBrake()` is called
  - Then: brake = clamp(50 × 0.03, 0, 1) = 1.0
  - Edge cases: speedError negative (AI below target — brake=0, no simultaneous), clamp at 1.0

- **AC-6**: Auto-gear upshifts at 95% maxRpm
  - Given: engine RPM = 18000, maxRpm = 19000, current gear = 3
  - When: `computeGearDelta()` is called
  - Then: gearDelta = +1 (upshift)
  - Edge cases: RPM exactly at 95% threshold (should shift), RPM just below (should not), already at max gear (no upshift)

- **AC-7**: Auto-gear downshifts at 30% maxRpm
  - Given: engine RPM = 5000, maxRpm = 19000, current gear = 3
  - When: `computeGearDelta()` is called
  - Then: gearDelta = -1 (downshift)
  - Edge cases: RPM exactly at threshold, already at gear=1 (no downshift)

- **AC-8**: Lap time within ±15% of reference
  - Given: A mock spline of known length (e.g. 4000m), fixed AI params, reference lap time of 90.0s
  - When: AI controller runs for one full lap
  - Then: elapsed time ∈ [76.5, 103.5] seconds
  - Edge cases: Very tight spline (all corners — speed dominated by cornerSpeed), very open spline (all straights — speed dominated by maxSpeed)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/ai/speed_control.test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (controller framework), Story 002 (spline following for curvature data), Story 004 (team performance for speedMult/gripMargin)
- Unlocks: Story 005 (overtaking needs speed diff calculation), Story 007 (fuel/tire awareness modulates these values)
