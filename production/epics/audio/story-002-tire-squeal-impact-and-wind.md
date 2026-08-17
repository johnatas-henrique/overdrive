# Story 002: Tire Squeal, Impact & Wind

> **Epic**: Audio
> **Status**: Ready
> **Layer**: Core + Presentation
> **Type**: Visual/Feel
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/audio-system.md`
**Requirement**: `TR-audio-003` (tire squeal: volume rises with wear, pitch constant 1200 Hz, retrigger rises with wear)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0012: Audio System Architecture
**ADR Decision Summary**: Tire squeal uses injected `TireAudioInput` (wear, grip loss, SFX gain) + hard-corner eligibility (external classification): wear 75%, grip_loss 1.0, SFX 1.0 → volume 0.8125, normalized retrigger rate 0.775, pitch 1200 Hz; wear 0% → volume 0.25 limited to hard corners. Pitch remains CONSTANT at 1200 Hz — retrigger rate rises with wear (TR wording "frequency rises with wear" resolved: retrigger, not pitch). Wall impact: injected `WallHitEvent` at 200 km/h → one impact command ≈657 Hz (audio never detects wall contact itself). Wind: speed 250 km/h → volume ≈0.75. SFX mute routing moved to Story 004 (mixer).

**Engine**: Unity 6000.3.22f1 | **Risk**: MEDIUM
**Engine Notes**: SFX synthesis math testable in isolation; injected input seams.

**Control Manifest Rules (this layer)**:
- Required: squeal volume formula; pitch constant 1200 Hz; retrigger rises with wear
- Required: impact/wind consume injected events — audio never detects contact/speed itself

---

## Acceptance Criteria

*From audio-system.md + ADR-0012, scoped per QL-STORY-READY 2026-08-16:*

- [ ] **Squeal 75%**: injected wear 75%, grip_loss 1.0, SFX gain 1.0, squeal eligible → volume 0.8125, normalized retrigger rate 0.775, pitch 1200 Hz
- [ ] **Squeal 0%**: wear 0%, grip_loss 1.0, `HardCornerEligible=true` → volume 0.25; `HardCornerEligible=false` → no squeal command (hard-corner classification is external)
- [ ] **Pitch rule**: pitch remains constant at 1200 Hz; retrigger rate rises with wear (TR wording resolved)
- [ ] **Wall impact**: injected `WallHitEvent` at 200 km/h → one impact command ≈657 Hz; audio does not detect wall contact itself
- [ ] **Wind**: injected speed 250 km/h → wind volume ≈0.75

---

## Implementation Notes

*Derived from ADR-0012 Implementation Guidelines:*

- All inputs injected (`TireAudioInput`, `WallHitEvent`, speed input) — output command seam
- Hard-corner classification is external (VP/Tire) — audio consumes the eligibility flag
- The "frequency rises with wear" TR text is resolved: PITCH constant 1200 Hz; RETRIGGER RATE rises with wear
- SFX mute routing (engine + tire + impact + wind silenced, Music unaffected) is Story 004's mixer contract

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 004]: SFX mute routing, mixer buses
- [vehicle-physics]: wall contact detection, hard-corner classification
- [race-strategy]: grip_loss production

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-SQUEAL-75**: 75%/1.0/1.0/eligible → 0.8125 volume, 0.775 retrigger, 1200 Hz
- **AC-SQUEAL-0**: 0%/1.0/eligible → 0.25; not eligible → no command
- **AC-PITCH**: 0%/75%/100% wear → pitch stays 1200 Hz; only retrigger changes
- **AC-IMPACT**: inject WallHitEvent 200 km/h → one impact ≈657 Hz
- **AC-WIND**: speed 250 km/h → wind ≈0.75

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**:
- Visual/Feel: `production/qa/evidence/audio-sfx-evidence.md` + sign-off
- Logic: `Assets/tests/unit/audio/AudioSfxTests.cs` (squeal formula, pitch rule, impact/wind values)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (engine), race-strategy (wear/grip), vehicle-physics (wall events)
- Unlocks: Story 004 (mixer routing)
