# Systems Index: Overdrive

> **Status**: Draft
> **Created**: 2026-06-18
> **Last Updated**: 2026-06-18
> **Source Concept**: design/gdd/game-concept.md

---

## Summary

| Tier | Systems | Designed | GDD Written | Implemented | Verified | Description |
| ---- | ------- | -------- | ----------- | ----------- | -------- | ----------- |
| **MVP** | 24      | 24       | 24          | 0           | 0        | —           |
| **Alpha**       | 5       | Championship, progression, economy, damage     |
| **Full Vision** | 3       | Multiplayer, replay, history mode       |
| **Total**       | 32      | —                                       |

> **Note on detail level**: The MVP tier is fully specified (all systems, dependencies, and phases documented). Alpha and Full Vision tiers are listed but not expanded — they will be detailed when development reaches those phases. Expanding them now would lock in design decisions before the MVP teaches us what needs to change.

> **Creative Director Note (CD-SYSTEMS gate, 2026-06-18)**: The MVP covers only Pillars 1 and 2 fully. Pillar 3 (progression) and Pillar 4 (personalities beyond speed) are deferred to Alpha — the MVP's purpose is to validate whether the core race loop is fun, not to demonstrate all four pillars. Item 3 (speed feel mandates) was applied to MVP. Full CD concerns documented in `.opencode/scratch/cd-systems-concerns.md`.

---

## MVP — Foundation (Fase 0)

Built before anything renders on screen. These systems are the architectural backbone — everything in Fase 1 depends on them.

| #   | System                | Category       | Dependencies             | Phase | Status   |
| --- | --------------------- | -------------- | ------------------------ | ----- | -------- |
| 1   | Data & Config Manager | Infrastructure | —                        | 0     | Designed |
| 2   | Event Bus             | Infrastructure | —                        | 0     | Designed |
| 3   | Game State Machine    | Infrastructure | Event Bus                | 0     | Designed |
| 4   | Persistence Interface | Infrastructure | —                        | 0     | Designed |
| 5   | Simulation Snapshot   | Infrastructure | —                        | 0     | Designed |
| 6   | Asset Manager         | Infrastructure | Data & Config            | 0     | Designed |
| 7   | Entity/Car Lifecycle  | Infrastructure | Event Bus, Data & Config, Asset Manager | 0     | Designed |
| 8   | Dev Tools             | Developer Tool | Event Bus, Data & Config, Game State Machine, Simulation Snapshot | 0     | Designed |
| 9   | Determinism Contract  | Constraint     | —                        | 0     | Designed |

**GSM states**: Loading → Menu → PreRace → Racing → PostRace → Menu (loop)
**Entity scope (Fase 1)**: Player car + AI cars + static track colliders only.
**Simulation Snapshot**: Interface `ISnapshotable` with `serialize()` / `deserialize()` / `hash()`. Schema emerges in Fase 1.
**Dev Tools**: Debug overlay (FPS, physics step, draw calls), AI telemetry visualizer, parameter hot-reload.
**Persistence**: Lightweight localStorage/indexedDB wrapper. Full career persistence deferred to Alpha.

---

## MVP — Single Race (Fase 1)

Everything needed for one complete race. Player picks car and track, races 7 AI rivals with fuel/tire strategy, sees results.

### Core Racing & Controls

| #   | System            | Category    | Dependencies                                                     | Phase | Status      |
| --- | ----------------- | ----------- | ---------------------------------------------------------------- | ----- | ----------- |
| 10  | Input             | Core Racing | —                                                                | 1     | Designed    |
| 11  | Menu LITE         | UI          | Input, Data & Config, Asset Manager, GSM                         | 1     | Designed    |
| 12  | Physics/Handling  | Core Racing | Input, Entity/Car Lifecycle, Data & Config, Determinism Contract | 1     | Designed    |
| 13  | Collision         | Core Racing | Entity/Car Lifecycle                                              | 1     | Designed    |
| 14  | Camera            | Core Racing | Physics/Handling                                                 | 1     | Designed    |

**Physics**: Arcade grip (lift-to-turn, no drift, high speed sensation). Not a simulator.
**Collision**: Car↔car and car↔barrier detection only. Event-driven via Event Bus. Finish line → Race Management (spatial check). Pit entry/exit → Pit Stop (spatial check). **Speed feel**: Screen shake on collision impact, player-only (amplitude proportional to relative velocity).
**Camera**: Cockpit default + chase toggle. No smooth transitions in MVP. **Speed feel**: FOV shift proportional to speed (narrows at high speed, widens at low speed) — linear interpolation, no easing curve needed in MVP.
**Menu LITE**: Title screen, Single Race button, car/track selection, results screen. Full menu and 3D paddock deferred to Alpha (`menu-full.md`, `paddock.md`).

