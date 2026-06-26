# Codebase Structure

## Directory Layout

```
overdrive/
├── src/                    # Application source code
│   ├── foundation/         # Core infrastructure systems
│   │   ├── config/         # Configuration management
│   │   ├── event-bus/      # Typed pub-sub event system
│   │   ├── gsm/            # Game state machine
│   │   ├── determinism/    # Deterministic RNG and pipeline
│   │   ├── persistence/    # Async-first storage abstraction
│   │   └── simulation-snapshot/ # Deterministic state capture/restore
│   ├── playground/         # Prototyping and scene setup
│   ├── config/             # Feature flags and template config
│   ├── css/                # Stylesheets
│   └── app.ts              # Main entry point
├── tests/                  # Automated test suites
│   ├── unit/               # Unit tests for foundation systems
│   ├── integration/        # Integration tests
│   ├── evidence/           # Test evidence artifacts
│   └── smoke/              # Smoke tests
├── docs/                   # Project documentation
│   ├── architecture/       # Architecture Decision Records (ADRs)
│   ├── examples/           # Example documentation
│   ├── engine-reference/   # Engine API snapshots
│   └── registry/           # Documentation registry
├── design/                 # Game design documents (GDDs, UX, art)
├── production/             # Sprint planning and tracking
│   ├── epics/              # Epic definitions
│   └── qa/                 # QA plans and reports
├── assets/                 # Game assets
│   ├── sprites/            # 2D sprite assets
│   └── source/             # Source asset files
├── prototypes/             # Throwaway prototypes
├── coverage/               # Test coverage reports
├── .github/                # GitHub workflows and templates
├── .vscode/                # VS Code configuration
└── .cortexkit/             # Magic context system
```

## Directory Purposes

**`src/foundation/`:**
- Purpose: Core infrastructure that all game systems depend on
- Contains: ConfigManager, EventBus, GameStateMachine, Determinism pipeline, Persistence, SimulationSnapshot
- Key files: `config/configManager.ts`, `event-bus/event-bus.ts`, `gsm/GameStateMachine.ts`, `determinism/fixed-update-pipeline.ts`, `persistence/persistence.ts`, `simulation-snapshot/simulation-snapshot.ts`

**`src/foundation/config/`:**
- Purpose: Central configuration registry with namespace isolation and env overrides
- Contains: ConfigManager, ConfigError, HMR wiring
- Key files: `configManager.ts`, `configError.ts`, `hmr.ts`, `index.ts`

**`src/foundation/event-bus/`:**
- Purpose: Typed synchronous pub-sub with error isolation and leak detection
- Contains: EventBus implementation, EventMap, IEventBus interface, error types
- Key files: `event-bus.ts`, `types.ts`, `errors.ts`, `index.ts`

**`src/foundation/gsm/`:**
- Purpose: Flat FSM with lifecycle hooks, transition throttling, and state history
- Contains: GameStateMachine, TransitionTable, State types, StateDefinition
- Key files: `GameStateMachine.ts`, `TransitionTable.ts`, `State.ts`, `StateDefinition.ts`, `GameStateError.ts`, `index.ts`

**`src/foundation/determinism/`:**
- Purpose: Deterministic RNG, fixed timestep pipeline, and dev-mode guards
- Contains: SeededRandom, FixedUpdatePipeline, PipelineRuntime, InputBuffer, Accumulator, DeterminismGuard
- Key files: `seeded-random.ts`, `fixed-update-pipeline.ts`, `pipeline-runtime.ts`, `input-buffer.ts`, `accumulator.ts`, `dev-guard.ts`, `types.ts`, `errors.ts`, `index.ts`

**`src/foundation/persistence/`:**
- Purpose: Async-first localStorage abstraction with versioned payloads and degraded mode
- Contains: Persistence state machine, PersistedEntry, migration chain, error types
- Key files: `persistence.ts`, `errors.ts`, `index.ts`

**`src/foundation/simulation-snapshot/`:**
- Purpose: Deterministic state capture and restore across registered systems
- Contains: SimulationSnapshot orchestrator, ISnapshotable interface, fnv1a/sha256 hashing, error types
- Key files: `simulation-snapshot.ts`, `isnapshotable.ts`, `fnv1a.ts`, `sha256.ts`, `snapshot-error.ts`, `index.ts`

**`src/playground/`:**
- Purpose: Rapid prototyping and visual testing of foundation systems
- Contains: Scene creation, GUI setup, test meshes
- Key files: `main-scene.ts`, `gui.ts`

