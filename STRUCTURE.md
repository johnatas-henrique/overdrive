# Codebase Structure

## Directory Layout

```text
/
├── AGENTS.md                    # Master framework configuration and reference
├── opencode.json                # OpenCode config (plugins, MCP servers, permissions)
├── overdrive.slnx               # Unity solution file
├── Assembly-CSharp.csproj       # Unity C# project (auto-generated)
├── Assembly-CSharp-Editor.csproj# Unity Editor C# project (auto-generated)
├── README.md                    # Project overview and quick start guide
├── LICENSE                      # MIT license
├── .cortexkit/                  # CortexKit runtime configuration
├── .opencode/                   # OpenCode-specific configuration and runtime
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
│   ├── Scenes/                  # Unity scenes (SampleScene.unity)
│   ├── source/                  # Game C# source code and local rules
│   ├── Materials/               # Unity materials (CoplayTestRed, CoplayTestSphere)
│   ├── sprites/                 # Game sprites (currently empty — .gitkeep)
│   ├── Settings/                # URP render pipeline assets (Mobile, PC profiles)
│   ├── Screenshots/             # Test screenshots
│   ├── TutorialInfo/            # Unity template readme + editor scripts
│   │   ├── Readme.cs            # Readme ScriptableObject
│   │   └── Editor/ReadmeEditor.cs # Custom inspector for Readme
│   └── InputSystem_Actions.inputactions # Unity Input System action maps
├── ProjectSettings/             # Unity project settings (physics, audio, graphics, input, etc.)
├── Packages/                    # Unity package manifest (URP, Input System, AI Nav, Timeline, etc.)
├── design/                      # Game design documents
│   ├── AGENTS.md                # Design directory standards
│   └── registry/
│       └── entities.yaml        # Single source of truth for cross-GDD game-world facts
├── docs/                        # Technical documentation
│   ├── architecture/            # Architecture Decision Records + TR-ID registry
│   │   └── tr-registry.yaml     # Technical requirement ID persistence
│   ├── engine-reference/        # Curated engine API snapshots (version-pinned)
│   ├── framework/               # OCGS framework reference
│   │   ├── director-gates.md    # Shared review gate prompts
│   │   ├── agent-roster.md      # Full agent inventory with model tiers
│   │   ├── agent-coordination-map.md # Agent delegation relationships
│   │   ├── skills-reference.md  # All 75 skills cataloged by phase
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
│   ├── research/                # Research documents
│   ├── AGENTS.md                # Docs directory standards
│   ├── COLLABORATIVE-DESIGN-PRINCIPLE.md # User-driven collaboration model
│   ├── COPLAY.md                # Coplay integration notes
│   ├── WORKFLOW-GUIDE.md        # Workflow selection guide
│   ├── hybrid-workflow.md       # Hybrid workflow reference
│   ├── unity-tooling-plan.md    # Unity tooling integration plan
│   ├── workflow-transitions.md  # Workflow transition rules
│   ├── authoring-agents.md      # Agent creation guide
│   ├── authoring-skills.md      # Skill creation guide
│   └── CONTRIBUTING.md          # Framework contribution guide
├── tests/                       # Unity/C# gameplay test suites (created as needed)
├── tools/                       # Build and pipeline tools
│   ├── aseprite-mcp/            # Aseprite MCP server (Python/uv)
│   └── assign-models.js         # Model assignment utility
├── prototypes/                  # Throwaway prototypes (currently .gitkeep)
├── production/                  # Production management
│   ├── session-logs/            # Session audit trail
│   │   ├── agent-audit.log      # Plugin audit log
│   │   └── session-log.md       # Human-readable session log
│   └── session-state/           # Active session checkpoint
│       └── active.md            # Living state file
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
    │   ├── test.yml             # Test suite runner
    │   └── stale.yml            # Stale issue management
    ├── ISSUE_TEMPLATE/          # Issue templates
    ├── PULL_REQUEST_TEMPLATE.md # PR template
    └── dependabot.yml           # Dependabot config
```

## Directory Purposes

**`.cortexkit/`:**
- Purpose: CortexKit runtime configuration
- Contains: `.gitignore`, `magic-context/`

