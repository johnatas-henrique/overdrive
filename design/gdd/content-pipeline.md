# Content Pipeline

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-21
> **Implements Pillar**: Every Short Race Matters

## Overview

**Content Pipeline** is the asset loading and packaging layer that manages how game content — cars, tracks, audio, UI, VFX — is organized into Addressable groups, loaded on demand per race, and unloaded when no longer needed. It ensures that only the assets required for the current race are in memory, keeping load times fast and memory usage controlled across PC and Web platforms. Without this system, all game content would be loaded at startup, consuming excessive memory and making builds unnecessarily large.

**Interaction:** Automatic — the player never interacts with it directly. They experience it as fast loading screens and smooth transitions between races.

**Why it exists:** Without managed content loading, a 16-car grid with 16 tracks and hundreds of assets would require gigabytes of memory at startup. The system enables per-race loading: load the track, the player's car, and 15 rival cars for one race, then unload everything before the next.

## Player Fantasy

**Framing:** Indirect — the player never thinks about Addressable groups, asset loading, or memory management. They think about the next race, the next rival, the next seat. This system is the invisible guarantee that the game is always ready when they are.

**Emotional target:** Zero friction. The player taps once and the engine is on. No waiting, no loading screens that break immersion, no "please wait" moments. The game is the constant; the player is the impulse.

**Anchor moment:** The 5 seconds after the chequered flag. Adrenaline still high. The player wants to rematch, retry, or just run it again. In that window — between "race over" and "race starting" — the Content Pipeline either disappears (success) or exposes itself (failure).

**Pillar alignment:** Speed You Can Feel — fast loads maintain momentum. Every Short Race Matters — quick retries keep the player in the flow.

**Design test:** Does the player ever notice a loading screen? If yes, this system has failed.

## Detailed Design

### Core Rules

**1. Content Groups**

Assets are organized into 3 Addressable groups:

| Group | Contents | Load Trigger | Unload Trigger |
|-------|----------|-------------|----------------|
| **Shared** | Core UI, HUD, common audio, shaders, loading screen | App startup | Never (persists for session) |
| **Cars/{TeamId}** | Car prefab, materials, textures, audio per team | Race load | Race end |
| **Tracks/{TrackId}** | Track mesh, environment, lighting, audio per track | Race load | Race end |

Each car and track has its own Addressable bundle. No monolithic bundles — enables individual memory tracking and incremental rebuilds.

**2. Loading Order**

Race loading is parallel where possible:

```
App Startup
→ Initialize Addressables catalog (~200-500ms first time)
→ Load SHARED group (once, persists)

Player selects race
→ Load Track bundle (async)
→ Load 16 Car bundles (async, parallel)
→ Show loading screen with progress bar
→ When all loaded: instantiate track, spawn 16 cars on grid
→ Transition to Countdown state
```

Loading screen progress is derived from byte counts of pending bundles.

**3. Memory Budget**

| Component | PC (8-16GB RAM) | WebGL (512MB-1GB heap) |
|-----------|----------------|----------------------|
| Runtime Unity | ~200-300 MB | ~180-250 MB |
| Shared (UI, HUD, shaders, audio) | ~40-60 MB | ~25-40 MB |
| Track (mesh, textures, lighting) | ~150-300 MB | ~60-100 MB |
| 16 Cars (models, textures, audio) | ~250-500 MB | ~100-200 MB |
| Render targets + buffers | ~50-100 MB | ~30-50 MB |
| Audio (engines, SFX) | ~40-60 MB | ~20-30 MB |
| **Total per race** | **~730-1320 MB** | **~415-670 MB** |

**Per-car budget:**
| Component | PC | WebGL |
|-----------|-----|-------|
| Model (LOD0 + LOD1 + LOD2) | ~3-5 MB | ~1.5-2.5 MB |
| Textures (base, normal, emission) | ~8-12 MB | ~3-5 MB |
| Materials + shader properties | ~0.5-1 MB | ~0.5-1 MB |
| Engine audio (RPM loops) | ~2-4 MB | ~1-2 MB |
| **Total per car** | **~14-22 MB** | **~6-10.5 MB** |

