# PR #15 Review — Telemetry

**PR**: [#15 feat(sprint-02): foundation lint cleanup + dev tools](https://github.com/johnatas-henrique/overdrive/pull/15)
**Review Date**: 2026-06-28
**Reviewers**: coderabbitai, cubic-dev-ai, greptile-apps
**Total Comments in PR**: 125
**Comments in this Epic**: 7

---

## Findings
### TEL-001: Document contains contradictory claims: Completion Notes assert tests exist and pass (12...

| Field | Value |
|-------|-------|
| **File** | `production/epics/telemetry-recorder/story-005-telemetry-race-lifecycle.md:4` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Document contains contradictory claims: Completion Notes assert tests exist and pass (12 tests, 5/5 criteria passing), but the Test Evidence section still shows 'Status: [ ] Not yet created', creating an unresolved inconsistency within the same document.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TEL-002: Sampling continues when recording is disabled because tick() gates logging only, not...

| Field | Value |
|-------|-------|
| **File** | `src/dev-infra/telemetry-recorder.ts:362` |
| **Severity** | 🟡 Medium |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: Sampling continues when recording is disabled because tick() gates logging only, not sample capture. Add the recording guard to the sampling early-return so PostRace actually freezes telemetry data.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TEL-003: _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_ **Include tick and t in the...

| Field | Value |
|-------|-------|
| **File** | `production/epics/telemetry-recorder/story-002-telemetry-sampling-loop.md:37` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_ **Include tick and t in the sampling contract.** Story 001 defines 13 fields, but this story only verifies the 11 CarEntity-derived values. A bad tick/t mapping would still pass.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TEL-004: _🗄️ Data Integrity & Integration_ | _🟠 Major_ | _⚡ Quick win_ **Don't clear unrelated...

| Field | Value |
|-------|-------|
| **File** | `src/dev-infra/telemetry-recorder.ts:—` |
| **Severity** | 🔴 High |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: _🗄️ Data Integrity & Integration_ | _🟠 Major_ | _⚡ Quick win_ **Don't clear unrelated EventBus listeners during init().** off("race.started") and off("gsm.state.entered") remove every subscriber for those shared events before this recorder re-registers itself. Initializing TelemetryRecorder can therefore break other lifecycle consumers on the same bus. Unsubscribe only this instance's handlers instead of using the blanket overload.

**Recommendation**: Fix before merging. Address the root cause described in the finding.

**Status**: PENDING REVIEW

### TEL-005: _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_ **Validate telemetry intervals...

| Field | Value |
|-------|-------|
| **File** | `src/dev-infra/telemetry-recorder.ts:318` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_ **Validate telemetry intervals at construction.** Passing 0 here silently disables the %-based sampling/logging checks. The API already documents bounded intervals, so reject invalid values up front instead of letting the recorder fail open.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW

### TEL-006: Complete the decision rows before publishing this review document; blank decisions...

| Field | Value |
|-------|-------|
| **File** | `production/epics/telemetry-recorder/PR-15-REVIEW.md:110` |
| **Severity** | 🔵 Low |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Complete the decision rows before publishing this review document; blank decisions contradict the finalized summary counts.

**Recommendation**: Address in a follow-up or document as known issue.

**Status**: PENDING REVIEW

### TEL-007: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Fill in the missing...

| Field | Value |
|-------|-------|
| **File** | `production/epics/telemetry-recorder/PR-15-REVIEW.md:112` |
| **Severity** | 🟡 Medium |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: _📐 Maintainability & Code Quality_ | _🟡 Minor_ | _⚡ Quick win_ **Fill in the missing verdicts.** T-004 and T-005 are still blank in the decision table, so this review document is incomplete even though the rest of the findings are summarized.

**Recommendation**: Address in current sprint or document as deferred.

**Status**: PENDING REVIEW


## Decision Table

| ID | File | Decision | Rationale |
|----|------|----------|-----------|
| TEL-001 | `production/epics/telemetry-recorder/story-005-telemetry-race-lifecycle.md` | SKIP | Completion notes say tests exist and pass but Test Evidence says "Not yet created". Documentation alignment issue. |
| TEL-002 | `src/dev-infra/telemetry-recorder.ts` | FIX | tick() gates console logging via _isRecording but NOT sampling via tickCount % _sampleInterval. After setRecording(false), sample data continues to be captured. Add _isRecording guard before the sampling block at line 362. |
| TEL-003 | `production/epics/telemetry-recorder/story-002-telemetry-sampling-loop.md` | SKIP | Story verification lists 11 CarEntity-derived fields but not tick/t. Code populates both. Story documentation should expand list. |
| TEL-004 | `src/dev-infra/telemetry-recorder.ts` | SKIP | Current code uses eventBus.off(sub) (subscription handle) not off(event). Per-subscription cleanup — only removes own handlers. Fix was applied during implementation (comment at line 256 confirms). |
| TEL-005 | `src/dev-infra/telemetry-recorder.ts` | SKIP | Constructor at lines 304-316 already validates both sampleInterval and logInterval, throws RangeError. Finding is based on code before validation existed. |
| TEL-006 | `production/epics/telemetry-recorder/PR-15-REVIEW.md` | SKIP | Document had blank decision rows. Being resolved by this analysis. |
| TEL-007 | `production/epics/telemetry-recorder/PR-15-REVIEW.md` | SKIP | Same as TEL-006 — blank verdicts being populated now. |
