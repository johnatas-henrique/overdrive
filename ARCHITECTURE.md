# Architecture

## Pattern Overview

**Overall:** Foundation-first layered architecture with typed pub-sub event bus

**Key Characteristics:**
- Foundation systems initialize in strict order (ConfigManager → EventBus → GSM)
- All cross-system communication flows through a typed Event Bus
- Configuration is data-driven with environment variable overrides
- Game state is managed by a flat finite state machine with explicit transition tables
- Engine abstraction supports WebGPU-first with WebGL2 fallback

## Layers

**Foundation Layer:**
- Purpose: Core infrastructure that all game systems depend on
- Location: `src/foundation/`
- Contains: ConfigManager, EventBus, GameStateMachine, type definitions
- Depends on: None (zero external dependencies within foundation)
- Used by: All gameplay systems, UI, audio, physics

**Playground Layer:**
- Purpose: Rapid prototyping and scene setup for testing foundation systems
- Location: `src/playground/`
- Contains: Scene creation, GUI setup, test meshes
- Depends on: Babylon.js, Foundation layer
- Used by: Development workflow, visual testing

**Configuration Layer:**
- Purpose: Feature flags and engine settings for the template
- Location: `src/config/`
- Contains: Template configuration, feature toggles
- Depends on: None
- Used by: App bootstrap, Playground layer

**Application Layer:**
- Purpose: Main entry point and engine initialization
- Location: `src/app.ts`
- Contains: Engine creation, physics setup, render loop
- Depends on: Babylon.js, Configuration layer, Playground layer
- Used by: Browser runtime

## Data Flow

**Configuration Resolution:**
1. `ConfigManager.init()` — `src/foundation/config/configManager.ts`
2. `ConfigManager.register(namespace, config)` — `src/foundation/config/configManager.ts`
3. Environment variable override scan (`OVERDRIVE__NS__KEY`) — `src/foundation/config/configManager.ts`
4. `ConfigManager.get<T>(key)` — `src/foundation/config/configManager.ts`

**Event Dispatch:**
1. System calls `EventBus.emit(event, payload)` — `src/foundation/event-bus/event-bus.ts`
2. Circular emit depth check — `src/foundation/event-bus/event-bus.ts`
3. Snapshot iteration over registered handlers — `src/foundation/event-bus/event-bus.ts`
4. Handler error isolation (catch and log) — `src/foundation/event-bus/event-bus.ts`

**Game State Transition:**
1. System calls `GameStateMachine.transition(targetState)` — `src/foundation/gsm/GameStateMachine.ts`
2. Transition table lookup (`TRANSITIONS[current][target]`) — `src/foundation/gsm/TransitionTable.ts`
3. State update or `GameStateError` thrown — `src/foundation/gsm/GameStateMachine.ts`

## Key Abstractions

**ConfigManager:**
- Purpose: Central configuration registry with namespace isolation and env overrides
- Location: `src/foundation/config/configManager.ts`, `src/foundation/config/index.ts`
- Pattern: Singleton registry with init guard, two-tier storage (raw + resolved)

**EventBus:**
- Purpose: Typed synchronous pub-sub with error isolation and leak detection
- Location: `src/foundation/event-bus/event-bus.ts`, `src/foundation/event-bus/types.ts`
- Pattern: Interface-based design (`IEventBus`), subscription handles, snapshot dispatch

**GameStateMachine:**
- Purpose: Manages game lifecycle phases (Loading → Menu → PreRace → Racing → Paused → PostRace)
- Location: `src/foundation/gsm/GameStateMachine.ts`, `src/foundation/gsm/TransitionTable.ts`
- Pattern: Flat FSM with static transition table, O(1) lookup

**EventMap:**
- Purpose: Central type registry for all game events with compile-time safety
- Location: `src/foundation/event-bus/types.ts`
- Pattern: TypeScript mapped types for event payload validation

## Entry Points

**Browser Entry:**
- Location: `src/app.ts`
- Triggers: HTML page load (`<script>` tag or module)
- Responsibilities: Create engine, initialize physics, setup scene, start render loop

**Development Server:**
- Location: `vite.config.ts` (implied by package.json scripts)
- Triggers: `npm run dev`
- Responsibilities: Hot module replacement, development server, asset serving

**Test Runner:**
- Location: `vitest.config.ts` (implied by package.json scripts)
- Triggers: `npm test` or `vitest run`
- Responsibilities: Unit test execution, coverage reporting

## Error Handling

**Strategy:** Fail-fast with typed errors and descriptive messages

- `ConfigManager`: Throws `ConfigError` for missing keys, uninitialized state, duplicate namespaces
- `EventBus`: Throws `EventBusError` for uninitialized/disposed state, max emit depth exceeded
- `GameStateMachine`: Throws `GameStateError` for invalid transitions, uninitialized state
- Handler errors in EventBus are caught and logged individually (error isolation)
- Physics initialization failures fall back to WebGL2 with console warning

## Cross-Cutting Concerns

**Logging:** Console-based with structured prefixes (`[EventBus]`, `ConfigManager:`)
**Caching:** ConfigManager uses two-tier cache (raw store + resolved env-overridden clone)
**Storage:** In-memory only (no persistence layer implemented yet)
**HMR:** Vite hot module replacement via `wireConfigHmr()` for config files
**Type Safety:** TypeScript strict mode with compile-time event payload validation