**4. Unloading Strategy**

- Full unload after every race — even if next race uses the same track
- Unload order: destroy instances first (`Addressables.ReleaseInstance`), then release base handles (`Addressables.Release`)
- Safety: `UnloadRace()` called at start of every `LoadRace()` — ensures previous race is fully unloaded before loading new one
- Never use `Destroy()` directly on Addressable instances — always `ReleaseInstance`

**5. WebGL Constraints**

- **Heap:** 768 MB minimum (Player Settings > WebGL > Memory Size)
- **Textures:** ASTC 6×6 compression, 1024px max for cars
- **LODs:** Mandatory 3 levels (LOD0 ~15-20K tri, LOD1 ~8-10K, LOD2 ~3-5K)
- **Bundle size:** Each car bundle ≤ 3MB in WebGL build
- **Quality profiles:** Low (WebGL) and High (PC) with different texture resolutions and post-processing
- **No graceful OOM recovery:** WebGL heap is fixed — `malloc` failure = crash

**6. Loading Screen**

- Progress bar derived from bytes loaded / total bytes
- Minimum 0.5s display (even if loading is instant) — prevents flash
- Blocks all input during loading
- First-launch catalog initialization: show "Preparing..." with spinner
- Simple VFX (particles, fade, or ambient animation) for visual polish — 2-3MB budget, negligible impact on 600MB+ total load

### States and Transitions

| State | Description | Assets Loading | Simulation |
|-------|-------------|---------------|------------|
| `Idle` | No race loaded; Shared only | No | No |
| `Loading Track` | Track bundle loading async | Track only | No |
| `Loading Cars` | 16 car bundles loading async (parallel with track) | Track + Cars | No |
| `Ready` | All assets loaded, instantiated on grid | Complete | No (countdown pending) |
| `Racing` | Active race; all systems running | Complete | Yes |
| `Unloading` | Destroying instances, releasing handles | Releasing | No |

**Transition rules:**

| From | To | Trigger |
|------|----|---------|
| `Idle` | `Loading Track` | Player selects race |
| `Loading Track` | `Loading Cars` | Track loaded (or parallel — both start together) |
| `Loading Cars` | `Ready` | All 16 cars loaded |
| `Ready` | `Racing` | Countdown reaches zero ("GO") |
| `Racing` | `Unloading` | Race finishes (all cars complete) |
| `Unloading` | `Idle` | All handles released, instances destroyed |
| Any | `Unloading` | Player returns to menu (abort race) |

### Interactions with Other Systems

| System | Data Flow | Timing |
|--------|-----------|--------|
| **Simulation Architecture** | Content Pipeline → SimArch: "assets ready" signal; SimArch starts countdown | On Ready state |
| **Vehicle Physics** | Content Pipeline → Physics: car prefab references for spawning | During Loading Cars |
| **Track System** | Content Pipeline → Track: track instance reference | During Loading Track |
| **Audio** | Content Pipeline → Audio: audio clip references per car/track | During Loading Cars/Track |
| **HUD** | Content Pipeline → HUD: loading progress percentage | During Loading states |
| **Ghost Recording** | Content Pipeline → Ghost: track data reference for replay | During Ready state |

## Formulas

### Loading Progress

`progress = bytes_loaded / total_bytes`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Bytes Loaded | bytes_loaded | uint64 | 0–total_bytes | Cumulative bytes loaded from all bundles |
| Total Bytes | total_bytes | uint64 | >0 | Sum of all bundle sizes for the race |

**Output Range:** 0.0 to 1.0 (0% to 100%)
**Example:** 150MB loaded of 600MB total → progress = 0.25 (25%)

### Memory Pressure Threshold

`threshold = used_memory / available_memory`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Used Memory | used_memory | uint64 | 0–available | Current heap usage |
| Available Memory | available_memory | uint64 | >0 | Platform-dependent (PC: 8-16GB, WebGL: 768MB) |

