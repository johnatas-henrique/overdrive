# Story 003a: Engine Sound — WAV & Oscillator Setup

> **Epic**: Audio
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/audio.md`
**Requirement**: `TR-AUDIO-002` — CreateSoundAsync for sample-based SFX (engine loops), cached in Map. `TR-AUDIO-006` — Car engine oscillator per active car.

**ADR Governing Implementation**: ADR-0020: Audio Engine
**ADR Decision Summary**: Hybrid engine sound — `CreateSoundAsync` for WAV base layer + `CreateSoundSourceAsync` for OscillatorNode overlay, both routing through same `sfxBus`. WAV loop is 2-4s per car class.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: `CreateSoundAsync(name, url, { loop: true, outBus })` for WAV. `CreateSoundSourceAsync(name, oscillator, { outBus, volume })` for oscillator overlay. Both route to same `sfxBus` — single volume, single crossfade. `playbackRate` property on StaticSound for runtime pitch shift.

**Control Manifest Rules (this layer)**:

- Required: P13 (Audio Engine V2 ONLY), P15 (hybrid engine sound — both on same sfxBus), P18 (engine WAV loop 2-4s)
- Forbidden: P-F3 (Never bypass Audio Engine with raw Web Audio API)

---

## Acceptance Criteria

- [ ] AC #11: Engine sound falls back to procedural-only (oscillator) if WAV sample fails to load — game continues with audible engine
- [ ] `CreateSoundAsync` loads engine WAV for each car class (V12, V10, V8 variants) with options `{ loop: true, outBus: sfxBus }`
- [ ] Loaded samples cached in `Map<string, StaticSound>` — one entry per car class
- [ ] `CreateSoundSourceAsync("engine_{class}_osc", oscillator, { outBus: sfxBus, volume: 0.3 })` creates OscillatorNode overlay per active car
- [ ] OscillatorNode uses the **externally-created AudioContext** passed to `CreateAudioEngineAsync` — `new OscillatorNode(audioContext, { type: "sawtooth" })`
- [ ] Oscillator plays continuously (`osc.start()`) and its `frequency.value` can be set at runtime (handled by Story 003b)
- [ ] If a `CreateSoundAsync` call fails for a car class, oscillator-only fallback covers that car — no crash, no missing engine sound
- [ ] Both base sample and oscillator route through the **same `sfxBus`** — `sfxBus.setVolume()` controls both

---

## Implementation Notes

_Derived from ADR-0020 Implementation Guidelines:_

```typescript
// Engine sample cache — one per car class
private _engineSamples = new Map<string, StaticSound>();
// Oscillator overlays — one per car
private _engineOverlays = new Map<string, SoundSource>();

async loadEngineSample(carClass: string, url: string): Promise<StaticSound | null> {
  try {
    const sound = await CreateSoundAsync(`engine_${carClass}`, url, {
      loop: true,
      outBus: this._sfxBus,
    });
    this._engineSamples.set(carClass, sound);
    return sound;
  } catch (e) {
    console.warn(`[Audio] Engine sample load failed for ${carClass} — using oscillator-only fallback`, e);
    return null;
  }
}

createEngineOscillator(carId: string, audioContext: AudioContext): SoundSource {
  const osc = new OscillatorNode(audioContext, { type: "sawtooth" });
  osc.frequency.value = 110; // initial — Story 003b handles runtime
  osc.start();
  const source = await CreateSoundSourceAsync(`engine_${carId}_osc`, osc, {
    outBus: this._sfxBus,
    volume: 0.3,
  });
  this._engineOverlays.set(carId, source);
  return source;
}
```

**Car class → sample mapping**:
| Class | Teams | Sample base | Pitch range |
|-------|---------------------|-------------|-------------|
| V12 | Macklen, Ferrell | v12.wav | 0.6 – 1.5 |
| V10 | Willard, Bennett | v10.wav | 0.55 – 1.45 |
| V8 | Jordash, Tyrant | v8a.wav | 0.5 – 1.4 |
| V8 | Lorris, Layton Hall | v8b.wav | 0.52 – 1.42 |

**Sample requirements**: WAV, 44.1kHz, 16-bit, mono, 2-4s loop, seamless loop point.

**Entity lifecycle**: On `entity.spawned` event, load sample (if class not yet cached) and create oscillator. On `entity.despawned`, dispose oscillator.

---

## Out of Scope

- Per-tick pitch tracking / playbackRate changes (Story 003b)
- RPM interpolation and vibrato (Story 003b)
- Engine volume modulation by throttle (Story 003b)

---

## QA Test Cases

- **AC-1**: WAV sample loads and caches correctly
  - Given: AudioEngine and sfxBus exist
  - When: `loadEngineSample("v12", "audio/engine/v12.wav")` is called
  - Then: `_engineSamples.get("v12")` returns a `StaticSound` instance with `loop=true` and `outBus` set to sfxBus
  - Edge cases: Same class loaded twice → second call returns cached entry (no duplicate load)

- **AC-2**: Fallback on load failure
  - Given: WAV file URL is invalid or network fails
  - When: `loadEngineSample("v12", "invalid.wav")` is called
  - Then: Returns `null`, no crash, `_engineSamples` has no "v12" entry, game continues
  - Edge cases: All 4 classes fail → no base engine sound, oscillator-only for all cars

- **AC-3**: OscillatorNode created via CreateSoundSourceAsync
  - Given: AudioContext exists from engine init
  - When: `createEngineOscillator("car_0", audioContext)` is called
  - Then: Returns a `SoundSource`; oscillator has `type: "sawtooth"` and `frequency: 110`
  - Edge cases: `osc.start()` is called before `CreateSoundSourceAsync` — no error

- **AC-4**: Sample and oscillator share same bus
  - Given: Both sample and oscillator exist for a car
  - When: `this._sfxBus.setVolume(0.3)` is called
  - Then: Both sample and oscillator volume decrease proportionally
  - Edge cases: sfxBus.setVolume(0) silences both; sfxBus.setVolume(1) restores both

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/audio/engine-sound-setup.test.ts` — must exist and pass.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 009 (AudioBuses must exist)
- Unlocks: Story 003b (engine sound runtime)
