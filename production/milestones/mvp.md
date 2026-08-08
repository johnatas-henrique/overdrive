# Milestone: MVP

## Overview

- **Target Date**: TBD
- **Type**: MVP
- **Duration**: TBD
- **Number of Sprints**: TBD

## Milestone Goal

Deliver the complete single-player offline race loop: the player drives a 1991 F1 car on a track through menu → car/track selection → qualifying → race → results, with responsive controls (keyboard/mouse + gamepad), the full simulation (manual 60 Hz accumulator, deterministic physics), and all supporting systems (vehicle physics, HUD, audio, VFX, fuel, tire, pit stop, AI rival, grid & start). The MVP is offline — no networking, no async, no real-time multiplayer.

## Success Criteria

- [ ] Player completes the full race loop end-to-end (menu → car/track selection → qualifying → race → results) without a crash
- [ ] All 16 cars (TS/AC/GR/ST/BR stats from the registry) are drivable; all 4 tracks (Monaco, Monza, Silverstone, Spa) load and race
- [ ] Responsive controls: keyboard/mouse + gamepad, radial/axial dead-zone, EMA smoothing, brake priority, active scheme arbitration (SimulationInput per tick)
- [ ] Deterministic simulation within budget: manual 60 Hz accumulator, Physics.Simulate, 14-step pipeline, p95 ≤ 6 ms / max ≤ 8 ms on baseline hardware
- [ ] Vehicle physics validated in playtest: grip stack, 1-state steering, lift-off tuck-in, drift factor
- [ ] HUD (8 chase / 4 cockpit elements), audio (engine + speed feedback), VFX (directional velocity)
- [ ] Fuel/tire systems work: fuel consumption, tire wear with grip floor, pit stop (refuel + tire change)
- [ ] AI rival (16 personalities) races competitively and consistently
- [ ] Grid & start: standing start, grid lock, Perfect Start
- [ ] All S1 and S2 bugs resolved
- [ ] Build stable for [X] consecutive days

## Feature List

### Must Ship (Milestone Fails Without These)

| Feature | Design Doc | Owner | Sprint Target | Status |
|---------|-----------|-------|--------------|--------|
| Input System | design/gdd/input-system.md | input-system epic | TBD | Not started |
| Simulation Kernel | design/gdd/simulation-architecture.md | simulation-kernel epic | TBD | Not started |
| Settings | design/gdd/settings.md | settings epic | TBD | Not started |
| Content Pipeline | design/gdd/content-pipeline.md | content-pipeline epic | TBD | Not started |
| Ghost Recording (MVP boundary) | design/gdd/ghost-recording.md | ghost-recording epic | TBD | Not started |
| Multiplayer Architecture (offline boundary) | design/gdd/multiplayer-architecture.md | multiplayer-architecture epic | TBD | Not started |
| Vehicle Physics | design/gdd/vehicle-physics.md | vehicle-physics epic | TBD | Not started |
| Camera | design/gdd/camera.md | camera epic | TBD | Not started |
| HUD | design/gdd/hud.md | hud epic | TBD | Not started |
| Audio | design/gdd/audio-system.md | audio epic | TBD | Not started |
| Fuel | design/gdd/fuel-system.md | fuel epic | TBD | Not started |
| Tire | design/gdd/tire-system.md | tire epic | TBD | Not started |
| Pit Stop | design/gdd/pit-stop.md | pit-stop epic | TBD | Not started |
| Qualifying | design/gdd/qualifying.md | qualifying epic | TBD | Not started |
| AI Rival | design/gdd/ai-rival.md | ai-rival epic | TBD | Not started |
| Track | design/gdd/track-system.md | track epic | TBD | Not started |
| Car Definition Data | design/gdd/car-definition-data.md | car-definition epic | TBD | Not started |
| Race Session Manager | design/gdd/race-session-manager.md | race-session epic | TBD | Not started |
| Grid & Start | design/gdd/grid-start.md | grid-start epic | TBD | Not started |
| VFX | design/gdd/vfx.md | vfx epic | TBD | Not started |
| UI Menu | design/gdd/ui-menu.md | ui-menu epic | TBD | Not started |

### Should Ship (Planned but Cuttable)

| Feature | Design Doc | Owner | Sprint Target | Cut Impact | Status |
|---------|-----------|-------|--------------|-----------|--------|
| (none defined yet) | | | | | |

### Stretch Goals (Only if Ahead of Schedule)

| Feature | Design Doc | Owner | Value Add |
|---------|-----------|-------|----------|
| (none defined yet) | | | |

## Quality Gates

| Gate | Threshold | Measurement Method |
|------|-----------|-------------------|
| Frame rate | ≥ 60 FPS on min spec | Performance profiling (p95 ≤ 6 ms / max ≤ 8 ms per simulation tick — ADR-0010/ADR-0016 baseline) |
| Critical bugs | 0 open S1 | Bug tracker |
| Major bugs | < [X] open S2 | Bug tracker |
| Test coverage | all Logic/Integration stories have passing tests | Test framework report (per story evidence) |
| Build stability | stable for [X] consecutive days | Build verification |

## Risk Register

| Risk | Probability | Impact | Mitigation | Owner | Status |
|------|------------|--------|-----------|-------|--------|
| TBD — populated by /sprint-plan and /milestone-review | | | | | |

## Dependencies

### Internal Dependencies

| Feature | Depends On | Owner of Dependency | Status |
|---------|-----------|-------------------|--------|
| Input System | Foundation epics first (create-epics order) | input-system | In progress |
| Simulation Kernel | Input System (SimulationInput contract) | simulation-kernel | Not started |
| Core systems (Vehicle Physics, Fuel, Tire, etc.) | Simulation Kernel | core epics | Not started |

### External Dependencies

| Dependency | Provider | Status | Risk if Delayed |
|-----------|---------|--------|----------------|
| (none — MVP is fully offline, no online-services provider selected) | — | — | — |

## Review Schedule

| Date | Review Type | Attendees |
|------|-----------|-----------|
| TBD | Mid-milestone review | Producer, Directors |
| TBD | Pre-milestone review | Full team |
| TBD | Milestone review | Full team |
