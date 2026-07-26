# Audio System

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Speed You Can Feel

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Procedural engine, race SFX, ambience, and event stings for local races. |
| MVP architecture constraints | Audio consumes explicit local race events and state. |
| Alpha | Adaptive soundtrack if approved. |
| Beta | Not designed. |
| Release | Not designed. |

### Review Boundary
Adaptive music and future spatial features are non-blocking during MVP review.

## Overview

**Audio System** delivers engine feedback, environmental sounds, and music stings during gameplay. MVP approach: engine sounds as primary audio layer (procedural, RPM-based), SFX for impacts/tires/pit, music stings at key moments (start, final lap, finish). Full adaptive soundtrack deferred to Alpha. The audio system creates the sensory feedback loop that makes speed feel real — without engine pitch rising with RPM, the player has no auditory confirmation of acceleration.

## Player Fantasy

**Framing:** Direct — the player actively hears and reacts to audio during races.

**Emotional target:** Two layers:

1. **The Engine Speaks (car as co-pilot):** Engine pitch rises with RPM, tire squeal warns of grip loss, wind rush confirms speed. The car tells you what it's doing through sound. Anchor: lap 3, you lift off throttle — engine pitch drops, wind decreases, you feel the deceleration before the speedometer confirms it.

2. **The Moment Sings (music as punctuation):** Music stings mark key moments — the starting lights, the final lap, the finish. Not a continuous soundtrack, but deliberate emotional beats. Anchor: final lap begins, music sting hits, the race intensity doubles.

**Pillar alignment:** Speed You Can Feel — audio feedback is the fastest channel for speed perception. Every Short Race Matters — music stings mark race progression.

**Design test:** Can the player tell their speed and RPM from engine pitch alone, without looking at the HUD?

## Detailed Design

### Core Rules

**1. Audio Layers**

The audio system mixes 5 independent layers. Each layer has its own volume control routed through the Settings mixer groups. Layers stack additively.

| # | Layer | Content | Update Rate | Mixer Group |
|---|-------|---------|-------------|-------------|
| 1 | **Engine** | Procedural engine oscillator (RPM-based pitch) | Snapshot target per physics tick; parameter smoothing at DSP rate | SFX |
| 2 | **SFX** | Tire squeal, wall impact, surface noise, pit sounds, wind | Per event or continuous | SFX |
| 3 | **Music** | Background music tracks, stings at key moments | Per beat / per event | Music |
| 4 | **Ambient** | Crowd, PA system, environmental (track-specific) | Continuous loop | SFX |
| 5 | **UI** | Menu clicks, navigation sounds, rebinding feedback, confirmation tones | Per event | UI |

**Priority rule:** Engine + SFX share the SFX mixer group. If SFX volume is 0, engine is also muted. This is by design — engine IS a sound effect, not music.

**2. Engine Sound — Procedural RPM Oscillator**

Engine sound is generated procedurally, not from samples. A two-oscillator model creates a realistic engine drone:

| Component | Formula | Description |
|-----------|---------|-------------|
| **Base frequency** | `f_base = RPM × cylinders / (60 × 2)` | Fundamental engine frequency |
| **Harmonic frequency** | `f_harmonic = 2 × f_base` | Second oscillator harmonic |
| **Pitch multiplier** | `pitch = f_base × fuel_factor × gear_ratio` | Final audible pitch |
| **Amplitude** | `amp = 0.3 + 0.7 × throttle` | louder under load |

**Variables:**

| Symbol | Type | Range | Description |
|--------|------|-------|-------------|
| RPM | float | 800–14000 | Engine revolutions per minute (from Vehicle Physics) |
| cylinders | int | 6–12 | Per-car constant from Car Definition Data |
| fuel_factor | float | 0.85–1.0 | Pitch scaling based on fuel level (from Fuel System) |
| gear_ratio | float | 0.4–1.2 | Gear-dependent pitch multiplier (from Vehicle Physics) |
| throttle | float | 0.0–1.0 | Current throttle input (from Vehicle Physics) |

**Output Range:** Formula output is clamped to the audible range 40–20000 Hz. With the declared RPM, cylinder, fuel, and gear ranges, the unclamped output spans approximately 16–16800 Hz; the audible output therefore bottoms at 40 Hz.

