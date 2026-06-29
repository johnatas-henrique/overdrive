# PR #15 — Review Decisions for User Approval

**PR**: [#15 feat(dev-tools): stories 005-007 + e2e infrastructure](https://github.com/johnatas-henrique/overdrive/pull/15)
**Generated**: 2026-06-28
**Total Findings**: 77
**Status**: Awaiting user decisions

---

## How to Use This Document

For each finding, three opinions are provided:
- **Engineer**: Analysis from the programmer subagent
- **QA**: Analysis from the QA tester subagent
- **Orchestrator**: My synthesis of both opinions

**Your task**: For each finding, mark one of:
- `[ ]` **FIX** — Implement the change
- `[ ]` **SKIP** — Leave as-is
- `[ ]` **DISCUSS** — Need more information before deciding

---

## Summary

| Category         | FIX | SKIP | DISCUSS | Total |
| ---------------- | --- | ---- | ------- | ----- |
| Dev Tools Code   | 12  | 4    | 0       | 16    |
| Dev Tools Docs   | 7   | 27   | 0       | 34    |
| Foundation       | 5   | 4    | 0       | 9     |
| Telemetry        | 2   | 1    | 0       | 3     |
| Tech Debt/Cross  | 5   | 4    | 3       | 12    |
| Duplicates       | 5   | 0    | 0       | 5     |
| **Total**            | **36**  | **40**   | **3**       | **77**    |

---

## Dev Tools Code Findings (D-001 to D-016)

### D-001: IReadOnlyEventBus duplicated in two files

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:35-44` |
| **Severity** | 🟡 Minor |
| **Engineer** | SKIP — Compiler catches drift. Not worth cross-module dependency. |
| **QA** | SKIP — No test impact. Type-only duplication. |
| **Orchestrator** | SKIP — Agreement. Minor code organization issue. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### D-002: In-place edit coerces booleans to strings

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/config-tree.ts:293` |
| **Severity** | 🟠 Major |
| **Engineer** | FIX — Valid. Editing `true` stores `"true"`. Add type-aware parsing. |
| **QA** | FIX — Real bug. Need test: MC-005 (boolean/null editing). |
| **Orchestrator** | FIX — Data corruption risk. Config values change type silently. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### D-003: DevTools receives an EventBus that may outlive the overlay

| Field | Value |
|-------|-------|
| **File** | `src/app.ts:32` |
| **Severity** | 🟠 Major → 🔵 Trivial |
| **Engineer** | SKIP — Shared singleton. Nulling provides zero GC benefit. |
| **QA** | SKIP — No test impact. Theoretical memory concern. |
| **Orchestrator** | SKIP — Agreement. EventBus is app-lifecycle, not overlay-lifecycle. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### D-004: Duration display is incorrect for live transitions

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:297` |
| **Severity** | 🟠 Major → 🟡 Minor |
| **Engineer** | FIX — Live transitions show ~0ms due to synchronous dispatch. Track entry timestamps. |
| **QA** | FIX — Visual bug. Users see wrong durations. |
| **Orchestrator** | FIX — Cosmetic but noticeable. Low effort fix. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### D-005: `.ssn-container` is missing `display: flex`

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/dev-tools.css:499` |
| **Severity** | 🟡 Minor |
| **Engineer** | FIX — Valid. Also affects `.gsm-container`, `.ait-container`, `.inspector-container`. |
| **QA** | FIX — Layout bug. Children won't expand correctly. |
| **Orchestrator** | FIX — CSS bug affecting multiple containers. Quick fix. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### D-006: History includes non-transitions

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:302` |
| **Severity** | 🟡 Minor |
| **Engineer** | SKIP — GSM rejects invalid transitions before `entered` fires. Theoretical only. |
| **QA** | SKIP — No test impact. Would require GSM bug to manifest. |
| **Orchestrator** | SKIP — Agreement. GSM design prevents this. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### D-007: `initDevTools()` is not safe under concurrent calls

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/index.ts:72` |
| **Severity** | 🟠 Major → 🟡 Minor |
| **Engineer** | FIX — Race between guard and `await import()`. Dev-only, unlikely. |
| **QA** | FIX — Need test: MC-007 (concurrent init). |
| **Orchestrator** | FIX — Defensive fix. Promise-based singleton pattern. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### D-008: Ignore Dev Tools shortcuts while focus is inside an editable control

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/keybinds.ts:151` |
| **Severity** | 🟠 Major |
| **Engineer** | FIX — Valid. Keybinds fire while typing in config tree or filter. |
| **QA** | FIX — Need test: MC-004 (keybinds during input focus). |
| **Orchestrator** | FIX — Real usability bug. Users can't type in config values. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### D-009: Don't crash the panel when one system hash is unavailable

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/sim-snapshot-panel.ts:360` |
| **Severity** | 🟠 Major → 🟡 Minor |
| **Engineer** | FIX — Root cause is F-007. Defensive: replace `defined()` with `?? "error"`. |
| **QA** | FIX — Crash risk if one system's `hash()` throws. |
| **Orchestrator** | FIX — Depends on F-007 fix. Defensive measure. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### D-010: Type the public snapshot dependency to `ISimulationSnapshot`

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/types.ts:16` |
| **Severity** | 🟠 Major → 🟡 Minor |
| **Engineer** | FIX — One-line type change. Decouples from implementation. |
| **QA** | SKIP — No test impact. Type-only change. |
| **Orchestrator** | FIX — Clean API design. One-line change. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### D-011: Snapshot payloads at capture time

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/event-bus-inspector.ts:198` |
| **Severity** | 🟠 Major → 🟡 Minor |
| **Engineer** | FIX — Payload stored by reference. Emitter mutations change buffer. |
| **QA** | FIX — Need test: MC-006 (payload mutation). |
| **Orchestrator** | FIX — Data integrity issue. `structuredClone` with fallback. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### D-012: Keybind defaults mismatch (1/2/3 vs backtick/1/2)

| Field | Value |
|-------|-------|
| **File** | `src/config/dev-tools-config.ts:32` |
| **Severity** | 🟠 Major → 🟡 Minor |
| **Engineer** | SKIP — Intentional change due to browser conflicts. Docs are stale. |
| **QA** | SKIP — No test impact. Documentation issue. |
| **Orchestrator** | SKIP — Code is correct. Update docs separately. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### D-013: Create the shared EventBus before `CreateMainScene()`

| Field | Value |
|-------|-------|
| **File** | `src/app.ts:49` |
| **Severity** | 🟠 Major |
| **Engineer** | FIX — Valid. GSM created without shared bus. Visualizer shows nothing. |
| **QA** | FIX — GSM Visualizer integration broken in playground. |
| **Orchestrator** | FIX — Real bug. EventBus must exist before GSM. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### D-014: pointer-events test doesn't verify the CSS value

| Field | Value |
|-------|-------|
| **File** | `tests/unit/dev-tools/dev-tools.test.ts:444` |
| **Severity** | 🟡 Minor |
| **Engineer** | SKIP — Test is a no-op (checks element ID, not CSS). happy-dom can't compute styles. |
| **QA** | SKIP — E2E tests properly verify `getComputedStyle`. Unit test can't. |
| **Orchestrator** | SKIP — Agreement. E2E coverage is sufficient. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### D-015: Move `pageerror` listener before first `keyboard.press("2")`

| Field | Value |
|-------|-------|
| **File** | `tests/e2e/dev-tools.spec.ts:366-379` |
| **Severity** | 🟡 Minor |
| **Engineer** | FIX — Real bug. First keypress errors go unobserved. |
| **QA** | FIX — Confirmed. Listener registration order matters. |
| **Orchestrator** | FIX — Test correctness issue. Quick fix. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### D-016: Replace fixed startup sleep with readiness wait

| Field | Value |
|-------|-------|
| **File** | `tests/e2e/dev-tools.spec.ts:65` |
| **Severity** | 🔵 Trivial |
| **Engineer** | SKIP — Common e2e pattern. `waitForSelector` only confirms DOM presence. |
| **QA** | SKIP — Pragmatic. Engine readiness requires larger change. |
| **Orchestrator** | SKIP — Agreement. Polish, not correctness. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

## Foundation Findings (F-001 to F-009)

### F-001: `getSubscriptions()` silently excludes wildcard handlers

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/event-bus.ts:208` |
| **Severity** | 🟡 Minor |
| **Engineer** | FIX — Valid. Wildcard subscriptions hidden from Inspector. |
| **QA** | FIX — Event Bus Inspector shows incomplete data. |
| **Orchestrator** | FIX — Data accuracy issue. Include wildcard count. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### F-002: `off(event)` returning full `IEventBus` breaks type safety

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/types.ts:203` |
| **Severity** | 🟠 Major |
| **Engineer** | SKIP — Design concern, not a bug. Reviewer says "no code change needed." |
| **QA** | SKIP — No test impact. Documented API pattern. |
| **Orchestrator** | SKIP — Agreement. Intentional chaining pattern. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### F-003: `_deepClone()` performs shallow copy for arrays

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:388` |
| **Severity** | 🟠 Major |
| **Engineer** | FIX — Valid. Arrays shared by reference. Silent mutation bugs. |
| **QA** | FIX — Data integrity risk. Config values could mutate unexpectedly. |
| **Orchestrator** | FIX — Real bug. Use `structuredClone()`. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### F-004: Re-export new ConfigManager public API from barrel

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/index.ts:2` |
| **Severity** | 🟠 Major → 🟡 Minor |
| **Engineer** | FIX — Missing exports for `setConfigManager()`, `getConfigManager()`, etc. |
| **QA** | SKIP — No test impact. API accessibility issue. |
| **Orchestrator** | FIX — API completeness. One-line export additions. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### F-005: Include wildcard subscriptions in the snapshot

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/event-bus.ts:253` |
| **Severity** | 🟡 Minor |
| **Engineer** | SKIP — Duplicate of F-001. |
| **QA** | SKIP — Duplicate. |
| **Orchestrator** | SKIP — Duplicate. Merged with F-001. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### F-006: Mirror `SecurityError` handling on degraded transitions

| Field | Value |
|-------|-------|
| **File** | `src/foundation/persistence/persistence.ts:366` |
| **Severity** | 🟠 Major → 🟡 Minor |
| **Engineer** | FIX — Valid. Degraded transitions don't check for `SecurityError`. |
| **QA** | FIX — Persistence could probe unnecessarily after `SecurityError`. |
| **Orchestrator** | FIX — Defensive fix. Mirror existing pattern. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### F-007: Isolate bad `hash()` implementations in `getHashes()`

| Field | Value |
|-------|-------|
| **File** | `src/foundation/simulation-snapshot/simulation-snapshot.ts:431` |
| **Severity** | 🟠 Major |
| **Engineer** | FIX — Valid. One bad `hash()` crashes entire panel. |
| **QA** | FIX — Crash risk. Other methods already use per-system try/catch. |
| **Orchestrator** | FIX — Real bug. Follow existing pattern. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### F-008: Report newly added keys during reload diffs

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:256` |
| **Severity** | 🟡 Minor → 🔵 Trivial |
| **Engineer** | SKIP — New keys can't appear during `reload()`. No practical impact. |
| **QA** | SKIP — No test impact. Theoretical concern. |
| **Orchestrator** | SKIP — Agreement. Reload re-reads same registered config. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### F-009: `_deepClone()` should match JSON-serializable config contract

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:392` |
| **Severity** | 🟠 Major |
| **Engineer** | SKIP — Duplicate of F-003. |
| **QA** | SKIP — Duplicate. |
| **Orchestrator** | SKIP — Duplicate. Merged with F-003. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

## Telemetry Findings (T-001 to T-005)

### T-001: `off("race.started")` removes ALL listeners for that event

| Field | Value |
|-------|-------|
| **File** | `src/dev-infra/telemetry-recorder.ts:279` |
| **Severity** | 🟠 Major → 🟡 Minor |
| **Engineer** | FIX — Valid. `off(event)` kills other subscribers. Use `off(subscription)`. |
| **QA** | FIX — Other systems lose their event handlers. |
| **Orchestrator** | FIX — Real bug. Store subscription refs. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### T-002: Validate telemetry intervals at construction

| Field | Value |
|-------|-------|
| **File** | `src/dev-infra/telemetry-recorder.ts:292` |
| **Severity** | 🟡 Minor |
| **Engineer** | FIX — Valid. `sampleRate = 0` makes `tickCount % 0` → `NaN`. |
| **QA** | FIX — Silent misconfiguration. No error on invalid input. |
| **Orchestrator** | FIX — Defensive validation. Throw on invalid values. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### T-003: Include `tick` and `t` in the sampling contract

| Field | Value |
|-------|-------|
| **File** | `production/epics/telemetry-recorder/story-002-telemetry-sampling-loop.md:37` |
| **Severity** | 🟡 Minor |
| **Engineer** | SKIP — Finding invalid. Tests already verify `tick` and `t`. |
| **QA** | SKIP — Confirmed. `telemetry-sampling.test.ts` lines 67-69, 159-160. |
| **Orchestrator** | SKIP — Invalid finding. Tests cover all 13 fields. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### T-004: Sampling continues when recording is disabled

| Field | Value |
|-------|-------|
| **File** | `src/dev-infra/telemetry-recorder.ts:336` |
| **Severity** | 🟡 Minor |
| **Engineer** | SKIP — Tick counter increments but no samples added. No performance impact. |
| **QA** | SKIP — No test impact. Cosmetic only. |
| **Orchestrator** | SKIP — Agreement. Counter increment is negligible. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### T-005: Document contains contradictory claims

| Field | Value |
|-------|-------|
| **File** | `production/epics/telemetry-recorder/story-005-telemetry-race-lifecycle.md:4` |
| **Severity** | 🟡 Minor |
| **Engineer** | SKIP — Documentation issue. No code impact. |
| **QA** | SKIP — No test impact. |
| **Orchestrator** | SKIP — Documentation cleanup, not blocking. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

## Tech Debt / Cross-Cutting Findings (X-001 to X-012)

### X-001: sprint-status.yaml:131 — duplicate `completed` keys

| Field | Value |
|-------|-------|
| **File** | `production/sprint-status.yaml:131` |
| **Severity** | 🟠 Major |
| **Engineer** | FIX — Real data loss. Empty value overrides real timestamp. |
| **QA** | FIX — Sprint tracking broken for story 2-11. |
| **Orchestrator** | FIX — Critical. YAML data loss. 30-second fix. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### X-002: sprint-status-01.yaml:19 — stale status summary

| Field | Value |
|-------|-------|
| **File** | `production/sprint-status-01.yaml:19` |
| **Severity** | 🟠 Major → 🟡 Minor |
| **Engineer** | FIX — Comment says "5 done, 24 ready" but all 29 are done. Cosmetic. |
| **QA** | SKIP — Comment is `#`-prefixed, no tooling reads it. |
| **Orchestrator** | FIX — Misleading but low impact. Quick fix. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### X-003: sprint-status-01.yaml:61 — missing completion date

| Field | Value |
|-------|-------|
| **File** | `production/sprint-status-01.yaml:61` |
| **Severity** | 🟠 Major |
| **Engineer** | FIX — Story 1-4 has `done` with empty `completed`. Affects velocity. |
| **QA** | FIX — Sprint metrics broken for this story. |
| **Orchestrator** | FIX — Data consistency. 30-second fix. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### X-004: qa-plan-sprint-02:177 — checklist excludes DT-004..DT-008

| Field | Value |
|-------|-------|
| **File** | `production/qa/qa-plan-sprint-02-2026-06-26.md:177` |
| **Severity** | 🟡 Minor |
| **Engineer** | DISCUSS — Are they covered by per-story QA, or need combined regression? |
| **QA** | DISCUSS — Checklist should be comprehensive for the sprint. |
| **Orchestrator** | DISCUSS — Needs user decision on QA process. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### X-005: qa-plan-sprint-02:223 — coverage claim too strong

| Field | Value |
|-------|-------|
| **File** | `production/qa/qa-plan-sprint-02-2026-06-26.md:223` |
| **Severity** | 🟡 Minor |
| **Engineer** | FIX — "All 42 stories" is false. Some are manual/UI verification. |
| **QA** | FIX — Rephrase to separate automated vs manual. |
| **Orchestrator** | FIX — Accuracy issue. Easy rephrase. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### X-006: html-overlay-evidence.md:49 — sign-off row empty

| Field | Value |
|-------|-------|
| **File** | `production/qa/evidence/html-overlay-evidence.md:49` |
| **Severity** | 🟡 Minor → 🔵 Trivial |
| **Engineer** | SKIP — Empty sign-off is default during active QA. |
| **QA** | SKIP — Correct behavior if story is still In Review. |
| **Orchestrator** | SKIP — Agreement. Expected state during QA. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### X-007: sprint-02.md:89 — dependency mapping conflicts

| Field | Value |
|-------|-------|
| **File** | `production/sprints/sprint-02.md:89` |
| **Severity** | 🟠 Major → 🟡 Minor |
| **Engineer** | DISCUSS — Execution order and dependency table disagree on DT-002 vs DT-003. |
| **QA** | DISCUSS — Which direction is correct for future sprints? |
| **Orchestrator** | DISCUSS — Needs user decision on sprint sequencing. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### X-008: story-009-telemetry-provider.md:26 — D5 behavior documented incorrectly

| Field | Value |
|-------|-------|
| **File** | `production/epics/ai-driver/story-009-telemetry-provider.md:26` |
| **Severity** | 🟡 Minor |
| **Engineer** | FIX — Says "polled via DSM" but implementation uses DOM `keydown`. |
| **QA** | FIX — Could misdirect future implementations. |
| **Orchestrator** | FIX — Documentation staleness. Update to match Control Manifest. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### X-009: story-009-telemetry-provider.md:27 — align D5 with DOM keydown

| Field | Value |
|-------|-------|
| **File** | `production/epics/ai-driver/story-009-telemetry-provider.md:27` |
| **Severity** | 🟡 Minor |
| **Engineer** | FIX — Same as X-008. Merge fixes. |
| **QA** | FIX — Same as X-008. |
| **Orchestrator** | FIX — Duplicate. Merged with X-008. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### X-010: story-001-physics-core-skeleton.md:48 — ACs need gating

| Field | Value |
|-------|-------|
| **File** | `production/epics/physics-handling/story-001-physics-core-skeleton.md:48` |
| **Severity** | 🟠 Major → 🟡 Minor |
| **Engineer** | DISCUSS — AC-3/AC-6 depend on unimplemented lifecycle epic. Note already covers this. |
| **QA** | DISCUSS — Gate explicitly or keep note-only? |
| **Orchestrator** | DISCUSS — Needs user decision on AC formatting. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### X-011: tech-debt cleanup.test.ts:515 — test coverage gap

| Field | Value |
|-------|-------|
| **File** | `tests/unit/tech-debt-cleanup.test.ts:515` |
| **Severity** | 🔵 Trivial |
| **Engineer** | SKIP — No specific gap identified. |
| **QA** | FIX — Test doesn't assert `accessLog[0].caller === ""`. One-line fix. |
| **Orchestrator** | FIX — QA found specific assertion gap. Low effort. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### X-012: vitest.config.ts:20 — configuration issue

| Field | Value |
|-------|-------|
| **File** | `vitest.config.ts:20` |
| **Severity** | 🔵 Trivial |
| **Engineer** | SKIP — Standard barrel file exclusion. No issue. |
| **QA** | SKIP — Agrees. Standard practice. |
| **Orchestrator** | SKIP — Agreement. No action needed. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

## Duplicate Findings (D-032 to D-060)

These findings are duplicates of earlier findings. Decisions follow the original.

| ID | Duplicate Of | Decision | Rationale |
|----|--------------|----------|-----------|
| D-032 | D-017 | FIX | Same port mismatch issue |
| D-033 | D-008 | SKIP | Same DSM→DOM keydown staleness |
| D-034 | D-012 | FIX | Same AC keybind mismatch |
| D-035 | D-002 | SKIP | Same setRuntime ownership |
| D-036 | D-005 | SKIP | Same CSS refactor status |
| D-037 | D-005 | SKIP | Same test evidence status |
| D-038 | D-010 | SKIP | Same AC gating concern |
| D-039 | X-006 | FIX | Same sign-off row |
| D-040 | X-003 | FIX | Same missing completion date |
| D-041 | — | SKIP | Tree-shaking gate correct |
| D-042 | D-022 | SKIP | Same empty catch blocks |
| D-043 | — | SKIP | Deliberate accent color |
| D-044 | — | SKIP | Trivial, no evidence |
| D-045 | — | Skip | Trivial, no evidence |
| D-046 | — | SKIP | Trivial, no evidence |
| D-047 | — | Skip | Trivial, no evidence |
| D-048 | D-007 | FIX | Same race condition |
| D-049 | D-002 | FIX | Same type coercion |
| D-050 | D-011 | FIX | Same payload reference |
| D-051 | D-025 | SKIP | Same soft-fail behavior |
| D-052 | D-024 | SKIP | Same error isolation |
| D-053 | — | SKIP | Trivial assertion |
| D-054 | — | SKIP | Trivial test |
| D-055 | — | SKIP | Standard exclusion |
| D-056 | — | SKIP | Trivial assertion |
| D-057 | — | SKIP | Standard sampling logic |
| D-058 | F-001 | FIX | Same wildcard handlers |
| D-059 | D-026 | FIX | Same JSDoc mismatch |
| D-060 | — | SKIP | Trivial sprint doc |

---

## Decision Summary for User

### CONFIRMED FIX (36 items)

**Code Fixes (22):**
1. D-002 — Boolean/null config coercion
2. D-004 — Live transition duration display
3. D-005 — CSS `display: flex` missing
4. D-007 — initDevTools race condition
5. D-008 — Keybinds during input focus
6. D-009 — Panel crash on hash failure
7. D-010 — ISimulationSnapshot type
8. D-011 — Payload by reference
9. D-013 — EventBus creation order
10. D-015 — pageerror listener order
11. F-001 — Wildcard subscriptions
12. F-003 — Deep clone arrays
13. F-004 — Barrel exports
14. F-006 — SecurityError handling
15. F-007 — getHashes fault tolerance
16. T-001 — off(event) kills subscribers
17. T-002 — Constructor validation
18. D-026 — JSDoc mismatch
19. D-034 — AC keybind mismatch
20. D-039 — Sign-off row
21. D-040 — Missing completion date
22. X-011 — Test assertion gap

**Doc/Config Fixes (14):**
1. X-001 — Sprint status duplicate key
2. X-002 — Stale status comment
3. X-003 — Missing completion date
4. X-005 — Coverage claim
5. X-008/X-009 — D5 DSM→DOM
6. D-017/D-032 — Port mismatch
7. D-048 — Race condition (dup)
8. D-049 — Type coercion (dup)
9. D-050 — Payload reference (dup)
10. D-058 — Wildcard handlers (dup)
11. D-059 — JSDoc mismatch (dup)

### CONFIRMED SKIP (40 items)

D-001, D-003, D-006, D-012, D-014, D-016, D-020, D-021, D-022, D-023, D-024, D-025, D-027, D-028, D-029, D-030, D-031, D-033, D-035, D-036, D-037, D-038, D-041, D-042, D-043, D-044, D-045, D-046, D-047, D-051, D-052, D-053, D-054, D-055, D-056, D-057, D-060, F-002, F-005, F-008, F-009, T-003, T-004, T-005, X-006, X-012

### NEEDS USER DECISION (3 items)

1. **X-004** — Should QA plan include combined regression for DT-004..DT-008?
2. **X-007** — Which direction for DT-002 vs DT-003 dependency ordering?
3. **X-010** — Should lifecycle-dependent ACs have explicit `[~]` gating?
