# Codebase Structure

## Directory Layout

```text
/
├── AGENTS.md                    # Master framework configuration and reference
├── opencode.json                # OpenCode config (plugins, MCP servers, permissions)
├── overdrive.slnx               # Unity solution file
├── cog.toml                     # Cocogitto conventional commit config
├── Assembly-CSharp.csproj       # Unity C# project (auto-generated)
├── Assembly-CSharp-Editor.csproj# Unity Editor C# project (auto-generated)
├── README.md                    # Project overview and quick start guide
├── LICENSE                      # MIT license
├── .agents/                     # CortexKit agent mirror (copies of .opencode agents, commands, skills, rules)
├── .cortexkit/                  # CortexKit runtime configuration
├── .mcp.json                   # MCP server connection config (CortexKit)
├── .opencode/                   # OpenCode-specific configuration and runtime
├── .pi/                         # CortexKit PI runtime — extensions, MCP config, settings
│   ├── plugins/                 # TypeScript plugins
│   │   ├── ccgs-hooks.ts        # Branch protection, design validation, source checks
│   │   ├── drift-detector.ts    # Agent/skill template drift detection
│   │   ├── changelog-generator.ts # Conventional commit → CHANGELOG.md
│   │   ├── README.md            # Plugin architecture guide
│   │   └── tests/               # Plugin unit tests (11 test suites)
│   ├── agents/                   # OpenCode agent definitions
│   ├── skills/                   # OpenCode skill workflows
│   ├── commands/                # OpenCode slash commands
│   └── rules/                    # OpenCode path-scoped rules
├── Assets/                      # Unity project assets
│   ├── Scenes/                  # Unity scenes
│   ├── source/                  # Game C# source code — Overdrive.Input assembly and bootstrap
│   │   ├── Overdrive.Input.asmdef # Input assembly definition
│   │   ├── InputContextController.cs # Action-map context controller
│   │   ├── RawInputSample.cs     # Immutable raw input capture struct
│   │   ├── DeadZoneNormalizer.cs # Pure dead-zone normalization
│   │   ├── EmaBrakePriority.cs   # EMA brake-priority processor
│   │   ├── ControlProfile.cs      # Control profile definition
│   │   ├── SimulationInput.cs     # Simulation input struct
│   │   ├── TickProcessor.cs       # Tick-based input processor
│   │   ├── InputBindingCatalog.cs  # Input binding catalog
│   │   ├── ContextResumeEmaReinitializer.cs # Context-resume EMA reinitializer
│   │   ├── SchemeChangeEmaReinitializer.cs # Scheme-change EMA reinitializer
│   │   ├── SettingsInputPreviewEvaluator.cs # Settings input preview evaluator
│   │   ├── InputSystem_Actions.cs # Generated input action wrapper
│   │   ├── InputSystem_Actions.Extensions.cs # Generated action extensions
│   │   ├── InputSystem_Actions.inputactions # Unity Input System action maps
│   │   ├── InputSystemSettings.asset # Input system settings ScriptableObject
│   │   └── Editor/               # Input asset bootstrap editor script
│   │       ├── InputAssetBootstrap.cs # Input asset bootstrap
│   │       └── Overdrive.Input.Editor.asmdef # Editor assembly definition
│   ├── Prototype/               # In-editor prototype scripts and test assets
│   │   └── RaceFeel/            # RaceFeel prototype (car feel, camera, HUD, track)
│   │       ├── Materials/       # 3D materials (car, road, props)
│   │       ├── Meshes/          # FBX models (car, track props)
│   │       ├── Prefabs/         # Prefab assemblies
│   │       ├── Scenes/          # Unity scenes (RaceFeelPrototype.unity)
│   │       ├── Scripts/         # C# scripts (ArcadeCar, PrototypeCamera, etc.)
│   │       └── Textures/        # Textures (car livery, road, grass, etc.)
│   ├── Materials/               # Unity materials
│   ├── Plugins/                 # Unity native plugins
│   │   ├── NuGet/               # NuGet package cache
│   │   └── Roslyn/              # Roslyn C# compiler assemblies
│   ├── sprites/                 # Game sprites (currently empty — .gitkeep)
│   ├── Settings/                # URP render pipeline assets (Mobile, PC profiles)
│   ├── Screenshots/             # Test screenshots (currently empty)
│   ├── tests/                    # Unity test assemblies (EditMode, PlayMode)
│   │   ├── unit/                # Unit tests
│   │   │   └── input/           # Input system unit tests
│   │   └── integration/         # Integration tests
│   │       └── input/           # Input system integration tests
├── ProjectSettings/             # Unity project settings (physics, audio, graphics, input, etc.)
├── Packages/                    # Unity package manifest (URP, Input System, AI Nav, Timeline, etc.)
├── learning/                    # Agent learning system
│   ├── MISSION.md               # Learning system mission
│   ├── NOTES.md                 # Learning notes
│   ├── RESOURCES.md             # Learning resources
│   ├── assets/                  # Learning system assets (stylesheets)
│   ├── learning-records/        # Style conformance records
│   ├── lessons/                 # Generated lesson HTML files
│   └── reference/               # Reference images and palette analysis
├── design/                      # Game design documents
│   ├── AGENTS.md                # Design directory standards
│   ├── accessibility-requirements.md # Accessibility requirements (Standard tier)
│   ├── art/                     # Art bible, palettes, reference catalogs, prompts
│   │   ├── art-bible.md         # Art bible (core export)
│   │   ├── palette.css          # Color palette (CSS)
│   │   ├── palette.json         # Color palette (JSON)
│   │   ├── prompts/             # AI generation prompts
│   │   │   ├── character-dardan-driver.md
│   │   │   ├── character-may-driver-and-mechanic.md
│   │   │   ├── character-millions-grid-girl.md
│   │   │   ├── character-seimec-mechanic.md
│   │   │   ├── character-tyrant-mechanic.md
│   │   │   ├── character-zeroforce-grid-girl.md
│   │   │   ├── krea2-prompt-book.md
│   │   │   └── test-kit-01.md
│   │   ├── reference-catalog.md # Reference image catalog
│   │   ├── reference/           # Reference images and generated assets
│   │   ├── style-anchor-prompt.md # Style anchor prompt
│   │   └── typography.json      # Typography specs
│   ├── gdd/                     # Game Design Documents (one per system)
│   │   ├── game-concept.md      # Core identity, pitch, and creative brief
│   │   ├── reviews/             # Design review logs
│   │   │   ├── ai-rival-review-log.md
│   │   │   ├── audio-system-review-log.md
│   │   │   ├── camera-review-log.md
│   │   │   ├── car-definition-data-review-log.md
│   │   │   ├── content-pipeline-review-log.md
│   │   │   ├── fuel-system-review-log.md
│   │   │   ├── game-concept-review-log.md
│   │   │   ├── ghost-recording-review-log.md
│   │   │   ├── grid-start-review-log.md
│   │   │   ├── hud-review-log.md
│   │   │   ├── input-system-review-log.md
│   │   │   ├── multiplayer-architecture-review-log.md
│   │   │   ├── pit-stop-review-log.md
│   │   │   ├── qualifying-review-log.md
│   │   │   ├── race-session-manager-review-log.md
│   │   │   ├── settings-review-log.md
│   │   │   ├── simulation-architecture-review-log.md
│   │   │   ├── tire-system-review-log.md
│   │   │   ├── track-system-review-log.md
│   │   │   ├── ui-menu-review-log.md
│   │   │   ├── vehicle-physics-review-log.md
│   │   │   └── vfx-review-log.md
│   │   ├── ai-rival.md
│   │   ├── audio-system.md
│   │   ├── camera.md
│   │   ├── car-definition-data.md
│   │   ├── content-pipeline.md
│   │   ├── fuel-system.md
│   │   ├── gdd-cross-review-2026-07-25.md
│   │   ├── gdd-cross-review-2026-07-26.md
│   │   ├── gdd-cross-review-2026-07-26-v2.md
│   │   ├── gdd-cross-review-2026-07-26-v3.md
│   │   ├── gdd-cross-review-2026-08-01.md
│   │   ├── ghost-recording.md
│   │   ├── grid-start.md
│   │   ├── hud.md
│   │   ├── input-system.md
│   │   ├── multiplayer-architecture.md
│   │   ├── pit-stop.md
│   │   ├── qualifying.md
│   │   ├── race-session-manager.md
│   │   ├── settings.md
│   │   ├── simulation-architecture.md
│   │   ├── systems-index.md
│   │   ├── tire-system.md
│   │   ├── track-system.md
│   │   ├── ui-menu.md
│   │   ├── vehicle-physics.md
│   │   └── vfx.md
│   ├── assets/                    # Asset specifications and manifests
│   │   ├── asset-manifest.md     # Master asset manifest
│   │   └── specs/                # Per-asset specification docs
│   │       ├── pit-building-assets.md
│   │       ├── team_tier1_a-car-assets.md
│   │       ├── team_tier1_b-car-assets.md
│   │       ├── team_tier1_c-car-assets.md
│   │       ├── team_tier1_d-car-assets.md
│   │       ├── team_tier2_a-car-assets.md
│   │       ├── team_tier2_b-car-assets.md
│   │       ├── team_tier2_c-car-assets.md
│   │       ├── team_tier2_d-car-assets.md
│   │       ├── team_tier3_a-car-assets.md
│   │       ├── team_tier3_b-car-assets.md
│   │       ├── team_tier3_c-car-assets.md
│   │       ├── team_tier3_d-car-assets.md
│   │       ├── team_tier4_a-car-assets.md
│   │       ├── team_tier4_b-car-assets.md
│   │       ├── team_tier4_c-car-assets.md
│   │       ├── team_tier4_d-car-assets.md
│   │       ├── track-monaco-assets.md
│   │       ├── track-monza-assets.md
│   │       ├── track-silverstone-assets.md
│   │       ├── track-spa-assets.md
│   │       └── trackside-shared-assets.md
│   ├── player-journey.md         # Player journey and progression design
│   ├── registry/
│   │   └── entities.yaml        # Single source of truth for cross-GDD game-world facts
│   ├── reviews/
│   │   └── cross-gdd-consistency-report.md # Cross-GDD consistency analysis
│   └── ux/                       # UX design documents
│       ├── car-selection.md      # Car selection screen UX
│       ├── finished-presentation.md # Race finish presentation UX
│       ├── interaction-patterns.md # Interaction patterns and controls
│       ├── loading.md            # Loading screen UX
│       ├── pause-menu.md         # Pause menu UX
│       ├── qualifying-not-started.md # Pre-qualifying screen UX
│       ├── qualifying-results.md  # Qualifying results screen UX
│       ├── race-hud.md           # Race HUD layout and behavior
│       ├── results.md            # Race results screen UX
│       ├── reviews/              # UX review logs
│       │   └── ux-review-2026-08-01.md
│       ├── settings.md           # Settings menu UX specification
│       ├── track-selection.md    # Track selection screen UX
│       └── ui-menu.md            # UI menu system design
├── docs/                        # Technical documentation
│   ├── architecture/            # Architecture Decision Records, reviews, traceability
│   │   ├── adr-0001-manual-simulation-authority-and-determinism-boundary.md
│   │   ├── adr-0002-vehicle-physics-implementation-pattern.md
│   │   ├── adr-0003-content-pipeline-and-addressables.md
│   │   ├── adr-0004-settings-persistence-and-control-profiles.md
│   │   ├── adr-0005-input-context-controller-and-action-map-inventory.md
│   │   ├── adr-0006-fuel-tire-state-ownership-and-tick-timing.md
│   │   ├── adr-0007-track-spline-format.md
│   │   ├── adr-0008-ghost-recording-data-format-and-mvp-buffer.md
│   │   ├── adr-0009-ai-rival-deterministic-architecture.md
│   │   ├── adr-0010-camera-vfx-rendering-budget-and-interpolation.md
│   │   ├── adr-0011-pit-stop-architecture.md
│   │   ├── adr-0012-audio-system-architecture.md
│   │   ├── adr-0013-qualifying-session-format.md
│   │   ├── adr-0014-hud-data-contract-and-layout.md
│   │   ├── adr-0015-car-definition-data-validation.md
│   │   ├── adr-0016-multiplayer-sdk-deferral-and-boundary.md
│   │   ├── adr-0017-network-simulation-driver-interface-and-beta-canonical-state-model.md
│   │   ├── adr-0018-race-session-manager-authority.md
│   │   ├── adr-0019-ui-presentation-screen-flow-and-navigation.md
│   │   ├── architecture-review-2026-07-27.md
│   │   ├── architecture-review-2026-07-28-v5.md
│   │   ├── architecture-review-2026-07-28-v6.md
│   │   ├── architecture-review-2026-07-28.md
│   │   ├── architecture-review-2026-08-01.md
│   │   ├── architecture-review-2026-08-05-v2.md
│   │   ├── architecture-review-2026-08-05-v3.md
│   │   ├── architecture-review-2026-08-05-v4.md
│   │   ├── architecture-review-2026-08-05.md
│   │   ├── architecture-review-2026-08-06.md
│   │   ├── architecture-traceability.md
│   │   ├── architecture.md          # Master architecture doc
│   │   ├── change-impact-2026-08-01-adr-sync.md
│   │   ├── change-impact-2026-08-05-vehicle-physics.md
│   │   ├── complete-traceability-matrix.md
│   │   ├── control-manifest.md
│   │   ├── tr-registry.yaml         # Technical requirement ID persistence
│   │   ├── traceability-index.md
│   │   └── traceability-matrix.md
│   ├── agents/                   # Agent documentation
│   │   ├── domain.md             # Domain context for agents
│   │   ├── issue-tracker.md      # Issue tracking conventions
│   │   └── triage-labels.md     # Triage label definitions
│   ├── engine-reference/        # Curated engine API snapshots (version-pinned)
│   │   ├── super-monaco-gp-teams.md
│   │   ├── godot/                # Godot engine reference
│   │   ├── unity/                # Unity engine reference
│   │   └── unreal/               # Unreal engine reference
│   ├── framework/               # OCGS framework reference
│   │   ├── director-gates.md    # Shared review gate prompts
│   │   ├── agent-roster.md      # Full agent inventory with model tiers
│   │   ├── agent-coordination-map.md # Agent delegation relationships
│   │   ├── skills-reference.md  # All 157 skills cataloged by phase
│   │   ├── coordination-rules.md # Agent delegation and conflict resolution
│   │   ├── coding-standards.md  # Code review and testing standards
│   │   ├── directory-structure.md # Canonical directory layout
│   │   ├── technical-preferences.md # Project tech config (populated by /setup-engine)
│   │   ├── workflow-catalog.yaml # Phase definitions and artifact checks
│   │   ├── context-management.md
│   │   ├── hooks-reference.md
│   │   ├── hybrid-workflow.md
│   │   ├── quick-start.md
│   │   ├── review-workflow.md
│   │   ├── rules-reference.md
│   │   ├── setup-requirements.md
│   │   └── templates/           # Document templates (GDDs, ADRs, specs)
│   ├── examples/                # Session examples and workflow case studies
│   ├── registry/                # Architecture registry
│   │   └── architecture.yaml    # Architecture registry data
│   ├── plans/                   # Project plans and handoff docs
│   │   ├── asr-car-import-pipeline.md
│   │   ├── benetton-b189-animation-inventory.md
│   │   ├── benetton-b189-asset-pipeline-pilot.html
│   │   ├── benetton-b189-driver-animation-mapping.md
│   │   └── overdrive-handoff-2026-07-24.md
│   ├── research/                # Research documents
│   │   ├── coherence-architecture-verification-2026-08-05.md
│   │   ├── multiplayer-networking-comparison-2026.md
│   │   ├── mvp-performance-baseline-2026-07.md
│   │   ├── unity-mcp-landscape-2026-07-16.md
│   │   └── unity-packages-evaluation-2026-08.html
│   ├── AGENTS.md                # Docs directory standards
│   ├── tech-debt-register.md    # Technical debt tracking
│   ├── COLLABORATIVE-DESIGN-PRINCIPLE.md # User-driven collaboration model
│   ├── COPLAY.md                # Coplay integration notes
│   ├── WORKFLOW-GUIDE.md        # Workflow selection guide
│   ├── hybrid-workflow.md       # Hybrid workflow reference
│   ├── unity-tooling-plan.md    # Unity tooling integration plan
│   ├── workflow-transitions.md  # Workflow transition rules
│   ├── authoring-agents.md      # Agent creation guide
│   ├── authoring-skills.md      # Skill creation guide
│   └── CONTRIBUTING.md          # Framework contribution guide
├── tests/                       # Root test scaffolding (see Assets/tests/ for actual tests)
│   ├── EditMode/                # Edit-mode test scaffold
│   │   └── README.md
│   ├── PlayMode/                # Play-mode test scaffold
│   │   └── README.md
│   ├── unit/                    # Unit test scaffold (currently empty)
│   ├── integration/             # Integration test scaffold (currently empty)
│   ├── smoke/                   # Smoke tests
│   │   └── critical-paths.md
│   └── evidence/                # Test evidence and artifacts (currently empty)
├── tools/                       # Build and pipeline tools
│   ├── aseprite-mcp/            # Aseprite MCP server (Python/uv)
│   ├── assign-models.js         # Model assignment utility
│   └── ksanim/                  # Ksan animation parser (Python)
├── prototypes/                  # Throwaway prototypes
│   └── race-feel/               # RaceFeel prototype documentation
├── production/                  # Production management
│   ├── gate-checks/             # Quality gate check results
│   │   ├── concept-to-systems-design.md
│   │   ├── pre-production-to-production-2026-08-09.md
│   │   └── technical-setup-to-pre-production-2026-07-28.md
│   ├── session-logs/            # Session audit trail
│   │   ├── agent-audit.log      # Plugin audit log
│   │   └── session-log.md       # Human-readable session log
│   ├── session-state/           # Active session checkpoint
│   │   └── active.md            # Living state file
│   ├── epics/                    # Feature epics and stories
│   │   ├── index.md             # Epic index
│   │   ├── content-pipeline/    # Content pipeline epic
│   │   ├── ghost-recording/     # Ghost recording epic
│   │   ├── input-system/        # Input system epic (8 fused stories)
│   │   ├── multiplayer-architecture/ # Multiplayer architecture epic
│   │   ├── settings/            # Settings epic
│   │   └── simulation-kernel/   # Simulation kernel epic
│   ├── milestones/             # MVP/alpha/beta milestone definitions
│   │   ├── alpha.md
│   │   ├── beta.md
│   │   └── mvp.md
│   ├── qa/                     # QA playtest reports
│   │   ├── qa-plan-sprint-1-2026-08-08.md
│   │   ├── qa-signoff-sprint-1-2026-08-09.md
│   │   ├── smoke-2026-08-09.md
│   │   └── playtests/           # Playtest session reports
│   │       └── playtest-2026-08-05-thawane.md
│   ├── sprints/                # Sprint plans and status
│   │   ├── sprint-1.md
│   │   └── sprint-1-retrospective.md
│   ├── sprint-status.yaml      # Current sprint status
│   ├── stage.txt                # Current production stage
│   └── review-mode.txt          # Review mode state flag
├── dotnet-tools.json            # .NET tool manifest (csharpier)
├── .editorconfig                # Editor formatting rules
├── .gitattributes               # Git attributes (line endings, binary handling)
├── .gitignore                   # Git ignore rules
├── .gitmodules                  # Git submodule config (aseprite-mcp)
├── .vscode/                     # VS Code configuration
│   ├── extensions.json          # Recommended extensions
│   ├── launch.json              # Debug launch configurations
│   └── settings.json            # Workspace settings
└── .github/                     # GitHub configuration
    ├── workflows/               # CI pipelines
    │   ├── opencode.yml         # OpenCode CI
    │   ├── opencode-review.yml  # OpenCode review
    │   ├── conventional-commits.yml # Conventional Commit validation (Cocogitto)
    │   ├── tests.yml            # Test suite CI pipeline
    │   └── stale.yml            # Stale issue management
    ├── ISSUE_TEMPLATE/          # Issue templates
    ├── PULL_REQUEST_TEMPLATE.md # PR template
    └── dependabot.yml           # Dependabot config
```

