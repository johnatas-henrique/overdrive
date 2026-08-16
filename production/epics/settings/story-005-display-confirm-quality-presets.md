# Story 005: Display Confirm & Quality Presets

> **Epic**: Settings
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: L (5-6h)

## Context

**GDD**: `design/gdd/settings.md`
**Requirement**: `TR-settings-006`, `TR-settings-008`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0004: Settings Persistence and Control Profile Schema; ADR-0010: Camera/VFX Rendering Budget and Interpolation
**ADR Decision Summary**: Display changes use `RefreshRate` struct exclusively (`int preferredRefreshRate` overloads deprecated in Unity 6000.3), a 15-second unscaled DisplayConfirm timer, and rollback on timeout, cancellation, or focus loss. Four quality presets (Low/Medium/High/Ultra) configure render scale and VFX density without requiring recompilation at the Settings boundary; shader recompilation behavior is VFX-owned.

**Engine**: Unity 6000.3.22f1 (Unity 6.3 LTS) | **Risk**: MEDIUM (Screen.SetResolution RefreshRate overload — verified in engine reference)

**Engine Notes**: `Screen.SetResolution` with `int preferredRefreshRate` is deprecated in Unity 6000.3 — use `RefreshRate` struct (deprecated-apis.md:15, ADR-0004:45).

**Control Manifest Rules (Foundation layer)**:
- Required: DisplayConfirm with 15s timer for resolution/fullscreen changes; reverts on focus loss — source: ADR-0004
- Required: Use `RefreshRate` struct exclusively for `Screen.SetResolution` — the `int preferredRefreshRate` overloads are deprecated in Unity 6000.3 — source: ADR-0004
- Guardrail: Unsupported resolution → fall back to nearest supported, show warning, no crash — source: ADR-0004

---

## Acceptance Criteria

*From GDD `design/gdd/settings.md`, scoped to this story:*

