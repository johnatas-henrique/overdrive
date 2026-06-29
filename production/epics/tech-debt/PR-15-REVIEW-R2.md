# PR #15 Review — Tech Debt

**PR**: [#15 feat(sprint-02): foundation lint cleanup + dev tools](https://github.com/johnatas-henrique/overdrive/pull/15)
**Review Date**: 2026-06-28
**Reviewers**: coderabbitai, cubic-dev-ai, greptile-apps
**Total Comments in PR**: 125
**Comments in this Epic**: 64

---

## Findings
### TD-001: **getSubscriptions() silently excludes wildcard handlers** The method only iterates...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/event-bus.ts:208` |
| **Severity** | 🟡 Medium |
| **Reviewer** | greptile-apps[bot] |
| **Category** | Code |

**Finding**: **getSubscriptions() silently excludes wildcard handlers** The method only iterates _handlers (named-event subscriptions) and returns nothing for _wildcardHandlers. The Active Subscriptions pane in EventBusInspector calls this method to show "who is listening" — any application code that subscribes via bus.on("*", ...) will be invisible there.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-002: E2E server port is misconfigured: command starts Vite default port, but Playwright waits...

| Field | Value |
|-------|-------|
| **File** | `playwright.config.ts:16` |
| **Severity** | 🔴 High |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Config |

**Finding**: E2E server port is misconfigured: command starts Vite default port, but Playwright waits on 5177. In clean CI this can fail before tests start.

**Recommendation**: Resolve before merging. Update the affected file per the finding.

**Status**: PENDING REVIEW

### TD-003: off(event) returning full IEventBus breaks the read-only Event Bus contract by allowing...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/types.ts:203` |
| **Severity** | 🔴 High |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |
| **Duplicate of** | #TD-038 — same issue reported by coderabbitai |

**Finding**: off(event) returning full IEventBus breaks the read-only Event Bus contract by allowing emit() through chaining. This undermines the DevTools type-level "never emit" guard.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### TD-004: DevTools receives an EventBus instance that is not wired into the created GSM, so GSM...

| Field | Value |
|-------|-------|
| **File** | `src/app.ts:33` |
| **Severity** | 🔴 High |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: DevTools receives an EventBus instance that is not wired into the created GSM, so GSM transition history will miss real state-change events.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### TD-005: getSubscriptions() omits wildcard subscriptions, contradicting its documented contract of...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/event-bus.ts:248` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: getSubscriptions() omits wildcard subscriptions, contradicting its documented contract of returning "all active subscriptions."

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-006: Story 2-14 repeats completed with conflicting values, causing incorrect sprint status...

| Field | Value |
|-------|-------|
| **File** | `production/sprint-status.yaml:152` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Config |

**Finding**: Story 2-14 repeats completed with conflicting values, causing incorrect sprint status data.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-007: Story 2-11 has duplicate completed keys; the later empty value overrides the real...

| Field | Value |
|-------|-------|
| **File** | `production/sprint-status.yaml:122` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Config |

**Finding**: Story 2-11 has duplicate completed keys; the later empty value overrides the real completion date.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-008: Smoke-test criterion requires unit tests for all 42 stories, but this plan explicitly...

| Field | Value |
|-------|-------|
| **File** | `production/qa/qa-plan-sprint-02-2026-06-26.md:—` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |
| **Duplicate of** | #TD-030 — same issue reported by coderabbitai |

**Finding**: Smoke-test criterion requires unit tests for all 42 stories, but this plan explicitly includes manual-only stories. QA sign-off can be blocked by an impossible requirement.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-009: Do not mark tech debt resolved just because a referenced file was modified. Require...

| Field | Value |
|-------|-------|
| **File** | `.opencode/skills/story-done/SKILL.md:370` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Do not mark tech debt resolved just because a referenced file was modified. Require evidence that the story actually addressed the debt item, otherwise this gate will silently corrupt the register.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-010: Empty catch blocks hide real initialization errors and make failures non-diagnosable. Log...

| Field | Value |
|-------|-------|
| **File** | `src/playground/main-scene.ts:129` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Empty catch blocks hide real initialization errors and make failures non-diagnosable. Log or rethrow with context so broken dev-tools wiring is visible.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-011: Duplicated error isolation logic in emit() for typed and wildcard handlers. The same...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/event-bus.ts:175` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Duplicated error isolation logic in emit() for typed and wildcard handlers. The same try-catch pattern (EventBusError max-depth re-throw + console.error fallback) is copy-pasted in both the typed handlers block and the wildcard handlers block.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-012: reload()'s catch block silently assumes invalidateNamespace() cleared the resolved cache,...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:176` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: reload()'s catch block silently assumes invalidateNamespace() cleared the resolved cache, but invalidateNamespace() preserves stale cache when raw config is invalid. This leads to misleading diff results and continued use of stale config values after a reload.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-013: _deepClone performs a shallow copy for array values, leaking mutable references into the...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:—` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |
| **Duplicate of** | #TD-014 — same issue reported by cubic-dev-ai |

**Finding**: _deepClone performs a shallow copy for array values, leaking mutable references into the debug snapshot. This breaks the read-only snapshot contract and allows accidental internal config mutation.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### TD-014: JSDoc for _deepClone claims circular references are replaced with a placeholder, but the...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:—` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |
| **Duplicate of** | #TD-013 — same issue reported by cubic-dev-ai |

**Finding**: JSDoc for _deepClone claims circular references are replaced with a placeholder, but the implementation throws an Error instead. This documentation/implementation mismatch creates a misleading contract and makes the code harder to understand and maintain.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-015: Dev Tools dependency mapping conflicts with the execution order and stated interface...

| Field | Value |
|-------|-------|
| **File** | `production/sprints/sprint-02.md:89` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Dev Tools dependency mapping conflicts with the execution order and stated interface requirement. This can invalidate sprint sequencing for stories 002/003.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-016: The new src/**/index.ts coverage exclusion hides real runtime code from coverage metrics....

| Field | Value |
|-------|-------|
| **File** | `vitest.config.ts:20` |
| **Severity** | 🔴 High |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Config |

**Finding**: The new src/**/index.ts coverage exclusion hides real runtime code from coverage metrics. This can mask regressions in entrypoint logic like core/dev-tools/index.ts while still reporting high coverage.

**Recommendation**: Resolve before merging. Update the affected file per the finding.

**Status**: PENDING REVIEW

### TD-017: W-1 tests 2 and 3 leak Error.prototype.stack patching. When Error.prototype has no native...

| Field | Value |
|-------|-------|
| **File** | `tests/unit/tech-debt-cleanup.test.ts:—` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |

**Finding**: W-1 tests 2 and 3 leak Error.prototype.stack patching. When Error.prototype has no native stack property, Object.getOwnPropertyDescriptor returns undefined and the if-guard skips restore — the test's throwing getter persists to subsequent tests.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-018: Status summary comment is stale and contradicts story statuses. It reports 24 ready...

| Field | Value |
|-------|-------|
| **File** | `production/sprint-status-01.yaml:—` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Config |

**Finding**: Status summary comment is stale and contradicts story statuses. It reports 24 ready stories while the file marks all 29 as done.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-019: Redundant test: "should keep only the last 20 after 25 transitions" is now a direct...

| Field | Value |
|-------|-------|
| **File** | `tests/unit/foundation/gsm/gsm.test.ts:2503` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |

**Finding**: Redundant test: "should keep only the last 20 after 25 transitions" is now a direct duplicate of "should drop the first 5 entries after 25 transitions". Both call performTransitions(gsm, 25) and assert toHaveLength(20). Drop or restore the original 100-transition variant.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-020: Checklist excludes DT-004..DT-008 verification as N/A even though they are in sprint...

| Field | Value |
|-------|-------|
| **File** | `production/qa/qa-plan-sprint-02-2026-06-26.md:177` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Checklist excludes DT-004..DT-008 verification as N/A even though they are in sprint scope. QA may miss regressions in the integrated overlay flow.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### TD-021: initDevTools is async but invoked without await, which can leave startup errors unhandled...

| Field | Value |
|-------|-------|
| **File** | `src/app.ts:49` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: initDevTools is async but invoked without await, which can leave startup errors unhandled and race overlay initialization.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-022: New mutable singletons couple CreateMainScene and app bootstrap through hidden state....

| Field | Value |
|-------|-------|
| **File** | `src/playground/main-scene.ts:21` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: New mutable singletons couple CreateMainScene and app bootstrap through hidden state. Pass dev-tools dependencies explicitly instead of storing them in module globals.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-023: D5 behavior is documented incorrectly: key handling is DOM keydown, not...

| Field | Value |
|-------|-------|
| **File** | `production/epics/ai-driver/story-009-telemetry-provider.md:—` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: D5 behavior is documented incorrectly: key handling is DOM keydown, not DeviceSourceManager polling. This can misdirect future implementations for this story.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-024: _🎯 Functional Correctness_ | _🟠 Major_ | _⚡ Quick win_ **The tree-shaking gate misses...

| Field | Value |
|-------|-------|
| **File** | `.github/workflows/tests.yml:35` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Config |

**Finding**: _🎯 Functional Correctness_ | _🟠 Major_ | _⚡ Quick win_ **The tree-shaking gate misses CSS/HTML leaks.** This only scans built *.js files, but this PR also introduces Dev Tools CSS and markup identifiers. A production leak in dist/**/*.css or HTML would still pass, so the job currently gives a false sense of coverage.

**Recommendation**: Resolve before merging. Update the affected file per the finding.

**Status**: PENDING REVIEW

### TD-025: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Align the...

| Field | Value |
|-------|-------|
| **File** | `ARCHITECTURE.md:200` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |
| **Duplicate of** | #TD-026 — same issue reported by coderabbitai |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Align the DevToolsConfig defaults with the rest of this stack.** The toggle/reload/minimise defaults here still read 1/2/3, which conflicts with the updated docs in this PR (backtick / 1 / 2).

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-026: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_

| Field | Value |
|-------|-------|
| **File** | `playwright.config.ts:13` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Config |
| **Duplicate of** | #TD-025, #TD-027, #TD-028, #TD-029, #TD-030, #TD-041, #TD-058, #TD-059, #TD-060, #TD-061, #TD-063, #TD-064 — same issue reported by coderabbitai |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-027: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Align D5 with the DOM...

| Field | Value |
|-------|-------|
| **File** | `production/epics/ai-driver/story-009-telemetry-provider.md:27` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |
| **Duplicate of** | #TD-026 — same issue reported by coderabbitai |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Align D5 with the DOM keydown contract.** polled via DSM is stale here and conflicts with the updated Dev Tools rules that route key handling through a DOM keydown listener. Keeping both descriptions will send implementers down two different input paths.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-028: _📐 Maintainability & Code Quality_ | _🟠 Major_ | _⚡ Quick win_ **Split or gate the...

| Field | Value |
|-------|-------|
| **File** | `production/epics/physics-handling/story-001-physics-core-skeleton.md:48` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |
| **Duplicate of** | #TD-026 — same issue reported by coderabbitai |

**Finding**: _📐 Maintainability & Code Quality_ | _🟠 Major_ | _⚡ Quick win_ **Split or gate the lifecycle-dependent ACs.** AC-3 and AC-6 still read like active acceptance criteria even though the note says the required lifecycle epic has no implementation stories yet. That makes the story look verifiable before its prerequisite exists.

**Recommendation**: Resolve before merging. Update the affected file per the finding.

**Status**: PENDING REVIEW

### TD-029: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Fill the required...

| Field | Value |
|-------|-------|
| **File** | `production/qa/evidence/html-overlay-evidence.md:—` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |
| **Duplicate of** | #TD-026 — same issue reported by coderabbitai |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Fill the required sign-off row.** The evidence table still leaves the approver blank, so this doesn't actually capture the required lead-programmer sign-off from the QA plan. Populate the missing approver before treating the evidence as closed.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-030: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Separate automated...

| Field | Value |
|-------|-------|
| **File** | `production/qa/qa-plan-sprint-02-2026-06-26.md:—` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |
| **Duplicate of** | #TD-008, #TD-026 — same issue reported by cubic-dev-ai, coderabbitai |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Separate automated coverage from manual evidence.** “All 42 stories have passing unit tests with 100% coverage” is too strong for this plan because several listed stories are manual/UI verifications instead. Reword this gate so automated and manual requirements are tracked separately.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-031: _🗄️ Data Integrity & Integration_ | _🟠 Major_ | _⚡ Quick win_ **Populate the completion...

| Field | Value |
|-------|-------|
| **File** | `production/sprint-status-01.yaml:61` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Config |

**Finding**: _🗄️ Data Integrity & Integration_ | _🟠 Major_ | _⚡ Quick win_ **Populate the completion date for the done story.** status: done with an empty completed field breaks the sprint-status contract and can misreport the archive. Fill in the actual completion date, or change the status until it is complete.

**Recommendation**: Resolve before merging. Update the affected file per the finding.

**Status**: PENDING REVIEW

### TD-032: _🗄️ Data Integrity & Integration_ | _🟠 Major_ | _⚡ Quick win_ **Remove the duplicate...

| Field | Value |
|-------|-------|
| **File** | `production/sprint-status.yaml:—` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Config |

**Finding**: _🗄️ Data Integrity & Integration_ | _🟠 Major_ | _⚡ Quick win_ **Remove the duplicate completed keys.** In both 2-11 and 2-14, the later blank completed value overwrites the real timestamp, so YAML consumers will treat done work as incomplete.

**Recommendation**: Resolve before merging. Update the affected file per the finding.

**Status**: PENDING REVIEW

### TD-033: _🎯 Functional Correctness_ | _🟠 Major_ | _🏗️ Heavy lift_ **Create the shared EventBus...

| Field | Value |
|-------|-------|
| **File** | `src/app.ts:—` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: _🎯 Functional Correctness_ | _🟠 Major_ | _🏗️ Heavy lift_ **Create the shared EventBus before CreateMainScene() and thread it into the playground GSM.** Right now getPlaygroundGsm() returns a GameStateMachine that was constructed before this shared eventBus exists, so it can never emit gsm.state.entered / gsm.state.exited onto the same bus passed to initDevTools(). That disconnect breaks the live Event Bus Inspector / GSM visualizer contract.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### TD-034: _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_ **Report newly added keys during...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:256` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_ **Report newly added keys during reload diffs.** The diff loop only walks snapshot, so keys present only in newValues are silently missed.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-035: _🗄️ Data Integrity & Integration_ | _🟠 Major_ | _⚡ Quick win_ **Make _deepClone() match...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:393` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: _🗄️ Data Integrity & Integration_ | _🟠 Major_ | _⚡ Quick win_ **Make _deepClone() match the JSON-serializable config contract.** The current clone keeps arrays by reference, permits non-serializable leaf values like functions/BigInt, and treats shared object references as circular because entries are never removed from visited. That can mutate raw config through resolved arrays or reject valid repeated subobjects.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### TD-036: _🗄️ Data Integrity & Integration_ | _🟠 Major_ | _⚡ Quick win_ **Re-export the new...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/index.ts:—` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: _🗄️ Data Integrity & Integration_ | _🟠 Major_ | _⚡ Quick win_ **Re-export the new ConfigManager public API from the barrel.** setConfigManager(), getConfigManager(), ConfigChange, and DebugState are exported from config-manager.ts but remain unavailable from src/foundation/config.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### TD-037: _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_ **Include wildcard subscriptions...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/event-bus.ts:259` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_ **Include wildcard subscriptions in the snapshot.** getSubscriptions() currently hides on("*", ...) handlers, so the Event Bus Inspector cannot show all active subscriptions as promised by the interface.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-038: _🗄️ Data Integrity & Integration_ | _🟠 Major_ | _🏗️ Heavy lift_ **Don’t recommend...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/event-bus/types.ts:203` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |
| **Duplicate of** | #TD-003 — same issue reported by cubic-dev-ai |

**Finding**: _🗄️ Data Integrity & Integration_ | _🟠 Major_ | _🏗️ Heavy lift_ **Don’t recommend off(event) as a reentrant subscription guard.** This removes every listener for the event on the shared bus. The supplied TelemetryRecorder.init() context uses off("race.started").on(...), so re-init can delete unrelated race.started subscribers. Prefer retaining owned Subscription handles, or expose this as an explicitly destructive clear(event) API.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### TD-039: _🩺 Stability & Availability_ | _🟠 Major_ | _⚡ Quick win_ **Mirror SecurityError...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/persistence/persistence.ts:373` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: _🩺 Stability & Availability_ | _🟠 Major_ | _⚡ Quick win_ **Mirror SecurityError handling on these degraded transitions.** init() and retry() already set _recoverable = false for SecurityError, but these new save()/load() catch blocks only record _lastError and switch to Degraded. After either path hits a SecurityError, retry() will keep probing a backend we've already classified as non-recoverable.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### TD-040: _🩺 Stability & Availability_ | _🟠 Major_ | _⚡ Quick win_ **Isolate bad hash()...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/simulation-snapshot/simulation-snapshot.ts:441` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: _🩺 Stability & Availability_ | _🟠 Major_ | _⚡ Quick win_ **Isolate bad hash() implementations here.** dispose() and restoreSnapshot() already continue past per-system failures, but getHashes() still throws on the first bad system.hash(). That lets one misbehaving system take down every hash consumer instead of keeping the rest of the registry inspectable.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### TD-041: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Point new GSM changes...

| Field | Value |
|-------|-------|
| **File** | `STRUCTURE.md:—` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |
| **Duplicate of** | #TD-026 — same issue reported by coderabbitai |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Point new GSM changes at gsm/types.ts, not State.ts.** The stack consolidated the GSM state type into src/foundation/gsm/types.ts, so this path now sends contributors to a removed file.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-042: Phase 1 command fetches only review comments, not all PR comments. Conversation comments...

| Field | Value |
|-------|-------|
| **File** | `.opencode/skills/pr-review-epic/SKILL.md:14` |
| **Severity** | 🔴 High |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Phase 1 command fetches only review comments, not all PR comments. Conversation comments will be skipped, so findings can be missed.

**Recommendation**: Resolve before merging. Update the affected file per the finding.

**Status**: PENDING REVIEW

### TD-043: _deepClone re-traverses the original graph without cycle tracking, so circular configs...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:388` |
| **Severity** | 🔴 High |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: _deepClone re-traverses the original graph without cycle tracking, so circular configs can either overflow recursion or slip through when the cycle passes through arrays. This breaks the method contract that circular references are rejected as non-serializable config.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### TD-044: Reference to undefined variables __origMathRandom, __origDateNow, __origPerfNow in test...

| Field | Value |
|-------|-------|
| **File** | `tests/unit/foundation/determinism/determinism.test.ts:2577` |
| **Severity** | 🔴 High |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |

**Finding**: Reference to undefined variables __origMathRandom, __origDateNow, __origPerfNow in test beforeEach — will cause ReferenceError

**Recommendation**: Resolve before merging. Update the affected file per the finding.

**Status**: PENDING REVIEW

### TD-045: Quality gate is hardcoded to 79+ comments, making the skill non-generic for other PRs....

| Field | Value |
|-------|-------|
| **File** | `.opencode/skills/pr-review-epic/SKILL.md:222` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Quality gate is hardcoded to 79+ comments, making the skill non-generic for other PRs. Use an all-comments requirement instead of a fixed count.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-046: SecurityError test restores localStorage inline rather than in afterEach — a test failure...

| Field | Value |
|-------|-------|
| **File** | `tests/unit/foundation/persistence/persistence.test.ts:4` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |
| **Duplicate of** | #TD-054 — same issue reported by cubic-dev-ai |

**Finding**: SecurityError test restores localStorage inline rather than in afterEach — a test failure leaks broken localStorage to sibling describes. Use afterEach or a try/finally guard.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-047: Summary total is incorrect; row total does not match its own category counts.

| Field | Value |
|-------|-------|
| **File** | `production/qa/PR-15-REVIEW-DECISIONS.md:34` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Summary total is incorrect; row total does not match its own category counts.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-048: Duplicate table contains decisions that contradict their referenced originals.

| Field | Value |
|-------|-------|
| **File** | `production/qa/PR-15-REVIEW-DECISIONS.md:641` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Duplicate table contains decisions that contradict their referenced originals.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-049: Dev-tools test paths are documented without the required core/ segment. This sends new...

| Field | Value |
|-------|-------|
| **File** | `STRUCTURE.md:30` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Dev-tools test paths are documented without the required core/ segment. This sends new tests to nonexistent directories instead of the current mirrored tests/{unit,integration}/core/dev-tools/ layout.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-050: Guard in "should not throw when Error.stack is undefined" test always triggers in...

| Field | Value |
|-------|-------|
| **File** | `tests/unit/foundation/config/config-manager.test.ts:1127` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |

**Finding**: Guard in "should not throw when Error.stack is undefined" test always triggers in V8/Node.js, making the test a silent no-op.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-051: The _deepClone method redundantly re-clones nested objects already handled by...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/config/config-manager.ts:373` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: The _deepClone method redundantly re-clones nested objects already handled by structuredClone(), adding unnecessary O(d²) work and a brittle post-processing loop based on incorrect assumptions about structuredClone stripping undefined.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-052: QA Lead sign-off is marked approved without a reviewer name. Add the QA Lead name or...

| Field | Value |
|-------|-------|
| **File** | `production/qa/evidence/html-overlay-evidence.md:49` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: QA Lead sign-off is marked approved without a reviewer name. Add the QA Lead name or leave the row unapproved so the evidence has an auditable approver.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### TD-053: Final verdict counts don't match the decision table, making the review status misleading....

| Field | Value |
|-------|-------|
| **File** | `production/epics/tech-debt/PR-15-REVIEW.md:310` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Final verdict counts don't match the decision table, making the review status misleading. Reconcile whether QG-001 is separate from X-011 and update the FIX/SKIP/DISCUSS totals accordingly.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### TD-054: Duplicate createWorkingStorage() (3×) and setLocalStorage() (2×) in same file. Extract...

| Field | Value |
|-------|-------|
| **File** | `tests/unit/foundation/persistence/persistence.test.ts:4` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |
| **Duplicate of** | #TD-046 — same issue reported by cubic-dev-ai |

**Finding**: Duplicate createWorkingStorage() (3×) and setLocalStorage() (2×) in same file. Extract into a shared module-level or test-util helper instead of redefining them inside describe blocks.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### TD-055: Confirmed SKIP count is incorrect versus the IDs listed under it.

| Field | Value |
|-------|-------|
| **File** | `production/qa/PR-15-REVIEW-DECISIONS.md:713` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Confirmed SKIP count is incorrect versus the IDs listed under it.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### TD-056: Total Findings value is stale and disagrees with the document totals.

| Field | Value |
|-------|-------|
| **File** | `production/qa/PR-15-REVIEW-DECISIONS.md:5` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Total Findings value is stale and disagrees with the document totals.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### TD-057: Fix misleading exception comment: quota exhaustion is QuotaExceededError, not...

| Field | Value |
|-------|-------|
| **File** | `src/foundation/persistence/persistence.ts:364` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Fix misleading exception comment: quota exhaustion is QuotaExceededError, not SecurityError. This matters because SecurityError permanently disables retry recovery here.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### TD-058: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Match the...

| Field | Value |
|-------|-------|
| **File** | `.opencode/skills/pr-review-epic/SKILL.md:215` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |
| **Duplicate of** | #TD-026 — same issue reported by coderabbitai |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Match the deferred-finding template to the current tech-debt table.** docs/tech-debt-register.md now expects Status, Date, Source, Description, File, Effort, and Resolved In, but this template only writes five columns. Copying it as-is will produce malformed rows.

**Recommendation**: Resolve before merging. Update the affected file per the finding.

**Status**: PENDING REVIEW

### TD-059: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Keep the DevTools...

| Field | Value |
|-------|-------|
| **File** | `ARCHITECTURE.md:176` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |
| **Duplicate of** | #TD-026 — same issue reported by coderabbitai |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Keep the DevTools contract docs complete.** This block still stops at three tabs and omits the new AI Telemetry panel. It also leaves update(): void out of the IDevTools method list, so readers won't see the zero-arg refresh hook documented above.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-060: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Reconcile the verdict...

| Field | Value |
|-------|-------|
| **File** | `production/epics/tech-debt/PR-15-REVIEW.md:247` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |
| **Duplicate of** | #TD-026 — same issue reported by coderabbitai |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Reconcile the verdict counts.** The summary blocks disagree with the per-item table: the listed findings resolve to 7 FIX / 2 SKIP / 3 DISCUSS, not 9 / 2 / 1. Please recompute the totals so this document has one source of truth.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-061: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Clarify the counting...

| Field | Value |
|-------|-------|
| **File** | `production/qa/PR-15-REVIEW-DECISIONS.md:6` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |
| **Duplicate of** | #TD-026 — same issue reported by coderabbitai |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Clarify the counting convention.** Total Findings is 77, but the category table totals 79. If duplicates are included as a real bucket, the total needs to be 79; otherwise, the document should say the headline excludes duplicates.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-062: _🩺 Stability & Availability_ | _🟡 Minor_ | _⚡ Quick win_ **Don't drop the...

| Field | Value |
|-------|-------|
| **File** | `src/app.ts:55` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: _🩺 Stability & Availability_ | _🟡 Minor_ | _⚡ Quick win_ **Don't drop the initDevTools() promise.** If dev-tools initialization fails, this becomes an unhandled rejection. await it here, or attach a .catch(...) if you want it to stay fire-and-forget.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-063: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Document the AI...

| Field | Value |
|-------|-------|
| **File** | `STRUCTURE.md:94` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |
| **Duplicate of** | #TD-026 — same issue reported by coderabbitai |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Document the AI Telemetry panel and its test location.** The dev-tools section still omits ai-telemetry-panel.ts, and the integration-test section doesn't list ai-telemetry-panel.test.ts. That leaves the structure map incomplete for the new tab.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TD-064: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **These rules conflict...

| Field | Value |
|-------|-------|
| **File** | `tests/unit/README.md:33` |
| **Severity** | 🔵 Low |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Test |
| **Duplicate of** | #TD-026 — same issue reported by coderabbitai |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **These rules conflict with the layout shown above.** Lines 30-33 require a single [system].test.ts per source file, but Lines 22-25 explicitly allow multiple telemetry-*.test.ts files for one module. Please relax the rule or update the example tree so contributors are not told the current layout is invalid.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW


## Decision Table

| ID | File | Decision | Rationale |
|----|------|----------|-----------|
| TD-001 | `src/foundation/event-bus/event-bus.ts` | SKIP | Code already includes wildcard handlers (lines 253-258). Comment at line 253 references the fix with F-001 tag. |
| TD-002 | `playwright.config.ts` | FIX | `command: "npm run dev"` starts Vite on default port 5173; `baseURL` and `port` specify 5177. Change command to `npm run dev -- --port 5177`. |
| TD-003 | `src/foundation/event-bus/types.ts` | DISCUSS | off(event) returning IEventBus enables fluent misuse (emit chaining). IReadOnlyEventBus doesn't expose emit() so concern is limited. Breaking change for convenience pattern. |
| TD-004 | `src/app.ts` | FIX | GSM at main-scene.ts:135 uses internal EventBus, not shared bus passed to initDevTools. GSM events never reach visualizer/inspector. Pass shared bus to GSM constructor. |
| TD-005 | `src/foundation/event-bus/event-bus.ts` | SKIP | Duplicate of TD-001. Wildcard handlers already included. |
| TD-006 | `production/sprint-status.yaml` | FIX | Lines 157 and 161 both have `completed:` under story 2-14. YAML uses last value (empty string), making story appear incomplete. Remove duplicate at line 161. |
| TD-007 | `production/sprint-status.yaml` | SKIP | Story 2-11 has only one `completed` key at line 127. No duplicate visible in current file. May have been fixed. |
| TD-008 | `production/qa/qa-plan-sprint-02-2026-06-26.md` | DISCUSS | QA plan requires unit tests for all 42 stories but includes manual-only stories. Need to separate automated/manual gates. |
| TD-009 | `.opencode/skills/story-done/SKILL.md` | SKIP | Framework skill documentation improvement. Not specific to this PR's code. |
| TD-010 | `src/playground/main-scene.ts` | SKIP | Empty catch blocks at lines 129/138/164 are intentional (expected-to-often-throw try blocks). Adding console.warn would be nice but not required. |
| TD-011 | `src/foundation/event-bus/event-bus.ts` | DISCUSS | Typed and wildcard handler loops have identical try-catch-rethrow pattern (~40 lines). Extract to shared helper function. |
| TD-012 | `src/foundation/config/config-manager.ts` | SKIP | reload() catches _buildResolved() errors per namespace. Stale cache on error — next get() re-attempts build. One-call window. Low impact. |
| TD-013 | `src/foundation/config/config-manager.ts` | SKIP | Uses structuredClone() which correctly deep-clones arrays. Post-processing only restores undefined. No array shallow-copy issue. |
| TD-014 | `src/foundation/config/config-manager.ts` | DISCUSS | JSDoc accurately says circular references "throw an error". The wording may slightly imply placeholder behavior from earlier implementation. Clarify JSDoc if needed. |
| TD-015 | `production/sprints/sprint-02.md` | SKIP | Sprint plan dependency ordering documentation. No code impact. |
| TD-016 | `vitest.config.ts` | FIX | `src/**/index.ts` coverage exclusion hides barrel files with runtime logic (e.g. core/dev-tools/index.ts). Remove exclusion or narrow to type-only barrels. |
| TD-017 | `tests/unit/tech-debt-cleanup.test.ts` | DISCUSS | Error.prototype.stack patching doesn't restore when property descriptor is undefined. Guard skips restore, leak persists. Use try/finally. |
| TD-018 | `production/sprint-status-01.yaml` | SKIP | Summary says 24 ready but all 29 are done. Stale comment. |
| TD-019 | `tests/unit/foundation/gsm/gsm.test.ts` | SKIP | Two tests assert same thing (25 transitions→20 length). Redundant but harmless. |
| TD-020 | `production/qa/qa-plan-sprint-02-2026-06-26.md` | SKIP | QA scope decision to exclude DT-004-008. No code impact. |
| TD-021 | `src/app.ts` | FIX | initDevTools() called without await inside async function. Unhandled promise rejection if init fails. Add await. |
| TD-022 | `src/playground/main-scene.ts` | DISCUSS | Mutable module globals (_gsm, _snapshot) couple playground to external consumers. Acceptable for playground; refactor before production. |
| TD-023 | `production/epics/ai-driver/story-009-telemetry-provider.md` | SKIP | Story documents DSM polling but code uses DOM keydown. Doc needs update. |
| TD-024 | `.github/workflows/tests.yml` | DISCUSS | CI gate only scans JS for dev-tools leaks. CSS/HTML identifiers could also leak. Enhancement to gate, not bug. |
| TD-025 | `ARCHITECTURE.md` | SKIP | Duplicate of DT-009 cluster. Docs alignment. |
| TD-026 | `playwright.config.ts` | SKIP | Umbrella meta-finding. Port issue covered by TD-002. |
| TD-027 | `production/epics/ai-driver/story-009-telemetry-provider.md` | SKIP | Duplicate of TD-023. |
| TD-028 | `production/epics/physics-handling/story-001-physics-core-skeleton.md` | SKIP | ACs depend on lifecycle epic with no stories. Mark as gated in doc. |
| TD-029 | `production/qa/evidence/html-overlay-evidence.md` | SKIP | Evidence table missing approver name. Process documentation. |
| TD-030 | `production/qa/qa-plan-sprint-02-2026-06-26.md` | DISCUSS | Duplicate of TD-008. Combine automated/manual gates. |
| TD-031 | `production/sprint-status-01.yaml` | SKIP | Story has status=done with empty completed field. Needs date or status change. |
| TD-032 | `production/sprint-status.yaml` | FIX | Duplicate of TD-006. Duplicate completed at line 161 overwrites real date. |
| TD-033 | `src/app.ts` | FIX | Same root cause as TD-004. GSM not wired to shared EventBus. Pass bus to GSM constructor. |
| TD-034 | `src/foundation/config/config-manager.ts` | DISCUSS | reload() diff loop only walks pre-reload snapshot. Keys present only in newValues are missed. Add second loop over newValues. |
| TD-035 | `src/foundation/config/config-manager.ts` | SKIP | Uses structuredClone() which correctly handles arrays and JSON-serializable types. Post-processing restores undefined. Code is correct. |
| TD-036 | `src/foundation/config/index.ts` | SKIP | Barrel already exports ConfigManager, getConfigManager, setConfigManager, ConfigChange, DebugState. All public API available. |
| TD-037 | `src/foundation/event-bus/event-bus.ts` | SKIP | Duplicate of TD-001. Wildcard already included. |
| TD-038 | `src/foundation/event-bus/types.ts` | DISCUSS | Duplicate of TD-003. off(event) documented as reentrant guard — should be documented as destructive (removes ALL handlers). |
| TD-039 | `src/foundation/persistence/persistence.ts` | SKIP | save() already handles SecurityError → _recoverable=false at line 367. load()/delete() could also set it for consistency. Low severity. |
| TD-040 | `src/foundation/simulation-snapshot/simulation-snapshot.ts` | SKIP | getHashes() already uses per-system try/catch (lines 430-440). Failing systems get "error" hash. Fix was applied — finding based on stale code. |
| TD-041 | `STRUCTURE.md` | SKIP | Path points to removed State.ts instead of types.ts. Doc update needed. |
| TD-042 | `.opencode/skills/pr-review-epic/SKILL.md` | SKIP | Command fetches only review comments, missing conversation comments. Framework skill, not PR-specific. |
| TD-043 | `src/foundation/config/config-manager.ts` | SKIP | Uses structuredClone() which natively handles cycles by throwing. _buildResolved() catches the throw. Code is correct. |
| TD-044 | `tests/unit/foundation/determinism/determinism.test.ts` | FIX | References undefined __origMathRandom/__origDateNow/__origPerfNow — will cause ReferenceError. Define before usage. |
| TD-045 | `.opencode/skills/pr-review-epic/SKILL.md` | SKIP | Hardcoded 79+ comment gate. Framework skill improvement, not PR-specific. |
| TD-046 | `tests/unit/foundation/persistence/persistence.test.ts` | DISCUSS | SecurityError test doesn't restore localStorage in afterEach. Test failure leaks to sibling describes. |
| TD-047 | `production/qa/PR-15-REVIEW-DECISIONS.md` | SKIP | Summary counts don't match rows. Doc data integrity. |
| TD-048 | `production/qa/PR-15-REVIEW-DECISIONS.md` | SKIP | Duplicate table with contradictory values. Needs dedup. |
| TD-049 | `STRUCTURE.md` | SKIP | Paths omit `core/` segment (e.g., tests/unit/dev-tools/ vs tests/unit/core/dev-tools/). Doc update. |
| TD-050 | `tests/unit/foundation/config/config-manager.test.ts` | SKIP | Test guard always triggers in V8, making test silent no-op. Platform-specific test limitation. |
| TD-051 | `src/foundation/config/config-manager.ts` | SKIP | _deepClone recursively re-processes nested objects via structuredClone fallback. Redundant but harmless. Optimization opportunity. |
| TD-052 | `production/qa/evidence/html-overlay-evidence.md` | SKIP | QA Lead sign-off missing name. Process documentation. |
| TD-053 | `production/epics/tech-debt/PR-15-REVIEW.md` | SKIP | Verdict counts disagree with per-item table. Being reconciled by this analysis. |
| TD-054 | `tests/unit/foundation/persistence/persistence.test.ts` | SKIP | Duplicate helpers in describe blocks. Readability, not functional bug. |
| TD-055 | `production/qa/PR-15-REVIEW-DECISIONS.md` | SKIP | SKIP count vs listed IDs mismatch. Doc data integrity. |
| TD-056 | `production/qa/PR-15-REVIEW-DECISIONS.md` | SKIP | Total Findings value stale. Doc data integrity. |
| TD-057 | `src/foundation/persistence/persistence.ts` | FIX | Comment at line 363 says "quota exhaustion" but catches SecurityError (different DOMException). Fix comment. |
| TD-058 | `.opencode/skills/pr-review-epic/SKILL.md` | SKIP | Skill template doesn't match tech-debt-register.md format. Framework improvement. |
| TD-059 | `ARCHITECTURE.md` | SKIP | Missing AI Telemetry panel and update() from IDevTools list. Doc update. |
| TD-060 | `production/epics/tech-debt/PR-15-REVIEW.md` | SKIP | Duplicate of TD-053. Summary/per-item mismatch. |
| TD-061 | `production/qa/PR-15-REVIEW-DECISIONS.md` | SKIP | Total vs category count — duplicates inclusion unclear. Doc clarification. |
| TD-062 | `src/app.ts` | FIX | Duplicate of TD-021. initDevTools called without await. |
| TD-063 | `STRUCTURE.md` | SKIP | Missing ai-telemetry-panel.ts and test file. Doc update. |
| TD-064 | `tests/unit/README.md` | SKIP | Rule requires one test per source file but layout shows multiple. Doc update. |