## Directory Purposes

**`.agents/`:**
- Purpose: CortexKit agent mirror — copies of `.opencode/` agents, commands, skills, and rules for CortexKit runtime consumption
- Contains: `agents/`, `commands/`, `skills/`, `rules/` (mirrors `.opencode/` structure)

**`.cortexkit/`:**
- Purpose: CortexKit runtime configuration
- Contains: `.gitignore`, `magic-context/historian/`

**`.pi/`:**
- Purpose: CortexKit PI runtime — extensions, MCP server config, and settings
- Contains: `extensions/` (8 OCGS extension modules), `mcp.json` (MCP server connections), `settings.json` (runtime settings)

**`.opencode/`:**
- Purpose: OpenCode runtime configuration, agents, skills, commands, rules, and plugins
 - Contains: TypeScript plugins and OpenCode definitions
 - Key files: `plugins/ccgs-hooks.ts`, `plugins/drift-detector.ts`, `plugins/changelog-generator.ts`

**`Assets/`:**
- Purpose: Unity project assets — the actual game
- Contains: Scenes, C# scripts, materials, sprites, input actions, render pipeline settings
- Key files: `InputSystem_Actions.inputactions`, `Settings/PC_RPAsset.asset`, `source/Overdrive.Input.asmdef`

**`learning/`:**
- Purpose: Agent learning system — style conformance records, generated lessons, and reference analysis
- Contains: Mission statement, learning notes, resources, generated lesson HTML files, style conformance records, reference images and palette analysis
- Key files: `MISSION.md`, `NOTES.md`, `RESOURCES.md`, `learning-records/0001-style-and-conformance.md`, `lessons/0001-style-conformance-and-verification.html`, `reference/check-image-palette.py`