**`.opencode/`:**
- Purpose: OpenCode runtime configuration, agents, skills, commands, rules, and plugins
 - Contains: TypeScript plugins and OpenCode definitions
 - Key files: `plugins/ccgs-hooks.ts`, `plugins/drift-detector.ts`, `plugins/changelog-generator.ts`

**`Assets/`:**
- Purpose: Unity project assets — the actual game
- Contains: Scenes, C# scripts, materials, sprites, input actions, render pipeline settings
- Key files: `InputSystem_Actions.inputactions`, `Settings/PC_RPAsset.asset`, `TutorialInfo/Readme.cs`

**`design/`:**
- Purpose: Game design documentation and cross-system registries
- Contains: GDD standards, entity/formula registry
- Key files: `registry/entities.yaml`, `AGENTS.md`

**`docs/`:**
- Purpose: Technical documentation — architecture decisions, framework reference, workflow guides
- Contains: ADRs, engine API snapshots, OCGS framework docs, examples
- Key files: `framework/director-gates.md`, `framework/agent-roster.md`, `framework/skills-reference.md`, `framework/workflow-catalog.yaml`, `architecture/tr-registry.yaml`

**`tests/`:**
- Purpose: Unity/C# gameplay and integration tests
- Contains: Test suites created by the project's test setup workflow

**`tools/`:**
- Purpose: Build utilities and MCP integrations
- Contains: Aseprite MCP server, model assignment utility
- Key files: `aseprite-mcp/`, `assign-models.js`

**`production/`:**
- Purpose: Production management — session logs, audit trails, active state
- Contains: Session logs, agent audit log, session state checkpoint
- Key files: `session-logs/agent-audit.log`, `session-logs/session-log.md`, `session-state/active.md`

**`prototypes/`:**
- Purpose: Throwaway prototypes isolated from main source
- Contains: Placeholder (`.gitkeep`)

## Key File Locations

**Entry Points:**
- `opencode.json`: OpenCode session configuration — plugins, MCP, permissions
- `.github/workflows/conventional-commits.yml`: CI entry point for Conventional Commit validation

**Configuration:**
- `AGENTS.md`: Master framework configuration — technology stack, project structure, agent hierarchy, available commands
- `opencode.json`: Plugin loading, MCP server config, bash/read permissions
- `Packages/manifest.json`: Unity package dependencies (URP, Input System, AI Nav, etc.)
- `ProjectSettings/ProjectVersion.txt`: Unity version (6000.3.19f1)
- `dotnet-tools.json`: .NET tool manifest (csharpier)
- `.editorconfig`: Editor formatting rules

**Core Logic:**
- `.opencode/agents/[name].md`: Agent definitions (51 agents)
- `.opencode/skills/[name]/SKILL.md`: Skill workflows (75 skills)
- `.opencode/commands/[name].md`: Slash command routing (54 commands)
- `.opencode/plugins/ccgs-hooks.ts`: Primary lifecycle hooks plugin
- `.opencode/plugins/drift-detector.ts`: Template drift detection
- `.opencode/plugins/changelog-generator.ts`: Changelog generation

**Design Documents:**
- `design/registry/entities.yaml`: Cross-GDD entity/formula/constant registry
- `docs/architecture/tr-registry.yaml`: Technical requirement ID persistence
- `docs/registry/architecture.yaml`: Architecture registry data
- `docs/framework/workflow-catalog.yaml`: Phase definitions and artifact checks
- `docs/framework/director-gates.md`: Shared review gate prompts

**Tests:**
- `.opencode/plugins/tests/`: Plugin unit tests (11 test suites)

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

**New game C# script:** `Assets/source/[ScriptName].cs` — currently empty; follow Unity naming conventions, use PascalCase

**New Unity scene:** `Assets/Scenes/[SceneName].unity` — follow existing scene patterns

**New design document:** `design/gdd/[system-slug].md` — must include all 8 required sections per `design/AGENTS.md`

**New ADR:** `docs/architecture/[adr-title].md` — follow standard ADR format

**New test:** `tests/[category]/[test-name].test.mjs` — co-located with related validation code

**New CI workflow:** `.github/workflows/[workflow-name].yml` — follow existing workflow patterns

**Shared utilities:** `tools/` — JavaScript utilities used across tooling scripts (e.g., `tools/assign-models.js`)

**Prototypes:** `prototypes/[prototype-name]/` — throwaway experiments, isolated from `Assets/`
