# Architecture

## Pattern Overview

**Overall:** Plugin-based agent orchestration framework with tiered delegation

**Key Characteristics:**
- 51 specialized agents organized in a 3-tier hierarchy (Directors → Leads → Specialists)
- 158 skills (slash commands) routed through themed modules
- 3 OpenCode TypeScript plugins for lifecycle hooks, drift detection, and changelog generation
- User-driven collaboration model — agents draft and propose, user decides

## Layers

**OCGS Framework Layer:**
- Purpose: Game development process orchestration — design, architecture, stories, QA, release
- Location: `.agents/` (primary), `.opencode/` (plugins only — agents/skills/commands/rules live in `.agents/` with local NTFS junctions into `.opencode/` for OpenCode runtime compatibility)
- Contains: Agent definitions (`.agents/agents/`), skill workflows (`.agents/skills/`), slash commands (`.agents/commands/`), coding rules (`.agents/rules/`), agent learning system (`learning/`)
- Depends on: OpenCode runtime, Node.js
- Used by: All game development sessions via `/command` invocations

**OpenCode Plugin Layer:**
- Purpose: Lifecycle hooks that enforce framework invariants during coding sessions
- Location: `.opencode/plugins/`
- Contains: `ccgs-hooks.ts` (branch protection, design section validation, source file checks), `drift-detector.ts` (agent/skill template drift detection), `changelog-generator.ts` (conventional commit parsing)
- Depends on: OpenCode plugin API (`@opencode-ai/plugin`), child_process, fs
- Used by: OpenCode runtime, loaded via `opencode.json` plugin config

**Game Source Layer:**
- Purpose: Actual game code, scenes, assets, and Unity project configuration
- Location: `Assets/`, `ProjectSettings/`, `Packages/`
- Contains: Unity C# scripts, scenes, materials, sprites, input actions, render pipeline assets
  - `Overdrive.Input` (`Assets/source/Overdrive.Input.asmdef`): Unity-side input processing — `InputContextController`, `DeadZoneNormalizer`, `EmaBrakePriority`, `ControlProfile`, `TickProcessor`, `InputFrameDriver`, `InputFrameCapture` (production capture adapter), `InputBindingCatalog`, `EmaReinitializerBase`, `ContextResumeEmaReinitializer`, `SchemeChangeEmaReinitializer`, `SettingsInputPreviewEvaluator`, `SimulationDriverAdapters` (Unity lifecycle adapters bridging engine-free simulation seams to Unity APIs)
  - `Overdrive.Simulation` (`Assets/source/Simulation/Overdrive.Simulation.asmdef`): Engine-free simulation kernel — `SimulationKernel` (14-step invocation spine), `SimulationStateMachine` (authoritative session lifecycle), `SimulationDriver` (manual fixed-step accumulator), `GhostRecorderLifecycle` (ghost-recorder and GO-boundary replay-capture lifecycle), `RenderInterpolator` (render interpolation math), `PerformanceMonitor` (FPS protection), `Pcg32` (deterministic PRNG), `GhostBuffer` (ghost recording), `DeterminismHarness` (determinism replay), contract spine types (`CarState` with 3D pose, `FuelState`, `TireState`, `GridAssignment`, `SimulationTickContext`, `PublishedSimulationSnapshot`, `PostFinishSnapshot`, pipeline steps). Depends on `Unity.Mathematics`; has `noEngineReferences: true`
  - `Overdrive.Multiplayer` (`Assets/source/Multiplayer/Overdrive.Multiplayer.asmdef`): Engine-free multiplayer seam (ADR-0017 D2) — `INetworkSimulationDriver` (4-method interface: `SubmitInputs`, `SerializeSnapshot`, `Rollback`, `GetPredictedInput`, plus `RemoteInputsReceived` event), `RemoteInputsReceivedHandler` delegate, `NetworkInput` struct (MVP placeholder), `SimulationRollbackState` readonly struct with `Vector3Array16`/`QuaternionArray16` zero-allocation fixed-length wrappers. References only `Overdrive.Simulation` and `Unity.Mathematics`; has `noEngineReferences: true`. No concrete provider implementation in MVP.
  - `Overdrive.Settings.Core` (`Assets/source/Settings.Core/Overdrive.Settings.Core.asmdef`): Engine-free settings persistence core — `SettingsBlobService` (load cascade: primary → backup → factory defaults; save: backup-first atomic write), `SettingsPersistence` (core read/write over `IPlayerPrefsStore` seam), `SettingsEditSession` (transactional preview with Snapshot/Working copy, display-confirm gate, one-session-at-a-time), `SettingsData` models (`GameSettingsData` with difficulty, controls, audio, display, accessibility, camera), `SettingsMigration` (sequential v1→v2→v3), `SettingsValidator` (per-field validation), `SettingsJsonCodec` (JSON serialize/deserialize), `SettingsBindings` (binding de-duplication). Depends on `Overdrive.Input` and `Overdrive.Simulation`; has `noEngineReferences: true` (note: `autoReferenced: true`)
  - `Overdrive.Settings` (`Assets/source/Settings/Overdrive.Settings.asmdef`): Unity-facing settings adapters — `SettingsLoader` (wires engine-free core to Unity surfaces: maps `ControlsData` → `ControlProfile` via `ControlProfile.Sanitize`), `SettingsLifecycleContext` (maps `SimulationState` to settings lifecycle queries: `CanOpenSettings`, `IsDifficultyEditable`), `PlayerPrefsStore` (implements `IPlayerPrefsStore` over `UnityEngine.PlayerPrefs`). Depends on `Overdrive.Settings.Core`, `Overdrive.Input`, `Overdrive.Simulation`
