# Story 003: Error Application & Line Correction

> **Epic**: AI Rival
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/ai-rival.md`
**Requirement**: `TR-ai-005` (error layer — split from target speed per QL-STORY-READY 2026-08-16)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0009: AI Rival Deterministic Architecture (§Target-Speed Model error application)
**ADR Decision Summary**: The AI drives corners at `applied × (1 − throttleErrorPercent)` and brakes at `brakeErrorMeters` before the curvature-derived braking point. Steering noise = archetype amplitude × profile error multiplier × deterministic signed sample (0.04 × 1.2 × 0.5 → 0.024 exact). Line correction = base correction × precision (Very Easy 0.90 → exactly 90% before steering clamp).

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C#.

**Control Manifest Rules (this layer)**:
- Required: error application per control channel (throttle/brake/steering) with explicit sign conventions
- Required: difficulty error multiplier scales the archetype error; outputs clamped per channel contract

---

## Acceptance Criteria

*From ADR-0009 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Corner throttle applies `cornerThrottle × (1 − throttleErrorPercent)`
- [ ] Brake error offsets the supplied curvature braking point with an explicit sign convention (resolved: positive error = braking earlier)
- [ ] Steering noise = `amplitude × errorMultiplier × signedSample` — exact-value: 0.04 × 1.2 × 0.5 → 0.024; zero error multiplier → no error
- [ ] Line correction = `baseCorrection × precision` — Very Easy precision 0.90 → exactly 90% before steering clamp
- [ ] All outputs clamped per their control-channel contracts (AccelerateOut 0-1, BrakeOut 0-1, SteerOut -1..1)

---

## Implementation Notes

*Derived from ADR-0009 Implementation Guidelines:*

- The error layer consumes the deterministic draws (Story 001) and the DifficultyProfile error multiplier via seams — never global lookups
- Sign conventions are the determinism contract: brake offset sign, steering signed-sample sign — fixed and documented
- The three channels (throttle/brake/steering) have separate seams and fixtures (the split rationale)
- Output clamps mirror the control contracts of `SimulationInput` (accelerateOut/brakeOut/steerOut)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 002]: target-speed product (consumed as the base)
- [Track epic]: curvature braking point derivation
- [Settings epic]: DifficultyProfile values (seam inputs)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (steering exact)**: fixture 0.04 × 1.2 × 0.5 → 0.024
- **AC-2 (line correction)**: Very Easy 0.90 → exactly 90% before steering clamp
- **AC-3 (throttle error)**: cornerThrottle reduced by throttleErrorPercent; edge: 100% error, zero throttle
- **AC-4 (brake offset)**: positive/negative offsets obey the documented sign convention; edge: zero brake error
- **AC-5 (clamps)**: zero error multiplier → no error; endpoint samples clamp correctly per channel

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/simulation/AiRivalTests.cs` — error application exact-values, clamps, sign conventions

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (draws), Story 002 (target speed), Settings (DifficultyProfile seam)
- Unlocks: Story 006 (AIInput assembly uses the applied outputs)
