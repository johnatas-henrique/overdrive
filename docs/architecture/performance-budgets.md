# Performance Budgets

> **Engine**: Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12
> **Last Updated**: 2026-06-22
> **Document Version**: 2026-06-22-1
> **Status**: Active — reviewed and enforced per sprint. Update when target platforms or system architecture changes.
> **Referenced by**: control-manifest.md (Performance Guardrails), all sprint stories with perf-sensitive changes

This document defines hard and soft performance budgets for the Overdrive project. Budgets are organized by domain: frame timing, memory, load time, audio, and rendering. Every budget includes how it is measured and validated.

---

## 1. Target Platforms & Framerate

| Platform         | Target FPS | Frame Budget | Fallback FPS | Fallback Budget | Notes                                           |
| ---------------- | ---------- | ------------ | ------------ | --------------- | ----------------------------------------------- |
| Desktop (WebGPU) | 60         | **16.67 ms** | 30           | 33.33 ms        | Primary target — all budgets assume this        |
| Desktop (WebGL2) | 60         | 16.67 ms     | 30           | 33.33 ms        | WebGPU fallback — expect ~10% GPU overhead      |
| Tauri (low-end)  | 30         | **33.33 ms** | 20           | 50.00 ms        | Budget doubles per slot; rendering scales down  |
| Web (WebGPU)     | 60         | 16.67 ms     | 30           | 33.33 ms        | Same as desktop; OS overhead budgeted in render |

**Resolution targets**: 1920×1080 (desktop/Tauri), adaptive down to 1280×720 (Web/Tauri low-end).

**Frame budget breakdown for 16.67 ms target**:

| Slice                | Allocation   | Purpose                              |
| -------------------- | ------------ | ------------------------------------ |
| FixedUpdate pipeline | ~7.3 ms      | 8 slots at fixed 1/60s               |
| Render               | ~6.0 ms      | Scene draw, GUI compositing, present |
| Headroom             | ~3.4 ms      | GC spikes, OS scheduling, buffer     |
| **Total**            | **~16.7 ms** | Sum ≤ frame budget                   |

---

## 2. Per-System Frame Budgets

All budgets measured as **wall-clock time per tick** at the 60 fps (16.67 ms) target. Values are **soft maximums** — sustained violations should trigger investigation. Occasional spikes (GC, first Havok step after loading) are allowed up to 2× budget for up to 3 consecutive frames.

| Slot               | System             | Budget (ms) | Justification                                                                                                                                                                                                                                                                      |
| ------------------ | ------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1                 | Input              | **< 0.5**   | Poll gamepad/keyboard state, apply dead zone, write to double buffer. Simple arithmetic — dominated by DeviceSourceManager internal dispatch.                                                                                                                                      |
| #2                 | Physics / Handling | **< 3.0**   | Heaviest slot. Havok `executeStep` for 8 DYNAMIC bodies + 0 joints against static track mesh colliders (3–5 bodies). Plus 3-phase arcade model: grip calc, velocity override, collision delta preserve. Budget accommodates impulse resolution spikes on start grid and pit entry. |
| #3                 | AI Driver          | **< 2.0**   | 7 AIControllers each running: spline lookup (O(1)), PID error calc, curvature feedforward, overtaking state machine, gear logic. Parallelizable in theory but serial in MVP. Budget includes worst-case overtaking branch.                                                         |
| #4                 | Collision          | **< 0.5**   | Event-only — consumes `onCollisionObservable` results emitted by Havok in slot #2. Maps contact events to `collision.impact` on Event Bus. Grazing suppression adds O(1) set lookup. Budget assumes up to ~20 contact events per tick (start grid pileup or multi-car corner).     |
| #5                 | Fuel               | **< 0.3**   | Per-car: throttleAvg × baseRate × efficiencyRate → `fuelUsed`, update `fuelLevel`, compute `fuelMult`. 8 cars × 3 multiplies + clamp. Trivially cheap — budget is defensive for array iteration overhead.                                                                          |
| #6                 | Tire Wear          | **< 0.3**   | Per-car: lateralG × latFactor + accelG × accelFactor + brakeG × brakeFactor, optional offTrack multiplier, update `tireCondition`. 8 cars × similar cost to Fuel.                                                                                                                  |
| #7                 | Race Management    | **< 0.5**   | Lap detection (spline wrap check × 8), position sort (O(8 log 8)), DNF progression checks, hysteresis filtering, optional `endRace()` deferred transition. Most variable due to end-race condition evaluation.                                                                     |
| #8                 | Pit Stop           | **< 0.2**   | Per-car state machine tick (onTrack/pitEntry/pitStopped/departing), spline position interpolation, service timers. Only active state machines do work — non-pitting cars return immediately.                                                                                       |
| **Pipeline total** |                    | **~7.3**    |                                                                                                                                                                                                                                                                                    |

