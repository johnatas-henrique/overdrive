# Audio

> **Status**: Design Complete
> **Author**: build agent
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Speed That Is Felt (primary), Simple Strategy (secondary)

## Overview

Audio translates simulation data into sensory feedback. Engine pitch, tire squeal, collision impacts, and pit sounds make the car feel alive — the player hears speed, grip, and danger before they see it.

The Audio system consumes events and telemetry from Physics, Collision, Fuel, Tire Wear, Pit Stop, Race Management, and GSM. It owns no game state — it is a pure output layer that maps data to sound.

**MVP scope**: Engine sound (hybrid sample + procedural), tire squeal, collision impacts, pit lane sounds, menu music, GSM-driven track switching. Spatial mixing deferred.

---

## Player Fantasy

> _You hear the engine scream as you approach the braking zone — the pitch drops as you lift, tires protest under load, and a distant thud means someone just hit the barrier behind you. The sound tells you what's happening faster than your eyes._

Audio makes simulation data tangible. A 200 km/h car without sound feels like a toy. The same car with engine pitch responding to RPM, tire squeal at grip limit, and collision thuds feels dangerous.

---

## Detailed Design

### Sound Architecture

Babylon.js Audio Engine V2 (default since v7.52) with Web Audio API backend. All sound creation is async (`CreateSoundAsync`, `CreateSoundSourceAsync`).

**Import paths:**

| Concept                 | Import                                   | API                                                |
| ----------------------- | ---------------------------------------- | -------------------------------------------------- |
| Audio Engine            | `@babylonjs/core/AudioV2/audioEngineV2`  | `CreateAudioEngineAsync()`                         |
| Static Sound (WAV)      | `@babylonjs/core/AudioV2/staticSound`    | `CreateSoundAsync(name, source, options)`          |
| Streaming Sound (MP3)   | `@babylonjs/core/AudioV2/streamingSound` | `CreateStreamingSoundAsync(name, source, options)` |
| Audio Bus               | `@babylonjs/core/AudioV2/audioBus`       | `CreateAudioBusAsync(name, options)`               |
| Custom AudioNode source | `@babylonjs/core/AudioV2/soundSource`    | `CreateSoundSourceAsync(name, audioNode, options)` |
| Parameter ramp          | `@babylonjs/core/AudioV2/audioParameter` | `AudioParameterRampShape.Linear`                   |
| Sound Buffer            | `@babylonjs/core/AudioV2/staticSound`    | `CreateSoundBufferAsync(source)`                   |

```
AudioManager
├── AudioBus "music"       — menu music, results fanfare
├── AudioBus "sfx"          — engine, tires, collisions, pit
├── AudioBus "ui"           — menu clicks, HUD feedback
└── AudioBus "ambient"      — pit lane ambient, wind
```

Each `AudioBus` has independent volume control. All buses mix through the engine's master gain. The architecture is: Sound → AudioBus → Master → Speakers. Buses are created with `CreateAudioBusAsync`.

**Initialization**: `AudioManager.init()` called during Loading state (GSM `'gsm.state.entered'` with `to: Loading`). Creates AudioBus instances, loads engine samples via `CreateSoundAsync`, sets up procedural nodes via `CreateSoundSourceAsync`. The first user interaction (click/keypress) unlocks the Web Audio context — Audio Engine V2 handles this automatically via `resumeOnInteraction: true` (default), showing a small unmute button if needed. No custom unlock prompt required.

### Engine Sound (Hybrid via CreateSoundAsync + CreateSoundSourceAsync)

**Base layer**: WAV sample loop per car class (V12, V10, V8). Pitch shifted via `StaticSound.playbackRate`. Loaded via `CreateSoundAsync(name, "engine.wav", { loop: true })`.

**Overlay layer**: `OscillatorNode` connected through Babylon's audio pipeline via `CreateSoundSourceAsync`. No raw Web Audio path — the OscillatorNode routes to the same `sfxBus`, sharing volume and crossfade with the base sample.