**Fuel factor curve:**

| Fuel Level | fuel_factor | Effect |
|------------|-------------|--------|
| 100%–50% | 1.00 | No pitch change |
| 50%–25% | 0.98–0.95 | Subtle pitch drop (perception, not physics) |
| 25%–1% | 0.95–0.90 | Noticeable pitch drop |
| 0% | 0.85 | Engine cuts — see Rule 7 |

**Fuel Critical Stinger:**

When fuel_level crosses from 25% or higher to below 25%, play `fuel_critical_stinger` once. Do not replay it while fuel remains below 25%; retrigger only after fuel rises back to 25% or above and crosses below again.

**Gear ratio table (6-speed gearbox):**

| Gear | gear_ratio | Typical RPM at 200 km/h |
|------|------------|------------------------|
| 1 | 0.40 | 3000 |
| 2 | 0.55 | 4500 |
| 3 | 0.70 | 6000 |
| 4 | 0.85 | 8000 |
| 5 | 1.00 | 10000 |
| 6 | 1.15 | 12000 |

**3. Tire Squeal**

Tire squeal is a continuous sound triggered by grip loss. Volume and normalized retrigger rate scale with wear. Pitch stays constant.

| Parameter | Formula | Description |
|-----------|---------|-------------|
| **Trigger** | `squeal_active = (grip_loss > 0.15) AND (speed > 30 km/h)` | Active when lateral slide exceeds threshold |
| **Volume** | `squeal_vol = grip_loss × (0.25 + 0.75 × wear_percent / 100) × sfx_volume` | Audible on new tires and louder with wear |
| **Pitch** | `squeal_pitch = 1200 Hz` | Constant — not affected by wear |
| **Retrigger rate** | `squeal_event_rate_mult = 0.1 + 0.9 × (wear_percent / 100)` | More frequent with wear; normalized event-rate multiplier, not an audio frequency |

**Variables:**

| Symbol | Type | Range | Description |
|--------|------|-------|-------------|
| grip_loss | float | 0.0–1.0 | Lateral slide magnitude (from Vehicle Physics) |
| wear_percent | float | 0–100 | Current tire wear (from Tire System) |
| speed | float | 0–350 | Current speed in km/h (from Vehicle Physics) |

**Output Range:**
- 0% wear: squeal at 1200 Hz, quarter-volume ceiling, only in hard corners
- 50% wear: squeal at 1200 Hz, medium volume, frequent in corners
- 75%+ wear: squeal at 1200 Hz, maximum volume, constant in corners (per Tire System contract)
- 100% wear: squeal at 1200 Hz, maximum, continuous when cornering

**4. SFX Categories**

| Category | Trigger | Sound | Volume Source |
|----------|---------|-------|---------------|
| **Wall Impact** | Car hits wall (Vehicle Physics: WallHit state) | Metallic crunch, pitch = f(impact_speed) | Impact speed → 0.3–1.0 |
| **Surface Noise** | Car on gravel/grass (gripState: OffTrack) | Continuous rumble | Surface type → 0.4–0.8 |
| **Wind** | Speed > 100 km/h | Continuous whoosh | Speed → 0.0–1.0 (linear 100–300 km/h) |
| **Pit Entry** | Car enters pit lane | Air gun, wrench sounds | Fixed volume 0.8 |
| **Pit Service** | Pit stop active | Fuel nozzle, tire swap | Fixed volume 0.7 |
| **Pit Exit** | Car leaves pit lane | Engine rev, tire chirp | Fixed volume 0.6 |
| **Lap Complete** | Cross start/finish line | Checkpoint chime | Fixed volume 0.7 |
| **Countdown** | Five-light, five-beep countdown; one beep per second and GO immediately after the fifth light | Countdown beeps | Fixed volume 0.9 |

**Wall impact pitch formula:**

`impact_pitch = 200 + 800 × (impact_speed / 350)`

| Symbol | Type | Range | Description |
|--------|------|-------|-------------|
| impact_speed | float | 0–350 | Speed at moment of impact (km/h) |

Low-speed tap: 200–400 Hz (thud). High-speed slam: 800–1000 Hz (crunch).

