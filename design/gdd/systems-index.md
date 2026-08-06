# Systems Index: Overdrive

> **Status**: Draft
> **Created**: 2026-07-21
> **Last Updated**: 2026-07-27
> **Art Bible**: All 9 sections APPROVED — AD-ART-BIBLE gate: PASS (2026-07-27)
> **Source Concept**: design/gdd/game-concept.md

## Systems Enumeration

| # | System | Category | Layer | Description | Source |
|---|--------|----------|-------|-------------|--------|
| 1 | Input | Foundation | Foundation | Keyboard/mouse + gamepad, dead zone, EMA smoothing, device switching | Explicit |
| 2 | Simulation Architecture | Foundation | Foundation | Fixed timestep 60Hz, sim/render separation, input recording | Implicit |
| 3 | Settings | Foundation | Foundation | Difficulty (3-5 levels), controls, audio | Implicit |
| 4 | Content Pipeline | Foundation | Foundation | Addressables, per-race asset loading | Implicit |
| 5 | Ghost Recording | Foundation | Foundation | Input recording for future ghost/replay system | Implicit |
| 6 | Multiplayer Architecture | Foundation | Foundation | SDK-agnostic boundary, sim/render separation for network | Implicit |
| 7 | Vehicle Physics | Core | Core+Presentation | Grip, recovery, deterministic, arcade handling | Explicit |
| 8 | Camera | Presentation | Core+Presentation | Cockpit primary, chase option | Explicit |
| 9 | HUD | Presentation | Core+Presentation | Fuel, tire, speed, position, lap, rival info | Explicit |
| 10 | Audio | Presentation | Core+Presentation | Engine, speed feedback, tire squeal | Explicit |
| 11 | Fuel | Core | Core | Throttle-proportional consumption, lift-and-coast, weight effect | Explicit |
| 12 | Tire | Core | Core | Distance-based wear, aggression/surface multipliers | Explicit |
| 13 | Pit Stop | Core | Core | Refuel + tire change, 8-10s, AI pit behavior | Explicit |
| 14 | Qualifying | Core | Core | Single attempt, fixed fuel load, grid position | Explicit |
| 15 | AI Rival | Core | Core | 16 fixed personalities (MVP), distinct behavior | Explicit |
| 16 | Track | Core | Core | 4 tracks (MVP), spline architecture, surface types | Explicit |
| 17 | Car Definition Data | Core | Core | 16 F1 teams (1 car each), stats transfer to car, stat→behavior mapping | Explicit |
| 18 | Race Session Manager | Core | Core | Qualifying → race → results flow | Implicit |
| 19 | Grid & Start | Core | Core | Standing start, 16-car grid, lapped traffic | Implicit |
| 20 | VFX | Presentation | Presentation | Directional Velocity — streaks, blur, camera shake | Explicit |
| 21 | UI Menu | Presentation | Presentation | Title → Single Race/Settings → sub-screens → race | Explicit |

## Phase Scope Matrix

`design/gdd/game-concept.md` is the authoritative phase definition. This matrix classifies each system GDD for review and implementation planning; it does not replace detailed rules inside the GDDs.

| System | MVP active scope | MVP architecture constraint | Alpha | Beta | Release |
|--------|------------------|-----------------------------|-------|------|---------|
| Input | Local race input | `SimulationInput` per tick | Replay | Not designed | Not designed |
| Simulation Architecture | Local 60 Hz simulation | Sim/render separation, explicit state boundaries | Ghost replay | Network driver | Not designed |
| Settings | Local settings | Versioned schema | Cloud sync | Not designed | Not designed |
| Content Pipeline | Local race assets | Addressable race boundaries | Remote content | Not designed | Not designed |
| Ghost Recording | No player-facing ghost feature | Per-tick recordable input boundary | Replay and sharing | Continues | Not designed |
| Multiplayer Architecture | Offline only | Gameplay has no transport dependency | Async CloudStorage | Real-time multiplayer | Complete multiplayer |
| Vehicle Physics, Camera, HUD, Audio, VFX | Core local presentation | Explicit local interfaces | Per-GDD additions only | Per-GDD additions only | Per-GDD additions only |
| Fuel, Tire, Pit Stop, Qualifying, AI Rival, Track, Car Data, Race Session, Grid & Start, UI Menu | Standalone race loop | Data/event boundaries remain extensible | Per-GDD additions only | Per-GDD additions only | Per-GDD additions only |

### Review Rule

For an MVP review, Alpha, Beta, and Release behavior is compatibility context only. It blocks MVP approval only when an MVP rule violates an explicit MVP architecture constraint in the relevant GDD. Future-phase mechanics, networking APIs, persistence flows, and release content are not MVP review blockers.

## Dependency Layers