- Depends on: Unity 6 (6000.3.22f1), URP 17.3.0, Input System 1.20.0, AI Navigation 2.0.14, Addressables 3.1.0, Unity CLI pipeline 0.4.0-exp.1, Unity.Mathematics
- Used by: Unity Editor, build pipeline, Unity CLI commands

**Design Layer:**
- Purpose: Game design documentation, art bible, asset specs, UX design, quick specs, cross-GDD consistency analysis, entity/formula registry, design standards
- Location: `design/`
- Contains: GDDs (`design/gdd/`), art bible and palettes (`design/art/`), asset specifications (`design/assets/`), UX design (`design/ux/`), quick specs (`design/quick-specs/`), entity/formula registry (`design/registry/entities.yaml`), cross-GDD consistency reports (`design/reviews/`), design standards (`design/AGENTS.md`)
- Depends on: OCGS design skills (`/design-system`, `/quick-design`, `/ux-design`)
- Used by: Architecture skills, story creation, implementation validation

**Testing Layer:**
- Purpose: Plugin tests and Unity/C# gameplay tests
- Location: `Assets/tests/`, `tests/`
- Contains: EditMode and PlayMode test directories, unit tests (`Assets/tests/unit/input/`, `Assets/tests/unit/simulation/`, `Assets/tests/unit/multiplayer/`, `Assets/tests/unit/settings/`), integration tests (`Assets/tests/integration/input/`, `Assets/tests/integration/simulation/`, `Assets/tests/integration/settings/`), smoke tests (`tests/smoke/`); plugin tests in `.opencode/plugins/tests/`
- Test assemblies: `InputUnitTests`, `InputIntegrationTests`, `SimulationUnitTests` (references `Overdrive.Simulation`, `Overdrive.Input`, `Unity.Mathematics`), `SimulationIntegrationTests` (references `Overdrive.Simulation`, `Overdrive.Input`), `MultiplayerUnitTests` (references `Overdrive.Multiplayer`, `Overdrive.Simulation`, `Unity.Mathematics`), `SettingsUnitTests` (references `Overdrive.Settings.Core`), `SettingsIntegrationTests` (references `Overdrive.Settings`, `Overdrive.Settings.Core`, `Overdrive.Input`, `Overdrive.Simulation`)
- Depends on: Node.js for plugin tests; Unity Test Framework for gameplay tests
- Used by: Plugin CI and game development validation

**Tooling Layer:**
- Purpose: Build utilities, MCP integrations, model assignment
- Location: `tools/`
- Contains: Aseprite MCP server (`tools/aseprite-mcp/`, git submodule), Blender MCP server (`blender-mcp` in `opencode.json`), Unity MCP server (`unityMCP` in `opencode.json`), Unity CLI pipeline MCP server (`unity-cli-pipeline` in `opencode.json`), model assignment utility (`tools/assign-models.js`), ksan animation parser (`tools/ksanim/`); MCP server definitions at root `.mcp.json`
- Depends on: Node.js, Python/uv (for Aseprite MCP), Blender (for Blender MCP), Unity Editor (for Unity MCP), Unity CLI pipeline package (for Unity CLI pipeline MCP)
- Used by: Asset pipeline, 3D asset workflow, Unity scene inspection, animation pipeline, Unity CLI commands, project tooling

**CortexKit Runtime Layer:**
- Purpose: Context management, PI extensions, and MCP connection configuration for CortexKit sessions
- Location: `.cortexkit/`, `.pi/`
- Contains: CortexKit runtime config (`.cortexkit/`), PI extensions (`.pi/extensions/` — 8 OCGS extension modules: audit, changelog, core, delegation, drift-detector, path-guard, question, validate), MCP server config (`.pi/mcp.json`), settings (`.pi/settings.json`)
- Depends: CortexKit runtime, `.agents/` (primary agent definitions), `.opencode/plugins/` (OpenCode lifecycle hooks)
- Used by: CortexKit sessions for agent orchestration, context management, and MCP tool routing

