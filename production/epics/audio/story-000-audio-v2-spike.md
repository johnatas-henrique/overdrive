# Story 000: Audio Engine V2 API Spike

> **Epic**: Audio
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/audio.md`
**Requirement**: Pre-work — validates all 5 critical Audio Engine V2 APIs before implementation begins.

**ADR Governing Implementation**: ADR-0020: Audio Engine
**ADR Decision Summary**: Audio Engine V2 exclusively — `CreateSoundAsync`, `CreateAudioBusAsync`, `CreateSoundSourceAsync`, `CreateStreamingSoundAsync`. No legacy `Sound` class.

**Engine**: Babylon.js 9.12.0 | **Risk**: HIGH
**Engine Notes**: All Audio Engine V2 APIs are post-cutoff. This spike validates their real behaviour in the target engine version. Key unknowns: `playbackRate` on active instances, `CreateSoundSourceAsync` OscillatorNode routing, `setVolume` ramp shapes, `maxInstances` behaviour, `resumeOnInteraction` default handling.

**Control Manifest Rules (this layer)**:

- Required: P13 (Audio Engine V2 ONLY — `CreateSoundAsync`, `CreateAudioBusAsync`, `CreateSoundSourceAsync`, `CreateStreamingSoundAsync`)
- Forbidden: P-F1 (Never use legacy `Sound` class), P-F2 (Never use `SoundTrack`), P-F3 (Never bypass Audio Engine with raw Web Audio API)

---

## Acceptance Criteria

_Pre-work spike — validates API behaviour before story implementation:_

- [ ] `CreateAudioEngineAsync` resolves without error; `audioEngine.audioContext` exists in `running` or `suspended` state
- [ ] `CreateAudioBusAsync` creates bus with correct name and volume; `bus.volume` returns set value
- [ ] `CreateSoundAsync` loads and plays a WAV loop; `playbackRate` can be changed on an actively playing instance and takes effect immediately
- [ ] `CreateSoundSourceAsync(name, oscillator, { outBus, volume })` connects an OscillatorNode through the bus; oscillator output is audible at correct volume; volume changes via bus `setVolume` affect it
- [ ] `CreateStreamingSoundAsync` loads and plays an MP3; `playbackRate` is NOT settable (confirmed as unsupported)
- [ ] `setVolume(target, { duration, shape: AudioParameterRampShape.Linear })` ramps volume over specified duration; ramp cancellation on second call works
- [ ] `maxInstances: 5` on `CreateSoundAsync` — playing 6 concurrent sounds stops the oldest
- [ ] `resumeOnInteraction: true` (default) — AudioContext resumes on first click/keypress
- [ ] Evidence document (`production/qa/evidence/audio-spike-evidence.md`) contains per-API pass/fail verdict with Babylon.js version, test date, and observed behaviour

---

## Implementation Notes

**Timebox**: 1 day. If an API is blocked, document the issue and constraints, then report. Do not fix the framework.

**Test each API independently** — create a minimal standalone test HTML/TS file. Do not integrate into the game's AudioManager yet.

**APIs to validate**:

1. `CreateAudioEngineAsync()` — import from `@babylonjs/core/AudioV2/audioEngineV2`
2. `CreateSoundAsync(name, url, { loop, outBus })` — import from `@babylonjs/core/AudioV2/staticSound`
   - Key test: change `playbackRate` on a playing instance — verify immediate pitch shift
3. `CreateAudioBusAsync(name, { volume })` — import from `@babylonjs/core/AudioV2/audioBus`
4. `CreateSoundSourceAsync(name, audioNode, { outBus, volume })` — import from `@babylonjs/core/AudioV2/soundSource`
   - Pass `new OscillatorNode(audioContext, { type: "sawtooth" })` as the second argument
   - Verify routing through `outBus` — bus `setVolume` controls oscillator volume
5. `CreateStreamingSoundAsync(name, url, { loop, outBus, autoplay })` — import from `@babylonjs/core/AudioV2/streamingSound`
   - Confirm `playbackRate` setter throws or is a no-op
6. `AudioParameterRampShape.Linear` — import from `@babylonjs/core/AudioV2/audioParameter`

**Collateral findings to capture**:

- WAV sample format requirements (sample rate, bit depth, channel count)
- Any browser-specific limitations
- AudioContext creation — can `new AudioContext()` be called before engine init, or must Babylon own it?
- Memory usage per sound instance

---

## Out of Scope

- Implementation of AudioManager class — spike validates APIs only
- Game integration — spike is standalone
- Performance profiling beyond basic viability

---

## QA Test Cases

**No automated tests** — this is a spike delivering an evidence document.

```
Spike evidence doc template:
  API: <name>
    Test: <specific test>
    Babylon.js version: 9.12.0
    Status: PASS / FAIL / BLOCKED
    Observed behaviour: <detailed notes>
    Code snippet: <minimal reproduction if needed>
```

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `production/qa/evidence/audio-spike-evidence.md` — must contain per-API pass/fail verdicts and be signed off by lead programmer.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None (standalone pre-work)
- Unlocks: All stories 001–010
