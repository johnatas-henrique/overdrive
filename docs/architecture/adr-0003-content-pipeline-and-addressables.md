# ADR-0003: Content Pipeline and Addressables Strategy

## Status

Accepted

## Date

2026-07-27

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Asset Management / Content Pipeline |
| **Knowledge Risk** | MEDIUM — Addressables 3.1.0 package is post-LLM-cutoff (May 2025). Core load/release API confirmed stable. |
| **References Consulted** | `docs/engine-reference/unity/plugins/addressables.md`, `docs/engine-reference/unity/VERSION.md`, `docs/engine-reference/unity/breaking-changes.md`, `design/gdd/content-pipeline.md` |
| **Post-Cutoff APIs Used** | `Addressables.LoadAssetAsync<T>()`, `Addressables.ReleaseInstance()`, `Addressables.Release()` — all confirmed available in 3.1.0 |
| **Verification Required** | Memory budget profiling on target PC and WebGL builds. Cross-platform texture mipmap limits. |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (for Simulation state machine lifecycle — Loading state integration) |
| **Enables** | ADR-0002 (Vehicle Physics consumes `CarDefinition` assets at race init via `Cars/{teamId}` group). ADR-0007 (Track System consumes `TrackData` via `Tracks/{trackId}` group). Race unload lifecycle, Race Reconfigure. |
| **Blocks** | All content authoring until group topology and Addressable keys are defined |
| **Ordering Note** | Addressable groups must be created in the Unity Editor before any assets can be assigned. ADR-0002 (Vehicle Physics) does not block this ADR. |

## Context

### Problem Statement

Overdrive has 16 unique cars (each with prefab, materials, textures, engine audio), 4 MVP tracks (each with mesh, environment, lighting), and shared assets (UI, HUD, common audio, shaders). Loading everything at startup would exceed memory budgets on WebGL (~500 MB) and waste memory on PC. The Content Pipeline must load only what is needed for the current race, unload cleanly, and handle errors gracefully without crashing the game.

### Constraints

