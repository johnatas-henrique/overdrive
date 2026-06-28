# PR #15 Review — Tech Debt & Cross-Cutting Findings

**PR**: [#15 feat(dev-tools): stories 005-007 + e2e infrastructure](https://github.com/johnatas-henrique/overdrive/pull/15)
**Review Date**: 2026-06-28
**Reviewers**: coderabbitai[bot], cubic-dev-ai[bot], greptile-apps[bot]
**Total Comments**: 79 (12 in this category)

---

## Summary

This document covers findings that don't fit neatly into the Telemetry or Dev Tools epics — sprint configuration issues, documentation staleness, cross-epic story file inconsistencies, and QA process gaps.

---

## Findings

### X-001: sprint-status.yaml:131 — duplicate `completed` keys

| Field | Value |
|-------|-------|
| **File** | `production/sprint-status.yaml:131` |
| **Severity** | 🟠 Major |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Config |

**Finding**: In both stories 2-11 and 2-14, the later blank `completed` value overwrites the real timestamp, so YAML consumers will treat done work as incomplete.

**Recommendation**: Remove the duplicate `completed` keys.

**Status**: PENDING REVIEW

---

### X-002: sprint-status-01.yaml:19 — stale status summary

| Field | Value |
|-------|-------|
| **File** | `production/sprint-status-01.yaml:19` |
| **Severity** | 🟠 Major |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Config |

**Finding**: Status summary comment is stale and contradicts story statuses. It reports 24 ready stories while the file marks all 29 as done.

**Recommendation**: Update the summary comment to match actual story statuses.

**Status**: PENDING REVIEW

---

### X-003: sprint-status-01.yaml:61 — missing completion date

| Field | Value |
|-------|-------|
| **File** | `production/sprint-status-01.yaml:61` |
| **Severity** | 🟠 Major |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Config |

**Finding**: `status: done` with an empty `completed` field breaks the sprint-status contract and can misreport the archive.

**Recommendation**: Fill in the actual completion date.

**Status**: PENDING REVIEW

---

### X-004: qa-plan-sprint-02:177 — checklist excludes DT-004..DT-008

| Field | Value |
|-------|-------|
| **File** | `production/qa/qa-plan-sprint-02-2026-06-26.md:177` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Checklist excludes DT-004..DT-008 verification as N/A even though they are in sprint scope. QA may miss regressions in the integrated overlay flow.

**Recommendation**: Include DT-004..DT-008 in the checklist.

**Status**: PENDING REVIEW

---

### X-005: qa-plan-sprint-02:223 — coverage claim too strong

| Field | Value |
|-------|-------|
| **File** | `production/qa/qa-plan-sprint-02-2026-06-26.md:223` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: "All 42 stories have passing unit tests with 100% coverage" is too strong because several listed stories are manual/UI verifications instead.

**Recommendation**: Reword to separate automated coverage from manual evidence.

**Status**: PENDING REVIEW

---

### X-006: html-overlay-evidence.md:49 — sign-off row empty

| Field | Value |
|-------|-------|
| **File** | `production/qa/evidence/html-overlay-evidence.md:49` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: Evidence table leaves the approver blank, so this doesn't capture the required lead-programmer sign-off.

**Recommendation**: Populate the missing approver.

**Status**: PENDING REVIEW

---

### X-007: sprint-02.md:89 — dependency mapping conflicts

| Field | Value |
|-------|-------|
| **File** | `production/sprints/sprint-02.md:89` |
| **Severity** | 🟠 Major |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: Dev Tools dependency mapping conflicts with the execution order and stated interface requirement. This can invalidate sprint sequencing for stories.

**Recommendation**: Reconcile dependency mapping with actual execution order.

**Status**: PENDING REVIEW

---

### X-008: story-009-telemetry-provider.md:26 — D5 behavior documented incorrectly

| Field | Value |
|-------|-------|
| **File** | `production/epics/ai-driver/story-009-telemetry-provider.md:26` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Documentation |

**Finding**: D5 behavior is documented as "polled via DSM" but the actual implementation uses DOM `keydown`. This can misdirect future implementations.

**Recommendation**: Update D5 to reflect DOM keydown contract.

**Status**: PENDING REVIEW

---

### X-009: story-009-telemetry-provider.md:27 — align D5 with DOM keydown

| Field | Value |
|-------|-------|
| **File** | `production/epics/ai-driver/story-009-telemetry-provider.md:27` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: Same as X-008 — `polled via DSM` is stale and conflicts with updated Dev Tools rules.

**Recommendation**: Same as X-008.

**Status**: PENDING REVIEW

---

### X-010: story-001-physics-core-skeleton.md:48 — ACs need gating

| Field | Value |
|-------|-------|
| **File** | `production/epics/physics-handling/story-001-physics-core-skeleton.md:48` |
| **Severity** | 🟠 Major |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: AC-3 and AC-6 still read like active acceptance criteria even though the note says the required lifecycle epic has no implementation stories yet. That makes the story look verifiable before it actually is.

**Recommendation**: Split or gate the lifecycle-dependent ACs.

**Status**: PENDING REVIEW

---

### X-011: tech-debt cleanup.test.ts:515 — test coverage gap

| Field | Value |
|-------|-------|
| **File** | `tests/unit/tech-debt-cleanup.test.ts:515` |
| **Severity** | 🔵 Trivial |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Test |

**Finding**: Test coverage gap in tech debt cleanup tests.

**Recommendation**: Add missing test.

**Status**: PENDING REVIEW

---

### X-012: vitest.config.ts:20 — configuration issue

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

## Decision Table

| ID | Decision | Rationale |
|----|----------|-----------|
| X-001 | **FIX** | Valid. Duplicate `completed` key at line 131 silently overwrites the real timestamp at line 127. YAML consumers see `completed: ""` for story 2-11 — sprint tracking tools will treat done work as incomplete. |
| X-002 | **FIX** | Valid. Line 19 comment says "5 done, 24 ready" but all 29 stories are done (status: done). That said: the comment is `#`-prefixed YAML — informational only, no tooling reads it. Downgrade from Major → Minor. |
| X-003 | **FIX** | Valid. Story 1-4 has `status: done` with `completed: ""` — the only story in the file with this gap. All other 28 done stories have dates. If sprint tooling computes duration/velocity from completed dates, this entry produces wrong metrics. |
| X-004 | **DISCUSS** | Valid that DT-004..DT-008 are in sprint scope and marked N/A in the QA checklist. BUT: those stories have their own per-story tests/evidence — the QA plan's DT-003 checklist covers the overlay container only. The N/A may be intentional (separate story QA). Needs producer decision on whether a combined manual regression pass is required. |
| X-005 | **FIX** | Valid. "All 42 stories have passing unit tests with 100% coverage" is false — CAM-009 (Head Bob), CAM-010 (HMR), and several UI stories are manual/visual verification. Easy fix: rephrase to separate automated coverage (e.g. "35 stories with automated tests have 100% coverage") from manual evidence stories. |
| X-006 | **SKIP** | Empty sign-off row is the default state during active QA — the evidence document is expected to be finalized after QA sign-off. This becomes a concern only if the story is marked Complete without the sign-off. If the story is still In Review, this is correct behavior. Downgrade from Minor → Trivial. |
| X-007 | **DISCUSS** | Valid conflict: execution order puts DT-003 before DT-002 (with comment "provides IDevTools interface"), but the dependency table makes DT-003 depend on DT-002 (#9). Both stories shipped successfully so no real blocker occurred, but the sprint doc needs reconciliation. Which direction is correct for future sprints? |
| X-008 | **FIX** | Valid. Story-009 line 26 says "D5 (toggle/reload keys polled via DSM)". The actual Control Manifest (docs/architecture/control-manifest.md:223) says "D5: Dev Tools: toggle/reload keys via DOM `keydown` listener — Not DeviceSourceManager". The implementation matches the Control Manifest. The story file is stale. |
| X-009 | **FIX** | Same as X-008 — same stale text at line 27. Merge with X-008 fix. |
| X-010 | **DISCUSS** | Valid concern, but overstated. The dependency note at line 48 already clearly explains that AC-3 and AC-6 depend on the Entity/Car Lifecycle epic which has no implementation stories yet. A developer reading this story would see the note. The `[ ]` formatting is cosmetic. Options: (a) change AC-3/AC-6 to `[~]` with gating note, (b) leave as-is since the note is clear. Downgrade from Major → Minor. |
| X-011 | **SKIP** | No specific gap identified. The finding says "test coverage gap" without saying what gap. Looking at the referenced test (tech-debt-cleanup.test.ts:500-530), it's a well-structured edge case for Error.stack being undefined. Without actionable detail, this is not worth addressing. |
| X-012 | **SKIP** | "Configuration may need adjustment" with no specific issue. Examining vitest.config.ts:20 — it's `"src/**/index.ts"` in the coverage exclude list. Excluding barrel files from coverage is standard practice. No issue found. |

---

## Programmer Analysis Summary

**Total findings**: 12
**Recommended FIX**: 5 (X-001, X-002, X-003, X-005, X-008/X-009)
**Recommended SKIP**: 4 (X-006, X-011, X-012; X-009 merged with X-008)
**Recommended DISCUSS**: 3 (X-004, X-007, X-010)

### Severity Reassessments
- X-002: Major → Minor (cosmetic `#` comment, zero tooling impact)
- X-006: Minor → Trivial (empty sign-off is default state during active QA)
- X-007: Major → Minor (real inconsistency but didn't block delivery)
- X-010: Major → Minor (dependency note already covers the concern)
- X-008/X-009: Minor (confirmed — documentation staleness)

### Top Priority Fixes
1. **X-001** — sprint-status.yaml duplicate `completed` key causes actual data loss for story 2-11. 30-second fix.
2. **X-003** — sprint-status-01.yaml missing completion date on story 1-4. Affects velocity metrics. 30-second fix.
3. **X-008/X-009** — story-009-telemetry-provider.md describes D5 as "DSM" when it's DOM `keydown`. Could misdirect future work. 2-minute fix.

### Needs User Decision
- **X-004**: Does the QA plan need a combined manual regression for DT-004..DT-008, or is per-story QA sufficient?
- **X-007**: Which direction should the dependency ordering between DT-002 and DT-003 be in the sprint doc?
- **X-010**: Gate the lifecycle-dependent ACs explicitly, or keep the note-only approach?

---

## QA Analysis Summary

**Analyst**: qa-tester
**Date**: 2026-06-28
**Scope**: Test-category findings (X-011, X-012) + cross-cutting test gap analysis

### Test-Category Findings (Verified)

| ID | Verdict | Detail |
|----|---------|--------|
| X-011 | **FIX** (was marked SKIP by programmer) | The programmer's SKIP rationale says "no specific gap identified" — but there IS a specific gap. The test at line 515 patches `Error.prototype.stack` to `undefined` and verifies `cm.get()` doesn't throw. It does NOT assert that the access log's `caller` field is an empty string. The source code (config-manager.ts:175-181) falls through to `caller = ""` in the catch block — this is the intended behavior for non-V8 environments, and it should be explicitly tested. One-line fix: add `expect(state.accessLog[0].caller).toBe("")` after the get call. |
| X-012 | **SKIP** (agree with programmer) | The vitest.config.ts exclude list (`index.ts`, `types.ts`) is standard TypeScript practice — barrel files and type-only files have no runtime logic. No actionable issue. |

### Test Gaps Not Flagged by Any Reviewer

| ID | File | Gap | Severity | Recommendation |
|----|------|-----|----------|----------------|
| QG-001 | `tech-debt-cleanup.test.ts` W-1 | The "stack trace undefined" test doesn't assert the access log `caller` value. This is the same issue as X-011 — the reviewers flagged the line but didn't articulate the specific assertion gap. | 🟡 Minor | Add assertion: `expect(state.accessLog[0].caller).toBe("")` |
| QG-002 | `tech-debt-cleanup.test.ts` C-2 | The `dispose()` idempotency test (line 234) checks that double-dispose doesn't throw, but doesn't verify the registry is still cleared. After two dispose calls, `takeSnapshot()` should still throw `SnapshotError`. | 🔵 Trivial | Add: `expect(() => ss.takeSnapshot(0)).toThrow(SnapshotError)` after second dispose |
| QG-003 | `tech-debt-cleanup.test.ts` W-2 | The "process.env guard" test (line 593) stubs `process` to `undefined` but the `afterEach` at line 588 only calls `vi.unstubAllGlobals()`. If the test at line 623 (which sets `process.env = { ... }`) runs, it mutates `process.env` directly. The afterEach doesn't restore it. In practice this works because `vi.unstubAllGlobals()` restores the `process` global, but it's fragile if test ordering changes. | 🔵 Trivial | Consider explicit `process.env` restoration in afterEach |

### Cross-File Test Coverage Assessment

I reviewed the full test suite for the foundation systems covered by this PR:

| System | Dedicated Test File | Coverage in tech-debt-cleanup.test.ts | Assessment |
|--------|--------------------|---------------------------------------|------------|
| ConfigManager | `tests/unit/config-manager.test.ts` (1064 lines, 40+ tests) | W-1 (stack trace), W-2 (process.env guard) | ✅ Adequate. Dedicated file covers register/get/invalidate/reload/setRuntime/env-override thoroughly. Tech-debt tests add edge-case coverage for non-V8 stack traces and browser env guards. |
| Persistence | `tests/unit/persistence.test.ts` (1200+ lines, 50+ tests) | C-1 (JSON.stringify failure), C-3 (retry queue) | ✅ Adequate. Dedicated file covers init/save/load/delete/retry/migration/corruption. Tech-debt tests add retry-queue and Degraded-mode coverage. |
| SimulationSnapshot | `tests/unit/snapshot.test.ts` | C-2 (dispose clears registry) | ✅ Adequate. Dedicated file covers hash/serialize/deserialize. Tech-debt test adds dispose-with-failure coverage. |
| FixedUpdatePipeline | None (only in tech-debt-cleanup.test.ts) | W-3 (slot exception logging) | ⚠️ Acceptable but thin. Only tested via tech-debt cleanup. Consider a dedicated test file if pipeline complexity grows. |
| PipelineRuntime | None (only in tech-debt-cleanup.test.ts) | W-4 (dev guard lifecycle), W-5 (JSDoc instance method) | ⚠️ Acceptable but thin. Only tested via tech-debt cleanup. The attach/detach guard tests are good but don't cover the render loop callback or accumulator behavior. |

### Disagreements with Programmer Analysis

1. **X-011**: Programmer marked SKIP. I disagree — there IS a concrete assertion gap. The test exists but doesn't verify the access log caller value. This is a one-line fix.

2. **X-004**: Programmer marked DISCUSS. I lean toward FIX. The QA plan's checklist should be comprehensive for the sprint — if DT-004..DT-008 are in scope, they should appear in the checklist even if they have per-story evidence. The checklist is the single source of truth for what QA verified.

3. **X-006**: Programmer marked SKIP. I partially agree — empty sign-off is normal during active QA. But if the story is marked Complete, the approver must be populated. The finding is valid as a "needs resolution before story completion" flag, not as a bug.

### Final Verdict

**9 FIX, 2 SKIP, 1 DISCUSS** (with severity adjustments):

| Priority | Findings | Action |
|----------|----------|--------|
| 🔴 Critical | X-001, X-003 | Fix now — YAML data loss |
| 🟠 High | X-005, X-008/X-009 | Fix before QA gate — false claims, stale docs |
| 🟡 Medium | X-002, X-004, X-007, X-011, QG-001 | Fix this sprint — process/doc/test integrity |
| 🔵 Low | X-006, X-010, X-012, QG-002, QG-003 | Defer — cosmetic or no concrete issue |