## Data Flow

**Skill Invocation Flow:**
1. User types `/command-name [args]` — OpenCode runtime
2. Command file resolved from `.agents/commands/` — command registry
3. Skill markdown loaded from `.agents/skills/` — skill loader
4. Agent spawned via Task tool (if skill requires delegation) — agent runtime
5. Agent reads relevant design docs, code, and context — file system
6. Agent produces draft output for user approval — collaboration protocol
7. User approves/rejects — user input
8. Files written/edited if approved — file system

**Design → Architecture → Implementation Pipeline:**
1. `/concept-brainstorm` — design skill produces game concept
2. `/map-systems` — design skill decomposes into systems
3. `/design-system` — design skill authors GDD sections
4. `/create-architecture` — architecture skill produces ADRs
5. `/architecture-review` — director gate validates technical feasibility
6. `/create-stories` — story skill decomposes into implementable stories
7. `/dev-story` — implementation skill writes code + tests
8. `/story-done` — completion skill validates acceptance criteria

## Key Abstractions

**Agent:**
- Purpose: A specialized role with defined responsibilities, delegation maps, and domain boundaries
- Location: `.agents/agents/[agent-name].md`
- Pattern: Markdown file with YAML frontmatter (description, mode, model, maxTurns) + structured sections (Key Responsibilities, Delegation Map, What This Agent Must NOT Do)

**Skill:**
- Purpose: A callable workflow triggered by a slash command, orchestrating one or more agents
- Location: `.agents/skills/[skill-name]/SKILL.md`
- Pattern: Markdown file with YAML frontmatter (description, user-invocable, allowed-tools) + phased steps with agent delegation

**Plugin:**
- Purpose: TypeScript code that hooks into OpenCode lifecycle events (file write, session start, etc.)
- Location: `.opencode/plugins/[plugin-name].ts`
- Pattern: Default export implementing `Plugin` interface from `@opencode-ai/plugin`

**GDD (Game Design Document):**
- Purpose: Authoritative specification for a single game system
- Location: `design/gdd/[system-slug].md`
- Pattern: Markdown with 8 required sections (Overview, Player Fantasy, Detailed Rules, Formulas, Edge Cases, Dependencies, Tuning Knobs, Acceptance Criteria)

**ADR (Architecture Decision Record):**
- Purpose: Captures a technical decision, context, and consequences
- Location: `docs/architecture/`
- Pattern: Markdown document following standard ADR format

**SimulationKernel:**
- Purpose: Canonical 14-step invocation spine that executes one fixed-duration tick. Each step is an injectable seam (`ISimulationPipelineStep`); the constructor enforces exactly 14 steps so a misconfigured pipeline fails fast.
- Location: `Assets/source/Simulation/SimulationKernel.cs`
- Pattern: Engine-free class in the `Overdrive.Simulation` assembly; captures one raw input sample per render frame and reuses it across ticks; executes steps in array order with early-exit on pause boundary

**SimulationStateMachine:**
- Purpose: Authoritative session lifecycle managing state transitions (Idle → Loading → Countdown → Racing → Paused → Finished → Results). Content and RSM cannot mutate simulation state directly — all mutations flow through this machine.
- Location: `Assets/source/Simulation/SimulationStateMachine.cs`
- Pattern: Implements `ISimulationStateGate` (read-only gate for the driver) and `ISimulationPhysicsFailureHandler`. Enforces legal transition graph, owns countdown, grid lock, retry hold, forfeit path, and terminal snapshot management. Raises events: `StateChanged`, `PausedStateChanged`, `ContentLoadRequested`, `ContentUnloadRequested`, `RaceAborted`, `LifecycleErrorRaised`

**INetworkSimulationDriver:**
- Purpose: Project-owned seam between the manual simulation accumulator and a future Beta real-time networking driver (ADR-0017 D2). MVP publishes the seam with NO provider implementation.
- Location: `Assets/source/Multiplayer/INetworkSimulationDriver.cs`
- Pattern: Interface in the engine-free `Overdrive.Multiplayer` assembly; 4 methods (`SubmitInputs`, `SerializeSnapshot`, `Rollback`, `GetPredictedInput`) plus `RemoteInputsReceived` event; driver is a guest of the manual accumulator — never calls `Physics.Simulate`, owns no `FixedUpdate`, never writes `SimulationState`

**SimulationRollbackState:**
- Purpose: Corrective kinematic state for all 16 simulated cars (positions, rotations, linear/angular velocities) captured pre-replay and restored by the rollback pipeline (ADR-0017 D4)
- Location: `Assets/source/Multiplayer/SimulationRollbackState.cs`
- Pattern: `readonly struct` with zero-allocation `Vector3Array16`/`QuaternionArray16` fixed-length wrappers (16 elements backed by 16 named fields, no heap allocation); elements copied at construction, source mutation does not alias wrapper

