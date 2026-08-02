# Track System

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Every Short Race Matters, Speed You Can Feel

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Four tracks, spline data, surfaces, pit lane, grid positions, and local race geometry. |
| MVP architecture constraints | Track content is data-driven through the conversion pipeline and spline arrays. |
| Alpha | Four tracks. |
| Beta | Eight or more tracks. |
| Release | Sixteen tracks. |

### Review Boundary
Future track count and layouts are non-blocking unless MVP track data cannot scale beyond one track.

## Overview

**Track System** defines the racing world — the spline the car follows, the surfaces it drives on, and the pit lane it enters. It provides the spatial foundation for every race: track length determines lap distance, Race Session Manager supplies the configured lap count, surface types affect tire wear and grip, and pit lane placement creates strategic decision points. The player experiences the track through every corner, every surface change, and every decision to pit or stay out. Without this system, the car has nowhere to go — the track IS the race.

## Player Fantasy

**Framing:** Both — the track is experienced through driving (adversary) and strategic decisions (decision-space).

1. **The Track as Adversary (Pillar 1 — Speed You Can Feel):** The track punishes greed and rewards commitment. You learn its rhythm — where to push, where to lift, where the curbs bite. Anchor: threading a flat-out esses at 280 kph, the car twitching over sausage curbs, the lap time falling.

2. **The Track as Decision-Space (Pillar 2 — Every Short Race Matters):** Every lap presents meaningful choices with visible consequences. The pit-call window, the surface change, the braking point — each decision compounds. Anchor: lap 3, the pit-entry sign approaching, fuel at 40%, tires at 60%. Do you pit now or gamble one more lap?

**Pillar alignment:** Speed You Can Feel — the track is the canvas for speed. Every Short Race Matters — the track creates the decision space for strategy.

**Design test:** Does the player feel that learning the track makes them faster? Does every lap present a meaningful decision?

## Detailed Design

### Core Rules

**1. Track Data Format**

Each track is stored as a JSON file containing:
- **Spline:** Array of 3D local game-space points (meters) defining the center line. Source longitude/latitude/altitude values are converted before runtime JSON is emitted.
- **Width:** Track width at each point (from TUMFTM data or manual)
- **Surface zones:** Overlay zones defining surface types (asphalt, kerb, gravel, grass, runoff, pit_lane)
- **Pit lane:** Separate spline with entry/exit points, speed limit zone, and per-sample `racing_spline_progress` mapping back to the main racing spline
- **Grid positions:** Distance offsets from start/finish line along the spline
- **Metadata:** Name, country, length, number of turns, altitude range, reference lap count, first corner direction (left/right), and track-specific race configuration

**2. Track Generation Pipeline**

New tracks are generated from real-world F1 circuit data:

```
Source: GeoJSON from bacinger/f1-circuits (MIT) or TUMFTM/racetrack-database (LGPL)
    ↓
Step 1: Extract 2D spline (lon, lat) from GeoJSON LineString
    ↓
Step 2: DEM intersection — sample elevation at each point from SRTM 30m raster
    ↓
Step 3: Calibrate with F1 broadcast elevation profiles (key points: Eau Rouge = 467.8m, etc.)
    ↓
Step 4: Add track width from TUMFTM data or manual measurement
    ↓
Step 5: Define surface zones (asphalt base, kerbs at corners, grass/gravel off-track)
    ↓
Step 6: Define pit lane (separate spline, entry/exit points, speed limit)
    ↓
Step 7: Calculate grid positions (distance offsets from start/finish)
    ↓
Step 8: Determine first corner direction for Grid & Start staggering
    ↓
Output: Track JSON file ready for the game
```

**Conversion tools:** Python script using rasterio (DEM sampling), json (GeoJSON parsing). Script is part of the project tooling, not the game runtime.

**3. Surface Types**

| Surface | Grip Modifier | Wear Modifier | Visual |
|---------|--------------|---------------|--------|
| **Asphalt** | 1.0 (base) | 1.0 (base) | Dark grey, smooth |
| **Kerb** | 0.85 | 1.2 | Red/white stripes, raised |
| **Gravel** | 0.4 | 2.5 | Brown/beige, loose |
| **Grass** | 0.3 | 2.5 | Green, very loose |
| **Runoff** | 0.6 | 2.5 | Grey/green, paved but low grip |
| **Pit lane** | 1.0 | 1.0 | Same as asphalt, speed-limited |

Surface zones are defined as distance ranges along the spline (e.g., "kerb from 1200m to 1280m"). Default surface is asphalt.

