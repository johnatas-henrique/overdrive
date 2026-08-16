# ADR-0014: HUD Data Contract and Layout

## Status

Accepted

## Date

2026-07-31

## Reviewed

2026-08-01 (architecture-review-2026-08-01.md — PASS)

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Presentation / UI |
| **Knowledge Risk** | LOW — uGUI (Unity UI Canvas) is production-proven, no post-cutoff changes |
| **References Consulted** | `docs/engine-reference/unity/modules/ui.md`, `design/gdd/hud.md`, `design/gdd/camera.md` |
| **Post-Cutoff APIs Used** | None — uGUI is stable |
| **Verification Required** | 0.5s readability budget validated via user testing; performance budget ≤0.5ms measured in integrated prototype |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (Simulation — PublishedSimulationSnapshot), ADR-0010 (Camera-VFX — performance budget separation), ADR-0002 (Vehicle Physics — CarState), ADR-0006 (Fuel/Tire — FuelState, TireState) |
| **Enables** | HUD implementation (all 8 chase elements, 4 cockpit elements) |
| **Blocks** | HUD story creation |
| **Ordering Note** | Must be accepted before HUD implementation |

## Context

### Problem Statement

HUD has 3 gaps in the traceability matrix (TR-hud-001, TR-hud-003, TR-hud-005). No ADR documents:
1. Data sources per element (which system provides what data)
2. The 0.5s readability budget and layout contract
3. Rival gap display mechanism

### Constraints

- HUD runs in LateUpdate (per ADR-0001 Interpolation Phases)
- Performance budget: ≤0.5ms per frame (separate from Camera-VFX 2.25ms planned / 2.4ms ceiling budget per ADR-0010)
- uGUI Canvas (Screen Space - Overlay) for all HUD elements
- 0.5s readability target at 200+ km/h
- Maximum 2 pieces of information per glance
- Team color theming via Car Definition Data

### Requirements

- Must map each HUD element to its owning system
- Must define data contracts (what data, what format, what frequency)
- Must enforce 0.5s readability budget
- Must support 2 camera modes (Chase: 8 elements, Cockpit: 4 elements)
- Must support team color theming

## Decision

HUD uses **uGUI Canvas** (Screen Space - Overlay) with data-driven elements. Every HUD element reads exclusively from `PublishedSimulationSnapshot` (or a lifecycle snapshot for non-ticking states) in LateUpdate — no direct system interface reads. Domain values required by HUD (FuelState, TireState, GameState, PitThisLap, PerformanceReduced) are published in the snapshot at Step 12, so a single immutable boundary guarantees all elements render values from the same tick.

### Data Source Mapping

| Element | Owner System | Data | Update Frequency | Format |
|---------|-------------|------|-----------------|--------|
| Speed + Gear | Vehicle Physics | `CarState.speedKmh`, `CarState.gear` | Per tick (60 Hz) | `"{speed} km/h"` + gear number |
| Position | RSM | `GameState.position`, `GameState.totalGrid` | Per tick (60 Hz) | `"{position}/{totalGrid}"` |
| Lap | RSM | `GameState.lapCount`, `GameState.totalLaps` | Per tick (60 Hz) | `"L{current}/{total}"` |
| Fuel Bar | Fuel System | `FuelState.fuelFraction`, `FuelState.state` | Per tick (60 Hz) | Horizontal bar (0-100%) + `"X.X L"` readout |
| Tire Bar | Tire System | `TireState.wearFraction` | Per tick (60 Hz) | Horizontal bar (0-100%) + percentage |
| Lap Time (current) | Simulation | `sim_time` (current lap elapsed) | Per tick (60 Hz) | `"MM:SS.mmm"` |
| Lap Time (recorded) | RSM | `GameState.lapTimes[]` (previous + best) | On lap completion | `"MM:SS.mmm"` prev + best |
| Rival Gap | RSM | `GameState.rivalGapSeconds` | Per tick (60 Hz) | `"+X.Xs"` or `"LEADER"` |
| Track Map | RSM + Track | `GameState.splinePositions[16]`, `TrackData.racingSpline`, `TrackData.pitSpline` | Per tick (60 Hz) | Mini-map with16 car dots |
| PIT THIS LAP | Pit Stop | `PitThisLap` (boolean) | Per tick (60 Hz) | Transient advisory text |
| Performance Warning | Simulation | `PerformanceReduced` (event from ADR-0001) | On event edge | Discrete banner, auto-dismiss after 3s |

