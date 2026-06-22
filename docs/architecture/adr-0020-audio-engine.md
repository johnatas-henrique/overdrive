# ADR-0020: Audio Engine

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Engine**                | Babylon.js 9.12.0                                                                                                                                                                                                                                                        |
| **Domain**                | Presentation — Audio / Sound                                                                                                                                                                                                                                             |
| **Knowledge Risk**        | 🔴 HIGH — Audio Engine V2 is default since v7.52. Legacy `Sound` class deprecated since v8.0. Audio Engine V2 API (`CreateSoundAsync`, `AudioBus`, `CreateSoundSourceAsync`) is post-cutoff and differs significantly from V1 patterns described in other documentation. |
| **References Consulted**  | audio.md GDD, babylonjs-specialist review (Q1–Q7), Audio Engine V2 source code (v9.12), Web Audio API spec                                                                                                                                                               |
| **Post-Cutoff APIs Used** | `CreateAudioEngineAsync`, `CreateSoundAsync`, `CreateStreamingSoundAsync`, `CreateAudioBusAsync`, `CreateSoundSourceAsync`, `AudioParameterRampShape.Linear` — all from `@babylonjs/core/AudioV2/`                                                                       |

## ADR Dependencies

| Field          | Value                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Depends On** | ADR-0001 (Event Bus — event triggers), ADR-0015 (Race Management — GSM state events), ADR-0019 (Menu LITE — music context)    |
| **Enables**    | Engine sound (hybrid sample + procedural), tire squeal, collision impacts, pit sounds, menu music, GSM-driven track switching |
| **Blocks**     | None                                                                                                                          |

## Context

### Problem Statement

The Audio system translates simulation data into sensory feedback — engine pitch responds to RPM, tires squeal under lateral load, collisions thud, and the menu has music. It is a **pure output layer**: it consumes events and reads physics data, never writes to gameplay state.

### Constraints

- Babylon.js Audio Engine V2 only — no legacy `Sound` class usage
- Web Audio API backend (all modern browsers)
- Four independent buses: music, sfx, ui, ambient
- Engine sound uses hybrid approach: WAV sample loop + OscillatorNode procedural overlay, mixed through the same bus
- Per-tick physics reads (60hz): rpm, speed, throttle, gear, lateralG
- Event-driven triggers: collisions, pit states, GSM state changes
- Context unlock handled by Audio Engine V2 automatically
- `maxInstances` for collision sounds (no custom pooling)

## Decision

### Architecture

```
AudioEngine (CreateAudioEngineAsync)
  ├── AudioBus "music"        volume: 0.5  — menu music, results fanfare
  ├── AudioBus "sfx"          volume: 0.7  — engine, tires, collisions, pit
  ├── AudioBus "ui"           volume: 0.6  — menu clicks, HUD feedback
  └── AudioBus "ambient"      volume: 0.4  — pit lane ambient, wind
       │
       └── Master Gain → Speakers
```

Each bus is created via `CreateAudioBusAsync`. All sounds are routed to a bus via `outBus`. The engine master gain is controlled via `audioEngine.setVolume()`.

### Sound Creation

All sounds use async creation — no legacy `new Sound()` constructor:

```typescript
import { CreateAudioEngineAsync } from "@babylonjs/core/AudioV2/audioEngineV2";
import { CreateSoundAsync } from "@babylonjs/core/AudioV2/staticSound";
import { CreateAudioBusAsync } from "@babylonjs/core/AudioV2/audioBus";
import { CreateSoundSourceAsync } from "@babylonjs/core/AudioV2/soundSource";
import { CreateStreamingSoundAsync } from "@babylonjs/core/AudioV2/streamingSound";
import { AudioParameterRampShape } from "@babylonjs/core/AudioV2/audioParameter";

// Create AudioContext externally and pass to CreateAudioEngineAsync
// for access in OscillatorNode construction.
const audioContext = new AudioContext();
const audioEngine = await CreateAudioEngineAsync({ audioContext });

const sfxBus = await CreateAudioBusAsync("sfx", { volume: 0.7 });
const musicBus = await CreateAudioBusAsync("music", { volume: 0.5 });

// Static (WAV) — supports playbackRate changes
const engineSample = await CreateSoundAsync(
  "engine_v12",
  "audio/engine/v12.wav",
  {
    loop: true,
    outBus: sfxBus,
  }
);

// Streaming (MP3) — for long audio like music
const menuMusic = await CreateStreamingSoundAsync(
  "menu_music",
  "audio/music/menu.mp3",
  {
    loop: true,
    outBus: musicBus,
    autoplay: true,
  }
);
```

