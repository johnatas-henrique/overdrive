# Track System

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-21
> **Implements Pillar**: Every Short Race Matters, Speed You Can Feel

## Overview

**Track System** defines the racing world — the spline the car follows, the surfaces it drives on, and the pit lane it enters. It provides the spatial foundation for every race: track length determines lap count, surface types affect tire wear and grip, and pit lane placement creates strategic decision points. The player experiences the track through every corner, every surface change, and every decision to pit or stay out. Without this system, the car has nowhere to go — the track IS the race.

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
- **Spline:** Array of 3D points (longitude, latitude, altitude) defining the center line
- **Width:** Track width at each point (from TUMFTM data or manual)
- **Surface zones:** Overlay zones defining surface types (asphalt, kerb, gravel, grass, runoff, pit_lane)
- **Pit lane:** Separate spline with entry/exit points, speed limit zone
- **Grid positions:** Distance offsets from start/finish line along the spline
- **Metadata:** Name, country, length, number of turns, altitude range, lap count

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
Output: Track JSON file ready for the game
```

**Conversion tools:** Python script using rasterio (DEM sampling), json (GeoJSON parsing). Script is part of the project tooling, not the game runtime.

**3. Surface Types**

| Surface | Grip Modifier | Wear Modifier | Visual |
|---------|--------------|---------------|--------|
| **Asphalt** | 1.0 (base) | 1.0 (base) | Dark grey, smooth |
| **Kerb** | 0.85 | 1.5 | Red/white stripes, raised |
| **Gravel** | 0.4 | 3.0 | Brown/beige, loose |
| **Grass** | 0.3 | 3.5 | Green, very loose |
| **Runoff** | 0.6 | 2.0 | Grey/green, paved but low grip |
| **Pit lane** | 1.0 | 1.0 | Same as asphalt, speed-limited |

Surface zones are defined as distance ranges along the spline (e.g., "kerb from 1200m to 1280m"). Default surface is asphalt.

**4. Lap Counting**

- **Start/finish line:** Distance 0 along the main spline
- **Lap boundary:** When car crosses distance 0 (wraps from track length back to 0)
- **Lap count:** Incremented at each crossing
- **Race distance:** lap_count × track_length (e.g., Spa 44 laps × 7.004 km = 308 km)

**5. Grid Positions**

- 16 starting positions defined as distance offsets from start/finish line
- Standard F1 grid spacing: ~8m between rows, ~2m between columns
- Two-column layout (odd positions left, even positions right)
- Positions computed from spline + offset (data-driven, not hardcoded)

**6. Race Start Sequence**

1. **Loading** — Track and cars loaded via Addressables
2. **Grid view** — Cars spawned at grid positions. Player sees the track, rivals, grid. 2-3 seconds to acclimate.
3. **Countdown** — Five red lights illuminate one by one (1 second apart)
4. **GO** — All lights extinguish. Race begins. All cars can move simultaneously.

**7. Pit Lane**

- **Entry/exit positions:** From track-atlas data (lap fractions, e.g., pit entry at 0.92, exit at 0.05)
- **Default geometry:** Spline parallel to main track at 10m offset (right side), connecting pit_entry to pit_exit points
- **Manual override:** Pit lane spline is stored as a separate editable asset — designers can adjust control points per track
- **Speed limit:** 80 km/h (configurable per track) — enforced automatically when car is in pit lane zone
- **Pit box positions:** 16 boxes, one per car, defined as distances along pit lane spline
- **Pit stop zone:** Where refueling/tire change happens — all 16 boxes are serviced simultaneously, no queuing

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
| **Fuel** | Outbound | Pit lane state | Pit stop refuels fuel |
| **Camera** | Outbound | Track geometry | Camera follows track spline |
| **AI Rival** | Outbound | Track layout, racing line | AI drives on track |
| **HUD** | Outbound | Track name, lap count, position | Displayed in race HUD |
| **Content Pipeline** | Inbound | Track JSON file | Loaded per-race |
| **Simulation Architecture** | Outbound | Spline position data | Car position along spline |

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

Where surface_wear_modifier comes from the surface type table (1.0 for asphalt, 3.0 for gravel, etc.).

## Edge Cases

- **If track JSON is missing or corrupted:** Fail to load race. Log error. Show "Track data missing" message.
- **If car goes off-track at high speed:** Grip drops sharply (surface modifier), tire wear accelerates. Car may spin depending on speed and surface.
- **If car enters pit lane above speed limit:** Speed is clamped to 80 km/h automatically. No penalty beyond lost time.
- **If car enters pit lane from wrong side:** Pit entry is a zone, not a precise line. Car is redirected to pit lane spline.
- **If track length is 0 (corrupted data):** Fail to load. Log error.
- **If pit lane spline intersects main track:** Validation error during track import. Must be fixed before the track can be used.
- **If grid positions overlap:** Validate minimum spacing (2m between adjacent cars). If violated, space them out automatically.

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

## Tuning Knobs

All values below are per-track JSON files or global settings.

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Pit lane speed limit | 80 km/h | 60–120 km/h | Pits too slow | Speeding in pits |
| Pit lane offset from main track | 10 m | 5–20 m | Cars overlap | Pit lane too far |
| Kerb grip modifier | 0.85 | 0.7–0.95 | Kerbs too punishing | Kerbs have no effect |
| Gravel grip modifier | 0.4 | 0.2–0.6 | Instant spin | Gravel too grippy |
| Grass grip modifier | 0.3 | 0.1–0.5 | Instant spin | Grass too grippy |
| Grid row spacing | 8 m | 6–12 m | Cars overlap at start | Grid too spread out |
| Grid column spacing | 2 m | 1.5–3 m | Cars overlap laterally | Grid too wide |

## Visual/Audio Requirements

- **Track surface:** Visual distinction between asphalt (dark), kerb (red/white), gravel (brown), grass (green), runoff (grey). Player should identify surface at a glance.
- **Pit lane:** Visual entry/exit markers (banners, lines). Pit wall on one side, grandstands on the other.
- **Elevation:** Visible elevation changes (Spa's Eau Rouge, Monaco's climb to Casino). Camera should convey the slope.
- **Track boundaries:** Barriers, walls, fences at track edges. Visual warning of upcoming turns.
- **Ambient:** Per-track environment (trees, buildings, grandstands, water for Monaco harbor).

## UI Requirements

- **Race HUD:** Track name, current lap / total laps, position (1st-16th), distance to rival ahead/behind.
- **Minimap:** Optional. Shows car positions on track outline. Useful for situational awareness.
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
- **GIVEN** a car drives off-track onto grass, **WHEN** tire wear is calculated, **THEN** wear rate is approximately 3.5× the on-track rate.
- **GIVEN** a pit lane entry point (from track-atlas), **WHEN** the pit lane spline is generated, **THEN** it connects entry to exit at 10m offset from main track.
- **GIVEN** a track JSON file with missing required fields, **WHEN** the game attempts to load it, **THEN** loading fails with a descriptive error message.

## Open Questions

- **Track variations:** Should the game support multiple layouts per track (e.g., Silverstone GP vs. National circuit)? Or one layout per track?
- **Track weather:** Should weather (rain, wet track) affect surface grip? Or is weather out of scope for MVP?
- **Track boundaries:** How are track limits enforced? Invisible wall? Penalty system? Visual barrier that slows the car?
- **Pit lane customization:** Should each track have a unique pit lane layout, or is the 10m-offset default sufficient for MVP?
- **Track loading time:** How fast should tracks load? Addressables should keep it under 5 seconds for MVP.