**`design/`:**
- Purpose: Game design documentation, art bible, asset specs, UX design, cross-system registries, and cross-GDD consistency analysis
- Contains: GDDs (`design/gdd/`), art bible and palettes (`design/art/`), asset specifications (`design/assets/`), UX design (`design/ux/`), quick specs (`design/quick-specs/`), entity/formula registry, design standards, cross-GDD reviews
- Key files: `gdd/game-concept.md`, `art/art-bible.md`, `assets/asset-manifest.md`, `ux/race-hud.md`, `quick-specs/camera-chase-velocity-direction-2026-08-05.md`, `registry/entities.yaml`, `AGENTS.md`, `reviews/cross-gdd-consistency-report.md`

**`docs/`:**
- Purpose: Technical documentation — architecture decisions, agent documentation, framework reference, workflow guides, research
- Contains: ADRs (19 total), architecture reviews, traceability matrices, agent documentation, engine API snapshots, OCGS framework docs, examples, plans, research
- Key files: `architecture/architecture.md`, `architecture/control-manifest.md`, `architecture/tr-registry.yaml`, `agents/domain.md`, `agents/issue-tracker.md`, `agents/triage-labels.md`, `framework/director-gates.md`, `framework/agent-roster.md`, `framework/skills-reference.md`, `framework/workflow-catalog.yaml`, `plans/asr-car-import-pipeline.md`, `research/multiplayer-networking-comparison-2026.md`, `research/coherence-architecture-verification-2026-08-05.md`

