# Story 003b: Engine Sound — 60Hz Runtime

> **Epic**: Audio
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/audio.md`
**Requirement**: `TR-AUDIO-006` — Car engine oscillator synthesised from RPM, gear, throttle; pitch shifts with RPM.

**ADR Governing Implementation**: ADR-0020: Audio Engine
**ADR Decision Summary**: Per-tick direct reads from `CarEntity.physics` (rpm, throttle) at 60Hz. `StaticSound.playbackRate` for WAV pitch shift + `OscillatorNode.frequency.value` for oscillator overlay. Pitch formula: `0.6 + (RPM / maxRpm) × 0.9 + vibrato`. Engine volume: `baseVolume × (0.6 + throttle × 0.4)`.

**Engine**: Babylon.js 9.12.0 | **Risk**: HIGH
**Engine Notes**: `playbackRate` runtime changes on active instances documented as "affects new instances only" but source code iterates active instances and sets the underlying `AudioBufferSourceNode.playbackRate` AudioParam. Must verify in Story 000 spike.

**Control Manifest Rules (this layer)**:

- Required: P15 (hybrid engine sound — both on same sfxBus), P18 (engine WAV loop 2-4s with playbackRate)

---

## Acceptance Criteria

_From GDD `design/gdd/audio.md`:_

- [ ] AC #1: Engine pitch tracks RPM at 60 Hz with no perceptible lag — direct property reads from `CarEntity.physics.rpm`
- [ ] AC #2: Engine volume drops 40% when throttle = 0% (coasting) — `engineVolume = baseVolume × (0.6 + throttle × 0.4)`
- [ ] AC #13: RPM pitch change interpolates over 3 ticks (no instant jump) — 3-tick moving average of RPM input
- [ ] Pitch formula correct: `basePitch = 0.6 + (rpm / maxRpm) × 0.9`
- [ ] Vibrato applied: `finalPitch = basePitch + sin(time × rpm × 0.01) × 0.02`
- [ ] WAV `playbackRate` setter called every tick — both sample and oscillator pitch track together
- [ ] Oscillator `frequency.value` tracks RPM: `80 + (rpm / maxRpm) × 120`

---

### ⚠️ Pre-Implementation Clarifications Needed

The following were identified during QA review and must be resolved before implementation:

1. **16ms vs 3-tick interpolation** (AC #13): GDD Edge Case #5 says "3 ticks (16ms ramp)" — at 60Hz, 3 ticks = 50ms, not 16ms. **Resolution needed**: is the ramp target 16ms (1 tick) or 3 ticks (50ms)?
2. **`time` variable for vibrato**: `vibrato = sin(time × RPM × 0.01) × 0.02` — `time` should be elapsed seconds derived from `pipeline.getCurrentTick() × FIXED_DT (16.667ms)`. Confirm.
3. **`collision.impact` event payload** format: `{ carId, impulse, distance, type }` — affects whether engine volume reacts to collisions.

---

## Implementation Notes

_Derived from ADR-0020 Implementation Guidelines:_

```typescript
// Per-tick update (60Hz, called from pipeline or AudioManager tick)
updateEngineSound(carId: string, physics: CarPhysics): void {
  const sample = this._engineSamples.get(physics.carClass);
  const overlay = this._engineOverlays.get(carId);
  if (!sample && !overlay) return;

  const rpmRatio = physics.rpm / physics.maxRpm;

  // 3-tick interpolation
  this._rpmHistory[carId] ??= [];
  this._rpmHistory[carId].push(rpmRatio);
  if (this._rpmHistory[carId].length > 3) {
    this._rpmHistory[carId].shift();
  }
  const smoothedRpm = this._rpmHistory[carId].reduce((a, b) => a + b, 0)
    / this._rpmHistory[carId].length;

  // Pitch
  const time = this._tickCount * (1 / 60); // or pipeline.getCurrentTick() * FIXED_DT
  const basePitch = 0.6 + smoothedRpm * 0.9;
  const vibrato = Math.sin(time * physics.rpm * 0.01) * 0.02;
  const finalPitch = basePitch + vibrato;

  if (sample) {
    (sample as any).playbackRate = finalPitch; // StaticSound property
  }
  if (overlay) {
    // OscillatorNode frequency tracks RPM — overlay is subtle (~30% volume)
    overlay.sourceNode.frequency.value = 80 + smoothedRpm * 120;
  }

  // Volume
  const engineVolume = 0.8 * (0.6 + physics.throttle * 0.4);
  if (sample) sample.setVolume(engineVolume);
}
```

**Performance note**: 6 direct CarEntity property reads per tick (~0.0001ms). `playbackRate` setter on 1 active instance (~0.001ms). Negligible.

**Volume behaviour**: At 0% throttle → volume = 0.8 × 0.6 = 0.48 (40% drop). At 100% throttle → volume = 0.8 × 1.0 = 0.8.

---

## Out of Scope

- Tire squeal, collision sounds, wind, pit sounds (Stories 004–006)
- Crossfade on GSM state changes (Story 007)

---

## QA Test Cases

- **AC-1**: Pitch tracks RPM at 60Hz
  - Given: Engine sample and oscillator exist for a car; `physics.rpm = 6000`, `maxRpm = 10000`
  - When: `updateEngineSound("car_0", physics)` is called
  - Then: `playbackRate = 0.6 + (6000/10000) × 0.9 = 1.14`; oscillator frequency = `80 + 0.6 × 120 = 152`
  - Edge cases: `rpm = 0` → playbackRate = 0.6, frequency = 80. `rpm = maxRpm` → playbackRate = 1.5, frequency = 200

- **AC-2**: Volume drops 40% when coasting
  - Given: `baseVolume = 0.8`, `physics.throttle = 0.0`
  - When: `updateEngineSound` computes volume
  - Then: `engineVolume = 0.8 × (0.6 + 0.0 × 0.4) = 0.48`
  - Edge cases: `throttle = 1.0` → `0.8 × 1.0 = 0.8`. `throttle = 0.5` → `0.8 × 0.8 = 0.64`

- **AC-3**: 3-tick interpolation smooths RPM jumps
  - Given: RPM jumps from 3000 to 9000 in one tick, `_rpmHistory` is empty
  - When: 3 consecutive ticks are processed
  - Then: Tick 1 uses rpmRatio = 3000/10000 = 0.3; Tick 2 uses avg(0.3, 0.9) = 0.6; Tick 3 uses avg(0.3, 0.9, 0.9) = 0.7
  - Edge cases: RPM reverse jump (9000 → 3000) same smoothing applied

- **AC-4**: Vibrato modulates pitch
  - Given: Stable RPM at 6000, `time` advances each tick
  - When: Pitch is computed over 10 consecutive ticks
  - Then: `finalPitch` oscillates around `basePitch` within ±0.02 range
  - Edge cases: `rpm = 0` → vibrato = sin(0) = 0, no oscillation

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/audio/engine-sound-runtime_test.ts` — must exist and pass.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003a (engine sound samples and oscillators must exist)
- Unlocks: Story 004
