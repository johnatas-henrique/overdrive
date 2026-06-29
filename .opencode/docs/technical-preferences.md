# Technical Preferences

<!-- Populated by /setup-engine. Updated as the user makes decisions throughout development. -->
<!-- All agents reference this file for project-specific standards and conventions. -->

## Engine & Language

- **Engine**: Babylon.js 9.12.0
- **Language**: TypeScript
- **Rendering**: WebGPU-first, WebGL2 fallback
- **Physics**: Havok Physics V2 (@babylonjs/havok 1.3.12)

## Input & Platform

<!-- Written by /setup-engine. Read by /ux-design, /ux-review, /test-setup, /team-ui, and /dev-story -->
<!-- to scope interaction specs, test helpers, and implementation to the correct input methods. -->

- **Target Platforms**: PC, Web
- **Input Methods**: Keyboard/Mouse, Gamepad
- **Primary Input**: Gamepad (racing game)
- **Gamepad Support**: Full
- **Touch Support**: None
- **Platform Notes**: Racing game — prioritize gamepad responsiveness and wheel support. Keyboard fallback for menu navigation.

## Naming Conventions

- **Classes**: PascalCase (e.g., `PlayerController`, `SceneManager`) — matching Babylon.js API style
- **Variables/functions**: camelCase (e.g., `moveSpeed`, `takeDamage()`)
- **Interfaces**: PascalCase with `I` prefix (e.g., `IPlayerState`, `IVehicleConfig`)
- **Types**: PascalCase (e.g., `PlayerState`, `GamePhase`)
- **Enums**: PascalCase (e.g., `GameState`, `PlayerAction`)
- **Files**: kebab-case (e.g., `player-controller.ts`, `scene-manager.ts`). PascalCase allowed only when filename = exported class name (e.g., `GameStateMachine.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_PLAYER_SPEED`, `GRAVITY`)
- **Private members**: `_` prefix (e.g., `_health`, `_updatePosition()`)
- **Test files**: co-located `*.test.ts` or `*.spec.ts`

## Performance Budgets

- **Target Framerate**: 60 fps
- **Frame Budget**: 16.6 ms
- **Draw Calls**: < 500 (target), < 1000 (ceiling)
- **Memory Ceiling**: 512 MB

## Testing

- **Framework**: Vitest 4.1.9 (configured in `package.json`)
- **Minimum Coverage**: 80% unit, 70% integration (target — enforce when first stories are written)
- **Required Tests**: Physics (vehicle simulation), input handling, scene transitions, economy/balance
- **Runner**: `npx vitest run`
- **Typecheck**: `npx tsc --noEmit` (pre-commit)

## Forbidden Patterns

<!-- Add patterns that should never appear in this project's codebase -->

- `import * as BABYLON from "@babylonjs/core"` — barrel import breaks tree-shaking
- Singletons for game systems — use dependency injection via constructor parameters
- Hardcoded gameplay values — must be data-driven from config files
- Direct DOM manipulation — use Babylon.js GUI for UI
- `Sound` class (legacy) — use `CreateSoundAsync` + Audio Engine V2
- `SceneLoader.Load`, `Append`, `ImportMesh` (sync variants) — use `*Async` equivalents
- Webpack — use Vite
- Jest — use Vitest
- ts-patch — TypeScript 6.0+ native, no patch needed
- WebVR — use WebXR

## Allowed Libraries / Addons

<!-- Add approved third-party dependencies here -->

- `@babylonjs/core` — engine
- `@babylonjs/gui` — HUD and menus
- `@babylonjs/havok` — physics
- `@babylonjs/loaders` — GLB/GLTF model loading
- `vite` — build tool
- `typescript` — language

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/ -->

