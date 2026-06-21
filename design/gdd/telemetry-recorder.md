# Telemetry Recorder

> **Status**: Design Complete
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Dev Tool

## Overview

Telemetry Recorder captures per-car simulation data during a race and exports it as JSON for post-race analysis. It also logs a summary to the console every 5 seconds for quick overview during testing. The primary use case is validating AI driver behavior — answering "are the AI cars doing what we expect?"

The recorder is a development-only system (`__DEV__`). Zero cost in production builds.

---

## Developer Fantasy

The developer finishes a test race. They open the browser console and see a JSON blob — every AI car's speed, throttle, position, and state logged at 20 Hz for the entire race. They copy-paste it into a script that plots speed traces. Macklen braked 10m later than Willard into turn 4 — that's the overtake explained. During the race, the console printed a line every 5 seconds: "Lap 3/5 — Macklen P1 (245 km/h), Willard P2 (241 km/h), Lorris P7 (218 km/h)." Quick sanity check without interrupting the flow.

---

## Detailed Design

### Core Rules

**1. Compile-time only.** All code guarded by `if (__DEV__)`. Zero bytes in production.

**2. 20 Hz sampling.** Records one snapshot per car every 3 physics ticks (60 Hz / 3 = 20 Hz). Sufficient for AI behavior analysis.

**3. Accumulate in memory, export at end.** Samples are appended to a plain array per car during the race. No ring buffer, no eviction — the array grows for the race duration. At race end (PostRace state), the full data is available for export.

**4. Console log every 5 seconds.** Prints a one-line summary: current lap, positions, speeds for all cars. Developer gets a quick overview without opening any tool.

**5. JSON export.** At any point (during or after race), the developer can trigger export via console command or Dev Tools button. Output is a single JSON file with all cars' data.

**6. Player car included.** Records the player alongside AI cars for direct comparison.

### Sample Schema

```typescript
interface TelemetrySample {
  tick: number; // Physics tick when recorded
  t: number; // Elapsed race time (seconds)
  speed: number; // km/h
  rpm: number; // RPM
  throttle: number; // 0.0–1.0
  brake: number; // 0.0–1.0
  steer: number; // -1.0–1.0
  gear: number; // -1, 1–6
  lateralG: number; // m/s²
  fuel: number; // 0.0–1.0
  tireCondition: number; // 0.0–1.0
  splinePos: number; // 0.0–1.0 position on track spline
  aiState: number; // 0=Normal, 1=Following, 2=Passing (AI only)
}
```

### Console Log Format

Every 5 seconds during Racing state:

```
[TELE] Lap 3/5 | P1 Macklen 245 km/h | P2 Willard 241 km/h | P3 Ferrell 238 km/h | ... | P7 Lorris 218 km/h
```

Single line, no flooding. Developer sees positions and speeds at a glance.

### JSON Export Structure

```json
{
  "race": {
    "track": "interlagos",
    "laps": 5,
    "startTime": 1718800000000,
    "duration": 420.5
  },
  "cars": {
    "macklen": {
      "team": "Macklen",
      "samples": [
        { "tick": 0, "t": 0.0, "speed": 0, "throttle": 0.0, "...": "..." },
        { "tick": 3, "t": 0.05, "speed": 12, "throttle": 0.8, "...": "..." }
      ]
    },
    "willard": { "...": "..." }
  }
}
```

### Export Trigger

Two methods:

- **Dev Tools button**: "Export Telemetry" button in the overlay (F3). Downloads a `.json` file.
- **Console command**: `window.__telemetry.export()` — developer can call from browser console.

### Interactions with Other Systems

| System               | Read                                                                         | Write |
| -------------------- | ---------------------------------------------------------------------------- | ----- |
| **Physics/Handling** | speed, rpm, throttle, brake, steer, gear, lateralG                           | None  |
| **Fuel**             | fuelLevel                                                                    | None  |
| **Tire Wear**        | tireCondition                                                                | None  |
| **AI Driver**        | aiState (Normal/Following/Passing)                                           | None  |
| **Race Management**  | splinePosition, elapsedTime, currentLap                                      | None  |
| **Event Bus**        | Subscribes to `race.started` (reset), `gsm.state.entered(PostRace)` (export) | None  |

---

## Edge Cases

| #   | Edge Case                      | Handling                                               |
| --- | ------------------------------ | ------------------------------------------------------ |
| 1   | Race restart                   | Arrays cleared on `race.started`                       |
| 2   | Recording starts mid-race      | First sample stored as full value                      |
| 3   | Car despawned during recording | Data retained for post-mortem                          |
| 4   | Very long race (2+ hours)      | Array grows ~1.4 MB/hour/car — acceptable for dev tool |
| 5   | Export during race             | Exports current data (point-in-time snapshot)          |

---

## Acceptance Criteria

| #   | Criterion                                              | Test type   |
| --- | ------------------------------------------------------ | ----------- |
| 1   | Recording captures 20 samples/second per car           | Unit        |
| 2   | Console log prints every 5 seconds during Racing state | Unit        |
| 3   | `window.__telemetry.export()` returns valid JSON       | Unit        |
| 4   | JSON contains all 8 cars with correct team names       | Unit        |
| 5   | Arrays cleared on race restart                         | Integration |
| 6   | Recording has zero cost when `__DEV__` is false        | Unit        |
| 7   | Player car data is recorded alongside AI cars          | Integration |

---

## Out of Scope (MVP)

- Delta compression (not needed — array size is acceptable)
- Ring buffer / eviction (not needed — data fits in memory)
- Visualizer panel (developer analyzes JSON externally)
- CSV export (JSON is sufficient for scripts)
- Real-time streaming
- Persistence across sessions

---

## Tuning Knobs

| Key                        | Default | Range  | Description                           |
| -------------------------- | ------- | ------ | ------------------------------------- |
| `telemetry.sampleInterval` | 3       | 1–10   | Ticks between samples (3 = 20 Hz)     |
| `telemetry.logInterval`    | 300     | 60–600 | Ticks between console logs (300 = 5s) |

**Total**: 2 tuning knobs.
