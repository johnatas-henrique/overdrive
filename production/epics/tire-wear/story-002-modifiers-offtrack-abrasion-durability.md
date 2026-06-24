# Story 002: Tire Wear Modifiers (Off-Track, Abrasion, Durability)

> **Epic**: Tire Wear
> **Status**: Ready
> **Layer**: Core (slot #6 — pipeline)
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/tire-wear.md`
**Requirement**: `TR-TIRE-005`, `TR-TIRE-006`, `TR-TIRE-007`
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0012: Tire Model
**ADR Decision Summary**: Off-track driving applies 2.0× wear multiplier. `trackAbrasion` is a global constant — same for all cars; per-team durability upgrades create strategic spread. Cornering stat maps to wear rate multiplier (better cornering = slower wear).

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript math — zero engine API usage. Verified via `tsc --noEmit`.

**Control Manifest Rules (this layer)**:

- Required: C36 — tire degradation formula (modifiers are multiplicative factors)
- Required: C37 — off-track = 2.0× wear multiplier
- Required: F19 — slot N reads from slot N-1, no cross-layer upward imports
- Guardrail: C-G10 — Tire < 0.001ms/car/tick

---

## Acceptance Criteria

_From GDD `design/gdd/tire-wear.md`, scoped to this story:_

- [ ] AC-1: When `offTrack = true`, `tireLoad` is multiplied by `offTrackMult` (default 2.0)
- [ ] AC-2: When `offTrack = false`, no off-track multiplier is applied (normal wear)
- [ ] AC-3: `trackAbrasion` config value scales degradation linearly — 0.5 = half wear, 2.0 = double wear
- [ ] AC-4: `efficiencyRate` from durability upgrade level follows the table:
  - L1: 1.0, L2: 0.9, L3: 0.8, L4: 0.7, L5: 0.6
- [ ] AC-5: Cornering stat maps to wear rate multiplier via formula: `corneringWearMult = 1.0 - (corneringStat / 100)` where `corneringStat` is a team stat in range [0..100]. Default `corneringStat = 50` → `corneringWearMult = 0.5`. Lower multiplier = slower wear.
- [ ] AC-6: Multiple modifiers combine multiplicatively in the degradation formula: `degradation = tireLoad × baseDegradationRate × efficiencyRate × corneringWearMult × trackAbrasion × dt`

---

## Implementation Notes

_Derived from ADR-0012 Implementation Guidelines:_

- `offTrackMult` is part of `TireConfig` (loaded from Data & Config Manager under `tire.*`)
- `trackAbrasion` is a global constant in `TireConfig`, same value for all cars — per-team durability upgrades create strategic spread, not track-specific settings
- `efficiencyRate` is set at `registerCar(carId, durabilityLevel)` time from the `upgradeL1toL5` array
- `corneringStat` per team loaded during car registration from team config; maps to `corneringWearMult` via formula
- All modifiers are multiplicative — order does not matter (commutative multiplication)
- Implementation builds on Story 001's `calculate(dt)` — this story wires the modifier inputs

```typescript
function computeCorneringWearMult(corneringStat: number): number {
  // corneringStat in range [0..100], default 50
  // Lower multiplier = slower wear, higher cornering stat = better durability
  return 1.0 - corneringStat / 100;
}

// Inside calculate(dt):
const corneringWearMult = computeCorneringWearMult(teamCorneringStats[carId]);
const effectiveRate = efficiencyRate * corneringWearMult;
const loadMultiplier = offTrack ? offTrackMult : 1.0;
const tireLoad =
  (lateralG * latFactor + accelG * accelFactor + brakeG * brakeFactor) *
  loadMultiplier;
const degradation =
  tireLoad * baseDegradationRate * effectiveRate * trackAbrasion * dt;
```

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 001]: Core degradation formula, state management, per-car tracking
- [Story 003]: `car.tire_blown` event emission, `resetTires`, and race lifecycle

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1 (offTrack multiplier applied)**:
  - Given: "car-1" registered, `offTrackMult = 2.0`, `latFactor = 1.5`, `lateralG = 2.0`, `accelG = brakeG = 0`
  - When: `calculate(0.016)` with `offTrack = true`
  - Then: effective tireLoad = `(2.0 × 1.5) × 2.0 = 6.0` (vs 3.0 without off-track)

- **AC-2 (offTrack = false, normal wear)**:
  - Given: Same setup as AC-1
  - When: `calculate(0.016)` with `offTrack = false`
  - Then: effective tireLoad = `2.0 × 1.5 = 3.0` (no multiplier)

- **AC-3 (trackAbrasion scaling)**:
  - Given: "car-1" registered, fixed loads producing unmodified degradation D
  - When: `trackAbrasion = 0.5`
  - Then: degradation = D × 0.5
  - When: `trackAbrasion = 2.0`
  - Then: degradation = D × 2.0

- **AC-4 (efficiencyRate upgrade table)**:
  - Given: "car-1" registered with durabilityLevel = 1
  - Then: `efficiencyRate = 1.0`
  - Given: "car-2" registered with durabilityLevel = 5
  - Then: `efficiencyRate = 0.6`
  - Edge case: durabilityLevel < 1 or > 5 — clamp to valid range

- **AC-5 (cornering stat mapping)**:
  - Given: "car-1" with `corneringStat = 50` (default)
  - Then: `corneringWearMult = 1.0 - 50/100 = 0.5`
  - Given: "car-2" with `corneringStat = 80` (better cornering)
  - Then: `corneringWearMult = 1.0 - 80/100 = 0.2` (slower wear)
  - Given: "car-3" with `corneringStat = 20` (worse cornering)
  - Then: `corneringWearMult = 1.0 - 20/100 = 0.8` (faster wear)

- **AC-6 (multiplicative combination)**:
  - Given: "car-1" registered, `offTrackMult = 2.0`, `trackAbrasion = 1.5`, `efficiencyRate = 0.8`, `corneringStat = 50`
  - When: `calculate(0.016)` with `lateralG = 1.0`, `offTrack = true`
  - Then: total modifier = `2.0 × 1.5 × 0.8 × 0.5 = 1.2`; degradation = `tireLoad × baseRate × 1.2 × dt`

- **Edge cases**:
  - `corneringStat = 0` → `corneringWearMult = 1.0` (maximum wear rate)
  - `corneringStat = 100` → `corneringWearMult = 0.0` (zero wear from cornering — theoretical max)
  - `offTrackMult = 1.0` → behaves identically to on-track
  - `trackAbrasion = 0` → zero degradation from abrasion factor (dev/test mode, distinct from baseDegradationRate=0)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/tire-wear/tire-modifiers.test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (Core Tire Degradation Engine) — builds on `registerCar`, `calculate`, `TireState`
- Unlocks: Story 003 (Tire Blowout, resetTires, and Race Lifecycle)
