# ADR-0012: Audio System Architecture

## Status

Accepted

## Date

2026-07-28

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Audio |
| **Knowledge Risk** | LOW — Unity Audio Mixer API is stable and unchanged across Unity 6 releases |
| **References Consulted** | `docs/engine-reference/unity/modules/audio.md`, `docs/engine-reference/unity/deprecated-apis.md`, `design/gdd/audio-system.md`, `design/gdd/car-definition-data.md`, `docs/architecture/architecture.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | 2-oscillator procedural engine CPU cost ≤0.1ms per frame; AudioSystem.Tick total ≤0.4ms |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (SimulationState for audio state transitions, LateUpdate interpolation phases). ADR-0002 (CarState: Rpm, Gear, Speed, State, PitPhase, SlideState, Surface). ADR-0003 (Content Pipeline — audio assets load via Addressables groups Shared and Cars/{teamId}). ADR-0004 (AudioSettings per-mixer-group volume). ADR-0006 (FuelState: fuelLevel for engine pitch drop, lowFuelActive for stinger). ADR-0010 (LateUpdate consumption pattern shared with CameraSystem, VfxSystem) |
| **Enables** | Audio implementation in Pre-Production |
| **Blocks** | None |
| **Ordering Note** | AudioSystem follows the same LateUpdate pattern as CameraSystem and VfxSystem (ADR-0010, ADR-0001 §Interpolation Phases). Per-car audio data (cylinders) must be finalized in CarDef SO before audio story creation |

## Context

### Problem Statement

Overdrive's audio GDD (210 lines) defines 5 audio layers (engine, tire, music, UI, ambient) that map onto 3 mixer groups, a procedural engine formula (2-oscillator), tire squeal with wear scaling, 8 SFX categories, music stings, and a 9-state audio machine. But no architectural decision exists on: which audio engine to use (Unity Audio Mixer vs FMOD/Wwise), how to generate engine sound (procedural vs samples), system boundary (who owns what), performance budget, and the seam for future sample replacement.

### Constraints

- **No FMOD/Wwise installed** — dependency must be zero at MVP. Adding middleware requires separate approval and package installation.
- **3 engine types only** (V8, V10, V12 per 1989-1990 F1) — not 16 unique engines. Fallback to samples is viable with only 3 base profiles.
- **Unity Audio Mixer** is installed and stable. 3 groups (Master → Music/SFX/UI). Layer-to-group reconciliation (review v4 LOW): the GDD's 5 layers are routing SOURCES (engine and tire both route through SFX); the 3 mixer groups are the routing topology; ADR-0004 exposes 4 player-facing volume settings (Master, Music, SFX, UI — one per group). No discrepancy: layers = sources, groups = mixers, volumes = settings.
- **LateUpdate consumption** per ADR-0001 §Interpolation Phases — AudioSystem runs in LateUpdate, not per tick.
- **Addressables 3.1.0** for audio asset loading (Shared group for UI/engine, Tracks/{trackId} for ambient).

### Requirements

- Must generate engine sound from RPM, gear, throttle, fuel level (procedural-first)
- Must support tire squeal volume scaling with wear_percent (TR-audio-003: `squeal_active = (grip_loss > 0.15) AND (speed > 30 km/h)`; `squeal_vol = grip_loss × (0.25 + 0.75 × wear_percent/100) × sfx_volume`; pitch constant 1200 Hz; `squeal_event_rate_mult = 0.1 + 0.9 × wear_percent/100`)
- Must support 8 SFX categories triggered from CarState events
- Must support 4 music stings with priority and ducking rules (TR-audio-002: named stings `race_start_sting`, `final_lap_sting`, `finish_sting`, `pit_entry_sting`; duck background music by 6 dB during playback; max 1 sting active at a time — priority Finish > Final Lap > Race Start > Pit Entry; two triggers within 2s → higher priority wins)
- Must support 9 audio states mirroring SimulationState
- Must support AudioSettings volume per mixer group (Master/SFX/Music/UI)
- Must support replacement of engine sound implementation without changing AudioSystem public interface
- Total frame budget: ≤0.4ms (engine ≤0.1ms, tire + SFX + music + ambient ≤0.3ms)

## Decision

Audio System uses **Unity Audio Mixer** with **procedural-first engine generation** (2-oscillator runtime synthesis). Engine sound is abstracted behind `IEngineSoundProvider` — a replaceable seam that allows swapping procedural generation for pre-recorded samples (from Asset Store or custom recording) without changing `AudioSystem`.

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      AudioSystem                             │
│  (standalone class, LateUpdate per ADR-0001 §Interpolation Phases)│
│                                                              │
│  Tick(CarAudioState[], AudioMixState, AudioSettings)         │
│    ├─ _engineSound.Update(carState, audioSource)  ← SEAM    │
│    ├─ UpdateTireSqueal(carStates, settings)                 │
│    ├─ UpdateSfx(carStates, settings)                        │
│    ├─ UpdateMusicStings(state)                              │
│    └─ UpdateAmbience(trackId, state)                        │
│                                                              │
│  IEngineSoundProvider ← injetado no construtor               │
│    ├─ ProceduralEngineProvider (MVP) — 2 oscillators         │
│    ├─ SampleEngineProvider (fallback) — pre-recorded clips   │
│    └─ HybridEngineProvider (future) — procedural + overlay   │
└──────────────────────────────────────────────────────────────┘
```

