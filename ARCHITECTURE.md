# Architecture

## Pattern Overview

**Overall:** Foundation-first layered architecture with typed pub-sub event bus

**Key Characteristics:**
- Foundation systems initialize in strict order (ConfigManager → EventBus → GSM)
- All cross-system communication flows through a typed Event Bus
- Configuration is data-driven with environment variable overrides
- Game state is managed by a flat finite state machine with explicit transition tables
- Deterministic simulation pipeline with fixed timestep and dev-mode guards
- Async-first persistence with state machine and degraded mode
- Simulation snapshot system for deterministic state capture and restore
- Engine abstraction supports WebGPU-first with WebGL2 fallback
- Dev Tools overlay and Telemetry Recorder are tree-shaken in production via `import.meta.env.DEV`

## Layers

**Foundation Layer:**
- Purpose: Core infrastructure that all game systems depend on
- Location: `src/foundation/`
- Contains: ConfigManager, EventBus, GameStateMachine, Determinism pipeline, Persistence, SimulationSnapshot
- Depends on: None (zero external dependencies within foundation, except `pipeline-runtime.ts` imports Babylon.js)
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

**Dev Tools Layer:**
- Purpose: Debug overlay, keybinds, data panel registration, and tabbed debug panels for development
- Location: `src/core/dev-tools/`
- Contains: DevTools overlay class, IDevTools interface, keyboard keybinds, singleton proxy, Event Bus Inspector, Config Tree Panel, GSM Visualizer, Sim Snapshot Panel, AI Telemetry Panel
- Depends on: Babylon.js (SceneInstrumentation), Foundation layer (ConfigManager, EventBus, GSM, SimulationSnapshot)
- Used by: Development workflow only (tree-shaken in production via `import.meta.env.DEV`)

**Dev Infra Layer:**
- Purpose: Dev-only telemetry recording and data export for simulation analysis
- Location: `src/dev-infra/`
- Contains: TelemetryRecorder — data model, sampling loop, console summary, JSON export
- Depends on: Foundation layer (EventBus), Babylon.js types
- Used by: Development workflow only (tree-shaken in production via `import.meta.env.DEV`)

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
5. Wildcard `"*"` handlers fire after typed handlers with `{ event, payload }` — `src/foundation/event-bus/event-bus.ts`
6. `EventBus.off(event)` removes all handlers for a given event, returns bus for chaining — `src/foundation/event-bus/event-bus.ts`
7. `EventBus.off(subscription)` unsubscribes a specific handler (idempotent) — `src/foundation/event-bus/event-bus.ts`
8. `EventBus.getSubscriptions()` returns `Map<string, number>` of event → handler count — `src/foundation/event-bus/event-bus.ts`

**Game State Transition:**
1. System calls `GameStateMachine.transition(targetState)` — `src/foundation/gsm/GameStateMachine.ts`
2. Transition table lookup (`TRANSITIONS[current][target]`) — `src/foundation/gsm/TransitionTable.ts`
3. Lifecycle hooks execute: `source.onExit()` → `target.onEnter()` — `src/foundation/gsm/GameStateMachine.ts`
4. Event Bus emits `gsm.state.exited` then `gsm.state.entered` — `src/foundation/gsm/GameStateMachine.ts`
5. State update or `GameStateError` thrown — `src/foundation/gsm/GameStateMachine.ts`

**Deterministic Simulation Pipeline:**
1. `PipelineRuntime.attach(engine, activeScene)` — `src/foundation/determinism/pipeline-runtime.ts`
2. `accumulate()` processes frame delta against fixed 1/60s timestep — `src/foundation/determinism/accumulator.ts`
3. `FixedUpdatePipeline.executeTick(dt)` runs 8 slots in order: Input → Physics → AI → Collision → Fuel → Tire → RaceMgmt → PitStop — `src/foundation/determinism/fixed-update-pipeline.ts`
4. `DeterminismGuard` replaces `Math.random`/`Date.now`/`performance.now` with throwing wrappers — `src/foundation/determinism/dev-guard.ts`
5. `InputBuffer.write()` / `read()` / `flip()` — double-buffered input state — `src/foundation/determinism/input-buffer.ts`