### Engine Sound: Hybrid via CreateSoundSourceAsync

The hybrid approach uses TWO sources that both route through the SAME `sfxBus`:

```typescript
// 1. Base layer: WAV sample loop with pitch shift
const baseEngine = await CreateSoundAsync(
  "engine_v12",
  "audio/engine/v12.wav",
  {
    loop: true,
    outBus: sfxBus,
  }
);

// 2. Overlay: OscillatorNode connected through Babylon's pipeline
// Uses the externally-created AudioContext from init above.
const osc = new OscillatorNode(audioContext, { type: "sine" });
osc.start();
const overlay = await CreateSoundSourceAsync("engine_v12_overlay", osc, {
  volume: 0.3,
  outBus: sfxBus, // same bus as base — single volume, single crossfade
});

// Per-tick (60hz):
const rpmRatio = physicsRpm / maxRpm;
baseEngine.playbackRate = 0.6 + rpmRatio * 0.9; // 0.6x idle → 1.5x redline
osc.frequency.value = 80 + rpmRatio * 120; // oscillator pitch
```

**Why not a raw Web Audio OscillatorNode bypassing Babylon?** Two separate audio paths means two volume controls and two crossfade targets. `CreateSoundSourceAsync` eliminates this — the OscillatorNode is a Babylon-managed sound source with the same `outBus`, `setVolume()`, and lifecycle as any other sound.

### PlaybackRate at Runtime

`StaticSound.playbackRate` (from `CreateSoundAsync`) changes pitch at runtime on active instances. The setter iterates over active instances and sets the underlying `AudioBufferSourceNode.playbackRate` AudioParam — changes take effect immediately. This applies to WAV buffers (< 30s recommended), not streaming sounds.

**Engine sample requirement**: 2-4s WAV loop, one per car class (V12, V10, V8 variants). Short enough to fit in an AudioBuffer, long enough to sound natural as a seamless loop.

### Crossfade (GSM State Transitions)

Crossfade between GSM states uses `setVolume()` with a ramp:

```typescript
// Fade music out over 500ms
menuMusic.setVolume(0, {
  duration: 0.5, // seconds
  shape: AudioParameterRampShape.Linear,
});

// Fade engine in over 500ms (on a bus — affects all sounds on that bus)
sfxBus.setVolume(0.7, {
  duration: 0.5,
  shape: AudioParameterRampShape.Linear,
});
```