**`tests/`:**
- Purpose: Unity/C# gameplay and integration tests
- Contains: EditMode and PlayMode test directories, unit tests, integration tests, smoke tests, and test evidence

**`tools/`:**
- Purpose: Build utilities and MCP integrations
- Contains: Aseprite MCP server, Blender MCP server, model assignment utility, ksan animation parser
- Key files: `aseprite-mcp/`, `assign-models.js`, `ksanim/parse_ksanim.py`

**`production/`:**
- Purpose: Production management — session logs, audit trails, active state, quality gate checks, feature epics and stories, QA playtest reports, sprint plans, milestone definitions
- Contains: Session logs, agent audit log, session state checkpoint, gate checks, feature epics with stories, QA playtest reports, review mode state, sprint plans, milestone definitions
- Key files: `session-logs/agent-audit.log`, `session-logs/session-log.md`, `session-state/active.md`, `gate-checks/concept-to-systems-design.md`, `gate-checks/pre-production-to-production-2026-08-09.md`, `gate-checks/technical-setup-to-pre-production-2026-07-28.md`, `epics/index.md`, `epics/input-system/story-001-input-action-asset-context-controller.md`, `stage.txt`, `review-mode.txt`, `sprint-status.yaml`, `sprints/sprint-1.md`, `milestones/mvp.md`

