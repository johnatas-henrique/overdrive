# Story 004: Mixer & Lifecycle Routing

> **Epic**: Audio
> **Status**: Ready
> **Layer**: Core + Presentation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/audio-system.md`
**Requirement**: `TR-audio-004` (Master/Music/SFX/UI through Unity Audio Mixer following Simulation/Race/Pause states)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0012: Audio System Architecture + Settings audio ports (AudioSettingsPort/AudioSettingsUpdate)
**ADR Decision Summary**: Given `AudioSettingsUpdate` (Master/Music/SFX/UI volumes) and an injected `SimulationAudioState`, the mixer seam emits observable commands for the four buses. SFX mute: engine, tire, impact, and wind silenced while Music remains unaffected. Lifecycle routing follows the documented state table via an injected mixer interface (not direct Unity mixer inspection in unit tests). Audio Settings values come from the Settings epic's audio value port.

**Engine**: Unity 6000.3.22f1 | **Risk**: MEDIUM
**Engine Notes**: Unity Audio Mixer behind an injectable mixer interface (unit tests use fakes).

**Control Manifest Rules (this layer)**:
- Required: 4 bus routing per state table; SFX mute leaves Music unaffected
- Required: settings via audio value port; mixer behind injectable interface

---

## Acceptance Criteria

*From audio-system.md + ADR-0012, scoped per QL-STORY-READY 2026-08-16 (mixer split from stings):*

- [ ] Given `AudioSettingsUpdate` + injected `SimulationAudioState` → observable commands for Master, Music, SFX, and UI buses per the documented state table
- [ ] SFX mute: engine, tire, impact, and wind silenced while Music continues (SFX mute routing — moved from Story 002)
- [ ] Lifecycle routing validated through an injected mixer interface — no direct Unity mixer inspection in unit tests
- [ ] Audio settings values consumed via the Settings epic's audio value port (Master/Music/SFX/UI)

---

## Implementation Notes

*Derived from ADR-0012 Implementation Guidelines:*

- The mixer seam (`IAudioMixerCommand`) is the unit-test boundary — real Unity Audio Mixer behind an adapter
- State table: Simulation/Race/Pause states route bus behavior (e.g. music ducks during final lap — Story 003's duck command applies here)
- SFX mute semantics: SFX bus + engine output zeroed; Music bus unaffected
- Settings volumes arrive via `AudioSettingsUpdate` from the Settings epic's typed value port

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 001-003]: synthesis/sting logic (routed here)
- [Settings epic]: audio preference persistence (consumed via port)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-BUSES**: AudioSettingsUpdate + SimulationAudioState → bus commands match the state table
- **AC-SFX-MUTE**: SFX muted → engine/tire/impact/wind silent, Music audible
- **AC-SEAM**: injected mixer interface used — no Unity mixer direct calls in unit tests
- **AC-STATE**: cycle Simulation states → routing follows the documented table; edge: Race vs Paused vs Menu

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/audio/AudioMixerTests.cs` — bus routing, SFX mute, state table with fakes
- Logic companion: `Assets/tests/unit/audio/AudioMixerTests.cs`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001-003 (engine/SFX/sting commands), Settings (audio value port)
- Unlocks: full audio composition in rig