**5. Music Stings**

Music stings are short musical phrases that trigger at key race moments. They overlay the background music track.

| Sting | Trigger | Duration | Description |
|-------|---------|----------|-------------|
| **Race Start** | Countdown reaches "GO" | 2–3s | High-energy sting, matches tempo of background track |
| **Final Lap** | Lap count = total laps | 3–5s | Rising tension sting, tempo increase |
| **Finish** | Cross finish line (race complete) | 4–6s | Victory/defeat sting based on final position |
| **Pit Entry** | Car enters pit lane | 1–2s | Tension sting, low energy |

**Sting rules:**
- Stings duck background music by 6 dB during playback
- Stings do NOT interrupt music — they layer on top
- Maximum 1 sting active at a time (priority: Finish > Final Lap > Race Start > Pit Entry)
- If two triggers fire within 2s, the higher-priority one wins

**6. Audio States**

| State | Engine | SFX | Music | Ambient |
|-------|--------|-----|-------|---------|
| **Race** | Active (RPM-driven) | Active (all categories) | Background track + stings | Active (track-specific) |
| **Qualifying** | Active (RPM-driven) | Active (all categories) | Background track (no stings) | Active |
| **PitTransit/Exiting** | Active with pit-lane RPM cap | Pit entry/exit SFX; wind follows pit movement | Background track | Active |
| **InPitBox** | Stationary service state | Service SFX; wind off | Background track (ducked) | Active |
| **Menu** | Off | UI sounds only | Menu music | Off |
| **Countdown** | Idle RPM (800) | Countdown beeps | Background track (low) | Active |
| **Finished Presentation** | Active while the player-car presentation runs | Finish sting already played; engine presentation state remains owner-defined | Results music may begin after Finish sting | Crowd fade-in |
| **Results** | Off | UI/result SFX | Results music | Crowd fade-in |

**7. Engine Cut (Fuel = 0%)**

When fuel_level reaches 0%:
- Engine oscillator amplitude fades to 0 over 0.5s (not instant — perception)
- RPM freezes at current value (no idle)
- Remaining audible: wind, tire squeal, surface noise only
- Engine does NOT restart until pit stop refuels (fuel_level > 0%)

**8. Off-Track Audio Modifier**

When gripState = OffTrack:
- Engine volume reduced by 30% (car is not under load)
- Surface noise activates (gravel/grass rumble)
- Tire squeal retrigger rate increases (more sliding)

### States and Transitions

| From | To | Trigger | Audio Change |
|------|----|---------|--------------|
| Menu/Loading | Countdown | `RaceLoadReady(RaceMode.Race, gridAssignment)` accepted | Menu/loading music fades, engine idle starts |
| Countdown | Race | "GO" signal | Race start sting, full engine, all SFX active |
| Race | PitTransit/Exiting | Car enters pit lane | Pit entry sting, engine RPM capped; wind follows pit movement |
| PitTransit/Exiting | InPitBox | Car reaches pit box | Service SFX, engine stationary state, wind off |
| InPitBox | PitTransit/Exiting | Pit service enters Exiting | Engine revs, tire chirp, pit movement audio resumes |
| PitTransit/Exiting | Race | Car leaves pit lane | Wind returns to racing state |
| Race | Finished Presentation | Player crosses finish line | Finish sting, engine presentation state, results music may begin after the sting |
| Finished Presentation | Results | Presentation dismissed after resolution completes | Engine stops, Results music/UI state takes over |
| Menu/Loading | Qualifying | `RaceLoadReady(RaceMode.Qualifying)` accepted | Engine/ambience enter Qualifying state; background track continues without race stings |
| Qualifying | Finished Presentation | Flying lap completes or fails | Terminal presentation audio begins; no direct Qualifying → Race transition |
| Results | Menu | Player exits results and `ContentUnloadComplete` permits Simulation to enter Idle | Results music fades, menu music starts |
| Race | Race | Fuel hits 0% | Engine fades to silence over 0.5s |
| Race | Race | Fuel refilled (pit) | Engine fades back in over 0.3s |

### Interactions with Other Systems

