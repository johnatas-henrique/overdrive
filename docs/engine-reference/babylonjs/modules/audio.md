# Babylon.js Audio — Quick Reference

Engine: Babylon.js 9.12.0 | Audio Engine V2 (default since v7.52)

> ⚠️ **Important**: This project uses **Audio Engine V2** exclusively. The legacy `Sound` class (`@babylonjs/core/Audio/sound`) is **deprecated since v8.0** and must not be used. See `docs/architecture/adr-0020-audio-engine.md` for the architectural decision.

## What Changed Since LLM Cutoff (~May 2025)

### v9.x Changes

- Audio Engine V2 is the default (v9 — legacy audio is opt-in)
- Audio Engine V2 added waveform analyzer data support (v9.11)
- Audio Engine V2 added distance-only spatial mode (v9.8)

### v8.x / Previous

- Legacy audio engine deprecated (v7.52)
- Audio Engine V2 introduced (v7.52)

## Audio Engine V2 Architecture

Audio Engine V2 uses Web Audio API natively. The key concepts:

- **AudioEngineV2** — created once per app via `CreateAudioEngineAsync()`
- **AudioBus** — named mix bus with independent volume (replaces `SoundTrack`)
- **StaticSound** — short-to-medium audio loaded from URL (supports `playbackRate`)
- **StreamingSound** — long audio stream (no `playbackRate` support)
- **SoundSource** — wraps a raw Web Audio `AudioNode` into the Babylon pipeine

## Setup

```typescript
import { CreateAudioEngineAsync } from "@babylonjs/core/AudioV2/audioEngine";

// Create the audio engine (called once during app init)
const audioEngine = await CreateAudioEngineAsync();

// Resume on user interaction (browser policy)
await audioEngine.resume();
```

Or use the convenience method on scene:

```typescript
const audioEngine = await scene.createAudioEngineAsync();
```

## Creating Audio Buses (Mix Groups)

Buses replace `SoundTrack`. Create one per logical channel:

```typescript
import { CreateAudioBusAsync } from "@babylonjs/core/AudioV2/audioBus";

const musicBus = await CreateAudioBusAsync("music", { volume: 0.5 });
const sfxBus = await CreateAudioBusAsync("sfx", { volume: 1.0 });
const uiBus = await CreateAudioBusAsync("ui", { volume: 1.0 });
const ambientBus = await CreateAudioBusAsync("ambient", { volume: 0.7 });

// Set volume at any time
musicBus.setVolume(0.3, 500); // 500ms linear crossfade
```

Overdrive uses 4 buses: `music`, `sfx`, `ui`, `ambient` (see ADR-0020).

## Loading and Playing Sounds

### Short Sounds (Static — supports playbackRate)

```typescript
import { CreateSoundAsync } from "@babylonjs/core/AudioV2/staticSound";

// Create a WAV loop for engine sound (2-4s recommended for pitch shifting)
const engineLoop = await CreateSoundAsync("engine", "audio/engine.wav", {
  loop: true,
  autoPlay: false,
  maxInstances: 8, // native — no manual pool needed
});

// Connect to a bus
engineLoop.connectToBus(sfxBus);

// Pitch shift (alter speed without changing pitch)
engineLoop.playbackRate = 1.2; // 20% faster

// One-shot SFX
const crashSfx = await CreateSoundAsync("crash", "audio/crash.wav", {
  maxInstances: 5,
});

// Spatial audio: attach to mesh in 3D scene
import { CreateSpatialAudioProps } from "@babylonjs/core/AudioV2/spatialAudio";

crashSfx.connectToBus(sfxBus);
// Spatial properties set during creation
```

### Long Audio (Streaming — no playbackRate)

```typescript
import { CreateStreamingSoundAsync } from "@babylonjs/core/AudioV2/streamingSound";

const music = await CreateStreamingSoundAsync("music", "audio/theme.mp3");
music.connectToBus(musicBus);
music.play();
```

### Wrapping a Raw AudioNode

```typescript
import { CreateSoundSourceAsync } from "@babylonjs/core/AudioV2/soundSource";

// Create an oscillator as an overlay on an existing bus
const oscillatorCtx = new AudioContext();
const oscillator = oscillatorCtx.createOscillator();
oscillator.type = "sawtooth";
oscillator.frequency.value = 220;

const source = await CreateSoundSourceAsync("oscOverlay", {
  source: oscillator,
});
source.connectToBus(sfxBus);
```

## Spatial Audio

```typescript
// Positional sound (attached to 3D mesh)
const engineSound = await CreateSoundAsync("engine", "audio/engine.wav", {
  loop: true,
  spatial: true,
  maxDistance: 100,
});

// Attach to a mesh (follows automatically)
engineSound.attachToMesh(carMesh);

// Directional cone (e.g., car exhaust)
engineSound.setDirectionalCone(90, 180, 0);
```

## Audio Context Unlock

Mobile/desktop browsers require user interaction before audio can play:

```typescript
// Automatic — set during init
audioEngine.resumeOnInteraction = true;

// Or manual
await audioEngine.unlockAsync();
```

## Volume Transitions (Crossfade)

```typescript
bus.setVolume(targetVolume, transitionDurationMs);
// Example: crossfade between GSM states in 500ms
musicBus.setVolume(0.0, 500); // fade out
ambientBus.setVolume(0.8, 500); // fade in
```

## Real-Time Reads

For audio that responds to game state (engine RPM, speed), read physics data directly each tick:

```typescript
// Audio reads from Physics each tick (60 Hz)
const rpm = physics.getEngineRPM(carId);
const speed = physics.getSpeed(carId);
const throttle = physics.getThrottle(carId);
const lateralG = physics.getLateralG(carId);
const gear = physics.getGear(carId);

// Map RPM to playbackRate
engineSound.playbackRate = 0.8 + (rpm / maxRpm) * 0.6;
```

## Important Notes

- Audio Engine V2 is default in v9 — no special setup or flag needed
- Legacy `Sound` class is deprecated (v8.0) — TypeScript shows deprecation warnings, do not use
- `SoundTrack` does not exist in V2 — use `CreateAudioBusAsync` instead
- `StaticSound.playbackRate` supports pitch shift (WAV loops only, not MP3)
- `CreateStreamingSoundAsync` (MP3) does NOT support `playbackRate`
- Engine sound: use 2-4s WAV loop + `playbackRate` for pitch shifting
- `maxInstances` is native in V2 — no manual collision pool needed
- Always call `sound.dispose()` when cleaning up a scene
- Monitor audio performance via browser DevTools (Web Audio tab)