**Note:** Track's surface grip modifiers are base values used by AI cars. For the player while off-track, Vehicle Physics overrides `surface_grip_multiplier` with DifficultyProfile values (Very Easy 0.60, Easy 0.50, Normal 0.40, Hard 0.30, Very Hard 0.25). On-track grip modifiers (Asphalt, Kerb) are not overridden.

**4. Lap Counting**

- **Start/finish line:** Distance 0 along the main spline
- **Lap boundary:** When car crosses distance 0 (wraps from track length back to 0)
- **Lap count:** Incremented at each crossing
- **Race distance:** configured race_laps × track_length. Real-world reference lap counts are metadata only; MVP session rules supply the race lap count.
- **Anti-cut note:** Track owns the geometry helper (`CrossedLapBoundary`) that detects when a car crosses the start/finine line via spline wrap. Race Session Manager adds the 90% minimum-distance gate (`distanceSinceLastLap > trackLength × 0.90`) to prevent short-cut lap counting. Track does not enforce or calculate this distance — RSM owns the full lap validation rule.

**5. Grid Positions**

- 16 starting positions defined as distance offsets from start/finish line
- Standard F1 grid spacing: ~8m between rows, 3.5m between columns
- Two-column layout (odd positions left, even positions right)
- Positions computed from spline + offset (data-driven, not hardcoded)

**6. Race Start Sequence**

1. **Loading** — Track and cars loaded via Addressables
2. **Grid view** — Cars spawned at grid positions. Player sees the track, rivals, grid. 2-3 seconds to acclimate.
3. **Countdown** — Five red lights illuminate one by one (1 second apart)
4. **GO** — All lights extinguish. Race begins. All cars can move simultaneously.

**7. Pit Lane**

- **Entry/exit positions:** From track-atlas data as `pit_entry_progress` / `pit_exit_progress` lap fractions (e.g., entry 0.92, exit 0.05)
- **Pit-entry zone:** Conversion generates a one-way trigger volume at `pit_entry_progress`, spanning the pit-entry corridor and validating forward travel against the authored racing-spline tangent. Vehicle Physics tests its final post-simulation transform against this zone.
- **Default geometry:** Pit lane spline parallel to main track at 10m offset (right side), connecting pit_entry to pit_exit points. This spline defines the **fast lane** centerline — the continuous driving lane where cars travel at the speed limit.
- **Two-lane layout (F1 model):** The pit lane follows the Formula 1 model — one **fast lane** (driving lane) with 16 individual **pit boxes** offset laterally alongside it. Each pit box is a service bay parallel to the fast lane; the car steers ~30–45° from the fast lane into its assigned box, stops for service, then returns to the fast lane. This allows simultaneous service without queuing: cars in the fast lane pass behind occupied boxes, and each box is an independent bay. For tracks with left-side pit entry, the layout is mirrored — the fast lane is closest to the track wall and boxes are on the pit-building side. The pit lane side (`PitLaneSide.Right` or `PitLaneSide.Left`) is a per-circuit property defined in the track data, not derived from track direction (clockwise/counterclockwise).
- **Pit box definition:** Each box is defined as `{ box_id, entry_progress (fast-lane progress where the car exits the fast lane), lateral_offset (distance from fast lane centerline to box center, ~3 m) }`. Boxes are spaced at ~10 m intervals. Auto-navigation: the car follows the fast lane spline to `entry_progress`, steers to the offset box position, stops for service, and returns to the fast lane after exit.
- **Manual override:** Pit lane spline is stored as a separate editable asset — designers can adjust control points per track
- **Progress mapping:** Every pit-lane spline sample stores its mapped `racing_spline_progress`; Race Session Manager uses this mapping, rather than nearest-world-point projection, for position ranking and pit-lane lap completion.
- **Lap-boundary helper:** Track exposes `CrossedLapBoundary(previousMappedProgress, currentMappedProgress)`, which evaluates authored main/pit mapping across the start/finish discontinuity even when one simulation step moves from e.g. 0.94 to 0.01.
- **Speed limit:** 80 km/h fixed in MVP — enforced automatically when car is in pit lane zone
- **Simultaneous service:** All 16 boxes are serviced without queuing — each is an independent offset bay. Cars in the fast lane pass behind occupied boxes.
- **Track map:** Main spline, pit-lane spline, pit boxes, and pit-entry marker are rendered on the Track Map.

**8. Track Scaling**

Tracks are imported at real-world scale (1 unit = 1 meter). The game uses meters for all physics calculations. No artificial scaling — a 7km track is 7km in the game.

### States and Transitions

The Track System itself has no runtime states — it's static data loaded at race start. However, the car's relationship to the track has states:

