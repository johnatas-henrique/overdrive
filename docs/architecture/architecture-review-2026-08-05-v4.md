# Architecture Review Report

**Date:** 2026-08-05
**Engine:** Unity 6000.3.19f1 (Unity 6.3 LTS), URP 17.3.0, Input System 1.19.0, AI Navigation 2.0.14, Addressables 3.1.0, UTF 1.6.0, uGUI 2.0.0
**GDDs Reviewed:** 21
**ADRs Reviewed:** 17 (all Accepted)
**Mode:** `/architecture-review full` (formal skill invocation, rerun after C1–C18 corrections + control-manifest regeneration)
**Reviewer:** technical-director (Phases 1–7) + unity-specialist (Phase 5 consultation)

---

## Traceability Summary

Total requirements: **144**
- ✅ Covered: **124** (86.1%)
- ⚠️ Partial: **13** (9.0%)
- ❌ Gaps: **7** (4.9%)

No new TR-IDs proposed — the registry already contains all 144 requirements extracted from the GDDs. No ambiguous matches required user resolution.

## Coverage Gaps (no ADR exists)

| TR-ID | GDD → System | Requirement | Suggested ADR | Domain | Engine Risk |
|-------|-------------|-------------|---------------|--------|-------------|
| TR-vp-008 | vehicle-physics.md → Vehicle Physics | Track-radius drift activation and driftHeadBoost | Amend ADR-0002 with validated drift model | Physics | MEDIUM |
| TR-vp-009 | vehicle-physics.md → Vehicle Physics | Engine-power-over-speed plus quadratic-drag acceleration | Amend ADR-0002 with validated longitudinal model | Physics | MEDIUM |
| TR-rsm-001 | race-session-manager.md → RSM | Exact position ranking | Create RSM Authority ADR (or amend ADR-0001 with ranking contract) | Session | LOW |
| TR-rsm-002 | race-session-manager.md → RSM | Lap authority and 90% anti-cut gate | Same RSM Authority ADR — connect Track detection to RSM ownership | Session | LOW |
| TR-rsm-003 | race-session-manager.md → RSM | FinishOrderResolver pace-only projection | Same RSM Authority ADR — define one-read resolver behavior | Session | LOW |
| TR-multiplayer-008 | multiplayer-architecture.md → Networking | Five reconnect attempts, backoff, resync, AI takeover | Amend ADR-0017 with disconnection/reconnection lifecycle | Networking | HIGH |
| TR-ui-002 | ui-menu.md → UI Menu | 15 RPM Garage Lit car turntable | UI Presentation ADR, or explicitly classify as UX-owned / non-architectural | UI | LOW |

## Partial Coverage (requires amendment or explicit classification)

- TR-content-007 — load ceilings: GDD ≤5s PC/≤10s Web vs ADR-0003 ~3–10s PC/5–15s Web
- TR-multiplayer-004 — 14-byte NetworkInput mapping deferred to Beta (ADR-0017:88-91)
- TR-fuel-002 — efficiency formula treated as tuning knob, not ratified
- TR-ai-003 — AI "not before lap 1 / final lap" rule not explicitly in ADR-0009
- TR-ai-005 — target-speed factor chain incomplete in ADR-0009
- TR-car-002 — stat-to-behavior formula mapping not fully ratified
- TR-camera-001 — Chase default (ADR-0010) vs Cockpit primary (camera.md)
- TR-camera-002 — four positional shake effects vs three angular layers clamped to 3°
- TR-camera-005 — terminal orbit vs dedicated three-quarter anchor
- TR-audio-002 — four named stings / −6 dB ducking not ratified in ADR-0012
- TR-audio-003 — 1200 Hz constant pitch and retrigger-rate formula absent in ADR-0012
- TR-ui-001 — complete screen-flow contract not owned by one ADR
- TR-ui-004 — pointer focus/boundary/prompt behavior not architecturally specified

## Cross-ADR Conflicts (Phase 4)

136 ADR pairs considered. **3 unresolved conflicts, all blocking.**

### Conflict C1 — TickStartSnapshot input and time contract

