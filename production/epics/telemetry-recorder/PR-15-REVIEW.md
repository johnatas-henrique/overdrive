# PR #15 Review — Telemetry Recorder Epic

**PR**: [#15 feat(dev-tools): stories 005-007 + e2e infrastructure](https://github.com/johnatas-henrique/overdrive/pull/15)
**Review Date**: 2026-06-28
**Reviewers**: coderabbitai[bot], cubic-dev-ai[bot], greptile-apps[bot]
**Total Comments**: 79 (4 in this epic scope)

---

## Summary

Three AI reviewers analyzed the PR. This document covers findings related to the **Telemetry Recorder epic** (Stories 001-006) and **Tech Debt** (Story 001).

---

## Findings

### T-001: `off("race.started")` removes ALL listeners for that event

| Field | Value |
|-------|-------|
| **File** | `src/dev-infra/telemetry-recorder.ts:279` |
| **Severity** | 🟠 Major |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: `off("race.started")` and `off("gsm.state.entered")` remove every subscriber for those events on the shared bus, not just the TelemetryRecorder's own handlers. This breaks other systems subscribed to the same events.

**Recommendation**: Use `off(subscription)` (unsubscribe by subscription ID) instead of `off(event)` (unsubscribe all handlers for event).

**Status**: PENDING REVIEW

---

### T-002: Validate telemetry intervals at construction

| Field | Value |
|-------|-------|
| **File** | `src/dev-infra/telemetry-recorder.ts:292` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Code |

**Finding**: Passing `0` to `logInterval` or `sampleRate` silently disables the `%`-based sampling/logging checks. The API already documents these as positive integers, but no validation enforces it.

**Recommendation**: Add validation at construction: `if (sampleRate <= 0) throw new Error("sampleRate must be positive")`.

**Status**: PENDING REVIEW

---

### T-003: Include `tick` and `t` in the sampling contract

| Field | Value |
|-------|-------|
| **File** | `production/epics/telemetry-recorder/story-002-telemetry-sampling-loop.md:37` |
| **Severity** | 🟡 Minor |
| **Reviewer** | coderabbitai[bot] |
| **Category** | Documentation |

**Finding**: Story 001 defines 13 fields in TelemetrySample, but Story 002 only verifies the 11 CarEntity-derived values. The `tick` and `t` fields are not explicitly covered in the sampling test cases.

**Recommendation**: Add test cases verifying `tick` and `t` are included in the sampled data.

**Status**: PENDING REVIEW

---

### T-004: Sampling continues when recording is disabled

| Field | Value |
|-------|-------|
| **File** | `src/dev-infra/telemetry-recorder.ts:336` |
| **Severity** | 🟡 Minor |
| **Reviewer** | cubic-dev-ai[bot] |
| **Category** | Code |

**Finding**: The sampling loop continues even when recording is disabled. The `isRecording` flag is checked before adding samples, but the tick counter still increments.

**Recommendation**: Skip tick increment when recording is disabled.

**Status**: PENDING REVIEW

---

### T-005: Document contains contradictory claims

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

## Decision Table

| ID | Decision | Rationale |
|----|----------|-----------|
| T-001 | FIX | Valid. `eventBus.off("race.started")` removes ALL handlers for that event, not just TelemetryRecorder's. The reentrant `off().on()` pattern is the documented API usage, but it destroys other subscribers. Fix: store subscription refs and use `off(subscription)`. Severity: Minor (downgraded from Major — only manifests in dev mode at init time). |
| T-002 | FIX | Valid. No constructor validation — passing `0` makes `tickCount % 0` evaluate to `NaN`, which silently disables sampling with no error. Minor severity is correct. |
| T-003 | SKIP | Finding is invalid. The reviewer claims `tick` and `t` fields are not tested, but `telemetry-sampling.test.ts` lines 67-69 verify `samples[0].tick` and lines 159-160 verify both `s.tick` and `s.t` in the AC-2 test ("should record all 13 fields with correct values"). The story doc lists 13 fields, and the test literally asserts all 13. This is a documentation gap in Story 002's AC list, not a test gap. |
| T-004 | | |
| T-005 | | |

---

## QA Analysis Summary

**Total test findings**: 1
**Recommended FIX**: 0
**Recommended SKIP**: 1
**Recommended DISCUSS**: 0
**Missing coverage found**: 0 (new findings)

### Top Priority Test Fixes
None — the only test finding (T-003) is invalid. The `tick` and `t` fields are already covered in `telemetry-sampling.test.ts` AC-2 tests.

---

## Programmer Analysis Summary

**Total findings (Code)**: 3
**Recommended FIX**: 2
**Recommended SKIP**: 1
**Recommended DISCUSS**: 0

### Top Priority Fixes
1. **T-001** — `off(event)` kills other subscribers on the shared EventBus; switch to `off(subscription)` pattern
2. **T-002** — Constructor should validate `sampleInterval > 0` and `logInterval > 0` to prevent silent misconfiguration

---

## Notes

- Foundation-level findings (event-bus, config-manager, persistence, simulation-snapshot) are documented in the Dev Tools PR-REVIEW.md Foundation section, as they affect both epics.