| State | Condition | Behavior |
|-------|-----------|----------|
| **On-track** | Car is on asphalt/kerb surface | Full grip, normal wear |
| **Off-track** | Car is on grass/gravel/runoff | Reduced grip, accelerated tire wear |
| **In pit lane** | Car is in pit lane zone | Speed limit enforced (80 km/h), automated sequence |
| **In pit box** | Car is at its pit box position | Stop, refuel + tire change |

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Vehicle Physics** | Outbound | Surface type, grip modifier | Applied to lateral friction |
| **Tire** | Outbound | Surface wear modifier | Applied to tire wear rate |
| **VFX** | Outbound | Surface type, dust/spray cues | Drives track-side particles |
| **Fuel** | Outbound | Pit lane state | Pit stop refuels fuel |
| **Camera** | Outbound | Track geometry | Camera follows track spline |
| **AI Rival** | Outbound | Track layout, racing line | AI drives on track |
| **HUD** | Outbound | Track name, lap count, position | Displayed in race HUD |
| **Content Pipeline** | Inbound | Track JSON file | Loaded per-race |
| **Simulation Architecture** | Outbound | Spline position data | Car position along spline |
| **Race Session Manager** | Outbound | Lap boundary, mapped racing progress, position ranking | RSM consumes Track's authored progress mapping and publishes session events |
| **Pit Stop** | Outbound | Pit entry/exit geometry, pit boxes, speed-limit zone | Pit Stop consumes physical track zones and publishes service phase |
| **Grid & Start** | Outbound | Validated grid positions and transforms | Applies the RSM-owned GridAssignment to authored starting slots |
| **Qualifying** | Outbound | Reference flying-lap time | Qualifying uses Track's reference time for computed fuel load |

## Formulas

**Current live values:** see `Assets/Data/Tracks/` (track JSON files).

### Car Position on Track

Car position is tracked as distance along the main spline (0 to track_length). This is the primary coordinate system for the track.

`position_along_spline = distance_from_start / track_length`

**Output Range:** 0.0 (start/finish) to 1.0 (end of lap). Wraps at 1.0 → 0.0.

### Surface Grip Modifier

`surface_grip = base_grip × surface_modifier`

Where surface_modifier comes from the surface type table (1.0 for asphalt, 0.4 for gravel, etc.).

### Surface Wear Modifier

`surface_wear = base_wear × surface_wear_modifier`

Where surface_wear_modifier comes from the surface type table (1.0 for asphalt, 2.5 for gravel, etc.).

## Edge Cases

- **If track JSON is missing or corrupted:** Fail to load race. Log error. Show "Track data missing" message.
- **If car goes off-track at high speed:** Grip drops sharply (surface modifier), tire wear accelerates. Car may spin depending on speed and surface.
- **If car enters pit lane above speed limit:** Speed is clamped to 80 km/h automatically. No penalty beyond lost time.
- **If car enters the pit-entry zone from the wrong side:** The one-way validation rejects the entry; no `PitEntry` event is emitted and the car remains on the racing route.
- **If track length is 0 (corrupted data):** Fail to load. Log error.
- **If pit lane spline intersects main track:** Validation error during track import. Must be fixed before the track can be used.
- **If grid positions overlap:** Import validation repairs the authored source before runtime JSON is emitted. Runtime loading rejects any remaining invalid grid assignment with a descriptive error; positions are not silently changed during a race.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Vehicle Physics** | Outbound | Surface grip/wear modifiers | Hard — affects car behavior |
| **Tire** | Outbound | Surface wear modifier | Hard — affects tire wear |
| **Fuel** | Outbound | Pit lane state | Hard — triggers refueling |
| **Camera** | Outbound | Track geometry | Hard — camera follows track |
| **AI Rival** | Outbound | Track layout | Hard — AI needs track to drive |
| **HUD** | Outbound | Track name, lap count | Hard — display |
| **Content Pipeline** | Inbound | Track JSON file | Hard — loading |
| **Simulation Architecture** | Outbound | Spline position | Hard — car position |
| **Race Session Manager** | Bidirectional | Lap boundary, mapped racing progress, pit events | Hard — owns race/session interpretation of Track data |
| **Pit Stop** | Outbound | Pit zones, boxes, speed-limit zone | Hard — Track provides pit geometry to Pit Stop |
| **Grid & Start** | Outbound | Validated grid positions | Hard — applies GridAssignment to Track slots |
| **Qualifying** | Outbound | Reference flying-lap time | Hard — computes qualifying fuel load |
| **Audio** | Outbound | surface_type | Hard — drives surface noise |

## Tuning Knobs

All values below are per-track JSON files or global settings.