**Persistence Storage:**
1. `Persistence.init()` probes localStorage availability — `src/foundation/persistence/persistence.ts`
2. `Persistence.save(key, data)` wraps in `PersistedEntry` with version and timestamp — `src/foundation/persistence/persistence.ts`
3. `Persistence.load(key)` unwraps and runs migration chain if needed — `src/foundation/persistence/persistence.ts`
4. Degraded mode: writes queue to memory, reads return null, `retry()` flushes — `src/foundation/persistence/persistence.ts`

**Simulation Snapshot:**
1. `SimulationSnapshot.init()` — `src/foundation/simulation-snapshot/simulation-snapshot.ts`
2. `SimulationSnapshot.register(system)` — `src/foundation/simulation-snapshot/simulation-snapshot.ts`
3. `SimulationSnapshot.takeSnapshot(tick)` calls `serialize()` on all registered systems — `src/foundation/simulation-snapshot/simulation-snapshot.ts`
4. `SimulationSnapshot.takeSnapshot({ force: true })` bypasses frequency check for on-demand snapshots — `src/foundation/simulation-snapshot/simulation-snapshot.ts`
5. `SimulationSnapshot.getRegisteredSystems()` returns all registered systems as read-only array — `src/foundation/simulation-snapshot/simulation-snapshot.ts`
6. `SimulationSnapshot.getHashes()` returns current FNV-1a hash per systemId — `src/foundation/simulation-snapshot/simulation-snapshot.ts`
7. `fnv1a()` hashes each system state, `sha256()` hashes the combined snapshot — `src/foundation/simulation-snapshot/fnv1a.ts`, `src/foundation/simulation-snapshot/sha256.ts`
8. `SimulationSnapshot.restoreSnapshot(snap)` calls `deserialize()` per system with error isolation — `src/foundation/simulation-snapshot/simulation-snapshot.ts`

## Key Abstractions

**ConfigManager:**
- Purpose: Central configuration registry with namespace isolation and env overrides
- Location: `src/foundation/config/configManager.ts`, `src/foundation/config/index.ts`
- Pattern: Singleton registry with init guard, two-tier storage (raw + resolved)

**EventBus:**
- Purpose: Typed synchronous pub-sub with error isolation, leak detection, and wildcard observation
- Location: `src/foundation/event-bus/event-bus.ts`, `src/foundation/event-bus/types.ts`
- Pattern: Interface-based design (`IEventBus`), subscription handles, snapshot dispatch, wildcard `"*"` subscription for dev tools inspection, `getSubscriptions()` for live subscription counts

**GameStateMachine:**
- Purpose: Manages game lifecycle phases (Loading → Menu → PreRace → Racing → Paused → PostRace)
- Location: `src/foundation/gsm/GameStateMachine.ts`, `src/foundation/gsm/TransitionTable.ts`
- Pattern: Flat FSM with static transition table, O(1) lookup, lifecycle hooks (onEnter/onExit), transition queue with `tick()`, 20-entry ring buffer history, optional Event Bus integration

**DeterminismGuard:**
- Purpose: Replaces non-deterministic global APIs with throwing wrappers during pipeline ticks
- Location: `src/foundation/determinism/dev-guard.ts`
- Pattern: Install/uninstall lifecycle, tree-shaken in production via `import.meta.env.DEV`

**FixedUpdatePipeline:**
- Purpose: 8-slot deterministic simulation pipeline with state machine lifecycle
- Location: `src/foundation/determinism/fixed-update-pipeline.ts`
- Pattern: State machine (Uninitialized → Ready → Stopped → Disposed), immutable slot registration

**PipelineRuntime:**
- Purpose: Babylon.js integration layer bridging render loop to deterministic pipeline
- Location: `src/foundation/determinism/pipeline-runtime.ts`
- Pattern: Attach/detach lifecycle, Havok auto-step suppression, accumulator-driven

**SeededRandom:**
- Purpose: Deterministic PRNG using LCG with Numerical Recipes constants
- Location: `src/foundation/determinism/seeded-random.ts`
- Pattern: LCG algorithm, snapshot support via `getState()`/`setState()`, unsigned 32-bit truncation

