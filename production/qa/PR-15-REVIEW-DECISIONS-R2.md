# PR #15 — Review Decisions for User Approval (Round 2)

**PR**: [#15 feat(sprint-02): foundation lint cleanup + dev tools](https://github.com/johnatas-henrique/overdrive/pull/15)
**Generated**: 2026-06-28
**Total Findings**: 125 (unique issues: 109, duplicates: 16)
**Status**: Awaiting user decisions

---

## How to Use This Document

For each finding, three opinions are provided:
- **Engineer**: Analysis from the programmer subagent
- **QA**: Analysis from the QA tester subagent
- **Orchestrator**: My synthesis of both opinions

**Your task**: For each finding, change the `[X]` if you disagree with the pre-filled decision:
- `[X]` **FIX** — Implement the change
- `[X]` **SKIP** — Leave as-is
- `[X]` **DISCUSS** — Need more information before deciding

Pre-filled decisions reflect majority opinion (2/3 agreement). Only change what you disagree with.

---

## Summary

| Epic | FIX | SKIP | DISCUSS | Total |
|------|-----|------|---------|-------|
| Dev Tools | 14 | 28 | 6 | 48 |
| Telemetry | 2 | 4 | 1 | 7 |
| Tech Debt | 8 | 43 | 3 | 54 |
| **Total** | **24** | **75** | **10** | **109** |

---

## Dev Tools Findings (DT-001 to DT-054)

### DT-001: Duplicate IReadOnlyEventBus type

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:44` |
| **Severity** | 🟡 Medium |
| **Engineer** | DISCUSS — Both `gsm-visualizer.ts:41-44` and `event-bus-inspector.ts:39-42` define identical `Pick<IEventBus, "on" | "off" | "getSubscriptions">` types. True duplication. Export from `event-bus-inspector.ts` and import in `gsm-visualizer.ts`. Pure refactor, no behavior change. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | DISCUSS — True code duplication worth discussing for refactoring priority, but no functional impact. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### DT-002: Boolean coercion in config-tree editing (duplicates: DT-025)

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/config-tree.ts:293` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Code already parses "true"/"false" → boolean, "null" → null, and numeric strings → Number. No remaining issue. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Already implemented correctly. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-003: Duration display incorrect for transitions

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:299` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Code uses `_stateEntryTime` (set on state enter) for all non-first transitions. Finding's claim is incorrect for the general case. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Engineer analysis confirms implementation is correct. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### DT-004: .ssn-container missing display:flex

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/dev-tools.css:501` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — CSS already has `display: flex; flex-direction: column;`. No missing property. Finding based on outdated code review. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Already implemented correctly. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### DT-005: Player Fantasy key conflict

| Field | Value |
|-------|-------|
| **File** | `design/gdd/dev-tools.md` |
| **Severity** | 🔵 Low |
| **Engineer** | DISCUSS — Documentation error in GDD. Hotkey assignment conflicts with other spec sections. Needs design decision on correct key mapping. Document-only, no code impact. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | DISCUSS — Needs design decision on correct key mapping before code or docs can align. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### DT-006: pointer-events test doesn't verify CSS property

| Field | Value |
|-------|-------|
| **File** | `tests/unit/core/dev-tools/dev-tools.test.ts:444` |
| **Severity** | 🟡 Medium |
| **Engineer** | SKIP — Test checks element ID presence, not computed style. Adding CSS property verification is a test improvement, not a bug. |
| **QA** | FIX — Test name asserts `pointer-events: none` CSS but body only checks `overlay.id === "dev-overlay"`. Should verify the CSS rule exists or skip the assertion if environment can't support it. |
| **Orchestrator** | FIX — QA identified a real test gap. The assertion should match the test name or be explicitly documented as a limitation. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-007: initDevTools concurrent safety (duplicates: DT-028, DT-037)

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/index.ts:75` |
| **Severity** | 🟡 Medium |
| **Engineer** | DISCUSS — Guard at line 75 checks `_instance || _initializing`. Second concurrent caller returns early before dynamic import resolves. `getDevTools()` called by that caller would throw. Acceptable for single-call startup. Mark DISCUSS for adding promise-awaiting guard. |
| **QA** | FIX — No test covers concurrent `initDevTools()`. Race condition means tests doing parallel import + init could flake. |
| **Orchestrator** | FIX — QA's test infrastructure concern elevates this. A promise-awaiting guard would prevent flaky tests and make the API safer. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-008: Non-transition events in history

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:311` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Recording all entered events gives complete history. Filtering would be an enhancement, not a bug. History already shows correct transition data. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Intentional display choice that shows complete history. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### DT-009: Default keybind values shifted (duplicates: DT-024, TD-025)

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/dev-tools-config.ts:30` |
| **Severity** | 🟡 Medium |
| **Engineer** | FIX — Interface JSDoc documents toggle=backtick, reload=1, minimise=2, but actual values are `toggle:"1", reload:"2", minimise:"3"`. Change values to match docs (backtick/1/2). |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | FIX — Documented contract mismatch will confuse users and breaks sprint AC references. Should align config to documented values. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### DT-010: pageerror listener after first keyPress

| Field | Value |
|-------|-------|
| **File** | `tests/e2e/dev-tools.spec.ts` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — E2E test pattern issue. Registering listener earlier reduces flakiness but test still catches target assertions. |
| **QA** | FIX — `pageerror` listener registered AFTER `openDevTools()` in `beforeEach`. Errors from overlay toggle are missed. |
| **Orchestrator** | FIX — QA identified a real test robustness concern. Moving registration before `openDevTools()` is a low-effort fix. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-011: TR-DVT-007 documents wrong keys

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/EPIC.md:29` |
| **Severity** | 🔵 Low |
| **Engineer** | DISCUSS — EPIC.md documents backtick/1/2 but config ships 1/2/3. Blocked on DT-009 resolution. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | DISCUSS — Documentation alignment dependent on DT-009 resolution. Blocked item. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### DT-012: Disposed instances can be toggled back

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/dev-tools.ts:308` |
| **Severity** | 🟡 Medium |
| **Engineer** | FIX — `dispose()` sets `_initialized=false`, `toggle()` calls `_initOverlay()` when `!_initialized` but does NOT recreate SceneInstrumentation or frame observer. After dispose → toggle, overlay appears but metrics never update. |
| **QA** | FIX — Tests covering `dispose()` → `toggle()` flow are absent. Both a code bug and test infrastructure gap. |
| **Orchestrator** | FIX — Both engineer and QA agree. Disposed instance can be re-toggled into a broken state with non-functional metrics. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-013: dispose() clears innerHTML in DEV=false

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/sim-snapshot-panel.ts:128` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — In DEV=false mode, `dispose()` still runs `this._container.innerHTML = ""`. Crash-safety edge case if container is shared. DevTools is never constructed in production. Low risk. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Low-risk edge case; DevTools never constructed in production. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### DT-014: DevTools CSS variables in shared variables.css

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/variables.css:44` |
| **Severity** | 🔵 Low |
| **Engineer** | DISCUSS — Variables at `variables.css:44-54` (`--dt-*`) are DevTools-specific debug colors in shared file because `dev-tools.css` imports it. Prefixed with `--dt-` clearly separating from game palette. Acceptable as-is. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Clear `--dt-` naming convention sufficiently separates concerns. Moving would require duplication. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### DT-015: _handleReload() doesn't handle cm.reload() failures

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/keybinds.ts:185` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — `ConfigManager.reload()` does not throw (iterates namespaces in try/catch, returns array). The outermost `getConfigManager()` IS wrapped in try/catch. Safe already. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Code is safe; `reload()` never throws. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### DT-016: Mock implementation leak

| Field | Value |
|-------|-------|
| **File** | `tests/unit/core/dev-tools/dev-tools.test.ts:808` |
| **Severity** | 🟡 Medium |
| **Engineer** | DISCUSS — `vi.mock()` with throwing `getConfigManager` persists past `vi.clearAllMocks()`. Vitest doesn't reset mock factories. Real test isolation concern. |
| **QA** | FIX — Mock implementation persists after `vi.clearAllMocks()`. Test at line 847-866 explicitly works around this, confirming the leak exists. |
| **Orchestrator** | FIX — Both identify a real Vitest gotcha that leaks mock implementations between tests. Should use `vi.restoreAllMocks()` or reset in `afterEach`. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-017: State transition map reload key

| Field | Value |
|-------|-------|
| **File** | `design/gdd/dev-tools.md:38` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — GDD documentation inconsistency. Document-level issue, no code impact. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Part of broader keybinding doc cluster; no code impact. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-018: Overview outdated

| Field | Value |
|-------|-------|
| **File** | `design/gdd/dev-tools.md:13` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — GDD description predates final architecture. Document now describes tabs that differ from original AI-telemetry/hot-reload description. Pure documentation staleness. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Documentation staleness with no code impact. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-019: Hotkey interception ADR

| Field | Value |
|-------|-------|
| **File** | `docs/architecture/adr-0009-dev-tools.md:245` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — ADR describes `preventDefault()` for toggle key. Implementation at `keybinds.ts:144-147` already calls `event.preventDefault()`. ADR may be slightly stale but implementation is correct. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Implementation is correct; ADR staleness is minor. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-020: Keybind defaults contradiction

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-002-input-keybinds.md` |
| **Severity** | 🔵 Low |
| **Engineer** | DISCUSS — Story completion notes say DEV_TOOLS_KEYS has backtick/1/2, but actual config is 1/2/3. Story marked complete with contradictory data. Needs resolution aligned with DT-009. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Minor documentation discrepancy; will be resolved when DT-009 is fixed. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### DT-021: setRuntime() ownership

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-004-config-tree.md:55` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Story reads like future work but PR ships `ConfigManager.setRuntime()`. Minor documentation timing issue. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Minor story documentation timing issue. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-022: CSS class refactor stale note

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-004-config-tree.md:152` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Completion notes list inline styles as follow-up but PR already ships CSS classes. Documentation staleness. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Documentation no longer needs the follow-up note. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-023: Stale pending evidence note

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-009-css-refactor.md:150` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Test evidence says pending but story is marked complete. Documentation alignment issue. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Story metadata needs update; no code impact. |

**Decision**: `[ ` FIX `[X]` SKIP `[ ]` DISCUSS

---

### DT-026: Snapshot payloads at capture time

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/event-bus-inspector.ts:208` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Code already uses `structuredClone(detail.payload)` to deep-clone. Fix is already in place. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Already implemented correctly. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### DT-027: Live duration metric

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:216` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Code uses `_stateEntryTime` (set on state enter) for primary calculation. Falls back to `_pendingExit` only when `_stateEntryTime === 0` (first transition). Finding is factually incorrect about the implementation. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Engineer analysis confirms correct implementation. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### DT-029: Ignore shortcuts inside editable controls

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/keybinds.ts:163` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Guard at lines 132-140 already checks for INPUT/TEXTAREA/contentEditable. Missing `<select>` is a minor gap, rarely used in dev tools. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Guard already covers the main cases. Minor gap is acceptable. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-030: Don't crash on missing hash

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/sim-snapshot-panel.ts` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Code uses `currentHashes.get(system.systemId)` with `"error"` fallback. `SimulationSnapshot.getHashes()` uses per-system try/catch. Already robust. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Already handles missing hashes gracefully. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### DT-031: Type simulationSnapshot to ISimulationSnapshot

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/types.ts` |
| **Severity** | 🟡 Medium |
| **Engineer** | FIX — `IDevTools` declares `setSimulationSnapshot(snapshot: ISimulationSnapshot)`. But `DevTools` class stores `_simulationSnapshot: SimulationSnapshot | null`, not `ISimulationSnapshot`. Change internal type for API consistency. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | FIX — Type consistency improves API quality and catches interface contract violations at compile time. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-032: Fixed startup sleep

| Field | Value |
|-------|-------|
| **File** | `tests/e2e/dev-tools.spec.ts:65` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — `page.waitForTimeout(2000)` is a test robustness issue. Replace with readiness wait. Enhancement, not bug. |
| **QA** | FIX — Fixed sleep in every `beforeEach` slows CI and flakes if engine startup exceeds 2s. Should wait for a DOM ready signal. |
| **Orchestrator** | FIX — QA's CI flakiness concern is valid. Replacing with a readiness wait is low effort and improves test reliability. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-033: Duplicate meta-finding from coderabbitai

| Field | Value |
|-------|-------|
| **File** | `tests/e2e/dev-tools.spec.ts:383` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Umbrella finding. Individual issues covered by DT-019, DT-024, DT-025, DT-026, DT-027, DT-029, DT-051, DT-053, DT-054. |
| **QA** | SKIP — DUPLICATE. References DT-010, DT-024, DT-025, DT-026, DT-027, DT-029, DT-051, DT-053, DT-054. No unique test issue. |
| **Orchestrator** | SKIP — Aggregate meta-finding; all individual issues tracked separately. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### DT-034: DEV env isolation failure

| Field | Value |
|-------|-------|
| **File** | `tests/integration/core/dev-tools/sim-snapshot-panel.test.ts:83` |
| **Severity** | 🔴 High |
| **Engineer** | FIX — `beforeAll` sets DEV=true, `afterEach` runs `vi.unstubAllEnvs()`. After first test, DEV env is popped and subsequent tests run without DEV=true. Change `beforeAll` to `beforeEach`. |
| **QA** | FIX — After first test completes, DEV env is popped and all subsequent tests run without DEV=true. Critical test isolation bug. |
| **Orchestrator** | FIX — Both agree. All tests after the first run in wrong mode. Must fix. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-035: First transition near-zero duration

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:103` |
| **Severity** | 🔵 Low |
| **Engineer** | DISCUSS — `_stateEntryTime` starts at 0. On first transition, duration falls back to `_pendingExit.timestamp` gap (~0ms). Can seed during `_seedFromGsmHistory()`. Low impact since visualizer is typically opened well after transitions start. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | DISCUSS — Real edge case but low impact. Worth discussing whether to fix or document as known limitation. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### DT-036: ADR contradictory input behavior

| Field | Value |
|-------|-------|
| **File** | `docs/architecture/adr-0009-dev-tools.md:92` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — ADR document inconsistency about "never intercept" vs interactive overlay regions. Documentation issue, no code impact. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — ADR inconsistency has no code impact. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-038: AI Telemetry tab doesn't activate

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/dev-tools.ts:557` |
| **Severity** | 🟡 Medium |
| **Engineer** | FIX — `_createAiTelemetryTab()` does NOT call `_switchTab()` after creating the tab. If AI Telemetry is the first/only tab (when event bus and GSM are null), no tab is activated and panel stays hidden. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | FIX — Hidden panel is a functional bug when AI Telemetry is the only available tab. Easy fix. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-039: Fragile cleanup in singleton test

| Field | Value |
|-------|-------|
| **File** | `tests/unit/core/dev-tools/dev-tools-singleton.test.ts:151` |
| **Severity** | 🟡 Medium |
| **Engineer** | FIX — `vi.unstubAllEnvs()` in test body (not `afterEach`) won't run on assertion failure. Leaks DEV=false to downstream tests. |
| **QA** | FIX — If assertion fails, DEV=false stub persists to sibling tests. Must move to `afterEach`. |
| **Orchestrator** | FIX — Both agree. Cleanup must be in `afterEach` to run regardless of test outcome. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-040: Duplicate tab creation pattern

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/dev-tools.ts:528` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Four tab creation methods follow nearly identical patterns. Extracting a helper would reduce duplication but each has different wiring. Acceptable duplication for clarity. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Intentional duplication for readability; each method has distinct wiring. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### DT-041: Last Updated date (duplicates: DT-049)

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-008-ai-telemetry-tab.md:5` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Documentation metadata date vs completion date mismatch. Low severity. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Minor metadata date mismatch. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-042: Test Evidence path nonexistent

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-008-ai-telemetry-tab.md:120` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Documented test path doesn't match actual file layout. Documentation hygiene. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Documentation path needs update; no code impact. |

**Decision**: `[X]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### DT-043: Coverage gap test

| Field | Value |
|-------|-------|
| **File** | `tests/unit/core/dev-tools/input-keybinds.test.ts:429` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Test asserts `createElement('input').tagName === 'INPUT'` which tests DOM API, not production code. Harmless but weak. The actual input guard logic IS tested elsewhere. |
| **QA** | FIX — Tests `createElement('input').tagName === 'INPUT'` — a DOM API guarantee that never fails. Does not test the actual input-focus skip guard in `handleKeyDown`. Self-identifies as a gap. |
| **Orchestrator** | FIX — QA correctly identifies this as a coverage gap. The test should cover `handleKeyDown`'s actual skip logic, not DOM API guarantees. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-044: Fall back to live payload after clone failure

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/event-bus-inspector.ts:201` |
| **Severity** | 🔵 Low |
| **Engineer** | DISCUSS — On `structuredClone` failure, code stores the raw reference, preserving mutation bug for uncloneable payloads. Low severity since uncloneable payloads (DOM nodes, functions) are uncommon. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | DISCUSS — Real but low-severity edge case. Worth discussing whether to store placeholder instead of raw reference. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### DT-045: Nonexistent duplicate YAML key

| Field | Value |
|-------|-------|
| **File** | `production/qa/PR-15-REVIEW.md:1319` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Refers to a line in the previous review document referencing a non-existent YAML key. Documentation-only. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Reference to outdated review content; no code impact. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### DT-046: Test name contradicts assertion (duplicates: DT-053)

| Field | Value |
|-------|-------|
| **File** | `tests/e2e/dev-tools.spec.ts:744` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Test name says "shows empty state" but assertion verifies empty state is hidden during mock data. Naming issue, not a functional bug. |
| **QA** | FIX — Test named "empty state shows when no AI cars" but asserts `.ait-empty` is `display: none` (hidden) while mock telemetry with 3 cars exists. Never drives with 0-car data. |
| **Orchestrator** | FIX — QA identified a real testing gap. The empty state branch is never exercised. Test should either test actual empty state or be renamed. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-047: Hardcoded player car ID

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/ai-telemetry-panel.ts:259` |
| **Severity** | 🔵 Low |
| **Engineer** | DISCUSS — Code checks `car.carId === "player-1"` to style player rows. Only becomes a bug when same process renders multiple players. Acceptable for MVP. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Acceptable for MVP. Only problematic in multi-player rendering, which isn't in scope. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-048: Validate sampleRate before modulo

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/ai-telemetry-panel.ts:130` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — `sampleRate` has constructor default value. sampleRate of 0 causes `(tickCounter - 1) % 0 === NaN` returning false, so refresh never fires. But 0 is not valid user input. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Defensive concern for developer-only configuration; not a user-facing bug. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-050: Completion notes vs Test Evidence

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-008-ai-telemetry-tab.md:121` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Story says complete but Test Evidence says "Not yet created". Documentation needs alignment. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Documentation alignment issue; story metadata needs update. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### DT-051: Skip first live refresh

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/ai-telemetry-panel.ts:132` |
| **Severity** | 🔵 Low |
| **Engineer** | DISCUSS — `refresh()` skips first call, so data may be stale when tab becomes visible. Constructor already renders initial data. Enhancement to consider removing the tick-1 guard. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | DISCUSS — Real enhancement opportunity but not a bug. Consider removing the guard so first refresh renders fresh data. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### DT-052: Dispose existing singleton before reset

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/index.ts:138` |
| **Severity** | 🟡 Medium |
| **Engineer** | FIX — `_resetDevToolsForTesting()` only nulls `_instance` and `_initializing`. Old DevTools still has DOM mounted and listeners attached. Tests calling `initDevTools()` again get duplicate DOM/observers. |
| **QA** | FIX — `resetDevTools()` only nulls references, doesn't call `dispose()`. DOM and listeners from old instances leak between tests. |
| **Orchestrator** | FIX — Both agree. Call `_instance?.dispose()` before nulling the reference. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### DT-054: Event bus inspector integration test meta

| Field | Value |
|-------|-------|
| **File** | `tests/integration/core/dev-tools/event-bus-inspector.test.ts:914` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Meta-finding. Individual issues covered by DT-019, DT-024, DT-025, DT-026, DT-027, DT-029, DT-033, DT-051, DT-053. |
| **QA** | SKIP — DUPLICATE. References DT-019 et al. No unique issue beyond what's individually tracked. |
| **Orchestrator** | SKIP — Aggregate meta-finding; all individual issues tracked separately. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

## Telemetry Findings (TEL-001 to TEL-007)

### TEL-001: Contradictory claims

| Field | Value |
|-------|-------|
| **File** | `production/epics/telemetry-recorder/story-005-telemetry-race-lifecycle.md:4` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Completion notes say tests exist and pass but Test Evidence says "Not yet created". Documentation alignment issue. |
| **QA** | DISCUSS — Story claims both "12 tests passing, 5/5 criteria" and "Status: Not yet created" in Test Evidence. Contradictory state makes evidence untrustworthy. |
| **Orchestrator** | DISCUSS — Contradictory documentation state needs resolution. Actual test file exists with substantive tests, so Test Evidence should be updated to match reality. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### TEL-002: Sampling continues when recording disabled

| Field | Value |
|-------|-------|
| **File** | `src/dev-infra/telemetry-recorder.ts:362` |
| **Severity** | 🟡 Medium |
| **Engineer** | FIX — `tick()` uses `tickCount % this._sampleInterval` to sample. `_isRecording` flag only gates `printConsoleSummary()`, not sampling. After `setRecording(false)`, sample data continues to be captured. Add `if (!this._isRecording) return;` before sampling block. |
| **QA** | FIX — Sampling continues when recording is disabled. There is no test verifying that `setRecording(false)` prevents sample capture. |
| **Orchestrator** | FIX — Both agree. Data captured after recording is disabled violates the recording contract. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TEL-003: Include tick/t in sampling contract

| Field | Value |
|-------|-------|
| **File** | `production/epics/telemetry-recorder/story-002-telemetry-sampling-loop.md:37` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Story verification mentions 11 CarEntity-derived fields but not tick/t. `tick()` populates both. Story should expand its sampling contract list. No code issue. |
| **QA** | DISCUSS — Sampling contract only verifies 11 of 13 CarEntity-derived fields. Tick and timestamp are not asserted in sampling tests. |
| **Orchestrator** | SKIP — Code correctly populates all fields. Documentation expansion is low priority and tests already cover the data flow. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TEL-004: Don't clear unrelated listeners

| Field | Value |
|-------|-------|
| **File** | `src/dev-infra/telemetry-recorder.ts` |
| **Severity** | 🟡 Medium |
| **Engineer** | SKIP — Current code uses `eventBus.off(sub)` (subscription handle), not `off(event)`. Only removes its own handlers. Comment at line 256 explicitly documents this was fixed. |
| **QA** | FIX — The telemetry-lifecycle test validates subscription count doesn't double but does NOT verify unrelated handlers survive re-init. |
| **Orchestrator** | FIX — QA identified a real test gap. The code uses subscription handles correctly, but the missing test assertion means a regression could go undetected. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TEL-005: Validate telemetry intervals

| Field | Value |
|-------|-------|
| **File** | `src/dev-infra/telemetry-recorder.ts:318` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Constructor already validates parameters: throws `RangeError` if `sampleInterval <= 0` or `logInterval <= 0`. Validation is already in place. |
| **QA** | FIX — No validation of telemetry interval at construction. Passing 0 silently disables sampling/logging. No test rejects invalid intervals. |
| **Orchestrator** | SKIP — Code already validates parameters with RangeError. QA's test gap concern is valid but constructor validation exists. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TEL-006: Complete decision rows

| Field | Value |
|-------|-------|
| **File** | `production/qa/PR-15-REVIEW.md:110` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Document has blank decision rows. Being resolved by this analysis. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Being resolved by this document generation. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TEL-007: Fill missing verdicts

| Field | Value |
|-------|-------|
| **File** | `production/qa/PR-15-REVIEW.md:112` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Blank decisions in the document. Being resolved by this analysis. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Being resolved by this document generation. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

## Tech Debt Findings (TD-001 to TD-064)

### TD-001: getSubscriptions() omits wildcard handlers (duplicates: TD-005, TD-037)

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/event-bus.ts:208` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Code already includes wildcard handlers in snapshot (lines 253-258). Fix was applied (F-001 comment references the issue). No remaining issue. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Already fixed. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-002: E2E server port misconfiguration (duplicates: TD-026)

| Field | Value |
|-------|-------|
| **File** | `playwright.config.ts:16` |
| **Severity** | 🔴 High |
| **Engineer** | FIX — `playwright.config.ts:16` specifies `npm run dev` which starts Vite on default port 5173, but `baseURL` is set to `http://localhost:5177` and `port: 5177`. Change command to `npm run dev -- --port 5177`. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | FIX — Port mismatch breaks e2e tests in CI. Must fix. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### TD-003: off(event) returns IEventBus, allows emit through chaining (duplicates: TD-038)

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/types.ts:203` |
| **Severity** | 🟡 Medium |
| **Engineer** | DISCUSS — `IEventBus.off(event)` returns `IEventBus`, enabling chaining like `bus.off("race.started").emit(...)`. The return type is a standard fluent pattern. Changing to `void` would be a breaking change. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | DISCUSS — API design decision. Fluent pattern is conventional but the chaining-to-emit concern is valid. Worth discussing before next major version. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### TD-004: DevTools GSM not wired to eventBus

| Field | Value |
|-------|-------|
| **File** | `src/app.ts:33` |
| **Severity** | 🔴 High |
| **Engineer** | FIX — `app.ts:32-34` creates the EventBus before `CreateMainScene()`. But GSM at `main-scene.ts:135` uses its own internal EventBus. Pass the shared `eventBus` to GSM constructor so visualizer receives events. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | FIX — GSM not connected to shared EventBus breaks the visualizer. Must fix. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-006: Duplicate completed key for story 2-14 (duplicates: TD-032)

| Field | Value |
|-------|-------|
| **File** | `production/sprints/sprint-status.yaml:152` |
| **Severity** | 🟡 Medium |
| **Engineer** | FIX — Lines 157 and 161 both have `completed:` keys under story 2-14. YAML parser uses the last value (empty string), making the story appear incomplete. Remove duplicate empty `completed` at line 161. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | FIX — Duplicate YAML key causes incorrect sprint status. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-007: Duplicate completed key for story 2-11

| Field | Value |
|-------|-------|
| **File** | `production/sprints/sprint-status.yaml:122` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Only one `completed` key visible at line 127. Duplicate may have been fixed already, or finding refers to different line. No duplicate found. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — No duplicate found in current file state. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-008: Smoke-test criterion impossible (duplicates: TD-030)

| Field | Value |
|-------|-------|
| **File** | `production/qa/qa-plan-sprint-02-2026-06-26.md` |
| **Severity** | 🟡 Medium |
| **Engineer** | DISCUSS — QA plan requires "unit tests for all 42 stories" but includes manual-only stories. Need to decide: relax the gate or separate automated/manual requirements. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | DISCUSS — QA gate criteria need refinement to separate automated from manual test requirements. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### TD-009: Tech debt resolved without evidence

| Field | Value |
|-------|-------|
| **File** | `.opencode/skills/story-done/SKILL.md:370` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Framework skill documentation improvement. Not specific to this PR's code. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Framework skill issue, not specific to this PR. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-010: Empty catch blocks

| Field | Value |
|-------|-------|
| **File** | `src/main-scene.ts:129` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Empty catch blocks at lines 129, 138, 164 swallow exceptions silently. Code comments say these are expected-to-often-throw blocks. Empty catch is intentional. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Intentional; these are expected-failure try blocks. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-011: Duplicated error isolation in emit()

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/event-bus.ts:175` |
| **Severity** | 🔵 Low |
| **Engineer** | DISCUSS — Lines 175-195 (typed handlers) and 198-217 (wildcard handlers) have identical try-catch-rethrow patterns. Could extract into a helper function. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Code duplication is acceptable for clarity; extracting helper adds complexity with minimal benefit for two call sites. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-012: reload() catch assumes stale cache cleared

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:176` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — On catch, the resolved cache for that namespace stays stale. The next `get()` call re-attempts `_buildResolved()`. Stale cache is a one-call window. Low impact. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — One-call stale window is acceptable; next get() rebuilds. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-013: _deepClone shallow copy arrays

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Code uses `structuredClone()` which correctly deep-clones arrays. No array shallow-copy issue. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Already using `structuredClone()` correctly. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-014: JSDoc mentions circular placeholder but throws

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts` |
| **Severity** | 🔵 Low |
| **Engineer** | DISCUSS — JSDoc at line 362 says "Circular references are detected and throw an error". Code uses `structuredClone()` which throws on circular refs. The JSDoc is accurate. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — JSDoc accurately describes behavior; circular refs do throw. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-015: Dev Tools dependency mapping conflict

| Field | Value |
|-------|-------|
| **File** | `production/sprints/sprint-02.md:89` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Sprint plan dependency ordering documentation. No code impact. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Sprint plan documentation only; no code impact. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-016: src/**/index.ts coverage exclusion

| Field | Value |
|-------|-------|
| **File** | `vitest.config.ts:20` |
| **Severity** | 🟡 Medium |
| **Engineer** | FIX — `vitest.config.ts:20` excludes `"src/**/index.ts"` from coverage. This hides barrel files which may contain runtime logic (e.g., `src/core/dev-tools/index.ts` exports `initDevTools`). |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | FIX — Coverage exclusion hides barrel file logic. Either remove the exclusion or specifically exclude only type-only barrel files. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-017: Error.prototype.stack patching leak

| Field | Value |
|-------|-------|
| **File** | `tests/unit/tech-debt-cleanup.test.ts` (actual: `config-manager.test.ts:1120`) |
| **Severity** | 🟡 Medium |
| **Engineer** | DISCUSS — Tests patch `Error.prototype.stack` but don't restore it properly when the property descriptor returns undefined. The `if` guard skips restore, leaving throw accessor active. Needs try/finally pattern. |
| **QA** | FIX — Referenced file does not exist (misfiled). The Error.prototype.stack leak concern is real: restore guards with `if (origStack)` which can skip restore on environments without native stack. |
| **Orchestrator** | FIX — Real test isolation concern. Should use try/finally for Error.prototype.stack patching. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-018: Status summary stale

| Field | Value |
|-------|-------|
| **File** | `production/sprints/sprint-status-01.yaml` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Summary comment says 24 ready but file marks 29 as done. Documentation metadata out of date. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Metadata staleness, no code impact. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-019: Redundant test

| Field | Value |
|-------|-------|
| **File** | `tests/unit/foundation/gsm/gsm.test.ts:2503` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Two tests do the same 25-transition → 20-length assertion. Redundant but harmless. |
| **QA** | FIX — "should keep only last 20" is a subset of "should drop first 5 entries". Both call `performTransitions(25)` and assert `toHaveLength(20)`. First test adds FIFO order assertion. Second adds zero new coverage. |
| **Orchestrator** | SKIP — Redundant but harmless; removing adds review overhead for negligible benefit. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-020: Checklist excludes DT-004-008 as N/A

| Field | Value |
|-------|-------|
| **File** | `production/qa/qa-plan-sprint-02.md:177` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — QA scope decision. No code impact. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — QA scope decision, no code impact. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-021: initDevTools not awaited (duplicates: TD-062)

| Field | Value |
|-------|-------|
| **File** | `src/app.ts:49` |
| **Severity** | 🟡 Medium |
| **Engineer** | FIX — `app.ts:49` calls `initDevTools()` without `await`. Inside an async function `_bootstrap`, error would be an unhandled promise rejection. Add `await`. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | FIX — Unhandled promise rejection from unawaited async call. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-022: Mutable singletons in main-scene

| Field | Value |
|-------|-------|
| **File** | `src/main-scene.ts:21` |
| **Severity** | 🔵 Low |
| **Engineer** | DISCUSS — `_gsm` and `_snapshot` are module-level mutable variables. Couple `CreateMainScene` to external consumers via hidden state. Acceptable for playground but not production. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | DISCUSS — Architectural concern worth addressing before production phase, but acceptable for MVP playground. |

**Decision**: `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

---

### TD-023: D5 behavior incorrect in story (duplicates: TD-027)

| Field | Value |
|-------|-------|
| **File** | `production/epics/telemetry-recorder/story-009-telemetry-provider.md` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Story documents key handling as DeviceSourceManager polling but implementation uses DOM keydown. Documentation needs update for accuracy. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Story documentation mismatch; no code impact. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-024: Tree-shaking gate misses CSS/HTML

| Field | Value |
|-------|-------|
| **File** | `.github/workflows/tests.yml:35` |
| **Severity** | 🔵 Low |
| **Engineer** | DISCUSS — Workflow only scans built JS files for dev-tools identifiers. CSS and HTML identifiers might leak. Enhancement to CI gate, not a code bug. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Enhancement to CI gate, not a code bug. Low priority. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-028: Gate lifecycle-dependent ACs

| Field | Value |
|-------|-------|
| **File** | `production/epics/physics-core/story-001-physics-core-skeleton.md:48` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — AC-3 and AC-6 depend on lifecycle epic which has no implementation stories. Documentation needs to mark them as gated. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Story documentation marking issue; no code impact. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-029: Fill required sign-off row

| Field | Value |
|-------|-------|
| **File** | `tests/integration/html-overlay-evidence.md` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Evidence table missing approver name. QA process documentation. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — QA process documentation; no code impact. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-031: Populate completion date

| Field | Value |
|-------|-------|
| **File** | `production/sprints/sprint-status-01.yaml:61` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Story is `status: done` with empty `completed` field. Needs a date or status change. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Minor metadata field; no functional impact. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-033: Create shared EventBus before CreateMainScene

| Field | Value |
|-------|-------|
| **File** | `src/app.ts` |
| **Severity** | 🔴 High |
| **Engineer** | FIX — `app.ts:32-34` creates EventBus BEFORE `CreateMainScene()`. GSM created at `main-scene.ts:135` uses its own internal bus. Without this connection, the GSM visualizer never receives any events. Same fix as TD-004. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | FIX — Same as TD-004. GSM not connected to shared EventBus — the visualizer never receives events. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-034: Report newly added keys during reload diffs

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:256` |
| **Severity** | 🔵 Low |
| **Engineer** | DISCUSS — `reload()` at lines 251-256 only iterates the pre-reload snapshot. Keys present in `newValues` but not in `snapshot` are silently missed from the diff. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Edge case in reload diff; low impact since keys present in newValues but not in snapshot are rare. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-035: _deepClone match JSON-serializable contract

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:393` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Code uses `structuredClone()` which correctly handles arrays and JSON-serializable types. Post-processing restores `undefined`. Code is correct. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Implementation is correct. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-036: Re-export ConfigManager public API from barrel

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/index.ts` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Barrel exports `ConfigManager`, `getConfigManager`, `setConfigManager`, `ConfigChange`, `DebugState`. All public API members are accessible. No missing exports. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Barrel is complete; no missing exports. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-039: SecurityError in save/load degraded transitions

| Field | Value |
|-------|-------|
| **File** | `src/foundation/persistence/persistence.ts:373` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — `load()` doesn't call `setItem` so can't get SecurityError. Low severity; adding SecurityError check for consistency would be minor improvement. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — `load()` can't trigger SecurityError; consistency check would be nice but not required. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-040: Isolate bad hash() in getHashes

| Field | Value |
|-------|-------|
| **File** | `src/dev-infra/simulation-snapshot.ts:441` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — `getHashes()` already uses per-system try/catch. A failing `system.hash()` is caught, logged, and marked `"error"`. Fix is already implemented. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Already implemented correctly. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-041: Point GSM changes at types.ts

| Field | Value |
|-------|-------|
| **File** | `docs/architecture/STRUCTURE.md` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Documentation path points to removed file (`State.ts`) instead of `types.ts`. Documentation update needed. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Documentation path needs update; no code impact. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-042: PR review fetches only review comments

| Field | Value |
|-------|-------|
| **File** | `.opencode/skills/pr-review-epic/SKILL.md:14` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Framework skill documentation. The command fetches only review comments, missing conversation comments. Not specific to this PR. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Framework skill issue; not specific to this PR. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-043: _deepClone without cycle tracking

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:388` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Uses `structuredClone()` which natively handles cycles by throwing. The `_buildResolved()` caller catches the throw. Code is correct. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — `structuredClone()` handles cycles natively; caught upstream. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-044: Undefined variables

| Field | Value |
|-------|-------|
| **File** | `tests/unit/foundation/determinism/determinism.test.ts:2577` |
| **Severity** | 🔵 Low |
| **Engineer** | FIX — Test references `__origMathRandom`, `__origDateNow`, `__origPerfNow` that are not defined in scope. Will cause ReferenceError at runtime. |
| **QA** | SKIP — Variables ARE defined at lines 2063-2065 (module-level, in a different describe block). They are accessible. No ReferenceError will occur. However, sharing mutable module-level state across describe blocks is architecturally fragile. |
| **Orchestrator** | SKIP — Variables exist at module level and are accessible. QA confirms no ReferenceError occurs. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-045: Hardcoded quality gate

| Field | Value |
|-------|-------|
| **File** | `.opencode/skills/pr-review-epic/SKILL.md:222` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Framework skill improvement. Not specific to this PR's code. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Framework skill issue; not specific to this PR. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-046: SecurityError test doesn't restore in afterEach

| Field | Value |
|-------|-------|
| **File** | `tests/unit/foundation/persistence/persistence.test.ts:4` |
| **Severity** | 🔵 Low |
| **Engineer** | DISCUSS — Test sets up localStorage access restrictions inline. If test fails, `afterEach` doesn't restore it, leaking to sibling describes. |
| **QA** | SKIP — All localStorage mocking uses `vi.stubGlobal("localStorage", ...)` which IS cleaned by `vi.unstubAllGlobals()` in `afterEach` (line 69). No inline restore is needed. |
| **Orchestrator** | SKIP — `afterEach` already calls `vi.unstubAllGlobals()` which cleans up the mock. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-047: Summary total incorrect

| Field | Value |
|-------|-------|
| **File** | `production/qa/PR-15-REVIEW-DECISIONS.md:34` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Document data integrity — summary counts don't match rows. Will be reconciled by this analysis. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Being resolved by this document generation. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-048: Duplicate table contradicts originals

| Field | Value |
|-------|-------|
| **File** | `production/qa/PR-15-REVIEW-DECISIONS.md:641` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Document has duplicate decision table with contradictory values. Needs deduplication and reconciliation. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Being resolved by this document generation (single authoritative table). |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-049: Test paths missing core/ segment

| Field | Value |
|-------|-------|
| **File** | `docs/architecture/STRUCTURE.md:30` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — STRUCTURE.md documents `tests/unit/dev-tools/` but actual layout is `tests/unit/core/dev-tools/`. Documentation update needed. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Documentation path mismatch; no code impact. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-050: Guard always triggers in V8

| Field | Value |
|-------|-------|
| **File** | `tests/unit/foundation/config/config-manager.test.ts:1127` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Test guard checks `Error.prototype.stack` which exists in V8/Node.js, making the test a silent no-op on the target platform. |
| **QA** | SKIP — Guard `if (Error.prototype.stack === undefined) { return; }` does NOT trigger in V8. In standard V8, `Error.prototype.stack` is a defined getter returning a string, so the guard does NOT trigger. Designed for non-V8 environments. |
| **Orchestrator** | SKIP — Guard does not trigger in V8; test runs normally on target platform. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-051: _deepClone redundant re-clone

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:373` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — `_deepClone` uses `structuredClone()` first, then recursively restores `undefined` values. The recursive call at line 388 re-processes nested objects already cloned. Redundant but harmless. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Redundant but harmless; low priority optimization. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-052: QA Lead sign-off missing name

| Field | Value |
|-------|-------|
| **File** | `tests/integration/html-overlay-evidence.md:49` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — QA evidence document missing approver name. Process documentation. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — QA process documentation; no code impact. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-053: Verdict counts don't match (duplicates: TD-060)

| Field | Value |
|-------|-------|
| **File** | `production/qa/PR-15-REVIEW.md:310` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Summary blocks disagree with per-item table. Will be reconciled by this analysis. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Being resolved by this document generation. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-054: Duplicate helpers in persistence test

| Field | Value |
|-------|-------|
| **File** | `tests/unit/foundation/persistence/persistence.test.ts` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — `createWorkingStorage()` is defined ONCE at module level (line 17). `setLocalStorage` doesn't exist in this file. The function is called from 90+ tests but only defined once. |
| **QA** | SKIP — `createWorkingStorage()` is defined once, not 3x as claimed. `setLocalStorage` doesn't exist in this file (0 grep matches). |
| **Orchestrator** | SKIP — Helper is defined once, correctly reused. No duplicate. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-055: SKIP count incorrect

| Field | Value |
|-------|-------|
| **File** | `production/qa/PR-15-REVIEW-DECISIONS.md:713` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Document count vs listed IDs mismatch. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Being resolved by this document generation. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-056: Total Findings value stale

| Field | Value |
|-------|-------|
| **File** | `production/qa/PR-15-REVIEW-DECISIONS.md:5` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Stated total disagrees with document's own totals. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Being resolved by this document generation. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-057: Fix exception comment

| Field | Value |
|-------|-------|
| **File** | `src/foundation/persistence/persistence.ts:364` |
| **Severity** | 🟡 Medium |
| **Engineer** | FIX — Comment at line 363 says `// quota exhaustion` but code catches `SecurityError`. QuotaExceededError is a separate DOMException. Comment at line 363 is misleading and should be corrected. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | FIX — Misleading comment could confuse future maintainers. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-058: Deferred-finding template mismatch

| Field | Value |
|-------|-------|
| **File** | `.opencode/skills/pr-review-epic/SKILL.md:215` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Skill template doesn't match tech-debt-register.md column format. Framework documentation. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Framework skill issue; not specific to this PR. |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS

---

### TD-059: Keep DevTools contract docs complete

| Field | Value |
|-------|-------|
| **File** | `docs/architecture/ARCHITECTURE.md:176` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — ARCHITECTURE.md missing AI Telemetry panel and `update()` method from IDevTools methods list. Documentation needs updating. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Documentation needs update; no code impact. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-061: Clarify counting convention

| Field | Value |
|-------|-------|
| **File** | `production/qa/PR-15-REVIEW-DECISIONS.md:6` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — Total vs category count mismatch — duplicates inclusion unclear. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Being resolved by this document generation. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-063: Document AI Telemetry panel location

| Field | Value |
|-------|-------|
| **File** | `docs/architecture/STRUCTURE.md:94` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — STRUCTURE.md missing ai-telemetry-panel.ts and its test file. Documentation update needed. |
| **QA** | SKIP — No test implications identified. |
| **Orchestrator** | SKIP — Documentation needs update; no code impact. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---

### TD-064: Rules conflict with layout

| Field | Value |
|-------|-------|
| **File** | `tests/unit/README.md:33` |
| **Severity** | 🔵 Low |
| **Engineer** | SKIP — README rule requires one test per source file but layout shows multiple telemetry-*.test.ts files. Documentation needs updating. |
| **QA** | DISCUSS — Rule #1 ("One file per system") conflicts with the example tree showing multiple `telemetry-*.test.ts` files under `dev-infra/`. Contributors get contradictory guidance. |
| **Orchestrator** | SKIP — README rule is aspirational; the actual layout is established and functional. Low priority alignment. |

**Decision**: `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS

---