**Authority note:** Track System owns the pit lane speed limit and pit-lane geometry; Pit Stop consumes the speed limit during service.

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Pit lane speed limit | 80 km/h | 60–120 km/h | Pits too slow | Speeding in pits |
| Pit lane offset from main track | 10 m | 5–20 m | Cars overlap | Pit lane too far |
| Kerb grip modifier | 0.85 | 0.7–0.95 | Kerbs too punishing | Kerbs have no effect |
| Gravel grip modifier | 0.4 | 0.2–0.6 | Instant spin | Gravel too grippy |
| Grass grip modifier | 0.3 | 0.1–0.5 | Instant spin | Grass too grippy |
| Grid row spacing | 8 m | 6–10 m | Cars overlap at start | Grid too spread out |
| Grid column spacing | 3.5 m | 2.5–5 m | Cars overlap laterally | Grid too wide |

## Visual/Audio Requirements

- **Track surface:** Visual distinction between asphalt (dark), kerb (red/white), gravel (brown), grass (green), runoff (grey). Player should identify surface at a glance.
- **Pit lane:** Visual entry/exit markers (banners, lines). Pit wall on one side, grandstands on the other.
- **Elevation:** Visible elevation changes (Spa's Eau Rouge, Monaco's climb to Casino). Camera should convey the slope.
- **Track boundaries:** Barriers, walls, fences at track edges. Visual warning of upcoming turns.
- **Ambient:** Per-track environment (trees, buildings, grandstands, water for Monaco harbor).

## UI Requirements

- **Race HUD:** Track name, current lap / total laps, position (1st-16th), distance to rival ahead/behind.
- **Track Map:** Required in MVP. Shows the main spline, pit-lane spline, pit-entry marker, and car positions. Alternative minimap presentation is a later UI variation.
- **Pre-race screen:** Track name, length, number of turns, elevation change, lap count.

> **📌 UX Flag — Track System**: This system has UI requirements. In Phase 4 (Pre-Production), run `/ux-design` to create a UX spec for track selection and race HUD before writing epics.

## Acceptance Criteria

- **GIVEN** a track JSON file, **WHEN** loaded by the game, **THEN** the spline is rendered as a drivable surface with correct width and elevation.
- **GIVEN** a car on asphalt surface, **WHEN** grip is calculated, **THEN** surface modifier is 1.0 (base grip).
- **GIVEN** a car on gravel surface, **WHEN** grip is calculated, **THEN** surface modifier is 0.4 ± 0.05.
- **GIVEN** a car enters pit lane zone, **WHEN** speed is checked, **THEN** speed is clamped to 80 km/h or less.
- **GIVEN** a car crosses start/finish line, **WHEN** lap distance wraps, **THEN** lap count increments by 1.
- **GIVEN** 16 grid positions, **WHEN** cars are spawned, **THEN** no two cars overlap (minimum 2m spacing).
- **GIVEN** a track with elevation changes (Spa), **WHEN** the car drives uphill, **THEN** the camera tilts to convey the slope.
- **GIVEN** a car drives off-track onto grass, **WHEN** tire wear is calculated, **THEN** the Track-provided surface wear modifier is 2.5× the on-track rate.
- **GIVEN** a pit lane entry point (from track-atlas), **WHEN** the pit lane spline is generated, **THEN** it connects entry to exit at 10m offset from main track.
- **GIVEN** a track JSON file with missing required fields, **WHEN** the game attempts to load it, **THEN** loading fails with a descriptive error message.
- **GIVEN** runtime Track JSON is loaded, **WHEN** spline points are inspected, **THEN** coordinates are local game-space meters and contain no unconverted longitude/latitude values.
- **GIVEN** an MVP build, **WHEN** track content is enumerated, **THEN** the four MVP tracks are loadable through the same Track JSON contract.
- **GIVEN** a car crosses a pit-entry zone in the wrong travel direction, **WHEN** entry validation runs, **THEN** no `PitEntry` event is emitted and the car remains on the racing route.
- **GIVEN** runtime grid positions violate the minimum spacing, **WHEN** content loads, **THEN** loading fails with a descriptive validation error rather than silently changing the race assignment.
- **GIVEN** the Race HUD is active, **WHEN** track data is displayed, **THEN** the Track Map includes the racing spline, pit-lane spline, pit-entry marker, and car positions.

## Open Questions

- **Track variations:** MVP uses one authored layout per track; alternate layouts are deferred.
- **Track weather:** Weather and wet-surface modifiers are out of MVP scope.
- **Track boundaries:** MVP uses authored physical barriers and surface zones; no penalty system is introduced.
- **Pit lane customization:** MVP uses the 10m-offset default as a generator baseline with per-track manual overrides.
- **Track loading time:** Content Pipeline owns the under-5-second loading target and reports failures to Simulation.
