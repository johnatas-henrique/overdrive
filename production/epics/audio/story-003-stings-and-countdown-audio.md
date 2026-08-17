# Story 003: Stings & Countdown Audio

> **Epic**: Audio
> **Status**: Ready
> **Layer**: Core + Presentation
> **Type**: Visual/Feel
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/audio-system.md`
**Requirement**: `TR-audio-002` (4 music stings + duck), countdown beeps/GO
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0012: Audio System Architecture
**ADR Decision Summary**: Given injected events RaceStart, FinalLapStarted, Finished, PitEntered → emit the corresponding named sting command (audio never derives these from RSM/Simulation/Pit state). FinalLapStarted → final-lap sting + music-bus duck −6 dB lasting 3-5s. Sting priority: two stings within the priority window → higher-priority plays, lower discarded (boundary at exactly 2.0s and already-active defined). Countdown: five injected CountdownLightChanged events + CountdownGo → five beep commands in order + GO sting. The 60 Hz one-second cadence validation is Simulation/Grid's (countdown story).

**Engine**: Unity 6000.3.22f1 | **Risk**: MEDIUM
**Engine Notes**: Event-consumption state machine; output command seam.

**Control Manifest Rules (this layer)**:
- Required: sting commands from injected events (never derived); priority discards lower
- Required: countdown beeps from injected light events — cadence owned by Simulation/Grid

---

## Acceptance Criteria

*From audio-system.md + ADR-0012, scoped per QL-STORY-READY 2026-08-16 (countdown cadence moved to Simulation/Grid):*

- [ ] Injected `RaceStart` → Race Start sting; `FinalLapStarted` → Final Lap sting; `Finished` → Finish sting; `PitEntered` → Pit Entry sting (each exactly one command)
- [ ] `FinalLapStarted` → final-lap sting + music-bus duck command −6 dB lasting 3-5s
- [ ] Two sting events within the priority window → higher-priority sting plays, lower discarded; boundary behavior at exactly 2.0s and for an already-active sting defined
- [ ] Five injected `CountdownLightChanged` events followed by `CountdownGo` → five beep commands in order, then the GO sting
- [ ] The "five seconds at 60 Hz" one-second cadence validation is NOT audio's — it belongs to the Simulation/Grid countdown story

---

## Implementation Notes

*Derived from ADR-0012 Implementation Guidelines:*

- Sting mapping is a pure event→command state machine — no external state polling
- Duck: −6 dB on the music bus for 3-5s, applied via the mixer command seam (Story 004 owns the bus implementation)
- Countdown beeps: consumed as injected light-change events (the cadence timing is the countdown system's domain)
- Priority window: the defined interval; boundary (exactly 2.0s) and already-active-sting behavior are explicit test cases

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [race-flow]: countdown cadence, RSM events (consumed)
- [Story 004]: mixer bus implementation (duck applied through the command seam)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-MAPPING**: inject each named event with test clips → correct sting only, no external state polling
- **AC-DUCK**: FinalLapStarted → sting + BGM duck 6 dB for 3-5s
- **AC-PRIORITY**: two stings at controlled timestamps → higher plays, lower discarded; edge: exactly 2.0s, already-active sting
- **AC-COUNTDOWN**: five light events + GO → exactly five beeps in order, then GO sting

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**:
- Visual/Feel: `production/qa/evidence/audio-stings-evidence.md` + sign-off
- Logic: `Assets/tests/unit/audio/AudioStingTests.cs` (mapping state machine, priority, countdown order)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: race-flow (RSM events, countdown), Story 001 (engine), Story 004 (mixer seam)
- Unlocks: full race audio composition
