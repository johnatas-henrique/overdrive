# Architecture

## Pattern Overview

**Overall:** Plugin-based agent orchestration framework with tiered delegation

**Key Characteristics:**
- 51 specialized agents organized in a 3-tier hierarchy (Directors → Leads → Specialists)
- 75 skills (slash commands) routed through themed modules
- 3 OpenCode TypeScript plugins for lifecycle hooks, drift detection, and changelog generation
- User-driven collaboration model — agents draft and propose, user decides

## Layers

**OCGS Framework Layer:**
- Purpose: Game development process orchestration — design, architecture, stories, QA, release
- Location: `.opencode/`
- Contains: Agent definitions (`.opencode/agents/`), skill workflows (`.opencode/skills/`), slash commands (`.opencode/commands/`), coding rules (`.opencode/rules/`)
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
- Depends on: Unity 6 (6000.3.19f1), URP 17.3.0, Input System 1.19.0, AI Navigation 2.0.14
- Used by: Unity Editor, build pipeline

**Design Layer:**
- Purpose: Game design documentation — entity/formula registry, design standards
- Location: `design/`
- Contains: Entity/formula registry (`design/registry/entities.yaml`), design standards (`design/AGENTS.md`)
- Depends on: OCGS design skills (`/design-system`, `/quick-design`, `/ux-design`)
- Used by: Architecture skills, story creation, implementation validation

**Testing Layer:**
- Purpose: Plugin tests and future Unity/C# gameplay tests
- Location: `tests/`
- Contains: Plugin tests in `.opencode/plugins/tests/` and future game tests
- Depends on: Node.js for plugin tests; Unity Test Framework for gameplay tests
- Used by: Plugin CI and game development validation

**Tooling Layer:**
- Purpose: Build utilities, MCP integrations, model assignment
- Location: `tools/`
- Contains: Aseprite MCP server (`tools/aseprite-mcp/`, git submodule), model assignment utility (`tools/assign-models.js`)
- Depends on: Node.js, Python/uv (for Aseprite MCP)
- Used by: Asset pipeline and project tooling

## Data Flow

**Skill Invocation Flow:**
1. User types `/command-name [args]` — OpenCode runtime
2. Command file resolved from `.opencode/commands/` — command registry
3. Skill markdown loaded from `.opencode/skills/` — skill loader
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
- Location: `.opencode/agents/[agent-name].md`
- Pattern: Markdown file with YAML frontmatter (description, mode, model, maxTurns) + structured sections (Key Responsibilities, Delegation Map, What This Agent Must NOT Do)

**Skill:**
- Purpose: A callable workflow triggered by a slash command, orchestrating one or more agents
- Location: `.opencode/skills/[skill-name]/SKILL.md`
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

**Storage:** File-based. All state persists as Markdown, YAML, or JSON files. No database. Unity assets are stored in `Assets/`; framework configuration is stored in `.opencode/`.

**Coordination:** Vertical delegation (Directors → Leads → Specialists) with horizontal consultation allowed but non-binding. Conflict resolution escalates to shared parent or domain director.

**Model Tier Assignment:** Three tiers — Haiku (read-only/simple), Sonnet (implementation/default), Opus (multi-document synthesis/high-stakes gates). Assigned per skill in frontmatter.

**Code Generation Guardrails:** Agents must ask "May I write this to [filepath]?" before using Write/Edit tools. Multi-file changes require explicit approval. No commits without user instruction.
