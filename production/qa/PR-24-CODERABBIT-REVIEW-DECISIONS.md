# PR #24 CodeRabbit Review Decisions

**Reviewer:** CodeRabbit
**Date:** 2026-07-01
**Total findings:** 14
**Already fixed:** 2 (#13, #14 — by 8-fix batch)
**Active findings:** 12

---

### FR-001: SKILL.md npx unpinned commands

| Field | Value |
|-------|-------|
| **File** | `.opencode/skills/pr-review-decisions/SKILL.md:179-181,192-194` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Documentation |

**Finding**: `npx vitest run`, `npx tsc --noEmit`, `npx biome check` use unpinned npx invocations that can pull arbitrary upstream updates.

**Recommendation**: Replace `npx` with `npm exec` or pin versions.

**Programmer Analysis**: **Decision: SKIP** — **Rationale**: The `npx` commands in a SKILL.md are instructions for the agent to run within the project context. The project has these tools as local `devDependencies` pinned by `package.json`/`package-lock.json`, so `npx` resolves to `node_modules/.bin/` first (never downloads arbitrary versions). This is standard Vite/Node project convention across all SKILL.md files. No real risk.
**QA Analysis**: **Decision: SKIP** — **Rationale**: Agree with programmer. `npx` resolves to local `node_modules/.bin/` first per npm spec when `devDependencies` are installed. Documentation-only finding with zero runtime risk. No test evidence needed.
**Orchestrator Analysis**: _pending_
**User Decision**: [ ] FIX [ ] SKIP [ ] DISCUSS

---

### FR-002: SKILL.md mixed Portuguese/English

| Field | Value |
|-------|-------|
| **File** | `.opencode/skills/pr-review-decisions/SKILL.md:136-150` |
| **Severity** | 🟢 MINOR |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Documentation |

**Finding**: Phase 6 output section mixes Portuguese labels ("Resumo das Decisões", "Itens para DISCUSS", "Minha posição") with English content.

**Recommendation**: Rename headings to English equivalents.

**Programmer Analysis**: **Decision: SKIP** — **Rationale**: Cosmetic inconsistency in a template/output-format section of a SKILL.md. The Portuguese headings appear in the agent's output format specification and don't affect any functionality, source code, or tooling. Not worth the churn.

**QA Analysis**: **Decision: SKIP** — **Rationale**: Agree with programmer. Documentation-only, no runtime impact. The Portuguese template section is internal agent output format, not player-facing or tooling-facing. Cosmetic issue with no testability concern.
**Orchestrator Analysis**: _pending_
**User Decision**: [ ] FIX [ ] SKIP [ ] DISCUSS

---

### FR-003: ArcadeGripModel brake creates propulsion from rest

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/arcade-grip-model.ts:734-760` |
| **Severity** | 🔴 CRITICAL |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Code |

**Finding**: When speedMs is 0 and gear is -1, `brakeSign = engineState.speedMs >= 0 ? -1 : 1` evaluates to -1 (since 0 >= 0). This applies negative brake force to a stationary car, pushing it backward. Brake should only oppose existing motion, not create propulsion from rest.

**Recommendation**: Add `speedMs === 0` guard to make brakeSign neutral when stationary.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Real critical bug. When `speedMs === 0` and brake is applied, `brakeSign = engineState.speedMs >= 0 ? -1 : 1` evaluates to `-1` (because `0 >= 0` is `true`). This applies a negative brake force to a stationary car, creating propulsion from rest. Fix: add `speedMs === 0` guard so brakeSign is 0 (neutral) when stationary — brake should only oppose existing motion, never create motion.

**QA Analysis**: **Decision: FIX** — **Rationale**: Confirmed critical. At line 739: `brakeSign = engineState.speedMs >= 0 ? -1 : 1` → when speedMs=0, brakeSign=-1, applying negative force to a stationary car. Existing test `test_reverseBraking_deceleratesTowardZero` only tests speedMs=-5, NOT speedMs=0. **Gap**: No test covers braking at zero speed. Fix must include a test: `speedMs=0, gear=-1, brake=1` → expect newSpeed === 0 (no backward motion from rest).
**Orchestrator Analysis**: _pending_
**User Decision**: [ ] FIX [ ] SKIP [ ] DISCUSS

---

### FR-004: Surface state stale on provider swap

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/physics-service.ts:566-575` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Code |

**Finding**: `setSurfaceProvider()` only clears `_surfaceStates` when provider is set to `null`. Swapping between two non-null providers reuses stale kerbTimer and wasOnKerb data.

**Recommendation**: Clear `_surfaceStates` whenever provider changes, not just on null.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Real logical gap. `setSurfaceProvider()` only clears `_surfaceStates` when `provider === null`. Swapping between two non-null providers reuses stale kerbTimer and wasOnKerb data from the previous provider's surface decisions, which may differ. Fix: move `_surfaceStates.clear()` outside the `if (provider === null)` block so it runs on every provider change.

**QA Analysis**: **Decision: FIX** — **Rationale**: Confirmed. At lines 571-573, `_surfaceStates.clear()` is inside `if (provider === null)`. When swapping providers A→B (both non-null), stale kerbTimer/wasOnKerb from provider A persists. **Gap**: No test covers provider swap between two non-null providers. Fix must include a test that verifies surface states are cleared after provider swap.
**Orchestrator Analysis**: _pending_
**User Decision**: [ ] FIX [ ] SKIP [ ] DISCUSS

---

### FR-005: Missing tuple validation in init()

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/physics-service.ts:189-196` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Code |

**Finding**: Init-time validation only checks `gearRatios.length < 6`, but `topSpeedL1toL5`, `accelerationL1toL5`, and `corneringL1toL5` have the same truncation risk.

**Recommendation**: Extend validation to verify each tuple-backed config array has full expected length.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Valid gap. `gearRatios.length < 6` is validated at init, but `topSpeedL1toL5`, `accelerationL1toL5`, and `corneringL1toL5` (all typed as `[number, number, number, number, number]` tuples) have no similar runtime length check. The project already established the defense-in-depth pattern with `gearRatios`. Adding symmetric `length < 5` checks for the other three tuple arrays follows the existing pattern consistently. Trivial 3-line addition with no risk.

**QA Analysis**: **Decision: FIX** — **Rationale**: Confirmed. All four tuple configs should be validated symmetrically. TypeScript tuples provide compile-time safety but not runtime safety for dynamically-loaded configs (e.g., JSON config files). Adding `length < 5` checks for `topSpeedL1toL5`, `accelerationL1toL5`, `corneringL1toL5` follows the existing `gearRatios` pattern. Low risk, high defense value.
**Orchestrator Analysis**: _pending_
**User Decision**: [ ] FIX [ ] SKIP [ ] DISCUSS

---

### FR-006: NaN in fuel updates

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/physics-service.ts:624-628` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Code |

**Finding**: `Math.max(0, Math.min(1, fuelMult))` returns NaN when fuelMult is NaN. NaN can flow into `computeTargetSpeed()` and `computeGripMax()`.

**Recommendation**: Validate fuelMult is finite before storing; reject non-finite values with safe fallback.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: `Math.max(0, Math.min(1, fuelMult))` returns `NaN` when `fuelMult` is `NaN`, defeating the stated purpose of "Defense-in-depth: clamp to [0, 1]." The clamp doesn't defend against NaN. While TypeScript typing should prevent NaN from reaching here, the comment explicitly says this is a defense layer. Fix: guard with `Number.isFinite(fuelMult)` before clamping, falling back to `1` (full fuel) for invalid values.

**QA Analysis**: **Decision: FIX** — **Rationale**: Confirmed. `Math.min(1, NaN)` → NaN, `Math.max(0, NaN)` → NaN. NaN propagates into `computeTargetSpeed()` and `computeGripMax()`. The same bug exists in `onTireUpdate` at line 636-638. **Gap**: No test for NaN input to `onFuelUpdate` or `onTireUpdate`. Fix must include tests for both methods with NaN, Infinity, and negative inputs.
**Orchestrator Analysis**: _pending_
**User Decision**: [ ] FIX [ ] SKIP [ ] DISCUSS

---

### FR-007: removeCar pending updates not cleared

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/physics-service.ts:498-505` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Code |

**Finding**: `removeCar()` doesn't clear `_pendingFuelUpdates` or `_pendingTireUpdates`. Stale updates can be replayed on a re-registered car.

**Recommendation**: Add `this._pendingFuelUpdates.delete(carId)` and `this._pendingTireUpdates.delete(carId)` to removeCar.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Real cleanup omission. `removeCar()` clears `_carStates`, `_surfaceStates`, `_inputStates`, `_telemetry`, `_pitCars`, and `_lockedCars` but does NOT clear `_pendingFuelUpdates` or `_pendingTireUpdates`. If a car with the same `carId` is re-registered later, stale pending fuel/tire values from the old car would be applied on the next tick. Fix: add `this._pendingFuelUpdates.delete(carId)` and `this._pendingTireUpdates.delete(carId)` to `removeCar()`.

**QA Analysis**: **Decision: FIX** — **Rationale**: Confirmed. `removeCar()` cleans up 6 maps but misses `_pendingFuelUpdates` and `_pendingTireUpdates` (declared at lines 114-118). While `_applyPendingUpdates()` clears both maps after each tick, a race exists: `onFuelUpdate(carX, 0.5)` → `removeCar(carX)` → re-register `carX` → next `_applyPendingUpdates` applies stale 0.5 to the new car. **Gap**: No test covers this scenario. Fix must include a test: register → pending update → remove → re-register same ID → verify stale update does NOT apply.
**Orchestrator Analysis**: _pending_
**User Decision**: [ ] FIX [ ] SKIP [ ] DISCUSS

---

### FR-008: registerCar initialState overwrites carId/body

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/physics-service.ts:474-486` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Code |

**Finding**: `Object.assign(state, initialState)` can overwrite `carId` and `body`, breaking registry invariants.

**Recommendation**: Destructure initialState to exclude `carId` and `body`, or use targeted field assignment.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: `Object.assign(state, initialState)` in `registerCar()` can overwrite `state.carId` and `state.body` if `initialState` includes these fields. `carId` is the key in the `_carStates` Map and `body` is the physics body reference — both are registry invariants that must not be externally overwritable. Fix: destructure `initialState` to exclude `carId` and `body`, using targeted field assignment for the remaining properties.

**QA Analysis**: **Decision: FIX** — **Rationale**: Confirmed. At line 483: `Object.assign(state, initialState)` — if `initialState` contains `{ carId: "wrong", body: null }`, the registry key and body reference are silently corrupted. The existing test at line 1222 uses `{ gear: 3, rpm: 5000, speedKmh: 100 }` which doesn't exercise this path. **Gap**: No test verifies that passing `{ carId: "x" }` in initialState doesn't overwrite the real carId. Fix must include a test that confirms `carId` and `body` are preserved regardless of initialState.
**Orchestrator Analysis**: _pending_
**User Decision**: [ ] FIX [ ] SKIP [ ] DISCUSS

---

### FR-009: enforceMinSurfaceSpeed stale comment

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/surface-handler.ts:272-276` |
| **Severity** | 🟢 MINOR |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Documentation |

**Finding**: Comment says "guard against negative or zero target speed" but condition only checks `targetSpeed < 0` (negative), not zero. Zero targetSpeed IS clamped upward when minSurfaceSpeed > 0.

**Recommendation**: Reword comment to match actual condition.

**Programmer Analysis**: **Decision: SKIP** — **Rationale**: The comment says "guard against negative or zero target speed (reverse gear)." The condition `targetSpeed < 0` guards against negative, and `targetSpeed === 0` with `minSurfaceSpeed > 0` falls through to `Math.max(targetSpeed, minSurfaceSpeed)` which clamps zero upward. The comment is slightly imprecise (it implies both are early-returned, but zero is clamped via `Math.max`) but functionally harmless. The code behavior is correct for all cases. A doc-only nit, not worth the diff.

**QA Analysis**: **Decision: FIX** — **Rationale**: Disagree with SKIP. The comment is factually wrong: it says "negative or zero" but the condition only checks `targetSpeed < 0` (negative). Zero targetSpeed is NOT early-returned — it falls through to `Math.max(targetSpeed, minSurfaceSpeed)`. This is a real documentation bug that misleads future developers about the guard's scope. The fix is a one-word comment change ("negative or zero" → "negative"). Worth the trivial diff to prevent confusion.
**Orchestrator Analysis**: _pending_
**User Decision**: [ ] FIX [ ] SKIP [ ] DISCUSS

---

### FR-010: Test reimplements comparator inline

| Field | Value |
|-------|-------|
| **File** | `tests/unit/physics-handling/physics-service.test.ts:1291-1303` |
| **Severity** | 🟢 MINOR |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Test |

**Finding**: Collision sort stability test reimplements the comparator inline instead of using `PhysicsService.compareByCarId`.

**Recommendation**: Replace inline sort callback with `PhysicsService.compareByCarId`.

**Programmer Analysis**: **Decision: SKIP** — **Rationale**: The test reimplements the comparator inline (`(a, b) => a.carId < b.carId ? -1 : a.carId > b.carId ? 1 : 0`) instead of importing `PhysicsService.compareByCarId`. The inline code is trivially correct and functionally identical to the static method. The benefit of importing the real method (auto-sync if comparator changes) is minimal — this comparator is a stable, pure lexicographic comparison unlikely to change. Not worth the coupling and import overhead for a test.

**QA Analysis**: **Decision: FIX** — **Rationale**: Disagree with SKIP. The test's purpose is to verify that the sort comparator handles equal carIds correctly. If `compareByCarId` is ever modified (e.g., to add secondary sort key), the inline test would still pass with the old logic, giving false confidence. Using the real method ensures the test catches regressions. One-line change, high test fidelity value.
**Orchestrator Analysis**: _pending_
**User Decision**: [ ] FIX [ ] SKIP [ ] DISCUSS

---

### FR-011: surface-handler.test.ts stale comment

| Field | Value |
|-------|-------|
| **File** | `tests/unit/physics-handling/surface-handler.test.ts:30-44` |
| **Severity** | 🟢 MINOR |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Documentation |

**Finding**: Comment mentions "config field comment 'm/s' is a documentation bug" but the comment already correctly describes it as a fraction. The review says to remove the note, but it's actually accurate documentation of a known issue.

**Recommendation**: SKIP — comment is already correct.

**Programmer Analysis**: **Decision: SKIP** — **Rationale**: The comment in the test file accurately describes a known documentation bug in the config field `offTrackMinSpeedFraction` (the field's doc says "m/s" but the value is a fraction of topSpeed). The test comment is correct and informative, not stale. The reviewer also recommended SKIP. No action needed.

**QA Analysis**: **Decision: SKIP** — **Rationale**: Agree with programmer and reviewer. The comment at lines 42-44 is accurate: it documents a known issue where the config field's doc says "m/s" but the value functions as a fraction of topSpeed. The comment correctly states "Bug noted but not fixed here; tracked separately in design review follow-up." This is proper issue tracking documentation, not stale text.
**Orchestrator Analysis**: _pending_
**User Decision**: [ ] FIX [ ] SKIP [ ] DISCUSS

---

### FR-012: sprint-status.yaml duplicate keys

| Field | Value |
|-------|-------|
| **File** | `production/sprint-status.yaml:382-387` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Documentation |

**Finding**: Duplicate `completed:` and `blocker:` keys in story entries. YAML consumers may read wrong values.

**Recommendation**: Remove duplicate keys, keep intended values.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Two entries have duplicate keys in the YAML file: (1) Entry `2-36` (Camera Foundation) has duplicate `completed:` — line 383 has `completed: 2026-06-30` overwritten by `completed: ""` on line 387. (2) Entry `2-38` (Cockpit Camera) has both duplicate `blocker: ""` and duplicate `completed: ""` — lines 407-409 add second `blocker` and `completed` keys that overwrite the legitimate values. YAML spec dictates last-value-wins for duplicate keys. Fix: remove the duplicate `completed: ""` and `blocker: ""` lines from both entries.

**QA Analysis**: **Decision: FIX** — **Rationale**: Confirmed. YAML spec mandates last-value-wins for duplicate keys. Entry `2-36` at line 387 has `completed: ""` which overwrites the legitimate `completed: 2026-06-30` from line 383 — this silently erases the completion date. Entry `2-38` has similar overwrites. Any YAML consumer (sprint tools, CI scripts) would read wrong values. Fix is mechanical: remove duplicate keys, keep intended values.

**Orchestrator Analysis**: _pending_
**User Decision**: [ ] FIX [ ] SKIP [ ] DISCUSS

---

### FR-013: camera-manager.ts post-dispose HMR crash

| Field | Value |
|-------|-------|
| **File** | `src/camera/camera-manager.ts:991-996` |
| **Severity** | 🔴 CRITICAL |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Code |

**Finding**: Post-dispose HMR sync path dereferences _chaseCam after dispose() has nulled it.

**Status**: ✅ ALREADY FIXED by fix 5 (null check before defined()).

**Programmer Analysis**: _resolved_
**QA Analysis**: _resolved_
**Orchestrator Analysis**: _resolved_
**User Decision**: [x] FIX (done)

---

### FR-014: CarPhysicsState.gear type mismatch

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/types.ts:113-114` |
| **Severity** | 🔴 CRITICAL |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Code |

**Finding**: CarPhysicsState.gear typed as `number` while CarTelemetry.gear is `-1 | 0 | 1–6`.

**Status**: ✅ ALREADY FIXED by fix 3 (new `Gear` type alias).

**Programmer Analysis**: _resolved_
**QA Analysis**: _resolved_
**Orchestrator Analysis**: _resolved_
**User Decision**: [x] FIX (done)

---

## New Findings (QA-Discovered Gaps)

### FR-015: No test for braking at zero speed

| Field | Value |
|-------|-------|
| **File** | `tests/unit/physics-handling/engine-gears-drag-braking.test.ts` |
| **Severity** | 🔴 CRITICAL (test gap for FR-003) |
| **Reviewers** | QA Tester |
| **Category** | Test |

**Finding**: FR-003 identifies a critical bug where braking at speedMs=0 creates backward propulsion. The existing test `test_reverseBraking_deceleratesTowardZero` only tests speedMs=-5, NOT speedMs=0. No test covers the zero-speed braking edge case.

**Recommendation**: Add test: `speedMs=0, gear=-1, brake=1` → expect `newSpeed === 0` (no backward motion from rest).

**QA Analysis**: **Decision: FIX** — **Rationale**: This is a blocking test gap for FR-003. Without this test, the fix cannot be verified and the bug can regress silently.

---

### FR-016: No test for NaN/Infinity fuelMult and tireCondition

| Field | Value |
|-------|-------|
| **File** | `tests/unit/physics-handling/physics-service.test.ts` |
| **Severity** | 🟡 WARNING (test gap for FR-006) |
| **Reviewers** | QA Tester |
| **Category** | Test |

**Finding**: FR-006 identifies that `onFuelUpdate` and `onTireUpdate` don't guard against NaN/Infinity inputs. No test verifies that non-finite values are rejected with safe fallback.

**Recommendation**: Add tests for both methods with NaN, Infinity, -Infinity, and negative inputs. Verify stored value is the safe fallback (1 for fuelMult, 1 for tireCondition).

**QA Analysis**: **Decision: FIX** — **Rationale**: Defense-in-depth code without corresponding tests cannot be verified. NaN propagation into `computeTargetSpeed()` and `computeGripMax()` would cause silent physics corruption.

---

### FR-017: No test for removeCar with pending updates

| Field | Value |
|-------|-------|
| **File** | `tests/unit/physics-handling/physics-service.test.ts` |
| **Severity** | 🟡 WARNING (test gap for FR-007) |
| **Reviewers** | QA Tester |
| **Category** | Test |

**Finding**: FR-007 identifies that `removeCar()` doesn't clear `_pendingFuelUpdates` or `_pendingTireUpdates`. No test verifies that pending updates don't carry over to a re-registered car with the same ID.

**Recommendation**: Add test: register car → send pending update → removeCar → re-register same carId → verify pending update does NOT apply.

**QA Analysis**: **Decision: FIX** — **Rationale**: Low-probability but real race condition. Without this test, the fix cannot be verified.

---

### FR-018: No test for registerCar with carId/body in initialState

| Field | Value |
|-------|-------|
| **File** | `tests/unit/physics-handling/physics-service.test.ts` |
| **Severity** | 🟡 WARNING (test gap for FR-008) |
| **Reviewers** | QA Tester |
| **Category** | Test |

**Finding**: FR-008 identifies that `Object.assign(state, initialState)` can overwrite `carId` and `body`. The existing test at line 1222 uses `{ gear: 3, rpm: 5000, speedKmh: 100 }` which doesn't exercise this path. No test verifies that `carId` and `body` are preserved.

**Recommendation**: Add test: `registerCar("car_01", body, { carId: "hacked", body: null })` → verify `state.carId === "car_01"` and `state.body === body`.

**QA Analysis**: **Decision: FIX** — **Rationale**: Registry invariant violation is a high-severity correctness issue. Without this test, the fix cannot be verified.

---

### FR-019: No test for setSurfaceProvider swap without null intermediate

| Field | Value |
|-------|-------|
| **File** | `tests/unit/physics-handling/physics-service.test.ts` |
| **Severity** | 🟡 WARNING (test gap for FR-004) |
| **Reviewers** | QA Tester |
| **Category** | Test |

**Finding**: FR-004 identifies that `setSurfaceProvider()` doesn't clear `_surfaceStates` when swapping between two non-null providers. No test covers this scenario.

**Recommendation**: Add test: set provider A → let surface states accumulate → set provider B (not null) → verify `_surfaceStates` is cleared.

**QA Analysis**: **Decision: FIX** — **Rationale**: Stale surface state across provider swaps can cause incorrect kerb timer behavior. Without this test, the fix cannot be verified.

---

## Summary

### Original Findings (CodeRabbit)

| Severity | Count | IDs |
|----------|-------|-----|
| 🔴 CRITICAL | 3 | FR-003, FR-015 (new test gap), FR-013 ✅, FR-014 ✅ |
| 🟡 WARNING | 10 | FR-004, FR-005, FR-006, FR-007, FR-008, FR-012, FR-016, FR-017, FR-018, FR-019 |
| 🟢 MINOR | 4 | FR-001, FR-002, FR-009, FR-010, FR-011 |
| **Total** | **19** | **2 already fixed, 12 original active, 5 QA-discovered test gaps** |

### Final Decisions (Orchestrator + User)

| Decision | Count | IDs |
|----------|-------|-----|
| FIX | 14 | FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-012, FR-015, FR-016, FR-017, FR-018, FR-019 |
| SKIP | 3 | FR-001, FR-002, FR-011 |
| DISCUSS | 0 | — |

### Orchestrator Resolutions

| Finding | Programmer | QA | Orchestrator | Resolution |
|---------|-----------|-----|-------------|------------|
| FR-009 | SKIP | FIX | **FIX** | Comment says "negative or zero" but condition only checks `< 0`. Factually wrong. One-word fix. |
| FR-010 | SKIP | FIX | **FIX** | Test should use real `compareByCarId` to catch regressions if comparator changes. One-line fix. |

### Key Rationale

- **FR-003 (brake at rest)**: `brakeSign = speedMs >= 0 ? -1 : 1` → -1 at speedMs=0. Stationary car gets backward push. Critical.
- **FR-004 (surface state)**: Provider swap without null reuses stale kerb timers. Real bug.
- **FR-005 (tuple validation)**: Only gearRatios validated. Symmetric defense needed.
- **FR-006 (NaN)**: `Math.min(1, NaN)` → NaN. Defense-in-depth defeated.
- **FR-007 (pending leak)**: Stale updates replay on re-register. Race condition.
- **FR-008 (initialState)**: `Object.assign` can overwrite carId/body. Registry corruption.
- **FR-012 (YAML)**: Duplicate keys silently erase completion dates.
