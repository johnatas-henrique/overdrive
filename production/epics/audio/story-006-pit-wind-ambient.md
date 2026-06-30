# Story 006: Pit Lane & Wind Ambient

> **Epic**: Audio
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/audio.md`
**Requirement**: `TR-AUDIO-005` — Race event subscription: pit.entry, pit.exit (this story covers the pit + wind ambient portion).

**ADR Governing Implementation**: ADR-0020: Audio Engine
**ADR Decision Summary**: Ambient sounds on `ambientBus` (volume 0.4). Pit lane ambient loop fades in/out on pit entry/exit events. Wind volume proportional to speed, routed through low-pass filter. Bus-level `setVolume` for fade transitions.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: `CreateSoundAsync` with `outBus: ambientBus`. `setVolume(target, { duration })` for fades. Wind requires a low-pass filter approach — can use `AudioEngine.audioContext.createBiquadFilter()` connected through `CreateSoundSourceAsync`.

**Control Manifest Rules (this layer)**:

- Required: P14 (4 AudioBuses — ambientBus at 0.4), P13 (Audio Engine V2 ONLY)
- Forbidden: P-F3 (Never bypass Audio Engine with raw Web Audio API — wind filter exception verified: filter node routes through CreateSoundSourceAsync)

---

## Acceptance Criteria

_From GDD `design/gdd/audio.md`:_

- [ ] AC #7: Pit lane ambient fades in on `pit.entry` event, fades out on `pit.exit` event
- [ ] Pit entry ambient fades in over 1s (linear ramp via `setVolume(target, { duration: 1.0 })`)
- [ ] Pit exit ambient fades out over 1s (linear ramp via `setVolume(0, { duration: 1.0 })`)
- [ ] Pit entry plays "whoosh/doppler" one-shot (~0.5s, volume 0.5) on `pit.entry` event
- [ ] Wind volume: `windVolume = clamp((speed - windOnsetSpeed) / (maxSpeed - windOnsetSpeed), 0, 1) × windMaxVolume`
- [ ] Wind low-pass filter cutoff increases linearly with speed: 200Hz at onset speed → 2000Hz at max speed
- [ ] Both pit ambient and wind sound route through `ambientBus`
- [ ] Direct reads: `physics.speed` per tick for wind

---

### ⚠️ Pre-Implementation Clarifications Needed

1. **`maxSpeed`** in wind formula: not a tuning knob. Use physics max speed constant (e.g., 360 km/h) or `ConfigManager.get("physics.maxSpeed")`.
2. **Wind filter node**: `BiquadFilterNode` must be connected through `CreateSoundSourceAsync` to stay within Babylon's audio pipeline — not raw Web Audio directly.

---

## Implementation Notes

_Derived from ADR-0020 Implementation Guidelines:_

```typescript
// Pit ambient
private _pitAmbient: StaticSound | null = null;
private _pitWhoosh: StaticSound | null = null;

async initPitSounds(): Promise<void> {
  this._pitAmbient = await CreateSoundAsync("pit_ambient", "audio/ambient/pit_loop.wav", {
    loop: true,
    outBus: this._ambientBus,
    autoplay: false,
  });
  this._pitWhoosh = await CreateSoundAsync("pit_whoosh", "audio/sfx/pit_whoosh.wav", {
    outBus: this._ambientBus,
  });
}

// Event subscriptions
onPitEntry(): void {
  this._pitAmbient.setVolume(ConfigManager.get<number>("audio.ambientVolume"), { duration: 1.0 });
  this._pitWhoosh.play({ volume: 0.5 });
}
onPitExit(): void {
  this._pitAmbient.setVolume(0, { duration: 1.0 });
}

// Wind
private _windSound: StaticSound | null = null;
private _windFilter: BiquadFilterNode | null = null;

async initWindSound(audioContext: AudioContext): Promise<void> {
  this._windFilter = audioContext.createBiquadFilter();
  this._windFilter.type = "lowpass";
  this._windFilter.frequency.value = 200;

  const windOsc = new OscillatorNode(audioContext, { type: "sawtooth" });
  windOsc.frequency.value = 30; // low rumble
  windOsc.start();
  windOsc.connect(this._windFilter);

  this._windSource = await CreateSoundSourceAsync("wind", this._windFilter, {
    outBus: this._ambientBus,
    volume: 0,
    loop: true,
  });
}

updateWind(speedKmh: number): void {
  const onset = ConfigManager.get<number>("audio.windOnsetSpeed"); // 100 km/h
  const maxSpeed = 360; // or physics constant
  const maxVol = ConfigManager.get<number>("audio.windMaxVolume"); // 0.3

  if (speedKmh < onset) {
    this._windSource.setVolume(0);
    return;
  }

  const volume = clamp((speedKmh - onset) / (maxSpeed - onset), 0, 1) * maxVol;
  this._windSource.setVolume(volume);

  // Filter cutoff increases with speed
  const cutoff = 200 + (speedKmh - onset) / (maxSpeed - onset) * 1800;
  this._windFilter.frequency.value = cutoff;
}
```

---

## Out of Scope

- GSM-driven track switching for ambient (Story 007 — handles bus-level crossfade)
- Wind on menu screens (wind only active during Racing state)

---

## QA Test Cases

- **AC-1**: Pit entry fades in
  - Given: `pitAmbient` is at volume 0, not playing
  - When: `onPitEntry()` is called
  - Then: `pitAmbient.play()` starts the loop; `setVolume(ambientVolume, { duration: 1.0 })` ramps volume over 1s
  - Edge cases: Consecutive `pit.entry` events without exit → second call is idempotent (sound already fading in)

- **AC-2**: Pit exit fades out
  - Given: `pitAmbient` is playing at ambientVolume (0.4)
  - When: `onPitExit()` is called
  - Then: `setVolume(0, { duration: 1.0 })` ramps to 0 over 1s
  - Edge cases: Exit without entry → no-op (sound was never started)

- **AC-3**: Wind volume proportional to speed
  - Given: `windOnsetSpeed = 100`, `maxSpeed = 360`, `maxWindVolume = 0.3`
  - When: `speed = 250 km/h`
  - Then: `windVolume = clamp((250-100)/(360-100), 0, 1) × 0.3 = 0.173`
  - Edge cases: `speed < onset` → volume = 0. `speed = maxSpeed` → volume = 0.3

- **AC-4**: Wind filter cutoff increases with speed
  - Given: `windOnsetSpeed = 100`, `maxSpeed = 360`
  - When: `speed = 230 km/h`
  - Then: `cutoff = 200 + ((230-100)/(360-100)) × 1800 = 200 + 0.5 × 1800 = 1100 Hz`
  - Edge cases: Below onset → filter stays at 200Hz (though volume is 0)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/audio/pit-wind-ambient.test.ts` — must exist and pass.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 005 (collision sounds — establishes event subscription patterns)
- Unlocks: Story 007
