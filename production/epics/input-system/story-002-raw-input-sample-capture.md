# Story 002: RawInputSample Capture

> **Epic**: Input System
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Integration
> **Estimate**: M (6-8h)
> **Manifest Version**: 2026-08-05

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-005` (CaptureLatestRawSample() called once per frame before accumulator in same Simulation driver Update call), `TR-input-006` (SimulationInput contract — the RawInputSample is the capture-side source of the contract)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0001: Manual Simulation Authority and Determinism Boundary; ADR-0005: Input Context Controller and Action Map Inventory
**ADR Decision Summary**: ADR-0001: Simulation invokes Input-owned `CaptureLatestRawSample()` exactly once per render frame, at the beginning of its own `Update()`, before reading/modifying the accumulator — no relative MonoBehaviour script-order assumption. ADR-0005: Input owns capture and routing; SimulationInput is the sole gameplay-input contract.

**TR-input-006 scope note**: this story covers only the capture-side source of the SimulationInput contract — the `RawInputSample` (raw values + validity flags + pause edge). The tick processor (validation, dead zone, EMA, brake priority) and the output fields (`accelerateOut`, `brakeOut`, `steerOut`, `pauseEdge`) belong to Story 006.

**Engine**: Unity 6000.3.19f1 | **Risk**: HIGH
**Engine Notes**: Unity 6.3 is post-cutoff. Verified APIs: `Physics.simulationMode`, `Physics.Simulate(float)`, `Rigidbody.interpolation`, `Time.unscaledDeltaTime`. Input System 1.19.0: `ProcessEventsInDynamicUpdate` is the required update mode (ADR-0005). No relative script-order dependency is permitted — the same-call ordering (capture before accumulator evaluation) is authoritative.

**Control Manifest Rules (this layer)**:
- Required: Simulation invokes Input-owned `CaptureLatestRawSample()` exactly once per render frame, at the beginning of its own `Update()`, before reading/modifying the accumulator; no relative MonoBehaviour script-order assumption is permitted (source: ADR-0001)
- Required: Input System processes platform events in Dynamic Update (`ProcessEventsInDynamicUpdate`) (source: ADR-0001, ADR-0005)
- Required: ActiveControlScheme arbitration: KeyboardMouse default, last meaningful device wins; both in same DynamicUpdate preserves current; EMA reinitializes on scheme change (source: ADR-0005)
- Guardrail: Simulation tick budget p95 ≤ 6 ms, max ≤ 8 ms (16-car prototype, Steps 1–14) (source: ADR-0001)

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-59: GIVEN a render Update begins after Input System Dynamic Update, WHEN Simulation evaluates its accumulator, THEN it first calls Input-owned `CaptureLatestRawSample()` and receives exactly one immutable RawInputSample with a monotonic `captureSequence`.
- [ ] AC-59b: GIVEN a running session, WHEN a Gameplay↔UI context change occurs and when a scene load occurs, THEN `captureSequence` remains strictly increasing across those boundaries (no reset, no reuse).
- [ ] AC-59c: GIVEN InputContextController is initialized, WHEN `CaptureLatestRawSample()` samples input, THEN it reads from the reference-equal `InputContextController.ActiveAsset` and does not construct or enable a second `InputSystem_Actions` wrapper.
- [ ] AC-59d: GIVEN OverdriveGameplay is active, WHEN one or more Pause rising edges are pending at capture, THEN `RawInputSample.pauseRise` is true; repeated pending rises are coalesced, and UI-context captures report false. Consumption is deferred to Story 006.

## Implementation Notes

*Derived from ADR-0001 Decision and GDD Core Rule 5 (input-system.md:111-128):*

- `CaptureLatestRawSample()` executes exactly once per render frame at the start of the Simulation driver's `Update()`, before the accumulator is read or modified. This same-call ordering is authoritative — no dependency on relative MonoBehaviour script order.
- The controller calls `Object.DontDestroyOnLoad(gameObject)` in `Awake` — the `captureSequence` counter survives scene loads (AC-59b); a per-test controller instance gives zero cross-test contamination (InputTestFixture does not clean statics — the story-001 leak class). The AC-59b PlayMode test loads the dedicated empty test scene `Assets/tests/integration/input/Scenes/RawInputSceneLoadTest.unity` (controller-free — a second controller's init sweep would disable the original's maps).
- **Known deviation (blocks story-006 reconciliation):** the gamepad steer channel is pre-deadzoned by the Input System layout before the capture reads it (`StickControl` bakes `axisDeadzone` 0.125/0.925 onto x/y — verified: 0.5 reads back as 0.46875), so `steerRaw` for the Gamepad scheme is NOT raw per the GDD contract (input-system.md:121). Story-002 captures via `action.ReadValue<float>()` (proven float-safe). The reconciliation decision (accept + amend GDD, or `ReadUnprocessedValue` in story-003/004) must be made before story-006's dead-zone math.
- `DetermineControlScheme()` is a device-presence placeholder — story-007 (ActiveControlScheme Arbitration) must replace it with the ADR-0005 last-meaningful-device arbitration (same-frame preserves current). The fallback order honors the KeyboardMouse default (keyboard/mouse present → KeyboardMouse; else gamepad present → Gamepad; else → KeyboardMouse).
- The real Simulation driver call site does not exist yet; the Simulation Kernel epic owns it. Until then, `RawInputSampleCaptureTests` uses a local harness that preserves the capture-once-per-frame-before-ticks contract.
- Availability checks in `InputContextController` duplicate `DetermineControlScheme()`'s device checks; a shared `HasEligibleDevice()` helper belongs to Story 008's scheme-arbitration scope and is flagged for that story.
- Any future pending-edge clear — Story 006 first-tick consumption or Story 007 scheme-change clearing required by Story 006 AC-40 — MUST also reset `_observedPausePending`; reuse `ClearPendingPauseEdge()`. This lineage is Story 006 AC-40 plus GDD:130 (context transitions), not ADR-0005:156, which is in Alternatives Considered.
- The five `InputActionReference` instances created by `EnsureInitialized()` are destroyed in `OnDestroy()` to prevent the ScriptableObject leak; Story 001's module wiring owns their creation (follow-up context for Story 001's commit history).
- Capture allocates no heap memory per frame — `RawInputSample` is a readonly struct (value type); the capture path is O(1) with no per-frame allocation.
- `RawInputSample` is an immutable value type (readonly struct) with fields: `captureSequence` (uint64, monotonic), `activeScheme` (KeyboardMouse/Gamepad), `accelerateRaw` (0-1), `brakeRaw` (0-1), `steerRaw` (-1-1), `pauseRise` (bool, first pending gameplay Pause rise since prior capture), `inputAvailability` (Available/NoInputDevice), `validityFlags` (bit flags marking non-finite or invalid source channels).
- `captureSequence` starts at 0 and increments strictly per render-Update capture; the counter lives in Input (not per-context) so monotonicity survives context changes and scene loads.
- Non-finite raw channels retain the last valid filtered output for that channel and produce a rate-limited warning (raw-stage sanitization to 0.0f is the tick processor's stage — Story 006; this story captures the flags). `validityFlags` marks only non-finite channels while the GDD table (input-system.md:124) says "non-finite or invalid" — finite out-of-range values are neither flagged at capture nor clamped until Story 006's sanitization; the GDD wording reconciliation happens in Story 006.
- A fresh Pause press while an observed-but-unconsumed edge remains pending does not re-report `pauseRise` (coalescing). `PauseEdge` may re-fire for the fresh press, but the sample suppresses re-reporting until the pending edge is cleared; Story 006's first-tick consumption will evolve this behavior.
- While `OverdriveGameplay` is active, only Pause rising edges enter the pending simulation flag. Repeated rises while pending are ignored; the first simulation tick in that render update consumes and clears it. CameraToggle does not enter RawInputSample (Story 011).
- If one render frame contains multiple simulation ticks, every tick processes the same sample (Story 006 consumes; this story only captures once per frame).
- **Review round 7 (2026-08-07) accepted risks:** (F6) wrapper source scan does not detect `Activator.CreateInstance<InputSystem_Actions>()` — the runtime identity check (:169-170) still fails on enabled foreign actions, gap accepted; (F7) zero-allocation claim has no automated test (profiler tests flaky) — verification belongs to the project performance gate; (F8) NoInputDevice tests depend on InputTestFixture device reset — confirmed stable (67/67 sequential), accepted with CI monitoring.

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 006: Tick processor (validation, dead zone, EMA, brake priority applied to the captured sample)
- Story 001: The `.inputactions` asset and context controller (capture reads the active context's values)

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-59** (PlayMode integration harness — EditMode is not viable, verified by unity-specialist at dev: InputTestFixture is PlayMode-only, the action pipeline does not update in edit mode, and the generated wrapper's Dispose() throws in edit mode):
  - Given: The simulation driver begins a render Update after Input System Dynamic Update, and the accumulator will execute zero or more ticks.
  - When: The driver evaluates the accumulator.
  - Then: `CaptureLatestRawSample()` is called exactly once before any tick; it returns one immutable sample with a strictly increasing `captureSequence`.
  - Edge cases: Zero accumulator ticks; multiple accumulator ticks; accumulator backlog; repeated render Updates; attempted mutation after capture (compile-time readonly enforcement + capture-order trace).
  - Required instrumentation: call counter and call-order trace.
- **AC-59b** (PlayMode boundary test):
  - Given: A running session with a known captureSequence value.
  - When: A Gameplay↔UI context change occurs, then a scene load occurs.
  - Then: captureSequence remains strictly increasing across both boundaries (no reset to 0, no reuse of values).
  - Edge cases: Context change without scene load; scene load without context change; repeated rapid transitions.

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- `Assets/tests/integration/input/RawInputSampleCaptureTests.cs` — 30 story-002 tests; 67 total with 37 story-001 tests; current validation 67/67 PlayMode PASS.

**Status**: [x] Created

## Dependencies

- Depends on: Story 001 (asset + context controller provide the sampled values)
- Unlocks: Story 003, Story 004, Story 006 (all consume the captured sample)

### Implementation constraint (from story-001 review round 6; path updated round 8)

Story 002's raw input capture MUST consume the controller-owned asset via
`InputContextController.ActiveAsset` (read-only accessor added in story 001, round 8) — read
the actions from that asset — and MUST NOT create a second `InputSystem_Actions` wrapper and
enable it. `EnforceGlobalSoleOwnership()` (`InputContextController`) disables any enabled
action from a foreign asset instance (`ReferenceEquals` sweep at init and at both context
transitions); a second enabled wrapper would be silently swept.

## Completion Notes

**Completed**: 2026-08-07
**Criteria**: 4/4 passing (AC-59, AC-59b, AC-59c, AC-59d)
**Deviations**: None new — 5 known deviations documented in Implementation Notes (steerRaw pre-deadzoned by StickControl layout → reconciliation before story-006; DetermineControlScheme placeholder → story-007; real Simulation driver → Simulation Kernel epic; availability duplication → story-008; validityFlags "non-finite or invalid" wording → story-006)
**Test Evidence**: `Assets/tests/integration/input/RawInputSampleCaptureTests.cs` — 67/67 PlayMode PASS (30 story-002 + 37 story-001), verified via unityMCP
**Code Review**: Complete — 7 rounds, converged APPROVED WITH SUGGESTIONS (checklist 4/4 verified in file; F1/F2/F3 annotated to story-006; F6/F7/F8 accepted risks recorded above); gates QL-TEST-COVERAGE ADEQUATE, LP-CODE-REVIEW CONCERNS (C1/C2 function length) — resolved via refactor (EnsureInitialized 72→11 lines + 5 helpers; CaptureLatestRawSample 31→21 lines + 2 helpers), 67/67 green after refactor