**`src/config/`:**
- Purpose: Feature flags and engine settings for the template
- Contains: Configuration objects, feature toggles
- Key files: `template-config.ts`

**`src/css/`:**
- Purpose: Stylesheet files for the application
- Contains: CSS files for styling
- Key files: `main.css`

**`tests/unit/`:**
- Purpose: Unit tests for all foundation systems
- Contains: Test files for ConfigManager, EventBus, GSM, HMR, Persistence, Determinism, Snapshot
- Key files: `config-manager.test.ts`, `event-bus.test.ts`, `gsm.test.ts`, `hmr.test.ts`, `persistence.test.ts`, `determinism.test.ts`, `snapshot.test.ts`

**`docs/architecture/`:**
- Purpose: Architecture Decision Records (ADRs) documenting design decisions
- Contains: ADR files, architecture review reports, technical requirements
- Key files: `adr-0001-event-bus-architecture.md`, `adr-0002-fixed-timestep-determinism.md`, `adr-0016-persistence.md`, `adr-0017-simulation-snapshot.md`, `adr-0023-data-config-manager.md`, `adr-0024-game-state-machine.md`

**`design/`:**
- Purpose: Game design documents, UX guidelines, art bibles
- Contains: GDDs, UX specs, art references, accessibility requirements
- Key files: `player-journey.md`, `accessibility-requirements.md`, `gdd/` directory

**`production/`:**
- Purpose: Sprint planning, epic tracking, and QA documentation
- Contains: Sprint plans, epic definitions, QA reports
- Key files: `epics/` directory with simulation-snapshot, persistence, determinism-contract, game-state-machine, and other system epics

## Key File Locations

**Entry Points:** `src/app.ts`: Main application entry, engine initialization, render loop
**Configuration:** `src/config/template-config.ts`: Feature flags and engine settings
**Core Logic:** `src/foundation/config/configManager.ts`: Central configuration registry
**Core Logic:** `src/foundation/event-bus/event-bus.ts`: Typed pub-sub event system
**Core Logic:** `src/foundation/gsm/GameStateMachine.ts`: Game state machine with lifecycle hooks
**Core Logic:** `src/foundation/determinism/fixed-update-pipeline.ts`: 8-slot deterministic pipeline
**Core Logic:** `src/foundation/determinism/pipeline-runtime.ts`: Babylon.js integration layer
**Core Logic:** `src/foundation/persistence/persistence.ts`: Async-first storage abstraction
**Core Logic:** `src/foundation/simulation-snapshot/simulation-snapshot.ts`: State capture orchestrator
**Type Definitions:** `src/foundation/event-bus/types.ts`: EventMap and interface definitions
**Type Definitions:** `src/foundation/determinism/types.ts`: InputState interface
**Stylesheets:** `src/css/main.css`: Application styles
**Tests:** `tests/unit/`: Unit tests for all foundation systems
**Documentation:** `docs/architecture/`: Architecture Decision Records

## Naming Conventions

**Files:** camelCase for TypeScript files: `configManager.ts`, `event-bus.ts`, `GameStateMachine.ts`
**Directories:** kebab-case for directories: `event-bus/`, `game-state-machine/`, `determinism/`
**Types:** PascalCase for types and interfaces: `EventMap`, `ConfigManager`, `GameStateMachine`, `InputState`
**Constants:** SCREAMING_SNAKE_CASE for constants: `TRANSITIONS`, `DEFAULT_CONFIG`, `FIXED_DT`

## Where to Add New Code

**New foundation system:** `src/foundation/[system-name]/` — follow existing pattern with index.ts barrel export
**New config namespace:** `src/config/[namespace].ts` — use `wireConfigHmr()` for HMR support
**New event types:** Add to `EventMap` in `src/foundation/event-bus/types.ts`
**New game state:** Add to `State` type in `src/foundation/gsm/State.ts` and update `TransitionTable.ts`
**New pipeline slot:** Register via `FixedUpdatePipeline.register(systemId, update)` in `src/foundation/determinism/fixed-update-pipeline.ts`
**New snapshot system:** Implement `ISnapshotable` interface and register with `SimulationSnapshot.register()`
**New test suite:** `tests/unit/[system-name].test.ts` — co-located with source but separate directory
**New ADR:** `docs/architecture/adr-[number]-[title].md` — follow existing ADR format
**New epic:** `production/epics/[epic-name]/` — with sprint planning and status tracking
**New design doc:** `design/[category]/[document-name].md` — follow existing design document format
**Shared utilities:** `src/shared/` (when needed)
**Playground experiments:** `src/playground/` — for visual testing and prototyping