**Output Range:** 0.0 to 1.0
**Behavior:** < 0.85 = normal, 0.85–0.95 = warning (reduce quality), > 0.95 = critical (abort race load)

## Edge Cases

- **If Addressables catalog fails to initialize:** Show error dialog. Retry once. If retry fails, close application. No game is possible without the catalog.
- **If a car bundle fails to load:** Skip that car. Fill grid position with a "missing car" placeholder (visible but non-interactive). Log error. Race continues with 15 cars.
- **If track bundle fails to load:** Abort race load. Return to race selection menu. Show error: "Track failed to load. Please try again."
- **If memory exceeds 95% threshold during load:** Abort race load. Unload everything. Show error: "Not enough memory to run this race. Try lowering quality settings."
- **If player returns to menu mid-load:** Cancel all pending async operations. Release any partially loaded handles. Return to Idle state. No memory leak.
- **If two races are requested simultaneously (double-click):** Second request is ignored. Loading screen blocks input.
- **If WebGL tab is backgrounded during load:** Browser may throttle or pause JS execution. Loading pauses. When tab returns, loading resumes from where it stopped. No corruption.
- **If car prefab is missing from bundle (corrupted build):** Instantiate a "missing car" red box placeholder. Log error. Race continues.
- **If loading screen VFX fails to load:** Skip VFX. Show loading screen without animation. Progress bar still works.
- **If Shared group fails to load on startup:** Fatal — app cannot start. Show error and close.

## Dependencies

| System | Direction | Type | Data Flow |
|--------|-----------|------|-----------|
| Simulation Architecture | Outbound | Hard | Content Pipeline → SimArch: "assets ready" signal to start countdown |
| Vehicle Physics | Outbound | Hard | Content Pipeline → Physics: car prefab references for spawning |
| Track System | Outbound | Hard | Content Pipeline → Track: track instance reference |
| Audio | Outbound | Hard | Content Pipeline → Audio: audio clip references per car/track |
| HUD | Outbound | Soft | Content Pipeline → HUD: loading progress percentage |
| Ghost Recording | Outbound | Soft | Content Pipeline → Ghost: track data reference for replay |
| Settings | Indirect | Soft | Settings → Content Pipeline: quality level (affects which texture/LOD variants load) |

## Tuning Knobs

| Knob | Default | Range | Too Low | Too High |
|------|---------|-------|---------|----------|
| Loading Screen Min Duration | 0.5s | 0.0–2.0s | Flash transition, player doesn't register | Unnecessarily slow |
| Memory Warning Threshold | 85% | 70–95% | Too sensitive — warnings on normal loads | Too lenient — crashes before warning |
| Memory Critical Threshold | 95% | 90–99% | Aborts loads that would succeed | Crashes before abort |
| Car Bundle Max Size (WebGL) | 3 MB | 1–5 MB | Too many small bundles, catalog bloat | Stuttering during load |
| Loading VFX Budget | 3 MB | 0–5 MB | No visual polish | Excessive for loading screen |
| Parallel Car Load Count | 16 (all) | 4–16 | Slow — waits for sequential loads | Memory spike from simultaneous loads |

## Visual/Audio Requirements

The Content Pipeline has no direct visual or audio output beyond the loading screen. The loading screen requires:
- **Visual:** Progress bar, background image/gradient, simple VFX (particles or ambient animation), "Loading..." text
- **Audio:** Optional ambient sound during loading (low-volume music loop or engine idle). Should not compete with the loading process.

## UI Requirements

Loading screen layout:
- **Background:** Full-screen dark gradient or track preview image
- **Progress bar:** Horizontal bar, 0-100%, positioned bottom-third of screen
- **Text:** "Loading..." above progress bar, percentage below
- **VFX:** Subtle particle effect or ambient animation in background
- **First launch:** "Preparing..." with spinner instead of progress bar

No player interaction during loading — all input is blocked.

## Acceptance Criteria

### 1. Content Groups

