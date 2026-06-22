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
- **Files**: camelCase (e.g., `playerController.ts`, `sceneManager.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_PLAYER_SPEED`, `GRAVITY`)
- **Private members**: `_` prefix (e.g., `_health`, `_updatePosition()`)
- **Test files**: co-located `*.test.ts` or `*.spec.ts`

## Performance Budgets

- **Target Framerate**: 60 fps
- **Frame Budget**: 16.6 ms
- **Draw Calls**: < 500 (target), < 1000 (ceiling)
- **Memory Ceiling**: 512 MB

## Testing

- **Framework**: [TO BE CONFIGURED — vitest recommended for Vite projects]
- **Minimum Coverage**: [TO BE CONFIGURED]
- **Required Tests**: Physics (vehicle simulation), input handling, scene transitions, economy/balance

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

- [No ADRs yet — use /architecture-decision to create one]

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