| System | Direction | Data | Interface | Timing |
|--------|-----------|------|-----------|--------|
| **Vehicle Physics** | Inbound | RPM, speed, throttle, gear, gripState, wall contact, slide state | CarState snapshot | Per physics tick (60 Hz) |
| **Tire System** | Inbound | wear_percent (0–100%), grip_multiplier | TireState | Per physics tick |
| **Fuel System** | Inbound | fuel_level (0–100%), fuel_state | FuelState | Per physics tick |
| **Track** | Inbound | surface_type (asphalt/gravel/grass) | SurfaceData | Per physics tick |
| **Settings** | Inbound | Master, Music, SFX, UI volumes, Mute state | AudioSettings | Working-copy preview immediately; persisted only after successful Apply |
| **Camera** | Inbound | Camera mode (cockpit/chase), camera speed | CameraState | Per frame; Audio adjusts engine/ambient mix for cockpit (internal) vs chase (external) |
| **Pit Stop** | Bidirectional | pit_state (entry/service/exit) → audio triggers | PitEvent | On state change |
| **Car Definition Data** | Inbound | cylinders count, engine type | CarAudioProfile | On car select (once per race) |
| **Simulation** | Inbound | `SimulationState`, countdown ticks, Finished Presentation, Results | SimulationSnapshot | Per tick/state transition |
| **Race Session Manager** | Inbound | lap completion, final-lap event, finish classification | RaceEvent | On event |

## Formulas

**Current live values:** see Audio configuration (no ScriptableObject — audio values are designer-tuned via Audio Mixer).

### Engine Pitch

`engine_pitch = (RPM × cylinders / 120) × fuel_factor × gear_ratio`

**Output Range:** 40 Hz to 20000 Hz (clamped). Typical audible output: 40 Hz at idle after clamping to approximately 8000 Hz near redline for the reference profile.

### Tire Squeal Volume

`squeal_vol = grip_loss × (0.25 + 0.75 × wear_percent / 100) × sfx_volume`

**Output Range:** 0.0 (no slide) to 1.0 (full slide, bald tires at maximum SFX volume); at full slide with new tires, volume is 0.25.

### Wall Impact Pitch

`impact_pitch = 200 + 800 × (impact_speed / 350)`

**Output Range:** 200 Hz (tap) to 1000 Hz (slam).

### Wind Volume

`wind_vol = clamp((speed - 100) / 200, 0, 1) × sfx_volume`

**Output Range:** 0.0 (below 100 km/h) to 1.0 (above 300 km/h).

## Edge Cases

- **If fuel reaches 0% mid-corner:** Engine fades over 0.5s. Tire squeal and wind continue. Player coasts on inertia.
- **If fuel is refilled after 0%:** Engine fades back in over 0.3s. Pitch resumes at current RPM.
- **If player mutes SFX:** Engine, tire squeal, wall impact, wind, pit sounds all muted. Music continues.
- **If player mutes Music:** Background music and stings muted. Engine and SFX continue.
- **If two stings trigger within 2s:** Higher-priority sting wins (Finish > Final Lap > Start > Pit).
- **If car is stationary (speed = 0):** Engine plays at idle RPM (800). No wind. No tire squeal.
- **If qualifying session:** Same as race but no stings. Background music continues.
- **If WebGL audio context is suspended:** Audio resumes on first user interaction (browser policy).

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Vehicle Physics** | Inbound | RPM, speed, throttle, gear, gripState | Hard — drives engine + SFX |
| **Tire System** | Inbound | wear_percent, grip_multiplier | Hard — drives tire squeal |
| **Fuel System** | Inbound | fuel_level, fuel_state | Hard — drives engine pitch/cut |
| **Track** | Inbound | surface_type | Hard — drives surface noise |
| **Settings** | Inbound | volumes, mute | Hard — drives all audio levels |
| **Camera** | Inbound | camera mode, camera speed | Hard — drives engine/ambient mix for cockpit vs chase |
| **Pit Stop** | Bidirectional | pit_state → audio triggers | Hard — drives pit sounds |
| **Car Definition Data** | Inbound | cylinders, engine type | Hard — drives engine character |
| **Simulation** | Inbound | SimulationState, countdown, terminal presentation, Results | Hard — drives state-specific audio |
| **Race Session Manager** | Inbound | lap, final-lap, finish events | Hard — drives stings |