- **Type:** Data ownership / Integration / State
- **ADR-0001 claims** (adr-0001:76-92): TickStartSnapshot contains `RawInputSample[16]`, populated "at tick start", plus `deltaTime = Time.unscaledDeltaTime`
- **ADR-0005 claims** (adr-0005:187-200): a single immutable raw sample is captured exactly once per render frame before accumulator evaluation
- **ADR-0006 claims** (adr-0006:87-105,127-131): domain formulas consume the frame's raw sample at Step 2 and multiply per-second formulas by fixed tick duration
- **Approved GDD** (simulation-architecture.md:50-57,71-103): TickStartSnapshot contains prior domain state and cached AIInput; the one frame-level RawInputSample is passed separately to Step 2; systems receive `FIXED_DT`, not frame delta
- **Impact:** implementers can create 16 phantom raw samples, process input at the wrong step, or apply frame duration to fixed-step gameplay — multi-tick frames become frame-rate dependent
- **Resolution A (recommended):** amend ADR-0001 — remove RawInputSample and frame delta from TickStartSnapshot; pass one RawInputSample to Step 2; pass `FIXED_DT` explicitly to domain ticks
- **Resolution B:** rework ADR-0005/0006 and the GDD around per-car raw input (expands scope, violates local-player model)
- **Risk:** Blocking

### Conflict C2 — PerformanceReduced camera behavior

- **Type:** Performance / Pattern
- **ADR-0001 claims** (adr-0001:114-123): PerformanceReduced disables camera look-ahead and collision avoidance
- **ADR-0010 claims** (adr-0010:224-226): PerformanceReduced moves VFX to Low and disables camera shake
- **Camera GDD** (camera.md:65-71): Reduced Motion disables shake, dynamic FOV and look-ahead; collision avoidance remains active
- **Simulation GDD** (simulation-architecture.md:56-57): PerformanceReduced reduces optional VFX/render quality; does not define collision avoidance as disposable
- **Impact:** two different degradation implementations possible; disabling collision avoidance can introduce wall clipping exactly when performance is degraded
- **Resolution A (recommended):** ADR-0010 authoritative for presentation degradation — preserve collision avoidance, force VFX Low, disable shake, decide explicitly whether look-ahead is reduced; ADR-0001 publishes only the signal
- **Resolution B:** keep ADR-0001 behavior, amend ADR-0010 + Camera GDD to treat collision avoidance as optional
- **Risk:** Blocking

### Conflict C3 — Collision-to-camera data path

- **Type:** Integration / Data ownership
- **ADR-0002 claims** (adr-0002:99-105): `CarCollisionMonitor` forwards collision callbacks only to VehiclePhysicsSystem
- **ADR-0010 interface comment claims** (adr-0010:60-64): `ImpactShakeRequest` comes from CarCollisionMonitor
- **ADR-0010 later claims** (adr-0010:149-157): VP writes wall contact into CarState; VFX emits ImpactShakeRequest; Camera consumes it; Camera never reads CarCollisionMonitor directly
- **Impact:** the interface can be implemented as unauthorized direct MonoBehaviour→Camera coupling
- **Resolution A (recommended):** remove the direct-monitor comment; make `CarState.WallContact/impact data → VFX → ImpactShakeRequest → Camera` the sole contract
- **Resolution B:** authorize a separate presentation callback from CarCollisionMonitor (two consumers, weakens snapshot ownership)
- **Risk:** Blocking (contradictory public interface)

### Verified prior findings (C1–C18 of the 2026-08-05 round)

| Prior issue | Result |
|---|---|
| ForceMode registry authority | ✅ Fixed — registry selects ForceMode.Force (architecture.yaml:424-434) |
| Ghost header 72/80 bytes | ✅ Fixed — exact total 80 incl. byte[14] (adr-0008:58-85) |
| Input capture order | ⚠️ Main pipeline fixed (architecture.md:237-284); ADR-0001 TickStart schema still conflicts (C1) |
| ContentLoadError semantics | ✅ Fixed — CarLoadDegraded non-abortive; ContentLoadError abortive (adr-0003:46-57,96-127) |
| Camera 0.35s/0.2s | ✅ Confirmed intentional distinction (adr-0010:121-124) |
| Counter-based RNG | ✅ Fixed — no mutable per-car stream (adr-0009:89-114) |
| PitServiceCommand.requestExit | ✅ Fixed — next-tick owned (adr-0011:88-109,131-136) |
| HUD snapshot single read | ✅ Fixed (adr-0014:61-64) |
| CarDefinition clamp | ✅ Fixed — integer [0,20], nearest clamp, one race-init pass (adr-0015:137-156) |
| Beta rollback isolation | ✅ Fixed — all 16 cars restored/replayed; forward-only domains (adr-0017:115-153) |