### Track & AI

| #   | System              | Category | Dependencies                                                                                | Phase | Status      |
| --- | ------------------- | -------- | ------------------------------------------------------------------------------------------- | ----- | ----------- |
| 15  | Track + Environment | Track    | Asset Manager, Data & Config                                                                | 1     | Design Complete |
| 16  | Fuel                | Strategy | Physics/Handling, Data & Config                                                             | 1     | Design Complete |
| 17  | Tire Wear           | Strategy | Physics/Handling, Data & Config                                                             | 1     | Design Complete |
| 18  | Pit Stop            | Strategy | Fuel, Tire Wear, Race Management, Entity/Car Lifecycle, Event Bus, Track + Env, Physics/Handling | 1     | Design Complete |
| 19  | AI Driver           | AI       | Physics/Handling, Entity/Car Lifecycle, Data & Config, Track + Env, Collision, Fuel, Tire Wear, Pit Stop | 1     | Design Complete |

**Track geometry**: Includes pit lane from the start — retrofitting later would require remaking the track.
**Fuel**: Consumption per tick from throttle avg. Lift-and-coast to conserve — no driving mode toggle. Runtime data flow with Physics is bidirectional (reads throttle_avg via getter, writes fuel_mult via setter). Module dependency is one-way: Fuel → Physics — no circular dependency.
**Tire Wear**: Lateral + longitudinal load model. Degradation driven by driving aggression — smooth = slow wear, aggressive = fast wear. Track abrasion and off-track multipliers are global constants (not per-track); per-team durability upgrades create the strategic spread. Same pattern as Fuel: reads load data from Physics (getter), writes tire_condition back (setter). Module dependency is one-way: Tire Wear → Physics — no circular dependency.
**Pit Stop**: Physical pit lane with spline guidance. Refuel (progressive, player can exit early) + tire change (fixed delay). Merge check at garage exit (200ms interval).
**AI Driver**: 7 rivals with distinct personality profiles, difficulty speed multiplier (80%/100%/120%).

### Race Flow & Feedback

| #   | System             | Category       | Dependencies                                                                       | Phase | Status      |
| --- | ------------------ | -------------- | ---------------------------------------------------------------------------------- | ----- | ----------- |
| 20  | Race Management    | Race Flow      | Physics/Handling (spline distance), Collision, Data & Config, Event Bus | 1     | Design Complete |
| 21  | HUD                | UI/Feedback    | Physics/Handling (speed), Fuel, Tire Wear, Race Mgmt (pos, lap), Camera, Event Bus | 1     | Design Complete |
| 22  | Audio              | UI/Feedback    | Physics/Handling (RPM, speed), Collision (impacts), Event Bus, Asset Manager       | 1     | Design Complete |
| 23  | Telemetry Recorder | Developer Tool | Event Bus, Physics/Handling, AI Driver, Data & Config                              | 1     | Design Complete |
| 24  | Single Race        | Race Flow      | Race Management, Data & Config, Game State Machine                                 | 1     | Design Complete |

**Race Management**: Receives `RaceConfiguration` (grid size, lap count, ruleset), publishes `RaceEvent`s. Mode-agnostic — Single Race and Championship are different configurations.
**HUD**: Modular blocks (speed, lap, pos, fuel, tires, minimap). Rearrangeable layout.
**Audio MVP**: Engine pitch + tire placeholder. Spatial mixing deferred. **Speed feel**: Engine pitch must respond to RPM/throttle in real time and shift audibly with speed — no static loops. Prioritize engine sound quality over all other audio (tire, collision, ambient) in MVP, even if placeholder materials are used.
**Telemetry Recorder**: 20 Hz sampling, plain growing array, JSON export. Records rival telemetry per personality for AI validation.
**Single Race**: Thin adapter — builds `RaceConfiguration` from menu selections, calls `raceManager.init()` and `startRace()`. No state, no tick.

---

## Alpha — Championship (Fase 2)

Full championship campaign: multi-season progression, credits/XP economy, car upgrades, team switching.