- [ ] **AC-DR1**: Given the display adapter, When queried, Then `SupportedStates` contains only real supported display states and includes `CurrentState`. *(The dropdown listing visual is UI-epic owned — this story asserts the data source contract: real states, current state present, no invented entries.)*
- [ ] **AC-DR2**: Given player selects an unsupported resolution, When preview begins, Then the nearest supported resolution is used and the warning appears before DisplayConfirm.
- [ ] **AC-DR3**: Given resolution or fullscreen preview begins, When candidate applies, Then DisplayConfirm opens with 15 unscaled seconds remaining and the session rejects Apply while pending. *(The disabled button visual is UI-epic owned; this story asserts the session contract: `ApplyResult.DisplayConfirmPending` + `HasPendingDisplayConfirm` while pending.)*
- [ ] **AC-DR4**: Given DisplayConfirm is active, When Keep Changes is selected, Then the candidate remains in `working` and state returns to Open without persistence. *(Verified through Story 002's session contract — this story asserts the gate outcome and that no persistence call occurs.)*
- [ ] **AC-DR5**: Given DisplayConfirm is active, When Cancel, timeout, or focus loss occurs, Then the pre-preview display values are restored exactly once and state returns to Open without persistence. *(Focus loss flows through the injectable `IFocusChangeSource` — repeated loss events are idempotent: one restore, one outcome.)*
- [ ] **AC-DR6**: Given player selects Quality Preset, When preview updates, Then the applier receives the preset and publishes the requested render-scale/VFX-density mapping with an observable apply status. *(Effective runtime suppression of VFX density and shader recompilation are VFX-epic owned — deferred; this story asserts the published preset + mapping + apply status.)*
- [ ] **AC-DR7**: Given a quality preset is applied, When the player changes an advanced display field that this story owns (VSync — the only advanced field present in the shipped `DisplayData` schema), Then the applier reports the active preset as Custom via an observable state. *(Render Scale / Shadow Resolution / MSAA advanced fields are NOT yet in the shipped `DisplayData` schema — their addition is deferred to the VFX/Graphics epic; only fields that exist can trigger the Custom transition.)*
- [ ] **AC-ST9**: Given Settings Open, When a resolution or fullscreen candidate is selected, Then state transitions to DisplayConfirm; every DisplayConfirm outcome returns to Open.

---

## Implementation Notes

*Derived from ADR-0004 + ADR-0010 Implementation Guidelines:*

- **`IDisplayApi` port** (gate NEW-2 — expanded for fullscreen rollback + typed preview result + warning):
  ```csharp
  public readonly struct DisplayState {
      public readonly int Width, Height;
      public readonly int RefreshRateNumerator, RefreshRateDenominator; // for RefreshRate struct
      public readonly FullScreenMode ScreenMode;
  }

  public enum DisplayPreviewResult { Applied, RejectedNoSupported, RejectedWebGLUnsupported }

  public interface IDisplayApi {
      DisplayState CurrentState { get; }
      IReadOnlyList<DisplayState> SupportedStates { get; }
      bool TryResolveRequested(DisplayState requested, out DisplayState resolved);  // nearest-supported (deterministic distance); emits Warning on fallback; false when no candidate
      DisplayPreviewResult ApplyPreview(DisplayState resolved);  // applies the ALREADY-RESOLVED state (idempotent if already resolved)
      void Restore(DisplayState previousState);               // DR5 rollback
      event Action<string> Warning;  // emitted BY THE ADAPTER (own event — legal) when TryResolveRequested falls back
  }
  ```
  Adapter over `Screen.resolutions`, `Screen.SetResolution(RefreshRate overload)`, `Screen.fullScreenMode`. Fake for deterministic tests. Empty supported-state list → `TryResolveRequested` returns `false` (typed rejection — R5 finding 4: `DisplayState` is a non-nullable struct, so an explicit `Try*` pattern replaces the impossible `null`/ambiguous `default` sentinel) and `ApplyPreview` returns `RejectedNoSupported` (no crash). Equal-nearest candidates tie-broken by tuple ordering (width, height, refresh-rate, mode). WebGL unsupported path → `RejectedWebGLUnsupported` (fake-testable here; real platform validation DEFERRED to the WebGL target gate). **Refresh-rate is a physical attribute resolved from `SupportedStates` by the adapter — it lives in `DisplayState`, not in the persisted candidate. Resolve-before-apply: the UI/adapter resolves the requested state BEFORE building the `DisplayData` sent to the session — the candidate the session constructs is already the supported state, so `KeepChanges()` persists the actually-applied values. Warning ownership (R5 finding 2): the WARNING-EMITTING RESOLUTION happens at the ORCHESTRATOR boundary (UI calls `TryResolveRequested` before the session exists) — the subscription lifetime is the orchestrator's: it subscribes to `IDisplayApi.Warning` before resolving and forwards to the UI warning sink; the gate NEVER handles the warning (it has no subscription window and does not re-route it). Remove the `Warning` event from `IDisplayConfirmControl` (below) accordingly.**
- **Fullscreen-mode conversion** (R4 finding 9 — canonical mapping using the SHIPPED int semantics; `DisplayData.FullscreenMode` is copied verbatim into `DisplayCandidate.FullscreenMode` by the session — `SettingsEditSession.cs:340`):
  ```
  DisplayData.FullscreenMode (int, shipped — SettingsData.cs:141)   →   Unity FullScreenMode (enum, live editor)
  0 = Windowed        →   FullScreenMode.Windowed (3)
  1 = FullScreen      →   FullScreenMode.ExclusiveFullScreen (0)   // exclusive fullscreen
  2 = Borderless      →   FullScreenMode.FullScreenWindow (1)      // borderless fullscreen window (project default, ADR-0004:183)
  ```
  Owned by the gate adapter; conversion is explicit and tested both directions. **The int and enum conventions are NOT aligned (int 0=Windowed vs enum 0=Exclusive; int 1=FullScreen vs enum 1=FullScreenWindow) — a direct cast is a real bug. This replaces the earlier R3 table whose int semantics (1=FullscreenWindow, 2=Exclusive) did not match the shipped `DisplayData` docs. Supersession note (R6 finding 3): this story's canonical conversion + transient refresh model (refresh-rate never persisted) SUPERSEDE ADR-0004:123-127 (persisted RefreshRateNumerator/Denominator fields) and ADR-0004:182-187 (unconditional `FullScreenMode.FullScreenWindow`) — ADR amendment pending, same pattern as TD-027/028/031 drift corrections.**
- **`IUnscaledClock` port**: REMOVED (R5 finding 7) — `IDisplayConfirmControl.Tick(float unscaledDeltaTime)` is the single timer seam; the runtime caller supplies `Time.unscaledDeltaTime`, tests supply a fake constant.
- **`IFocusChangeSource` port** (gate NEW — focus-loss seam): `event Action<bool> FocusChanged;` — adapter over `Application.focusChanged`; fake drives loss/re-focus deterministically. Lifetime: subscribed at display session start, unsubscribed at end. Idempotence: while DisplayConfirm is active, repeated `FocusChanged(false)` triggers exactly one restore + one outcome; a re-focus while pending does not cancel the running timer.
- **`IDisplayConfirmControl`** (R3 finding 2 — Keep/Cancel seam + R4 findings 1/2 — timeout pump): the gate real implementation (this story) implements BOTH `IDisplayConfirmGate` (Story 002 seam: `Confirm(candidate, onResult)`) and an extended `IDisplayConfirmControl` exposing the player outcomes + runtime pump. The UI types the gate as `IDisplayConfirmControl`; the session (Story 002) continues to see only `IDisplayConfirmGate` — the Story 002 seam is untouched. **No Warning on this interface (R5 finding 2): warning emission happens at the orchestrator boundary via `IDisplayApi.Warning`, not in the gate.**
  ```csharp
  public interface IDisplayConfirmControl : IDisplayConfirmGate {
      void PrepareDisplayState(DisplayState resolved);  // R6 finding 1 — transient physical-state handoff; orchestrator calls after TryResolveRequested, before SetValue
      void KeepChanges();   // player clicked Keep — candidate copied to working, onResult(Accepted)
      void Cancel();        // player clicked Cancel — restore pre-preview, onResult(RejectedOrTimeout)
      void Tick(float unscaledDeltaTime);  // runtime pump — called once per frame while DisplayConfirm active; drives the 15s timer
  }
  ```
  Timeout determinism (R4 finding 2): the test drive calls `Tick(dt)` with fixed deltas (e.g. 900 × 1/60s) to cross the 15s boundary — no wall-clock dependency. **`IUnscaledClock` is REMOVED (R5 finding 7): `Tick(float unscaledDeltaTime)` is the single timer seam — the caller (UI/Unity driver) supplies the unscaled delta from `Time.unscaledDeltaTime` at runtime and a fake constant in tests; a separate clock port would be redundant.
- **`IQualityPresetApplier` port**: `QualityPresetMapping ResolveMapping(QualityPresetId id)` (pure table lookup returning the FULL five-dimension mapping — render scale, VFX density, shadows, MSAA, anisotropic), `ApplyStatus ApplyPreset(QualityPresetMapping mapping)` (observable return), `event Action<QualityPresetMapping> PresetApplied` (observable publication), `QualityPresetId ActivePreset { get; }` (observable state), `void MarkCustomOverride()` (explicit VSync-trigger seam — R4 finding 7: called when VSync changes, sets `ActivePreset = Custom`, AC-DR7). Adapter over the URP render pipeline asset. Settings publishes the selected preset + receives apply-status result; does NOT own URP shader compilation (E6 — deferred to VFX epic).
  ```csharp
  public enum QualityPresetId { Low, Medium, High, Ultra, Custom }
  public enum VfxDensityLevel { Low, Medium, High, Ultra }
  public enum ShadowLevel { Off, Soft, Hard }
  public enum MSAASamples { Off, X2, X4 }
  public enum AnisotropicLevel { PerTexture, ForcedOn }
  public enum ApplyStatus { Applied, Rejected }
  public readonly struct QualityPresetMapping {
      public readonly QualityPresetId PresetId;
      public readonly float RenderScale;            // 0.75 / 0.85 / 1.0 / 1.0
      public readonly VfxDensityLevel VfxDensity;  // Low / Medium / High / Ultra
      public readonly ShadowLevel Shadows;         // Off / Soft / Hard / Hard (GDD:118-125)
      public readonly MSAASamples MSAA;            // Off / X2 / X4 / X4
      public readonly AnisotropicLevel Anisotropic;  // PerTexture / ForcedOn / ForcedOn / ForcedOn
  }
  ```
  *(R5 finding 6 — the mapping carries the FULL GDD preset output: render scale, VFX density, shadows, MSAA, anisotropic. These are preset OUTPUTS applied by the applier/URP — they are NOT player-editable advanced fields, which remain deferred to the VFX epic.)*
- **Quality presets** (GDD:120-125, 4 presets): Low (0.75 render scale, shadows Off, MSAA Off, anisotropic Per Texture, VFX Low) / Medium (0.85, Soft, 2x, Forced On, Medium) / High (1.0, Hard, 4x, Forced On, High) / Ultra (1.0, Hard, 4x, Forced On, Ultra).
- **Nearest-supported-resolution distance** (deterministic): distance = |requested.Width × requested.Height − candidate.Width × candidate.Height| (absolute area difference); the candidate with the SMALLEST distance wins, **always** — including when ALL candidates are larger than requested (no special upscale rule; the smallest absolute area difference is the answer in every case). Ties broken lexicographically by (Width, Height, RefreshRateNumerator, RefreshRateDenominator, ScreenMode). `TryResolveRequested` returns `false` when `SupportedStates` is empty (R5 finding 5 — the earlier "largest ≤ requested" fallback clause was contradictory and is removed). The adapter emits `Warning` (own event) when the resolved state differs from the requested state (DR2) BEFORE returning.
- **Advanced settings** (GDD:127): Render Scale 50-100%, Shadow Resolution, MSAA (Off/2x/4x), VSync (Off/On/Adaptive). **This story owns ONLY VSync Off/On** — it is the only advanced field present in the shipped `DisplayData` schema (`SettingsData.cs:136-166`, `Vsync` documented 0=Off, 1=On). **VSync "Adaptive" is NOT in the shipped schema (R5 finding 9) → deferred to the VFX epic (not yet decomposed — E6 destination; NO TR-vfx-008 exists in the registry, only TR-vfx-001..005).** Render Scale / Shadow Resolution / MSAA as player-editable fields are NOT in the schema → deferred to the VFX epic (same destination). Changing VSync → `IQualityPresetApplier.MarkCustomOverride()` → `ActivePreset == Custom` (AC-DR7).
- **DisplayConfirm flow** (ADR-0004:182-191): the UI/adapter resolves the requested state via `IDisplayApi.TryResolveRequested` FIRST and calls `IDisplayConfirmControl.PrepareDisplayState(resolved)` (transient physical-state handoff — R6 finding 1) BEFORE building the `DisplayData` sent to the session. The gate stores the prepared `DisplayState` (width/height/mode + refresh-rate) as the expected next candidate. The session constructs `DisplayCandidate` (width/height/mode only — the seam carries no refresh-rate); when the gate receives `Confirm(candidate, onResult)`, it matches the prepared state against the candidate by (width, height, fullscreen-mode): **a match uses the prepared state verbatim (idempotent — NO second resolve, NO second warning); a mismatch (e.g. `RestoreDefaults` path where no prepare happened) resolves with the candidate as requested and the current display's refresh-rate as the default.** The gate converts the candidate's int fullscreen mode via the canonical mapping table and passes the resolved `DisplayState` to `ApplyPreview`. On `Applied`: gate retains prior display values separately from working, starts the 15s unscaled timer driven by `Tick(dt)`, `HasPendingDisplayConfirm` becomes true. `KeepChanges()` → copy candidate (already resolved) to working, `onResult(Accepted)`. `Cancel()`, timeout, or focus loss → `Restore(previousState)` once, `onResult(RejectedOrTimeout)`. **Typed rejection (deterministic):** when `TryResolveRequested` returns `false` or `ApplyPreview` returns `RejectedNoSupported`/`RejectedWebGLUnsupported`, the gate does NOT start the timer, does NOT retain anything, and invokes `onResult(RejectedOrTimeout)` immediately — the session stays Open with Working unchanged (no candidate applied, no persistence). **Rejection while another preview is pending (R4 finding 4):** the gate restores the runtime to the ORIGINAL pre-preview state (the first preview's baseline) exactly once — an abandoned preview never remains applied — then invokes `onResult(RejectedOrTimeout)`; the session's generation counter invalidates the stale candidate. **Preset apply ordering (R6 finding 2):** the orchestrator calls `IQualityPresetApplier.ApplyPreset(mapping)` (or `MarkCustomOverride()` for VSync) BEFORE `session.SetValue(Display, ...)` — on `ApplyStatus.Rejected` the orchestrator does NOT call SetValue, so Working stays unchanged and no `WorkingChanged` fires; on `Applied` SetValue follows and Working updates. Every path returns to Open (AC-ST9).

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- [Story 002]: EditSession lifecycle (DisplayConfirm is entered from it, returns to it)
- E6 (shader recompile loading indicator) → VFX epic (not yet decomposed — no TR-vfx-008 exists; TR-vfx-001..005 only)
- VFX density runtime execution → VFX epic
- Camera/VFX rendering budget enforcement → ADR-0010 consumer epics

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate, round 3). The developer implements against these — do not invent new test cases during implementation.*

- **AC-DR1**: Given the display adapter; When queried; Then `SupportedStates` contains only real supported states and includes `CurrentState`. *(Dropdown visual is UI-epic owned.)*
- **AC-DR2**: Given unsupported candidate; When `TryResolveRequested`; Then the adapter's own `Warning` event fires (captured by the orchestrator subscriber), nearest supported state is returned (deterministic distance), and the gate proceeds to DisplayConfirm with the resolved candidate.
- **AC-DR3**: Given valid resolution/fullscreen candidate; When ApplyPreview; Then DisplayConfirm opens with 15 unscaled seconds and `Apply()` returns `ApplyResult.DisplayConfirmPending` + `HasPendingDisplayConfirm == true`. *(The disabled-button visual is UI-epic owned — the session contract is the assertion.)*
- **AC-DR4**: Given DisplayConfirm; When Keep Changes (`IDisplayConfirmControl.KeepChanges`); Then candidate remains in working, state returns Open, persistence does not occur.
- **AC-DR5**: Given DisplayConfirm; When cancel (`IDisplayConfirmControl.Cancel`), timeout, or focus loss; Then `Restore(previousState)` is called exactly once, pre-preview state returns, no persistence occurs. Repeated focus loss → idempotent single restore. *(Focus-loss via IFocusChangeSource fake in unit; real Application.focusChanged adapter smoke in integration.)*
- **AC-DR6**: Given each quality preset; When preview; Then the orchestrator calls `ApplyPreset(mapping)` FIRST (before `session.SetValue`) — the fake applier receives the preset, its FULL `QualityPresetMapping` (render scale, VFX density, shadows, MSAA, anisotropic), and an `ApplyStatus.Applied` return; `PresetApplied` is raised; only then `SetValue` runs and Working updates. **Rejected path:** when `ApplyPreset` returns `ApplyStatus.Rejected`, the orchestrator SKIPS `session.SetValue(Display, ...)` — Working stays unchanged, no `WorkingChanged` fires, `ActivePreset` remains the previous preset, `PresetApplied` is NOT raised, no persistence occurs. *(Effective runtime VFX suppression is VFX-epic owned — deferred.)*
- **AC-DR7**: Given a quality preset is applied; When the player changes VSync (Off/On — the only advanced field in the shipped `DisplayData` schema); Then the applier reports active preset as Custom via observable state. *(Render Scale/Shadow/MSAA advanced fields + VSync Adaptive deferred to the VFX epic — no TR-vfx-008 exists; TR-vfx-001..005 only.)*
- **AC-ST9**: Given Open; When select resolution/fullscreen; Then DisplayConfirm opens; every Keep (`KeepChanges`)/Cancel/`IDisplayConfirmControl.Cancel`/timeout/focus-loss path returns Open; every typed-rejection path (`RejectedNoSupported`, `RejectedWebGLUnsupported`) returns Open immediately with no timer.

**Display API edge cases**: empty supported-state list → `TryResolveRequested` returns `false` + `ApplyPreview` returns `RejectedNoSupported` (typed rejection, no crash, no timer, immediate `onResult(RejectedOrTimeout)`, callback before return, Working unchanged, zero persistence calls); equal nearest candidates → lexicographic tuple ordering; **all candidates larger than requested (R6 finding 4) → minimum absolute area difference wins, dedicated QA case**; refresh-rate fraction preservation (gate matches the prepared `DisplayState` via `PrepareDisplayState` — no second resolve, no second warning); repeated focus loss → idempotent single restore; fullscreen-mode conversion tested both directions (int ↔ enum, non-aligned conventions); rejection while another DisplayConfirm is pending → restore original pre-preview exactly once, immediate `onResult(RejectedOrTimeout)`, session generation counter invalidates the stale candidate, no persistence; warning ordering — orchestrator subscribes to `IDisplayApi.Warning` before resolving and captures the event before the gate applies. WebGL unsupported fullscreen/resolution path: fake-testable here (`RejectedWebGLUnsupported` typed rejection), real Screen adapter platform validation DEFERRED to the WebGL target gate.

---

## Test Evidence

**Story Type**: Integration
**Performance disposition**: No per-frame performance impact expected — display preview/apply and quality-preset application are menu-time one-shot operations that never run in the gameplay loop; the DisplayConfirm timer runs unscaled only while the Settings screen is open; the nearest-resolution search and preset mapping execute once per user action.
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/settings/DisplaySettingsTests.cs` — DisplayConfirm timer, nearest-resolution, preset mapping via fakes
- Integration: `Assets/tests/integration/settings/DisplaySettingsIntegrationTests.cs` — real Screen/URP adapter smoke test

**Status**: 57 unit + 10 integration = 67 tests, 714/714 full suite green (2026-08-14)

---

## Dependencies

- Depends on: Story 001 (Settings Persistence & Migration) — DONE; Story 002 (EditSession lifecycle — DisplayConfirm entered from it) — DONE
- Unlocks: None directly (Camera/VFX epics consume quality presets)

---

## Completion Notes

**Completed**: 2026-08-14
**Criteria**: 8/8 passing (0 deferred)
**Deviations**: ADVISORY — ADR-0004:123-127 (persisted RefreshRate) and :182-187 (unconditional FullScreenMode.FullScreenWindow) superseded by the shipped transient refresh-rate model (resolved from SupportedStates at the gate, never persisted) + canonical int↔enum conversion table — amendment pending, registered as TD-035
**Test Evidence**: Integration — `Assets/tests/unit/settings/DisplaySettingsTests.cs` (57 tests) + `Assets/tests/integration/settings/DisplaySettingsIntegrationTests.cs` (10 tests); full suite 714/714 green
**Code Review**: Complete — LP-CODE-REVIEW APPROVED (R1); qa-tester 16 rounds (R16 TESTABLE, 0 findings); QL-TEST-COVERAGE ADEQUATE (3 gaps closed)
**Cross-story scope**: `SettingsEditSession.cs` + `SettingsSessionContracts.cs` (Story 002 Core) modified for `CancelActiveConfirmation` (QA R14 F1 — BLOCKING: session terminal ops must complete the real gate so a physical preview is never orphaned); 5 fakes updated in 3 test files of Stories 3-3/3-4 (interface member addition, no behavioral reliance on the old path)
