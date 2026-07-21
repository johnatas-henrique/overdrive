# Technical Preferences

<!-- Populated by /setup-engine. Updated as the user makes decisions throughout development. -->
<!-- All agents reference this file for project-specific standards and conventions. -->

## Engine & Language

- **Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS)
- **Language**: C#
- **Rendering**: Universal Render Pipeline 17.3.0
- **Physics**: Unity Physics 3D. Vehicle simulation remains pending prototype evaluation.
- **Networking**: Coherence 2.1 (multiplayer SDK). Free Starter tier for development (<$200k revenue). Client-side prediction with rollback. Server tick rate 30 Hz, client 60 Hz with local prediction. Built-in matchmaking (Rooms), relay, leaderboards (KV Database). Revenue share 3% for hosting above $15k/quarter.

## Input & Platform

<!-- Written by /setup-engine. Read by /ux-design, /ux-review, /test-setup, /team-ui, and /dev-story -->
<!-- to scope interaction specs, test helpers, and implementation to the correct input methods. -->

- **Target Platforms**: PC, Web
- **Input Methods**: Keyboard/Mouse, Gamepad
- **Primary Input**: Keyboard/Mouse and Gamepad are equivalent
- **Gamepad Support**: Full
- **Touch Support**: None
- **Platform Notes**: Web builds target WebGL2. Do not depend on experimental WebGPU. UI and prompts must adapt to the active keyboard/mouse or gamepad control scheme.

## Naming Conventions

- **Classes**: PascalCase
- **Variables**: PascalCase for visible fields, `_camelCase` for private fields, camelCase for parameters and locals
- **Signals/Events**: PascalCase
- **Files**: PascalCase matching the primary class
- **Scenes/Prefabs**: PascalCase
- **Constants**: PascalCase unless an ADR establishes a system-specific convention

## Performance Budgets

- **Target Framerate**: 60 FPS
- **Frame Budget**: 16.6 ms
- **Draw Calls**: Establish from the first representative PC and Web prototype
- **Memory Ceiling**: Establish from the first representative PC and Web prototype

## Testing

- **Framework**: Unity Test Framework 1.6.0 (NUnit)
- **Minimum Coverage**: No numeric target before a baseline exists; cover public game logic and every fixed bug with deterministic tests.
- **Required Tests**: EditMode for deterministic logic; PlayMode for Unity behavior; balance formulas and gameplay systems; networking only if later introduced.

## Forbidden Patterns

<!-- Add patterns that should never appear in this project's codebase -->
- [None configured yet — add as architectural decisions are made]

## Allowed Libraries / Addons

<!-- Add approved third-party dependencies here -->
- Universal Render Pipeline 17.3.0
- Input System 1.19.0
- AI Navigation 2.0.14
- Addressables 3.1.0
- Coherence 2.1 (multiplayer SDK)
- Unity Test Framework 1.6.0
- MCP for Unity (CoplayDev) via `com.coplaydev.unity-mcp`

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/ -->
- [No ADRs yet — use /architecture-decision to create one]

## Engine Specialists

<!-- Written by /setup-engine when engine is configured. -->
<!-- Read by /code-review, /architecture-decision, /architecture-review, and team skills -->
<!-- to know which specialist to spawn for engine-specific validation. -->

- **Primary**: unity-specialist
- **Language/Code Specialist**: unity-specialist
- **Shader Specialist**: unity-shader-specialist
- **UI Specialist**: unity-ui-specialist
- **Additional Specialists**: unity-dots-specialist, unity-addressables-specialist
- **Routing Notes**: Use the primary specialist for Unity architecture and C# review. Use the Addressables specialist for content groups, catalogs, and asset-loading decisions. Use the DOTS specialist only when ECS, Jobs, or Burst architecture is actively introduced. Use the shader and UI specialists for rendering and interface work respectively.

### File Extension Routing

<!-- Skills use this table to select the right specialist per file type. -->
<!-- If a row says [TO BE CONFIGURED], fall back to Primary for that file type. -->

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (.cs files) | unity-specialist |
| Shader / material files (.shader, .shadergraph, .mat) | unity-shader-specialist |
| UI / screen files (.uxml, .uss, Canvas prefabs) | unity-ui-specialist |
| Scene / prefab / level files (.unity, .prefab) | unity-specialist |
| Native extension / plugin files (.dll, native plugins) | unity-specialist |
| General architecture review | unity-specialist |