| #   | System            | Category                   | Dependencies                                                                                     | Phase | Status      |
| --- | ----------------- | -------------------------- | ------------------------------------------------------------------------------------------------ | ----- | ----------- |
| 25  | Economy & Upgrade | Championship & Progression | Race Management (payout), Data & Config (costs), Entity/Car Lifecycle (apply stats)              | 2     | Not Started |
| 26  | Championship      | Championship & Progression | Race Management (results → points), Data & Config (points system, seasons), Event Bus, Save/Load | 2     | Not Started |
| 27  | Save/Load (full)  | Infrastructure             | Championship, Economy, Upgrade, Game State Machine, Persistence Interface                        | 2     | Not Started |
| 28  | Team Switching    | Championship & Progression | Championship (performance → offers), Data & Config (team stats, upgrade ceilings)                | 2     | Not Started |
| 29  | Damage            | Infrastructure             | Event Bus (consumes `collision.impact`), Entity/Car Lifecycle                                    | 2     | Not Started |

> **Detail**: These systems are listed but not expanded. They will be designed in detail when Alpha development begins.
> **Damage (29)**: Consumes `collision.impact` with `impulse > damageThreshold` to trigger mechanical failure. Phase 1 Collision already emits the event — Damage is a new consumer only, no changes to Collision required.

---

## Full Vision — Post-EA (Fase 3)

Multiplayer, replay viewer, and History mode (story campaign).

| #   | System        | Category       | Dependencies                                                       | Phase | Status      |
| --- | ------------- | -------------- | ------------------------------------------------------------------ | ----- | ----------- |
| 30  | Multiplayer   | Infrastructure | Event Bus, Race Management, Physics/Handling, Entity/Car Lifecycle | 3     | Not Started |
| 31  | Replay System | Infrastructure | Event Bus, Race Management, Physics/Handling, AI Driver, Camera    | 3     | Not Started |
| 32  | History Mode  | Gameplay       | Game State Machine, Event Bus, Championship, Race Management       | 3     | Not Started |

> **Detail**: These systems are listed but not expanded. They will be designed in detail when Full Vision development begins.

---

## Dependency Map

```
FOUNDATION (Layer 1)
  Data & Config Manager, Event Bus, Input

CORE (Layer 2) — depends on Foundation
  Asset Manager, Entity/Car Lifecycle, Game State Machine, Physics/Handling

ADVANCED CORE (Layer 3) — depends on Core
  Collision, Camera, Fuel, Tire Wear, AI Driver, Track + Environment

FEATURE (Layer 4) — depends on Advanced Core
  Race Management, Single Race, Pit Stop, Economy, Upgrade, Championship, Team Switching, Save/Load, Damage

PRESENTATION (Layer 5) — depends on Feature
  HUD, Menu/Paddock, Audio

DEV & INFRASTRUCTURE (Layer 6) — depends on Presentation
  Dev Tools, Multiplayer, Replay System, Telemetry Recorder, History Mode
```

**Circular dependencies**: None detected. The graph is a DAG.

## Bottleneck Systems

| System                | Depends on it | Risk      |
| --------------------- | ------------- | --------- |
| **Physics/Handling**  | 15+ systems   | 🔴 HIGH   |
| **Race Management**   | 8+ systems    | 🔴 HIGH   |
| **Event Bus**         | 10+ systems   | 🟡 MEDIUM |
| **Data & Config Mgr** | 15+ systems   | 🟢 LOW    |

## Build Phases

| Phase | Name            | Systems | What you have at the end                                   |
| ----- | --------------- | ------- | ---------------------------------------------------------- |
| 0     | Foundation      | 1–9     | Engine with dev tools running, nothing visible yet         |
| 1     | Single Race     | 10–24   | **MVP**: pick car→race→results, fuel/tire/pit, 7 AI rivals |
| 2     | Championship    | 25–29   | Full season, upgrades, team switching, damage              |
| 3     | Post-EA Content | 30–32   | Multiplayer, replay, history mode                          |

## Technical Constraints

- **Determinism**: Fixed physics timestep (1/60s), seeded RNG for AI, no frame-rate-dependent integration.
- **Simulation Snapshot**: Separates simulation state from rendering. Interface-driven (`ISnapshotable`) — concrete schema emerges in Fase 1.
- **Hot-reload safety**: Physics parameters apply only at tick boundaries, never mid-tick.
- **Telemetry budget**: 20 Hz sample rate, plain array, JSON export at race end (toggle F4).

## Progress Tracker

All systems are **Not Started**.

| Tier            | Systems | Designed | GDD Written | Implemented | Verified |
| --------------- | ------- | -------- | ----------- | ----------- | -------- |
| **MVP**         | 24      | 24       | 0           | 0           | 0        |
| **Alpha**       | 5       | 0        | 0           | 0           | 0        |
| **Full Vision** | 3       | 0        | 0           | 0           | 0        |
| **Total**       | 32      | 24       | 0           | 0           | 0        |
