# ADR-0022: Telemetry Recorder

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                                                                                                          |
| **Domain**                | Developer Infrastructure — Telemetry                                                                                       |
| **Knowledge Risk**        | LOW — pure TypeScript. Zero Babylon.js imports. `import.meta.env.DEV` guard eliminates all code from production builds. |
| **References Consulted**  | telemetry-recorder.md GDD                                                                                                  |
| **Post-Cutoff APIs Used** | None                                                                                                                       |

## ADR Dependencies

| Field          | Value                                                                                                                                                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Depends On** | ADR-0001 (Event Bus — `race.started`, `gsm.state.entered(PostRace)`), ADR-0008 (Physics — direct reads), ADR-0011 (Fuel — fuelLevel read), ADR-0012 (Tire Wear — tireCondition read), ADR-0013 (AI Driver — aiState read), ADR-0015 (Race Management — splinePosition, elapsedTime, currentLap read) |
| **Enables**    | Post-race AI behavior analysis via JSON export, in-race console summary                                                                                                                                                                                                                              |
| **Blocks**     | None                                                                                                                                                                                                                                                                                                 |

## Context

### Problem Statement

Developers need insight into AI driver behavior during testing. The Telemetry Recorder captures per-car simulation data (speed, throttle, position, AI state) at 20 Hz during a race and exports it as JSON for post-race analysis. It also prints a console summary every 5 seconds for quick overview during live testing.

### Constraints

- Dev-only — zero cost in production (`import.meta.env.DEV` guard)
- Read-only — never writes to gameplay state
- Accumulate in memory — array grows for race duration (~1.4 MB/hour/car)
- 20 Hz sampling — sufficient for AI behavior analysis
- Two export paths: Dev Tools button + console command

## Decision

### Architecture

```
TelemetryRecorder (dev-only, import.meta.env.DEV guard)
  ├── Subscribes to race.started (clear arrays)
  ├── Subscribes to gsm.state.entered(PostRace) (auto-export ready)
  │
  ├── Per-tick (every 3 ticks = 20hz):
  │     Reads 8 cars × 12 fields from CarEntity
  │     Appends TelemetrySample to per-car array
  │
  ├── Every 300 ticks (5s):
  │     Prints console.log with positions + speeds
  │
  └── Export:
        Dev Tools F3 button → download .json
        window.__telemetry.export() → returns JSON string
```

### Sample Schema

```typescript
interface TelemetrySample {
  tick: number;
  t: number; // elapsed race time (seconds)
  speed: number; // km/h
  rpm: number;
  throttle: number; // 0.0–1.0
  brake: number; // 0.0–1.0
  steer: number; // -1.0–1.0
  gear: number; // -1, 1–6
  lateralG: number; // m/s²
  fuel: number; // 0.0–1.0
  tireCondition: number; // 0.0–1.0
  splinePos: number; // 0.0–1.0
  aiState: number; // 0=Normal, 1=Following, 2=Passing (AI only)
}
```

### Sampling Strategy

```typescript
class TelemetryRecorder {
  private samples: Map<string, TelemetrySample[]> = new Map();
  private tickCounter = 0;
  private logCounter = 0;

  // Called from pipeline slot (reads only — no writes to game state)
  tick(dt: number, cars: CarEntity[], tickCount: number): void {
    if (!import.meta.env.DEV) return;

    this.tickCounter++;

    // Console log every 300 ticks (5s)
    if (this.tickCounter % logInterval === 0) {
      this.printConsoleSummary(cars);
    }

    // Sample every 3 ticks (20hz)
    if (this.tickCounter % sampleInterval !== 0) return;

    for (const car of cars) {
      if (!this.samples.has(car.id)) {
        this.samples.set(car.id, []);
      }
      this.samples.get(car.id)!.push({
        tick: tickCount,
        t: car.runtime.elapsedTime,
        speed: car.physics.speedKmh,
        rpm: car.physics.rpm,
        throttle: car.runtime.throttle,
        brake: car.runtime.brake,
        steer: car.runtime.steer,
        gear: car.physics.gear,
        lateralG: car.physics.lateralG,
        fuel: car.runtime.fuelLevel,
        tireCondition: car.runtime.tireCondition,
        splinePos: car.runtime.splinePos,
        aiState: car.aiDriver?.state ?? -1, // -1 for player car
      });
    }
  }
}
```

### Console Log

Every 5 seconds during Racing state:

```
[TELE] Lap 3/5 | P1 Macklen 245 km/h | P2 Willard 241 km/h | ... | P7 Lorris 218 km/h
```

Sorted by position. Single line — no flooding.

### JSON Export

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
        { "tick": 0, "t": 0.0, "speed": 0, "throttle": 0.0 },
        { "tick": 3, "t": 0.05, "speed": 12, "throttle": 0.8 }
      ]
    }
  }
}
```

## GDD Requirements Addressed

| GDD Requirement                       | How This ADR Addresses It                                                |
| ------------------------------------- | ------------------------------------------------------------------------ |
| Dev-only — zero production cost       | All code guarded by `import.meta.env.DEV`. Compiles to zero bytes. |
| 20 Hz sampling                        | Every 3 ticks (60 Hz / 3). 13 fields per sample.                         |
| Console log every 5 seconds           | `logInterval` default 300 ticks. Positions + speeds of all 8 cars.       |
| JSON export via Dev Tools and console | F3 button + `window.__telemetry.export()`. Single JSON file.             |
| Array accumulation per car            | Plain arrays, no ring buffer. Cleared on `race.started`.                 |
| Reads from 5 systems                  | Direct CarEntity reads: Physics, Fuel, Tire, AI Driver, Race Management. |

## Consequences

### Positive

- Zero production cost — entire file compiles away under `import.meta.env.DEV`
- Direct reads are simple and fast (20hz, not 60hz)
- JSON export is standard tooling — parsable by any script
- Console log gives instant feedback during testing without breaking flow
- ~1.4 MB/hour/car at 20hz × 16 fields — acceptable for dev tooling

### Negative

- Array grows unbounded during race (~11 MB for a 1-hour race with 8 cars)
- No ring buffer — if a developer forgets to export, data is lost on race restart
- Not useful for real-time debugging (20hz only, not 60hz)

### Risks

- **Risk**: Console log floods terminal at 60hz if sampleInterval is misconfigured
  **Mitigation**: Console log is separate from sampling tick, gated by its own interval (300 ticks default). Even at minimum 60 ticks, it's still only 1 line/second.
- **Risk**: JSON export of very long races produces large files
  **Mitigation**: 11 MB for 1-hour race is acceptable. If needed, compress before download.

## Validation Criteria

- [ ] `import.meta.env.DEV` guard eliminates all code from production build (check dist bundle)
- [ ] Recording captures 20 samples/second per car (every 3 ticks)
- [ ] Console log appears every 5 seconds with correct positions + speeds
- [ ] `window.__telemetry.export()` returns valid JSON
- [ ] JSON contains all 8 cars with correct team names
- [ ] Arrays cleared on `race.started`
- [ ] Player car data is recorder alongside AI
- [ ] PostRace event triggers export readiness (no data loss)

## Related Decisions

- ADR-0001 (Event Bus — race.started and gsm.state.entered subscriptions)
- ADR-0008 (Physics — per-tick data access pattern)
- ADR-0011, ADR-0012, ADR-0013, ADR-0015 (system reads)
