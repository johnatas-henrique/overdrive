# Architecture Review v6 (validation rerun after v5 amends)

**Date:** 2026-08-06
**Scope:** 21 GDDs, 19 Accepted ADRs, TR Registry v8
**Mode:** /architecture-review full (validation rerun v6)
**Engine:** Unity 6000.3.19f1, URP 17.3.0
**Verdict:** **FAIL** (advisory) — the three v5 blocking cross-ADR conflicts are **resolved**; coverage improved from 140/144 to **143/144** (99.3%); 1 partial remains (TR-camera-004); 0 gaps.

---

## 1. Amendment verification (v5 → v6)

| # | Amendment | Status | Evidence |
|---|---|---|---|
| 1 | C1: player-input timing (ADR-0005 Single Frame-Level Capture + ResolvedCarInput Timing) | **ISSUES** | ADR amendment correct (adr-0001:41-46,78-93; adr-0005:171-182; input-system.md:111-128 agrees). **Propagation fixed in this round:** simulation-architecture.md Step 14 no longer re-carries the raw sample; architecture.md Step 14 and Frame Update Path aligned. |
| 2 | C2: presentation timing (ADR-0001 PresentationDriver + ADR-0010 diagram) | **ISSUES** | ADRs agree on one PresentationDriver in LateUpdate (adr-0001:126-135; adr-0010:85-96). **Propagation fixed in this round:** architecture.md Frame Update Path (step 4 note) and Ghost Exposes aligned. Open: VFX ImpactShakeRequest → Camera handoff under the new order (same-frame vs previous-frame semantics — gate 11). |
| 3 | C3: provider-neutral ghost storage (ADR-0008 ghostStorage + note) | **ISSUES** | ADR pair coherent (adr-0008:188-199; adr-0016:66-81). **Propagation fixed in this round:** ghost-recording.md section 6 rewritten to the generic interface (3 APIs + PlayerAccount removed), PendingUpload and Network SDK rows aligned; architecture.md Ghost Exposes aligned. |
| 4 | TR-ai-005 target-speed model (ADR-0009 ratifies GDD five-factor formula + explicit difficulty) | **VERIFIED** | adr-0009:125-142 matches ai-rival.md:45-55,141-153,208-214. Control manifest updated to the ratified formula in this round. |
| 5 | TR-camera-002 speed shake (ADR-0010 aligns to GDD values + playtest note) | **VERIFIED** | adr-0010:156-173 matches camera.md:89-99. |
| 6 | TR-camera-004 look-ahead (velocity-direction Chase, no Cockpit) | **ISSUES** | Primary rules, formula, ADR, and registry now consistent (camera.md:101-109,181-193; adr-0010:134-143; tr-registry.yaml:1042-1048). **Propagation fixed in this round:** camera.md Tuning Knobs and AC-LA1/LA2 replaced (AC-LA3 added for Cockpit); zero yaw-rate references remain. |
| 7 | TR-multiplayer-008 reconnect (never pauses, ~31s takeover) | **VERIFIED** | multiplayer-architecture.md:166-174,206-216,345-348 matches adr-0017:171-189. |

**Fully verified: 3/7 at v6 review time; 7/7 after propagation fixes applied in the same round.**

## 2. Coverage matrix (v6)

| System | Covered | Partial | Gaps |
|---|---:|---:|---:|
| Input System | 14 | 0 | 0 |
| Simulation Architecture | 14 | 0 | 0 |
| Settings | 8 | 0 | 0 |
| Content Pipeline | 8 | 0 | 0 |
| Ghost Recording | 7 | 0 | 0 |
| Multiplayer Architecture | 8 | 0 | 0 |
| Vehicle Physics | 10 | 0 | 0 |
| Fuel System | 5 | 0 | 0 |
| Tire System | 5 | 0 | 0 |
| Pit Stop | 5 | 0 | 0 |
| Qualifying | 8 | 0 | 0 |
| AI Rival | 6 | 0 | 0 |
| Track System | 5 | 0 | 0 |
| Car Definition Data | 5 | 0 | 0 |
| Race Session Manager | 6 | 0 | 0 |
| Grid & Start | 5 | 0 | 0 |
| Camera | 5 | 0 | 0 |
| HUD | 5 | 0 | 0 |
| Audio System | 5 | 0 | 0 |
| VFX | 5 | 0 | 0 |
| UI Menu | 5 | 0 | 0 |
| **Total** | **143** | **1** | **0** |

- **Covered:** 143/144 (99.3%), **Partial:** 1/144 (0.7%), **Gaps:** 0
- Former partials: TR-ai-005, TR-camera-002, TR-camera-004, TR-multiplayer-008 — all now Covered (TR-camera-004 required the camera.md tuning/AC fixes above).

## 3. Conflict scan

### v5 cross-ADR conflicts (all resolved)

| Conflict | Status |
|---|---|
| C1: player-input timing (ADR-0001 vs ADR-0005) | **Resolved** — ADRs + Simulation GDD + master architecture aligned |
| C2: presentation timing (ADR-0001 vs ADR-0010) | **Resolved** — PresentationDriver ratified in both ADRs + master aligned |
| C3: premature CloudStorage contract (ADR-0008 vs ADR-0016) | **Resolved** — generic ghostStorage interface everywhere; no provider API named |

### Remaining material conflicts (inherited from prior sessions — NOT from the v5 amends; deferred per user decision)