**`prototypes/`:**
- Purpose: Throwaway prototypes isolated from main source
- Contains: `race-feel/` (race feel prototype documentation)
- Key files: `race-feel/REPORT.md`, `race-feel/engine-data.md`, `race-feel/README.md`, `race-feel/tuning-panel-reference.html`

## Key File Locations

**Entry Points:**
- `opencode.json`: OpenCode session configuration — plugins, MCP, permissions
- `.github/workflows/conventional-commits.yml`: CI entry point for Conventional Commit validation

**Configuration:**
- `AGENTS.md`: Master framework configuration — technology stack, project structure, agent hierarchy, available commands
- `opencode.json`: Plugin loading, MCP server config, bash/read permissions
- `.mcp.json`: MCP server connections for CortexKit runtime
- `.pi/settings.json`: CortexKit PI runtime settings
- `.pi/mcp.json`: CortexKit MCP server overrides
- `Packages/manifest.json`: Unity package dependencies (URP, Input System, AI Nav, etc.)
- `ProjectSettings/ProjectVersion.txt`: Unity version (6000.3.19f1)
- `dotnet-tools.json`: .NET tool manifest (csharpier)
- `.editorconfig`: Editor formatting rules

**Core Logic:**
- `.opencode/agents/[name].md`: Agent definitions (51 agents, mirrored at `.agents/`)
- `.opencode/skills/[name]/SKILL.md`: Skill workflows (157 skills)
- `.opencode/commands/[name].md`: Slash command routing (53 commands)
- `.opencode/rules/[name].md`: Path-scoped coding rules (11 rules, mirrored at `.agents/rules/`)
- `.opencode/plugins/ccgs-hooks.ts`: Primary lifecycle hooks plugin
- `.opencode/plugins/drift-detector.ts`: Template drift detection
- `.opencode/plugins/changelog-generator.ts`: Changelog generation

