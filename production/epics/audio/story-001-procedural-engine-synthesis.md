# Story 001: Procedural Engine Synthesis

> **Epic**: Audio
> **Status**: Ready
> **Layer**: Core + Presentation
> **Type**: Visual/Feel
> **Manifest Version**: 2026-08-05
> **Estimate**: 2.0h

## Context

**GDD**: `design/gdd/audio-system.md`
**Requirement**: `TR-audio-001` (procedural engine), `TR-audio-005` (IEngineSoundProvider)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0012: Audio System Architecture (IEngineSoundProvider seam) + ADR-0015 (CarAudioProfile)
**ADR Decision Summary**: Procedural two-oscillator engine derives base frequency from RPM × EngineCylinders / 120, then applies the gear ratio: raw fundamental = 8000 × 10 / 120 = 666.67 Hz; raw final pitch target = 666.67 × 0.85 (4th gear) = 566.67 Hz (≈567 Hz — the FINAL PITCH TARGET, not base frequency); harmonic 1333.33 Hz. `IEngineSoundProvider` permits procedural/sample replacement with identical parameter snapshots. CarAudioProfile (cylinders, base pitch 0.8-1.2, exhaust note) consumed through the input seam — validation belongs to Car Definition. Fuel events: FuelEmptyEntered → amplitude zero in 0.4-0.6s; FuelRefilled → returns over 0.2-0.4s; FuelCriticalEntered → fuel_critical_stinger once per threshold-entry cycle.

**Engine**: Unity 6000.3.22f1 | **Risk**: MEDIUM
**Engine Notes**: Procedural synthesis math testable in isolation; provider seam for replacement.

**Control Manifest Rules (this layer)**:
- Required: base frequency = RPM × cylinders / 120; gear ratio applied; final pitch ≈567 Hz at 8000/10/0.85
- Required: IEngineSoundProvider seam (procedural/sample replacement, safe parameter passing)

---

## Acceptance Criteria

*From audio-system.md + ADR-0012, scoped per QL-STORY-READY 2026-08-16:*

- [ ] **Raw synthesis output**: injected RPM 8000, cylinders 10, fuel factor 1.0, 4th-gear ratio 0.85 → raw fundamental 666.67 Hz, raw final pitch target 566.67 Hz (≈567 Hz), harmonic 1333.33 Hz
- [ ] **Provider replacement**: replacing the procedural provider with a sample provider changes only the injected `IEngineSoundProvider`; the AudioSystem contract and parameter snapshot remain unchanged
- [ ] **Profile consumption**: Audio receives cylinders, base-pitch multiplier, and exhaust-note enum through its input seam and passes them unchanged to the provider (validation of 6-12/0.8-1.2/enum belongs to Car Definition Story 004)
- [ ] **Fuel empty**: injected `FuelEmptyEntered` → engine amplitude reaches zero in 0.4-0.6s (observable envelope/output command); repeated empty snapshots do not restart the engine
- [ ] **Fuel refill**: injected `FuelRefilled` with fuel above zero → amplitude returns over 0.2-0.4s
- [ ] **Critical stinger**: injected `FuelCriticalEntered` → one `fuel_critical_stinger` command; repeated below-critical snapshots emit none; after `FuelRecovered`, the next critical event may emit once

---

## Implementation Notes

*Derived from ADR-0012 Implementation Guidelines:*

- The story calls 567 Hz the FINAL PITCH TARGET (after gear ratio), not the base frequency
- Design gap (documented): ADR/GDD do not specify how EngineBasePitch and ExhaustNote alter oscillator parameters — the mapping must be defined at implementation (documented in the story as an open implementation decision)
- All inputs injected at seams — no direct Fuel/CarDefinition reads
- Two-oscillator: fundamental + harmonic (2×)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [car-definition-data Story 004]: CarAudioProfile validation
- [Story 004]: mixer routing (SFX mute)
- [fuel epic]: FuelEmpty/Critical events (consumed via seam)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-RAW**: 8000/10/0.85/fuel 1.0 → 566.67 Hz target, 1333.33 harmonic (spectrum/debug values; no smoothing/clipping in raw)
- **AC-PROVIDER**: procedural → sample provider with identical input → no AudioSystem API change; both receive the same safe snapshot
- **AC-PROFILE**: cylinders/base-pitch/exhaust passed unchanged to provider
- **AC-FUEL-EMPTY**: inject FuelEmptyEntered → silence in 0.4-0.6s, no instant cut, no restart on repeated snapshots
- **AC-FUEL-REFILL**: inject FuelRefilled → engine returns 0.2-0.4s
- **AC-STINGER**: critical → one stinger; repeated critical snapshots → none; recovery → next critical may emit once

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**:
- Visual/Feel: `production/qa/evidence/audio-engine-evidence.md` + spectrum/sign-off
- Logic: `Assets/tests/unit/audio/AudioSynthesisTests.cs` (raw frequency math, envelope commands, stinger state)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: car-definition (CarAudioProfile seam), race-strategy (fuel events)
- Unlocks: Story 002 (squeal/impact/wind), Story 004 (mixer routing)
