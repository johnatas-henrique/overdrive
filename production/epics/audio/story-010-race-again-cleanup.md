# Story 010: Race Again Cleanup

> **Epic**: Audio
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/audio.md`
**Requirement**: `TR-AUDIO-008` — Race Again: stopAll(), dispose and re-create engine oscillator nodes per car; SoundSource samples disposed from cache.

**ADR Governing Implementation**: ADR-0020: Audio Engine
**ADR Decision Summary**: Cleanup for Race Again lifecycle. Stop all active sounds, dispose oscillator nodes, clear sample cache. Re-creation follows same init path as first race. Reentrant subscription handling — `off()` before `on()` to prevent duplicate handlers.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: `StaticSound.dispose()` releases AudioBuffer. `SoundSource` (OscillatorNode) disposal: oscillator must be `.stop()`ed and `.disconnect()`ed, then the `CreateSoundSourceAsync` wrapper disposed. Cache clear is internal Map reset.

**Control Manifest Rules (this layer)**:

- Required: P13 (Audio Engine V2 ONLY), P15 (hybrid engine sound — dispose both layers)

---

## Acceptance Criteria

- [ ] `AudioManager.cleanupRace()` stops all active sounds on all buses — `stopAll()` or per-sound stop
- [ ] All OscillatorNode overlays are stopped, disconnected, and disposed — no dangling audio nodes
- [ ] Engine WAV sample cache (`Map<string, StaticSound>`) is cleared — length 0 after cleanup
- [ ] On `initRace()` (called by Single Race on Race Again), samples are re-loaded, oscillators are re-created
- [ ] Event Bus subscriptions are reentrant — `off()` before `on()` prevents duplicate handler registration
- [ ] If `stopAll()` is called during an active `setVolume` ramp, the ramp is interrupted immediately (sound cuts, no mid-fade hang)
- [ ] GSM-driven: cleanup called on `gsm.state.exited(from: PostRace)` or at start of `PreRace` entry

---

## Implementation Notes

_Derived from ADR-0020 Implementation Guidelines:_

```typescript
cleanupRace(): void {
  // Stop all sounds
  this._engineSamples.forEach((sample) => sample.stop());
  this._tireSqueal?.stop();
  this._windSource?.setVolume(0);
  this._pitAmbient?.stop();

  // Dispose oscillator overlays
  this._engineOverlays.forEach((source, carId) => {
    source.dispose(); // stops + disconnects the underlying OscillatorNode
  });
  this._engineOverlays.clear();

  // Clear sample cache
  this._engineSamples.clear();

  // Reentrant event subscriptions
  this._subscriptions.forEach((sub) => sub.unsubscribe());
  this._subscriptions = [];
}

async initRace(): Promise<void> {
  // Re-subscribe (off() before on() is called by each init method)
  await this._initEngineSounds();
  await this._initTireSqueal();
  await this._initWindSound(this._audioEngine.audioContext);
  // ... re-register subscriptions
}
```

**Dispose vs Stop**: `SoundSource.dispose()` handles both stopping the oscillator and disconnecting it. `StaticSound` has `dispose()` which releases the AudioBuffer. However, for Race Again, we only need to `stop()` samples (they stay cached for potential reuse within same race session) but `dispose()` oscillators (they can't be reused).

**Subscription reentrancy**: Each `_init*` method calls `this._eventBus.on(...)` which returns a `Subscription`. On cleanup, all subscriptions are unsubscribed. On re-init, new subscriptions are created. This prevents the "doubled event handler" bug on Race Again.

---

## Out of Scope

- Cleanup on game exit / full dispose (handled by engine lifecycle)
- Audio preferences persistence save (handled by Story 009)

---

## QA Test Cases

- **AC-1**: stopAll silences all buses
  - Given: Menu music and engine sounds are actively playing
  - When: `cleanupRace()` is called
  - Then: All AudioBus instances report volume at or near 0; no sound is audible/playing
  - Edge cases: `stopAll` called during active crossfade ramp → ramp is interrupted, not left mid-fade

- **AC-2**: OscillatorNode is disposed and re-created
  - Given: Active OscillatorNode overlay for car_0
  - When: `cleanupRace()` is called
  - Then: `_engineOverlays` has length 0; old OscillatorNode is stopped
  - When: `initRace()` is called
  - Then: New OscillatorNode exists in `_engineOverlays`
  - Edge cases: Dispose called while oscillator is actively playing → no audio glitch (pop/click acceptable)

- **AC-3**: Sample cache cleared and re-loaded
  - Given: Engine WAV samples loaded (4 classes)
  - When: `cleanupRace()` is called
  - Then: `_engineSamples.size === 0`
  - When: `initRace()` is called
  - Then: Samples are re-loaded; `_engineSamples.size === 4`
  - Edge cases: Sample fails to load on re-init → fallback to procedural-only still works

- **AC-4**: Reentrant subscriptions — no duplicate handlers
  - Given: AudioManager subscribed to 8 events during previous race
  - When: `cleanupRace()` unsubscribes all, then `initRace()` re-subscribes
  - Then: A single event fires the handler exactly once (not twice)
  - Edge cases: `unsubscribe()` on an already-unsubscribed handler doesn't throw

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/audio/race-again-cleanup_test.ts` OR playtest doc.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 008 (menu music & event sounds)
- Unlocks: None (final story in Audio epic)
