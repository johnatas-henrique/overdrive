# Story 001: Dev Compile Guard

> **Epic**: Dev Tools
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/dev-tools.md`
**Requirement**: `TR-DVT-006`
_Tree-shaken in production via `__DEV__` guard — entire class tree and its imports must not appear in production bundle._

**ADR Governing Implementation**: ADR-0009: Dev Tools Architecture
**ADR Decision Summary**: HTML overlay, `SceneInstrumentation`, `__DEV__` guard (Vite `define` + dead-code elimination), read-only on all systems, lazy init on first F1 press.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No post-cutoff APIs used. `SceneInstrumentation` is imported from `@babylonjs/core`. Vite `define` substitution is standard — no engine-specific risk.

**Control Manifest Rules (this layer)**:

- **Required** (D3-D4): `SceneInstrumentation` for metrics; `engine.onEndFrameObservable` for refresh
- **Required** (D1, F21): HTML overlay behind `__DEV__` guard (`import.meta.env.DEV` dynamic import)
- **Forbidden** (D-F4): Never statically import Dev Infra from production code — always dynamic `import()`
- **Guardrail** (D-G1): Zero bytes in production build (tree-shaken by `__DEV__` guard)

---

## Acceptance Criteria

_From GDD `design/gdd/dev-tools.md`, scoped to this story:_

- [ ] AC-1a: `__DEV__` evaluates to `true` during `vite dev`
- [ ] AC-1b: `__DEV__` evaluates to `false` during `vite build`
- [ ] AC-8: Production bundle contains zero matches for `DevTools`, `dev-tools`, or `SceneInstrumentation`

---

## Implementation Notes

_Derived from ADR-0009 Implementation Guidelines:_

1. **`__DEV__` substitution**: Vite's `define` replaces `__DEV__` with `false` in production. The minifier eliminates dead code. Configuration in `vite.config.ts`:
   ```typescript
   define: {
     __DEV__: JSON.stringify(process.env.NODE_ENV !== "production"),
   }
   ```
2. **Module entry point** (`src/core/dev-tools/index.ts`): All Dev Tools code is guarded by `if (__DEV__) { ... }`. The file's top-level exports are tree-shakeable wrappers:
   ```typescript
   if (__DEV__) {
     const devTools = new DevTools();
     pipeline.register("dev-tools", (dt) => devTools.update(dt), 9);
   }
   ```
3. **Dynamic import pattern** (Control Manifest D-F4): Production code imports Dev Tools via dynamic `import()` gated on `import.meta.env.DEV`, not a static import. This ensures the bundler can fully tree-shake the module in production.
4. **Verification**: After `vite build`, run a grep across all output JS files:
   ```bash
   grep -r "DevTools\|dev-tools\|SceneInstrumentation" dist/ && echo "FAIL: Dev Tools found in production build" || echo "PASS: Clean build"
   ```

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 002]: Input keybinds — F1/F2 handling and `event.preventDefault()`
- [Story 003]: HTML overlay DOM creation, metrics display, `SceneInstrumentation` usage, `onEndFrameObservable` setup
- [Stories 004-008]: Individual data source panels (Config tree, Event Bus, GSM, Snapshot, AI Telemetry)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1a**: `__DEV__` is true in dev
  - Given: a source file containing `if (__DEV__) { const x: DevTools = ...; }`
  - When: the file is compiled with Vite in development mode (`import.meta.env.DEV = true`)
  - Then: the DevTools import code remains in the output
  - Edge cases: ensure the guard doesn't block other development-only features

- **AC-1b**: `__DEV__` is false in build
  - Given: a source file containing `if (__DEV__) { const x: DevTools = ...; }`
  - When: the file is compiled with Vite in production mode (`import.meta.env.DEV = false`)
  - Then: the `if`-block is eliminated (dead code)

- **AC-8**: bundle grep returns zero
  - Given: a production build output at `dist/`
  - When: I grep for strings `"DevTools"`, `"dev-tools"`, and `"SceneInstrumentation"` across all JS files
  - Then: zero matches are found for each string

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/dev-tools/dev-compile-guard_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: Story 002, Story 003, Stories 004-008
