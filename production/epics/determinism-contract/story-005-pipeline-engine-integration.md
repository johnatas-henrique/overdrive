# Story 005: Pipeline Engine Integration

> **Epic**: Determinism Contract
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/determinism-contract.md`
**Requirements**: `TR-DET-007`, `TR-DET-006`

**ADR Governing Implementation**: ADR-0002: Fixed Timestep & Determinism Pipeline
**ADR Decision Summary**: Pipeline driven from `engine.runRenderLoop()`, NOT `scene.onBeforeRenderObservable` (re-entrancy guard + scene independence). Accumulator logic lives inside the render loop callback. Havok auto-step suppressed via scene-level monkey-patch. 8 NO-OP placeholder slots registered for slots 2–8 (filled by future epic systems). Slot 1 reserved for Input.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW (INTEGRATION — thin wrapper, no Babylon API dependence beyond runRenderLoop/getDeltaTime)
**Engine Notes**: `engine.runRenderLoop(callback)` and `engine.stopRenderLoop(callback)` are stable since Babylon.js v4.x. `engine.getDeltaTime()` returns seconds since last frame. Havok `(scene as any)._advancePhysicsEngineStep` is a private API — the cast is documented and necessary; no public API exists in Babylon.js 9.12 to disable physics auto-step after `enablePhysics()`.

**Control Manifest Rules (this layer)**:

- Required: F11 — Pipeline in `engine.runRenderLoop()` — NOT in `scene.onBeforeRenderObservable`
- Required: F17 — Havok: `scene.enablePhysics()` IS called; auto-step suppressed via `(scene as any)._advancePhysicsEngineStep = () => {}`
- Forbidden: F-F10 — Never register pipeline in `scene.onBeforeRenderObservable`
- Forbidden: F-F11 — Never skip `scene.enablePhysics()`
- Guardrail: F-G2 — Pipeline overhead < 0.001ms per tick

---

## Acceptance Criteria

_From GDD `design/gdd/determinism-contract.md`, scoped to this story:_

- [ ] AC-1: `PipelineRuntime.attach(engine)` installs the fixed-tick callback into `engine.runRenderLoop()`.
- [ ] AC-2: Given a mock engine returning `getDeltaTime() = 1/60` and a spy on `activeScene.render()` — `pipeline.executeTick()` is called once per render-loop invocation and `activeScene.render()` is called exactly once.
- [ ] AC-3: Mock engine `getDeltaTime() = 1/60` — `pipeline.executeTick()` is called exactly once per frame (normal condition, 1 tick).
- [ ] AC-4: Mock engine `getDeltaTime() = 5/60` — `pipeline.executeTick()` is called exactly 4 times (cap) and the accumulator is clamped for spiral-of-death protection.
- [ ] AC-5: `detach()` removes the render-loop callback via `engine.stopRenderLoop()` — subsequent render loop invocations do not call `pipeline.executeTick()`.
- [ ] AC-6: `suppressHavokAutoStep(scene)` sets `(scene as any)._advancePhysicsEngineStep` to a no-op function (confirmed by calling it — no error, no physics step).
- [ ] AC-7: 7 NO-OP placeholder slots are registered for slots 2–8 (to be filled by future epic systems). Slot 1 is reserved for Input. Each placeholder logs a dev-mode warning when ticked.
- [ ] AC-8: `attach()` called twice without `detach()` is a no-op — the second call does not re-install the callback. `getCurrentTick()` continues incrementing normally.

---

## Implementation Notes

_Derived from ADR-0002 Implementation Guidelines:_

- `PipelineRuntime` class:
  ```typescript
  interface IPipelineRuntime {
    attach(engine: Engine, activeScene: () => Scene): void;
    detach(): void;
    suppressHavokAutoStep(scene: Scene): void;
  }
  ```
- **attach() logic**:
  1. If already attached (`_attached === true`), return immediately (no-op).
  2. Set `_attached = true`.
  3. Call `engine.runRenderLoop(loopCallback)`.
  4. Loop callback: `accumulator += engine.getDeltaTime()`, run accumulator function, call `pipeline.executeTick(FIXED_DT)` in a for-loop for `ticks` iterations, call `activeScene.render()`.
- **detach() logic**:
  1. Call `engine.stopRenderLoop(loopCallback)`.
  2. Set `_attached = false`.
- **Havok suppression** is a standalone utility function called once after `scene.enablePhysics()` — it does NOT belong in `attach()`. The Physics epic calls it during init.
- **Placeholder registration**: After creating the pipeline, call `register()` for slots 2–8 with a function that logs `[Pipeline] Slot N (systemName) — no system registered yet` in dev mode. Slot 1 is left empty for the Input epic.
- **Accumulator state** lives inside `PipelineRuntime` — a single `number` field `_accumulator`.
- File location: `src/foundation/determinism/pipeline-runtime.ts`.
- Import from Babylon.js: `Engine` type, `Scene` type, `runRenderLoop`/`stopRenderLoop` methods. This is the ONLY file in the Determinism module that imports Babylon.js.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 002]: FixedUpdatePipeline — the pipeline class itself (pure TypeScript, no Babylon imports)
- [Story 004]: Fixed Timestep Accumulator — the pure math `accumulate()` function
- Actual Physics system slot, AI slot, Collision slot, etc. — these are filled by their respective epics
- `scene.enablePhysics()` call — belongs to the Physics/Handling epic (ADR-0008)
- The two-scene architecture (`activeScene` management) — belongs to Asset Manager epic (ADR-0003)

---

## QA Test Cases

**AC-1: attach installs callback**

- Given: A `PipelineRuntime` instance, a mock `engine` with `runRenderLoop(fn)` spy, and a mock pipeline
- When: `runtime.attach(engine, () => mockScene)` is called
- Then: `engine.runRenderLoop` was called with a function as argument
- Edge cases: `attach()` with null/undefined engine (TypeScript catches at compile time, but test guards against runtime)

**AC-2: Render loop calls pipeline and scene.render**

- Given: Mock engine where `getDeltaTime()` returns `1/60`, mock pipeline that records `executeTick` calls, mock scene recording `render()` calls
- When: The render loop callback is invoked once
- Then: `pipeline.executeTick(FIXED_DT)` was called once, and `scene.render()` was called once
- Edge cases: when 0 ticks processed, `scene.render()` is still called exactly once

**AC-3: Normal single tick execution**

- Given: Mock engine `getDeltaTime() = 1/60`, pipeline recording tick count
- When: The render loop callback is invoked once
- Then: `pipeline.executeTick(FIXED_DT)` was called exactly once
- Edge cases: `getDeltaTime()` returns exactly `FIXED_DT` — boundary condition, 1 tick

**AC-4: Catch-up cap at 4 ticks**

- Given: Mock engine `getDeltaTime() = 5/60`, pipeline recording tick count
- When: The render loop callback is invoked once
- Then: `pipeline.executeTick(FIXED_DT)` was called exactly 4 times, and accumulator is clamped
- Edge cases: `getDeltaTime() = 4/60` — exactly 4 ticks, no cap; `getDeltaTime() = 0` — 0 ticks

**AC-5: detach removes callback**

- Given: `runtime.attach(engine, ...)` called, render loop active
- When: `runtime.detach()` is called
- Then: `engine.stopRenderLoop` was called with the same callback reference that was passed to `runRenderLoop`
- Edge cases: `detach()` without prior `attach()` — safe no-op; `detach()` twice — safe no-op

**AC-6: Havok auto-step suppression**

- Given: A mock scene object with `_advancePhysicsEngineStep` set to the default Babylon step function
- When: `suppressHavokAutoStep(scene)` is called
- Then: `scene._advancePhysicsEngineStep` is a function that does nothing (no-op). Calling it produces no side effects
- Edge cases: scene without `_advancePhysicsEngineStep` (defensive — check property exists before overriding)

**AC-7: Placeholder slots registration**

- Given: A pipeline in Uninitialized state
- When: PipelineRuntime's setup function registers placeholders
- Then: Slots 2–8 each have a registered NO-OP function (verified by calling `executeTick()` — no crash). Slot 1 is null (empty, reserved for Input)
- Edge cases: a system epic accidentally registers at a slot that already has a placeholder — the placeholder is overwritten

**AC-8: Double attach is no-op**

- Given: `runtime.attach(engine, sceneFn)` called once
- When: `runtime.attach(engine, sceneFn)` is called again without `detach()` in between
- Then: `engine.runRenderLoop` was called only once (second call did not re-install). `pipeline.getCurrentTick()` increments as normal
- Edge cases: attach with a different engine reference — should this be an error? (Design choice: no-op for same engine, throw for different engine)

---

## QA Test Cases

**Test file**: `tests/integration/determinism.test.ts`

### AC-1: pipeline runs inside render loop
- Start Babylon.js engine with pipeline registered
- Assert: `executeTick()` called from `engine.runRenderLoop()`
- Assert: tick executed at 60 FPS target

### AC-2: dev assertions in __DEV__
- In `__DEV__` mode, use `Date.now()` inside pipeline tick
- Assert: dev assertion fires
- In production mode, same operation does not fire assertion

## Test Evidence
## Dependencies

- Depends on: Story 002 (FixedUpdatePipeline — the pipeline instance), Story 004 (Accumulator — the `accumulate()` pure function)
- Unlocks: All Core epics that register into the pipeline (Physics, AI, Collision, Fuel, Tire, Race Management, Pit Stop)