**SimulationDriver:**
- Purpose: Owns the manual fixed-step accumulator, drives the kernel spine once per render frame, and decorates published snapshots with authoritative counters.
- Location: `Assets/source/Simulation/SimulationDriver.cs`
- Pattern: Engine-free class; depends on injectable seams (`IFrameDeltaSource`, `IFrameInputCapture`, `IPreAccumulatorLifecycleHook`, `ISimulationStateGate`). Manages accumulator clamping (max 2 ticks), ghost recording and replay capture delegated to `GhostRecorderLifecycle`, performance-monitor integration, pause/resume/forfeit snapshot publication

**GhostRecorderLifecycle:**
- Purpose: Owns the MVP ghost-recorder and GO-boundary replay-capture lifecycle, concentrating the four integration points (lifecycle discard, pause-edge record, GO capture, continuous record) so the driver delegates instead of interleaving ghost bookkeeping with accumulator/counter logic.
- Location: `Assets/source/Simulation/GhostRecorderLifecycle.cs`
- Pattern: Engine-free sealed class; lifecycle rules per ADR-0008 — terminal states discard buffer, new-session transitions discard previous race and re-arm replay capture; `CaptureAtGo` fires once at GO before any continuous record; `RecordPauseEdge` records edge events without continuous samples; `RecordCompletedTick` appends one continuous record per Racing tick with post-increment index

**RenderInterpolator:**
- Purpose: Pure render interpolation math for the deferred LateUpdate visual pass. Stateless and engine-free.
- Location: `Assets/source/Simulation/RenderInterpolator.cs`
- Pattern: Static class; `ComputeAlpha` (remainder/FIXED_DT), `Interpolate` (lerp position via `math.lerp`, slerp rotation via `math.slerp` with valid-input precedence), `AdvanceVisualBuffers` (previous ← current ← completedStep)

**PerformanceMonitor:**
- Purpose: Manual-simulation FPS protection monitor. Measures display FPS only in Countdown/Racing and emits Reduced/Restored signals; requests a performance pause when FPS stays below 15 for 3 seconds after reduction.
- Location: `Assets/source/Simulation/PerformanceMonitor.cs`
- Pattern: Three-timer system (below-30, below-15, recovery) with `ThresholdSeconds = 3s`. Producer-only — never mutates `SimulationState` directly; sets `PendingPerformancePause` on the state machine via an injectable seam. State-change and resume hooks reset or preserve timers per ADR-0001

## Entry Points

**OpenCode Session:**
- Location: Project root, via OpenCode CLI
- Triggers: User runs `opencode` from project root
- Responsibilities: Load agents, skills, commands, plugins from config; route `/command` invocations

## Error Handling

**Strategy:** Fail-closed for safety-critical operations, advisory for creative decisions

- **Branch protection** (`ccgs-hooks.ts`): Blocks commits to protected branches (main, master, develop) with `git push` interception
- **Design section validation** (`ccgs-hooks.ts`): Warns when GDD files are missing required sections before allowing writes
- **Drift detection** (`drift-detector.ts`): Reports template drift severity (LOW/MEDIUM/HIGH) on file writes; does not block
- **Phase gates** (workflow): ADVISORY verdicts — guide but never hard-block progression; user always decides
- **Permission denials** (`opencode.json`): Deny rules for destructive commands (`rm -rf`, `git push --force`, `git reset --hard`, `.env` access)

## Cross-Cutting Concerns

**Logging:** Plugin audit logs written to `production/session-logs/agent-audit.log` via `ccgs-hooks.ts` logAudit function

**Caching:** No explicit caching layer. OpenCode runtime manages session context. `production/session-state/active.md` serves as a manual checkpoint.

**Storage:** File-based. All state persists as Markdown, YAML, or JSON files. No database. Unity assets are stored in `Assets/`; framework configuration (agents, skills, commands, rules) is stored in `.agents/`; plugins live in `.opencode/plugins/`.

**Coordination:** Vertical delegation (Directors → Leads → Specialists) with horizontal consultation allowed but non-binding. Conflict resolution escalates to shared parent or domain director.

**Model Tier Assignment:** Three tiers assigned per agent frontmatter — Lightweight (`opencode-go/deepseek-v4-flash`, simple read-only work), Default (`opencode-go/qwen3.6-plus`, implementation and analysis), High-stakes (`opencode-go/kimi-k2.6`, cross-system synthesis and gates).

**Code Generation Guardrails:** Agents must ask "May I write this to [filepath]?" before using Write/Edit tools. Multi-file changes require explicit approval. No commits without user instruction.