```typescript
// Init
const audioEngine = await CreateAudioEngineAsync();
const sfxBus = await CreateAudioBusAsync("sfx", { volume: 0.7 });

const baseEngine = await CreateSoundAsync(
  "engine_v12",
  "audio/engine/v12.wav",
  {
    loop: true,
    outBus: sfxBus,
  }
);

// Oscillator overlay — same bus as base sample
const osc = new OscillatorNode(audioEngine.audioContext, { type: "sine" });
osc.start();
const overlay = await CreateSoundSourceAsync("engine_v12_overlay", osc, {
  volume: 0.3,
  outBus: sfxBus, // same bus! no dual path
});

// Per-tick (60hz)
const rpmRatio = physicsRpm / maxRpm;
baseEngine.playbackRate = 0.6 + rpmRatio * 0.9; // 0.6x at idle, 1.5x at redline
osc.frequency.value = 80 + rpmRatio * 120; // oscillator tracks RPM
```

Pitch formula:
basePitch = 0.6 + (RPM / maxRpm) × 0.9 // 0.6x at idle, 1.5x at redline
vibrato = sin(time × RPM × 0.01) × 0.02 // ±2% oscillation
finalPitch = basePitch + vibrato

```

**RPM source**: `physics.rpm` read directly every tick (60 Hz). No throttling — engine pitch must track RPM frame-perfectly.

**Volume**: Proportional to throttle input. At 0% throttle (coasting), engine volume drops 40%. This creates the "lift" in lift-off oversteer — the engine quiets when you lift, tires take over.

```

engineVolume = baseVolume × (0.6 + throttle × 0.4)

```

**Car class mapping**:

| Class | Teams               | Sample base       | Pitch range |
| ----- | ------------------- | ----------------- | ----------- |
| V12   | Macklen, Ferrell    | High-pitch scream | 0.6 – 1.5   |
| V10   | Willard, Bennett    | Mid-range howl    | 0.55 – 1.45 |
| V8    | Jordash, Tyrant     | Low growl         | 0.5 – 1.4   |
| V8    | Lorris, Layton Hall | Mid-low rumble    | 0.52 – 1.42 |

### Tire Squeal

Triggered when `physics.lateralG` exceeds a threshold (configurable per surface).

```

squealVolume = clamp((abs(lateralG) - squealThreshold) / (maxLateralG - squealThreshold), 0, 1)

```

**Wear modifier**: As tire condition drops, squeal onset threshold decreases (squeals earlier = more noise when tires are worn).

```

effectiveThreshold = squealThreshold × (0.5 + tireCondition × 0.5)
// tireCondition 1.0 → threshold unchanged
// tireCondition 0.3 → threshold at 65% of base (squeals earlier as condition drops)

```

**Sound**: Single looping WAV (`CreateSoundAsync("tire_squeal", "sounds/tire.wav", { loop: true, outBus: sfxBus })`) with pitch variance. Volume fades via `setVolume()` (50ms attack, 100ms release) to prevent popping.

### Collision Sounds

**Player collision** (`carId === playerCarId`):

- Full volume, stereo-panned by impact direction
- Volume proportional to impulse magnitude
- Two samples: thud (barrier) and scrape (car-car), selected by collision type
- `maxInstances: 5` on the collision `CreateSoundAsync` call — max 5 concurrent, oldest auto-stopped

**Nearby rival collision** (within 30m radius):

- Muffled (low-pass filter, -12dB)
- Volume proportional to 1/distance
- Creates spatial awareness without drowning out player's own sounds

```

rivalVolume = baseVolume × clamp(1 - (distance / 30), 0, 1) × 0.3