- **ADR-0001** Event Bus Architecture — `docs/architecture/adr-0001-event-bus-architecture.md`
- **ADR-0002** Fixed Timestep & Determinism Pipeline — `docs/architecture/adr-0002-fixed-timestep-determinism.md`
- **ADR-0003** Two-Scene Architecture & Asset Lifecycle — `docs/architecture/adr-0003-two-scene-architecture.md`
- **ADR-0004** Module Boundary & Dependency Rules — `docs/architecture/adr-0004-module-boundary-rules.md`
- **ADR-0005** Entity/Car Lifecycle & State Ownership — `docs/architecture/adr-0005-entity-car-lifecycle.md`
- **ADR-0006** Input Abstraction — `docs/architecture/adr-0006-input-abstraction.md`
- **ADR-0007** Camera Architecture — `docs/architecture/adr-0007-camera-architecture.md`
- **ADR-0008** Vehicle Physics (Arcade Dynamic) — `docs/architecture/adr-0008-vehicle-physics.md`
- **ADR-0009** Developer Tools — `docs/architecture/adr-0009-dev-tools.md`
- **ADR-0010** Collision Model — `docs/architecture/adr-0010-collision-model.md`
- **ADR-0011** Fuel Model — `docs/architecture/adr-0011-fuel-model.md`
- **ADR-0012** Tire Wear Model — `docs/architecture/adr-0012-tire-model.md`
- **ADR-0013** AI Driver — `docs/architecture/adr-0013-ai-driver.md`
- **ADR-0014** Pit Stop Flow — `docs/architecture/adr-0014-pit-stop-flow.md`
- **ADR-0015** Race Management — `docs/architecture/adr-0015-race-management.md`
- **ADR-0016** Persistence — `docs/architecture/adr-0016-persistence.md`
- **ADR-0017** Simulation Snapshot — `docs/architecture/adr-0017-simulation-snapshot.md`
- **ADR-0018** HUD Layout & Blocks — `docs/architecture/adr-0018-hud-layout-blocks.md`
- **ADR-0019** Menu LITE — `docs/architecture/adr-0019-menu-lite.md`
- **ADR-0020** Audio Engine — `docs/architecture/adr-0020-audio-engine.md`
- **ADR-0021** Single Race Adapter — `docs/architecture/adr-0021-single-race-adapter.md`
- **ADR-0022** Telemetry Recorder — `docs/architecture/adr-0022-telemetry-recorder.md`
- **ADR-0023** Data & Config Manager — `docs/architecture/adr-0023-data-config-manager.md`
- **ADR-0024** Game State Machine — `docs/architecture/adr-0024-game-state-machine.md`
- **ADR-0025** Track + Environment — `docs/architecture/adr-0025-track-environment.md`

All 25 ADRs Accepted. See `docs/architecture/` for full detail.

## Engine Specialists

<!-- Written by /setup-engine when engine is configured. -->
<!-- Read by /code-review, /architecture-decision, /architecture-review, and team skills -->
<!-- to know which specialist to spawn for engine-specific validation. -->

- **Primary**: babylonjs-specialist
- **Language/Code Specialist**: babylonjs-specialist (TypeScript — primary covers it)
- **Shader Specialist**: babylonjs-perf-specialist (ShaderMaterial, Effect, node material, GLSL)
- **UI Specialist**: babylonjs-gui-specialist (AdvancedDynamicTexture, controls, HUD, input handling)
- **Additional Specialists**: babylonjs-physics-specialist (Havok Physics V2, vehicle physics, constraints, collisions), babylonjs-network-specialist (Colyseus SDK, WebSockets, room management, state sync)
- **Routing Notes**: Invoke primary for scene setup, rendering pipeline, and general TypeScript code review. Invoke physics specialist for any Havok physics, vehicle simulation, or collision handling. Invoke network specialist for multiplayer sessions, room management, and state synchronization. Invoke GUI specialist for all UI/HUD/menu implementation. Invoke performance specialist for draw call optimization, LOD, instancing, shader tuning, and frame budget management.

### File Extension Routing

| File Extension / Type                     | Specialist to Spawn          |
| ----------------------------------------- | ---------------------------- |
| Game code (.ts files)                     | babylonjs-specialist         |
| Scene/level files (.ts scene setup)       | babylonjs-specialist         |
| Shader files (.fx, custom shader code)    | babylonjs-perf-specialist    |
| UI / screen files (.ts ADT setup)         | babylonjs-gui-specialist     |
| Physics / vehicle files (.ts physics)     | babylonjs-physics-specialist |
| Network / multiplayer files (.ts network) | babylonjs-network-specialist |
| Configuration / data (.json)              | babylonjs-specialist         |
| General architecture review               | babylonjs-specialist         |