### Foundation (design first — no gameplay depends on these yet, but everything depends on them)
1. Input
2. Simulation Architecture
3. Settings
4. Content Pipeline
5. Ghost Recording
6. Multiplayer Architecture

### Core + Presentation (interleaved — design together for early visual feedback)
7. Vehicle Physics + Camera
8. HUD + Audio

### Core (race mechanics)
9. Fuel + Tire + Pit Stop
10. Qualifying
11. AI Rival
12. Track
13. Car Definition Data
14. Race Session Manager
15. Grid & Start

### Presentation (polish)
16. VFX
17. UI Menu

## Design Order

| Phase | System(s) | Rationale |
|-------|-----------|-----------|
| 1 | Input | First interaction point — nothing works without input |
| 2 | Simulation Architecture | Timestep, sim/render separation — everything depends on this |
| 3 | Settings | Difficulty levels, control config — needed before gameplay tuning |
| 4 | Content Pipeline | Addressables — needed before loading cars/tracks |
| 5 | Ghost Recording | Input recording from day 1 — can't retrofit later |
| 6 | Multiplayer Architecture | ADR only — define architecture, implement later |
| 7 | Vehicle Physics + Camera | First visible gameplay — car moves, camera follows |
| 8 | Fuel + Tire + Pit Stop | Core strategic layer — HUD needs this data before it can display it |
| 9 | HUD + Audio | See speed/position, hear engine — feedback loop complete |
| 10 | Qualifying | Grid determination — feeds into race |
| 11 | AI Rival | 16 opponents — the grid needs behavior |
| 12 | Track | 4 tracks — the worlds the car drives in |
| 13 | Car Definition Data | 16 F1 teams with stats — feeds into Vehicle Physics |
| 14 | Race Session Manager | Orchestration — qualifying → race → results |
| 15 | Grid & Start | 16-car spawn, standing start, lapped traffic |
| 16 | VFX | Directional Velocity visual language |
| 17 | UI Menu | Title, navigation, race selection |

## High-Risk Systems

| System | Risk | Mitigation |
|--------|------|------------|
| Vehicle Physics | Core feel — if this doesn't feel right, nothing works | Prototype early, external playtest |
| Simulation Architecture | Fixed timestep + determinism — foundational | Validate with 16 cars before content |
| AI Rival | 16 distinct personalities — perception threshold | Test player recognition, not just parameters |
| Multiplayer Architecture | Network SDK — external dependency (ADR-0016 deferred) | ADR first, validate early |

## Progress Tracker