## Tuning Knobs

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Engine base frequency | 800 Hz idle | 400–1200 Hz | Engine sounds weak | Engine sounds too high |
| Tire squeal threshold | 0.15 grip_loss | 0.05–0.30 | Squeal too sensitive | Squeal never triggers |
| Wind onset speed | 100 km/h | 50–150 km/h | Wind too early | Wind too late |
| Sting duck amount | 6 dB | 3–12 dB | Sting doesn't stand out | Music disappears |
| Engine cut fade time | 0.5s | 0.2–1.0s | Too instant (jarring) | Too slow (confusing) |
| Engine restore fade time | 0.3s | 0.1–0.5s | Too instant | Too slow |

## Visual/Audio Requirements

- **Engine:** Procedural oscillator, not samples. Two-oscillator model for richness.
- **Tire squeal:** Constant pitch (1200 Hz), volume scales with wear.
- **Wall impact:** Pitch scales with impact speed (200–1000 Hz).
- **Wind:** Continuous whoosh, volume scales with speed (100–300 km/h).
- **Pit sounds:** Air gun, wrench, fuel nozzle — fixed samples.
- **Music stings:** Short musical phrases (2–6s), duck background by 6dB.
- **Ambient:** Track-specific loops (crowd, PA, environmental).

## UI Requirements

No UI requirements for this system. Audio is controlled via Settings (already designed).

## Acceptance Criteria

- **GIVEN** a 10-cylinder car at 8000 RPM in 4th gear with full fuel, **WHEN** engine sound is played, **THEN** pitch is approximately 5667 Hz before audio smoothing and clamping.
- **GIVEN** fuel at 0%, **WHEN** engine sound is active, **THEN** engine fades to silence over 0.5s ± 0.1s.
- **GIVEN** fuel refilled after 0%, **WHEN** engine resumes, **THEN** pitch fades back in over 0.3s ± 0.1s.
- **GIVEN** fuel crosses from 25.1% to 24.9%, **WHEN** race audio is active, **THEN** `fuel_critical_stinger` plays once and does not loop while fuel remains below 25%.
- **GIVEN** tire at 75% wear, `grip_loss = 1.0`, and `sfx_volume = 1.0`, **WHEN** squeal is active, **THEN** volume is 0.8125 and the normalized retrigger rate is 0.775.
- **GIVEN** tire at 0% wear, `grip_loss = 1.0`, and `sfx_volume = 1.0`, **WHEN** squeal is active, **THEN** volume is 0.25 and squeal is limited to hard corners.
- **GIVEN** car hits wall at 200 km/h, **WHEN** impact sound plays, **THEN** pitch is approximately 657 Hz.
- **GIVEN** speed at 250 km/h, **WHEN** wind sound is active, **THEN** volume is approximately 0.75.
- **GIVEN** player mutes SFX in Settings, **WHEN** race is active, **THEN** engine and all SFX are silent, music continues.
- **GIVEN** final lap begins, **WHEN** music sting triggers, **THEN** background music ducks by 6 dB for 3–5 seconds.
- **GIVEN** two stings trigger within 2s (e.g., pit entry + final lap), **WHEN** priority is resolved, **THEN** higher-priority sting plays, lower is discarded.
- **GIVEN** Countdown begins, **WHEN** five seconds elapse at 60 Hz, **THEN** five countdown beeps have played at one-second intervals and the GO sting plays immediately after the fifth light.

## Open Questions

- **Engine sound per car:** Ownership is resolved: Car Definition supplies `engineCylinders` and `engineType`; Audio supplies the procedural interpretation. Concrete per-team values are assigned during the Car Definition review.
- **Adaptive music (Alpha):** When should adaptive music be added? Per-biome? Per-race-state? Per-position?
- **3D spatial audio:** Should rival engine sounds be spatialized (3D positioned)? Or is stereo sufficient for arcade?
- **Audio memory budget:** How many simultaneous audio sources can WebGL handle before performance degrades?
- **Pit stop audio:** MVP uses the existing Pit Entry sting; a separate service sting is deferred with adaptive/spatial audio work.
