# Story 001: HudAnimator

> **Epic**: HUD
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/hud.md`
**Requirement**: `TR-HUD-007` — All animations mechanical (flips, ticks, cuts) — no smooth fades. Configurable per-block via HudAnimStyle.

**ADR Governing Implementation**: ADR-0018: HUD Layout & Blocks
**ADR Decision Summary**: Shared HudAnimator utility with configurable HudAnimStyle enum (MECHANICAL = 0.1s tick discrete step, SMOOTH = easeOutCubic interpolation, CUT = instant snap). Per-block animStyle override supported. animSpeed multiplier scales all durations.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Animation operates on Babylon.js GUI Control properties (scaleX, scaleY, alpha, rotation). No engine-specific animation APIs needed — pure TypeScript tween utility.

**Control Manifest Rules (this layer)**:

- Required: P4 (HudAnimator with HudAnimStyle enum — mechanical default for Phase 1)
- Guardrail: P-G1 (HUD < 0.3ms GPU per frame)

## Acceptance Criteria

_From ADR-0018 Validation Criteria and Implementation Guidelines:_

- [ ] AC-1: `HudAnimator.play()` with MECHANICAL style holds the `from` value for the full duration, then snaps to `to` value at completion (single-step snap, not multi-step interpolation)
- [ ] AC-2: `HudAnimator.play()` with CUT style sets the target property to `to` immediately within the `play()` call — no tween added to active queue
- [ ] AC-3: `HudAnimator.play()` with SMOOTH style interpolates via easeOutCubic (`t => 1 - Math.pow(1 - t, 3)`) over the specified duration
- [ ] AC-4: `HudAnimator.update(tickDelta)` advances active tweens by `tickDelta` ticks; completed tweens are removed from the active map
- [ ] AC-5: If `play()` is called for an already-active (target + property) pair, the existing tween is silently overwritten (replaced)
- [ ] AC-6: Multiple simultaneous tweens on different target+property combinations all complete correctly and independently
- [ ] AC-7: `animSpeed` multiplier (from config) scales all durations — `effectiveDuration = duration / animSpeed`. animSpeed of 0 is clamped to 0.001 to prevent division-by-zero.
- [ ] AC-8: CUT style ignores `animSpeed` — always instant regardless of multiplier

## Implementation Notes

_Derived from ADR-0018 Implementation Guidelines:_

1. **Timebase**: Use tick-count-based timing (`tickDelta`), not real-time (`Date.now`/`performance.now`). Each `update(tickDelta)` call advances `elapsedTicks += tickDelta`. This keeps animation deterministic and testable without real-time mocks.

2. **MECHANICAL behavior**: The target holds the `from` value for the full duration. At completion, it snaps to `to`. This is a single-step transition, not multi-step interpolation. Example: duration=100ms, animSpeed=1.0 → target holds for 100ms, then snaps.

3. **SMOOTH behavior**: Progress = min(elapsedTicks / effectiveDurationTicks, 1.0). Value = `from + (to - from) * easeOutCubic(progress)`. `easeOutCubic(t) = 1 - Math.pow(1 - t, 3)`.

4. **CUT behavior**: `target[property] = to` synchronously. No entry added to tweens map. Return immediately.

5. **Tween lifecycle**: Tweens are stored in `Map<string, TweenState>` keyed by `` `{target.name}.{property}` ``. On completion, delete entry. On duplicate play() for same key, old tween is removed and replaced.

6. **Supported properties**: `scaleX`, `scaleY`, `alpha`, `rotation`. These are Babylon.js GUI Control properties. If other properties are passed, the operation is a no-op (logged in DEV mode).

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 003: HudManager — lifecycle integration (calling `update()` each tick)
- Stories 004-012: Per-block animation usage (consumers of HudAnimator)

## QA Test Cases

_Automated test specs — written by qa-lead at story creation:_

- **AC-1**: MECHANICAL completes after full duration
  - Given: HudAnimator with `animSpeed=1.0` and default config
  - When: `play()` is called with `{ target, property: "alpha", from: 0, to: 1, style: MECHANICAL, duration: 100 }`
  - And: `update(3)` is called 5 times (< 100ms elapsed at 60fps simulation)
  - Then: target's alpha is still `from` (0)
  - When: `update(3)` is called a 6th time (≥100ms elapsed)
  - Then: target's alpha is `to` (1)
  - And: the tween is removed from the active map
  - Edge cases: duration=0 (instant snap, same as CUT)

- **AC-2**: CUT snaps immediately
  - Given: HudAnimator with default config
  - When: `play()` is called with style CUT
  - Then: target property is set to `to` within the `play()` call
  - And: no tween is added to active queue

- **AC-3**: SMOOTH interpolates via easeOutCubic
  - Given: HudAnimator with default config
  - When: `play()` with `{ target, property: "scaleX", from: 0, to: 1, style: SMOOTH, duration: 300 }` and `animSpeed=1.0`
  - And: `update(3)` called repeatedly; sampled at t=150ms (progress=0.5)
  - Then: target property = `easeOutCubic(0.5)` ≈ 0.875 (not 0.5)
  - Edge cases: progress=0 → from value, progress=1 → to value, tween removed

- **AC-4**: Completed tweens removed
  - Given: HudAnimator with 1 active tween
  - When: `update(3)` called until tween completes
  - Then: `animator.activeTweenCount` (or internal map size) is 0

- **AC-5**: Duplicate (target+property) overwrites
  - Given: Active tween for `{ target: A, property: "alpha", to: 0 }`
  - When: `play()` called for same `{ target: A, property: "alpha", to: 1 }`
  - Then: Old tween removed, new tween starts from current value to 1

- **AC-6**: Multiple simultaneous tweens
  - Given: 3 active tweens on different (target, property) pairs
  - When: `update()` called until all durations elapse
  - Then: All 3 targets have their properties set to their respective `to` values

- **AC-7**: animSpeed multiplier
  - Given: HudAnimator with `animSpeed=2.0`
  - When: `play()` with MECHANICAL, duration=200ms
  - Then: effective duration = 100ms (200/2)
  - Given: HudAnimator with `animSpeed=0.5`
  - When: `play()` with MECHANICAL, duration=200ms
  - Then: effective duration = 400ms (200/0.5)
  - Edge cases: animSpeed=0 → clamped to 0.001

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/hud/hudAnimator.test.ts` — must exist and pass
**Status**: [ ] Not yet created

## Dependencies

- Depends on: None (standalone utility)
- Unlocks: Stories 005 (PositionBlock fade), 007 (ResourcesBlock pulse), 011 (PitOverlay refuel), 012 (Checkered animation)