### Key Interfaces

```csharp
// Audio System — runs in LateUpdate per frame (per ADR-0001 §Interpolation Phases)
public class AudioSystem {
    public AudioSystem(IEngineSoundProvider engineSound);  // seam for future swap

    public void Tick(
        CarAudioState[] carAudioStates,   // per-car audio-relevant state
        SimulationState simState,          // Menu/Countdown/Racing/Finished/Results
        RaceMode raceMode,                 // Race/Qualifying (for stings gating)
        PitPhase pitPhase,                 // from VP — transit/inbox/exiting states
        CameraMode cameraMode,             // cockpit vs chase (engine mix)
        AudioSettings settings            // volume per mixer group
    );
}

// The seam — replace without changing AudioSystem
public interface IEngineSoundProvider {
    void Update(in CarAudioState state, AudioSource target);
}

// MVP: procedural 2-oscillator (covers V8/V10/V12 via cylinders parameter)
public class ProceduralEngineProvider : IEngineSoundProvider {
    public void Update(in CarAudioState state, AudioSource target) {
        // f_base = state.Rpm * state.Cylinders / (60 × 2)
        // f_harmonic = 2 × f_base
        // pitch = f_base × fuelFactor × gearRatio
        // amp = 0.3 + 0.7 × throttle
    }
}

// Fallback: pre-recorded clips per engine type
public class SampleEngineProvider : IEngineSoundProvider {
    // 3 engine profiles (V8/V10/V12) × 6 gears = 18 max clips
}

// Data consumed per car per frame
public struct CarAudioState {
    public int CarId;
    public float Rpm;               // from VP
    public int Gear;                // from VP
    public float SpeedKmh;          // from VP
    public float Throttle;          // from VP
    public float FuelLiters;        // currentFuel 0-8.0L from FuelSystem
    public bool LowFuelActive;      // fuel < 25% (from FuelState)
    public float SlideState;        // normalized lateral slip 0.0-1.0 (from CarState)
    public float WearPercent;       // from TireSystem
    public CarStateEnum CarState;   // Driving/OffTrack/WallHit/Pitting/GridLocked
    public PitPhase PitPhase;       // from VP
    public SurfaceType Surface;     // from Track
    public int EngineCylinders;     // from CarDef.AudioProfile (8/10/12)
}

// Per-car audio profile (serialized by CarDefinition — see car-definition-data.md)
// engineType is removed; CarDefinition.AudioProfile is the single owner.
[Serializable]
public struct CarAudioProfile {
    [SerializeField] int _engineCylinders;
    [SerializeField] float _engineBasePitch;
    [SerializeField] ExhaustNote _exhaustNote;

    public int EngineCylinders => _engineCylinders;       // 8, 10, or 12
    public float EngineBasePitch => _engineBasePitch;      // 0.8-1.2 (engine character)
    public ExhaustNote ExhaustNote => _exhaustNote;        // Standard, Deep, Sharp
}

public enum ExhaustNote : byte { Standard, Deep, Sharp }
```