## ADR Dependency Order

`0001 → {0002, 0003, 0004} → {0005, 0006, 0008} → {0007, 0016} → {0009, 0010, 0017} → {0011, 0012, 0014} → 0013 → 0015`

- Cycles: **None**
- Nonexistent dependencies: **None**
- Dependencies on Proposed ADRs: **None** (all 17 Accepted)
- Caveat: ADR-0015 depends on ADR-0012 for CarAudioProfile — shared-schema ordering, not runtime dependency

## GDD Revision Flags (Phase 5b)

**None from confirmed engine incompatibility.** The camera and load-time findings are design-to-architecture drift, not engine-reality contradictions; they are resolved in ADRs first.

## Engine Compatibility Issues (Phase 5)

### Audit results

- ADR engine versions: **17/17 consistent** (Unity 6000.3.19f1)
- Missing Engine Compatibility sections: **Zero**
- Deprecated APIs in use by Accepted ADRs: **Zero**

### Live-verified API claims (unity-specialist, unity_reflect + execute_code on the connected editor)

All confirmed: `Physics.Simulate(float)` non-obsolete; `Physics.simulationMode` writable; `Rigidbody.velocity/drag/angularDrag` obsolete (renamed to linearVelocity/linearDamping/angularDamping, plus current `maxLinearVelocity`); `Screen.SetResolution(..., RefreshRate)` current, integer-refresh overloads obsolete; Input System `UpdateMode` = ProcessEventsInDynamicUpdate/FixedUpdate/Manually; URP `FullScreenPassRendererFeature`/`MotionBlur`/`MotionBlurMode.CameraOnly` current; Addressables `LoadAssetAsync`/`Release`/`ReleaseInstance` non-obsolete; `AudioClip.Create` `_3D` overloads obsolete with official guidance "use spatialBlend property of AudioSource" (ADR-0012 mitigation is word-for-word correct).

### Engine findings (from audit + specialist)