Cancellation: if `setVolume()` is called while a ramp is in progress, the previous ramp is cancelled and the new one starts immediately (Edge Case #4 — GSM rapid state changes).

### Event Subscriptions (Event Bus)

| Event               | Action                                                           |
| ------------------- | ---------------------------------------------------------------- |
| `gsm.state.entered` | Switch audio state (Loading/Menu/PreRace/Racing/Paused/PostRace) |
| `collision.impact`  | Play collision sound (player + nearby rival)                     |
| `car.fuel_empty`    | Engine sputter sound                                             |
| `car.tire_blown`    | Tire pop sound                                                   |
| `pit.entry`         | Pit lane ambient fade in (whoosh one-shot)                       |
| `pit.exit`          | Pit lane ambient fade out                                        |
| `position.changed`  | Overtake sound cue (optional, non-critical)                      |
| `entity.spawned`    | Start engine idle for new car                                    |
| `entity.despawned`  | Stop all car sounds                                              |

### Direct Reads (Per Tick, 60hz)

| Data              | Source                 | Purpose                  |
| ----------------- | ---------------------- | ------------------------ |
| `physicsRpm`      | CarEntity.physics      | Engine pitch             |
| `physicsSpeed`    | CarEntity.physics      | Wind volume              |
| `physicsThrottle` | CarEntity.physics      | Engine volume modulation |
| `physicsGear`     | CarEntity.physics      | Gear shift trigger       |
| `physicsLateralG` | CarEntity.physics      | Tire squeal volume       |
| `tireCondition`   | CarEntity.runtime.tire | Squeal threshold         |

Direct reads from `CarEntity` are zero-cost (reference copy, no function call). No Event Bus overhead for per-tick data.

### Collision Sound Pooling

No custom pooling. `CreateSoundAsync` accepts `maxInstances`:

```typescript
const collisionThud = await CreateSoundAsync(
  "collision_thud",
  "sounds/thud.wav",
  {
    outBus: sfxBus,
    maxInstances: 5, // ← native pooling
  }
);

// Each collision:
collisionThud.play({ volume: impulseVolume });
// >5 concurrent → oldest instance auto-stopped, new one plays
```

### GSM → Audio State Table

| GSM State | Audio Behavior                                                        |
| --------- | --------------------------------------------------------------------- |
| Loading   | Silence. Audio Engine init completes                                  |
| Menu      | Menu music loop (`outBus: musicBus`). UI click sounds                 |
| PreRace   | Menu music fades out (500ms). Engine idle fades in for player car     |
| Racing    | Full engine + tire + wind + collision sounds (all `outBus: sfxBus`)   |
| Paused    | Race sounds fade to low ambient. UI sounds reactivate                 |
| PostRace  | Race sounds fade out. Results fanfare plays once (`outBus: musicBus`) |

### Web Audio Context Unlock

Audio Engine V2 handles this automatically:

- `resumeOnInteraction: true` (default) — any click/keypress on the page resumes the AudioContext
- A small unmute button (`#babylonUnmuteButton`) appears in the top-left if the context is blocked
- Programmatic: `await audioEngine.unlockAsync()` forces unlock

No custom unlock prompt is required in Phase 1.

## Alternatives Considered

| Concern                   | Alternative                                                | Why Rejected                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine sound architecture | Raw Web Audio OscillatorNode (bypassing Babylon)           | Two audio paths — volume and crossfade must be managed separately. `CreateSoundSourceAsync` solves this.                                                  |
| Sound creation            | Legacy `new Sound(...)` from `@babylonjs/core/Audio/sound` | Deprecated since v8.0. Still works in v9.12 but TypeScript shows deprecation warnings. No reason to use deprecated API.                                   |
| Audio grouping            | `SoundTrack` (Audio V1 API)                                | The V2 equivalent is `AudioBus`. Same semantics, V2-compatible.                                                                                           |
| Collision pooling         | Manual pool (max 5, queue/drop oldest)                     | `maxInstances: 5` on `CreateSoundAsync` does exactly this natively.                                                                                       |
| Context unlock            | Custom prompt / modal                                      | Audio Engine V2's `resumeOnInteraction: true` handles it. Custom prompt is unnecessary.                                                                   |
| Engine sound playback     | `CreateStreamingSoundAsync` (MP3 streaming)                | `StreamingSound` does NOT support `playbackRate` changes per documentation. Static `CreateSoundAsync` + WAV buffer is required for engine pitch tracking. |

## Consequences

### Positive

- Single audio pipeline — all sounds route through Babylon's AudioBus hierarchy
- `CreateSoundSourceAsync` eliminates the dual-path problem for hybrid engine sounds
- `maxInstances` handles collision sound pooling natively
- Context unlock automatic — no custom UI needed
- `setVolume()` with ramp handles crossfade natively, with automatic ramp cancellation
- Consistent with system standards — no legacy API usage

### Negative

- All sound creation is async — must `await` before use
- Engine WAV samples must be < 30s (AudioBuffer limit). 2-4s loops are the target
- `playbackRate` on streaming audio not supported — music must be loaded as `CreateSoundAsync` (WAV) or left at 1.0 rate
- No spatial audio in Phase 1 (deferred to Alpha)

### Risks

- **Risk**: `playbackRate` runtime changes don't work on all browsers (documentation says "affects new instances only," source code says it iterates active instances)
  **Mitigation**: Unit test verifies playbackRate change on active instance. If it fails, recreate the sound at the new rate (stop → create → play — creates a 1-frame gap that may be audible)
- **Risk**: Audio Engine V2 initialization fails on unsupported browser
  **Mitigation**: `try/catch` around `CreateAudioEngineAsync`. If it fails, all audio is disabled — game continues silently
- **Risk**: OscillatorNode desyncs from engine sample (phase cancellation)
  **Mitigation**: Oscillator is a subtle overlay (~30% volume). Small frequency drift is intended as "vibrato character"
- **Risk**: Multiple collision sounds in rapid succession cause audio glitching
  **Mitigation**: `maxInstances: 5` caps concurrency. No more than 5 AudioBufferSourceNodes active at once

## GDD Requirements Addressed

| GDD Requirement               | How This ADR Addresses It                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Audio Engine V2               | All creation via async V2 APIs. Zero legacy Sound usage                                    |
| 4 independent audio groups    | `AudioBus` (music/sfx/ui/ambient) with independent `volume`                                |
| Engine sound hybrid           | `CreateSoundAsync` (WAV base) + `CreateSoundSourceAsync` (OscillatorNode) on same `sfxBus` |
| Per-tick Physics reads        | Direct CarEntity property reads at 60hz — zero Event Bus overhead                          |
| Tire squeal, wind, gear shift | Sound instances on `sfxBus`                                                                |
| Collision sounds              | `maxInstances: 5` on `CreateSoundAsync`                                                    |
| Crossfade GSM states          | `setVolume(target, { duration: 0.5, shape: Linear })`                                      |
| Context unlock                | Handled automatically via `resumeOnInteraction: true`                                      |
| Sample load fallback          | `CreateSoundSourceAsync` with manual OscillatorNode if WAV fails                           |

## Performance Implications

- **CPU**: 6 direct property reads per tick (CarEntity.physics.\*) — ~0.0001ms total. `playbackRate` setter on 1 active instance — ~0.001ms. Negligible.
- **Memory**: 4 AudioBus objects. ~8 Sound instances (engine × 2 layers, tire, wind, collisions × 2, gear shift, 1 pit). ~4 WAV samples at ~500KB each = ~2MB.
- **Audio buffer**: 2-4s WAV loops at 44.1kHz/16-bit = ~176KB–352KB per sample. Acceptable.

## Validation Criteria

- [ ] `CreateAudioEngineAsync` succeeds — engine resumes on first interaction
- [ ] 4 AudioBus instances created with correct default volumes
- [ ] Engine WAV sample plays and pitch shifts with `playbackRate` at 60hz
- [ ] OscillatorNode via `CreateSoundSourceAsync` plays through same `sfxBus`
- [ ] Base engine + oscillator volume controlled by single `sfxBus.setVolume()`
- [ ] Collision sound with `maxInstances: 5` — 6th play stops oldest
- [ ] Crossfade: `setVolume(0, { duration: 0.5 })` ramps volume smoothly over 500ms
- [ ] GSM state change: racing sounds fade, post-race fanfare plays
- [ ] GSM rapid change: current ramp cancels, new ramp starts immediately
- [ ] Engine sound falls back to oscillator-only if WAV sample fails to load
- [ ] Tire squeal volume responds to `lateralG` and `tireCondition` changes
- [ ] Context unlock works without custom prompt

## Related Decisions

- ADR-0001 (Event Bus — all audio event triggers)
- ADR-0015 (Race Management — GSM state events)
- ADR-0019 (Menu LITE — music bus, menu click sounds)
- ADR-0003 (Two-Scene — sample loading via asset containers)