### Audio Mixer Hierarchy

```
Master
  ├── Music (background tracks + stings)
  ├── SFX  (engine + tire + impacts + surfaces + wind + ambient)
  └── UI   (menu clicks, navigation, rebinding)
```

Engine routes through the SFX group per GDD Rule 1 — if SFX is muted, engine is also muted.

### Asset Loading

| Asset | Group | Load Time |
|-------|-------|-----------|
| UI sounds (clicks, navigation, rebinding) | Shared | Startup |
| Menu music | Shared | Startup |
| Music stings (start, final lap, finish, pit entry) | Shared | Startup |
| Ambient loops (per track) | Tracks/{trackId} | Race init |
| Engine samples (if fallback used) | Cars/{teamId} | Per-car load |

## Alternatives Considered

### Alternative 1: Pre-recorded engine samples per car (Rejected)
- **Description**: Record or license 16 unique engine profiles, each with 6 gear × RPM sweeps
- **Pros**: Highest realism, authentic to each car's real engine
- **Cons**: 96+ sample sets, expensive to produce, heavy on Addressable bundles, procedural covers all with 2 oscillators
- **Rejection Reason**: Procedural-first costs zero assets and covers all 3 engine types (V8/V10/V12) via the `cylinders` parameter. If procedural proves insufficient, only 3 sample sets needed (not 16).

### Alternative 2: FMOD/Wwise middleware (Rejected)
- **Description**: Install FMOD or Wwise for advanced mixing, DSP, and spatial audio
- **Pros**: Professional audio pipeline, future spatial audio, designer-friendly
- **Cons**: Not installed, licensing cost, build pipeline complexity, over-engineered for MVP arcade racing with procedural engine
- **Rejection Reason**: Unity Audio Mixer covers all MVP needs (5 layers, 9 derived states, procedural generation). Adding middleware is a future-phase decision requiring its own ADR, package installation, and build pipeline changes.

## Consequences

### Positive
- **Seam for future replacement**: Engine sound can evolve from procedural → pre-recorded → Asset Store pack without changing AudioSystem, TireSqueal, Music, or any other audio subsystem.
- **No middleware dependency**: Unity Audio Mixer is built-in, zero licensing, zero build pipeline changes.
- **Procedural-first is cheap**: 2 oscillators at ≤0.1ms. If it works, zero asset cost. If it doesn't, only 3 sample sets needed.
- **Small per-car data footprint**: Only 3 new fields (EngineBasePitch, ExhaustNote, Cylinders already exists). CarDef SO stays lightweight. engineType field is removed in favor of the structured audio profile.

### Negative
- **Procedural may sound "synthetic"**: 2-oscillator model may not convince players accustomed to Forza/GT audio. Mitigation: IEngineSoundProvider seam allows seamless swap to samples or purchased pack.
- **No spatial audio**: All audio is 2D in MVP. Engine is always full-volume. Future spatial (exhaust left/right, environment reverb) requires additional work.