- **AC-CG1:** Given the game builds for any platform, When the Addressable catalog is inspected, Then exactly 3 top-level group categories exist: Shared, Cars/{TeamId}, and Tracks/{TrackId}.
- **AC-CG2:** Given a race with 16 teams and 1 track, When the Addressable groups are listed, Then 18 groups exist: 1 Shared + 16 Cars + 1 Track.
- **AC-CG3:** Given the Shared group, When its contents are inspected, Then it contains only: core UI, HUD prefabs, common audio clips, shared shaders, and loading screen assets.
- **AC-CG4:** Given the `Cars/team_tier4_d` group, When its contents are inspected, Then it contains only `team_tier4_d`'s car prefab, materials, textures, and engine audio — no assets from other teams.
- **AC-CG5:** Given the Tracks/Track_A group, When its contents are inspected, Then it contains only Track_A's mesh, environment, lighting, and track audio — no car assets.
- **AC-CG6:** Given any car bundle, When inspected, Then the bundle is self-contained with no cross-references to other car bundles.

### 2. Loading Order

- **AC-LO1:** Given the player selects a race, When loading begins, Then the track bundle and all 16 car bundles start loading asynchronously in parallel.
- **AC-LO2:** Given loading is in progress, When progress is sampled at 25%, 50%, and 75%, Then progress increases monotonically and is derived from bytes_loaded / total_bytes.
- **AC-LO3:** Given all bundles are loaded, When loading completes, Then the track is instantiated first, then all 16 cars are spawned on grid positions.
- **AC-LO4:** Given Content Pipeline is in Idle, When player selects race, Then state transitions to Loading Track.
- **AC-LO5:** Given Content Pipeline is in Loading Cars, When all 16 car bundles finish, Then state transitions to Ready.
- **AC-LO6:** Given Content Pipeline is in Ready, When countdown reaches zero, Then state transitions to Racing.
- **AC-LO7:** Given Content Pipeline is in Racing, When all cars complete the race, Then state transitions to Unloading.
- **AC-LO8:** Given Content Pipeline is in Unloading, When all handles released, Then state transitions to Idle.

### 3. Memory Budgets

- **AC-MB1:** Given a PC build, When a race is loaded, Then total memory is between 730 MB and 1320 MB.
- **AC-MB2:** Given a WebGL build, When a race is loaded, Then total memory is between 415 MB and 670 MB.
- **AC-MB3:** Given memory pressure below 0.85, When loading proceeds, Then no warnings are shown.
- **AC-MB4:** Given memory pressure at 0.85–0.95, When detected, Then a warning is logged and quality reduction is attempted.
- **AC-MB5:** Given memory pressure exceeds 0.95, When detected, Then race load is aborted and error message is shown.
- **AC-MB6:** Given any car bundle on PC, When measured, Then total size is between 14 MB and 22 MB.
- **AC-MB7:** Given any car bundle on WebGL, When measured, Then total size is between 6 MB and 10.5 MB.

### 4. Unloading

- **AC-UL1:** Given a race finishes, When UnloadRace() is called, Then all instances are destroyed via ReleaseInstance and handles via Release.
- **AC-UL2:** Given unloading completes, When memory is measured, Then only Shared group assets remain.
- **AC-UL3:** Given LoadRace() is called for a new race, When the method begins, Then UnloadRace() is called first.
- **AC-UL4:** Given two consecutive races use the same track, When the second loads, Then the track is fully unloaded and reloaded.
- **AC-UL5:** Given Content Pipeline is in Unloading, When player returns to menu, Then unloading completes with no leak.
- **AC-UL6:** Given unloading completes, When measured, Then no car or track residuals remain.

### 5. Loading Screen

- **AC-LS1:** Given loading begins, When loading screen appears, Then progress bar shows 0%.
- **AC-LS2:** Given loading in progress, When progress updates, Then it increases monotonically from 0% to 100%.
- **AC-LS3:** Given loading completes under 0.5s, When displayed, Then loading screen remains at least 0.5s.
- **AC-LS4:** Given loading completes over 0.5s, When finished, Then loading screen dismisses immediately.
- **AC-LS5:** Given loading screen visible, When player presses any input, Then input is blocked.
- **AC-LS6:** Given first launch, When catalog initializes, Then "Preparing..." with spinner is shown.
- **AC-LS7:** Given loading VFX budget, When measured, Then VFX memory does not exceed 3 MB.
- **AC-LS8:** Given VFX fails to load, When displayed, Then progress bar and text still function.
- **AC-LS9:** Given loading screen active, When displayed, Then "Loading..." text appears above bar and percentage below.

