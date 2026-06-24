# ADR-0004: Module Boundary & Dependency Rules

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                                                                             |
| **Domain**                | Core (TypeScript)                                                                             |
| **Knowledge Risk**        | LOW                                                                                           |
| **References Consulted**  | VERSION.md, architecture.md Module Ownership, ADR-0001, ADR-0002, ADR-0003                    |
| **Post-Cutoff APIs Used** | None                                                                                          |
| **Verification Required** | Foundation purity: `tsc --noEmit` fails if any Foundation file imports from `@babylonjs/core` |

## ADR Dependencies

| Field             | Value                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| **Depends On**    | ADR-0001 (Event Bus), ADR-0002 (Pipeline — slot order), ADR-0003 (Two-Scene — Asset Manager in Core) |
| **Enables**       | ADR-0005 (Entity/Car Lifecycle), all Core system ADRs (#6+)                                          |
| **Blocks**        | All systems that cross module boundaries                                                             |
| **Ordering Note** | Must be written before any Core system ADR that defines API boundaries                               |

## Context

### Problem Statement

24 TypeScript systems across 5 layers need explicit rules for who can import whom, who can write whose state, and which patterns are forbidden. Without these rules, the dependency graph becomes circular (e.g., Audio imports Collision → Collision imports Audio → impossible to test either), systems write each other's state creating race conditions, and the init order becomes impossible to validate.

### Constraints

- Foundation layer = pure TypeScript, zero Babylon.js imports (Architecture Principle #1)
- DAG dependency graph — no circular imports at any level
- Systems must be testable in isolation (vitest, no browser for Foundation)
- Only 4 systems may write to other systems' state (enumerated in Section 3)
- Pipeline slot order (ADR-0002) is the sole source of truth for tick-to-tick state flow
- Dev Infra systems must compile to zero bytes in production builds

### Requirements

- Layer directionality: Foundation → Core → Feature → Presentation. Dev Infra tree-shaken in production.
- Within Core: slot N reads state from slot N-1 (setters applied by previous tick)
- Event Bus is the ONLY cross-system communication pattern for state-change signals
- Per-frame heavy data (speed, fuelLevel, tireCondition) read via direct getter, not Event Bus
- Systems grouped by module/subsystem with explicit public API surface
- Automated enforcement: static imports from forbidden layers must fail at compile/lint time

## Decision

### 1. Layer Architecture

```
┌──────────────────────────────────────────┐
│  Foundation (zero engine imports)          │
│  ─────────────────────────                 │
│  ConfigManager, EventBus, GSM,            │
│  Persistence, SimulationSnapshot,         │
│  DeterminismContract                      │
└──────┬───────────────────────────────────┘
       │ ↓ Foundation types only
┌──────▼───────────────────────────────────┐
│  Core (engine imports allowed)             │
│  ─────────────────────────                 │
│  AssetManager, Input, Camera,             │
│  Physics/Handling, Collision, Track+Env,  │
│  Fuel, TireWear, AIDriver, PitStop,       │
│  RaceManagement, **Entity/CarLifecycle**    │ ← moved from Foundation (uses PhysicsAggregate)
└──────┬───────────────────────────────────┘
       │ ↓ Core interfaces only
┌──────▼───────────────────────────────────┐
│  Feature (mode-specific)                   │
│  ─────────────────────────                 │
│  SingleRace                               │
└──────┬───────────────────────────────────┘
       │ ↓ Core + Feature data
┌──────▼───────────────────────────────────┐
│  Presentation (engine imports allowed)     │
│  ─────────────────────────                 │
│  HUD, Audio, MenuLITE                     │
└──────────────────────────────────────────┘
```

**Dev Infra** (Telemetry Recorder, Dev Tools) is not in the DAG — it loads
via dynamic `import()` behind `import.meta.env.DEV` guards only. No
production code statically imports Dev Infra modules (see Section 7).

**Entity/Car Lifecycle** was moved from Foundation to Core because it
consumes Babylon.js types: `PhysicsAggregate`, `AbstractMesh`, `PhysicsBody`
and `AssetContainer.instantiateModelsToScene()`. These violate the Foundation
"zero engine imports" invariant. [Correction applied per engine specialist review.]

### 2. Import Directionality Rules

| Rule   | Description                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | A system in layer N may import from layer N-1 or N-2, never from N+1                                                               |
| **R2** | Within Core, slot N may import types/read from slot N-1; never import types from slot N+1 (reads via getter interface are allowed) |
| **R3** | Presentation systems may import from any Core or Feature system                                                                    |
| **R4** | Feature (SingleRace) imports only Core systems — never Presentation                                                                |
| **R5** | Foundation systems import only other Foundation systems + standard lib                                                             |
| **R6** | Dev Infra is never statically imported — only dynamic `import()` behind `import.meta.env.DEV`                                      |

### 3. Cross-System Write Rules

Only 4 systems may mutate state owned by another system:

| Producer       | Consumer | Method                   | Effect                                |
| -------------- | -------- | ------------------------ | ------------------------------------- |
| PitStop        | Fuel     | `addFuel(carId, amount)` | Refuel during pit stop                |
| PitStop        | TireWear | `resetTires(carId)`      | Replace tires during pit stop         |
| PitStop        | Physics  | `brakeCar(carId, force)` | Slow pit-transit speed                |
| PitStop        | Physics  | `setPit(carId, enabled)` | Activate/deactivate pit speed limiter |
| RaceManagement | Physics  | `setLocked(carId, bool)` | Lock/unlock car on grid               |

All other systems must use Event Bus or getter interfaces. Invariant:
**A system that owns state is the sole writer of that state**, except where
explicitly granted in the table above.

### 4. Event Bus vs Direct Read Convention

| Data type                                    | Mechanism     | Example                                                                |
| -------------------------------------------- | ------------- | ---------------------------------------------------------------------- |
| State change signal                          | Event Bus     | `collision.impact`, `car.fuel_empty`, `pit.status`                     |
| Per-frame scalar (<8 bytes)                  | Direct getter | `fuelSystem.getFuelLevel(carId)`, `tireSystem.getTireCondition(carId)` |
| Per-frame vector (position, velocity)        | Direct getter | `physics.getSpeed(carId)`, `physics.getSplinePosition(carId)`          |
| One-shot event (key press, state transition) | Event Bus     | `gsm.state.entered`, `race.green.flag`                                 |

### 5. Physics-Fuel/Tire Boundary Pattern

Physics never imports Fuel or Tire Wear modules. Instead:

1. Physics exposes `setFuelMult(carId, value)` and `setTireCondition(carId, value)`
   through `IPhysicsWrite`
2. Fuel writes `fuelMult` via `IPhysicsWrite.setFuelMult()` — applied next tick
3. Tire Wear writes `tireCondition` via `IPhysicsWrite.setTireCondition()` — applied next tick

This enforces a **1-tick delay** between fuel/tire state change and physics
response (16ms at 60Hz). The delay is acceptable: fuel and tire degrade
over seconds/laps, not individual ticks.

One edge case: when `tireCondition` drops to 0 (blown tire), the friction
change is instantaneous and large. Havok handles this correctly — it's a
per-step parameter read — but the car's behavior may be visually abrupt.
The event-driven path (`car.tire_blown`) should throttle visual feedback
if needed. This is a gameplay concern, not a physics stability concern.

### 6. Package Layout Convention

```
src/
  foundation/       # Layer 0 — zero npm deps, zero engine imports
    event-bus/
    gsm/
    persistence/
    simulation-snapshot/
    determinism-contract/
    config-manager/

  core/             # Layer 1 — engine imports allowed
    entity/          # moved from Foundation (uses PhysicsAggregate, AbstractMesh)
    asset-manager/
    input/
    camera/
    physics/
    collision/
    track-environment/
    fuel/
    tire-wear/
    ai-driver/
    pit-stop/
    race-management/

  feature/          # Layer 2 — mode-specific adapters
    single-race/

  presentation/     # Layer 3 — engine imports allowed
    hud/
    audio/
    menu-lite/

  dev-infra/        # Layer 4 — never statically imported
    telemetry-recorder/
    dev-tools/
```

Each system is a directory with an `index.ts` public API and `internal/`
for implementation details. Systems expose only their interface (e.g.,
`IFuel`, `ITireWear`) in the public surface.

### 7. Dev Infra Tree-Shaking Pattern

**Static imports from Dev Infra are forbidden.** All Dev Infra modules must
be loaded via dynamic `import()` behind `import.meta.env.DEV`:

```typescript
// ✅ Correct — Dev Infra never reaches production bundle
async function initDevTools(): Promise<void> {
  if (import.meta.env.DEV) {
    const { DevTools } = await import("./dev-infra/dev-tools");
    DevTools.init();
  }
}

// ❌ Wrong — static import defeats tree-shaking
import { DevTools } from "./dev-infra/dev-tools"; // production bundle includes this
```

This pattern guarantees that Dev Infra modules, even if they import Babylon.js
types, contribute zero bytes to the production bundle.

### 8. Pipeline Init Order Protection

`pipeline.start()` is called in an explicit **Finalize Init** step after all
Core systems have called `register()`, not during individual system init.

```
Init order:
  Foundation.init()  → systems call register(systemId, updateFn, slotIndex)
  Core.init()        → systems call register(systemId, updateFn, slotIndex)
  FinalizeInit()     → pipeline.start()     ← NO tick executes before this
```

Systems that await async init (Havok WASM, AssetContainer preload) must
complete their async loading before `FinalizeInit()`. The game does not
advance to GSM → Menu until init is finalized.

### 9. Foundation Purity Enforcement

To prevent accidental engine imports in Foundation:

**ESLint rule** (`import/no-restricted-paths`):

```json
{
  "rules": {
    "import/no-restricted-paths": [
      {
        "zones": [
          {
            "target": "src/foundation/",
            "forbidden": ["@babylonjs/core/**"]
          }
        ]
      }
    ]
  }
}
```

**package.json `sideEffects` flag** (Foundation modules have zero side effects):

```json
{
  "sideEffects": false
}
```

**CI check**: `tsc --noEmit` on a test that imports Foundation files and
expects compile error for any `@babylonjs/core` symbol.

### Invariants

1. Circular imports are structurally impossible (DAG via layer rules)
2. Init order is self-documenting from layer structure (no systems need to
   know each other's internal init sequence)
3. Foundation systems testable in vitest without browser — improves CI speed
4. Cross-system write table is immutable; new mutators require a new ADR
5. Physics never imports Fuel or Tire Wear at module level

## Alternatives Considered

### Alternative 1: Flat with ESLint import/no-cycle

- **Description:** All systems in a flat directory. Circular imports caught by
  ESLint rule `import/no-cycle`.
- **Pros:** Simple directory structure, no layer enforcement, easy refactoring
- **Cons:** ESLint can detect cycles but cannot enforce directionality. A flat
  structure makes init ordering non-obvious. Systems tend to accumulate cross-cutting
  imports over time without layer boundaries to stop them.
- **Rejection Reason:** Init ordering requires explicit layers. ESLint can't
  prevent Foundation from importing Core — the most critical boundary in this project.

### Alternative 2: Strict Subpackage per System (Micro-Frontend style)

- **Description:** Each system is a standalone npm package with its own
  `package.json` and `tsconfig.json`. Cross-system access only through published types.
- **Pros:** Strongest isolation, impossible to accidentally import internal types
- **Cons:** Heavy tooling overhead (monorepo workspace, package build order, versioning).
  Not justified for 24 systems all in one codebase.
- **Rejection Reason:** Over-engineered for a single-player game with 24 in-process systems.
  Monorepo tooling (changesets, building, linking) adds complexity without proportional benefit.

## Consequences

### Positive

- Circular imports are structurally impossible (not just lint-detected)
- Init order is self-documenting from layer structure
- Foundation systems testable in vitest without browser — improves CI speed
- Cross-system write table makes mutation audit easy (every mutator enumerated)
- Physics never imports Fuel/Tire — clean separation of concerns
- Dev Infra guaranteed zero bytes in production via dynamic import pattern

### Negative

- 1-tick delay between fuel/tire change and physics response (16ms at 60Hz)
- Layer directories require discipline — easy to accidentally import across layers
- Cross-system write table must be updated when new mutators are added
- Entity/Car Lifecycle moved to Core means it cannot be init'd before engine-dependent
  systems (was slot #7 in Foundation, now slot ~14 in Core)

### Risks

- **Risk:** A developer imports a Foundation type from a Core module — the build
  compiles but creates a hidden dependency
  **Mitigation:** ESLint rule `import/no-restricted-paths` with per-directory
  config (Section 9).
- **Risk:** The 1-tick fuel→physics delay causes visible behavior (car doesn't
  slow immediately when fuel runs out)
  **Mitigation:** Fuel consumption is continuous — `fuelMult` decrements each tick
  even before physics reads it. The delay is at most one tick (16ms), imperceptible.
- **Risk:** A Core system statically imports a Dev Infra module → production bundle
  includes Dev Infra code
  **Mitigation:** ESLint rule forbidding static imports from `src/dev-infra/` +
  code review checklist item.

## GDD Requirements Addressed

| GDD System              | Requirement                                | How This ADR Addresses It                                              |
| ----------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| systems-index.md        | Dependency between systems follows DAG     | Layer rules R1–R6 enforce directionality                               |
| systems-index.md        | Foundation has zero engine imports         | R5 — Foundation imports only Foundation + stdlib; Section 9 automation |
| determinism-contract.md | Pipeline slot order                        | R2 — slot N reads from N-1, never N+1                                  |
| physics-handling.md     | Fuel/Tire write via API, not direct import | Section 5 — Physics never imports Fuel/Tire                            |
| determinism-contract.md | Pipeline init before any tick              | Section 8 — `pipeline.start()` after all `register()` calls            |

## Performance Implications

- **CPU:** Zero — module boundaries are compile-time only
- **Memory:** Zero
- **Load Time:** Zero

## Migration Plan

First implementation is greenfield — create directories as specified. No
existing code to migrate.

**One required architecture.md update**: Entity/Car Lifecycle moves from
Foundation slot #7 to Core (loading order adjusted accordingly).

## Validation Criteria

- [ ] `import/no-restricted-paths` configured per-layer directory (Section 9)
- [ ] Foundation: `tsc --noEmit` fails if any Foundation file imports from
      `@babylonjs/core`
- [ ] Core: import verification — Physics module does not import from Fuel or
      Tire Wear modules
- [ ] Cross-system write table matches all mutator API calls in codebase
- [ ] Dev Infra: no static imports from `src/dev-infra/` exist in any non-dev-infra file
- [ ] Dev Infra: dynamic `import()` behind `import.meta.env.DEV` only
- [ ] Init order: `pipeline.start()` called after all Core systems registered
- [ ] `sideEffects: false` in package.json for Foundation modules

## Related Decisions

- ADR-0001 (Event Bus — primary cross-system communication)
- ADR-0002 (Pipeline — slot order, Physics-Fuel/Tire boundary)
- ADR-0003 (Two-Scene — Asset Manager in Core)
- ADR-0005 (Entity/Car Lifecycle — moved to Core per this ADR's engine-import check)
