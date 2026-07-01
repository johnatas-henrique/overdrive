# PR #15 Review — Dev Tools

**PR**: [#15 feat(sprint-02): foundation lint cleanup + dev tools](https://github.com/johnatas-henrique/overdrive/pull/15)
**Review Date**: 2026-06-28
**Reviewers**: coderabbitai, cubic-dev-ai, greptile-apps
**Total Comments in PR**: 125
**Comments in this Epic**: 54

---

## Findings
### DT-001: IReadOnlyEventBus is defined identically in both gsm-visualizer.ts and...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:44` |
| **Severity** | 🟡 Medium |
| **Reviewer** | greptile-apps[bot] |
| **Category** | Code |

**Finding**: IReadOnlyEventBus is defined identically in both gsm-visualizer.ts and event-bus-inspector.ts. Having two copies means a future change to either (e.g., adding the wildcard on("*", ...) overload) must be applied in both places to stay in sync. Export it from event-bus-inspector.ts and import it here.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-002: In-place edit coerces booleans to strings, changing config value types at runtime....

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/config-tree.ts:—` |
| **Severity** | 🔴 High |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |
| **Duplicate of** | #DT-025 — same issue reported by coderabbitai |

**Finding**: In-place edit coerces booleans to strings, changing config value types at runtime. Confirming true/false values writes "true"/"false" instead of booleans.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### DT-003: Duration display is incorrect for live transitions because it uses exited→entered event...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:—` |
| **Severity** | 🔴 High |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Duration display is incorrect for live transitions because it uses exited→entered event gap, not GSM transition duration.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### DT-004: .ssn-container is missing display: flex, so its flex-direction and child flex: 1 rules do...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/dev-tools.css:501` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Config |

**Finding**: .ssn-container is missing display: flex, so its flex-direction and child flex: 1 rules do not apply. This breaks the intended full-height systems list/control layout in the Sim Snapshot tab.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-005: Player Fantasy assigns overlay hide action to reload key, conflicting with the rest of...

| Field | Value |
|-------|-------|
| **File** | `design/gdd/dev-tools.md:19` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Player Fantasy assigns overlay hide action to reload key, conflicting with the rest of the spec. This can drive incorrect keybinding implementation and e2e expectations.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-006: pointer-events test doesn't verify the CSS property — only checks element ID, which...

| Field | Value |
|-------|-------|
| **File** | `tests/unit/core/dev-tools/dev-tools.test.ts:444` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |

**Finding**: pointer-events test doesn't verify the CSS property — only checks element ID, which doesn't validate pointer-events: none

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-007: initDevTools() is not safe under concurrent calls despite the idempotent contract....

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/index.ts:—` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: initDevTools() is not safe under concurrent calls despite the idempotent contract. Overlapping calls can create multiple DevTools instances and leak frame observers.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-008: History includes non-transitions because every gsm.state.entered event is recorded,...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:311` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: History includes non-transitions because every gsm.state.entered event is recorded, including rollback re-entry events (from === to).

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-009: Default keybind values are shifted and do not match the documented contract in this file....

| Field | Value |
|-------|-------|
| **File** | `src/config/dev-tools-config.ts:30` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Default keybind values are shifted and do not match the documented contract in this file. This remaps controls unexpectedly (backtick no longer toggles) or leaves docs/spec incorrect.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-010: pageerror listener registered after first keyPress — misses errors from earlier...

| Field | Value |
|-------|-------|
| **File** | `tests/e2e/dev-tools.spec.ts:—` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |

**Finding**: pageerror listener registered after first keyPress — misses errors from earlier operation. Register before any key actions and use a scoped cleanup pattern.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-011: TR-DVT-007 documents wrong default keys; it conflicts with configured defaults.

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/EPIC.md:29` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: TR-DVT-007 documents wrong default keys; it conflicts with configured defaults.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-012: Disposed instances can be toggled back on, but metrics never update after reopen....

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/dev-tools.ts:308` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Disposed instances can be toggled back on, but metrics never update after reopen. _initOverlay() does not recreate instrumentation/frame observer that dispose() removed.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-013: dispose() unconditionally clears this._container.innerHTML even when the constructor's...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/sim-snapshot-panel.ts:128` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: dispose() unconditionally clears this._container.innerHTML even when the constructor's DEV=false path never initialized DOM, risking destruction of sibling content in a shared container. The panel should only mutate DOM it created.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-014: DevTools-specific debug variables (--dt-*) leaked into the shared variables.css file that...

| Field | Value |
|-------|-------|
| **File** | `src/styles/variables.css:44` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Config |

**Finding**: DevTools-specific debug variables (--dt-*) leaked into the shared variables.css file that is documented as the Art Bible palette source of truth consumed by both dev-tools and game UI.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-015: _handleReload() does not handle cm.reload() failures, so a reload key press can raise an...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/keybinds.ts:185` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: _handleReload() does not handle cm.reload() failures, so a reload key press can raise an uncaught exception. Catch reload errors and fail gracefully (optionally notify) instead of crashing the handler.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-016: Mock implementation leak — getConfigManager throwing persists past vi.clearAllMocks(),...

| Field | Value |
|-------|-------|
| **File** | `tests/unit/core/dev-tools/dev-tools.test.ts:808` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |

**Finding**: Mock implementation leak — getConfigManager throwing persists past vi.clearAllMocks(), creating ordering-dependent test fragility if constructor/toggle calls getConfigManager

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-017: State transition maps reload key to entering Inspector state, contradicting reload...

| Field | Value |
|-------|-------|
| **File** | `design/gdd/dev-tools.md:38` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: State transition maps reload key to entering Inspector state, contradicting reload behavior defined elsewhere. This can mislead flow implementation and test-state modeling.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### DT-018: _📐 Maintainability & Code Quality_ | _🟠 Major_ | _⚡ Quick win_ **Refresh the overview...

| Field | Value |
|-------|-------|
| **File** | `design/gdd/dev-tools.md:13` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: _📐 Maintainability & Code Quality_ | _🟠 Major_ | _⚡ Quick win_ **Refresh the overview to match the actual Dev Tools surface.** This still describes the old AI-telemetry / hot-reload / state-inspector trio. The current stack splits telemetry into src/dev-infra/ and adds Event Bus Inspector, GSM Visualizer, and Simulation Snapshot panels instead.

**Recommendation**: Resolve before merging. Update the affected file per the finding.

**Status**: PENDING REVIEW

### DT-019: _🎯 Functional Correctness_ | _🟠 Major_ | _⚡ Quick win_ **Intercept the hotkeys before...

| Field | Value |
|-------|-------|
| **File** | `docs/architecture/adr-0009-dev-tools.md:245` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |
| **Duplicate of** | #DT-033, #DT-054 — same issue reported by coderabbitai |

**Finding**: _🎯 Functional Correctness_ | _🟠 Major_ | _⚡ Quick win_ **Intercept the hotkeys before the overlay becomes visible.** The mitigation only mentions preventDefault() once the overlay is active, but the toggle key has to be consumed on the first press to open the UI without leaking into gameplay. Please make the DOM listener own toggle/reload in both states.

**Recommendation**: Resolve before merging. Update the affected file per the finding.

**Status**: PENDING REVIEW

### DT-020: _📐 Maintainability & Code Quality_ | _🟠 Major_ | _⚡ Quick win_ **Reconcile the keybind...

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-002-input-keybinds.md:—` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: _📐 Maintainability & Code Quality_ | _🟠 Major_ | _⚡ Quick win_ **Reconcile the keybind defaults before marking this story complete.** The ACs say backtick/1/2, but the completion notes say DEV_TOOLS_KEYS still uses 1/2/3. That leaves this story in a contradictory state: "Complete" while knowingly out of sync with its contract. Please either align the config/tests or keep the story open until the documented defaults match.

**Recommendation**: Resolve before merging. Update the affected file per the finding.

**Status**: PENDING REVIEW

### DT-021: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Clarify setRuntime()...

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-004-config-tree.md:55` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Clarify setRuntime() ownership.** This still reads like future work, but the PR already ships ConfigManager.setRuntime() in the foundation layer and marks this story complete. Rephrase it as a dependency on the existing API so the tracker doesn't contradict itself.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-022: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Mark the CSS-class...

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-004-config-tree.md:152` |
| **Severity** | 🔵 Low |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Mark the CSS-class refactor as resolved.** The completion notes still list inline styles as follow-up work, but this PR already replaces them with CSS classes/variables. Leaving the advisory open makes the story look unfinished.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### DT-023: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Replace the stale...

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-009-css-refactor.md:150` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Replace the stale pending evidence note.** The Test Evidence section still says Status: Pending — test file to be created, but the Completion Notes mark the story complete. Please align the artifact so the evidence status matches the final state.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-024: _🎯 Functional Correctness_ | _🟠 Major_ | _⚡ Quick win_ **Fix the default key map to...

| Field | Value |
|-------|-------|
| **File** | `src/config/dev-tools-config.ts:32` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |
| **Duplicate of** | #DT-033, #DT-054 — same issue reported by coderabbitai |

**Finding**: _🎯 Functional Correctness_ | _🟠 Major_ | _⚡ Quick win_ **Fix the default key map to match the declared contract.** This constant ships 1/2/3, but the surrounding API docs and sprint docs describe the defaults as backtick / 1 / 2. That makes the runtime keybinds differ from the documented behavior.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### DT-025: _🎯 Functional Correctness_ | _🟠 Major_ | _⚡ Quick win_ **Preserve non-numeric primitive...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/config-tree.ts:—` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |
| **Duplicate of** | #DT-002, #DT-033, #DT-054 — same issue reported by cubic-dev-ai, coderabbitai |

**Finding**: _🎯 Functional Correctness_ | _🟠 Major_ | _⚡ Quick win_ **Preserve non-numeric primitive types during edits.** This branch turns every non-numeric input into a string. Editing a boolean/null config like enabled: true to false will persist "false" instead of false, so downstream truthiness checks keep behaving as enabled.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### DT-026: _🎯 Functional Correctness_ | _🟠 Major_ | _⚡ Quick win_ **Snapshot payloads at capture...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/event-bus-inspector.ts:208` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |
| **Duplicate of** | #DT-033, #DT-054 — same issue reported by coderabbitai |

**Finding**: _🎯 Functional Correctness_ | _🟠 Major_ | _⚡ Quick win_ **Snapshot payloads at capture time.** The buffer stores detail.payload by reference. If the publisher mutates that object after emit, older log rows will show the latest state instead of the state that triggered the event, which makes the history unreliable.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### DT-027: _🎯 Functional Correctness_ | _🟠 Major_ | _⚡ Quick win_ **The live duration metric is...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:216` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |
| **Duplicate of** | #DT-033, #DT-054 — same issue reported by coderabbitai |

**Finding**: _🎯 Functional Correctness_ | _🟠 Major_ | _⚡ Quick win_ **The live duration metric is measuring transition latency, not time-in-state.** _pendingExit.timestamp is captured on gsm.state.exited, then subtracted from Date.now() on gsm.state.entered. That only measures the gap between the two events, so a state that lasted minutes will usually display 0- ms.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### DT-028: _🩺 Stability & Availability_ | _🟠 Major_ | _⚡ Quick win_ **Serialize initDevTools() so...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/index.ts:83` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: _🩺 Stability & Availability_ | _🟠 Major_ | _⚡ Quick win_ **Serialize initDevTools() so the singleton contract survives concurrent calls.** Lines 71-72 guard only the pre-await path. If two callers enter initDevTools() before the first import resolves, both will construct DevTools and both will run the side effects here; the later assignment merely overwrites the earlier instance after its observer/listener work has already happened.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### DT-029: _🎯 Functional Correctness_ | _🟠 Major_ | _⚡ Quick win_ **Ignore Dev Tools shortcuts...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/keybinds.ts:163` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |
| **Duplicate of** | #DT-033, #DT-054 — same issue reported by coderabbitai |

**Finding**: _🎯 Functional Correctness_ | _🟠 Major_ | _⚡ Quick win_ **Ignore Dev Tools shortcuts while focus is inside an editable control.** Because this listener sits on document, pressing the bound keys inside the Config Tree's inline editor will currently toggle/reload/minimise the overlay instead of entering text. Bail out for input, textarea, select, and contentEditable targets before reading the shortcut key.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### DT-030: _🩺 Stability & Availability_ | _🟠 Major_ | _⚡ Quick win_ **Don't crash the panel when...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/sim-snapshot-panel.ts:—` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: _🩺 Stability & Availability_ | _🟠 Major_ | _⚡ Quick win_ **Don't crash the panel when one system hash is unavailable.** SimulationSnapshot.getHashes() was hardened to be fault-tolerant, so a registered system can legitimately be missing from the returned map. defined(currentHash, ...) turns that recoverable case into a full render failure for the whole panel. Please degrade that row to an "unavailable" hash / — diff instead of asserting.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### DT-031: _📐 Maintainability & Code Quality_ | _🟠 Major_ | _⚡ Quick win_ **Type the public...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/types.ts:—` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: _📐 Maintainability & Code Quality_ | _🟠 Major_ | _⚡ Quick win_ **Type the public snapshot dependency to ISimulationSnapshot.** IDevTools currently exposes the concrete SimulationSnapshot class across its public boundary, even though the foundation layer already exports ISimulationSnapshot for this contract. That concrete coupling is also why the tests have to cast fake snapshots to never. Accept the interface here so mocks and alternate implementations stay assignable.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### DT-032: _🩺 Stability & Availability_ | _🔵 Trivial_ | _⚡ Quick win_ **Replace the fixed startup...

| Field | Value |
|-------|-------|
| **File** | `tests/e2e/dev-tools.spec.ts:65` |
| **Severity** | 🔵 Low |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Test |

**Finding**: _🩺 Stability & Availability_ | _🔵 Trivial_ | _⚡ Quick win_ **Replace the fixed startup sleep with a readiness wait.** page.waitForTimeout(2000) slows the suite and still flakes if startup takes longer than 2s. Wait on a stable ready signal instead and reuse that helper across the repeated beforeEach blocks.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### DT-033: _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_

| Field | Value |
|-------|-------|
| **File** | `tests/e2e/dev-tools.spec.ts:383` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Test |
| **Duplicate of** | #DT-019, #DT-024, #DT-025, #DT-026, #DT-027, #DT-029, #DT-051, #DT-053, #DT-054 — same issue reported by coderabbitai |

**Finding**: _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-034: beforeAll + afterEach(vi.unstubAllEnvs) creates test isolation failure — DEV env is only...

| Field | Value |
|-------|-------|
| **File** | `tests/integration/core/dev-tools/sim-snapshot-panel.test.ts:83` |
| **Severity** | 🔴 High |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |

**Finding**: beforeAll + afterEach(vi.unstubAllEnvs) creates test isolation failure — DEV env is only set for the first test, lost for all subsequent tests

**Recommendation**: Resolve before merging. Update the affected file per the finding.

**Status**: PENDING REVIEW

### DT-035: First captured transition can still show near-zero duration because _stateEntryTime is...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/gsm-visualizer.ts:103` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: First captured transition can still show near-zero duration because _stateEntryTime is not seeded from existing GSM history/current state. Initialize entry time during history seeding so first post-open transition duration is correct.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-036: ADR now contains contradictory input behavior requirements. Clarify that interactive...

| Field | Value |
|-------|-------|
| **File** | `docs/architecture/adr-0009-dev-tools.md:92` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: ADR now contains contradictory input behavior requirements. Clarify that interactive overlay regions are an explicit exception or update the earlier "never intercept" constraint.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-037: Concurrent init calls are not serialized correctly: later callers return before...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/index.ts:75` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Concurrent init calls are not serialized correctly: later callers return before initialization completes. This can cause immediate getDevTools()/devTools access to throw in startup races.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-038: AI Telemetry tab creation does not activate any tab, so the panel stays hidden when it is...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/dev-tools.ts:557` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: AI Telemetry tab creation does not activate any tab, so the panel stays hidden when it is the first/only tab.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-039: Fragile cleanup: vi.unstubAllEnvs() in test body won't run on assertion failure, leaving...

| Field | Value |
|-------|-------|
| **File** | `tests/unit/core/dev-tools/dev-tools-singleton.test.ts:151` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |

**Finding**: Fragile cleanup: vi.unstubAllEnvs() in test body won't run on assertion failure, leaving DEV=false for downstream tests. Also pops beforeAll's DEV=true stub, breaking explicit env isolation.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-040: _createAiTelemetryTab() duplicates the identical tab creation pattern already present in...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/dev-tools.ts:528` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: _createAiTelemetryTab() duplicates the identical tab creation pattern already present in _createEventLogTab(), _createGsmHistoryTab(), and _createSimSnapshotTab() instead of extracting a shared helper.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-041: Update Last Updated to match the completion edit date; current metadata predates the...

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-008-ai-telemetry-tab.md:5` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |
| **Duplicate of** | #DT-049 — same issue reported by coderabbitai |

**Finding**: Update Last Updated to match the completion edit date; current metadata predates the newly added completion notes.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### DT-042: Fix the Test Evidence path; the documented test file path does not exist, making the...

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-008-ai-telemetry-tab.md:120` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Fix the Test Evidence path; the documented test file path does not exist, making the completion evidence hard to verify.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### DT-043: Coverage gap test doesn't test any production code. Asserts trivial DOM API guarantees...

| Field | Value |
|-------|-------|
| **File** | `tests/unit/core/dev-tools/input-keybinds.test.ts:429` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |

**Finding**: Coverage gap test doesn't test any production code. Asserts trivial DOM API guarantees (createElement('input').tagName === 'INPUT'), not the actual keybind input-focus skip guard in handleKeyDown.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### DT-044: Do not fall back to the live payload reference after clone failure; it preserves the same...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/event-bus-inspector.ts:201` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Do not fall back to the live payload reference after clone failure; it preserves the same mutation bug for uncloneable payloads. Store a placeholder or other detached representation instead.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### DT-045: D-019 documents a nonexistent duplicate YAML key. This sends follow-up work to remove a...

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/PR-15-REVIEW.md:1319` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: D-019 documents a nonexistent duplicate YAML key. This sends follow-up work to remove a line that is already absent and makes the review-decision record unreliable.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### DT-046: Test name contradicts what the body asserts: it verifies .ait-empty is display: none...

| Field | Value |
|-------|-------|
| **File** | `tests/e2e/dev-tools.spec.ts:744` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |

**Finding**: Test name contradicts what the body asserts: it verifies .ait-empty is display: none (hidden) when mock data populates 3 cars, not that the empty state actually shows when there are no AI cars.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### DT-047: Avoid hardcoding the player car ID in the telemetry panel. Pass the player ID or a...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/ai-telemetry-panel.ts:259` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Avoid hardcoding the player car ID in the telemetry panel. Pass the player ID or a row-classifier in so future multiplayer/alternate player IDs render correctly.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### DT-048: Validate sampleRate before using it for modulo. Invalid values silently disable telemetry...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/ai-telemetry-panel.ts:130` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Validate sampleRate before using it for modulo. Invalid values silently disable telemetry refreshes after the constructor render.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### DT-049: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Align Last Updated...

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-008-ai-telemetry-tab.md:5` |
| **Severity** | 🔵 Low |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |
| **Duplicate of** | #DT-041 — same issue reported by cubic-dev-ai |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Align Last Updated with the completion date.** The header still says 2026-06-27, but the completion notes below record 2026-06-28. Please keep the story metadata consistent.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### DT-050: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Reconcile the...

| Field | Value |
|-------|-------|
| **File** | `production/epics/dev-tools/story-008-ai-telemetry-tab.md:121` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Reconcile the completion notes with Test Evidence.** These notes say the story is complete and cite tests/integration/dev-tools/ai-telemetry-panel.test.ts, but the Test Evidence block above still says Not yet created and references ai-telemetry-tab.test.ts. Please make both sections agree.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-051: _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_ **Don’t skip the first live...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/ai-telemetry-panel.ts:132` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |
| **Duplicate of** | #DT-033, #DT-054 — same issue reported by coderabbitai |

**Finding**: _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_ **Don’t skip the first live refresh.** This panel is often constructed before it becomes the active tab, so the constructor render can already be stale by the time the user opens “AI Telemetry”. Line 127 skips that first activation refresh, which means the table briefly shows old telemetry until the sample counter rolls over.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-052: _🩺 Stability & Availability_ | _🟡 Minor_ | _⚡ Quick win_ **Dispose the existing...

| Field | Value |
|-------|-------|
| **File** | `src/core/dev-tools/index.ts:138` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: _🩺 Stability & Availability_ | _🟡 Minor_ | _⚡ Quick win_ **Dispose the existing singleton before resetting test state.** This helper only nulls the references. Any mounted overlay DOM and attached listeners from the old instance survive into the next test initialization.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-053: _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_ **This test never covers the...

| Field | Value |
|-------|-------|
| **File** | `tests/e2e/dev-tools.spec.ts:755` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Test |
| **Duplicate of** | #DT-033, #DT-054 — same issue reported by coderabbitai |

**Finding**: _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_ **This test never covers the empty-state path.** Line 744 says “shows when no AI cars”, but the assertions only verify that .ait-empty stays hidden while mock telemetry exists. That leaves the real empty-state branch untested and makes the suite look stronger than it is. Either rename this to match the current assertion or drive the panel with an empty fixture and assert the state is visible.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### DT-054: _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_

| Field | Value |
|-------|-------|
| **File** | `tests/integration/core/dev-tools/event-bus-inspector.test.ts:914` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Test |
| **Duplicate of** | #DT-019, #DT-024, #DT-025, #DT-026, #DT-027, #DT-029, #DT-033, #DT-051, #DT-053 — same issue reported by coderabbitai |

**Finding**: _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW


## Decision Table

| ID | File | Decision | Rationale |
|----|------|----------|-----------|
| DT-001 | `src/core/dev-tools/gsm-visualizer.ts` | DISCUSS | Duplicate IReadOnlyEventBus type in both gsm-visualizer.ts and event-bus-inspector.ts. Extract to shared location. Pure refactor, no behavior change. |
| DT-002 | `src/core/dev-tools/config-tree.ts` | SKIP | Code at config-tree.ts:293-302 already parses "true"/"false" → boolean, "null" → null, and numeric strings → Number. No remaining issue. |
| DT-003 | `src/core/dev-tools/gsm-visualizer.ts` | SKIP | Code at lines 299-307 uses _stateEntryTime (set on state enter, line 309) for non-first transitions. Only first transition falls back to pendingExit (DT-035). Finding is incorrect for general case. |
| DT-004 | `src/core/dev-tools/dev-tools.css` | SKIP | CSS at dev-tools.css:501-507 already has `display: flex; flex-direction: column;`. No missing property. |
| DT-005 | `design/gdd/dev-tools.md` | DISCUSS | Hotkey assignment in GDD conflicts with other spec sections. Needs design decision on correct key mapping. |
| DT-006 | `tests/unit/core/dev-tools/dev-tools.test.ts` | SKIP | Test checks element ID presence rather than computed CSS property. Valid structural assertion for unit test; full CSS verification belongs in e2e. |
| DT-007 | `src/core/dev-tools/index.ts` | DISCUSS | Guard prevents double instance creation. Early-returning caller could call getDevTools() before instance ready. Low risk in practice (called once at startup). |
| DT-008 | `src/core/dev-tools/gsm-visualizer.ts` | SKIP | Records every gsm.state.entered including rollbacks. Display choice — complete history. Filtering would be enhancement, not bug. |
| DT-009 | `src/config/dev-tools-config.ts` | FIX | Interface JSDoc documents toggle=backtick/reload=1/minimise=2 but actual values are 1/2/3. Change values to match docs or update JSDoc. |
| DT-010 | `tests/e2e/dev-tools.spec.ts` | SKIP | pageerror listener placement is robustness issue, not functional bug. Test catches target assertions. |
| DT-011 | `production/epics/dev-tools/EPIC.md` | DISCUSS | EPIC.md documents backtick/1/2 but config ships 1/2/3. Blocked on DT-009 resolution. |
| DT-012 | `src/core/dev-tools/dev-tools.ts` | FIX | dispose() clears _initialized but toggle() calls _initOverlay() which never recreates instrumentation/frame observer. After dispose→toggle, FPS/metrics never update. |
| DT-013 | `src/core/dev-tools/sim-snapshot-panel.ts` | SKIP | dispose() clears innerHTML unconditionally but DEV=false path is cautionary. DevTools never constructed in production. Low risk. |
| DT-014 | `src/styles/variables.css` | DISCUSS | --dt-* vars are DevTools-specific but in shared variables.css because dev-tools.css imports it. Clear naming convention (--dt- prefix) separates them. Accetable or extract to dev-tools.css. |
| DT-015 | `src/core/dev-tools/keybinds.ts` | SKIP | cm.reload() does not throw (returns ConfigChange[]). getConfigManager() IS wrapped in try/catch at line 178. No uncaught exception path. |
| DT-016 | `tests/unit/core/dev-tools/dev-tools.test.ts` | DISCUSS | vi.clearAllMocks() does not reset vi.mock() factory. Test isolation concern. Use vi.unmock() or vi.stubGlobal instead. |
| DT-017 | `design/gdd/dev-tools.md` | SKIP | GDD documentation inconsistency — part of broader keybinding doc alignment (DT-005/009/011 cluster). No code impact. |
| DT-018 | `design/gdd/dev-tools.md` | SKIP | GDD description predates final architecture. Pure documentation staleness. |
| DT-019 | `docs/architecture/adr-0009-dev-tools.md` | SKIP | Implementation at keybinds.ts:144-147 already calls preventDefault() for toggle/reload. ADR may be slightly stale but implementation is correct. |
| DT-020 | `production/epics/dev-tools/story-002-input-keybinds.md` | DISCUSS | Story marked complete with contradictory keybind data (says backtick/1/2 but config is 1/2/3). Blocked on DT-009. |
| DT-021 | `production/epics/dev-tools/story-004-config-tree.md` | SKIP | Story reads like future work but PR ships setRuntime(). Documentation timing issue. |
| DT-022 | `production/epics/dev-tools/story-004-config-tree.md` | SKIP | Completion notes list inline styles as follow-up but PR uses CSS classes. Documentation staleness. |
| DT-023 | `production/epics/dev-tools/story-009-css-refactor.md` | SKIP | Test evidence says pending but story is complete. Documentation alignment. |
| DT-024 | `src/config/dev-tools-config.ts` | FIX | Duplicate of DT-009. Defaults are 1/2/3 but contract says backtick/1/2. |
| DT-025 | `src/core/dev-tools/config-tree.ts` | SKIP | Duplicate of DT-002. Code already has proper type parsing. |
| DT-026 | `src/core/dev-tools/event-bus-inspector.ts` | SKIP | Code already uses structuredClone() at line 199 to deep-clone payloads. Finding is based on pre-implementation review. |
| DT-027 | `src/core/dev-tools/gsm-visualizer.ts` | SKIP | Finding claims only _pendingExit is used. Actual code at lines 299-307 uses _stateEntryTime (set on enter) as primary source. Finding is factually incorrect. |
| DT-028 | `src/core/dev-tools/index.ts` | SKIP | Duplicate of DT-007. Guard prevents concurrent init. |
| DT-029 | `src/core/dev-tools/keybinds.ts` | SKIP | Guard at lines 132-140 already checks for INPUT/TEXTAREA/contentEditable. Matches recommendation. Missing <select> is minor gap. |
| DT-030 | `src/core/dev-tools/sim-snapshot-panel.ts` | SKIP | Panel uses currentHashes.get() with "error" fallback. getHashes() already has per-system try/catch. Never crashes. |
| DT-031 | `src/core/dev-tools/types.ts` | FIX | IDevTools stores SimulationSnapshot class not ISimulationSnapshot interface. dev-tools.ts:85 should change to ISimulationSnapshot for API consistency. |
| DT-032 | `tests/e2e/dev-tools.spec.ts` | SKIP | page.waitForTimeout(2000) is test robustness issue. Enhancement, not bug. |
| DT-033 | `tests/e2e/dev-tools.spec.ts` | SKIP | Umbrella meta-finding. Individual issues covered by DT-019/024/025/026/027/029/051/053/054. |
| DT-034 | `tests/integration/core/dev-tools/sim-snapshot-panel.test.ts` | FIX | beforeAll sets DEV=true, afterEach unstubs it after first test. Subsequent tests lose DEV. Change beforeAll to beforeEach. |
| DT-035 | `src/core/dev-tools/gsm-visualizer.ts` | DISCUSS | First transition shows near-zero duration because _stateEntryTime starts at 0. Fix: seed _stateEntryTime during _seedFromGsmHistory(). Low impact since visualizer opened after transitions start. |
| DT-036 | `docs/architecture/adr-0009-dev-tools.md` | SKIP | ADR document wording about "never intercept" vs interactive regions. Documentation issue. |
| DT-037 | `src/core/dev-tools/index.ts` | DISCUSS | Duplicate of DT-007. Early-returning caller may hit uninitialized getDevTools(). Low practical risk. |
| DT-038 | `src/core/dev-tools/dev-tools.ts` | FIX | _createAiTelemetryTab() does NOT call _switchTab(). When it's the first/only tab, panel stays hidden. Add this._switchTab("ai-telemetry") at end. |
| DT-039 | `tests/unit/core/dev-tools/dev-tools-singleton.test.ts` | FIX | vi.unstubAllEnvs() in test body won't run on assertion failure. Move to afterEach. |
| DT-040 | `src/core/dev-tools/dev-tools.ts` | SKIP | Four tab creation methods follow similar pattern. Different wiring per tab. Acceptable duplication for clarity. |
| DT-041 | `production/epics/dev-tools/story-008-ai-telemetry-tab.md` | SKIP | Duplicate of DT-049. Doc metadata date mismatch. |
| DT-042 | `production/epics/dev-tools/story-008-ai-telemetry-tab.md` | SKIP | Documented test path doesn't match actual file layout. Doc hygiene. |
| DT-043 | `tests/unit/core/dev-tools/input-keybinds.test.ts` | SKIP | Test asserts DOM API guarantee, not production code. Weak test but harmless. |
| DT-044 | `src/core/dev-tools/event-bus-inspector.ts` | DISCUSS | On structuredClone failure, falls back to live reference. Store placeholder instead. Low severity — uncloneable payloads are rare. |
| DT-045 | `production/epics/dev-tools/PR-15-REVIEW.md` | SKIP | References line in previous review about non-existent YAML key. Documentation-only. |
| DT-046 | `tests/e2e/dev-tools.spec.ts` | SKIP | Test name says "shows empty" but asserts hidden. Naming issue, not functional bug. |
| DT-047 | `src/core/dev-tools/ai-telemetry-panel.ts` | DISCUSS | Hardcoded "player-1" for player row styling. Acceptable for MVP/single-player. |
| DT-048 | `src/core/dev-tools/ai-telemetry-panel.ts` | SKIP | sampleRate=0 would break modulo but not valid input. Defensive enhancement, not bug. |
| DT-049 | `production/epics/dev-tools/story-008-ai-telemetry-tab.md` | SKIP | Duplicate of DT-041. Doc metadata date mismatch. |
| DT-050 | `production/epics/dev-tools/story-008-ai-telemetry-tab.md` | SKIP | Story complete but Test Evidence says "Not yet created". Doc alignment. |
| DT-051 | `src/core/dev-tools/ai-telemetry-panel.ts` | DISCUSS | refresh() skips first call (tickCounter===1 guard). Constructor already rendered; when tab becomes visible data may be stale. Enhancement. |
| DT-052 | `src/core/dev-tools/index.ts` | FIX | _resetDevToolsForTesting() doesn't dispose old instance. DOM/listeners leak across test resets. Call _instance?.dispose() before nulling. |
| DT-053 | `tests/e2e/dev-tools.spec.ts` | SKIP | Duplicate of DT-046. Test name vs assertion mismatch. |
| DT-054 | `tests/integration/core/dev-tools/event-bus-inspector.test.ts` | SKIP | Umbrella meta-finding. Individual issues covered elsewhere. |