| System | Status | GDD | Review |
|--------|--------|-----|--------|
| Input | Needs Revision | design/gdd/input-system.md | GDD 2026-08-01 postdates ADR-0005 (2026-07-27) — sanitization/lifecycle contract needs confirmation (architecture-review 2026-08-06) |
| Simulation Architecture | Needs Revision | design/gdd/simulation-architecture.md | GDD 2026-08-01 postdates ADR-0001 (amended 2026-07-25) — 14-step/lifecycle detail needs confirmation (architecture-review 2026-08-06) |
| Settings | Approved | design/gdd/settings.md | Approved 2026-07-26 — cross-review 08-01 resolved (CB3 eight Chase elements; CW1 asym 15 synced) |
| Content Pipeline | Needs Revision | design/gdd/content-pipeline.md | GDD 2026-08-01 postdates ADR-0003 (2026-07-27) — PC/Web load ceilings absent from ADR (architecture-review 2026-08-06) |
| Ghost Recording | Approved | design/gdd/ghost-recording.md | Lean re-review — APPROVED — 2026-07-26 — zero blocking + one recommended issue remaining (future-service dependency labeling) |
| Multiplayer Architecture | Approved | design/gdd/multiplayer-architecture.md | Full design-review 2026-08-06 — SDK-agnostic revision — APPROVED (7 blockers resolved) |
| Vehicle Physics | Approved | design/gdd/vehicle-physics.md | Approved 2026-07-25 — cross-review 08-01 resolved (CB2 AC-R1 2.16L/27%; CW7 wear formula synced; CW1 asym 7/13 synced) |
| Camera | Approved | design/gdd/camera.md | Approved 2026-07-26 — cross-review 08-01 resolved (CW1 asym 1/2 synced) |
| HUD | Approved | design/gdd/hud.md | Re-review — APPROVED — 2026-08-01 — cross-review 08-01 resolved (CW5 internal counts 8/4; CW1 asym 4/11 synced) |
| Audio | Approved | design/gdd/audio-system.md | Approved 2026-07-25 — cross-review 08-01 resolved (CB1 final-lap sting totalLaps-1; CW4 CarAudioProfile; CW1 asym 12/14/16/17/20/21 synced) |
| Fuel | Approved | design/gdd/fuel-system.md | Approved 2026-07-26 — cross-review 08-01 resolved (CW1 asym 3/18/19/20/28 synced) |
| Tire | Approved | design/gdd/tire-system.md | Approved 2026-07-26 — cross-review 08-01 resolved (CW6 grip floor 0.20-0.30; CW7 wear formula; CW1 asym 21/22/23/24/28 synced) |
| Pit Stop | Approved | design/gdd/pit-stop.md | Approved 2026-07-26 — cross-review 08-01 resolved (CW6 1.10 ownership explicit; DW2 KEPT by decision; CW1 asym 25/26 synced) |
| Qualifying | Approved | design/gdd/qualifying.md | Re-review — APPROVED — 2026-08-01 — cross-review 08-01 resolved (DW3 KEPT by decision; spawn model vs ADR-0013 logged for propagate; CW1 asym 11/18/24/25/27/30 synced) |
| AI Rival | Approved | design/gdd/ai-rival.md | Approved 2026-07-26 — cross-review 08-01 resolved (CW6 1.10 ownership explicit; DW5 tier gap deferred to playtest; CW1 asym 29 synced) |
| Track | Approved | design/gdd/track-system.md | Approved 2026-07-26 — cross-review 08-01 resolved (CW1 asym 1/3/17/22 synced) |
| Car Definition Data | Approved | design/gdd/car-definition-data.md | Approved 2026-07-26 — cross-review 08-01 resolved (CW4 CarAudioProfile; CW1 asym 5/6/8/9 synced) |
| Race Session Manager | Needs Revision | design/gdd/race-session-manager.md | GDD 2026-08-01 postdates ADR-0001 (amended 2026-07-25) — ranking/classification detail needs confirmation (architecture-review 2026-08-06) |
| Grid & Start | Needs Revision | design/gdd/grid-start.md | GDD 2026-08-01 postdates ADR-0001/0007 (2026-07-27) — Perfect Start arming + Qualifying Results details untraced (architecture-review 2026-08-06) |
| VFX | Approved | design/gdd/vfx.md | Approved 2026-07-26 — cross-review 08-01 resolved (CW3 global_max_velocity derived from per-car max_velocity; CW1 asym 6/23 synced) |
| UI Menu | Needs Revision | design/gdd/ui-menu.md | GDD 2026-08-01 postdates ADR-0001/0003/0004/0005 (2026-07-27) — Qualifying Results terminology + non-stack nav needs confirmation (architecture-review 2026-08-06) |

## Prototype Findings — Race Feel (2026-08-03)

Race-feel prototype validation (see `prototypes/race-feel/REPORT.md` — CD verdict:
CONCERNS, PROCEED). Prototype values ARE the source of truth for the systems
below; production implementation must replicate them:

**Validated and propagated:**
- Stats TS/AC/GR/ST/BR — real 1989 F1 values → car-definition-data.md,
  entities.yaml (2026-08-04)
- Steering 1-state model + lift-off grip bonus (fixed g) + drift factor
  (track-radius activated) + reverse arcade inversion → vehicle-physics.md,
  ADR-0002 (2026-08-04)
- Camera follows velocity direction (drift visible), not heading →
  camera.md, ADR-0010 (2026-08-05)

**Pending production (from the report's If-Proceeding list):**
- Engine sound (ADR-0012) — the single biggest remaining feel gap
- Drift VFX (smoke/body roll — ADR-0010)
- Splines with elevation (ADR-0007) — prototype tracks are 2D
- AI rival grid (16 cars) — prototype has 1 car
- Real HUD (8 elements), cockpit camera, menus/car-track selection, settings
- Per-track retuning (16 tracks; cars may diverge on extreme layouts)
- Trackside content density for speed sensation
- Wall/runoff spacing preserving error space (playtester finding)
- Art-style-in-motion validation: minimal art test before heavy production

**Validation criteria (CD-PLAYTEST):** cockpit camera + engine sound +
art-in-motion playtest before asset production scales; starting-car
first-session scenario in the Alpha Career test plan.

## Art Bible

| Section | Status | Approved |
|---------|--------|----------|
| 1 — Visual Identity Statement | APPROVED | 2026-07-27 |
| 2 — Color Palette | APPROVED | 2026-07-27 |
| 3 — Lighting & Atmosphere | APPROVED | 2026-07-27 |
| 4 — Character Art Direction | APPROVED | 2026-07-27 |
| 5 — Environment & Level Art | APPROVED | 2026-07-27 |
| 6 — UI Visual Language | APPROVED | 2026-07-27 |
| 7 — VFX & Particle Style | APPROVED | 2026-07-27 |
| 8 — Asset Standards | APPROVED | 2026-07-27 |
| 9 — Style Prohibitions | APPROVED | 2026-07-27 |
| **Gate: AD-ART-BIBLE** | ✅ **PASS** | **2026-07-27** |