**InputBuffer:**
- Purpose: Double-buffered input state container for deterministic pipeline
- Location: `src/foundation/determinism/input-buffer.ts`
- Pattern: Write/read/flip lifecycle, `InputState.ZERO` default, no stale input leakage

**Persistence:**
- Purpose: Async-first localStorage abstraction with versioned payloads and degraded mode
- Location: `src/foundation/persistence/persistence.ts`
- Pattern: State machine (Uninitialized → Ready → Degraded), probe-based init, write queue with FIFO eviction, migration chain

**SimulationSnapshot:**
- Purpose: Orchestrates deterministic state capture and restore across registered systems
- Location: `src/foundation/simulation-snapshot/simulation-snapshot.ts`
- Pattern: Interface-based (`ISnapshotable`, `ISimulationSnapshot`), per-system FNV-1a hashing, combined SHA-256 hashing, duplicate registration guard, deserialize error isolation, `getRegisteredSystems()` and `getHashes()` for debug panel queries, `takeSnapshot({ force })` overload for on-demand snapshots

**EventMap:**
- Purpose: Central type registry for all game events with compile-time safety
- Location: `src/foundation/event-bus/types.ts`
- Pattern: TypeScript mapped types for event payload validation

**DevTools:**
- Purpose: HTML overlay positioned over the canvas showing FPS, frame time, draw calls, mesh count, physics time, custom data panels, and tabbed debug panels (Event Log, GSM History, Sim Snapshot)
- Location: `src/core/dev-tools/dev-tools.ts`, `src/core/dev-tools/index.ts`
- Pattern: Singleton proxy with lazy DOM creation, `engine.onEndFrameObservable` metric refresh, `registerDataSource()` for extensible panels, tab system with four panels (Event Log, GSM History, Sim Snapshot, AI Telemetry), config tree sidebar with in-place editing via `ConfigManager.setRuntime()`, tree-shaken in production via `import.meta.env.DEV`

**IDevTools:**
- Purpose: Public interface for the Dev Tools singleton — consumed by keybinds, data panels, and debug panel injection
- Location: `src/core/dev-tools/types.ts`
- Pattern: Type-only interface (zero runtime cost), methods: `toggle()`, `isVisible()`, `setMinimised()`, `update()`, `registerDataSource()`, `setEventBus()`, `setGsm()`, `setSimulationSnapshot()`, `refreshConfigTree()`, `showNotification()`, `dispose()`

**EventBusInspector:**
- Purpose: Event Log tab panel — captures all events via wildcard subscription, maintains a 100-entry ring buffer, renders event history with filter support and live subscription list
- Location: `src/core/dev-tools/event-bus-inspector.ts`
- Pattern: Read-only observer (receives `IReadOnlyEventBus` proxy), wildcard `"*"` capture, FIFO ring buffer eviction, newest-first rendering, case-insensitive filter

**GsmVisualizer:**
- Purpose: GSM History tab panel — displays current state, last 20 state transitions with timestamps and duration, and manual transition buttons for debugging
- Location: `src/core/dev-tools/gsm-visualizer.ts`
- Pattern: Read-only observer (subscribes to `gsm.state.exited`/`gsm.state.entered`), seeds from GSM internal ring buffer, manual transition buttons under DEV guard (Control Manifest D6 exception)

**SimSnapshotPanel:**
- Purpose: Sim Snapshot tab panel — displays registered ISnapshotable systems with per-system FNV-1a hashes, hash diff indicators, and Take/Restore snapshot controls
- Location: `src/core/dev-tools/sim-snapshot-panel.ts`
- Pattern: Read-only observer (reads from `SimulationSnapshot.getRegisteredSystems()`/`getHashes()`), Take/Restore buttons call public API as deliberate debug actions (Control Manifest D6 exception)