| Post-pipeline | System              | Budget (ms) | Justification                                                                                                                                                                                               |
| ------------- | ------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —             | **Render**          | **< 6.0**   | UnlitMaterial (cheap fragment shader), ~470K triangles, 1 shadow map (~2K), ~500 draw calls. Includes AdvancedDynamicTexture HUD composition (~40 controls) and forward UI render. Largest single consumer. |
| —             | **Engine overhead** | **< 0.5**   | `engine.beginFrame()` / `endFrame()` observables, scene clear, buffer swap. Babylon.js internal bookkeeping.                                                                                                |
| —             | **Audio mix**       | **< 0.2**   | 4 AudioBus channels processed per frame. Engine synth math is negligible — budget covers buffer submit latency.                                                                                             |
|               | **Headroom**        | **~3.4**    | GC pauses, OS scheduling jitter, profiling overhead, and safety margin. If actual sustained total exceeds 14.0 ms, investigate.                                                                             |

### Fallback Budgets (Tauri low-end / 30 fps)

At 30 fps target (33.33 ms), all per-slot budgets double:

| Slot | System          | Budget (ms) |
| ---- | --------------- | ----------- |
| #1   | Input           | < 1.0       |
| #2   | Physics         | < 6.0       |
| #3   | AI Driver       | < 4.0       |
| #4   | Collision       | < 1.0       |
| #5   | Fuel            | < 0.6       |
| #6   | Tire Wear       | < 0.6       |
| #7   | Race Management | < 1.0       |
| #8   | Pit Stop        | < 0.4       |
|      | Render          | < 12.0      |
|      | Headroom        | ~6.7        |

30 fps fallback is **not** achieved by scaling budgets alone — rendering complexity must also reduce (lower shadow resolution, skip post-process, reduce LOD, or half-resolution render target).

---

## 3. Memory Budgets

All values are **soft targets** for production builds (after asset compression). Development builds may exceed due to source maps and debug instrumentation.

| Category                          | Budget       | Notes                                                                                                            |
| --------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Total heap (desktop)**          | **< 200 MB** | Includes Babylon.js engine, scene, textures, physics world, audio buffers, game state                            |
| **Total heap (Tauri)**            | **< 120 MB** | Tighter — target lower-end hardware with less RAM                                                                |
| **Car GLB per asset**             | **< 2 MB**   | Compressed GLB with KTX2/Basis textures. 8 instances share 1 GLB in memory                                       |
| **Track environment**             | **< 15 MB**  | GLB + textures. ~470K triangles. One track loaded at a time                                                      |
| **Menu / HUD textures**           | **< 5 MB**   | AdvancedDynamicTexture at 1920×1080. ~40 HUD controls + ~300 menu controls                                       |
| **Audio assets (total)**          | **< 8 MB**   | Engine WAV loops (2-4s each), synth overlay code (negligible), SFX, UI sounds, ambient tracks                    |
| **Car entity overhead**           | **< 32 KB**  | 8 cars × ~200 bytes state + ~2 KB PhysicsAggregate + mesh references                                             |
| **Havok physics world**           | **< 1 MB**   | 8 DYNAMIC bodies + ~5 STATIC mesh colliders. World broadphase internal structures                                |
| **Asset container cache**         | **< 5 MB**   | All loaded `AssetContainer` instances held in memory for zero-I/O re-instantiation                               |
| **Event bus / GSM / other infra** | **< 200 KB** | Typed event map, subscription list, GSM state history (20 transitions), config manager ring buffer (500 entries) |

### Memory monitoring triggers

| Condition               | Action                                  |
| ----------------------- | --------------------------------------- |
| Heap > 150 MB sustained | Warning logged                          |
| Heap > 200 MB           | Escalate to technical-director          |
| Car GLB > 2 MB          | Flag for technical-artist review        |
| Texture memory > 20 MB  | Review texture resolution / compression |
| Audio assets > 8 MB     | Review asset compression or trim        |

