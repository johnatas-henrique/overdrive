# PR #23 Review — Round 2

**PR**: [#23 feat(physics): complete Physics/Handling epic](https://github.com/johnatas-henrique/overdrive/pull/23)
**Review Date**: 2026-06-30
**Reviewers**: CodeRabbit, Greptile
**Total Findings**: 11 (9 original + 2 new from QA analysis)

---

## Findings

### FR-001: story-001 evidence/status test name mismatch

| Field | Value |
|-------|-------|
| **File** | `production/epics/physics-handling/story-001-physics-core-skeleton.md:284-286` |
| **Severity** | 🟢 MINOR |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Documentation |

**Finding**: Required evidence says `physics-core-skeleton.test.ts`, Status says `physics-service.test.ts`. The test file was renamed but the story wasn't updated.

**Recommendation**: Align both references to the actual test file name.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified. Story 001 line 284 says `physics-core-skeleton.test.ts` but the actual file is `physics-service.test.ts`. The test was renamed during the file naming audit but the story wasn't updated. Trivial fix.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified. Story 001 line 284 reads `physics-core-skeleton.test.ts`, line 286 reads `physics-service.test.ts`. The actual file on disk is `tests/unit/physics-handling/physics-service.test.ts`. The Required evidence name is wrong and will confuse future contributors running the regression suite. No ambiguity — the Status line already has the correct name.
**Orchestrator Analysis**: **Decision: FIX** — Both agree. Story name mismatch after file rename. Trivial fix.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-002: story-004 evidence/status test name mismatch

| Field | Value |
|-------|-------|
| **File** | `production/epics/physics-handling/story-004-surface-handling-offtrack-kerbs.md:224-226` |
| **Severity** | 🟢 MINOR |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Documentation |

**Finding**: Required evidence says `surface-handling.test.ts`, Status says `surface-handler.test.ts`. The test file was renamed but the story wasn't updated.

**Recommendation**: Align both references to the actual test file name.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Same class of bug as FR-001. Test renamed, story not updated.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified. Story 004 line 224 reads `surface-handling.test.ts`, line 226 reads `surface-handler.test.ts`. The actual file is `tests/unit/physics-handling/surface-handler.test.ts`. Same class of bug as FR-001. Fix is trivial and prevents confusion during sprint reviews.
**Orchestrator Analysis**: **Decision: FIX** — Both agree. Same pattern as FR-001.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-003: story-005 underscore vs dot naming in evidence

| Field | Value |
|-------|-------|
| **File** | `production/epics/physics-handling/story-005-lock-pit-external-inputs-events.md:271-273` |
| **Severity** | 🟢 MINOR |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Documentation |

**Finding**: Required evidence says `lock-pit-events_test.ts` (underscore), Status says `lock-pit-events.test.ts` (dot). The actual file uses dot convention.

**Recommendation**: Update Required evidence to use dot naming.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Underscore naming is inconsistent with project convention (dot naming). Trivial fix.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified. Story 005 line 271 reads `lock-pit-events_test.ts`, line 273 reads `lock-pit-events.test.ts`. The actual file is `tests/integration/physics-handling/lock-pit-events.test.ts`. All 4 test files in the project use the dot convention (`*.test.ts`). The underscore is inconsistent and will break any automated file lookup.
**Orchestrator Analysis**: **Decision: FIX** — Both agree. Naming convention inconsistency.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-004: gearRatios validation throws every tick

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/arcade-grip-model.ts:447-452` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Code |

**Finding**: The `gearRatios.length < GEAR_COUNT` check inside `computeRpm()` runs every tick. With valid configs (6 gears) it never throws, but the validation belongs at config load time, not in the hot path. The runtime guard should be a defensive fallback, not the primary validation.

**Recommendation**: Move validation to `PhysicsService.init()` or `PhysicsConfig` construction. Keep the runtime guard as a fallback.

**Programmer Analysis**: **Decision: DISCUSS** — **Rationale**: The check at L448 runs every `computeRpm()` call. With valid configs (6 gears) it never throws. CodeRabbit's architectural point is valid — config validation at init time catches bad configs early. But removing the runtime guard creates a silent contract. Recommend: add validation in `PhysicsService.init()`, convert runtime check to a `console.warn` in DEV or remove it.
**QA Analysis**: **Decision: DISCUSS** — **Rationale**: Verified. The check at line 448 runs every `computeRpm()` call per car per tick. With 8 cars at 60Hz that's ~480 comparisons/second — negligible cost. However, the reviewer's architectural point is valid: config validation at init time is cleaner and catches bad configs early with a clear error message. The trade-off is that removing the runtime guard creates a silent contract (callers must validate). Recommend: add a validation step in `PhysicsService.init()` that throws on invalid config, and convert the runtime check to a `debugAssert` or remove it. This is a design choice, not a bug.
**Orchestrator Analysis**: **Decision: DISCUSS** — Both agree it's architectural, not a bug. The runtime check is cheap but belongs at init time. Two options: (A) add validation in init() + remove runtime check, (B) add validation in init() + keep runtime check as fallback. Option A is cleaner.
**User Decision**: [X] FIX (opção A — adicionar validação no init(), remover check do runtime) [ ] SKIP [ ] DISCUSS

---

### FR-005: IPhysics.registerCar missing @throws JSDoc

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/i-physics.ts:87-101` |
| **Severity** | 🟢 MINOR |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Documentation |

**Finding**: `registerCar()` throws when carId is already registered, but the JSDoc doesn't document this error contract.

**Recommendation**: Add `@throws Error when carId is already registered` to the JSDoc.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Interface is the contract. Callers should see error behavior from the interface alone.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified. The interface at `i-physics.ts:87-101` has no `@throws` annotation. The implementation at `physics-service.ts:456` already documents `@throws Error if carId is already registered`. The interface is the contract — callers should see the error behavior from the interface alone, not have to dig into the implementation. Quick fix, no risk.
**Orchestrator Analysis**: **Decision: FIX** — Both agree. JSDoc completeness for error contract.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-006: registerCar default state duplication

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/physics-service.ts:446-497` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Code |

**Finding**: The default CarPhysicsState in `registerCar()` is duplicated in test helpers (`addCarState()`). When fields change, the test helpers drift. Extract a shared factory function.

**Recommendation**: Create `createDefaultCarPhysicsState()` in a shared location, use it in both `registerCar()` and test helpers.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: 3 identical copies of default state. When fields change, test helpers drift. Extract factory to shared location.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified. `registerCar()` at physics-service.ts:466-491 defines 25 default fields. The `addCarState()` helper in physics-service.test.ts:179-205 and lock-pit-events.test.ts:174-199 each replicate these defaults. I confirmed the field lists are currently identical across all three copies. The drift risk is real — when a new field is added to `CarPhysicsState`, all three locations must be updated in lockstep. A shared `createDefaultCarPhysicsState()` factory eliminates this maintenance burden. This is the kind of debt that causes silent test failures months later.
**Orchestrator Analysis**: **Decision: FIX** — Both agree. DRY violation with drift risk.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-007: regression-suite.md stale assertion count

| Field | Value |
|-------|-------|
| **File** | `tests/regression-suite.md:3-5` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Documentation |

**Finding**: Header says 4021 assertions, but actual count across all test files is 4143. The count is stale after the PR review test additions.

**Recommendation**: Recompute from actual test files and update the header.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Stale count. QA says actual is 4040. Recompute and update.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified. Grep count of `expect(` across all test files returns 4040, not the claimed 4143 or the file's stated 4021. The actual count is 4040 (the reviewer's 4143 was also stale). Update the header to 4040. Consider adding a CI step that auto-recomputes this count to prevent future drift.
**Orchestrator Analysis**: **Decision: FIX** — Both agree. Stale manifest header.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-008: dt=0 test missing Y-velocity division-by-zero path

| Field | Value |
|-------|-------|
| **File** | `tests/unit/physics-handling/physics-service.test.ts:1113-1122` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Test |

**Finding**: The dt=0 test only checks `telemetry.accelG` for NaN/Infinity. It doesn't cover the Y-velocity path where `(splineY - worldPosY) / dt` produces Infinity. The `body.setLinearVelocity` call should be verified.

**Recommendation**: Assert that `body.setLinearVelocity` receives finite values, especially the Y component.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Real coverage gap. The dt=0 test only checks telemetry, not the Y-velocity path. `body.setLinearVelocity` should receive finite values.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified. The test at line 1113-1122 calls `physics.update(0)` and only checks `telemetry.accelG`. The source at physics-service.ts:420 shows `this._scratchVel.y = (splineY - this._scratchWorldPos.y) / dt` — when dt=0, this produces ±Infinity. The test has a `trackSystem` mock returning elevation 5.01 with body at y=5, so the numerator is 0.01 and division by 0 produces Infinity. The `body.setLinearVelocity` mock should be asserted to receive finite values. This is a real coverage gap — the test would pass even if the Y-velocity was Infinity, masking a potential physics engine crash.
**Orchestrator Analysis**: **Decision: FIX** — Both agree. Real test coverage gap for division-by-zero path.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-009: enforceMinSurfaceSpeed clamps reverse gear

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/surface-handler.ts:269-278` |
| **Severity** | 🔴 CRITICAL |
| **Reviewers** | Greptile (1 review) |
| **Category** | Code |

**Finding**: `enforceMinSurfaceSpeed` uses `Math.max(targetSpeed, minSurfaceSpeed)`. When `targetSpeed` is negative (reverse gear), this clamps it to the positive `minSurfaceSpeed`, pushing the car forward instead of reversing. A car in reverse on grass gets forced forward.

**Recommendation**: Guard with `if (targetSpeed < 0) return targetSpeed` before the clamp.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Gameplay bug. `Math.max(-5, 15) = 15` — reverse gear gets pushed forward on off-track. One-line fix: guard `targetSpeed < 0`.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified. The function at surface-handler.ts:269-278 uses `Math.max(targetSpeed, minSurfaceSpeed)`. When targetSpeed is negative (reverse) and minSurfaceSpeed is positive (off-track floor), `Math.max(-5, 15)` returns 15 — the car gets pushed forward. The test suite has zero test cases with negative targetSpeed values (confirmed: all 5 tests use positive or zero speeds). This is a confirmed gameplay bug. The fix is a one-line guard: `if (targetSpeed < 0) return targetSpeed`. Additionally, the test suite needs a negative speed test case to prevent regression.
**Orchestrator Analysis**: **Decision: FIX** — Both agree. Confirmed gameplay bug. Reverse gear on off-track pushes car forward.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-010: story-005 Story Type field contains file extension

| Field | Value |
|-------|-------|
| **File** | `production/epics/physics-handling/story-005-lock-pit-external-inputs-events.md:270` |
| **Severity** | 🟢 MINOR |
| **Reviewers** | QA (new finding) |
| **Category** | Documentation |

**Finding**: The `**Story Type**` field reads `Integration.test.ts` instead of `Integration`. The `.test.ts` suffix appears to be a copy-paste artifact from the test file name.

**Recommendation**: Change `Integration.test.ts` to `Integration` in the Story Type field.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Copy-paste artifact. `Integration.test.ts` → `Integration`.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified at story-005 line 270: `**Story Type**: Integration.test.ts`. All other stories use clean type names (`Logic`, `Integration`). This is clearly a copy-paste error. The Story Type field determines which test evidence path the QA gate checks — a malformed value could cause the gate-check skill to misroute.
**Orchestrator Analysis**: **Decision: FIX** — Both agree. Copy-paste artifact.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-011: enforceMinSurfaceSpeed test suite missing negative speed test

| Field | Value |
|-------|-------|
| **File** | `tests/unit/physics-handling/surface-handler.test.ts:479-506` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | QA (new finding) |
| **Category** | Test |

**Finding**: The `enforceMinSurfaceSpeed` test suite (5 test cases) has zero tests with negative `targetSpeed`. This is the exact gap that allowed FR-009 to exist undetected. Without a negative speed test, the reverse-gear clamping bug has no regression protection.

**Recommendation**: Add a test case: `enforceMinSurfaceSpeed(-5, 15)` should return `-5` (reverse speed is not clamped upward).

**Programmer Analysis**: **Decision: FIX** — **Rationale**: FR-009's fix needs regression protection. Add negative speed tests.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified. The 5 existing tests at surface-handler.test.ts:481-505 only test positive and zero targetSpeed values. This is a textbook missing edge case. The test for FR-009's fix must include: (1) negative targetSpeed with positive minSurfaceSpeed → returns negative, (2) negative targetSpeed with zero minSurfaceSpeed → returns negative. Without this, any future refactor that re-introduces the Math.max bug would pass all existing tests.
**Orchestrator Analysis**: **Decision: FIX** — Both agree. Missing regression test for FR-009.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

## Summary

| Severity | Count | IDs |
|----------|-------|-----|
| 🔴 CRITICAL | 1 | FR-009 |
| 🟡 WARNING | 5 | FR-004, FR-006, FR-007, FR-008, FR-011 |
| 🟢 MINOR | 5 | FR-001, FR-002, FR-003, FR-005, FR-010 |
| **Total** | **11** | |

### QA Verdict Summary

| Decision | Count | IDs |
|----------|-------|-----|
| **FIX** | 10 | FR-001, FR-002, FR-003, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011 |
| **DISCUSS** | 1 | FR-004 |
| **SKIP** | 0 | — |