**Design Documents:**
- `design/gdd/` — Game Design Documents, one per system
- `design/gdd/game-concept.md` — Core identity, pitch, and creative brief
- `design/gdd/reviews/` — Design review logs (one per GDD)
- `design/accessibility-requirements.md` — Accessibility requirements (Standard tier)
- `design/player-journey.md` — Player journey and progression design
- `design/art/art-bible.md` — Art bible (core export)
- `design/art/reference-catalog.md` — Reference image catalog
- `design/assets/asset-manifest.md` — Master asset manifest
- `design/ux/race-hud.md` — Race HUD UX specification
- `design/ux/ui-menu.md` — UI menu system design
- `design/quick-specs/` — Quick specifications for validated findings (camera chase velocity, track Suzuka validation)
- `design/registry/entities.yaml`: Cross-GDD entity/formula/constant registry
- `design/reviews/cross-gdd-consistency-report.md`: Cross-GDD consistency analysis
- `docs/architecture/architecture.md`: Master architecture document
- `docs/architecture/control-manifest.md`: Control manifest
- `docs/architecture/adr-0001-manual-simulation-authority-and-determinism-boundary.md`: ADR on manual simulation authority
- `docs/architecture/adr-0002-vehicle-physics-implementation-pattern.md` through `adr-0015-car-definition-data-validation.md`: 14 ADRs (0002-0015)
- `docs/architecture/adr-0016-multiplayer-sdk-deferral-and-boundary.md`: ADR on online services deferral
- `docs/architecture/adr-0017-network-simulation-driver-interface-and-beta-canonical-state-model.md`: ADR on network simulation driver
- `docs/architecture/adr-0018-race-session-manager-authority.md`: ADR on race session manager authority
- `docs/architecture/adr-0019-ui-presentation-screen-flow-and-navigation.md`: ADR on UI presentation screen flow
- `docs/architecture/tr-registry.yaml`: Technical requirement ID persistence
- `docs/architecture/complete-traceability-matrix.md`: Full traceability matrix
- `docs/architecture/architecture-traceability.md`: Architecture traceability
- `docs/architecture/architecture-review-2026-08-05.md` through `architecture-review-2026-08-06.md`: Architecture review reports
- `docs/registry/architecture.yaml`: Architecture registry data
- `docs/framework/workflow-catalog.yaml`: Phase definitions and artifact checks
- `docs/framework/director-gates.md`: Shared review gate prompts
- `docs/plans/asr-car-import-pipeline.md`: ASR car import pipeline plan
- `docs/plans/benetton-b189-animation-inventory.md`: Benetton B189 animation inventory
- `docs/plans/benetton-b189-asset-pipeline-pilot.html`: Benetton B189 asset pipeline pilot (HTML)
- `docs/plans/benetton-b189-driver-animation-mapping.md`: Benetton B189 driver animation mapping
- `docs/plans/overdrive-handoff-2026-07-24.md`: Project handoff plan
- `docs/tech-debt-register.md`: Technical debt tracking register