---

## 4. Load Time Budgets

Measured from the start of the loading sequence to the specified milestone, on a **cold start** (empty browser cache, first ever navigation to page). Warm loads (assets in HTTP cache or service worker) should be ~2× faster.

| Transition                       | Budget        | Measurement Point                                                                                                                                                                                                                                                                                    |
| -------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Page load → Menu interactive** | **< 1.5 s**   | From `window.performance.timing.navigationStart` (or `PerformanceNavigationTiming`) to first `gsm.state.entered(Menu)` event. Includes: engine init, Havok WASM instantiation, menu GLB load, menu GUI texture built, first render.                                                                  |
| **Menu → Race ready**            | **< 4.0 s**   | From `gsm.state.entered(PreRace)` to 'ready' signal emitted by Race Manager. Includes: track GLB load + instantiation, 8× car GLB instantiation from cache, car physics body creation (8× CONVEX_HULL at 800kg), AI controller creation (7×), race state initialization. Most expensive single load. |
| **Race Again (same track)**      | **< 0.5 s**   | No asset I/O — all containers cached. Covers: destroy + re-create car entities, reset physics world, re-init race state                                                                                                                                                                              |
| **Race Again (different track)** | **< 2.0 s**   | Dispose current track, load new track GLB + instantiate. Car GLB remains cached                                                                                                                                                                                                                      |
| **Menu screen transition**       | **< 50 ms**   | Any `isVisible` toggle in the 6-screen Menu LITE. No asset loading — all containers pre-cached                                                                                                                                                                                                       |
| **Save preferences**             | **< 50 ms**   | Persistence `save()` for preferences (localStorage sync). Degraded mode queues in memory                                                                                                                                                                                                             |
| **Save full snapshot**           | **< 200 ms**  | JSON serialize + hash of all `ISnapshotable` systems                                                                                                                                                                                                                                                 |
| **Load full snapshot**           | **< 200 ms**  | JSON parse + `deserialize()` on all systems                                                                                                                                                                                                                                                          |
| **Havok WASM instantiation**     | **50–200 ms** | Single cost during engine init. One-time per session                                                                                                                                                                                                                                                 |

### Load time optimization rules

- `SceneLoader.LoadAssetContainerAsync()` is the **only** loading primitive. No sync variants.
- All track + car GLBs loaded against `raceScene`, then `removeAllFromScene()` for caching.
- `Map<string, AssetContainer>` holds all loaded containers. Load once, instantiate per race. Zero I/O on transitions.
- Asset manifests in `src/config/assets/` are pure TypeScript data — zero Babylon.js imports.
- Loading screen must show progress via `'asset.load.progress'` events (loaded, total) emitted on Event Bus.

---

## 5. Audio Budgets

| Metric                       | Budget              | Notes                                                                                               |
| ---------------------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| **Max simultaneous voices**  | **≤ 24**            | 4 AudioBus channels × 6 instances per bus. Practical limit for engine sounds + SFX + UI + ambient.  |
| **Engine WAV loop duration** | **2–4 s**           | Per engine state (idle, cruise, acceleration, deceleration). Loop must be seamless (zero-crossing). |
| **Total audio asset size**   | **< 8 MB**          | All compressed audio (OGG/MP3 for music/ambient, WAV for engine loops).                             |
| **Per-SFX file**             | **< 200 KB**        | Short impact sounds (collision, kerb, gear shift). Typically 0.5–2.0 s at 44.1 kHz.                 |
| **Music track**              | **< 2 MB**          | Menu music, race music, results music. ≤ 60 s loop.                                                 |
| **Audio mix CPU**            | **< 0.2 ms/frame**  | 4 AudioBus buffer mix + engine synth math. Negligible in practice.                                  |
| **Synth overlay CPU**        | **< 0.05 ms/frame** | Per-car engine RPM synthesis (simple waveform + filter). 8 cars × lightweight math.                 |

### Audio bus allocation