```

**Distant rival collision** (>30m): Not played.

### Pit Lane Sounds

| Event             | Sound                          | Duration        | Volume |
| ----------------- | ------------------------------ | --------------- | ------ |
| Pit entry zone    | Pit lane ambient (loop)        | Continuous      | 0.4    |
| Pit entry zone    | Whoosh/Doppler (one-shot)      | ~0.5s           | 0.5    |
| Refuel start      | Low pump hum (loop)            | Refuel duration | 0.6    |
| Tire change start | Impact wrench burst (one-shot) | ~2s             | 0.8    |
| Pit exit zone     | Ambient fades out              | 1s fade         | —      |

Camera does not change during pit stop (confirmed in Camera GDD). Audio stays consistent — player hears pit sounds from cockpit perspective.

### Menu Music

**Style**: Synthwave/outrun — synth pads, driving bass, retro aesthetic matching the art bible's 1990s F1 theme.

**BPM**: 120–140 (energy without urgency — menu is exploration, not action).

**Structure**: Loop-friendly (seamless loop point at 32 or 64 bars).

**Source**: CC0 track from Pixabay Audio / Freesound, or agent-generated placeholder. Content is replaceable — Asset Manager loads any `.mp3` at `assets/audio/music/menu.mp3`.

**Volume**: 0.5 default, fades to 0.3 when menu has interactive elements (configurable via `audio.musicVolume`).

### Wind Noise

Volume proportional to speed.

```

windVolume = clamp((speed - windOnset) / (maxSpeed - windOnset), 0, 1) × maxWindVolume

```

**Onset**: Wind becomes audible at 100 km/h (configurable). Below this, silence. At 300 km/h, wind is prominent but never louder than engine.

**Filter**: Low-pass filter frequency increases with speed (more high-frequency wind at higher speeds).

### Gear Shift Sound

One-shot sample triggered when `physics.gear` changes.

- Different sample per car class (V12 = sharp click, V8 = deeper thud)
- Volume: 0.7 default
- Timing: Plays on gear change event, no overlap (new shift cancels previous)

### GSM-Driven Track Switching

| GSM State | Audio Behavior                                                               |
| --------- | ---------------------------------------------------------------------------- |
| Loading   | Silence (loading screen)                                                     |
| Menu      | Menu music loop, ambient UI sounds                                           |
| PreRace   | Menu music fades out, engine idle fades in                                   |
| Racing    | Full engine + tire + wind + collision sounds                                 |
| Paused    | Race sounds fade to low ambient (muffled). UI sounds (pause menu) reactivate |
| PostRace  | Race sounds fade out, results fanfare plays once                             |

Transition: 500ms linear ramp via `sound.setVolume(target, { duration: 0.5, shape: AudioParameterRampShape.Linear })` — applied per-Sound or per-Bus depending on scope.

---

## Formulas

| Formula                   | Expression                                                          | Description                        |
| ------------------------- | ------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------- | ---------------------------- |
| Engine pitch              | `0.6 + (RPM / maxRpm) × 0.9 + vibrato`                              | Hybrid sample + procedural overlay |
| Engine volume             | `baseVolume × (0.6 + throttle × 0.4)`                               | Quieter when coasting              |
| Tire squeal volume        | `clamp((                                                            | lateralG                           | - threshold) / (maxG - threshold), 0, 1)` | Proportional to lateral load |
| Tire squeal threshold     | `baseThreshold × (0.5 + tireCondition × 0.5)`                       | Worn tires squeal earlier          |
| Collision volume (player) | `baseVolume × clamp(impulse / maxImpulse, 0, 1)`                    | Proportional to impact             |
| Collision volume (rival)  | `baseVolume × (1 - distance/30) × 0.3`                              | Fades with distance, muted         |
| Wind volume               | `clamp((speed - onset) / (maxSpeed - onset), 0, 1) × maxWindVolume` | Proportional to speed              |
| Crossfade                 | `500ms linear`                                                      | Between GSM states                 |

---

## States and Interactions

### Lifecycle

```

Uninitialized → Initialized → Running

