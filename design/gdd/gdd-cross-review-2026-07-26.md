# Cross-GDD Review Report

**Date:** 2026-07-26
**GDDs Reviewed:** 21 system GDDs + `game-concept.md` + `systems-index.md` + `entities.yaml`
**Systems Covered:** Input, Simulation Architecture, Settings, Content Pipeline, Ghost Recording, Multiplayer Architecture, Vehicle Physics, Camera, HUD, Audio, Fuel, Tire, Pit Stop, Qualifying, AI Rival, Track, Car Definition Data, Race Session Manager, Grid & Start, VFX, UI Menu
**Review Mode:** Full (consistency + design theory)
**Verdict:** CONCERNS

---

## Baseline Loaded

- `design/gdd/game-concept.md`
- `design/gdd/systems-index.md`
- `design/registry/entities.yaml`
- 21 system GDDs under `design/gdd/` (review logs excluded)

`grep` found no `## Summary` headings in the GDD corpus, so the full-read path was used for every system.

---

## Consistency Issues

### Blocking

None.

### Warnings

#### W1 — Fuel System dependency table is incomplete
- `fuel-system.md:184` lists Vehicle Physics as inbound only.
- `vehicle-physics.md:280-281` treats Fuel as bidirectional, including low-fuel speed bonus propagation.
- Recommendation: make Fuel's dependency table bidirectional to match the live contract.

#### W2 — Track lap counting omits the anti-cut rule
- `track-system.md:96-98` defines lap boundary via spline wrap only.
- `race-session-manager.md:86-88` adds the 90% minimum-distance gate.
- Recommendation: reference the RSM anti-cut rule from Track or explicitly note that Track only owns the geometry helper.

#### W3 — HUD omits Tire's numeric readout
- `tire-system.md:102-103` requires a visible `X%` readout below the tire bar.
- `hud.md:50` only specifies the tire bar and state-color fill.
- Recommendation: add the tire numeric readout to the HUD element table.

#### W4 — Grid row-spacing safe ranges conflict
- `grid-start.md:159` says `grid_row_spacing` safe range is 6–10 m.
- `track-system.md:224` says row spacing safe range is 6–12 m.
- Recommendation: choose one authoritative range and align both docs.

---

## Game Design Issues

### Blocking

None.

### Warnings

#### W5 — Pit lane bottleneck for 16-car simultaneous service
- `pit-stop.md:125` assumes all 16 cars can be serviced simultaneously.
- `track-system.md:117-126` models pit lane as a single spline offset from the main track.
- Recommendation: specify a two-lane pit structure or AI entry staggering, or document the queueing limitation explicitly.

#### W6 — FinishOrderResolver ignores pit/resource state
- `race-session-manager.md:97-103` projects trailing AI by pace only.
- Recommendation: either add a pit/resource penalty to the projection or explicitly accept the approximation for MVP.

---

## Cross-System Scenario Issues

Scenarios walked: 5

#### Warnings

⚠️ Full throttle → pit decision — Fuel / Tire / Pit Stop / HUD / AI Rival / Camera / Audio
- The pit lane geometry and 16-box simultaneous-service assumption can bottleneck if multiple cars pit on the same lap.

⚠️ Player finishes while AI trails — Race Session Manager / Simulation Architecture
- `FinishOrderResolver` does not account for imminent pit stops or resource exhaustion, so close finishes can be projected loosely.

#### Info

ℹ️ Perfect Start at GO — Input / Grid & Start / Simulation Architecture
- Pause/resume handling inside the 12-tick arming window is implied but not spelled out as a special case.

ℹ️ Fuel empty mid-race — Fuel / Vehicle Physics / HUD
- The low-fuel speed bonus at 0% is effectively dead because throttle response is zero.

ℹ️ Qualifying → Race transition (Race Reconfigure) — Qualifying / Content Pipeline / RSM
- The transition is well-specified and consistent across all three systems.

---

## GDDs Flagged for Revision

| GDD | Reason | Type | Priority |
|-----|--------|------|----------|
| `fuel-system.md` | Vehicle Physics dependency table is one-directional | Consistency | Warning |
| `track-system.md` | Lap-counting anti-cut rule missing; grid-row spacing range conflicts | Consistency | Warning |
| `hud.md` | Tire numeric readout missing | Consistency | Warning |
| `grid-start.md` | Grid-row spacing range conflicts with Track | Consistency | Warning |
| `race-session-manager.md` | Finish projection ignores pit/resource state | Design Theory | Warning |
| `pit-stop.md` | 16-car simultaneous service assumes unspecified pit geometry | Design Theory | Warning |

---

## Verdict: CONCERNS

- Blocking issues: 0
- Warnings: 6
- Info: 3

The corpus is coherent enough for architecture, but these warnings are real documentation gaps and should be resolved or explicitly accepted before epics are written.
