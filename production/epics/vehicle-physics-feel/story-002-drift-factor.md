# Story 002: Drift Factor (track-radius)

> **Epic**: Vehicle Physics — Feel & Telemetry
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/vehicle-physics.md`
**Requirement**: `TR-vp-008` (drift factor)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0002: Vehicle Physics Implementation Pattern (Validated Force Models — 2026-08-05 amendment)
**ADR Decision Summary**: Track-radius drift factor (validated 2026-08-03): while ACCELERATING above a corner's grip limit (`v > sqrt(aMax × R_ahead)`, R from the track curvature ahead), the heading may request up to `driftFactor × grip` (default 1.15) while the velocity follows only the real grip — the rear axle slides out. Below the limit F = 1 (clean line); lifting off returns F = 1 immediately (tuck-in). `driftHeadBoost` (default 1.40) makes heading ask F × boost while velocity follows only F — the gap is the slip angle. 12% transition band `InverseLerp(vLimit, vLimit × 1.12)`. `track.GetCornerRadiusAhead(pos, driftLookahead=40m)`.

**Engine**: Unity 6000.3.22f1 | **Risk**: HIGH
**Engine Notes**: Pure C# math. The curvature provider is a seam (`ICornerRadiusProvider`) — Track System implements the real curvature; this story consumes the seam.

**Control Manifest Rules (this layer)**:
- Required: F = 1.0 when v ≤ sqrt(aMax × R_ahead); F = driftFactor (1.15) when above limit and throttle > 0; F = 1.0 immediately on lift-off
- Required: F applied to BOTH consumers — heading yaw request (`F × driftHeadBoost × gripCeiling`), velocity rotation rate (`F × gripCeiling`)
- Required: `driftHeadBoost` (1.40) creates the heading-vs-velocity slip gap; 12% transition band; `driftLookahead = 40m`; knobs are global tuning values

---

## Acceptance Criteria

*From ADR-0002 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] `ICornerRadiusProvider.GetCornerRadiusAhead(position, 40m)` seam: this story consumes the seam (a fake provider in tests); Track System implements the real curvature later
- [ ] Exact factor behavior: v ≤ vLimit → F = 1.0; transition through vLimit..vLimit×1.12 via `InverseLerp`; v ≥ vLimit×1.12 AND throttle > 0 → F = 1.15; throttle ≤ 0 → F = 1.0 immediately (same evaluation)
- [ ] Heading factor = `F × driftHeadBoost` **only while drifting**; velocity factor = F always; `driftHeadBoost` must NOT apply below the drift threshold (clean-line driving creates no artificial slip)
- [ ] Global defaults validated at construction: driftFactor 1.15, driftHeadBoost 1.40, driftLookahead 40m — read-only after race initialization
- [ ] Provider contract for edge inputs defined: straight sections (large-radius sentinel), zero/negative/NaN/infinity radii — deterministic fallback (no drift) documented and tested

---

## Implementation Notes

*Derived from ADR-0002 Implementation Guidelines (Validated Force Models):*

- `vLimit = sqrt(aMax × R_ahead)` — aMax is the car's lateral capacity (maxLateralG from grip_base); R_ahead from the seam
- F MUST be applied to BOTH consumers — F on heading alone causes understeer (velocity follows only real grip, slip grows too slowly)
- Without `driftHeadBoost`, equal F on both consumers produces zero slip (no drift) — the boost IS the slip-angle mechanism
- Transition band: `InverseLerp(vLimit, vLimit × 1.12)` smooths F between clean line and drift
- The provider contract: straight sentinel = large radius → vLimit large → F = 1; invalid radii (zero/negative/NaN/inf) → treat as straight (F = 1), never crash

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Track epic]: real `GetCornerRadiusAhead` implementation (the seam's provider)
- [vehicle-physics-dynamics Story 004]: ComputeMaxYaw/gripCeiling application (consumes F)
- [Story 001]: lift-off bonus (tuck-in shares the F = 1.0-on-lift-off return path — the two modifiers compose in the consumers)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (seam consumption)**: fake provider returning radius R → provider receives current position + exactly 40m lookahead; edge: straight sentinel, provider called once per evaluation
- **AC-2 (threshold + band)**: fixed aMax and R → factors at below/at/mid/above the 12% band are 1.0 / interpolated / midpoint / 1.15; edge: exact threshold boundaries
- **AC-3 (lift-off clears drift)**: above limit, throttle → 0 → F = 1.0 in the same evaluation; edge: throttle epsilon above/below zero
- **AC-4 (heading vs velocity)**: drift-active and inactive fixtures → inactive heading factor 1.0; active heading `F × 1.40`; velocity always F; edge: transition-band values
- **AC-5 (defaults)**: construction reads 1.15 / 1.40 / 40m; edge: read-only after race init
- **AC-6 (provider edge)**: zero/negative/NaN/inf radius → F = 1.0 deterministic fallback; edge: sentinel straight

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/simulation/VehiclePhysicsTests.cs` — drift factor boundaries, band, head-boost gating
- Integration companion: `Assets/tests/integration/simulation/VehiclePhysicsTests.cs` (seam consumption with fake provider)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: vehicle-physics-dynamics Story 001 (grip/gripCeiling), Story 004 (ComputeMaxYaw)
- Unlocks: Story 003 (drift consumes velocity), Story 005 (rig drift verification)