| Severity | Finding | Evidence | Action |
|---|---|---|---|
| HIGH | ADR-0007 rationale is factually wrong: `UnityEngine.JSONNode` does **not** exist in 6000.3.19f1 (reflection: 0 hits in UnityEngine; only TextMateSharp's SimpleJSON). The wrapper is required because JsonUtility **cannot serialize arrays/lists at the JSON root** (empirically proven: `FromJson<T[]>` → ArgumentException "Return type must represent an object type"; `ToJson(<array>)` → `{}`). float3[] as a field serializes fine (object form `{"x":..,"y":..,"z":..}` — array form `[x,y,z]` is NOT accepted by the serializer) | adr-0007:139-142; live reflection + eval | Correct ADR-0007 rationale; bump Knowledge Risk to MEDIUM; add exact-field-name + object-form-float3 pipeline constraints as validation criteria |
| HIGH | **snake_case vs camelCase mismatch (specialist new finding):** ADR-0007 declares snake_case JSON but the C# schema fields are camelCase (`segmentLengths`, `curvatureRad`, `startPointIndex`…). JsonUtility is case-sensitive, matches field names exactly, and has no renaming attribute — a pipeline emitting `segment_lengths` silently deserializes to defaults | adr-0007:49-78 | Pipeline must emit exactly the C# field names, or move to Newtonsoft.Json (ships in Unity 6 default packages, supports `[JsonProperty]`) / flat float[] layout |
| MEDIUM | ADR-0010 RecordRenderGraph mandate confirmed — `ScriptableRenderPass.Execute`/`Blit`/`Configure`/`ConfigureTarget`/`ResetTarget`/`OnCameraSetup`/`OnCameraCleanup`/`OnFinishCameraStackRendering` are all in obsolete_members in URP 17.3 | breaking-changes.md:21-24; unity_reflect | Prefer `FullScreenPassRendererFeature` (zero-C#-code path) for speed lines; hand-written RecordRenderGraph pass only if render-target logic exceeds the data-driven feature |
| MEDIUM | ADR-0012 audio-thread handoff: correct pattern is single-slot **immutable snapshot with atomic reference swap** (`Volatile.Write`/`Interlocked.Exchange` + `Volatile.Read`), NOT a multi-field FIFO (torn reads) and NOT latest-wins-fifo (audio callback cadence ~188 Hz @ 48 kHz/256 samples exceeds the 60 Hz sim tick — a queue accumulates lag). Budget must also state the audio-thread side: 16 cars × PCMReaderCallback must fit the DSP buffer period | adr-0012:198-202 | Amend ADR-0012 with the atomic-snapshot pattern and audio-thread budget statement; keep oscillator running through focus-loss/pause with last-known parameters; guard denormals; use `AudioSettings.outputSampleRate` |
| MEDIUM | Addressables: **group names are never runtime keys** — an asset's Address is the load key. ADR-0003's `LoadAssetAsync($"Tracks/{trackId}")` works only if editor tooling explicitly assigns matching addresses. **`AddressableKeys.CarDefinition = "CarDefinition"` is a collision across 16 cars** — needs per-car address `Cars/{teamId}/CarDefinition` (same for TrackData when multiple tracks share a catalog) | addressables.md:44-60,93-135; adr-0003:129-139 | Amend ADR-0003: explicit address-assignment validation criterion; per-car CarDefinition address |
| MEDIUM | ADR-0008 Alpha LZ4 note: Unity has **no public built-in LZ4 API** — requires a third-party package (e.g. K4os.Compression.LZ4) at Alpha. MVP unaffected (in-memory only) | adr-0008:170-200 | Name the dependency in the Alpha note |
| MEDIUM | ADR-0004: `PlayerPrefs.Save()` not mentioned — writes are batched on several platforms (iOS/Android; WebGL flush timing differs); backup-first atomicity is only thread-local without an explicit Save | adr-0004:58-80 | Add `PlayerPrefs.Save()` after each primary write |
| LOW | ADR-0010 preset table says MotionBlur "Off (Low)" — `MotionBlurQuality` has no `Off` value (Low/Medium/High only); must be intensity 0 / disabled override | adr-0010:228-262 | Fix preset wording |
| LOW | ADR-0012 diagram shows 3 mixer groups (Master → Music/SFX/UI) vs ADR-0004 4 volumes and ADR-0012 text "5 layers"/"3 groups" — reconcile group count | adr-0012; adr-0004:91-131 | One-line reconciliation in ADR-0012 |
| LOW | Deprecation index gaps: deprecated-apis.md lacks Screen.SetResolution integer-refresh overloads, AudioClip.Create `_3D` overloads, and OffMeshLink (all confirmed obsolete live; navigation.md already points to Unity.AI.Navigation.NavMeshLink) | deprecated-apis.md:8-15; unity_reflect | Add all three to deprecated-apis.md with "migrate before next Unity bump" note |

## Architecture Document Coverage (Phase 6)

- Systems present: **21/21** (systems-index.md vs architecture.md) — no orphaned systems
- Layer ownership: complete
- Core data flow: present
- **12 material issues found** (stale/invalid master architecture):

| Severity | Finding | Evidence |
|---|---|---|
| Blocking | `PublishedSimulationSnapshot` declares two fields named `State` (one SimulationState, one GameState) — cannot compile | architecture.md:379-393 |
| High | ADR-0016/0017 still marked Proposed (both Accepted) | architecture.md:3-8 |
| High | ADR audit + "Required ADRs" sections stop at ADR-0015, claim 15 ADRs exist | architecture.md:545-601 |
| High | Traceability section stale: 194 requirements / 57 gaps vs current 144-entry registry | architecture.md:581-590 |
| High | `ContentLoadError` lacks `ContentErrorType`, unlike ADR-0003 public contract | architecture.md:413-417 |
| High | Camera summary: Cockpit primary vs ADR-0010 Chase default | architecture.md:68-70,225-233 |
| High | Audio summary: eight states vs ADR-0012 nine | architecture.md:225-233 |
| Medium | HUD table reads as direct system reads, contrary to ADR-0014 snapshot-only boundary | architecture.md:225-233 |
| Medium | "Seed PCG32 per car" misleading after counter-based ADR-0009 | architecture.md:300-304 |
| Medium | Presentation budget 2.1ms stale (ADR-0010 = 2.25ms planned / 2.4ms ceiling) | architecture.md:596-601 |
| Medium | ADR-0017 network driver/rollback boundaries not in master API/data flow | ADR-0017 vs architecture.md:336-543 |
| Medium | Registry HUD contract says "direct interface" (snapshot-only per ADR-0014) | docs/registry/architecture.yaml:242-253 |
| Medium | Registry car-validation retains `validValues[]`/`maxSpreadPercentage` vs ADR-0015 continuous [0,20] clamp | docs/registry/architecture.yaml:312-323 |

## Items Not Fully Verifiable

1. JsonUtility + `Unity.Mathematics.float3[]` round-trip: partially proven (root-array limitation and object-form confirmed empirically); full TrackData schema round-trip requires an EditMode serialization fixture
2. Actual runtime budgets (simulation, VFX, HUD, procedural audio, Beta rollback): remain empirical gates — this review verified budgets and ownership, not measured performance
3. Beta networking provider/API behavior: intentionally unverifiable, no SDK selected
4. WebGL networking viability: deferred to Beta provider selection
5. Addressable runtime keys: topology documented; actual editor group/address configuration not audited
6. Camera/VFX visual quality: contracts reviewed textually; no integrated screenshot/profiler evidence yet

---

## Verdict: **FAIL** (advisory)

The architecture cannot pass while Accepted ADRs contain 3 unresolved integration conflicts and 7 active technical requirements have no ADR coverage.

This verdict does **not** mean the overall direction is unsound: the manual simulation authority, ownership model, networking boundary and corrected rollback isolation are coherent (10/10 prior findings confirmed fixed). The failure is caused by source drift after later GDD revisions and by the master architecture not being regenerated after ADR-0016/0017 acceptance.

### Blocking Issues (must resolve before PASS)

1. Amend ADR-0001 — TickStartSnapshot raw-input cardinality and fixed-time contract (C1)
2. Resolve PerformanceReduced camera behavior between ADR-0001 and ADR-0010 (C2)
3. Resolve the collision-to-camera interface contradiction (C3)
4. Amend ADR-0010 to match approved Camera GDD (Cockpit default; three angular shake layers 3° clamp; approved look-ahead formula; dedicated terminal three-quarter view)
5. Add ADR coverage for TR-vp-008 and TR-vp-009 (validated drift + longitudinal models into ADR-0002)
6. Add RSM ADR coverage for ranking, lap authority, finish projection (TR-rsm-001/002/003)
7. Add ADR-0017 reconnect lifecycle coverage (TR-multiplayer-008)
8. Correct the invalid/stale master architecture API and audit sections (12 issues, incl. duplicate `State` fields)

### Required ADRs

| Priority | ADR work |
|---|---|
| P0 | Amend ADR-0001: TickStartSnapshot, fixed delta, input capture, PerformanceReduced producer-only boundary |
| P0 | Amend ADR-0010: approved Camera behavior, collision/shake data path, MotionBlur Off wording |
| P0 | Amend ADR-0002: drift (TR-vp-008) and longitudinal force (TR-vp-009) formulas |
| P0 | Create RSM Authority ADR: ranking, lap authority, finish resolver, immutable outputs |
| P1 | Amend ADR-0017: NetworkInput mapping gate + disconnect/reconnect lifecycle (TR-multiplayer-008) |
| P1 | Amend ADR-0003: authoritative load ceilings (TR-content-007), address assignment, per-car CarDefinition key |
| P1 | Amend ADR-0009: complete target-speed (TR-ai-005) and pit-restriction (TR-ai-003) contracts |
| P1 | Amend ADR-0012: named stings/−6 dB (TR-audio-002), tire-squeal formula (TR-audio-003), atomic audio handoff |
| P1 | Resolve ADR-0006/0015 vs GDD: ratify efficiency/stat formulas or formally revise GDD + TR registry to tuning-knob ownership (TR-fuel-002, TR-car-002) |
| P2 | Create UI Presentation ADR: full screen flow, pointer/focus, car turntable (TR-ui-001/002/004) — or explicitly classify as UX-only |
| P2 | Update deprecated-apis.md with the three confirmed obsolete API families |
| P2 | Amend ADR-0007: correct JsonUtility rationale, snake_case/camelCase contract, Knowledge Risk MEDIUM |

### Success criteria for the next review

1. Cross-ADR conflict count is zero
2. Gap count is zero
3. Partials are either covered or explicitly classified as non-architectural
4. `architecture.md` reflects 17 Accepted ADRs and 144 current TRs
5. Snapshot and event signatures are internally valid
6. TrackData JSON round-trip has executable evidence