**Tests:**
- `.opencode/plugins/tests/`: Plugin unit tests (11 test suites)
- `Assets/tests/unit/input/`: Input system unit tests (EmaBrakePriorityTests.cs, SchemeArbitrationTests.cs)
- `Assets/tests/integration/input/`: Input system integration tests (InputContextControllerTests.cs, RawCaptureDeadZoneTests.cs, ContextTransitionsTests.cs, SettingsConfigurationTests.cs, SpecialRoutingTests.cs, TickProcessorTests.cs)

## Naming Conventions

**Agent files:** `[role-name].md` — lowercase, hyphen-separated (e.g., `creative-director.md`, `gameplay-programmer.md`)

**Skill directories:** `[skill-name]/SKILL.md` — lowercase, hyphen-separated (e.g., `concept-brainstorm/SKILL.md`, `design-system/SKILL.md`)

**Command files:** `[command-name].md` — matches skill directory name (e.g., `concept-brainstorm.md` → `skills/concept-brainstorm/SKILL.md`)

**Module directories:** `[theme-name]/` — lowercase, hyphen-separated (e.g., `engine-unity/`, `level-design/`)

**GDD files:** `[system-slug].md` — lowercase, hyphen-separated (e.g., `movement-system.md`, `combat-system.md`)

**Unity C# files:** PascalCase (e.g., `Readme.cs`, `ReadmeEditor.cs`)

