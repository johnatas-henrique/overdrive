# Story 007: Fuel & Tire Awareness

> **Epic**: AI Driver
> **Status**: Ready
> **Layer**: Core B
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/ai-driver.md`
**Requirement**: `TR-AI-006`, `TR-AI-007`

- TR-AI-006: Fuel-aware speeding: ai slows targetSpeed when own fuelLevel < fuelAwareThreshold (configurable, default 15%).
- TR-AI-007: Tire-aware cornering: ai reduces corner entry speed when own tireCondition < tireAwareThreshold (configurable).

**ADR Governing Implementation**: ADR-0013: AI Driver Architecture
**ADR Decision Summary**: AI reads fuelLevel and tireCondition from external systems (Fuel and Tire Wear) each tick. These modulate targetSpeed and cornerSpeed respectively. Pit strategy timing is owned by Pit Stop system; AI Driver only provides awareness inputs.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript — zero engine imports. Fuel and tire data arrives as external telemetry (numbers, not engine objects).

**Control Manifest Rules (this layer)**:

- Required: C47 (input suppressed during active pit stop — Fuel/Tire awareness continues during Racing but input is suppressed by Pit Stop during pit service)
- Required: C46 (AIDriverParams open set — fuelAwareThreshold, tireAwareThreshold are config parameters)

---

## Acceptance Criteria

_From GDD `design/gdd/ai-driver.md`, scoped to this story:_

- [ ] When `fuelLevel < fuelAwareThreshold` (configurable %, default 15%), targetSpeed is multiplied by `fuelSlowdownFactor` (default 0.95 — 5% reduction) (resolved gap)
- [ ] When `tireCondition < tireAwareThreshold` (configurable, default 0.3), corner entry speed is reduced: `cornerSpeed ×= (0.5 + 0.5 × tireCondition / tireAwareThreshold)` — linear interpolation from full speed at threshold to 50% at tireCondition=0 (resolved gap)
- [ ] Fuel/tire thresholds are configurable tuning knobs in `src/config/ai.ts`
- [ ] Both conditions compose: when both fuel and tire are below thresholds, both penalties apply multiplicatively
- [ ] Awareness calculations happen after Story 003's base speed computation (they modulate, not replace)

---

## Implementation Notes

_Derived from ADR-0013 Implementation Guidelines:_

1. **Fuel awareness**: AI reads `fuelLevel` from Fuel system each tick. When below threshold: `targetSpeed = baseTargetSpeed × fuelSlowdownFactor`. This makes the AI coast slightly (5% slower) when fuel is critical — conserves fuel and is visible to the player as slower corner exits.

2. **Tire awareness**: AI reads `tireCondition` from Tire Wear system each tick. When below threshold: `cornerSpeed = baseCornerSpeed × (0.5 + 0.5 × tireCondition / tireAwareThreshold)`. At tireCondition=0.3 (threshold), cornerSpeed is at 100% of base. At tireCondition=0.15, cornerSpeed is at 75%. At tireCondition=0 (blown), cornerSpeed is at 50%.

3. **Composition**: `finalTargetSpeed = baseTargetSpeed × fuelFactor × tireFactor`. Both factors default to 1.0 (no penalty) when above thresholds.

4. **Pit request signals**: These awareness values are read by the Pit Stop system to determine when to call AI in for service. The AI Driver does not initiate pit entry — it just provides the speed/target modulations.

5. **Convenience for designer**: Configure `fuelAwareThreshold = 0` to disable fuel awareness entirely. Same for `tireAwareThreshold = 0`.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Fuel system (Core B — computes fuelLevel each tick)
- Tire Wear system (Core B — computes tireCondition each tick)
- Pit Stop system (Core C — owns pit timing decisions)
- Story 008: Collision reaction (separate awareness mechanism)

---

## QA Test Cases

- **AC-1**: Fuel awareness reduces target speed below threshold
  - Given: AI with targetSpeed=200, fuelLevel=10% (< fuelAwareThreshold=15%), fuelSlowdownFactor=0.95
  - When: Speed computation runs
  - Then: targetSpeed = 200 × 0.95 = 190
  - Edge cases: fuelLevel=20% (above threshold — no reduction), fuelLevel=0% (empty — 5% slowdown still applies), fuelAwareThreshold=0 (feature disabled)

- **AC-2**: Tire awareness reduces corner speed below threshold
  - Given: tireCondition=0.2, tireAwareThreshold=0.3, baseCornerSpeed=100
  - When: Corner speed computation runs
  - Then: cornerSpeed = 100 × (0.5 + 0.5 × 0.2 / 0.3) = 100 × (0.5 + 0.333) = 83.3
  - Edge cases: tireCondition at threshold (0.3 — 100% speed), tireCondition=0 (50% speed), tireCondition above threshold (0.5 — no reduction), tireAwareThreshold=0 (feature disabled)

- **AC-3**: Fuel/tire thresholds are configurable
  - Given: `src/config/ai.ts` config structure
  - When: All tuning knobs are read
  - Then: fuelAwareThreshold, fuelSlowdownFactor, tireAwareThreshold are present with defaults
  - Edge cases: Overrides produce correct behavior

- **AC-4**: Both penalties compose multiplicatively
  - Given: fuelLevel=10% (below threshold) AND tireCondition=0.2 (below threshold), baseTargetSpeed=200, baseCornerSpeed=100
  - When: Both penalties applied
  - Then: finalTargetSpeed = baseTargetSpeed × fuelFactor × tireFactor = 200 × 0.95 × (0.5 + 0.5 × 0.2/0.3) = 200 × 0.95 × 0.833 = 158.3
  - Edge cases: Only one condition active, neither active, both active with extreme values

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/ai/fuel_tire_awareness_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (controller framework), Story 003 (speed target computation — this modulates it)
- Unlocks: Story 008 (collision reaction is separate), Pit Stop's AI pit strategy logic