1. Master networking interface stale: `ISimulationDriver`/undefined `NetworkedInput` vs ADR-0017 `INetworkSimulationDriver`/`NetworkInput` (architecture.md:545-557)
2. Master result schemas stale: `FinishOrder`/`PlayerResult` cannot represent ADR-0018 classification/absent-position (architecture.md:356-371)
3. Forfeit represented as target state payload; `SimulationState` has no Forfeit state (architecture.md:343-371,461-486)
4. Car formula ownership: master assigns all formulas to Car Definition vs ADR-0015 (architecture.md:197-204)
5. Pre-race load flow sequential vs ADR-0003 parallel race-bundle decision (architecture.md:286-298)
6. `LapCompleted` signature stale (master adds `pos`; ADR-0018 defines carId/lapNumber/lapTime) (architecture.md:317-328)
7. Presentation consumers described as direct mutable-state readers (architecture.md:225-233)
8. Gear typed as float vs discrete six-speed value (architecture.md:423-439,489-505)
9. ADR audit in master falsely reports no conflicts (architecture.md:591-603)
10. ADR-0015 internal drift: continuous clamp vs "valid values array" (adr-0015:137-155,211-222)
11. Control manifest requires snake_case TrackData vs ADR-0007 camelCase (control-manifest.md:118-126; adr-0007:22-29,47-54)
12. Audio callback cadence 48 kHz/256-sample claim is desktop-specific (adr-0012:198-202)
13. Registry version: master says v7, actual v8 (architecture.md:605-611)

### Dependency graph

- Cycles: none. Unresolved dependencies: none. All 19 ADRs Accepted.

## 4. Engine audit

- **Version consistency: 19/19 ADRs** specify Unity 6000.3.19f1 (matches engine-reference and connected Editor).
- Amended-section claims all engine-valid: PresentationDriver (single LateUpdate entry point), CaptureLatestRawSample (Input System DynamicUpdate), manual Physics.Simulate (non-obsolete), ghostStorage (project-owned abstraction), 30-50 Hz shake (aliasing = playtest gate, no API incompatibility).
- **Verdict: PASS with implementation gates.**

## 5. v5 success criteria (v6 results)

| # | Criterion | v6 result |
|---|---|---|
| 1 | Cross-ADR conflict count is zero | ✅ **PASS** |
| 2 | Gap count is zero | ✅ **PASS** (0/144) |
| 3 | Partials covered or explicitly non-architectural | ✅ **PASS** (after camera.md propagation fixes; 1/144) |
| 4 | architecture.md reflects current ADR/TR count | ✅ **PASS** (minor: registry version says v7, actual v8) |
| 5 | Snapshot/event signatures internally valid | ❌ **FAIL** — master architecture stale interfaces (see remaining conflicts 1-8) |
| 6 | TrackData JSON round trip has executable evidence | ❌ **FAIL** — no golden fixture (implementation gate) |

**Passed: 4/6** (up from 3/6 at v6 review time; criterion 3 fixed by propagation edits in this round).

## 6. Final verdict

**FAIL** (advisory) — the three blocking cross-ADR conflicts that failed v5 are resolved and coverage is 143/144. The remaining failures are: (a) the master architecture (architecture.md) retains stale public interfaces inherited from the ADR-0017/0018/0019 amendment round of session B (deferred per user decision to the next review round), and (b) one implementation gate (TrackData JSON round-trip fixture) has no executable evidence yet.

This verdict does not block design direction: gap coverage is complete, the dependency graph is clean, the engine audit passes, and the conflict count between ADRs is zero.

## 7. Open implementation gates

### Original v5 gates

| Gate | Status |
|---|---|
| 1. Explicit presentation ordering | **CLOSED** (PresentationDriver ratified) — residual: ImpactShakeRequest handoff semantics (gate 11 below) |
| 2. Pin TrackData JSON dialect | **OPEN** — ADR camelCase vs control manifest snake_case (remaining conflict 11) |
| 3. Full-schema TrackData golden fixture | **OPEN** — no fixture/test |
| 4. Direct `com.unity.mathematics` dependency | **OPEN** — absent from manifest |
| 5. Replace motion-blur sample counts with `MotionBlurQuality` | **OPEN** — preset table still 8/16 samples (adr-0010:241-275) |
| 6. Release-safe memory-pressure measurement | **OPEN** — >95% threshold without measurement source (adr-0003:210-214) |
| 7. Allocation-free HUD formatting | **OPEN** — 0.10 ms budget without contract (adr-0014:141-151) |

### New v6 gates (master architecture debt, deferred)

8. Replace master network interface with ADR-0017's exact interface (architecture.md:545-557)
9. Replace stale finish/result/Forfeit contracts (architecture.md:356-371,461-486)
10. Correct Car Definition formula ownership (architecture.md:197-204; adr-0015:183-195)
11. Define same-frame vs previous-frame semantics for VFX-generated ImpactShakeRequest (adr-0010:89-94,156-173)
12. Align master pre-race load flow with ADR-0003 parallel bundle decision (architecture.md:286-298)
13. Correct LapCompleted signature (architecture.md:317-328; adr-0018:57-68)
14. Presentation consumers read published/interpolated boundary, not mutable state (architecture.md:225-233)
15. Gear as discrete type (architecture.md:423-439,489-505)
16. Fix master ADR audit + registry version (architecture.md:591-611)
17. Remove ADR-0015 "valid values array" language (adr-0015:211-222)
18. Align control manifest TrackData dialect with ADR-0007 camelCase (control-manifest.md:118-126)
19. Clarify audio callback cadence as platform-dependent (adr-0012:198-202)
20. Regenerate control manifest and master audit after gates 8-19

## 8. Consultation

None required — the connected Editor and engine references resolved all amended-section engine questions. Remaining failures are document-contract and propagation problems.