**Unity assets:** PascalCase with spaces allowed (e.g., `DefaultVolumeProfile.asset`, `PC_RPAsset.asset`)

**Plugin files:** kebab-case TypeScript (e.g., `ccgs-hooks.ts`, `drift-detector.ts`)

## Where to Add New Code

**New agent:** `.opencode/agents/[agent-name].md` — follow frontmatter template in `docs/authoring-agents.md`

**New skill:** `.opencode/skills/[skill-name]/SKILL.md` — follow workflow template in `docs/authoring-skills.md`, add command file in `.opencode/commands/[skill-name].md`

**New OpenCode plugin:** `.opencode/plugins/[plugin-name].ts` — implement `Plugin` interface from `@opencode-ai/plugin`, register in `opencode.json` plugin array

**New game C# script:** `Assets/source/[ScriptName].cs` — follow Unity naming conventions, use PascalCase; group under `Overdrive.Input` assembly for input-system code

**New Unity scene:** `Assets/Scenes/[SceneName].unity` — follow existing scene patterns

**New design document:** `design/gdd/[system-slug].md` — must include all 8 required sections per `design/AGENTS.md`

**New ADR:** `docs/architecture/[adr-title].md` — follow standard ADR format

**New test:** `tests/[category]/[test-name].cs` (Unity) or `tests/[category]/[test-name].test.mjs` (plugin) — follow existing test patterns in the relevant subdirectory

**New CI workflow:** `.github/workflows/[workflow-name].yml` — follow existing workflow patterns (e.g., `tests.yml` for test suites)

**Shared utilities:** `tools/` — JavaScript utilities used across tooling scripts (e.g., `tools/assign-models.js`)

**Prototypes:** `prototypes/[prototype-name]/` — throwaway experiments, isolated from `Assets/`