### Risks
- Procedural engine fails playtest → fallback to samples adds asset production time. Mitigation: prototype procedural engine in Sprint 1 of Pre-Production; if rejected, purchase Asset Store pack and implement SampleEngineProvider in Sprint 2.
- Audio state machine drifts from SimulationState → false silence or missed stings. Mitigation: Tick() receives SimulationState, RaceMode, PitPhase as separate params — no fourth enum to maintain.
- `AudioClip.Create` `_3D` overload deprecated in Unity 6000.3. Mitigation: engineering team must use the overload without `_3D` parameter; use `AudioSource.spatialBlend` for 2D/3D control.
- PCMReaderCallback fires on the audio thread, not main thread. RPM/frequency values computed on main thread must reach the callback thread-safely. Mitigation: single-slot immutable parameter snapshot with atomic reference swap — `Volatile.Write`/`Interlocked.Exchange` on the main thread, `Volatile.Read` on the audio thread. A multi-field FIFO/ring buffer is REJECTED: the audio callback cadence (~188 Hz at 48 kHz / 256 samples) exceeds the 60 Hz sim tick, so a queue accumulates lag, and a multi-field latest-wins struct can tear. Keep the oscillator running through focus-loss/pause with last-known parameters; guard denormals; use `AudioSettings.outputSampleRate`. Audio-thread side budget: 16 cars × PCMReaderCallback must fit the DSP buffer period (≤0.1 ms main-thread budget covers the swap).

## GDD Requirements Addressed

| GDD | Requirements |
|-----|--------------|
| audio-system.md | 5 audio layers, procedural engine formula (2-oscillator), tire squeal with wear scaling, 8 SFX categories, 4 music stings, 9 audio states, engine cut at 0% fuel, off-track audio modifier, Settings mixer groups |
| car-definition-data.md | CarAudioProfile fields (Cylinders, EngineBasePitch, ExhaustNote) in CarDef SO |
| settings.md | AudioSettings volume per mixer group (Master, SFX, Music, UI) |
| simulation-architecture.md | AudioMixState mirrors SimulationState (9 derived states) |

## Performance Implications

- **CPU**: ≤0.4ms per frame total. Engine oscillator ≤0.1ms (2 sine waves summed, AudioClip.Create reuse). Tire + SFX + music + ambient ≤0.3ms.
- **Memory**: Audio mixer assets trivial (~50KB). UI/menu sounds ~2-5 MB (Shared group, loaded at startup). Ambient loops ~10-20 MB per track (Tracks/{trackId}, loaded at race init). Engine samples (if used) ~3-5 MB per engine type × 3 = ~15 MB max.
- **Load Time**: UI/menu sounds loaded at startup (Shared group <2s). Ambient loaded with track (Tracks/{trackId} <10s). Engine samples loaded with car (Cars/{teamId}).

## Validation Criteria

- [ ] Procedural engine oscillator tracks RPM within ±50 RPM of CarState value (perceptually transparent)
- [ ] Tire squeal volume increases with wear_percent (0% = quiet, 100% = loud continuous in corners)
- [ ] All 9 audio state transitions produce correct mixer group activity per audio-system.md table
- [ ] AudioSystem.Tick completes within 0.4ms (16-car simulation, single player engine full + 15 AI simplified)
- [ ] Engine pitch drops when fuel < 25% (fuelFactor 0.95-0.90 range)
- [ ] Fuel critical stinger plays once per crossing of 25% threshold (no retrigger while below)
- [ ] IEngineSoundProvider swap (Procedural → Sample) requires zero changes to AudioSystem.Tick
- [ ] No FMOD/Wwise references in codebase
- [ ] Engine cut at 0% fuel: oscillator amplitude fades to 0 over 0.5s (not instant), RPM freezes, wind/tire/ surface remain audible

## Related Decisions

- ADR-0001: SimulationState consumed for audio state transitions
- ADR-0002: CarState fields (Rpm, Gear, Speed, Throttle, State, PitPhase, SlideState, Surface)
- ADR-0004: AudioSettings struct with per-mixer-group volume
- ADR-0006: FuelState.fuelLevel for engine pitch drop, lowFuelActive for stinger
- ADR-0001: LateUpdate consumption pattern (shared with CameraSystem, VfxSystem per §Interpolation Phases)
- ADR-0003: Audio assets in Shared group (UI, stings, menu music) and Tracks/{trackId} (ambient loops)