**AiTelemetryPanel:**
- Purpose: AI Telemetry tab panel — displays per-car telemetry data (speed, lap position, active AI behaviour node) from a reader function wrapping physics/AI driver calls
- Location: `src/core/dev-tools/ai-telemetry-panel.ts`
- Pattern: Read-only observer (receives a reader function, never emits Event Bus events), internal tick counter for sample-rate throttling (default N=10), DOM re-render on sample only, Control Manifest D6 compliant

**ConfigTreePanel:**
- Purpose: Config sidebar panel — renders a tree view of all ConfigManager namespaces with in-place editing via double-click
- Location: `src/core/dev-tools/config-tree.ts`
- Pattern: `<details>` element per namespace, double-click to edit → `<input>` replaces `<span>` → Enter confirms via `ConfigManager.setRuntime()`, em-dash for `undefined` values, DEV guard on edit path

**DevToolsConfig:**
- Purpose: Centralised keybind definitions for Dev Tools overlay controls
- Location: `src/config/dev-tools-config.ts`
- Pattern: Static config object (`DEV_TOOLS_KEYS`), default keys: toggle=`1`, reload=`2`, minimise=`3`

**TelemetryRecorder:**
- Purpose: Dev-only telemetry data model, sampling loop, console summary, and JSON export for simulation analysis
- Location: `src/dev-infra/telemetry-recorder.ts`
- Pattern: Per-car `TelemetrySample` accumulation, `window.__telemetry.export()` surface, event bus lifecycle subscriptions (race.started → sampling → race.completed), console summary gated by `isRecording`, tree-shaken in production via `import.meta.env.DEV`

**Defined (assert-defined):**
- Purpose: Assertion function that narrows a nullable value to non-null at compile time
- Location: `src/shared/assert-defined.ts`
- Pattern: TypeScript `asserts` keyword, throws `Error` with custom message if value is `null` or `undefined`, used across dev tools panels for safe nullable narrowing

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

**E2E Test Runner:**
- Location: `tests/e2e/` (Playwright)
- Triggers: `npx playwright test`
- Responsibilities: Browser-based E2E tests for Dev Tools overlay, verifying DOM state, CSS computed styles, and user interactions that unit/integration tests cannot catch

## Error Handling

**Strategy:** Fail-fast with typed errors and descriptive messages

- `ConfigManager`: Throws `ConfigError` for missing keys, uninitialized state, duplicate namespaces
- `EventBus`: Throws `EventBusError` for uninitialized/disposed state, max emit depth exceeded
- `GameStateMachine`: Throws `GameStateError` for invalid transitions, uninitialized state
- `FixedUpdatePipeline`: Throws `PipelineError` for invalid state transitions, disposed state
- `Persistence`: Throws `PersistenceError` for uninitialized state; `MigrationError` for missing migration steps
- `SimulationSnapshot`: Throws `SnapshotError` for duplicate registration, deserialize failures, init-after-dispose, not-initialized state
- `DeterminismGuard`: Throws `DeterminismError` when non-deterministic APIs are called during pipeline ticks
- `DevTools`: Throws no custom errors; overlay DOM creation is guarded by `import.meta.env.DEV`
- `TelemetryRecorder`: Throws no custom errors; noop in production builds
- Handler errors in EventBus are caught and logged individually (error isolation)
- Physics initialization failures fall back to WebGL2 with console warning

## Cross-Cutting Concerns

**Logging:** Console-based with structured prefixes (`[EventBus]`, `ConfigManager:`, `[GSM]`, `[Pipeline]`)
**Caching:** ConfigManager uses two-tier cache (raw store + resolved env-overridden clone)
**Storage:** Persistence wraps localStorage with async-first interface, degraded mode, and migration chain
**HMR:** Vite hot module replacement via `wireConfigHmr()` for config files
**Type Safety:** TypeScript strict mode with compile-time event payload validation
**Determinism:** Dev-mode guard replaces non-deterministic APIs; pipeline runs at fixed 1/60s timestep
**Dev Infra:** Dev Tools overlay and Telemetry Recorder are tree-shaken in production via `import.meta.env.DEV` — zero bytes in production builds
**Linting:** Biome with `--error-on-warnings`, test override for `noExplicitAny`
**CI:** GitHub Actions runs lint, typecheck, test with coverage, and build on push/PR to main
