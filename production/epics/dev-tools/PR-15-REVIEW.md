# PR #15 Review — Dev Tools Epic

**PR**: [#15 feat(dev-tools): stories 005-007 + e2e infrastructure](https://github.com/johnatas-henrique/overdrive/pull/15)
**Review Date**: 2026-06-28
**Reviewers**: coderabbitai[bot], cubic-dev-ai[bot], greptile-apps[bot]
**Total Comments**: 79 (50+ in this epic scope)

---

## Summary

Three AI reviewers analyzed the PR. This document covers findings related to the **Dev Tools epic** (Stories 001-009).

---

## Findings

### D-001: `IReadOnlyEventBus` duplicated in two files

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:35-44` |
| **Severity** | 🟡 Minor |
| **Reviewer** | greptile-apps[bot] |
| **Category** | Code |

**Finding**: `IReadOnlyEventBus` is defined identically in both `gsm-visualizer.ts` and `event-bus-inspector.ts`. Having two copies means a future change must be applied in both places.

**Recommendation**: Export from `event-bus-inspector.ts` and import in `gsm-visualizer.ts`.

**Status**: PENDING REVIEW

---

### D-002: In-place edit coerces booleans to strings

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/config-tree.ts:293` |
| **Severity** | 🟠 Major |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Editing a boolean/null config value via the config tree turns it into a string. The `_finishEdit` method parses numbers but not booleans or null.

**Recommendation**: Add type-aware parsing: `"true"` → `true`, `"false"` → `false`, `"null"` → `null`.

**Status**: PENDING REVIEW

---

### D-003: DevTools receives an EventBus that may outlive the overlay

| Field | Value |
|-------|-------|
| **File** | `src/app.ts:32` |
| **Severity** | 🟠 Major |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: `initDevTools(engine, scene, eventBus)` stores the eventBus reference. If the overlay is disposed, the eventBus reference remains, preventing garbage collection.

**Recommendation**: Null out the eventBus reference in `dispose()`.

**Status**: PENDING REVIEW

---

### D-004: Duration display is incorrect for live transitions

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:297` |
| **Severity** | 🟠 Major |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: `_pendingExit.timestamp` is captured on `gsm.state.exited`, but the duration calculation uses `Date.now() - _pendingExit.timestamp`. For the currently active state, this shows elapsed time since entry, not time-in-previous-state.

**Recommendation**: Clarify in the UI that the duration for the active state is "elapsed since entry" and only completed states show actual time-in-previous-state.

**Status**: PENDING REVIEW

---

### D-005: `.ssn-container` is missing `display: flex`

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/dev-tools.css:499` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: `.ssn-container` has `flex-direction: column` but no `display: flex`. The flex children won't lay out correctly without it.

**Recommendation**: Add `display: flex` to `.ssn-container`.

**Status**: PENDING REVIEW

---

### D-006: History includes non-transitions because every GSM event is logged

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:302` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: The history log captures every `gsm.state.exited` event, but some exits may not result in a valid transition (e.g., invalid target state). These "non-transitions" appear in the history.

**Recommendation**: Filter out entries where source === target or where the transition was rejected.

**Status**: PENDING REVIEW

---

### D-007: `initDevTools()` is not safe under concurrent calls

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/index.ts:72` |
| **Severity** | 🟠 Major |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Lines 71-72 guard only the pre-`await` path. If two callers invoke `initDevTools()` concurrently, both may pass the guard and create duplicate overlays.

**Recommendation**: Use a promise-based singleton: store the init promise and return it on subsequent calls.

**Status**: PENDING REVIEW

---

### D-008: Ignore Dev Tools shortcuts while focus is inside an editable control

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/keybinds.ts:151` |
| **Severity** | 🟠 Major |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: The keybind listener sits on `document`, so pressing keys 1/2/3 while typing in the config tree or filter input triggers Dev Tools actions instead of typing.

**Recommendation**: Check `event.target` — if it's an `<input>`, `<textarea>`, or `[contenteditable]`, skip the handler.

**Status**: PENDING REVIEW

---

### D-009: Don't crash the panel when one system hash is unavailable

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/sim-snapshot-panel.ts:360` |
| **Severity** | 🟠 Major |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: `SimulationSnapshot.getHashes()` was hardened to be fault-tolerant, but the panel assumes all registered systems have a hash. If one system's `hash()` throws, the panel crashes.

**Recommendation**: Use optional chaining: `currentHashes.get(system.systemId) ?? "error"`.

**Status**: PENDING REVIEW

---

### D-010: Type the public snapshot dependency to `ISimulationSnapshot`

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/types.ts:16` |
| **Severity** | 🟠 Major |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: `IDevTools` currently exposes the concrete `SimulationSnapshot` class instead of the `ISimulationSnapshot` interface. This couples the Dev Tools API to the implementation.

**Recommendation**: Change the type to `ISimulationSnapshot` in the interface.

**Status**: PENDING REVIEW

---

### D-011: Snapshot payloads at capture time

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/event-bus-inspector.ts:198` |
| **Severity** | 🟠 Major |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: The buffer stores `detail.payload` by reference. If the publisher mutates that object after emit, older entries in the log change retroactively.

**Recommendation**: Deep-clone the payload at capture time: `payload: structuredClone(detail.payload)`.

**Status**: PENDING REVIEW

---

### D-012: Keybind defaults mismatch (1/2/3 vs backtick/1/2)

| Field | Value |
|-------|-------|
| **File** | `src/config/dev-tools-config.ts:32` |
| **Severity** | 🟠 Major |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: The config ships `1/2/3` but the ADR and story ACs describe `backtick/1/2`. This was a deliberate change due to browser conflicts but the docs are stale.

**Recommendation**: Update ADR-0009 and story ACs to reflect the actual keys (1/2/3).

**Status**: PENDING REVIEW

---

### D-013: Create the shared EventBus before `CreateMainScene()`

| Field | Value |
|-------|-------|
| **File** | `src/app.ts:49` |
| **Severity** | 🟠 Major |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: `getPlaygroundGsm()` returns a GSM that was created without the shared EventBus. The playground GSM doesn't emit events to the bus, so the GSM Visualizer won't show playground transitions.

**Recommendation**: Create the EventBus before `CreateMainScene()` and pass it to the playground GSM.

**Status**: PENDING REVIEW

---

### D-014: pointer-events test doesn't verify the CSS value

| Field | Value |
|-------|-------|
| **File** | `tests/unit/dev-tools/dev-tools.test.ts:444` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |

**Finding**: The pointer-events test only checks that the overlay element has `id="dev-overlay"`, not that it actually has `pointer-events: none` CSS.

**Recommendation**: Add a test that verifies `getComputedStyle(el).pointerEvents === "none"`.

**Status**: PENDING REVIEW

---

### D-015: Move `pageerror` listener before first `keyboard.press("2")`

| Field | Value |
|-------|-------|
| **File** | `tests/e2e/dev-tools.spec.ts:366-379` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Test |

**Finding**: The test registers the `pageerror` listener after the first key press, so a failure in the first reload path goes unobserved.

**Recommendation**: Move `page.on("pageerror", ...)` before any `keyboard.press("2")`.

**Status**: PENDING REVIEW

---

### D-016: Replace fixed startup sleep with readiness wait

| Field | Value |
|-------|-------|
| **File** | `tests/e2e/dev-tools.spec.ts:65` |
| **Severity** | 🔵 Trivial |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Test |

**Finding**: `page.waitForTimeout(2000)` slows the suite and still flakes if startup takes longer.

**Recommendation**: Use `page.waitForSelector("#renderCanvas")` or a custom readiness check.

**Status**: PENDING REVIEW

---

## Decision Table

| ID | Decision | Rationale |
|----|----------|-----------|
| D-001 | SKIP | Minor — duplicated 3-method type alias that mirrors a foundation interface. Compiler catches any drift. Not worth the cross-module dependency. |
| D-002 | FIX | Valid — Major. Editing a boolean (`true`) or `null` config value stores it as the string `"true"` or `"null"`. The `_finishEdit` method only parses numbers. Add `"true"/"false"/"null"` literal parsing. |
| D-003 | SKIP | Trivial — downgraded from Major. The EventBus is a shared singleton referenced by game systems throughout the app lifecycle. Nulling it in DevTools' `dispose()` provides zero GC benefit. No practical impact. |
| D-004 | FIX | Valid — downgraded to Minor. The duration in live transitions is computed as `entryTime - exitTime`, which for synchronous event dispatch is essentially 0ms. All live-captured transitions show ~0ms duration. History seeded from GSM has correct durations. Fix: track entry timestamps to compute actual time-in-state. |
| D-005 | FIX | Valid — Minor. `.ssn-container`, `.gsm-container`, `.ait-container`, and `.inspector-container` all have `flex-direction: column` without `display: flex`. Children with `flex: 1` (e.g. `.ssn-systems-section`) won't expand. Fix all four simultaneously. |
| D-006 | SKIP | Minor — the visualizer records on `gsm.state.entered`, not `exited`. Invalid transitions that are rejected by the GSM never fire `entered`. The only theoretical edge case is `source === target` transitions, which shouldn't occur in a well-designed GSM. Fix in the GSM if it does emit them. |
| D-007 | FIX | Valid — downgraded to Minor. Classic race between `if (_instance) return` guard and the `await import(...)` below it. Dev-only entry point called once at startup, so unlikely in practice. Use a promise-based singleton or move assignment before `await`. |
| D-008 | FIX | Valid — Major. The `keydown` handler on `document` intercepts `1`/`2`/`3` even when typing in the config tree `<input>` or event filter `<input>`. Check `event.target` and skip for `INPUT`, `TEXTAREA`, and `[contenteditable]`. |
| D-009 | FIX | Valid — downgraded to Minor. The `defined()` assertion at line 358 throws if `currentHashes.get(system.systemId)` returns undefined. The root cause is F-007 (getHashes() not fault-tolerant). As a defensive measure on the consumer side, replace `defined()` with `?? "error"`. |
| D-010 | FIX | Valid — downgraded to Minor. `IDevTools.setSimulationSnapshot()` uses the concrete `SimulationSnapshot` class instead of the `ISimulationSnapshot` interface. The panel only calls methods on the interface. One-line type change. |
| D-011 | FIX | Valid — downgraded to Minor. `detail.payload` stored by reference; if the emitter mutates the payload after `emit()`, old buffer entries change retroactively. Fix: `payload: structuredClone(detail.payload)` with try/catch fallback for non-cloneable payloads. |
| D-012 | SKIP | Minor — code is intentionally shipping `1`/`2`/`3` (changed from `backtick`/`1`/`2` due to browser conflicts). This is a documentation staleness issue, not a code bug. Update ADR and story ACs separately. |
| D-013 | FIX | Valid — Major. EventBus is created AFTER `CreateMainScene()`. The GSM created inside `CreateMainScene` doesn't have the shared EventBus, so the GSM Visualizer shows no events. Move EventBus creation before `CreateMainScene()` and pass it in. |
| D-014 | SKIP | Test is a no-op — it claims to verify `pointer-events: none` but only checks the element ID exists (`expect(overlay?.id).toBe("dev-overlay")`). The comment acknowledges happy-dom doesn't process CSS files. Fixing this requires a CSS-in-JS approach or Playwright's `getComputedStyle` in e2e, which is out of scope for a unit test. The CSS rule itself is trivially correct. |
| D-015 | FIX | Real bug. `page.on("pageerror", ...)` is registered at line 376 after the first `keyboard.press("2")` at line 368. If the first keypress throws, the error goes unobserved. Move the listener before any key press. |
| D-016 | SKIP | Valid concern but low priority. `waitForTimeout(2000)` is a common e2e pattern for engine init. Replacing it with `waitForSelector("#renderCanvas")` requires verifying the canvas is actually rendered, not just present. This is a polish fix, not a correctness fix. |

---

## Foundation Findings (shared between epics)

These findings affect Foundation-level code and impact both Telemetry and Dev Tools epics.

### F-001: `getSubscriptions()` silently excludes wildcard handlers

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/event-bus.ts:208` |
| **Severity** | 🟡 Minor |
| **Reviewer** | greptile-apps[bot] |
| **Category** | Code |

**Finding**: `getSubscriptions()` only iterates `_handlers` map, not `_wildcardHandlers`. The Event Bus Inspector won't show wildcard subscriptions.

**Recommendation**: Include `_wildcardHandlers` size in the snapshot.

**Status**: PENDING REVIEW

---

### F-002: `off(event)` returning full `IEventBus` breaks type safety

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/types.ts:203` |
| **Severity** | 🟠 Major |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: `off(event)` returns the full `IEventBus`, which allows re-subscribing after unsubscription. This is a design concern, not a bug.

**Recommendation**: Document the chaining pattern clearly; no code change needed.

**Status**: PENDING REVIEW

---

### F-003: `_deepClone()` performs shallow copy for arrays

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:388` |
| **Severity** | 🟠 Major |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: `_deepClone()` keeps arrays by reference. Nested objects inside arrays are not cloned.

**Recommendation**: Use `structuredClone()` or recursive deep clone.

**Status**: PENDING REVIEW

---

### F-004: Re-export new ConfigManager public API from barrel

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/index.ts:2` |
| **Severity** | 🟠 Major |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: `setConfigManager()`, `getConfigManager()`, `ConfigChange`, and `DebugState` are not re-exported from the barrel file.

**Recommendation**: Add exports to `index.ts`.

**Status**: PENDING REVIEW

---

### F-005: Include wildcard subscriptions in the snapshot

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/event-bus.ts:253` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: Same as F-001 — `getSubscriptions()` hides `on("*", ...)` handlers.

**Recommendation**: Same as F-001.

**Status**: PENDING REVIEW

---

### F-006: Mirror `SecurityError` handling on degraded transitions

| Field | Value |
|-------|-------|
| **File** | `src/foundation/persistence/persistence.ts:366` |
| **Severity** | 🟠 Major |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: `init()` and `retry()` set `_recoverable = false` for `SecurityError`, but the degraded mode transition doesn't mirror this.

**Recommendation**: Add `SecurityError` handling to the degraded mode transition.

**Status**: PENDING REVIEW

---

### F-007: Isolate bad `hash()` implementations in `getHashes()`

| Field | Value |
|-------|-------|
| **File** | `src/foundation/simulation-snapshot/simulation-snapshot.ts:431` |
| **Severity** | 🟠 Major |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: `dispose()` and `restoreSnapshot()` continue past per-system failures, but `getHashes()` doesn't. One bad `hash()` implementation crashes the entire panel.

**Recommendation**: Wrap each `hash()` call in try/catch, return `"error"` for failed systems.

**Status**: PENDING REVIEW

---

### F-008: Report newly added keys during reload diffs

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:256` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: The diff loop only walks `snapshot` (old keys). Keys present only in `newValues` are silently missed.

**Recommendation**: Also iterate `newValues` to detect additions.

**Status**: PENDING REVIEW

---

### F-009: `_deepClone()` should match JSON-serializable config contract

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:392` |
| **Severity** | 🟠 Major |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: Same root cause as F-003 — arrays by reference, non-serializable values permitted.

**Recommendation**: Use `JSON.parse(JSON.stringify(value))` or `structuredClone()`.

**Status**: PENDING REVIEW

---

## Decision Table (Foundation)

| ID | Decision | Rationale |
|----|----------|-----------|
| F-001 | FIX | Valid — Minor. `getSubscriptions()` only iterates `_handlers`, not `_wildcardHandlers`. The Event Bus Inspector won't show wildcard subscription counts. Include wildcard handler count in the returned snapshot. |
| F-002 | SKIP | Design concern, not a bug. The reviewer explicitly says "no code change needed." The chaining pattern (`off(event).on(event, ...)`) is the documented API usage for reentrant setups. |
| F-003 | FIX | Valid — Major. `_deepClone()` skips arrays (`!Array.isArray(value)` goes to `else` branch), so arrays within config objects are shared by reference. Config values are typically JSON scalars, but array-containing configs would have silent mutation bugs. |
| F-004 | FIX | Valid — downgraded to Minor. `setConfigManager()`, `getConfigManager()`, `ConfigChange`, and `DebugState` are missing from the barrel export. Consumers importing from `@/foundation/config` can't access them. |
| F-005 | SKIP | Duplicate of F-001. |
| F-006 | FIX | Valid — downgraded to Minor. `save()`, `load()`, and `delete()` transition to Degraded mode without checking for `SecurityError`. A subsequent `retry()` would probe unnecessarily instead of short-circuiting. |
| F-007 | FIX | Valid — Major. `getHashes()` calls `system.hash()` without try/catch. A single bad `hash()` implementation crashes the entire snapshot system (and the Dev Tools panel). `dispose()` and `restoreSnapshot()` already use per-system try/catch — `getHashes()` should follow the same pattern. |
| F-008 | SKIP | Trivial — the diff loop only walks `snapshot` (old keys). New keys cannot appear during `reload()` because it re-reads from the same registered config in `_store`. Env overrides only modify existing keys. No practical impact. |
| F-009 | SKIP | Duplicate of F-003. |

---

## QA Analysis Summary

**Total test findings**: 3 (D-014, D-015, D-016)
**Recommended FIX**: 1
**Recommended SKIP**: 2
**Recommended DISCUSS**: 0
**Missing coverage found**: 4 (new findings by QA tester)

### Test Finding Verifications

| ID | Existing Decision | QA Verdict | Rationale |
|----|-------------------|------------|-----------|
| D-014 | SKIP | **CONFIRM SKIP** | Unit test is a no-op (checks element ID, not CSS). happy-dom can't compute styles. E2E tests at `dev-tools.spec.ts:82-88`, `:318-323`, `:325-330` properly verify `getComputedStyle(el).pointerEvents === "none"`. CSS rule is trivially correct in source. Test name is misleading but harmless. |
| D-015 | FIX | **CONFIRM FIX** | Real bug. `page.on("pageerror", ...)` at line 376 is registered AFTER `keyboard.press("2")` at line 368. If the first keypress throws, error goes unobserved. Move listener before any key press. |
| D-016 | SKIP | **CONFIRM SKIP** | Pragmatic. 2s sleep is engine init boilerplate. `waitForSelector("#renderCanvas")` only confirms DOM presence, not engine readiness. Proper readiness signal would require a larger change for minimal gain. |

### Top Priority Test Fixes
1. **D-015** — `pageerror` listener registered after first keypress; errors in the first reload path go unobserved. Fix: move `page.on("pageerror", ...)` before any `keyboard.press("2")`.

### Missing Coverage Gaps (not flagged by reviewers)

**MC-004: No test for keybind firing when input element is focused (relates to D-008)**
- **File**: `tests/unit/dev-tools/input-keybinds.test.ts`
- **Severity**: Major — D-008 is flagged as FIX but has no regression test
- `handleKeyDown` at `keybinds.ts:126` never checks `event.target`. All existing keybind tests dispatch events on `document` without setting a target element. There's no test that creates an `<input>`, focuses it, dispatches a keydown with `key: "1"` or `key: "2"`, and verifies whether the action fires. The E2E tests also don't cover this — they never type in the config tree input while pressing toggle/reload keys.
- **Recommendation**: Add a test case to `input-keybinds.test.ts` that reproduces the bug (action fires on focused input) to serve as a regression test after D-008 is fixed.

**MC-005: No test for boolean/null config value editing (relates to D-002)**
- **File**: `tests/integration/dev-tools/config-tree.test.ts`
- **Severity**: Major — D-002 is flagged as FIX but has no test confirming the bug
- `_finishEdit` at `config-tree.ts:293` parses numbers via `/^-?\d+(\.\d+)?$/` but has no boolean/null handling. The existing tests cover number editing, string editing, undefined rendering, and null *rendering* — but never test *editing* a boolean or null value. A test editing `true` → Enter should verify the stored value is string `"true"`, confirming D-002 is a real bug.
- **Recommendation**: Add test cases for boolean editing (`true` → verify string `"true"` stored) and null editing (`null` → verify type handling) to `config-tree.test.ts`.

**MC-006: No test for event payload mutation by reference (relates to D-011)**
- **File**: `tests/integration/dev-tools/event-bus-inspector.test.ts`
- **Severity**: Minor — D-011 is flagged as FIX (downgraded to Minor)
- Buffer stores `detail.payload` by reference at `event-bus-inspector.ts:196`. Existing tests emit payloads and verify display, but never test mutation after capture. A test could emit `{ value: 1 }`, mutate to `{ value: 2 }`, then verify the buffer entry reflects the mutation — confirming the bug exists.
- **Recommendation**: Add a regression test case to `event-bus-inspector.test.ts` that reproduces the reference-sharing bug.

**MC-007: No test for initDevTools concurrent call race (relates to D-007)**
- **File**: `tests/unit/dev-tools/dev-tools-singleton.test.ts`
- **Severity**: Minor — D-007 is flagged as FIX (downgraded to Minor)
- Singleton test at line 106 tests idempotency with sequential calls. There's no test for concurrent calls (`Promise.all([initDevTools(...), initDevTools(...)])`). The race depends on the `await import()` delay, making it hard to test without mocking dynamic imports. After the promise-based singleton fix, a concurrent test becomes feasible.
- **Recommendation**: Add concurrent init test after D-007 fix is implemented.

---

## Programmer Analysis Summary

**Total findings (unique)**: 59 (16 Dev Tools + 36 Documentation/Config/Test + 7 Foundation)
**Recommended FIX**: 22
**Recommended SKIP**: 37
**Recommended DISCUSS**: 0
**Duplicate findings consolidated**: D-032 (dup D-017), D-048 (dup D-007), D-049 (dup D-002), D-050 (dup D-011), D-051 (dup D-025), D-052 (dup D-024), D-058 (dup F-001), D-059 (dup D-026), F-005 (dup F-001), F-009 (dup F-003)

### Top Priority Fixes
1. **D-017/D-032** — Playwright port mismatch (5173 vs 5177); all e2e tests cannot connect
2. **D-013** — EventBus created after `CreateMainScene()`; GSM has no shared bus, Visualizer shows nothing
3. **D-008** — Keybind handler on `document` intercepts typing in config/event-filter inputs
4. **D-002** — Editing boolean/null config values silently coerces them to strings
5. **F-007** — `getHashes()` not fault-tolerant; one bad `hash()` crashes the entire panel
6. **F-003** — `_deepClone()` doesn't clone arrays; shared references in config objects
7. **D-011** — Event payloads stored by reference; emitter mutations retroactively change buffer entries
8. **D-004** — Live transition durations always show ~0ms due to synchronous event dispatch
9. **D-007** — `initDevTools()` race condition with `await` gap

### Lower Priority (worth fixing when convenient)
- **D-005**, **D-009**, **D-010**, **D-018**, **D-019**, **D-026**, **D-034**, **D-039**, **D-040**, **F-001**, **F-004**, **F-006** — Low-impact improvements or defensive changes

### Skipped (intentional design, no practical impact, or too vague)
- **D-001**, **D-003**, **D-006**, **D-012**, **D-014**, **D-016**, **D-020**, **D-021**, **D-022**, **D-023**, **D-024**, **D-025**, **D-027**, **D-028**, **D-029**, **D-030**, **D-031**, **D-033**, **D-035**, **D-036**, **D-037**, **D-038**, **D-041**, **D-042**, **D-043**, **D-044**, **D-045**, **D-046**, **D-047**, **D-051**, **D-052**, **D-053**, **D-054**, **D-055**, **D-056**, **D-057**, **D-060**, **F-002**, **F-008** — Intentional behavior, compiler-caught drift, standard patterns, or findings too vague to verify
- **F-005**, **F-009** — Duplicate findings (covered by F-001, F-003)

---

## Documentation & Config Findings

These findings affect documentation, configuration, and story files.

### D-017: E2E server port misconfigured

| Field | Value |
|-------|-------|
| **File** | `playwright.config.ts:16` |
| **Severity** | 🟠 Major |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Config |

**Finding**: E2E server port is misconfigured — Vite starts on default port but Playwright waits on a different port.

**Recommendation**: Ensure Vite `--port` matches Playwright's `webServer.port`.

**Status**: PENDING REVIEW

---

### D-018: Story 2-14 repeats `completed` with conflicting values

| Field | Value |
|-------|-------|
| **File** | `production/sprint-status.yaml:153` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Config |

**Finding**: Story 2-14 has duplicate `completed` keys; the later empty value overrides the real completion timestamp.

**Recommendation**: Remove the duplicate `completed` key.

**Status**: PENDING REVIEW

---

### D-019: Story 2-11 has duplicate `completed` keys

| Field | Value |
|-------|-------|
| **File** | `production/sprint-status.yaml:122` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Config |

**Finding**: Same issue as D-018 — duplicate `completed` key in YAML.

**Recommendation**: Remove the duplicate.

**Status**: PENDING REVIEW

---

### D-020: Smoke-test criterion requires unit tests for all stories

| Field | Value |
|-------|-------|
| **File** | `production/qa/qa-plan-sprint-02-2026-06-26.md:223` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Smoke-test criterion requires unit tests for all 42 stories, but some stories are Config/Data or Visual/Feel types that don't require unit tests.

**Recommendation**: Update criterion to match story type requirements.

**Status**: PENDING REVIEW

---

### D-021: Do not mark tech debt resolved without evidence

| Field | Value |
|-------|-------|
| **File** | `.opencode/skills/story-done/SKILL.md:370` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Tech debt is marked resolved when a file is modified, but modification doesn't prove the debt was addressed.

**Recommendation**: Require explicit evidence (e.g., the specific fix commit) before marking resolved.

**Status**: PENDING REVIEW

---

### D-022: Empty catch blocks hide initialization errors

| Field | Value |
|-------|-------|
| **File** | `src/playground/main-scene.ts:121` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Empty catch blocks hide real initialization errors and make failures non-diagnosable.

**Recommendation**: Log or rethrow the error.

**Status**: PENDING REVIEW

---

### D-023: Player Fantasy assigns overlay hide action to reload key

| Field | Value |
|-------|-------|
| **File** | `design/gdd/dev-tools.md:19` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: GDD says key 2 hides overlay, but implementation uses key 2 for config reload and key 3 for minimise.

**Recommendation**: Update GDD to match actual implementation.

**Status**: PENDING REVIEW

---

### D-024: Duplicated error isolation logic in event-bus.ts

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/event-bus.ts:175` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Error isolation logic is duplicated across multiple methods.

**Recommendation**: Extract to a shared helper.

**Status**: PENDING REVIEW

---

### D-025: reload() catch block silently absorbs errors

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:176` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: The catch block in `reload()` silently assigns an empty array instead of logging or rethrowing.

**Recommendation**: Log the error or rethrow.

**Status**: PENDING REVIEW

---

### D-026: JSDoc for `_deepClone` claims circular reference handling

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:362` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: JSDoc claims circular reference handling but the implementation doesn't handle circular references.

**Recommendation**: Update JSDoc to match actual behavior.

**Status**: PENDING REVIEW

---

### D-027: Document contains contradictory claims

| Field | Value |
|-------|-------|
| **File** | `production/epics/telemetry-recorder/story-005-telemetry-race-lifecycle.md:4` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Story document has contradictory claims about lifecycle behavior.

**Recommendation**: Resolve contradictions.

**Status**: PENDING REVIEW

---

### D-028: ARCHITECTURE.md keybind defaults mismatch

| Field | Value |
|-------|-------|
| **File** | `ARCHITECTURE.md:175` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: Toggle/reload/minimise defaults read `1/2/3` but the surrounding API docs describe `backtick/1/2`.

**Recommendation**: Update ARCHITECTURE.md to match actual keys.

**Status**: PENDING REVIEW

---

### D-029: STRUCTURE.md points to wrong GSM file

| Field | Value |
|-------|-------|
| **File** | `STRUCTURE.md:187` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: Points to `State.ts` but the GSM state type was consolidated into `gsm/types.ts`.

**Recommendation**: Update reference.

**Status**: PENDING REVIEW

---

### D-030: design/gdd/dev-tools.md overview is stale

| Field | Value |
|-------|-------|
| **File** | `design/gdd/dev-tools.md:13` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: Still describes old AI-telemetry / hot-reload / state-inspector surface, not the actual implementation.

**Recommendation**: Refresh overview to match actual Dev Tools surface.

**Status**: PENDING REVIEW

---

### D-031: ADR-0009 keybind mitigation is incomplete

| Field | Value |
|-------|-------|
| **File** | `docs/architecture/adr-0009-dev-tools.md:224` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: Mitigation only mentions `preventDefault()` once the overlay is active, but keybinds fire regardless of overlay state.

**Recommendation**: Document the full keybind behavior.

**Status**: PENDING REVIEW

---

### D-032: playwright.config.ts port mismatch

| Field | Value |
|-------|-------|
| **File** | `playwright.config.ts:13` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Config |

**Finding**: Same issue as D-017 — port configuration mismatch.

**Recommendation**: Same as D-017.

**Status**: PENDING REVIEW

---

### D-033: story-009-telemetry-provider.md keybind reference stale

| Field | Value |
|-------|-------|
| **File** | `production/epics/ai-driver/story-009-telemetry-provider.md:27` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: References `polled via DSM` which conflicts with updated Dev Tools rules.

**Recommendation**: Update reference.

**Status**: PENDING REVIEW

---

### D-034: story-002-input-keybinds.md keybind defaults mismatch

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-002-input-keybinds.md:40` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: ACs say backtick/1/2 but completion notes say DEV_TOOLS_KEYS uses 1/2/3.

**Recommendation**: Reconcile.

**Status**: PENDING REVIEW

---

### D-035: story-004-config-tree.md setRuntime ownership unclear

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-004-config-tree.md:55` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: Still reads like future work, but PR already ships `ConfigManager.setRuntime()`.

**Recommendation**: Update story to reflect implementation.

**Status**: PENDING REVIEW

---

### D-036: story-004-config-tree.md CSS refactor marked as follow-up

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-004-config-tree.md:152` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: Completion notes list inline styles as follow-up, but PR already replaced them with CSS.

**Recommendation**: Update completion notes.

**Status**: PENDING REVIEW

---

### D-037: story-009-css-refactor.md test evidence stale

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-009-css-refactor.md:150` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: Test Evidence section says "Status: Pending" but tests exist.

**Recommendation**: Update status.

**Status**: PENDING REVIEW

---

### D-038: story-001-physics-core-skeleton.md ACs need gating

| Field | Value |
|-------|-------|
| **File** | `production/epics/physics-handling/story-001-physics-core-skeleton.md:48` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: AC-3 and AC-6 read like active criteria even though the note says they're deferred.

**Recommendation**: Add explicit gates or defer markers.

**Status**: PENDING REVIEW

---

### D-039: html-overlay-evidence.md sign-off row empty

| Field | Value |
|-------|-------|
| **File** | `production/qa/evidence/html-overlay-evidence.md:49` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: Evidence table leaves approver blank.

**Recommendation**: Fill sign-off.

**Status**: PENDING REVIEW

---

### D-040: sprint-status-01.yaml missing completion date

| Field | Value |
|-------|-------|
| **File** | `production/sprint-status-01.yaml:61` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Config |

**Finding**: `status: done` with empty `completed` field breaks the sprint-status contract.

**Recommendation**: Populate completion date.

**Status**: PENDING REVIEW

---

### D-041: .github/workflows/tests.yml tree-shaking gate misses CSS/HTML

| Field | Value |
|-------|-------|
| **File** | `.github/workflows/tests.yml:35` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Config |

**Finding**: Tree-shaking gate only scans built `*.js` files, but PR also introduces Dev Tools CSS and markup.

**Recommendation**: Add CSS/HTML leak detection.

**Status**: PENDING REVIEW

---

### D-042: Empty catch blocks in main-scene.ts

| Field | Value |
|-------|-------|
| **File** | `src/playground/main-scene.ts:21` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Empty catch blocks hide real initialization errors.

**Recommendation**: Log or rethrow.

**Status**: PENDING REVIEW

---

### D-043: variables.css color value

| Field | Value |
|-------|-------|
| **File** | `src/styles/variables.css:44` |
| **Severity** | 🔵 Trivial |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Minor CSS value issue.

**Recommendation**: Verify and fix if needed.

**Status**: PENDING REVIEW

---

### D-044: dev-tools.ts:287 notification callback

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/dev-tools.ts:287` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Notification callback may not fire correctly.

**Recommendation**: Verify notification wiring.

**Status**: PENDING REVIEW

---

### D-045: sim-snapshot-panel.ts:129 assertion pattern

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/sim-snapshot-panel.ts:129` |
| **Severity** | 🔵 Trivial |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Assertion pattern may be too aggressive.

**Recommendation**: Verify assertion is necessary.

**Status**: PENDING REVIEW

---

### D-046: keybinds.ts:173 key handling

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/keybinds.ts:173` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Key handling may have edge cases.

**Recommendation**: Verify key handling logic.

**Status**: PENDING REVIEW

---

### D-047: gsm-visualizer.ts:215 render timing

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:215` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Render timing may cause flickering.

**Recommendation**: Verify render timing.

**Status**: PENDING REVIEW

---

### D-048: index.ts:75 init ordering

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/index.ts:75` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Init ordering may cause race conditions.

**Recommendation**: Verify init ordering.

**Status**: PENDING REVIEW

---

### D-049: config-tree.ts:295 edit handling

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/config-tree.ts:295` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: Edit handling may lose type information.

**Recommendation**: Verify type preservation.

**Status**: PENDING REVIEW

---

### D-050: event-bus-inspector.ts:198 payload handling

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/event-bus-inspector.ts:198` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: Same as D-011 — payload by reference.

**Recommendation**: Same as D-011.

**Status**: PENDING REVIEW

---

### D-051: config-manager.ts:176 reload error handling

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:176` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Same as D-025 — silent error absorption.

**Recommendation**: Same as D-025.

**Status**: PENDING REVIEW

---

### D-052: event-bus.ts:175 error isolation

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/event-bus.ts:175` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Same as D-024 — duplicated error isolation.

**Recommendation**: Same as D-024.

**Status**: PENDING REVIEW

---

### D-053: gsm.test.ts:2503 test assertion

| Field | Value |
|-------|-------|
| **File** | `tests/unit/gsm.test.ts:2503` |
| **Severity** | 🔵 Trivial |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |

**Finding**: Test assertion may be fragile.

**Recommendation**: Verify assertion robustness.

**Status**: PENDING REVIEW

---

### D-054: tech-debt-cleanup.test.ts:515 test coverage

| Field | Value |
|-------|-------|
| **File** | `tests/unit/tech-debt-cleanup.test.ts:515` |
| **Severity** | 🔵 Trivial |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |

**Finding**: Test coverage gap.

**Recommendation**: Add missing test.

**Status**: PENDING REVIEW

---

### D-055: vitest.config.ts:20 configuration

| Field | Value |
|-------|-------|
| **File** | `vitest.config.ts:20` |
| **Severity** | 🔵 Trivial |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Config |

**Finding**: Configuration may need adjustment.

**Recommendation**: Verify configuration.

**Status**: PENDING REVIEW

---

### D-056: dev-tools.test.ts:808 test assertion

| Field | Value |
|-------|-------|
| **File** | `tests/unit/dev-tools/dev-tools.test.ts:808` |
| **Severity** | 🔵 Trivial |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |

**Finding**: Test assertion may be fragile.

**Recommendation**: Verify assertion robustness.

**Status**: PENDING REVIEW

---

### D-057: telemetry-recorder.ts:336 telemetry validation

| Field | Value |
|-------|-------|
| **File** | `src/dev-infra/telemetry-recorder.ts:336` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Telemetry validation may be incomplete.

**Recommendation**: Verify validation logic.

**Status**: PENDING REVIEW

---

### D-058: event-bus.ts:248 wildcard handling

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/event-bus.ts:248` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Same as F-001 — wildcard handling.

**Recommendation**: Same as F-001.

**Status**: PENDING REVIEW

---

### D-059: config-manager.ts:362 deep clone JSDoc

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:362` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Same as D-026 — JSDoc mismatch.

**Recommendation**: Same as D-026.

**Status**: PENDING REVIEW

---

### D-060: sprint-02.md:89 sprint documentation

| Field | Value |
|-------|-------|
| **File** | `production/sprints/sprint-02.md:89` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Sprint documentation may be stale.

**Recommendation**: Update sprint documentation.

**Status**: PENDING REVIEW

---

## Decision Table (Documentation & Config)

| ID | Decision | Rationale |
|----|----------|-----------|
| D-017 | FIX | Valid — Major. Vite default port is 5173 (`vite.config.ts` has no port config) but Playwright waits on 5177 (`playwright.config.ts:10,17`). All e2e tests fail because Playwright can't connect. Fix: add `server.port: 5177` to `vite.config.ts` or change Playwright to 5173. |
| D-018 | FIX | Minor. `completed` key appears twice in story 2-14 YAML block (lines 158 and 162). The second empty value overrides the real completion date `"2026-06-27"`. YAML duplicate key — remove the errant `completed: ""` at line 162. |
| D-019 | FIX | Minor. Same pattern as D-018 — `completed` key appears twice in story 2-11 YAML block (lines 127 and 131). The second empty value overrides the real date. Remove `completed: ""` at line 131. |
| D-020 | SKIP | Minor. The criterion "All 42 stories have passing unit tests" is aspirational and doesn't account for Config/Data or Visual/Feel story types. However, it's a smoke-test gate in a QA plan document — overly broad but harmless. Updating it is a process documentation task, not a code issue. |
| D-021 | SKIP | Minor. The Story-Done skill marks tech debt resolved when a referenced file was modified by the story. This is an approximate heuristic in a process-automation skill, not production code. Acceptable as-is — the tech debt register is intended for human review alongside automated checks. |
| D-022 | SKIP | Minor. The empty catch blocks at lines 129-131, 137-139, 164-166 are intentional guards for DEV-only playground singleton initialization ("ConfigManager may already be initialized"). Adding logging would produce console noise during normal dual-init paths. |
| D-023 | SKIP | Minor. The GDD text at line 19 says "reload key (default: 1) and the overlay disappears" — loosely describing the visual side effect of reload. The GDD correctly documents the reload key elsewhere (line 27). Minor doc wording imprecision, not a code issue. |
| D-024 | SKIP | Minor. The error-isolation logic (checking/rethrowing `EventBusError("Max emit depth exceeded")`) is duplicated across the typed-handler and wildcard-handler emit paths (~6 lines each). The duplication is clear and localized — extracting a helper would add indirection for minimal gain. |
| D-025 | SKIP | Minor. The empty catch in `reload()` (line 241) catches `_buildResolved()` failures per-namespace. The comment explains: "Namespace stays without resolved cache; next get() will attempt rebuild on demand." This is intentional soft-fail behavior, not silent error swallowing. |
| D-026 | FIX | Trivial. JSDoc at line 361 claims "Circular references are detected and replaced with a placeholder." Implementation at lines 374-376 throws an `Error("Circular reference detected")`, not a placeholder. Update JSDoc to match actual throwing behavior. |
| D-027 | SKIP | Trivial. Story header says "Status: Complete" but AC checkboxes are still `[ ]` (not checked). The Completion Notes confirm 5/5 passing with test evidence. Empty checkboxes are a formatting convention in the story template — not a contradiction in lifecycle behavior. |
| D-028 | SKIP | Minor. `ARCHITECTURE.md` mentions keys 1/2/3 alongside API docs that reference the older backtick/1/2 convention. The actual code correctly uses 1/2/3. Documentation staleness — should be updated when someone touches ARCHITECTURE.md next, but not blocking. |
| D-029 | SKIP | Trivial. `STRUCTURE.md` line 183 correctly lists `src/foundation/simulation-snapshot/simulation-snapshot.ts` — the finding's reference to `State.ts` may refer to a stale PR version. The current STRUCTURE.md file paths are accurate. |
| D-030 | SKIP | Trivial. The GDD overview at lines 11-28 accurately describes the four Dev Tools features. The mention of "AI Telemetry" and "State Inspector" matches the implemented panels. No concrete inaccuracy found. |
| D-031 | SKIP | Trivial. ADR-0009 documents the decision to use DOM keydown, not the full behavioral spec. The keybind behavior when overlay is inactive is an implementation detail (in `keybinds.ts`), not an ADR scope. No impact. |
| D-032 | FIX | Valid — Major. Duplicate of D-017 with a different line reference. Same root cause: port mismatch between Vite (5173) and Playwright (5177). Fix via D-017. |
| D-033 | SKIP | Trivial. The story references "toggle/reload keys polled via DSM" which was from an early design phase before Dev Tools switched to DOM keydown. Stale reference in a different epic's story file — harmless. |
| D-034 | FIX | Minor. Story ACs at lines 36-39 describe backtick/1/2 but the implementation ships 1/2/3. The Completion Notes correctly note this discrepancy. Update AC-2a and AC-6a/b to match the actual keybind mapping. |
| D-035 | SKIP | Trivial. The Implementation Note at line 55 says "should be done as part of this story" — this is standard doc wording. The method was implemented in the PR. The story is Complete with evidence. Nothing to fix. |
| D-036 | SKIP | Trivial. Completion Notes at line 149 correctly document the advisory about inline styles as the state at completion time. The CSS refactor was later addressed in Story 009. Correct historical record. |
| D-037 | SKIP | Trivial. The Test Evidence section at lines 149-150 is already populated with test count, screenshots, and code review status. The finding appears to reference a stale version of the file. |
| D-038 | SKIP | Minor. The story already has a Dependency note at line 48 explaining that AC-3 and AC-6 are deferred until the Entity/Car Lifecycle epic. The `[ ]` checkboxes are consistent with "not yet verified." Adding explicit gate markers would be redundant. |
| D-039 | FIX | Trivial. QA Lead sign-off row is empty (line 49). Fill in the approver details to complete the evidence document. |
| D-040 | FIX | Minor. Story 1-4 has `status: done` but `completed: ""` (line 60). This breaks the sprint-status contract — status and completed should be consistent. Populate the completion date. |
| D-041 | SKIP | Minor. The tree-shaking gate at lines 30-35 scans `dist/ --include="*.js"` for Dev Tools string patterns. CSS/HTML files don't contain the JS patterns being checked. The current gate correctly verifies no Dev Tools code leaks into the production JS bundle. |
| D-042 | SKIP | Minor. Duplicate of D-022. The empty catch blocks at lines 129-131, 137-139, 164-166 are intentional playground singletons in DEV-only code. |
| D-043 | SKIP | Trivial. The `--dt-accent: #ffd700` at line 44 is a deliberate gold accent for the Dev Tools debug palette, documented with a clear comment. No issue found — the finding is too vague to verify. |
| D-044 | SKIP | Trivial. Line 287 is `this._tabBar = null;` inside `dispose()` — standard cleanup. No notification callback visible at this location. The finding is too vague to verify. |
| D-045 | SKIP | Trivial. Line 129 is `this._container.innerHTML = "";` inside `dispose()`. Standard DOM cleanup, not an assertion. Finding provides no concrete evidence. |
| D-046 | SKIP | Trivial. Line 173 calls `cm.reload()` with proper null-check guard at lines 168-171. No edge case visible. The finding is too vague to verify. |
| D-047 | SKIP | Trivial. Line 215 sets `this._currentState` from history. Not a render-timing issue. The finding is too vague to verify. |
| D-048 | FIX | Minor. Lines 73-75: race condition between `if (_instance) return` guard and `await import()`. Already covered by D-007 — same root cause. |
| D-049 | FIX | Minor. Lines 293-295: `_finishEdit` parses numbers but passes booleans and null through as strings. Already covered by D-002 — same root cause. |
| D-050 | FIX | Minor. Line 196 uses `payload: detail.payload` stored by reference. Already covered by D-011 — same root cause. |
| D-051 | SKIP | Minor. Duplicate of D-025. Empty catch in `reload()` is intentional soft-fail behavior. |
| D-052 | SKIP | Minor. Duplicate of D-024. Error isolation is duplicated but localized and clear. |
| D-053 | SKIP | Trivial. Lines 2503-2509 test history has exactly 20 entries after 25 transitions. This is a stable assertion against a configurable ring buffer. No fragility evidence. |
| D-054 | SKIP | Trivial. Lines 514-518 test get() with disabled stack traces. The test already covers this edge case. No coverage gap evident. |
| D-055 | SKIP | Trivial. Line 20 excludes `src/**/index.ts` from coverage. This is a standard pattern — barrel files have no meaningful logic to cover. No issue. |
| D-056 | SKIP | Trivial. Lines 807-813 test graceful error handling when ConfigManager is not initialized. The assertion `not.toThrow()` is clear and correct. No fragility evidence. |
| D-057 | SKIP | Trivial. Line 336 is `if (tickCount % this._sampleInterval !== 0) return;` — standard sampling logic. The finding is too vague to verify a validation issue. |
| D-058 | FIX | Minor. Lines 246-253: `getSubscriptions()` only iterates `_handlers`, not `_wildcardHandlers`. Already covered by F-001 — same root cause. |
| D-059 | FIX | Trivial. Lines 361-362: JSDoc claims circular references are "replaced with a placeholder" but implementation throws. Already covered by D-026 — same root cause. |
| D-060 | SKIP | Trivial. Line 89 lists "Dev Tools 002: Input Keybinds | 3h | #8" in the sprint plan. The sprint doc is a planning artifact — its content depends on when it was frozen. No concrete staleness evidence. |
