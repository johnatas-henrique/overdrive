# Systems Index: Overdrive

> **Status**: Draft
> **Created**: 2026-07-21
> **Last Updated**: 2026-07-26
> **Source Concept**: design/gdd/game-concept.md

## Systems Enumeration

| # | System | Category | Layer | Description | Source |
|---|--------|----------|-------|-------------|--------|
| 1 | Input | Foundation | Foundation | Keyboard/mouse + gamepad, dead zone, EMA smoothing, device switching | Explicit |
| 2 | Simulation Architecture | Foundation | Foundation | Fixed timestep 60Hz, sim/render separation, input recording | Implicit |
| 3 | Settings | Foundation | Foundation | Difficulty (3-5 levels), controls, audio | Implicit |
| 4 | Content Pipeline | Foundation | Foundation | Addressables, per-race asset loading | Implicit |
| 5 | Ghost Recording | Foundation | Foundation | Input recording for future ghost/replay system | Implicit |
| 6 | Multiplayer Architecture | Foundation | Foundation | Coherence integration, sim/render separation for network | Implicit |
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
| Multiplayer Architecture | Coherence integration — external dependency | ADR first, validate early |

## Progress Tracker

| System | Status | GDD | Review |
|--------|--------|-----|--------|
| Input | Approved | design/gdd/input-system.md | Lean review — APPROVED — 2026-07-25 |
| Simulation Architecture | Approved | design/gdd/simulation-architecture.md | Lean re-review — APPROVED — 2026-07-26 — zero blocking + zero recommended issues |
| Settings | Approved | design/gdd/settings.md | Lean re-review — APPROVED — 2026-07-26 — zero blocking + zero recommended issues |
| Content Pipeline | Approved | design/gdd/content-pipeline.md | Lean review — APPROVED — 2026-07-25 — zero cross-GDD issues |
| Ghost Recording | Approved | design/gdd/ghost-recording.md | Lean re-review — APPROVED — 2026-07-26 — zero blocking + one recommended issue remaining (future-service dependency labeling) |
| Multiplayer Architecture | Approved | design/gdd/multiplayer-architecture.md | Lean re-review — APPROVED — 2026-07-26 — zero blocking + zero recommended issues |
| Vehicle Physics | Approved | design/gdd/vehicle-physics.md | Lean review — APPROVED — 2026-07-25 — zero cross-GDD issues |
| Camera | Approved | design/gdd/camera.md | Lean re-review — APPROVED — 2026-07-26 — zero blocking + zero recommended issues |
| HUD | Needs Revision | design/gdd/hud.md | Formal review — CONCERNS — 2026-07-26 — tire numeric readout missing |
| Audio | Approved | design/gdd/audio-system.md | Lean review — APPROVED — 2026-07-25 — zero cross-GDD issues |
| Fuel | Needs Revision | design/gdd/fuel-system.md | Formal review — CONCERNS — 2026-07-26 — Vehicle Physics dependency table is one-directional |
| Tire | Approved | design/gdd/tire-system.md | Lean re-review — APPROVED — 2026-07-26 — zero blocking + zero recommended issues |
| Pit Stop | Needs Revision | design/gdd/pit-stop.md | Formal review — CONCERNS — 2026-07-26 — 16-car simultaneous service assumes unspecified pit geometry |
| Qualifying | Approved | design/gdd/qualifying.md | Lean re-review — APPROVED — 2026-07-26 — zero blocking + zero recommended issues |
| AI Rival | Approved | design/gdd/ai-rival.md | Lean re-review — APPROVED — 2026-07-26 — zero blocking + zero recommended issues |
| Track | Needs Revision | design/gdd/track-system.md | Formal review — CONCERNS — 2026-07-26 — lap anti-cut note missing; row-spacing range conflict |
| Car Definition Data | Approved | design/gdd/car-definition-data.md | Lean re-review — APPROVED — 2026-07-26 — zero blocking + zero recommended issues |
| Race Session Manager | Needs Revision | design/gdd/race-session-manager.md | Formal review — CONCERNS — 2026-07-26 — finish projection ignores pit/resource state |
| Grid & Start | Needs Revision | design/gdd/grid-start.md | Formal review — CONCERNS — 2026-07-26 — grid row-spacing range conflicts with Track |
| VFX | Approved | design/gdd/vfx.md | Lean re-review — APPROVED — 2026-07-26 — zero blocking + zero recommended issues |
| UI Menu | Approved | design/gdd/ui-menu.md | Lean re-review — APPROVED — 2026-07-26 — zero blocking + zero recommended issues |
