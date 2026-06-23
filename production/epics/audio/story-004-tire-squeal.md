# Story 004: Tire Squeal with Wear Modifier

> **Epic**: Audio
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/audio.md`
**Requirement**: `TR-AUDIO-005` — Race event subscription: collision.thud, gear.up/down, lap.complete, checkered fanfare (this story covers the tire squeal portion).

**ADR Governing Implementation**: ADR-0020: Audio Engine
**ADR Decision Summary**: Tire squeal is a looping WAV on `sfxBus` with volume controlled by lateralG. `setVolume(target, { duration })` with short attack/release (50ms/100ms) for pop-free transitions. Wear modifier lowers squeal threshold as tire condition drops.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: `CreateSoundAsync("tire_squeal", url, { loop: true, outBus: sfxBus })`. `StaticSound.playbackRate` for pitch variance. `setVolume` with duration for attack/release envelope.

**Control Manifest Rules (this layer)**:

- Required: P14 (AudioBuses), P13 (Audio Engine V2 ONLY)

---

## Acceptance Criteria

_From GDD `design/gdd/audio.md`:_

- [ ] AC #3: Tire squeal activates when lateralG exceeds threshold — `squealVolume = clamp((|lateralG| - effectiveThreshold) / (maxLateralG - effectiveThreshold), 0, 1)`
- [ ] AC #4: Tire squeal threshold decreases as tire condition drops — `effectiveThreshold = baseThreshold × (0.5 + tireCondition × 0.5)`
- [ ] Single looping WAV (`CreateSoundAsync`) plays continuously on `sfxBus` with per-tick volume updates
- [ ] Volume has 50ms attack (when squeal starts) and 100ms release (when squeal stops) via `setVolume(target, { duration })` — prevents audio popping
- [ ] Direct reads: `physics.lateralG` per tick, `tire.condition` from Tire Wear system
- [ ] Pitch variance: `playbackRate` varies slightly with lateralG intensity for natural variation

---

### ⚠️ Pre-Implementation Clarifications Needed

1. **`maxLateralG` value**: The formula uses `maxLateralG` but it's not a tuning knob. Likely a physics constant. Must be confirmed with Physics system architect. Default assumed: 1.5.
2. **Attack/release trigger**: Volume envelope applies on threshold **crossing events** (ON when lateralG exceeds threshold, OFF when it drops below), not per-tick continuous. Implement as state machine: `silent → attack → sustaining → release → silent`.

---

## Implementation Notes

_Derived from ADR-0020 Implementation Guidelines:_

```typescript
private _squealState: "silent" | "attacking" | "sustaining" | "releasing" = "silent";
private _squealSound: StaticSound | null = null;

async initTireSqueal(): Promise<void> {
  this._squealSound = await CreateSoundAsync("tire_squeal", "audio/sfx/tire_squeal.wav", {
    loop: true,
    outBus: this._sfxBus,
  });
  this._squealSound.setVolume(0); // start silent
}

updateTireSqueal(lateralG: number, tireCondition: number): void {
  const threshold = ConfigManager.get<number>("audio.squealThreshold")
    * (0.5 + tireCondition * 0.5);
  const maxG = ConfigManager.get<number>("physics.maxLateralG"); // or constant
  const absG = Math.abs(lateralG);
  const targetVolume = absG > threshold
    ? clamp((absG - threshold) / (maxG - threshold), 0, 1)
      * ConfigManager.get<number>("audio.squealMaxVolume")
    : 0;

  // State machine for attack/release
  switch (this._squealState) {
    case "silent":
      if (targetVolume > 0) {
        this._squealState = "attacking";
        this._squealSound.play();
        this._squealSound.setVolume(targetVolume, { duration: 0.05 });
      }
      break;
    case "attacking":
    case "sustaining":
      if (targetVolume > 0) {
        this._squealState = "sustaining";
        this._squealSound.setVolume(targetVolume, { duration: 0.05 });
      } else {
        this._squealState = "releasing";
        this._squealSound.setVolume(0, { duration: 0.1 });
        setTimeout(() => { this._squealSound.stop(); this._squealState = "silent"; }, 100);
      }
      break;
    case "releasing":
      if (targetVolume > 0) {
        this._squealState = "attacking";
        this._squealSound.play();
        this._squealSound.setVolume(targetVolume, { duration: 0.05 });
      }
  }
}
```

**Pitch variance**: `this._squealSound.playbackRate = 0.9 + (squealVolume × 0.2)` — subtle 0.9–1.1 range variation.

---

## Out of Scope

- Collision sounds (Story 005)
- Wind noise (Story 006)

---

## QA Test Cases

- **AC-1**: Squeal volume at exact threshold
  - Given: `tireCondition = 1.0`, `squealThreshold = 0.8 (default)`, `maxLateralG = 1.5`
  - When: `lateralG = 0.8` (exactly at threshold)
  - Then: `effectiveThreshold = 0.8 × (0.5 + 1.0 × 0.5) = 0.8`; `squealVolume = clamp((0.8 - 0.8)/(1.5 - 0.8), 0, 1) = 0`
  - Edge cases: lateralG just below threshold → volume = 0

- **AC-2**: Squeal volume at maximum lateralG
  - Given: `tireCondition = 1.0`, `squealThreshold = 0.8`, `maxLateralG = 1.5`
  - When: `lateralG = 1.5`
  - Then: `squealVolume = 1.0`
  - Edge cases: lateralG > maxLateralG → clamped to 1.0

- **AC-3**: Wear modifier lowers threshold
  - Given: `squealThreshold = 0.8`, `tireCondition = 0.3`
  - When: `effectiveThreshold = 0.8 × (0.5 + 0.3 × 0.5) = 0.52`
  - Then: Squeal starts at `|lateralG| > 0.52` (vs 0.8 with fresh tires)
  - Edge cases: `tireCondition = 0` → threshold = 0.4. `tireCondition = 1` → threshold = 0.8.

- **AC-4**: Attack/release envelope
  - Given: Squeal loop is playing on sfxBus at volume 0
  - When: lateralG crosses above threshold (ON event), `setVolume(target, { duration: 0.05 })` is called
  - Then: Volume reaches target within 50ms
  - When: lateralG drops below threshold (OFF event), `setVolume(0, { duration: 0.1 })` is called
  - Then: Volume reaches 0 within 100ms
  - Edge cases: ON event while already ramping up (reset ramp). OFF while already at 0 (no-op)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/audio/tire-squeal_test.ts` — must exist and pass.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003b (engine sound runtime — establishes 60Hz tick loop)
- Unlocks: Story 005
