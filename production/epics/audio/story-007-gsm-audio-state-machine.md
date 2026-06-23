# Story 007: GSM Audio State Machine & Crossfade

> **Epic**: Audio
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/audio.md`
**Requirement**: `TR-AUDIO-003` — Four AudioBus instances (used for crossfade). `TR-AUDIO-004` — GSM event subscription: play music on Menu/PostRace, stop race sounds on pause, resume on unpause.

**ADR Governing Implementation**: ADR-0020: Audio Engine
**ADR Decision Summary**: Subscribe to `gsm.state.entered` and `gsm.state.exited`. 500ms linear crossfade via `setVolume` with `AudioParameterRampShape.Linear`. Bus-level for broad transitions, sound-level for per-source transitions. Previous ramp is automatically cancelled when a new `setVolume` is called.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: `setVolume(target, { duration, shape })` — shape from `AudioParameterRampShape.Linear`. Duration in seconds (0.5 = 500ms). Ramp cancellation: calling `setVolume` while a ramp is in progress starts a new ramp immediately.

**Control Manifest Rules (this layer)**:

- Required: P16 (500ms linear crossfade between GSM states), P14 (4 AudioBuses)

---

## Acceptance Criteria

_From GDD `design/gdd/audio.md`:_

- [ ] AC #8: Menu music plays during Menu state, stops during Racing — driven by GSM state subscription
- [ ] AC #9: GSM state change triggers 500ms crossfade — no abrupt audio cuts
- [ ] Full GSM→Audio transition table implemented (see Implementation Notes)
- [ ] Bus-level crossfade: `sfxBus.setVolume(target, { duration: 0.5, shape: Linear })` for broad transitions (e.g., Racing→Paused)
- [ ] Sound-level crossfade: per-sound `setVolume` for individual source transitions (e.g., menu music fade out, engine idle fade in)
- [ ] Rapid state change: current ramp cancels immediately, new ramp starts — no audible artifacts
- [ ] Paused state: all race sounds (`sfxBus`) fade to 0.2 over 500ms; UI sounds (`uiBus`) remain active
- [ ] PostRace state: race sounds fade out over 500ms; results fanfare plays once on `musicBus`
- [ ] Loading state: silence; AudioManager.init() completes (delegated to Story 001)

---

## GSM → Audio Transition Table

| From        | To       | musicBus                            | sfxBus                        | uiBus | ambientBus             |
| ----------- | -------- | ----------------------------------- | ----------------------------- | ----- | ---------------------- |
| Loading     | Menu     | Music → fade in (500ms)             | —                             | —     | —                      |
| Menu        | PreRace  | Music → fade out (500ms)            | Engine idle → fade in (500ms) | —     | —                      |
| PreRace     | Racing   | —                                   | Full engine + tire (current)  | —     | Wind → fade in (500ms) |
| Racing      | Paused   | —                                   | Fade to 0.2 (500ms)           | —     | Fade to 0 (500ms)      |
| Paused      | Racing   | —                                   | Fade to 1.0 (500ms)           | —     | Wind → fade in (500ms) |
| Racing      | PostRace | Fanfare → play once                 | Fade to 0 (500ms)             | —     | Fade to 0 (500ms)      |
| PostRace    | Menu     | Music → fade in (500ms)             | —                             | —     | —                      |
| _Any state_ | Loading  | All buses → fade to 0 (fast, 100ms) |                               |       |                        |

Transitions not listed: no audio action required (state is not audio-relevant, or sounds continue unchanged).

---

## Implementation Notes

_Derived from ADR-0020 Implementation Guidelines:_

```typescript
import { AudioParameterRampShape } from "@babylonjs/core/AudioV2/audioParameter";

private _currentGsmState: GameState | null = null;
private _subscription: Subscription;

init(): void {
  this._subscription = this._eventBus.on("gsm.state.entered", (payload) => {
    this._handleStateTransition(payload.to);
  });
}

private _handleStateTransition(to: GameState): void {
  const from = this._currentGsmState;
  this._currentGsmState = to;

  const transition = this._transitionTable[from]?.[to];
  if (!transition) return;

  const duration = from === null ? 0 : 0.5; // no fade on initial state

  if (transition.musicBus) this._applyBusTransition(this._musicBus, transition.musicBus, duration);
  if (transition.sfxBus) this._applyBusTransition(this._sfxBus, transition.sfxBus, duration);
  if (transition.uiBus) this._applyBusTransition(this._uiBus, transition.uiBus, duration);
  if (transition.ambientBus) this._applyBusTransition(this._ambientBus, transition.ambientBus, duration);
  if (transition.oneShotMusic) this._musicFanfare.play({ volume: 0.5 });
}

private _applyBusTransition(bus: AudioBus, target: number | null, duration: number): void {
  if (target === null) return; // no change
  bus.setVolume(target, {
    duration,
    shape: AudioParameterRampShape.Linear,
  });
}
```

**Ramp cancellation**: `setVolume` automatically cancels any in-progress ramp. No manual `cancel()` call needed. GDD Edge Case #4 verified: rapid state changes (e.g., Menu→PreRace→Racing) cancel mid-flight without artifacts.

---

## Out of Scope

- Music streaming creation and one-shot sounds (Story 008 — this story only drives volume/state of existing sounds)
- Engine RPM tracking (Story 003b)
- Config-driven volumes (Story 009)

---

## QA Test Cases

- **AC-1**: Menu→PreRace transition crossfade
  - Given: Menu music is playing on musicBus at volume 0.5
  - When: `gsm.state.entered(to: "PreRace")` fires
  - Then: musicBus.setVolume(0, { duration: 0.5 }); sfxBus.setVolume(0.7, { duration: 0.5 })
  - Edge cases: Verify both ramps complete to target within 500ms ± acceptable tolerance

- **AC-2**: Racing→Paused muffle
  - Given: Engine and tire sounds playing on sfxBus at volume 0.7
  - When: `gsm.state.entered(to: "Paused")` fires
  - Then: sfxBus.setVolume(0.2, { duration: 0.5 }); ambientBus.setVolume(0, { duration: 0.5 })
  - Edge cases: Double pause → second call is no-op (already at 0.2)

- **AC-3**: Rapid state change cancels previous ramp
  - Given: Menu→PreRace 500ms ramp is mid-flight (~250ms in)
  - When: PreRace→Racing fires immediately
  - Then: Previous musicBus ramp cancels; new ramp (no musicBus change) starts unobstructed
  - Edge cases: A→B→C in rapid succession — verify no stuck volume, no audio gap

- **AC-4**: PostRace fanfare plays once
  - Given: All race sounds active
  - When: `gsm.state.entered(to: "PostRace")` fires
  - Then: sfxBus fades to 0 over 500ms; `fanfare.play()` called exactly once
  - Edge cases: Re-entering PostRace on "Race Again" screen → fanfare fires again (allowed)

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/audio/gsm-audio-state-machine_test.ts` OR playtest doc.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 006 (pit/wind ambient — establishes ambientBus and event patterns)
- Unlocks: Story 008