| Bus       | Channels   | Purpose                                         | Priority                      |
| --------- | ---------- | ----------------------------------------------- | ----------------------------- |
| `music`   | 2 (stereo) | Menu music, race music, podium music            | Lowest — ducked during SFX/UI |
| `sfx`     | 2 (stereo) | Collision, kerb, skid, gear shift, engine (WAV) | Normal                        |
| `ui`      | 2 (stereo) | Button clicks, confirm, warnings, HUD beeps     | High                          |
| `ambient` | 2 (stereo) | Crowd, wind, pit lane PA, track-side ambiance   | Low — fades when no headroom  |

Voice stealing policy: when budget exceeded, oldest voice in the lowest-priority bus (ambient → music → sfx → ui) is stopped.

---

## 6. Rendering Budgets

| Metric                         | Target         | Ceiling       | Notes                                                                                                                                               |
| ------------------------------ | -------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Draw calls**                 | **< 500**      | **< 1000**    | WebGL2 target. WebGPU handles higher counts natively. Track: ~470K triangles in ~400 draw calls. Cars: 8 × ~20 draw calls = ~160. HUD: 1 draw call. |
| **Triangles**                  | **~470K**      | **< 600K**    | Single track environment. LOD system can halve distant geometry.                                                                                    |
| **Shadow map resolution**      | **2048×2048**  | **4096×4096** | One directional shadow for static track environment. Car self-shadowing deferred.                                                                   |
| **Shadow map count**           | **1**          | **1**         | Single cascaded shadow (or single PCF soft). No per-car shadows in MVP.                                                                             |
| **Texture memory per surface** | **< 4 MB**     | **< 8 MB**    | KTX2 with Basis compression. Track textures: 1024×1024 with mipmaps. Car textures: 512×512 no mipmap.                                               |
| **Max simultaneous textures**  | **< 50**       | **< 80**      | Track environment + 8 cars + HUD + menu.                                                                                                            |
| **Mesh instances**             | **8 (cars)**   | **8**         | Each car is a unique instantiation (team colors). No GPU instancing for cars (different transform per frame → UB per car).                          |
| **Post-processing**            | **0**          | **1**         | No post-process in MVP. Alpha may add bloom (single pass, 50% resolution).                                                                          |
| **UnlitMaterial usage**        | **100%**       | **100%**      | All visible geometry uses `UnlitMaterial` with baked lighting in texture. Zero runtime lighting calculations.                                       |
| **HUD GUI controls**           | **~40**        | **~60**       | AdvancedDynamicTexture at 1920×1080. Shared bitmap font, minimal state changes per frame.                                                           |
| **Menu GUI controls**          | **~300 total** | **~400**      | 6 screens × ~50 controls. Only one screen visible at a time via `isVisible`.                                                                        |

### Rendering optimization rules

- All geometry **must** use `UnlitMaterial` — no runtime lighting. Lighting baked into textures.
- One shadow map only — directional light for track environment.
- KTX2 with Basis compression for all textures (car: 512×512, track: 1024×1024).
- Cars skip mipmaps (`noMipmap: true`) — track textures use mipmaps.
- Menu screen transitions are `isVisible` toggle — never destroy/re-create GUI controls.
- HUD controls updated event-driven, not per-frame polling. Speed block throttled at 20 Hz.

---

## 7. Measurement & Validation

Every budget in this document must be verifiable. The table below defines **how** each domain is measured and at what cadence.

| Domain                     | Measurement Tool                                                       | Integration                                      | Cadence                         |
| -------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------- |
| **Frame time (total)**     | `engine.getFps()` + `engine.getDeltaTime()`                            | Dev Tools overlay (sceneInstrumentation)         | Real-time in Dev Tools          |
| **Per-slot timing**        | `performance.now()` wraps around each `slot.update()`                  | Dev Tools timeline view. Averaged over 60 ticks. | On demand (F1 overlay)          |
| **Render time**            | `SceneInstrumentation.renderTimeCounter`                               | Babylon.js built-in                              | Real-time in Dev Tools          |
| **Draw calls**             | `sceneInstrumentation.drawCallsCounter.current`                        | Babylon.js built-in                              | Real-time in Dev Tools          |
| **Triangle count**         | `engine.getTotalVertices()`                                            | Dev Tools                                        | On demand                       |
| **Physics time**           | `SceneInstrumentation.physicsTimeCounter`                              | Babylon.js built-in — Havok step time            | Real-time in Dev Tools          |
| **Heap memory**            | `performance.memory?.usedJSHeapSize` (Chrome)                          | Dev Tools                                        | On demand, logged on transition |
| **Texture memory**         | `engine.getTextureMemory()` (Babylon.js v9+)                           | Dev Tools                                        | On demand                       |
| **Load time**              | `performance.mark()` / `performance.measure()`                         | Wrapped around `gsm.state.entered` handlers      | Every load/transition — logged  |
| **Audio voices**           | Custom `AudioBus.activeVoiceCount`                                     | Dev Tools audio tab                              | Real-time                       |
| **Asset sizes**            | `new Blob([data]).size` after fetch or file stat                       | Asset manifest validation                        | Build time / CI                 |
| **Draw call budget**       | `sceneInstrumentation.drawCallsCounter`                                | Dev Tools overlay, colored warning at >800       | Real-time                       |
| **Frame budget violation** | Rolling 60-frame window — if avg > 16.67 ms for 5+ consecutive seconds | Dev Tools logs warning                           | Automatic in Dev Tools          |

