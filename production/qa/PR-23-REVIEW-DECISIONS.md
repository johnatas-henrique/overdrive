# PR #23 Review — Physics/Handling Epic

**PR**: [#23 feat(physics): complete Physics/Handling epic](https://github.com/johnatas-henrique/overdrive/pull/23)
**Review Date**: 2026-06-30
**Reviewers**: CodeRabbit, Greptile, opencode-bot
**Total Findings**: 23 (deduplicated from ~30 original comments)

---

## Findings

### FR-001: Pit limiter acts as bidirectional cruise control

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/physics-service.ts:661-688` |
| **Severity** | 🔴 CRITICAL |
| **Reviewers** | CodeRabbit, Greptile (2 reviews) |
| **Category** | Code |

**Finding**: `applyPitLimiter` moves `currentSpeed` toward `pitSpeedLimit` from both directions. When `currentSpeed < pitSpeedLimit`, the function accelerates the car toward the limit — making it impossible to slow below the speed limit without `setLocked(true)`. A braking driver in the pit lane is pushed back up to the limit every tick.

**Recommendation**: Make pit limiter a strict ceiling — only reduce speed when above `pitSpeedLimit`, never increase when below.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified. `applyPitLimiter` computes `speedDiff = currentSpeed - pitSpeedLimit` then returns `currentSpeed - clampedDiff`. When `currentSpeed < pitSpeedLimit`, `speedDiff` is negative → `clampedDiff` is negative → `currentSpeed - clampedDiff = currentSpeed + |clampedDiff|`, accelerating the car toward the limit from below. A pit limiter is a speed CEILING (never accelerate above it). Should use `Math.min(targetSpeed, pitSpeedLimit)` for the ceiling, then apply the ramp only when decelerating.
**QA Analysis**: **Decision: FIX** — **Rationale**: Confirmed via source inspection. In `applyPitLimiter()` at line 675, `speedDiff = currentSpeed - pitSpeedLimit`. When a driver brakes in the pit lane (e.g., currentSpeed=10, pitSpeedLimit=12.5), `speedDiff = -2.5`, `Math.sign(speedDiff) = -1`, so `clampedDiff` is negative. Line 686 returns `currentSpeed - clampedDiff = currentSpeed + |clampedDiff|`, accelerating the car back up. This is a genuine behavior bug — the pit limiter should be a strict ceiling. The existing test in `lock-pit-events.test.ts` verifies the deceleration path (above limit) but does NOT test the below-limit path, so this bug was invisible to the test suite. **Test gap identified**: no test for pit limiter when currentSpeed < pitSpeedLimit.
**Orchestrator Analysis**: **Decision: FIX** — Both agents confirmed the bidirectional bug. The pit limiter is a ceiling, not a cruise control. The existing test only covers the above-limit path, so the bug was invisible. Fix is straightforward: `Math.min(currentSpeed, pitSpeedLimit)` with linear ramp only when decelerating from above.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-002: Brake force opposes forward motion only — reverse braking accelerates

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/arcade-grip-model.ts:701-724` |
| **Severity** | 🔴 CRITICAL |
| **Reviewers** | CodeRabbit, Greptile, opencode-bot (3 reviews) |
| **Category** | Code |

**Finding**: `computeBrakeForce` always returns a positive scalar applied as `-computeBrakeForce(...)`. In reverse gear (`speedMs < 0`), the brake term adds a second negative contribution, accelerating the car further into reverse instead of decelerating. Below the crossover speed (~7.07 m/s), `netForce` becomes negative in reverse.

**Recommendation**: Make braking direction-aware based on `speedMs` — use `brakeSign = speedMs >= 0 ? -1 : 1` so brake force always opposes motion.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified. In `computeTargetSpeed()`: braking path computes `netForce = -computeBrakeForce(inputs.brake, maxBrakeForce) + drag`. `computeBrakeForce` returns a positive scalar. When `speedMs < 0` (reverse gear), `computeDragForce` returns a positive value (opposing motion), but the brake term `-force` is negative. For a braking car in reverse, `netForce` is negative, which accelerates further into reverse (the `Math.max(minSpeed, ...)` clamp only prevents exceeding `-reverseMaxSpeed`). Brake should oppose motion: `brakeSign = speedMs >= 0 ? -1 : 1`.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified. `computeBrakeForce()` (line 490-492) returns `brakeInput * maxBrakeForce` (always positive). In `computeTargetSpeed()` braking path (line 707-709): `netForce = -computeBrakeForce(...) + drag`. When `speedMs < 0`, drag is positive (opposing reverse motion per `computeDragForce`), but the brake term is negative. Net: car decelerates from drag but accelerates from brake. Below crossover speed (~7.07 m/s), brake dominates — car accelerates into reverse when braking. The existing `engine-gears-drag-braking.test.ts` tests braking in forward only. **Test gap identified**: no test for braking in reverse gear. The existing reverse tests only verify coasting, not active braking.
**Orchestrator Analysis**: **Decision: FIX** — All 3 reviewers flagged this. Brake force must oppose motion direction. The fix is a one-line change: `brakeSign = speedMs >= 0 ? -1 : 1`. No design discussion needed.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-003: Missing CarPhysicsState fields in test factories

| Field | Value |
|-------|-------|
| **File** | `tests/integration/physics-handling/lock-pit-events.test.ts:159-192` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit, Greptile (2 reviews) |
| **Category** | Test |

**Finding**: `addCarState()` factory omits required `frictionMultiplier` and `minSurfaceSpeed` fields. Same issue in `createState()` helpers across `arcade-grip-model.test.ts`, `engine-gears-drag-braking.test.ts`, `physics-service.test.ts`, and `surface-handler.test.ts`.

**Recommendation**: Update all test fixture helpers to include the missing fields with sensible defaults.

**Programmer Analysis**: **Decision: DEFER TO QA** — **Rationale**: Verified that `addCarState()` in `lock-pit-events.test.ts` (line 159-192) is missing `frictionMultiplier` and `minSurfaceSpeed` from CarPhysicsState. The `createState()` in `arcade-grip-model.test.ts` is missing `frictionMultiplier`, `minSurfaceSpeed`, AND `topSpeedMs`. The `createState()` in `engine-gears-drag-braking.test.ts` is missing all three. The `createCarState()` in `surface-handler.test.ts` is missing `topSpeedMs` only. These are test fixtures — the final decision on whether incomplete fixtures cause problems should come from QA (do they cause false passes or missed coverage?).
**QA Analysis**: **Decision: FIX** — **Rationale**: Confirmed. `CarPhysicsState` interface requires `frictionMultiplier: number` and `minSurfaceSpeed: number` (lines 111, 122). The `addCarState()` helper in `lock-pit-events.test.ts` (line 166-191) omits both, as does `createState()` in `arcade-grip-model.test.ts` (line 105-128) and `engine-gears-drag-braking.test.ts` (line 121-146). Only `surface-handler.test.ts:createCarState()` includes them correctly. Tests pass because the code paths using these fields (surface handling, min speed enforcement) aren't exercised in most test suites. However, if any test ever touches those code paths, the undefined values would cause silent wrong behavior (e.g., `undefined * 6 = NaN` for friction). These fixtures should be complete to prevent false passes.
**Orchestrator Analysis**: **Decision: FIX** — QA confirmed the fixtures are incomplete. Tests pass today because the code paths aren't exercised, but this is a false safety net. Fix all fixtures to match current types.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-004: autoShiftRpmThreshold unit mismatch

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/arcade-grip-model.ts:121-124` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Code |

**Finding**: `autoShiftRpmThreshold` is passed through as an absolute RPM even though `autoShift()` interprets it as a fraction of `rpmMax`. The upshift threshold is effectively wrong and auto-shifting never triggers correctly.

**Recommendation**: Unify the unit — either convert config value to fraction before calling `autoShift()`, or change `autoShift()` to accept absolute RPM.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified. `autoShift()` interprets `threshold` as a fraction of `rpmMax` (line 580: `upshiftThreshold = rpmMax * threshold`). But `PhysicsConfig.autoShiftRpmThreshold` stores an absolute RPM value (test configs use 8000 with `rpmMax=10000`). At runtime, `upshiftThreshold = 10000 * 8000 = 80M RPM` — effectively never reached, so auto-upshift never triggers. The `DEFAULT_ENGINE_CONFIG` in `engine-gears-drag-braking.test.ts` correctly uses `0.8` (fraction), but the `createTestConfig()` in the same file uses `8000` (absolute). Unify: change `autoShiftRpmThreshold` to store a fraction (0..1) and update callers, OR change `autoShift()` to accept absolute RPM.
**QA Analysis**: **Decision: FIX** — **Rationale**: Confirmed. `autoShift()` (line 568-590) expects `threshold` as a fraction of `rpmMax` (line 580: `upshiftThreshold = rpmMax * threshold`). But `PhysicsConfig.autoShiftRpmThreshold` stores an absolute RPM. Test configs use `8000` with `rpmMax=10000`, making upshift threshold `80M RPM` — never reached. The isolated `DEFAULT_ENGINE_CONFIG` in `engine-gears-drag-braking.test.ts` (line 41) correctly uses `0.8` (fraction), which is why the pure-math tests pass. But the integration test configs (`physics-service.test.ts:TEST_CONFIG`, `arcade-grip-model.test.ts:createTestConfig`) use `8000`, meaning any integration test that relies on auto-shift would silently fail to shift. **Test gap identified**: no integration test actually asserts auto-shift triggers.
**Orchestrator Analysis**: **Decision: FIX** — Both agents confirmed. The unit mismatch means auto-upshift never triggers in integration tests. Unify to fraction (0..1) since that's what `autoShift()` expects.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-005: Hardcoded cornering/acceleration instead of PhysicsConfig

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/arcade-grip-model.ts:68` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Code |

**Finding**: `computeCornerStat()`, `ACCEL_MAP`, and `corneringLevel` default hardcode tuning values instead of reading from `PhysicsConfig.corneringL1toL5` and `PhysicsConfig.accelerationL1toL5`.

**Recommendation**: Update to read from PhysicsConfig so external tuning actually affects gameplay.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified. `computeCornerStat()` uses hardcoded formula `0.6 + (level - 1) * 0.1` (line 201). `ACCEL_MAP` is a hardcoded array `[1.0, 1.08, 1.16, 1.22, 1.3]` (line 68). `corneringLevel` in `compute()` defaults to `1` (line 760). Meanwhile, `PhysicsConfig.corneringL1toL5` and `PhysicsConfig.accelerationL1toL5` exist (lines 134-136) but are referenced NOWHERE in source code (confirmed via grep). Either wire up the config values into the model, or remove the dead config fields.
**QA Analysis**: **Decision: FIX** — **Rationale**: Confirmed. `computeCornerStat()` (line 198-201) hardcodes `0.6 + (level-1)*0.1`, producing `[0.6, 0.7, 0.8, 0.9, 1.0]`. `ACCEL_MAP` (line 68) is hardcoded `[1.0, 1.08, 1.16, 1.22, 1.3]`. Meanwhile, `PhysicsConfig` defines `corneringL1toL5` (line 136) and `accelerationL1toL5` (line 134) — but `compute()` uses hardcoded defaults (line 760: `corneringLevel: 1`) and never reads these config fields. The config fields are dead data. This violates the project rule "gameplay values must be data-driven (external config), never hardcoded" from AGENTS.md. **Test gap**: no test verifies that config-level tuning values flow through to gameplay output.
**Orchestrator Analysis**: **Decision: FIX** — Both agents confirmed. Config fields `corneringL1toL5` and `accelerationL1toL5` exist but are dead — never read by the model. This violates the project rule "gameplay values must be data-driven." Wire them up or remove the dead config fields.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-006: IPhysics example missing setSurfaceProvider

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/i-physics.ts:56-61` |
| **Severity** | 🟢 MINOR |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Documentation |

**Finding**: Public example in IPhysics docs shows a PhysicsService setup that omits the required `setSurfaceProvider()` step before the first update.

**Recommendation**: Update example to include `setSurfaceProvider()` or simplify to IPhysics-level demo only.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified. The `IPhysics` interface example on lines 56-61 shows: `new PhysicsService(scene, trackSystem)`, `await physics.init(config)`, `pipeline.register(...)`. This omits `setSurfaceProvider()`. At runtime, the first `update()` call will throw "Surface provider not set. Call setSurfaceProvider() before the first update tick." (line 288-290). Add `setSurfaceProvider()` to the example.
**QA Analysis**: **Decision: SKIP** — **Rationale**: Verified. The IPhysics JSDoc example (line 57-61) shows `new PhysicsService(scene, trackSystem)` → `await physics.init(config)` → `pipeline.register(...)`, omitting `setSurfaceProvider()`. At runtime, the first `update()` throws (line 288-290). However, this is a minimal interface-level example — developers using PhysicsService would reference its own class docs, not IPhysics. The impact is low; new contributors might be confused but the runtime error message is clear and actionable. Not worth a code change for a JSDoc snippet.
**Orchestrator Analysis**: **Decision: SKIP** — Programmer says FIX, QA says SKIP. I agree with QA: this is a JSDoc snippet, not production code. The runtime error message is clear and actionable. Low value fix. Skip.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-007: PhysicsConfig type too loose

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/physics-config.ts:98-105` |
| **Severity** | 🟢 MINOR |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Code |

**Finding**: `gearRatios` is typed as `number[]` instead of a tuple of exactly 6. `accelLevel` is `number` instead of `1 | 2 | 3 | 4 | 5`. Malformed tuning data is not rejected at compile time.

**Recommendation**: Tighten types — `gearRatios: [number, number, number, number, number, number]` and `accelLevel: 1 | 2 | 3 | 4 | 5`.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified. `gearRatios: number[]` (line 103) should be `[number, number, number, number, number, number]` — the code always expects exactly 6 gears (GEAR_COUNT = 6). `accelLevel: number` (line 105) should be `1 | 2 | 3 | 4 | 5` — only 5 valid levels exist. These tighter types would catch malformed tuning data at compile time. Not a runtime bug with valid configs.
**QA Analysis**: **Decision: DISCUSS** — **Rationale**: Verified. `gearRatios: number[]` should be a 6-tuple, and `accelLevel: number` should be `1|2|3|4|5`. This is a type safety improvement, not a runtime bug. The question is whether the benefit justifies the churn: every call site passing `gearRatios` would need to cast or assert, and `accelLevel` is already clamped in `computeTorque()` (line 457: `Math.max(1, Math.min(5, Math.round(accelLevel)))`). Recommend deferring to a dedicated type-safety sprint rather than bundling with bug fixes. The runtime guard already handles invalid values.
**Orchestrator Analysis**: **Decision: FIX** — Programmer says FIX, QA says DISCUSS. Type tightening is good practice but QA is right that it creates churn at every call site. The runtime guard already handles invalid values. Defer to a type-safety sprint.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

**Final Note**: Impact measured — 6 lines of type definitions + 2 `as` casts in clamping tests. All call sites already use correct values (6-element gearRatios arrays, accelLevel=1). Low churn, high value.

---

### FR-008: getTelemetry reverse gear type cast

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/physics-service.ts:794-798` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit, opencode-bot (2 reviews) |
| **Category** | Code |

**Finding**: `state.gear as 0 | 1 | 2 | 3 | 4 | 5 | 6` lies to the type system. `applyGearDelta()` returns -1 for reverse, but `CarTelemetry.gear` excludes -1. Downstream consumers get -1 despite the type contract.

**Recommendation**: Either add -1 to the telemetry type, or normalize reverse gear to 0 in telemetry output.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified. `state.gear` can be `-1` (reverse) after `applyGearDelta()` → `computeTargetSpeed()`. The telemetry rebuild (line 797) casts `state.gear as 0 | 1 | 2 | 3 | 4 | 5 | 6`, which lies to the type system. `CarTelemetry.gear` type excludes `-1`. At runtime, `-1` flows through the cast unchecked. Two options: (1) add `-1` to `CarTelemetry.gear`, or (2) normalize reverse gear to `0` in telemetry output so consumers see `0` for both neutral and reverse.
**QA Analysis**: **Decision: FIX** — **Rationale**: Confirmed. `state.gear` can be `-1` after `applyGearDelta()` (reverse gear). Line 797 casts `state.gear as 0 | 1 | 2 | 3 | 4 | 5 | 6`, which is an unchecked type assertion. `CarTelemetry.gear` excludes `-1`, so downstream consumers receive `-1` at runtime despite the type contract. This is a type-safety violation that could cause subtle bugs in HUD display or replay systems. The fix is straightforward: either add `-1` to the union type, or normalize to `0` in telemetry output. Both options are safe; the team should decide which convention to adopt.
**Orchestrator Analysis**: **Decision: FIX** — Both agents confirmed. The type cast lies to the system. Add -1 to CarTelemetry.gear or normalize reverse to 0. I prefer adding -1 since it's the truthful representation.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-009: Stale regression-suite.md counts

| Field | Value |
|-------|-------|
| **File** | `tests/regression-suite.md:3-6` |
| **Severity** | 🟢 MINOR |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Documentation |

**Finding**: Header totals (39 tests, 3918 assertions) don't match actual table contents after recent changes.

**Recommendation**: Recompute and update the counts.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified. Header says 3918 assertions, but summing the table yields ~3915 (3 off). The test file count (39) matches the table rows. Minor discrepancy — suggests a recent addition/modification changed assertion counts without updating the header. Recompute and sync.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified. Header says 3918 assertions but my count of `expect`/`assert` calls across all 39 test files yields 4108. The physics-handling tests alone contribute 483 assertions (93+113+93+89+95). The header was likely accurate at an earlier point but hasn't been updated after physics tests were finalized. The file count (39) is correct. This is stale documentation that should be regenerated.
**Orchestrator Analysis**: **Decision: FIX** — Both confirmed. Stale docs. Quick fix.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-010: Test fixtures out of sync with updated types

| Field | Value |
|-------|-------|
| **File** | `tests/unit/physics-handling/*.test.ts` (4 files) |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Test |

**Finding**: `createTestConfig()` and `createState()` helpers in `arcade-grip-model.test.ts`, `engine-gears-drag-braking.test.ts`, `physics-service.test.ts`, and `surface-handler.test.ts` are missing `pitSpeedTransitionTime`, `frictionMultiplier`, `minSurfaceSpeed`, and `topSpeedMs` fields.

**Recommendation**: Update all fixture helpers to match current types.

**Programmer Analysis**: **Decision: DEFER TO QA** — **Rationale**: Verified aggregate claim — across 4 test files, config helpers miss `pitSpeedTransitionTime` (3/4 files), and state helpers miss `frictionMultiplier`, `minSurfaceSpeed`, and `topSpeedMs` (varying by file). Specific breakdown: `physics-service.test.ts:TEST_CONFIG` has `pitSpeedTransitionTime` ✓ (line 54), but `arcade-grip-model.test.ts:createTestConfig`, `engine-gears-drag-braking.test.ts:createTestConfig`, and `surface-handler.test.ts:createTestConfig` all lack it. State helpers: `lock-pit-events.test.ts:addCarState` lacks `frictionMultiplier`/`minSurfaceSpeed`; `arcade-grip-model.test.ts:createState` lacks `frictionMultiplier`/`minSurfaceSpeed`/`topSpeedMs`; `engine-gears-drag-braking.test.ts:createState` lacks all three; `surface-handler.test.ts:createCarState` lacks `topSpeedMs`. Whether these cause test issues depends on which fields each test exercises — QA should determine.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified per-file breakdown. `pitSpeedTransitionTime` is present in `physics-service.test.ts:TEST_CONFIG` (line 54) and `lock-pit-events.test.ts` (line 58), but MISSING from `arcade-grip-model.test.ts:createTestConfig`, `engine-gears-drag-braking.test.ts:createTestConfig`, and `surface-handler.test.ts:createTestConfig`. For state helpers: `frictionMultiplier` and `minSurfaceSpeed` are missing from `lock-pit-events.test.ts:addCarState`, `arcade-grip-model.test.ts:createState`, and `engine-gears-drag-braking.test.ts:createState`. `topSpeedMs` is missing from `arcade-grip-model.test.ts:createState` and `engine-gears-drag-braking.test.ts:createState`. Only `surface-handler.test.ts:createCarState` has all fields. All tests pass today because the code paths that read these fields aren't exercised, but this is a false-safety net. Fixing fixtures prevents future silent failures when new tests touch those code paths.
**Orchestrator Analysis**: **Decision: FIX** — QA confirmed all 4 files need updating. Same issue as FR-003. Fix together.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-011: Missing test coverage for zero-dt and clamping

| Field | Value |
|-------|-------|
| **File** | `tests/unit/physics-handling/physics-service.test.ts` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Test |

**Finding**: Zero-dt test only asserts `not.toThrow()` — misses Infinity/NaN velocities. Also missing tests for out-of-range fuel/tire input clamping and green-flag pending map reset.

**Recommendation**: Add finite velocity assertion, clamping boundary tests, and green-flag reset tests.

**Programmer Analysis**: **Decision: DEFER TO QA** — **Rationale**: Verified the zero-dt test exists (line 1103-1105: `expect(() => physics.update(0)).not.toThrow()`). The finding is correct that it only asserts no-throw — it doesn't assert finite velocities. After `update(0)`, `(speedMs - oldSpeedMs) / 0` in `_computeTelemetry` produces Infinity/NaN for `accelG`. The Y-correction `(splineY - worldPosY) / dt` also produces Infinity/NaN. The fuel/tire clamping input guards exist (lines 566, 579: `Math.max(0, Math.min(1, ...))`), and `onRaceGreenFlag` resets guards (line 544-555). QA should decide priority for adding finite-velocity assertions and clamping boundary tests.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified. The zero-dt test (physics-service.test.ts) only asserts `not.toThrow()`. With dt=0, `_computeTelemetry()` computes `(speedMs - oldSpeedMs) / 0` → Infinity/NaN for `accelG` (line 919). The Y-correction `(splineY - worldPosY) / dt` also produces Infinity. These values flow into telemetry and would corrupt any downstream consumer. A finite-velocity assertion (`expect(state.accelG).not.toBeNaN(); expect(state.accelG).not.toBe(Infinity)`) is the minimum acceptable test. The clamping boundary tests (fuel/tire out-of-range inputs) are lower priority since the guards exist and are simple (`Math.max(0, Math.min(1, x))`), but should be added for completeness.
**Orchestrator Analysis**: **Decision: FIX** — QA confirmed the zero-dt test is insufficient. Add finite velocity assertion. Clamping tests are lower priority but should be added.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-012: Story evidence status inconsistent

| Field | Value |
|-------|-------|
| **File** | `production/epics/*/story-*.md` (3 files) |
| **Severity** | 🟢 MINOR |
| **Reviewers** | CodeRabbit (1 review) |
| **Category** | Documentation |

**Finding**: Test evidence checkboxes still marked "Not yet created" in story-004-config-tree.md, story-001-physics-core-skeleton.md, story-005-lock-pit-external-inputs-events.md, and story-006-telemetry-noop-behavior.md despite stories being Complete.

**Recommendation**: Update evidence checkboxes to match completed state.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified. 4 story files have stale "Not yet created" evidence status while their Completion Notes show tests exist. `story-001-physics-core-skeleton.md` line 286 shows `[ ] Not yet created` but Completion Notes (line 302) reference `tests/unit/physics-handling/physics-core-skeleton.test.ts` (43 tests). Same pattern in `story-005-lock-pit-external-inputs-events.md` (line 273 status, line 292 evidence with 43 tests) and `story-006-telemetry-noop-behavior.md` (line 122 status, line 136 evidence with 10 tests). `story-004-config-tree.md` (line 131 status, line 148 evidence with 28 tests) has the same issue. The evidence exists — the checkbox just wasn't marked. Update all 4 files.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified. `story-001-physics-core-skeleton.md` (line 286) shows `[ ] Not yet created` but Completion Notes (line 302) reference `physics-core-skeleton.test.ts` (43 tests). `story-005-lock-pit-external-inputs-events.md` (line 273) same pattern — `[ ] Not yet created` but evidence at line 292 references `lock-pit-events.test.ts` (43 tests). `story-004-surface-handling-offtrack-kerbs.md` (line 226) same — `[ ] Not yet created` but evidence at line 240 references `surface-handling.test.ts` (49 tests). All test files exist and pass (verified via `npx vitest run`). The checkboxes are simply stale. Low effort to fix, improves documentation accuracy.
**Orchestrator Analysis**: **Decision: FIX** — Both confirmed. Stale checkboxes in 4 story files. Quick documentation fix.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-013: computeSpeedMod returns NaN on 0/0

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/arcade-grip-model.ts:215-219` |
| **Severity** | 🔴 CRITICAL |
| **Reviewers** | Greptile (1 review) |
| **Category** | Code |

**Finding**: `speedKmh / config.speedModRefSpeedKmh` evaluates to `0/0 = NaN` when both are zero. `Math.min(1, NaN)` and `Math.max(0, NaN)` both return NaN, corrupting `gripMax` and all downstream telemetry.

**Recommendation**: Add guard: `if (speedModRefSpeedKmh === 0) return 1`.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified. In `computeSpeedMod()` (line 216): `speedKmh / config.speedModRefSpeedKmh`. When both are 0, evaluates to `0/0 = NaN`. `Math.min(1, NaN)` → `NaN`, `Math.max(0, NaN)` → `NaN`, so the function returns `NaN`. This propagates through `computeGripMax()` → `gripMax` → `computeYawRate()` → `targetYawRate` → Phase 3 velocity override → all telemetry corrupt. Add guard: `if (config.speedModRefSpeedKmh === 0) return 1`.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified. `computeSpeedMod()` (line 215-218) computes `t = Math.max(0, Math.min(1, speedKmh / config.speedModRefSpeedKmh))`. When `speedModRefSpeedKmh = 0`, `0/0 = NaN`, and `Math.min(1, NaN) = NaN`. This propagates to `gripMax` and corrupts all lateral/longitudinal physics. The guard `if (speedModRefSpeedKmh === 0) return 1` is correct — a zero reference speed means "speed modulation disabled", so returning the neutral factor (1.0) is the right behavior. No existing test covers the zero-config edge case. **Test gap identified**: no test for `computeSpeedMod` with `speedModRefSpeedKmh = 0`.
**Orchestrator Analysis**: **Decision: FIX** — Both confirmed. NaN corruption is a real bug. One-line guard fixes it.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-014: Unused targetSpeed parameter in pit limiter

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/physics-service.ts:661-670` |
| **Severity** | 🟢 MINOR |
| **Reviewers** | Greptile (1 review) |
| **Category** | Code |

**Finding**: `targetSpeed` parameter is unused when `isPitMode` is true. The function computes a value entirely from `currentSpeed`, making the parameter misleading.

**Recommendation**: Remove the parameter or restructure the function signature.

**Programmer Analysis**: **Decision: SKIP** — **Rationale**: `targetSpeed` is the FIRST parameter of `applyPitLimiter()` and serves as the fallback return value when `!isPitMode` (line 671: `return targetSpeed`). The parameter's purpose is to provide the non-pit-mode return value, not to be consumed within the pit-mode branch. This is a standard pattern: the function either returns the pit-limited speed (pit mode active) or the original target (pit mode off). Renaming to `fallbackSpeed` would clarify intent but the current design is not misleading.
**QA Analysis**: **Decision: SKIP** — **Rationale**: Verified. `targetSpeed` parameter (line 662) is passed to `applyPitLimiter` but the function returns a value computed entirely from `currentSpeed` (line 686-687). The parameter is dead code when `isPitMode` is true. However, this is a minor code cleanliness issue — it doesn't cause incorrect behavior. The function signature is private (line 661), so it only affects internal code. Low priority; skip for this PR.
**Orchestrator Analysis**: **Decision: SKIP** — Both agreed. Minor code cleanliness, not a bug. The parameter serves as fallback return value when pit mode is off. Skip.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-015: Missing public car registration API

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/i-physics.ts:63`, `src/physics-handling/physics-service.ts:56-65` |
| **Severity** | 🔴 CRITICAL |
| **Reviewers** | opencode-bot (1 review) |
| **Category** | Code |

**Finding**: `_carStates` is private but `IPhysics` exposes no `registerCar()` or `removeCar()` method. Tests use `(physics as any)._carStates` to inject states. The service is unusable outside unit tests.

**Recommendation**: Add `registerCar()` and `removeCar()` to `IPhysics` and implement in `PhysicsService`, including cleanup of `_surfaceStates`, `_inputStates`, `_telemetry`, `_pitCars`, and `_lockedCars`.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified. `IPhysics` interface (i-physics.ts:63-160) has no `registerCar()` or `removeCar()` method. `PhysicsService._carStates` is private. All tests access it via `(physics as any)._carStates`. No other system can register a car with the physics service — making it unusable outside unit tests. Must add `registerCar(carId: string, body: PhysicsBody, initialState?: Partial<CarPhysicsState>): void` and `removeCar(carId: string): void` to both `IPhysics` and `PhysicsService`. `removeCar()` must also clean up `_surfaceStates`, `_inputStates`, `_telemetry`, `_pitCars`, and `_lockedCars`.
**QA Analysis**: **Decision: FIX** — **Rationale**: Confirmed. `_carStates` (line 65) is private with no public accessor. Tests inject car states via `(physics as any)._carStates` (e.g., `lock-pit-events.test.ts:165`, `physics-service.test.ts:170`). Without `registerCar()`/`removeCar()`, no integration test or production code can add cars to the service. This is a genuine API gap — the service is incomplete without a public registration mechanism. The `IPhysics` interface (line 63) should expose these methods. This is a BLOCKING issue for any integration beyond unit tests.
**Orchestrator Analysis**: **Decision: FIX** — Both confirmed. The service is unusable without public registration. This is a BLOCKING API gap. Must add `registerCar()` and `removeCar()` to IPhysics.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-016: Havok double-step risk

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/physics-service.ts:205-209` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | opencode-bot (1 review) |
| **Category** | Code |

**Finding**: `scene.render()` may call `_physicsEngine._step()` directly, bypassing the suppressed `_advancePhysicsEngineStep`. Havok could execute physics twice per frame.

**Recommendation**: Verify in a runtime test that `scene.render()` does NOT double-step. If it does, replace suppression with flag-based guard.

**Programmer Analysis**: **Decision: DISCUSS** — **Rationale**: Cannot verify statically whether `scene.render()` calls `_physicsEngine._step()` directly (bypassing the suppressed `_advancePhysicsEngineStep`). The suppression at line 205-209 sets `_advancePhysicsEngineStep` to no-op, which is the documented Babylon.js pattern. But if `render()` calls the Havok step through another code path, double-stepping occurs. Needs runtime verification with actual Babylon.js 9.12.0 internals — add a counter in `executeStep` and verify only 1 call per frame. If confirmed, replace suppression with a flag-based guard as recommended.
**QA Analysis**: **Decision: DISCUSS** — **Rationale**: The suppression at line 205-209 replaces `_advancePhysicsEngineStep` with a no-op. The concern is whether `scene.render()` has an alternate path to `_step()`. This is a Havok/Babylon.js internal implementation detail that can't be verified without a real runtime test (the mock `HavokPlugin` in tests doesn't simulate this). The suppression pattern is documented in ADR-0002 and used in Babylon.js examples, but a runtime test with actual Havok WASM would be the definitive verification. Recommend creating a runtime test as a follow-up, but this should not block the PR.
**Orchestrator Analysis**: **Decision: SKIP** — Both agreed this needs runtime verification. Cannot confirm statically. Should create a runtime test as follow-up but not block the PR.
**User Decision**: [ ] FIX [X] SKIP [ ] DISCUSS

**Final Note**: ADR-0002 (lines 124-142) documents the suppression pattern, the trade-off, and why it's the only option in Babylon.js 9.12. If double-stepping is ever observed during playtesting, ADR-0002 is the reference for diagnosis. No additional documentation needed.

---

### FR-017: Hardcoded 200 in rotation boost

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/arcade-grip-model.ts:367` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | opencode-bot (1 review) |
| **Category** | Code |

**Finding**: `speedKmh / 200` uses a hardcoded constant. ADR-0008 mentions `liftOffRearFactor` as a config knob, but it doesn't exist in PhysicsConfig.

**Recommendation**: Add `liftOffRefSpeedKmh` to PhysicsConfig and inject as parameter.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified. `speedKmh / 200` on line 367 is a hardcoded magic number. `300 km/h / 200 = 1.5 → clamped to 1.0` — effectively `Math.min(speedKmh / 200, 1.0)`. ADR-0008 mentions `liftOffRearFactor` but PhysicsConfig has no such field. Should add `liftOffRefSpeedKmh` to PhysicsConfig and inject it as a parameter to `rotationBoost()`, replacing `200`.
**QA Analysis**: **Decision: SKIP** — **Rationale**: Verified. `rotationBoost()` (line 367) uses `speedKmh / 200`. The hardcoded 200 is a reference speed in km/h. ADR-0008 mentions `liftOffRearFactor` but it's not in PhysicsConfig. However, this is a tuning constant — changing it requires design sign-off, not a code fix. The current value (200 km/h) is reasonable for a racing game (boost saturates at 200+ km/h). Adding a config knob is a nice-to-have but not a bug. Skip for this PR; track as tech-debt.
**Orchestrator Analysis**: **Decision: SKIP** — Programmer says FIX, QA says SKIP. I agree with QA: this is a tuning constant, not a bug. The current value is reasonable. Track as tech-debt if desired, but not for this PR.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-018: _surfaceStates never cleaned up on car removal

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/physics-service.ts:83` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | opencode-bot (1 review) |
| **Category** | Code |

**Finding**: No `removeCar()` method means `_surfaceStates` entries accumulate indefinitely.

**Recommendation**: When `removeCar()` is added (FR-015), ensure it also deletes from `_surfaceStates`.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified as dependency of FR-015. When `removeCar()` is implemented, it must delete from `_surfaceStates` as well as `_inputStates`, `_telemetry`, `_pitCars`, and `_lockedCars`. Currently `_surfaceStates` only grows (entries are created lazily in `update()` and never removed). Include in FR-015 changeset.
**QA Analysis**: **Decision: FIX** — **Rationale**: Directly coupled to FR-015. `_surfaceStates` (line 83) is populated lazily per car but never cleaned. Without `removeCar()`, entries accumulate. If `removeCar()` is added per FR-015, it must also clean `_surfaceStates`. This finding is dependent on FR-015 — fix together.
**Orchestrator Analysis**: **Decision: FIX** — Both confirmed. Dependent on FR-015. When `removeCar()` is added, clean up all maps.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-019: gearRatios silent fallback masks config errors

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/arcade-grip-model.ts:430` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | opencode-bot (1 review) |
| **Category** | Code |

**Finding**: `gearRatios[idx] ?? 1` silently produces wrong ratio if array has fewer than 6 elements.

**Recommendation**: Validate `gearRatios.length >= 6` at config load time.

**Programmer Analysis**: **Decision: DISCUSS** — **Rationale**: `new HavokPlugin(true, havokInstance)` passes `true` for `enableMomentumDamping`. In a standard physics simulation this prevents velocity buildup. But the Arcade Dynamic model overrides body velocity every tick in Phase 3 (`body.setLinearVelocity(this._scratchVel)`). Since the override happens every tick, momentum damping has no time to accumulate between ticks — Phase 3 effectively resets it each frame. Low risk of visible issues. Could change to `false` for clarity but the current behavior is harmless. Test to confirm.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified. `gearRatios[idx] ?? 1` (line 430) returns 1 for out-of-bounds indices. If a config provides fewer than 6 gear ratios, the car silently gets ratio=1 for missing gears — producing wrong RPM calculations and wrong acceleration feel. This masks a config error. Adding a length validation at config load time (`assert(gearRatios.length >= 6)`) or at init would catch this. The `computeTorque()` function already clamps `accelLevel` (line 457), so similar defensive validation for `gearRatios` is consistent with the codebase pattern.
**Orchestrator Analysis**: **Decision: FIX** — QA confirmed. Silent fallback masks config errors. Add validation at config load time. Consistent with existing `accelLevel` clamping pattern.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-020: HavokPlugin momentum damping may fight velocity override

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/physics-service.ts:195` |
| **Severity** | 🟢 MINOR |
| **Reviewers** | opencode-bot (1 review) |
| **Category** | Code |

**Finding**: `new HavokPlugin(true, havokInstance)` enables momentum damping which may subtly alter collision resolution before the velocity override.

**Recommendation**: Set to `false` since arcade model handles all velocity.

**Programmer Analysis**: **Decision: DISCUSS** — **Rationale**: `new HavokPlugin(true, havokInstance)` passes `true` for `enableMomentumDamping`. In a standard physics simulation this prevents velocity buildup. But the Arcade Dynamic model overrides body velocity every tick in Phase 3 (`body.setLinearVelocity(this._scratchVel)`). Since the override happens every tick, momentum damping has no time to accumulate between ticks — Phase 3 effectively resets it each frame. Low risk of visible issues. Could change to `false` for clarity but the current behavior is harmless. Test to confirm.
**QA Analysis**: **Decision: SKIP** — **Rationale**: Verified. `new HavokPlugin(true, havokInstance)` (line 195) enables momentum damping. However, Phase 3 of the pipeline calls `setLinearVelocity()` every tick, fully overriding Havok's velocity integration. The arcade model owns velocity completely — momentum damping only affects collision resolution within a single Havok step, and its effect is immediately overwritten by the velocity override. In practice, the damping is cosmetic at best and irrelevant at worst. Not worth changing.
**Orchestrator Analysis**: **Decision: SKIP** — Programmer says DISCUSS, QA says SKIP. Phase 3 velocity override resets every tick, so momentum damping is harmless. Skip.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

**Final Note**: One-character change (`true` → `false`). Semantically correct — arcade model owns all velocity. Reversible in the future if collision realism needs momentum damping.

---

### FR-021: Duplicate comment block

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/physics-service.ts:382-386` |
| **Severity** | 🟢 MINOR |
| **Reviewers** | opencode-bot (1 review) |
| **Category** | Code |

**Finding**: "Active bodies are rebuilt each tick... Contact callbacks fire during this call." appears twice verbatim.

**Recommendation**: Remove duplicate comment.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified. Lines 382-384 and 384-386 are identical comment blocks: "Active bodies are rebuilt each tick... Contact callbacks fire during this call." appears twice verbatim at lines 381-385. Remove the duplicate (lines 384-385).
**QA Analysis**: **Decision: SKIP** — **Rationale**: Verified. Lines 382-385 contain a duplicate comment block ("Active bodies are rebuilt each tick... Contact callbacks fire during this call."). Pure cosmetic — no functional impact. Low priority, skip for this PR.
**Orchestrator Analysis**: **Decision: SKIP** — Programmer says FIX, QA says SKIP. Pure cosmetic. Skip for this PR.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-022: accelG division by zero if dt = 0

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/arcade-grip-model.ts:919` |
| **Severity** | 🟡 WARNING |
| **Reviewers** | opencode-bot (1 review) |
| **Category** | Code |

**Finding**: `(speedMs - oldSpeedMs) / dt` produces NaN for accelG if dt is 0.

**Recommendation**: Add guard: `dt > 0 ? (speedMs - oldSpeedMs) / dt : 0`.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified. `_computeTelemetry()` line 919: `const accelMs2 = (speedMs - oldSpeedMs) / dt`. When `dt = 0`, this produces `Infinity` or `NaN` (depending on whether `speedMs === oldSpeedMs`). Then `accelG = accelMs2 / 9.81` propagates the invalid value into telemetry. Add guard: `dt > 0 ? (speedMs - oldSpeedMs) / dt : 0`.
**QA Analysis**: **Decision: FIX** — **Rationale**: Verified. Line 919: `const accelMs2 = (speedMs - oldSpeedMs) / dt`. When dt=0, this produces Infinity/NaN for `accelG` (line 920). The existing zero-dt test (physics-service.test.ts) asserts `not.toThrow()` but doesn't check for NaN/Infinity. This is related to FR-011 — both need the same fix: `dt > 0 ? (speedMs - oldSpeedMs) / dt : 0`. The guard prevents telemetry corruption.
**Orchestrator Analysis**: **Decision: FIX** — Both confirmed. One-line guard prevents NaN in telemetry.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

### FR-023: _surfaceProvider null-check placement

| Field | Value |
|-------|-------|
| **File** | `src/physics-handling/physics-service.ts:288-291` |
| **Severity** | 🟢 MINOR |
| **Reviewers** | opencode-bot (1 review) |
| **Category** | Code |

**Finding**: Null check throws inside the car iteration loop — first car triggers uncatchable error mid-tick.

**Recommendation**: Move null-check to top of `update()`, before any car iteration.

**Programmer Analysis**: **Decision: FIX** — **Rationale**: Verified. The null check `if (!this._surfaceProvider) { throw new Error(...) }` is inside the car iteration loop (line 287-291). If multiple cars exist, the first one triggers an error mid-tick, leaving subsequent cars unprocessed. Move the check to the top of `update()` after the `_initialized`/`_disposed` guard for fail-fast behavior.
**QA Analysis**: **Decision: DISCUSS** — **Rationale**: Verified. The null-check (line 287-291) throws inside the car iteration loop. It throws on the first car, so the error message is clear. Moving it to the top of `update()` would be cleaner — it fails fast before any work and the error is more predictable. However, the current placement doesn't cause incorrect behavior — it's a code organization issue, not a bug. Recommend the move as a code quality improvement, but it's not blocking.
**Orchestrator Analysis**: **Decision: FIX** — Programmer and QA both say DISCUSS, but I disagree. Moving the null-check to the top of `update()` is a one-line change that improves fail-fast behavior. It's a code quality improvement with zero risk. Fix it.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

## Summary

| Severity | Count | IDs |
|----------|-------|-----|
| 🔴 CRITICAL | 4 | FR-001, FR-002, FR-013, FR-015 |
| 🟡 WARNING | 11 | FR-003, FR-004, FR-005, FR-008, FR-010, FR-011, FR-016, FR-017, FR-018, FR-019, FR-022 |
| 🟢 MINOR | 8 | FR-006, FR-007, FR-009, FR-012, FR-014, FR-020, FR-021, FR-023 |
| **Total** | **23** | |

### Decision Summary (Orchestrator + User aligned)

| Decision | Count | IDs |
|----------|-------|-----|
| **FIX** | 26 | FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-017, FR-018, FR-019, FR-020, FR-021, FR-022, FR-023 + FR-024 a FR-027 |
| **SKIP** | 1 | FR-016 |
| **Total** | **27** | |

### QA Decision Summary

| Decision | Count | IDs |
|----------|-------|-----|
| **FIX** | 15 | FR-001, FR-002, FR-003, FR-004, FR-005, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-015, FR-018, FR-019, FR-022 |
| **SKIP** | 5 | FR-006, FR-014, FR-017, FR-020, FR-021 |
| **DISCUSS** | 3 | FR-007, FR-016, FR-023 |

### New Findings (QA-Discovered)

#### FR-024: No test for pit limiter below-limit path

| Field | Value |
|-------|-------|
| **Category** | Test |
| **Severity** | 🟡 WARNING |
| **Source** | QA analysis of FR-001 |

**Finding**: The `lock-pit-events.test.ts` tests verify pit limiter deceleration (above limit → limit) but never test the below-limit path. The bidirectional cruise control bug (FR-001) was invisible because no test sets `currentSpeed < pitSpeedLimit`.

**Recommendation**: Add test case: `setPit(true)` when `currentSpeed = 10` and `pitSpeedLimit = 12.5` → assert speed stays at 10 (does not increase).

**Orchestrator Analysis**: **Decision: FIX** — Directly supports FR-001 fix. Must be included.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

#### FR-025: No test for braking in reverse gear

| Field | Value |
|-------|-------|
| **Category** | Test |
| **Severity** | 🟡 WARNING |
| **Source** | QA analysis of FR-002 |

**Finding**: `engine-gears-drag-braking.test.ts` tests braking in forward gear only. The reverse braking acceleration bug (FR-002) was invisible because no test combines `brake > 0` with `gear === -1`.

**Recommendation**: Add test case: `gear = -1`, `speedMs = -5`, `brake = 1` → assert `newSpeedMs > speedMs` (deceleration toward zero), not `< speedMs` (further into reverse).

**Orchestrator Analysis**: **Decision: FIX** — Directly supports FR-002 fix. Must be included.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

#### FR-026: No test for computeSpeedMod with zero config

| Field | Value |
|-------|-------|
| **Category** | Test |
| **Severity** | 🟡 WARNING |
| **Source** | QA analysis of FR-013 |

**Finding**: No test verifies `computeSpeedMod()` behavior when `speedModRefSpeedKmh = 0`. The NaN corruption path is untested.

**Recommendation**: Add test: `computeSpeedMod(0, { speedModRefSpeedKmh: 0, speedModMinFactor: 0.5 })` → assert result is finite (1.0 with the proposed guard).

**Orchestrator Analysis**: **Decision: FIX** — Directly supports FR-013 fix. Must be included.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

#### FR-027: No integration test verifying auto-shift triggers

| Field | Value |
|-------|-------|
| **Category** | Test |
| **Severity** | 🟢 MINOR |
| **Source** | QA analysis of FR-004 |

**Finding**: The isolated `DEFAULT_ENGINE_CONFIG` uses `autoShiftRpmThreshold: 0.8` (correct fraction), but all integration test configs use `8000` (absolute RPM). No test asserts that auto-shift actually triggers at the expected RPM threshold.

**Recommendation**: Add integration test that drives RPM above `rpmMax * threshold` and verifies gear increments.

**Orchestrator Analysis**: **Decision: FIX** — Supports FR-004 fix. The unit mismatch means no existing test verifies auto-shift works. Must add.
**User Decision**: [X] FIX [ ] SKIP [ ] DISCUSS

---

*QA analysis completed: 2026-06-30. All 312 physics-handling tests pass (5 test files). Regression suite assertion count corrected from 3918 to 4108.*
