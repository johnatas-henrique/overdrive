# Codebase Structure

## Directory Layout

```
overdrive/
├── src/                    # Application source code
│   ├── foundation/         # Core infrastructure systems
│   │   ├── config/         # Configuration management
│   │   ├── event-bus/      # Typed pub-sub event system
│   │   └── gsm/            # Game state machine
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
- Contains: ConfigManager, EventBus, GameStateMachine, type definitions
- Key files: `config/configManager.ts`, `event-bus/event-bus.ts`, `gsm/GameStateMachine.ts`

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
- Purpose: Unit tests for foundation systems
- Contains: Test files for ConfigManager, EventBus, GSM, HMR
- Key files: `config-manager.test.ts`, `event-bus.test.ts`, `gsm.test.ts`, `hmr.test.ts`

**`docs/architecture/`:**
- Purpose: Architecture Decision Records (ADRs) documenting design decisions
- Contains: ADR files, architecture review reports, technical requirements
- Key files: `adr-0001-event-bus-architecture.md`, `adr-0023-data-config-manager.md`, `adr-0024-game-state-machine.md`

**`design/`:**
- Purpose: Game design documents, UX guidelines, art bibles
- Contains: GDDs, UX specs, art references, accessibility requirements
- Key files: `player-journey.md`, `accessibility-requirements.md`, `gdd/` directory

**`production/`:**
- Purpose: Sprint planning, epic tracking, and QA documentation
- Contains: Sprint plans, epic definitions, QA reports
- Key files: `epics/` directory with simulation-snapshot, menu-lite, dev-tools, determinism-contract

## Key File Locations

**Entry Points:** `src/app.ts`: Main application entry, engine initialization, render loop
**Configuration:** `src/config/template-config.ts`: Feature flags and engine settings
**Core Logic:** `src/foundation/config/configManager.ts`: Central configuration registry
**Core Logic:** `src/foundation/event-bus/event-bus.ts`: Typed pub-sub event system
**Core Logic:** `src/foundation/gsm/GameStateMachine.ts`: Game state machine
**Type Definitions:** `src/foundation/event-bus/types.ts`: EventMap and interface definitions
**Stylesheets:** `src/css/main.css`: Application styles
**Tests:** `tests/unit/`: Unit tests for all foundation systems
**Documentation:** `docs/architecture/`: Architecture Decision Records

## Naming Conventions

**Files:** camelCase for TypeScript files: `configManager.ts`, `event-bus.ts`, `GameStateMachine.ts`
**Directories:** kebab-case for directories: `event-bus/`, `game-state-machine/`
**Types:** PascalCase for types and interfaces: `EventMap`, `ConfigManager`, `GameStateMachine`
**Constants:** SCREAMING_SNAKE_CASE for constants: `TRANSITIONS`, `DEFAULT_CONFIG`

## Where to Add New Code

**New foundation system:** `src/foundation/[system-name]/` — follow existing pattern with index.ts barrel export
**New config namespace:** `src/config/[namespace].ts` — use `wireConfigHmr()` for HMR support
**New event types:** Add to `EventMap` in `src/foundation/event-bus/types.ts`
**New game state:** Add to `State` type in `src/foundation/gsm/State.ts` and update `TransitionTable.ts`
**New test suite:** `tests/unit/[system-name].test.ts` — co-located with source but separate directory
**New ADR:** `docs/architecture/adr-[number]-[title].md` — follow existing ADR format
**New epic:** `production/epics/[epic-name]/` — with sprint planning and status tracking
**New design doc:** `design/[category]/[document-name].md` — follow existing design document format
**Shared utilities:** `src/shared/` (when needed)
**Playground experiments:** `src/playground/` — for visual testing and prototyping