### Automated validation (CI / smoke test)

The following checks run as part of the CI smoke test suite:

1. **Load time**: Menu → Race ready completes within 5.0 s (cold start, throttled connection) — measured via `performance.timing` capture in headless Chrome.
2. **Frame time**: Race scene maintains average 60 fps (≥55 fps 95th percentile) on reference hardware — measured via 10 s capture with `engine.runRenderLoop()` callback timing.
3. **Memory**: No single texture exceeds 8 MB (checked against asset manifest).
4. **Asset size**: Car GLBs < 2 MB, track GLB < 15 MB, total audio < 8 MB.
5. **Draw calls**: `sceneInstrumentation.drawCallsCounter` peak < 1000 during race.
6. **Physics**: Havok step time < 5.0 ms (budget × 1.67 safety factor) under worst-case load (8 cars + start grid collisions).

### When to escalate

| Condition                                                               | Action                                                    |
| ----------------------------------------------------------------------- | --------------------------------------------------------- |
| Any single budget exceeded for > 5 consecutive seconds in profiling run | File performance bug, assign to owner of offending system |
| Cumulative frame time > 14.0 ms sustained                               | Escalate to technical-director                            |
| Memory > 180 MB on desktop                                              | Investigate leaks, escalate to engine-programmer          |
| Load time > 5.0 s (Menu → Race)                                         | Review asset pipeline, escalate to technical-artist       |
| Any regression > 10% from previous baseline                             | Add regression test, assign to system owner               |

---

## Appendix A: Budget Derivation Notes

The per-slot budgets in §2 are derived from the granular sub-budgets in the control manifest (which are ideal-scenario microsecond estimates) multiplied by a **3× to 10× safety factor** to account for:

1. **JS engine variance** — V8 JIT warmup, hidden class transitions, deopt
2. **GC pressure** — allocation patterns that trigger scavenge
3. **Cache misses** — cold code paths on first invocation
4. **Havok internal variance** — collision pair count changes frame-to-frame
5. **Array iteration overhead** — 8-item loops with property access

The safety factors produce realistic **soft maximum** budgets that, when exceeded, indicate a genuine performance issue — not micro-optimization noise.

| System    | Control Manifest (ideal) | Budget (realistic max) | Safety factor                                           |
| --------- | ------------------------ | ---------------------- | ------------------------------------------------------- |
| Input     | < 0.01 ms                | < 0.5 ms               | 50× (defensive — includes DeviceSourceManager overhead) |
| Physics   | < 0.06 ms                | < 3.0 ms               | 50× (Havok step variance, collision impulse resolution) |
| AI        | < 0.10 ms                | < 2.0 ms               | 20× (spline lookup, PID, state machine branching)       |
| Collision | < 0.01 ms                | < 0.5 ms               | 50× (event dispatch chain, 20+ contacts)                |
| Fuel      | < 0.01 ms                | < 0.3 ms               | 30×                                                     |
| Tire      | < 0.01 ms                | < 0.3 ms               | 30×                                                     |
| Race Mgmt | < 0.02 ms                | < 0.5 ms               | 25× (position sorting, DNF checks)                      |
| Pit Stop  | < 0.02 ms                | < 0.2 ms               | 10×                                                     |

---

## Appendix B: Budget Change History

| Date       | Version | Change                                                                                                                               |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-06-22 | 1       | Initial document. Derived from ADR-0002 through ADR-0025, control-manifest Performance Guardrails, and project architecture summary. |
