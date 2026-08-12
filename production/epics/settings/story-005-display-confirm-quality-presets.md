# Story 005: Display Confirm & Quality Presets

> **Epic**: Settings
> **Status**: Ready
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

**Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS) | **Risk**: MEDIUM (Screen.SetResolution RefreshRate overload — verified in engine reference)

**Engine Notes**: `Screen.SetResolution` with `int preferredRefreshRate` is deprecated in Unity 6000.3 — use `RefreshRate` struct (deprecated-apis.md:15, ADR-0004:45).

**Control Manifest Rules (Foundation layer)**:
- Required: DisplayConfirm with 15s timer for resolution/fullscreen changes; reverts on focus loss — source: ADR-0004
- Required: Use `RefreshRate` struct exclusively for `Screen.SetResolution` — the `int preferredRefreshRate` overloads are deprecated in Unity 6000.3 — source: ADR-0004
- Guardrail: Unsupported resolution → fall back to nearest supported, show warning, no crash — source: ADR-0004

---

## Acceptance Criteria

*From GDD `design/gdd/settings.md`, scoped to this story:*

- [ ] **AC-DR1**: Given player opens Display settings, When dropdown shown, Then only supported resolutions listed.
- [ ] **AC-DR2**: Given player selects an unsupported resolution, When preview begins, Then the nearest supported resolution is used and the warning appears before DisplayConfirm.
- [ ] **AC-DR3**: Given resolution or fullscreen preview begins, When candidate applies, Then DisplayConfirm opens with 15 unscaled seconds remaining and Apply is disabled.
- [ ] **AC-DR4**: Given DisplayConfirm is active, When Keep Changes is selected, Then the candidate remains in `working` and state returns to Open without persistence.
- [ ] **AC-DR5**: Given DisplayConfirm is active, When Cancel, timeout, or focus loss occurs, Then the pre-preview display values are restored and state returns to Open without persistence.
- [ ] **AC-DR6**: Given player selects Quality Preset, When preview updates, Then rendering settings and VFX density match the preset unless a higher-priority runtime override suppresses them.
- [ ] **AC-DR7**: Given player changes an advanced setting while a preset is active, When changed, Then preset label changes to "Custom".
- [ ] **AC-ST9**: Given Settings Open, When a resolution or fullscreen candidate is selected, Then state transitions to DisplayConfirm; every DisplayConfirm outcome returns to Open.

---

## Implementation Notes

*Derived from ADR-0004 + ADR-0010 Implementation Guidelines:*

- **`IDisplayApi` port** (gate NEW-2 — expanded for fullscreen rollback):
  ```csharp
  public readonly struct DisplayState {
      public readonly int Width, Height;
      public readonly int RefreshRateNumerator, RefreshRateDenominator; // for RefreshRate struct
      public readonly FullScreenMode ScreenMode;
  }

  public interface IDisplayApi {
      DisplayState CurrentState { get; }
      IReadOnlyList<DisplayState> SupportedStates { get; }
      void ApplyPreview(DisplayState state);      // Screen.SetResolution(w, h, mode, RefreshRate)
      void Restore(DisplayState previousState);   // DR5 rollback
  }
  ```
  Adapter over `Screen.resolutions`, `Screen.SetResolution(RefreshRate overload)`, `Screen.fullScreenMode`. Fake for deterministic tests.
- **`IUnscaledClock` port**: `float UnscaledDeltaTime { get; }` — adapter over `Time.unscaledDeltaTime`; fake returns fixed deltas for deterministic 15s tests.
- **Focus-change injection seam**: focus-loss event (Application.focusChanged) → restore pre-preview display values (DR5). Injectable for tests.
- **`IQualityPresetApplier` port**: `ApplyPreset(QualityPresetId) → ApplyStatus` — adapter over the URP render pipeline asset; observable apply state. Settings publishes the selected preset + receives apply-status result; does NOT own URP shader compilation (TR-008 resolution — E6 deferred to VFX).
- **Quality presets** (GDD:120-125, 4 presets): Low (0.75 render scale, shadows Off, MSAA Off, anisotropic Per Texture, VFX Low) / Medium (0.85, Soft, 2x, Forced On, Medium) / High (1.0, Hard, 4x, Forced On, High) / Ultra (1.0, Hard, 4x, Forced On, Ultra).
- **Nearest-supported-resolution tie-break** (gate F9): smallest supported state ≥ requested; if none, largest supported ≤ requested. Warning emitted before DisplayConfirm (DR2).
- **Advanced settings** (GDD:127): Render Scale 50-100%, Shadow Resolution, MSAA (Off/2x/4x), VSync (Off/On/Adaptive). Changing any → preset label "Custom" (DR7).
- **DisplayConfirm flow** (ADR-0004:182-191): candidate applies immediately, prior display values retained separately from working, 15s unscaled timer begins. Keep → copy candidate to working; every other exit (Cancel/timeout/focus loss) → restore prior display values. Apply disabled while pending.

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- [Story 002]: EditSession lifecycle (DisplayConfirm is entered from it, returns to it)
- E6 (shader recompile loading indicator) → VFX epic (TR-008 resolution)
- VFX density runtime execution → VFX epic
- Camera/VFX rendering budget enforcement → ADR-0010 consumer epics

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate, round 3). The developer implements against these — do not invent new test cases during implementation.*

- **AC-DR1**: Given supported display states; When open dropdown; Then only states in `SupportedStates` appear.
- **AC-DR2**: Given unsupported candidate; When preview; Then nearest supported state is selected, warning is emitted before DisplayConfirm.
- **AC-DR3**: Given valid resolution/fullscreen candidate; When ApplyPreview; Then DisplayConfirm opens with 15 unscaled seconds and Apply disabled.
- **AC-DR4**: Given DisplayConfirm; When Keep Changes; Then candidate remains in working, state returns Open, persistence does not occur.
- **AC-DR5**: Given DisplayConfirm; When cancel, timeout, or focus loss; Then `Restore(previousState)` is called, pre-preview state returns, no persistence occurs.
- **AC-DR6**: Given each quality preset; When preview; Then render settings and VFX-density output match preset unless runtime override suppresses density.
- **AC-DR7**: Given active preset; When change advanced setting; Then preset label becomes Custom.
- **AC-ST9**: Given Open; When select resolution/fullscreen; Then DisplayConfirm opens; every Keep/Cancel/timeout/focus-loss path returns Open.

**Display API edge cases**: empty supported-state list, equal nearest candidates, refresh-rate fraction preservation, WebGL unsupported fullscreen/resolution path, repeated focus loss.

---

## Test Evidence

**Story Type**: Integration
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/settings/DisplaySettingsTests.cs` — DisplayConfirm timer, nearest-resolution, preset mapping via fakes
- Integration: `Assets/tests/integration/settings/DisplaySettingsIntegrationTests.cs` — real Screen/URP adapter smoke test

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (Settings Persistence & Migration) — DONE; Story 002 (EditSession lifecycle — DisplayConfirm entered from it) — DONE
- Unlocks: None directly (Camera/VFX epics consume quality presets)