**Lap Time ownership split:** Current lap time is `sim_time` from Simulation (authoritative, ticks during Racing). Recorded laps (previous + best) are `GameState.lapTimes[]` from RSM (updated on lap completion). HUD reads both sources — current from Simulation, recorded from RSM.

**Track Map dot identity:** Each dot's position comes from `GameState.splinePositions[16]`. The player dot is highlighted via `PlayerCarId` (from Simulation). Dot colors use team colors from `CarDefinition.TeamColor` per car.

**Ghost Recording 9th element (Alpha+):** Ghost Recording adds a 9th Chase element (ghost rival comparison indicator) outside MVP scope. The 8-element MVP layout is the canonical contract; the ghost element is additive and does not alter the data source mapping.

**Cockpit Overlay:** Same data feeds both Chase and Cockpit layouts. The overlay toggle (`show_chase_hud_in_cockpit` from Settings) controls visibility, not data source. All 8 chase elements read the same data whether displayed in Chase or Cockpit overlay mode.

**Track Map interpolation:** Uses tick-state positions (not interpolated VisualTransform) for car dots — spline positions update at60 Hz, which is sufficient for a mini-map. Interpolated positions would add complexity with no visual benefit at mini-map scale.

### Readability Contract

```
Budget: 0.5 seconds per glance at 200+ km/h
Rule: Maximum 2 pieces of information per glance
Font: minimum 16px secondary, 24px primary at 1080p
Contrast: white text on Asphalt Black (85% alpha) with 2px outline
Colors: state colors first (green/yellow/red), team colors for accents only
```

### Chase HUD Layout (8 elements)

```
┌─────────────────────────────────────────────────────┐
│ [Lap Time]                    [Position]            │
│ [Rival Gap]                   [Lap]                 │
│                                                     │
│                   [Speed + Gear]                    │
│                                                     │
│                                         [Track Map] │
│                          [Fuel Bar]                 │
│                          [Tire Bar]                 │
└─────────────────────────────────────────────────────┘
```

### Cockpit HUD Layout (4 elements)

```
┌─────────────────────────────────────────────────────┐
│ [Position/Lap]                                      │
│                                                     │
│                          [Fuel Warning]  [Tire Warn]│
│                                                     │
│                                          [Rival Gap]│
└─────────────────────────────────────────────────────┘
```

- Fuel/Tire Warnings are color flashes only (no bars)
- **Fuel Warning threshold:** `FuelState.state` enum drives color — Conserving (yellow flash), Critical (red flash), Empty (red persistent)
- **Tire Warning threshold:** `TireState.wearFraction` — yellow flash when `wearFraction > 0.50` (50% worn), red flash when `wearFraction > 0.75` (75% worn), red persistent when `wearFraction > 0.90` (90% worn)
- Cockpit Overlay (Settings toggle): adds all 8 chase elements on top of cockpit view

### Team Theming

- Element borders: team color
- Position number: team color
- Speed text accent: team color
- Fuel/Tire fills: state colors (green/yellow/red), NOT team colors
- Fallback: auto-adjust to white/black outline if team color has low contrast

### Performance Budget

```
Component           | Budget    | Notes
Canvas update       | 0.15 ms   | uGUI layout rebuild (dirty flags)
Text update         | 0.10 ms   | 8 elements × ~0.013 ms each
Bar update          | 0.05 ms   | 2 bars (fuel + tire)
Track Map           | 0.15 ms   | 16 car dots + spline rendering
Theming             | 0.02 ms   | Color application per element
Unity overhead      | 0.03 ms   | Canvas batch, transform sync
Total               | 0.50 ms   | Within 0.5ms budget
```