### 6. WebGL Constraints

- **AC-WG1:** Given WebGL build, When Player Settings inspected, Then Memory Size ≥ 768 MB.
- **AC-WG2:** Given WebGL build, When car textures inspected, Then all use ASTC 6×6 and are ≤ 1024px.
- **AC-WG3:** Given any car model in WebGL, When LODs inspected, Then 3 levels exist (LOD0 ~15-20K, LOD1 ~8-10K, LOD2 ~3-5K tris).
- **AC-WG4:** Given WebGL build, When any car bundle measured, Then bundle ≤ 3 MB.
- **AC-WG5:** Given WebGL build, When quality settings loaded, Then Low profile applied by default.
- **AC-WG6:** Given WebGL OOM, When malloc fails, Then app crashes gracefully with no corrupt state.

### 7. State Machine

- **AC-SM1:** Given app initializes, When Content Pipeline starts, Then initial state is Idle with only Shared loaded.
- **AC-SM2:** Given Idle state, When no race selected, Then no car or track bundles loaded.
- **AC-SM3:** Given any state, When player aborts, Then state transitions to Unloading.
- **AC-SM4:** Given Loading Track state, When player aborts, Then async operations cancelled, handles released, state reaches Idle.
- **AC-SM5:** Given Ready state, When no countdown trigger, Then state remains Ready.

### 8. Edge Cases

- **AC-EC1:** Given catalog init fails on startup, When detected, Then retry once. If retry fails, app closes.
- **AC-EC2:** Given car bundle fails to load, When detected, Then car skipped, placeholder fills position, error logged, race continues with 15 cars.
- **AC-EC3:** Given track bundle fails to load, When detected, Then race load aborted, player returns to menu with error.
- **AC-EC4:** Given memory exceeds 95% during load, When detected, Then race load aborted, error shown.
- **AC-EC5:** Given player returns to menu mid-load, When abort triggered, Then all async cancelled, handles released, no leak.
- **AC-EC6:** Given player double-clicks Start Race, When second click fires, Then second request ignored.
- **AC-EC7:** Given WebGL tab backgrounded during load, When browser throttles, Then loading pauses and resumes on foreground with no corruption.
- **AC-EC8:** Given car prefab missing from bundle, When instantiation attempted, Then red box placeholder used, error logged, race continues.
- **AC-EC9:** Given VFX fails to load, When displayed, Then VFX skipped, progress bar functional, no error shown.
- **AC-EC10:** Given Shared group fails on startup, When detected, Then app cannot start, error shown, app closes.

### 9. Loading Progress

- **AC-LP1:** Given total assets 600 MB, When 150 MB loaded, Then progress = 0.25 (±1%).
- **AC-LP2:** Given all bundles loaded, When final progress calculated, Then progress = 1.0.
- **AC-LP3:** Given 1 of 16 car bundles fails, When remaining 15 + track loaded, Then progress reaches 100%.

### 10. Quality Profiles

- **AC-QP1:** Given Settings provides quality = Low (WebGL), When content loads, Then car textures use lower resolution and post-processing reduced.
- **AC-QP2:** Given Settings provides quality = High (PC), When content loads, Then car textures use full resolution and full post-processing.

## Open Questions

- **Streaming for remote content:** Should the content pipeline support remote Addressable groups for post-launch content updates? (Alpha+ feature — not MVP)
- **Track streaming:** For large tracks, should we split track assets into multiple bundles loaded progressively (mesh → environment → lighting)? (Affects loading order complexity)
- **Audio streaming:** Should engine audio be loaded on-demand per car rather than pre-loaded with the car bundle? (Reduces initial load but adds runtime streaming)
