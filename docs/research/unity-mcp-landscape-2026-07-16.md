# Unity Editor MCP — Landscape Survey (July 16, 2026)

> **Research-only document.** No code was modified, no dependencies installed.
> All data gathered from primary sources: GitHub repos (README, releases, license files, package manifests),
> npm registries, official documentation, and published articles.
> Date of last verification: **2026-07-16**.

---

## Scope

Non-official MCP (Model Context Protocol) servers that integrate AI agents with the Unity Editor.
Excluded:

- **Official Unity AI Assistant** (`com.unity.ai.assistant`) — requires Unity AI subscription (credits-based).
- **Bezi** — proprietary, credit-based subscription ($20–$200/mo).
- **Aura for Unity** — commercial product from the same maker as CoplayDev.
- Forks without meaningful differentiation (listed but not counted as independent).
- Tools that require Unity AI subscription or paid tiers to function.

---

## Tier 1 — Mature or Promising, Actively Maintained Candidates

### 1. CoplayDev/unity-mcp (MCP for Unity)

| Field | Value |
|---|---|
| **Repository** | <https://github.com/CoplayDev/unity-mcp> |
| **Stars** | ~12,500 |
| **License** | **MIT** |
| **Latest release** | [v10.1.0](https://github.com/CoplayDev/unity-mcp/releases/tag/v10.1.0) (2026-07-13) |
| **Releases** | 65 |
| **Contributors** | 70 |
| **Language** | C# (Unity package) + Python (MCP server) |
| **Homepage** | <https://coplaydev.github.io/unity-mcp/> |
| **Sponsor** | Aura (the same org offers a commercial product, but this is MIT free) |

**Architecture:**

```
MCP Client → uvx (Python stdio/streamableHttp) → Unity Editor package (socket/HTTP)
```

The Unity side is a UPM package installed via git URL or OpenUPM. The MCP server is a Python process launched by `uvx` (`mcp-for-unity`). Communication between the Python server and Unity happens via a local socket/HTTP bridge.

- **Transport:** stdio (default), streamableHttp, HTTP.
- **Auto-configuration:** Window → MCP for Unity → Configure All Detected Clients writes config entries for Claude Code, Cursor, VS Code, Windsurf, Cline, Gemini CLI, OpenCode, etc.
- **Multi-instance:** Supported vía multi-instance routing (separate ports).

**Supported clients:** Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, Cline, Gemini CLI, OpenCode, GitHub Copilot, Codex CLI.

**Unity compatibility:** 2021.3 LTS → 6.x.

**Capabilities (47 tool entrypoints):**
- Asset management, scene control, script editing, physics, profiling (14 actions incl. frame timing, memory queries), build system, graphics pipeline, camera, animation, UI canvas, multi-instance routing, tool groups (vfx/animation/ui/testing), Roslyn script validation, remote-hosted server with auth, asset generation (v10).

**Notable:** The oldest and most popular Unity MCP. Backed by an academic publication (SIGGRAPH Asia 2025 Technical Communications). Active Discord community. Full documentation site.

**Limitations:** 47 entrypoints is fewer than some competitors; relies on `uv` + Python (adds dependency); uvx cold start adds latency on first call.

**Security:** Mutations opt-in; all operations go through Unity's Undo system. Python server runs locally.

**Install complexity:** Low. UPM install + `uv` setup + client config (auto-configured).

**Lock-in risk:** None (MIT, no cloud dependency, BYO AI client).

**Verdict:** ✅ Best pick for most projects. Largest community, most battle-tested, MIT license, wide client support.

---

### 2. IvanMurzak/Unity-MCP (AI Game Developer)

| Field | Value |
|---|---|
| **Repository** | <https://github.com/IvanMurzak/Unity-MCP> |
| **Stars** | ~3,500 |
| **License** | **Apache 2.0** |
| **Latest release** | [0.84.1](https://github.com/IvanMurzak/Unity-MCP/releases/tag/0.84.1) (2026-07-15) |
| **Releases** | 176 |
| **Contributors** | 30 |
| **Language** | C# (Unity plugin) + TypeScript/ASP.NET (MCP Server) |
| **Homepage** | <https://ai-game.dev> |

**Architecture:**

```
MCP Client → stdio/streamableHttp → ASP.NET Core MCP Server → SignalR (port 20000–29999, deterministic per project) → Unity Plugin
```

- **Transport:** stdio (default) or streamableHttp.
- **Server binary:** Auto-downloaded from GitHub releases to `Library/mcp-server/{platform}/`, started via `[InitializeOnLoad]`.
- **Unique:** Attribute-based tool registration (`[AiTool]`, `[AiPrompt]`, `[AiResource]`) — any C# method becomes an MCP tool with one line.
- **Runtime support:** Works inside compiled game builds (not just Editor). Enables runtime AI debugging and player-AI interaction.
- **CLI tool:** `npx unity-mcp-cli` for headless install/setup.

**Supported clients:** Claude, Claude Code, Cursor, Windsurf, Gemini, GitHub Copilot, any MCP client.

**Unity compatibility:** 2022.3+ (Editor + Runtime).

**Capabilities (70+ tools across 4 categories):**
- Project & Assets (16+), Scene & Hierarchy (23+), Scripting & Editor (11+), Skills auto-generation based on OS, Unity version, installed plugins.
- Docker deployment supported.
- Code-signing for macOS/Windows executables (v0.80.1+).
- Custom MCP Tools, Resources, Prompts via attributes.

**Unique differentiator:** Works in **compiled game builds** — not just the Editor. Useful for runtime AI.

**Security:** Token-based auth between server and plugin. Cryptographically random URL-safe token. Transport-level security.

**Install complexity:** Low–Medium. UPM/OpenUPM/unitypackage install → auto-downloads server binary. CLI option for headless.

**Lock-in risk:** Very low (Apache 2.0, no cloud dep, BYO AI).

**Verdict:** ✅ Best if you need runtime AI or maximum tool count per tool. Attribute-based registration makes extensibility trivial. Active development (166 releases).

---

### 3. CoderGamester/mcp-unity (MCP Unity Editor)

| Field | Value |
|---|---|
| **Repository** | <https://github.com/CoderGamester/mcp-unity> |
| **Stars** | ~1,830 |
| **License** | **MIT** |
| **Latest release** | [1.3.0](https://github.com/CoderGamester/mcp-unity/releases/tag/1.3.0) (2026-04-26) |
| **Releases** | 8 |
| **Contributors** | 30 |
| **Language** | C# (Unity package) + TypeScript (Node.js MCP server) |

**Architecture:**

```
MCP Client → stdio → Node.js MCP Server (TypeScript) → WebSocket → Unity Editor (C#)
```

- **Transport:** stdio (default via Node.js).
- **IDE integration:** Adds Unity `Library/PackedCache` to workspace for VSCode-like IDEs.
- **Server Window:** Tools → MCP Unity → Server Window for monitoring.
- **Relative path support** for MCP configs that get committed to git.
- **One-click configure** for Cursor, Claude Code, Codex CLI, OpenCode, GitHub Copilot, Google Antigravity.

**Supported clients:** Cursor, Windsurf, Claude Desktop, Claude Code, Codex CLI, GitHub Copilot, Google Antigravity, OpenCode.

**Unity compatibility:** Unity 6+.

**Capabilities:**
- Scene/GameObject/component management, asset operations, prefabs, screenshots, scripts, profiler (8 tools), editor/console, reflection/types, package manager, testing, batch execution.

**Notable:** Strong IDE focus. Large contributor base (30). Website docs.

**Limitations:** Unity 6+ only (no 2021/2022 LTS). Node.js 18+ required. WebSocket bridge adds complexity.

**Security:** WebSocket local connection.

**Install complexity:** Medium. UPM install + Node.js + npm install in Server directory + WebSocket start.

**Lock-in risk:** Low (MIT).

**Verdict:** ✅ Good for Unity 6+ projects and IDE-focused workflows. Broad client support.

---

### 4. FunplayAI/funplay-unity-mcp

| Field | Value |
|---|---|
| **Repository** | <https://github.com/funplayai/funplay-unity-mcp> |
| **Stars** | ~98 at the time of the final source check |
| **License** | **MIT** |
| **Latest release** | [v0.5.1](https://github.com/funplayai/funplay-unity-mcp/releases/tag/v0.5.1) (2026-07-13) |
| **Releases** | 31 |
| **Contributors** | 2 |
| **Language** | C# (98.7%) |

**Architecture:**

```
MCP Client → HTTP JSON-RPC 2.0 → Unity Editor (in-process HTTP server on 127.0.0.1:8765)
```

- **Transport:** HTTP (direct in-process), experimental Broker Mode (Mono subprocess for domain reload resilience).
- **One-click config** for Claude Code, Cursor, LM Studio, VS Code, Kiro, Trae, Codex.
- **Tool profiles:** `core` (29 tools) and `full` (91 tools across 20 modules), according to the current README.

**Supported clients:** Claude Code, Cursor, LM Studio, Windsurf, Codex, VS Code Copilot, any MCP client.

**Unity compatibility:** The README states Unity 2022.3 or later; the repository badge also advertises Unity 6000.0+.

**Capabilities (91 tools, 20 modules):**
- `execute_code` (Roslyn-first in-memory C# execution with undo/redo support via `IFunnyplayCommand`).
- Play mode automation: enter, simulate keyboard/mouse input, capture screenshots, inspect logs, exit.
- Input simulation (`simulate_key_press`, `simulate_mouse_click`, `simulate_mouse_drag`).
- Prompts (`fix_compile_errors`, `runtime_validation`, `create_playable_prototype`).
- Resources (project context, scene summaries, selection state, compile errors, console).
- 91 tools: scene editing, assets, scripts, play mode, screenshots, performance, structured object location, SerializedObject component editing, menu-item fallback.

**Unique:** `execute_code` is the heart — Roslyn-first, no files written to disk, full Unity API surface. IFunplayCommand template provides auto-Undo.

**Security:** Client-side approval for `execute_code`. Safety defaults adjustable.

**Install complexity:** Low. UPM install → Funplay → MCP Server starts automatically.

**Lock-in risk:** None (MIT).

**Verdict:** ✅ Strong candidate for projects that need `execute_code` flexibility and play-mode validation loops. It is newer and has a smaller contributor base, so it should be validated before becoming the only automation path.

---

## Tier 2 — Notable but Lower Adoption

### 5. AnkleBreaker-Studio/unity-mcp-server

| Field | Value |
|---|---|
| **Repository** | <https://github.com/AnkleBreaker-Studio/unity-mcp-server> |
| **Plugin** | <https://github.com/AnkleBreaker-Studio/unity-mcp-plugin> |
| **Stars** | ~317 (server) + ~132 (plugin) |
| **License** | **AnkleBreaker Open License v1.0** (see notes) |
| **Latest release** | [v2.30.0](https://github.com/AnkleBreaker-Studio/unity-mcp-server/releases/tag/v2.30.0) (2026-06-04) |
| **Releases** | 16 |
| **Contributors** | 6 |
| **Language** | JavaScript (Node.js server) + C# (Unity plugin) |

**Architecture:**

```
MCP Client → stdio → Node.js MCP Server → HTTP → Unity Editor Plugin (HTTP API)
                                     ↕
                               Unity Hub CLI
```

- **Transport:** stdio.
- **Two-tier lazy loading** for Claude Cowork tool limits.
- **Multi-instance auto-discovery** (multiple running Editors).
- **Multi-agent session tracking + queuing.**

**Supported clients:** Claude Desktop, Claude Cowork (optimized), Cursor, Windsurf, any MCP client.

**Unity compatibility:** 2021.3 LTS+.

**Capabilities (288 tools, 30+ categories):**
- Scene hierarchy (full tree + pagination), GameObjects, components, builds, profiling, Shader Graph, Amplify Shader Editor, terrain, physics (raycasts, overlap), NavMesh (bake, agents, obstacles), particle systems, animation, MPPM multiplayer, Unity Hub control (install editors/modules), project context (custom docs for AI agents), port resilience (identity validation + crash detection).
- Non-blocking editor (background operation).

**License caveats:**
- **Attribution required:** "Made with AnkleBreaker MCP" must appear in any product built with it (personal/educational exempt).
- **Resale prohibited:** Cannot sell, sublicense, or commercially distribute the tool itself.
- Early commits used MIT; later changed to the custom open license.
- Not OSI-approved open source (custom terms).

**Security:** HTTP bridge local. Multi-agent isolation.

**Install complexity:** Medium. UPM install (plugin) + Node.js 18+ + npm install + Unity Hub path config.

**Lock-in risk:** Medium (custom license with attribution requirement; resale restriction).

**Verdict:** ⚠️ Highest tool count but custom license creates friction. The attribution requirement may conflict with some commercial projects. If tool breadth is critical and license is acceptable, viable. Otherwise, CoplayDev or IvanMurzak cover 90% of these use cases with standard open-source licenses.

---

### 6. isuzu-shiranui/UnityMCP

| Field | Value |
|---|---|
| **Repository** | <https://github.com/isuzu-shiranui/UnityMCP> |
| **Stars** | ~139 |
| **License** | **MIT** |
| **Version** | 2.1.0 |
| **Language** | C# (Unity) + TypeScript (Node.js) |

**Architecture:**

```
MCP Client → stdio → unity-mcp-ts (Node.js) → HTTP → Unity Editor (McpHttpServer :27182-27199)
                                                      ↕ UDP broadcast (:27183)
```

- **Transport:** stdio (MCP) → HTTP (Unity).
- **UDP auto-discovery** for multi-Editor support.
- **Dual surface:** MCP (Claude) + HTTP (curl/scripts/CI).
- **Domain reload resilience** via SessionState port persistence.
- **Built-in code execution** (Roslyn `/execute_code`).

**Supported clients:** Claude Desktop, Claude Code, any MCP client + curl.

**Unity compatibility:** 2022.3–Unity 6.1.

**Capabilities:**
- Health endpoint, hierarchy browser, inspect (read/write components), screenshots (Game/Scene/Editor panels), console logs, play mode control, plugin handler architecture (`IMcpCommandHandler`/`IMcpResourceHandler`/`BasePromptHandler`), idempotency classification (Safe/Unsafe with no-retry guarantee).

**Unique:** UDP auto-discovery for multi-Editor; idempotency safety guarantees; curl-accessible HTTP surface for CI/CD.

**Security:** Idempotency per-action classification prevents double-execution.

**Install complexity:** Low–Medium. UPM install → auto-starts HTTP server. Node.js server optional (needed only for MCP, not for curl).

**Lock-in risk:** None (MIT).

**Verdict:** ✅ Solid niche pick for multi-Editor workflows and CI/CD integration. Small but well-architected.

---

### 7. emeryporter/UnityMCP

| Field | Value |
|---|---|
| **Repository** | <https://github.com/emeryporter/UnityMCP> |
| **Stars** | ~8 |
| **License** | **GPL-3.0** |
| **Last push** | 2026-04-18 |
| **Language** | C# (60.6%), C (34.5%) — native C plugin |

**Architecture:**

```
MCP Client ← HTTP → Unity Editor (native C plugin hosts HTTP server in-process)
```

- **100% Unity-native** — no Node.js, Python, or sidecar processes.
- Native C plugin survives domain reloads.
- HTTP server on `localhost:8080`.

**Supported clients:** Claude Code, Claude Desktop, Codex, Cursor.

**Unity compatibility:** 2022.3+.

**Capabilities (51 tools, 23 resources, 6 resource templates, 4 prompts, 4 recipes):**
- GameObjects, tests, builds, scenes, Canvas UI, input actions, checkpoints, vision capture (screenshots), scene diagnostics, remote access (TLS + API key), activity log.

**Unique:** Zero external dependencies. Remote access with TLS+API key.

**Security:** TLS for remote access, API key auth. Per-action safety hints.

**Install complexity:** Low. UPM install only.

**Lock-in risk:** Medium (GPL-3.0 — copyleft may affect licensing of game code). Small community.

**Verdict:** ⚠️ Architecturally interesting (100% native, no sidecars) but GPL-3.0 license, low stars, and last push 3 months ago raise concerns for new projects.

---

## Tier 3 — Small, Niche, or Prototype-Stage

### 8. quazaai/UnityMCPIntegration (Quaza AI)

| Field | Value |
|---|---|
| **Repository** | <https://github.com/quazaai/UnityMCPIntegration> |
| **Stars** | ~155 |
| **License** | **MIT** |
| **Language** | TypeScript (Node.js) + C# (Unity) |

**Architecture:** WebSocket bridge between Unity plugin and Node.js MCP server.
**Tools:** 6 basic tools (editor state, scene info, game objects, execute C#, logs, verify connection) + filesystem tools.
**Analysis:** Very limited tool set compared to Tier 1. Filesystem tools suggest focus on file operations, not rich Editor automation. Low activity.

**Verdict:** ❌ Too basic for production game development.

---

### 9. ozankasikci/unity-editor-mcp

| Field | Value |
|---|---|
| **Repository** | <https://github.com/ozankasikci/unity-editor-mcp> |
| **Stars** | ~31 |
| **License** | **MIT** |
| **Last push** | 2026-05-12 |
| **npm** | `unity-editor-mcp` (~7 weekly downloads) |

**Architecture:** Unity UPM package + npm server. Server starts automatically on port 6400.
**Tools (62 across 11 categories):** Editor operations, control/automation (tags, layers, selection, windows, tools, compilation monitoring), screenshots, scene management, GameObjects, components, assets, prefabs, scripts, profiling, testing, materials/shaders, reflection.
**Install:** `npx unity-editor-mcp@latest` (zero-install client side).
**Analysis:** Decent tool count. Single maintainer. npm distribution is convenient. Low adoption.

**Verdict:** ⚠️ Viable small option, but single-maintainer risk.

---

### 10. youichi-uda/unity-mcp-pro-plugin (Unity MCP Pro)

| Field | Value |
|---|---|
| **Repository** | <https://github.com/youichi-uda/unity-mcp-pro-plugin> |
| **Stars** | ~61 |
| **License** | **MIT** (plugin only — server binary is behind website/itch.io distribution) |
| **Language** | C# (Unity) + TypeScript (Node.js) |

**Architecture:** WebSocket (Unity plugin) ← → Node.js MCP server (separate download).
**Tools:** 280+ across 50 categories (claimed).
**Pricing:** The Unity plugin is MIT on GitHub. The MCP server requires downloading from <https://unity-mcp.abyo.net/> or itch.io — the model appears to be source-available with the server distributed as a package (the README says "source code included" but lists "Lifetime updates" on itch.io).
**Analysis:** Ambiguous licensing model. The plugin is MIT but the server's distribution model is unclear. High tool count claims (280+) similar to AnkleBreaker.

**Verdict:** ⚠️ Excluded from Tier 1 due to ambiguous commercial model. Do not use without clarifying server licensing.

---

### 11. mattebin/reify

| Field | Value |
|---|---|
| **Repository** | <https://github.com/mattebin/reify> |
| **License** | **Apache 2.0** |
| **Language** | .NET 8 (C# server) + Unity Editor package |

**Architecture:** .NET 8 MCP server → HTTP (127.0.0.1:17777) → Unity Editor HttpListener bridge.
**Tools:** 259 tools.
**Unique:** ADR-enforced write receipts (every write returns `{field, before, after}`), spatial proofs (anchor-proven claims), contract self-check, LLM reports UI.
**Limitations:** Unity 6000.4.3f1 only (one version battle-tested). No installer polish. `execute_code` not yet implemented.
**Verdict:** ⚠️ Research/verifiability-focused prototype. Too early for production but architecture ideas are solid. Watch for maturity.

---

### 12. Ozymandros/Unity-MCP-Server

| Field | Value |
|---|---|
| **Repository** | <https://github.com/Ozymandros/Unity-MCP-Server> |
| **License** | Not specified (proprietary?) |
| **Latest** | v3.2.1 (2026-03-22) |

**Architecture:** Pure .NET (no Unity dependencies). MCP over stdio. Generates .meta sidecars on disk.
**Purpose:** Offline project scaffolding — works without Unity running.
**Tools:** Project scaffolding, scene authoring, typed asset saving (.meta generation), C# validation, UPM packages, UI/nav/input/animation/VFX/physics tools, recipes.
**Tests:** 117 tests.
**Verdict:** ❌ Not for real-time Editor control. Useful as a CI/CD companion or for headless project generation, but not a replacement for in-Editor MCP.

---

### 13. Other small projects

| Repository | Stars | License | Notes |
|---|---|---|---|
| <https://github.com/Singtaa/UnityMCP> | 7 | MIT | 71 tools, Node.js server, auto-start. Last push 2026-03. |
| <https://github.com/ChiR24/Unity_MCP> | 7 | MIT | Visual Scripting integration. Last push ~2026-02. |
| <https://github.com/NishantJLU/Unity-MCP> | 10 | MIT | 26 tools, "Pro" branding but MIT. Last push 2026-06-04. |
| <https://github.com/WeberNik/UnityMCP-Public> | 2 | MIT | 26+ tools, XR/multi-project. Last push 2026-02. |
| <https://github.com/coolmew/Unity-MCP> | 2 | MIT | Basic. Last push 2026-03-11 (initial and only). |
| <https://github.com/sandraschi/unity3d-mcp> | 3 | MIT | VRM/VRChat focused. FastMCP Python. Niche. |

**Verdict:** All prototype-stage or very niche. Not recommended for new projects without significant evaluation.

---

## Forks (NOT counted as independent options)

| Fork | Upstream | Stars | Notes |
|---|---|---|---|
| <https://github.com/MaansenV/mcp-unity> | CoderGamester/mcp-unity | 1 | Production reliability fixes |
| <https://github.com/zhaowei2021/mcp-unity> | CoderGamester/mcp-unity | — | Chinese translation/docs |
| <https://github.com/VM233/unity-mcp-server> | AnkleBreaker-Studio | 0 | Clean fork, no differentiation |
| <https://github.com/SABERBOY/unity-mcp-server> | AnkleBreaker-Studio | — | Mirror |
| <https://github.com/Sandersm90/unity-mcp-pro-plugin> | youichi-uda | 0 | Fork |

---

## Excluded (paid/subscription-gated)

| Name | URL | Reason |
|---|---|---|
| **Unity AI Assistant** | <https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.7/> | Requires Unity AI subscription (credits-based); Unity 6+ |
| **Bezi** | <https://www.bezi.com/> | Proprietary, $20–$200/mo credit-based subscription |
| **Aura for Unity** | <https://www.coplay.dev/> | Commercial product (same org as CoplayDev/unity-mcp) |

---

## Comparison Matrix (Tier 1 only)

| Aspect | CoplayDev | IvanMurzak | CoderGamester | FunplayAI |
|---|---|---|---|---|
| **Stars** | ~12,500 | ~3,500 | ~1,830 | ~98 |
| **License** | MIT | Apache 2.0 | MIT | MIT |
| **Latest release** | 2026-07-13 | 2026-06-12 | 2026-04-26 | 2026-07-13 |
| **Release cadence** | Very high | Very high | Moderate | High |
| **Min Unity** | 2021.3 LTS | 2022.3 | 6+ | 2022.3+* |
| **Runtime support** | ❌ | ✅ | ❌ | ❌ |
| **External deps** | Python (`uv`) | Auto-downloaded binary | Node.js | None (HTTP in-process) |
| **Tool count** | 47 entrypoints | 70+ | ~77 | 91 (full) / 29 (core) |
| **Domain reload** | Handled | Handled | WebSocket reconnects | Experimental Broker Mode |
| **Multi-instance** | ✅ | ❌ | ❌ | ❌ |
| **Multi-agent** | ❌ | ❌ | ❌ | ❌ |
| **Play mode sim** | Limited | Limited | Limited | Full loop + input sim |
| **`execute_code`** | Limited | Via tools | Via tools | Roslyn-first (core feature) |
| **Screenshots** | ✅ | ✅ | ✅ | ✅ |
| **CLI/headless** | ❌ | ✅ (`npx unity-mcp-cli`) | ❌ | ❌ |
| **Docker** | ❌ | ✅ | ❌ | ❌ |

---

## Recommendations

### For a new project starting today

1. **Default shortlist candidate — CoplayDev/unity-mcp**
   - Largest community, most battle-tested, MIT license, broad client support.
   - 65 releases over 16 months show sustained maintenance.
    - 47 entrypoints keep the tool surface smaller than the broadest competitors; usefulness still needs hands-on validation.
   - Python dependency (`uv`) is the main friction point.

2. **If you need runtime AI in built games — IvanMurzak/Unity-MCP**
   - The only option that works in compiled game builds (not just Editor).
   - Attribute-based tool registration makes extensibility trivial.
   - Apache 2.0, active (166 releases), auto-downloaded server binary.
   - Higher tool count but ASP.NET Core server is heavier.

3. **If you value in-process simplicity and `execute_code` — FunplayAI/funplay-unity-mcp**
   - No external runtime (HTTP in-process). Install and go.
    - `execute_code` with Roslyn + auto-Undo is its defining capability; comparative polish cannot be established without testing.
   - Play mode automation with input simulation is unique.
    - Newer project with a smaller contributor base; release activity alone is not proof of maturity.

4. **If your project is Unity 6+ only and IDE-integration is key — CoderGamester/mcp-unity**
   - 30 contributors, strong IDE integration features.
   - WebSocket bridge is reliable but adds complexity.
   - No support for Unity 2021/2022 LTS.

### Risk matrix

| Risk | CoplayDev | IvanMurzak | CoderGamester | FunplayAI |
|---|---|---|---|---|
| Abandonment | Low | Low | Low | Medium (2 contributors) |
| License change | Low (MIT) | Low (Apache 2.0) | Low (MIT) | Low (MIT) |
| Breaking changes | Low (semver) | Low (semver, many releases) | Low | Medium (pre-1.0) |
| Cloud dependency | None | None | None | None |
| External dep rot | Medium (Python ecosystem) | Low (self-contained binary) | Medium (Node.js) | None |

---

## Verification gaps

The following could not be verified from primary sources alone and would require hands-on testing:

1. **Actual tool quality** — tool count ≠ useful tools. Many "288 tools" may be granular wrappers.
2. **Domain reload resilience** — some claim it, but behavior varies in practice.
3. **`execute_code` sandbox safety** — some implementations use Roslyn with no sandbox; rely on client-side approval.
4. **Multi-instance correctness** — claimed by some, race conditions unknown.
5. **Performance overhead** — HTTP vs WebSocket vs in-process latency not benchmarked.
6. **FunplayAI's tool counts and minimum Unity version** — the current README says 91 tools/29 core tools and Unity 2022.3+, while the repository badge advertises Unity 6000.0+; this should be checked against the exact package revision selected for installation.
7. **youichi-uda/unity-mcp-pro-plugin** — the MCP server binary's actual licensing terms could not be fully determined from primary sources.

---

## Sources consulted

- GitHub repositories: README, LICENSE, releases, package manifests, commit history.
- <https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.7/> — Official Unity AI Assistant docs (for exclusion reference).
- <https://unity.com/blog/unity-ai-mcp-how-to-get-started> — Unity blog on MCP.
- <https://github.com/CoplayDev/unity-mcp/releases>
- <https://github.com/IvanMurzak/Unity-MCP/releases>
- <https://github.com/CoderGamester/mcp-unity/releases>
- <https://github.com/funplayai/funplay-unity-mcp/releases>
- <https://github.com/AnkleBreaker-Studio/unity-mcp-server/releases>
- <https://github.com/AnkleBreaker-Studio/unity-mcp-plugin/blob/main/LICENSE>
- <https://github.com/mattebin/reify>
- <https://github.com/Ozymandros/Unity-MCP-Server>
- <https://www.npmjs.com/package/unity-editor-mcp>
- <https://www.npmjs.com/package/anklebreaker-unity-mcp>
- <https://coplaydev.github.io/unity-mcp/>
- <https://ai-game.dev/>
- <https://unity-mcp.abyo.net/>
- <https://bezi.com/pricing> (for exclusion reference)
- <https://docs.bezi.com/account/plans> (for exclusion reference)
- <https://dl.acm.org/doi/10.1145/3757376.3771417> — SIGGRAPH Asia 2025 paper on MCP-Unity
- <https://chatforest.com/reviews/game-development-mcp-servers/> — April 2026 survey
- <https://dev.to/pneumetron/unity-mcp-bridging-ai-assistants-with-unity-for-automated-game-development-297l> — July 2026 overview