## Alternatives Considered

### Alternative 1: UI Toolkit Runtime
- **Description:** UXML/USS-based HUD with runtime data binding
- **Pros:** Modern workflow, better separation of structure/style
- **Cons:** Less proven for performance-critical HUD, runtime binding overhead
- **Rejection Reason:** uGUI is production-proven for racing game HUDs. UI Toolkit can be introduced later without breaking data contracts.

### Alternative 2: Custom Mesh Renderer
- **Description:** Direct mesh rendering for maximum performance
- **Pros:** Lowest CPU overhead
- **Cons:** Most complex, no layout tools, hard to iterate
- **Rejection Reason:** 0.5ms budget is achievable with uGUI. Custom renderer only needed if profiling shows uGUI is too slow.

## Consequences

### Positive
- **Clear data ownership:** Each datum has one authoritative owner; composite elements (e.g. Track Map) combine separately owned snapshot fields
- **Performance budget separation:** HUD 0.5ms is separate from Camera-VFX 2.25ms planned / 2.4ms ceiling (per ADR-0010)
- **Team theming:** Data-driven, no code changes for new teams
- **Readability contract:** 0.5s target enforces fast, scannable design

### Negative
- **uGUI overhead:** Canvas rebuild on layout changes (mitigated by dirty flags)
- **Track Map complexity:** 16 car dots + spline rendering may need optimization

### Risks
- **Track Map performance:** 16 dynamic dots + spline may exceed budget on low-end hardware
- **Mitigation:** Track Map is first candidate for quality preset scaling (Low: simplified, High: full)

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| hud.md | 8 chase elements with data sources | §Decision: Data Source Mapping |
| hud.md | 0.5s readability budget | §Decision: Readability Contract |
| hud.md | Rival gap display | §Decision: Data Source Mapping (Rival Gap row) |
| hud.md | Team color theming | §Decision: Team Theming |
| hud.md | Cockpit HUD (4 elements) | §Decision: Cockpit HUD Layout |
| hud.md | Cockpit Overlay (Settings toggle) | §Decision: Cockpit HUD Layout, Data Source Mapping note |
| hud.md | HUD states (Race, Qualifying, Pit, etc.) | §Decision: Data Source Mapping (update frequency) |
| hud.md | Performance warning | §Decision: Data Source Mapping (Performance Warning row) |
| hud.md | PIT THIS LAP advisory | §Decision: Data Source Mapping (PIT THIS LAP row) |
| camera.md | Camera mode affects HUD layout | §Decision: Chase/Cockpit layouts |
| simulation-architecture.md | PublishedSimulationSnapshot carries HUD data | §Decision: Data Source Mapping (Simulation row) |
| simulation-architecture.md | PerformanceReduced signal | §Decision: Data Source Mapping (Performance Warning row) |

## Performance Implications

- **CPU:** 0.5ms per frame (within budget)
- **Memory:** Negligible — uGUI Canvas overhead only
- **Load Time:** Canvas pre-built in scene, no runtime instantiation

## Validation Criteria

- [ ] Each HUD element reads from exactly one owning system
- [ ] 0.5s readability budget validated via user testing
- [ ] Team color theming works for all 16 teams
- [ ] Cockpit Overlay toggle works correctly
- [ ] Track Map renders16 car dots at 60 FPS
- [ ] Performance budget ≤0.5ms measured in integrated prototype
- [ ] No HUD elements read from wrong systems

## Related Decisions

- ADR-0001: Simulation Authority (PublishedSimulationSnapshot)
- ADR-0010: Camera-VFX (performance budget separation)
- ADR-0002: Vehicle Physics (CarState)
- ADR-0006: Fuel/Tire (FuelState, TireState)