```

- **Uninitialized**: No audio context. AudioManager not created.
- **Initialized**: AudioTracks created, samples loaded, procedural nodes ready. Triggered during Loading state.
- **Running**: Active audio output. Sounds start/stop based on GSM state and simulation events.

### Subscriptions (Event Bus)

| Event               | Action                                       |
| ------------------- | -------------------------------------------- |
| `gsm.state.entered` | Switch audio tracks (menu/race/results)      |
| `collision.impact`  | Play collision sound (player + nearby rival) |
| `car.fuel_empty`    | Engine sputter sound                         |
| `car.tire_blown`    | Tire pop sound                               |
| `pit.entry`         | Pit lane ambient fade in                     |
| `pit.exit`          | Pit lane ambient fade out                    |
| `position.changed`  | Overtake sound cue (optional, non-critical)  |
| `entity.spawned`    | Start engine idle for new car                |
| `entity.despawned`  | Stop engine + all car sounds                 |

### Direct Reads (per tick, 60 Hz)

| Data               | Source           | Purpose                 |
| ------------------ | ---------------- | ----------------------- |
| `physics.rpm`      | Physics/Handling | Engine pitch            |
| `physics.speed`    | Physics/Handling | Wind volume             |
| `physics.throttle` | Physics/Handling | Engine volume           |
| `physics.gear`     | Physics/Handling | Gear shift trigger      |
| `physics.lateralG` | Physics/Handling | Tire squeal volume      |
| `tire.condition`   | Tire Wear        | Squeal threshold adjust |

**Performance note**: Direct reads from Physics are zero-cost (reference copy). No Event Bus overhead for per-tick data.

---

## Edge Cases

| #   | Edge Case                         | Handling                                                      |
| --- | --------------------------------- | ------------------------------------------------------------- |
| 1   | Audio context blocked by browser  | Audio Engine V2 handles automatically via `resumeOnInteraction: true`. Shows unmute button if needed. No custom prompt required. |
| 2   | Sample load failure               | Fall back to procedural-only engine sound (oscillator via `CreateSoundSourceAsync`) |
| 3   | Multiple collision sounds/second  | `maxInstances: 5` on the collision `CreateSoundAsync` call. Oldest instance stops if a 6th plays. No custom pooling needed. |
| 4   | GSM rapid state changes           | `setVolume()` cancels previous ramp automatically. New state starts immediately |
| 5   | RPM spike (0→redline in 1 tick)   | Pitch interpolates over 3 ticks (16ms ramp) to prevent glitch |
| 6   | All cars off-screen (replay mode) | Engine sounds muted by distance; only player car audible      |

---

## Data Ownership

| Data                  | Type                | Source                       | Notes                |
| --------------------- | ------------------- | ---------------------------- | -------------------- |
| Engine pitch          | Runtime (per tick)  | Physics/Handling             | RPM → playbackRate   |
| Tire squeal intensity | Runtime (per tick)  | Physics/Handling + Tire Wear | lateralG + condition |
| Collision sound queue | Runtime (per event) | Collision                    | Max 5 concurrent     |
| GSM audio state       | Runtime             | Game State Machine           | Menu/Racing/PostRace |
| Sound volume settings | Persistent          | Persistence                  | User preferences     |

---

## Dependencies

| System             | Relationship                            |
| ------------------ | --------------------------------------- |
| Physics/Handling   | Provides RPM, speed, throttle, lateralG |
| Collision          | Provides collision.impact events        |
| Fuel               | Provides car.fuel_empty event           |
| Tire Wear          | Provides tire.condition for squeal      |
| Pit Stop           | Provides pit.entry/exit events          |
| Race Management    | Provides position.changed for overtake  |
| Game State Machine | Drives track switching (menu/race)      |
| Event Bus          | All event subscriptions                 |
| Data & Config      | Volume settings, thresholds             |
| Asset Manager      | Loads audio samples                     |

---

## Tuning Knobs

All values in `audio.*` namespace, runtime-configurable via ConfigManager.

| Key                            | Default | Range      | Description                             |
| ------------------------------ | ------- | ---------- | --------------------------------------- |
| `audio.masterVolume`           | 0.8     | 0.0 – 1.0  | Master volume                           |
| `audio.musicVolume`            | 0.5     | 0.0 – 1.0  | Music track volume                      |
| `audio.sfxVolume`              | 0.7     | 0.0 – 1.0  | SFX track volume                        |
| `audio.uiVolume`               | 0.6     | 0.0 – 1.0  | UI sounds volume                        |
| `audio.ambientVolume`          | 0.4     | 0.0 – 1.0  | Ambient track volume                    |
| `audio.engineBaseVolume`       | 0.8     | 0.3 – 1.0  | Engine idle volume                      |
| `audio.engineCoastRatio`       | 0.6     | 0.3 – 0.8  | Engine volume multiplier when coasting  |
| `audio.vibratoDepth`           | 0.02    | 0.0 – 0.05 | Procedural vibrato amplitude            |
| `audio.squealThreshold`        | 0.8     | 0.5 – 1.2  | LateralG threshold for tire squeal      |
| `audio.squealMaxVolume`        | 0.6     | 0.3 – 0.9  | Maximum tire squeal volume              |
| `audio.windOnsetSpeed`         | 100     | 50 – 150   | Speed (km/h) where wind becomes audible |
| `audio.windMaxVolume`          | 0.3     | 0.1 – 0.5  | Maximum wind volume                     |
| `audio.collisionMaxConcurrent` | 5       | 3 – 10     | Max simultaneous collision sounds       |
| `audio.collisionRivalRatio`    | 0.3     | 0.1 – 0.5  | Rival collision volume vs player        |
| `audio.collisionRadius`        | 30      | 10 – 50    | Distance (m) for rival collision sound  |
| `audio.crossfadeDuration`      | 500     | 200 – 1000 | Crossfade between GSM states (ms)       |
| `audio.rpmRampTicks`           | 3       | 1 – 10     | Ticks to interpolate RPM pitch changes  |
| `audio.gearShiftVolume`        | 0.7     | 0.3 – 1.0  | Gear shift sound volume                 |

**Total**: 18 tuning knobs.

---

## Acceptance Criteria

| #   | Criterion                                                                          | Test type     |
| --- | ---------------------------------------------------------------------------------- | ------------- |
| 1   | Engine pitch tracks RPM at 60 Hz with no perceptible lag                           | Unit + visual |
| 2   | Engine volume drops 40% when throttle = 0% (coasting)                              | Unit          |
| 3   | Tire squeal activates when lateralG exceeds threshold                              | Unit          |
| 4   | Tire squeal threshold decreases as tire condition drops                            | Unit          |
| 5   | Player collision plays full-volume sound; rival collision within 30m plays muffled | Integration   |
| 6   | Rival collision volume scales inversely with distance                              | Unit          |
| 7   | Pit lane ambient fades in on pit.entry, fades out on pit.exit                      | Integration   |
| 8   | Menu music plays during Menu state, stops during Racing                            | Integration   |
| 9   | GSM state change triggers crossfade (no abrupt audio cuts)                         | Integration   |
| 10  | All 18 tuning knobs are accessible via ConfigManager.get('audio.\*')               | Unit          |
| 11  | Engine sound falls back to procedural-only if sample fails to load                 | Unit          |
| 12  | Max 5 concurrent collision sounds; excess queued/dropped                           | Unit          |
| 13  | RPM pitch change interpolates over 3 ticks (no instant jump)                       | Unit          |
| 14  | Audio context unlocks on first user interaction                                    | Integration   |

---

## Out of Scope (MVP)

- Spatial audio (3D positioning, Doppler effect)
- Dynamic music system (adaptive intensity)
- Reverb zones (tunnel echo, open track)
- AI car engine sounds at distance (only player car audible)
- Subtitle/caption system
- Audio settings persistence (deferred to Alpha)

---

## Open Questions

| #   | Question                                                  | Status                                                                                |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Should gear shift sample vary per car class or be shared? | Decide                                                                                |
| 2   | Menu music CC0 source — Pixabay or agent-generated?       | Resolved — body §Menu Music specifies CC0 from Pixabay/Freesound or agent placeholder |
| 3   | Engine sample duration — 2s loop vs 4s loop?              | Resolved — 2s–4s WAV loop is appropriate for StaticSound playbackRate (buffer <30s)   |
```