- **Addressables 3.1.0** installed. Must use Addressables API for all asynchronous asset loading. `Resources.Load()` is avoided for content assets.
- **WebGL** heap up to 4 GB (CONSTRAINTS #1534 confirmed). ASTC 6×6 compression available as extension.
- **MVP scope:** Local content only. No remote catalogs, CDN, or Unity CCD. Remote delivery is a future-phase decision.
- **Race load target:** Minimal loading screen time. Parallel loading of track + 16 cars.
- **No file-level persistence:** Content is embedded in the build. No runtime download or patch in MVP.
- **Cross-platform:** PC and WebGL share the same Addressable groups, with different texture resolution targets via `QualitySettings.globalTextureMipmapLimit`.

### Requirements

- Must load exactly one track, one player car, and 15 AI cars per race
- Must support parallel loading of all 17 bundles
- Must produce `RaceLoadReady(RaceMode, GridAssignment)` when loading is complete
- Must produce `ContentLoadError(reason)` on failure
- Must support `RaceReconfigureStart` for lightweight race restart (no asset unload/reload)
- Must unload all race-specific assets on race end
- Must handle per-car load failure gracefully (skip car, placeholder, continue with 15)
- Must handle track load failure as abort (return to Idle, error screen)
- Must handle Shared group failure as fatal

## Decision

Content Pipeline uses **3 Addressable group categories** (Shared + Cars/{teamId} + Tracks/{trackId}), parallel loading for race bundles, and a CP_ state machine for lifecycle management. Each car and track has its own Addressable bundle for individual memory tracking and incremental rebuilds.

### Architecture

```
                ContentPipelineSystem (CP_ state machine)
                ┌──────────────────────────────────────────────┐
                │  CP_Idle → CP_LoadingTrack → CP_LoadingCars →│
                │  CP_Ready → CP_Racing → CP_Unloading → CP_Idle│
                │                                                │
                │  Error: CP_Loading* → CP_Unloading → CP_Idle   │
                │  Reconfigure: CP_Racing → CP_RaceReconfigure →│
                │               CP_Ready (no Addressables I/O)   │
                └──────────────────────────────────────────────┘

CP_ state ↔ SimulationState mapping:
  CP_Idle               → Idle
  CP_LoadingTrack/Cars  → Loading
  CP_Ready              → Loading (awaiting RaceLoadReady acceptance)
  CP_Racing             → Countdown / Racing / Finished / Paused
  CP_RaceReconfigure     → Loading (brief, synchronous, no Addressables I/O)
  CP_Unloading           → Results (after ContentUnloadRequest)
  CP_Error               → Idle (after unload completes)

  Shared (startup)     Cars/{teamId} (race)     Tracks/{trackId} (race)
  ┌─────────────────┐  ┌──────────────────┐    ┌────────────────────┐
  │ HUD canvas      │  │ Car prefab       │    │ Track mesh         │
  │ Common shaders  │  │ Materials        │    │ Environment lighting│
  │ Common audio    │  │ Textures (2048)  │    │ Spline JSON        │
  │ Loading screen  │  │ Engine audio     │    │ Surface zones      │
  │ Input asset     │  │ CarDef SO        │    │ Pit lane geometry   │
  └─────────────────┘  └──────────────────┘    └────────────────────┘
         lifelong             per-race                 per-race
```

### Key Interfaces

```csharp
// Content Pipeline → Simulation → UI Menu
public delegate void RaceLoadReady(RaceMode mode, GridAssignment grid);
public delegate void ContentLoadError(string reason, ContentErrorType type);
public delegate void RaceReconfigureStart();
public delegate void ContentUnloadComplete();
public delegate void LoadingProgress(float progress);  // 0.0–1.0

public enum ContentErrorType : byte { Track, Car, Shared, Catalog }

// Public API
public class ContentPipelineSystem {
    // Called by Simulation driver at Loading state entry
    public void LoadRace(string trackId, string[] carIds, GridAssignment grid);
    
    // Called by Simulation for qualifying→race transition with same track/cars
    public void RaceReconfigure(GridAssignment newGrid);
    
    // Called by Simulation at Results→Idle transition (after UI dismisses results)
    public void UnloadRace();
    
    // Events
    public event RaceLoadReady OnRaceLoadReady;
    public event ContentLoadError OnContentLoadError;
    public event RaceReconfigureStart OnRaceReconfigureStart;
    public event ContentUnloadComplete OnContentUnloadComplete;
    public event LoadingProgress OnLoadingProgress;
}

// Addressable key constants (used by editor tooling to assign groups)
public static class AddressableKeys {
    public const string SharedGroup = "Shared";
    public static string CarGroup(string teamId) => $"Cars/{teamId}";
    public static string TrackGroup(string trackId) => $"Tracks/{trackId}";
    
    public const string CarPrefab = "CarPrefab";
    public const string CarDefinition = "CarDefinition";
    public const string TrackData = "TrackData";
    public const string TrackEnvironment = "TrackEnvironment";
}

// Error recovery
public enum CarLoadResult : byte { Success, SkippedPlaceholder, Failed }
```

### Race Reconfigure Flow

`RaceReconfigureStart` is a **one-way event** — domain owners subscribe (Fuel, Tire, AI, RSM reset their own state). Content Pipeline does not call them directly. No cross-layer violation.

Load-completion guarantee: All Addressable assets (car prefabs, MonoBehaviours including `CarCollisionMonitor`, CarDefinition, track data) are fully loaded and instantiated before `RaceLoadReady` is emitted. This ensures that `VehiclePhysicsSystem` can safely subscribe to collision events on tick 0 of the race.

```
Qualifying → Results → GridDisplay → StartRaceRequested
  │                                         │
  └── Content stays loaded ─────────────────┘
                     │
                     ↓
          RaceReconfigure(GridAssignment)
          ├── Emit RaceReconfigureStart
          ├── Domain owners reset state (Fuel, Tire, AI, RSM)
          ├── Instantiate cars from locked gridAssignment
          ├── Re-emit RaceLoadReady(RaceMode.Race, gridAssignment)
          └── No Addressables load/unload — cache hit
```

## Alternatives Considered

### Alternative 1: Monolithic Single Group

- **Description:** All assets in one Addressable group. Load everything at startup.
- **Pros:** Simplest implementation. No per-bundle tracking. Single load call.
- **Cons:** ~500 MB+ loaded at startup. WebGL OOM risk for any single race configuration. No incremental rebuilds. Changing one car asset rebuilds the entire bundle.
- **Rejection Reason:** WebGL memory constraints make this infeasible. The 3-group model is only marginally more complex and enables per-race memory control.

### Alternative 2: Lazy Per-Asset Loading

- **Description:** No groups. Each individual asset loaded on demand when first used (HUD requests texture, Audio requests engine sound, etc.).
- **Pros:** Minimum memory footprint. Pay for what you use.
- **Cons:** Race start would trigger dozens of individual Addressable loads serially, creating unpredictable load spikes. No parallel loading. HUD would pop in mid-race when textures finally load.
- **Rejection Reason:** Predictable load time is a requirement. Per-race bundle loading ensures all assets are ready before the race starts.

## Consequences

### Positive

- **Memory control:** Only one track + 16 cars in memory per race. ~415–670 MB on WebGL, ~730–1320 MB on PC (per GDD budgets).
- **Parallel loading:** 17 bundles in parallel = minimal loading screen time.
- **Incremental rebuilds:** Changing one car rebuilds only that car's bundle.
- **Race Reconfigure:** Qualifying→Race transition reloads nothing — cache hit for all Addressable handles.
- **Graceful degradation:** Car load failure skips one car. Track load failure is the only abort scenario.
- **Seamless future remote:** Local keys migrate to `http://` keys without code changes.

### Negative

- **Upfront group setup:** Editor tooling required to create 20+ groups (16 cars + 4 tracks + 1 shared). Cannot be automated until asset taxonomy is stable. Per-race subset: 18 groups for one race (1 Shared + 16 Cars + 1 Track).
- **Build time impact:** 21 Addressable groups × compression (ASTC 6×6) adds measurable build time. Estimate: 20–60s on PC build, 60–180s on WebGL build.
- **Parallel load complexity:** 17 async handles in flight simultaneously. Must track completion across all.
- **Per-car bundle overhead:** Each bundle has a fixed overhead (~128–200 KB metadata + compression dictionary, higher if engine audio is included). 16 car bundles = ~2–3.2 MB fixed overhead per race.
- **Localization out of scope:** Future localization will add a `Localized/{lang}/` group topology extension. The Shared group + `Tracks/{trackId}` audio textures must leave room for this extension without restructuring.

### Risks

- **WebGL OOM on first load:** If catalog initialization + parallel 17 bundles exceeds 4 GB heap. Mitigation: Catalog is ~50 KB; shared group loads at startup (not during race). 17 bundles at once is ~500 MB spread across ~8–25 seconds on WebGL (IndexedDB throughput bound, not CPU). Well within 4 GB heap. Profiling checkbox: verify WebGL bundle-load throughput on first load vs subsequent loads — known Addressables 2.x/3.x WebGL performance regression reported (2025).
- **Car load failure during next race:** If a car Addressable that loaded successfully in one race fails to load in a subsequent race (e.g., cache corruption or catalog change), the placeholder path handles it identically to first-time failure. No mid-race failure path exists — handles are valid for their loaded lifetime.
- **Memory pressure during load:** If `ContentPipelineSystem` detects memory usage > 95% threshold during loading, it must abort the current load, release partial handles, and emit `ContentLoadError("Memory pressure", ContentErrorType.Track)`. Alpha remote scenario needs offline catalog fallback.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| content-pipeline.md | 3 Addressable groups (Shared, Cars/{teamId}, Tracks/{trackId}) | ADR-0003 formalizes the 3-group topology and defines Addressable key constants |
| content-pipeline.md | Parallel loading of track + 16 car bundles | LoadRace() initiates 17 async handles in parallel, tracks completion collectively |
| content-pipeline.md | CP_ state machine (7 states) | CP_Idle/CP_LoadingTrack/CP_LoadingCars/CP_Ready/CP_Racing/CP_Unloading/CP_Error defined |
| content-pipeline.md | Memory budgets per platform (PC 730-1320 MB, WebGL 415-670 MB) | ADR-0003 confirms the budgets from GDD and delegates profiling to Week 1 prototype |
| content-pipeline.md | Error handling (car skip, track abort, shared fatal) | CarLoadResult enum, ContentErrorType enum, event-driven error propagation |
| content-pipeline.md | Race Reconfigure (no asset unload/reload) | RaceReconfigure() flow defined with cache-hit semantics |
| content-pipeline.md | Loading progress from byte counts | OnLoadingProgress events derived from AsyncOperationHandle.PercentComplete |
| content-pipeline.md | CP_ prefix naming convention | ADR-0003 uses CP_ prefix for all Content Pipeline states |
| simulation-architecture.md | Loading state blocks Cancel/Back, emits RaceLoadReady only on success | ContentLoadError event provides the failure path; Simulation transitions to Idle on error |
| simulation-architecture.md | Race Reconfigure cross-system event | RaceReconfigureStart event for Fuel, Tire, AI, RSM reset |
| car-definition-data.md | Cars loaded via Addressables group Cars/ | AddressableKeys.CarGroup(teamId) produces the correct key path |
| track-system.md | Track JSON loaded via Addressables | AddressableKeys.TrackData key for track spline + metadata |
| ui-menu.md | Loading cancellation blocked until RaceLoadReady or ContentLoadError | Events drive UI transitions directly; no polling needed |

## Performance Implications

| Metric | Expected Impact | Notes |
|--------|----------------|-------|
| **CPU** | ~1–10 ms during loading (burst), 0 ms during racing | Loading is async and does not block the tick pipeline |
| **Memory** | PC: 730-1320 MB, WebGL: 415-670 MB per race | Verified per GDD budgets. Shared group adds ~40-60 MB at startup |
| **Load Time** | ~3–10s on PC SSD, ~5–15s on WebGL (first load) | Subsequent races faster due to OS cache and Addressable bundle cache |
| **Network** | None (MVP) | Local content only |

## Migration Plan

N/A — this is a greenfield MVP. No existing content to migrate. Addressable groups are created from scratch in the Unity Editor.

1. Create groups per topology above in Addressables Groups window
2. Assign car prefabs + textures + audio to `Cars/{teamId}/` groups
3. Assign track meshes + environments to `Tracks/{trackId}/` groups
4. Assign shared assets (HUD, shaders, input, loading screen) to `Shared` group
5. Build Addressables content (`Addressables > Build > New Build > Default Build Script`)

## Validation Criteria

- [ ] All 16 car bundles load in parallel within 15s on WebGL target
- [ ] All 4 track bundles load individually within 10s
- [ ] Shared group loads at startup within 2s
- [ ] Loading progress reports 0.0–1.0 derived from total bytes
- [ ] RaceLoadReady fires only when ALL 17 bundles (track + 16 cars) are loaded
- [ ] Car bundle failure: log warning, emit ContentLoadError(ErrorType.Car), race continues with 15 cars + placeholder (Unity primitive, not Addressable asset)
- [ ] Track bundle failure: emit ContentLoadError(ErrorType.Track), return to Idle, no crash
- [ ] Shared group failure at startup: app closes (fatal)
- [ ] Catalog init failure: retry once. If retry fails, app closes.
- [ ] RaceReconfigure: no Addressables.LoadAssetAsync calls (cache hit only)
- [ ] UnloadRace: Addressables.ReleaseInstance + Addressables.Release for all handles, no leaks
- [ ] Memory: no Addressable asset remains referenced after ContentUnloadComplete
- [ ] No `Resources.Load()` calls in content path (editor tooling exceptions allowed)

## Related Decisions

- ADR-0001: Manual Simulation Authority and Determinism Boundary (Loading state lifecycle, RaceLoadReady consumption)
- ADR-0002: Vehicle Physics Implementation Pattern (indirect — CarDefinition loaded by Content Pipeline)
