# Story 002: SettingsEditSession & Lifecycle

> **Epic**: Settings
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: M (4-5h)

## Context

**GDD**: `design/gdd/settings.md`
**Requirement**: `TR-settings-003`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0004: Settings Persistence and Control Profile Schema
**ADR Decision Summary**: SettingsEditSession is a transactional preview — snapshot (active values) + working copy (preview); Apply persists, Cancel restores; only one session at a time (Save is non-reentrant). Settings is blocked during active Countdown; available via paused Countdown or paused race (Difficulty disabled — the race owns an immutable DifficultyProfile snapshot).

**Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS) | **Risk**: LOW

**Engine Notes**: None — no engine APIs in this story beyond the lifecycle context (consumed via injected seam, not direct Time/Application calls).

**Control Manifest Rules (Foundation layer)**:
- Required: SettingsEditSession — snapshot (active values) + working copy (preview); Apply persists, Cancel restores; only one session at a time (Save is non-reentrant) — source: ADR-0004
- Required: Settings blocked during active Countdown — source: ADR-0004, ADR-0001

---

## Acceptance Criteria

*From GDD `design/gdd/settings.md`, scoped to this story:*

- [ ] **AC-AM1** (re-scoped per cross-epic verifiability): Given player changes Controls/Audio/Display/Accessibility/Camera, When a working value changes, Then its supported runtime or evaluator preview updates immediately; persistence occurs only after successful Apply. *(Rewrite: working values update inside the session; SettingsInputPreviewEvaluator receives working control profile; typed preview-change notifications emitted synchronously within the edit call; does NOT assert audio/HUD/display/camera output — those are consumer-epic ACs.)*
- [ ] **AC-AM2** (DEFERRED to Story 003): Given player changes Difficulty from menu outside an active race, When Apply succeeds, Then the selected profile is used at the next race initialization. Difficulty cannot change the current race snapshot. *(Not verifiable with THIS story's seams — next-race profile consumption requires the DifficultyProfile data + race snapshot of Story 003. Canonical assertion: Story 003 AC-D7. This story only persists the DifficultySelection value through Apply like any other category.)*
- [ ] **AC-ST1**: Given Settings Closed, When player opens from title or a pause menu, Then transitions to Open; Difficulty is disabled when the pause menu belongs to an active race or Countdown. *(Re-scoped per cross-epic verifiability: "all categories are browsable" is UI-owned — the UI Menu epic renders categories; this story's seam is the lifecycle transition (Closed→Open) and the editability query (IsDifficultyEditable).)*
- [ ] **AC-ST7**: Given Settings Open, When Apply persistence succeeds, Then working values become active and state transitions to Closed; when persistence fails, state remains Open under AC-S5. *(Session API: `Apply()` returns `ApplyResult`; on success it raises `Committed(working)` for runtime consumers and transitions to Closed; on failure (`SaveResult != Success`) it raises `ApplyFailed(SaveResult)`, keeps the session Open, and preserves Working for retry/Cancel.)*
- [ ] **AC-ST8**: Given Settings Open, When Cancel is pressed, Then snapshot values are restored to runtime and state transitions to Closed. *(Session API: `Cancel()` raises `SnapshotRestored(snapshot)` for runtime consumers, discards Working, transitions to Closed. No persistence occurs.)*
- [ ] **AC-E2**: Given Countdown is running and not paused, When player opens Settings, Then it is blocked with tooltip: "Unavailable during countdown." Given Countdown is paused, Settings opens through the normal pause menu. *(Contract: `ISettingsLifecycleContext.CanOpenSettings` is false during active Countdown; the session's `TryOpen()` returns `SettingsOpenResult.BlockedCountdown` — the caller distinguishes countdown-block from session-active-block; the tooltip presentation itself is UI-owned.)*
- [ ] **AC-E8**: Given player opens/closes Settings rapidly, When toggled quickly, Then no state corruption, menu responsive. *(Deterministic contract: `TryOpen()` when a session already exists returns `SettingsOpenResult.SessionActive` — rejected, no-op on state, no duplicate session created. Requests are processed in arrival order; a single active session is the invariant. Non-reentrant one-session-at-a-time per ADR-0004:165.)*
- [ ] **AC-E9**: Given player selects Restore Defaults and confirms, When preview updates, Then non-display working values match factory defaults; any changed resolution/fullscreen candidate completes DisplayConfirm before remaining in `working`, and all persistence still waits for Apply. *(Contract: `RestoreDefaults()` replaces non-display working values with factory defaults; a changed display candidate routes through the injected `IDisplayConfirmGate` port (fake in tests, real in Story 005); `Accepted` → candidate stays in working; `RejectedOrTimeout` → prior display values restored in working. Persistence always via Apply.)*
- [ ] **AC-D6** (lifecycle): Given player opens Settings from a Racing-paused or Countdown-paused pause menu, When Settings opens, Then Difficulty option is disabled/grayed out.

---

## Implementation Notes

*Derived from ADR-0004 Implementation Guidelines:*

- **`SettingsEditSession`** (ADR-0004:85-91): `Snapshot` (active values at session start) + `Working` (editable copy). `Apply()` persists Working via Story 001's SettingsPersistence (backup-first), commits as new active profile; `Cancel()` restores Snapshot to runtime and discards Working. `IDisposable`.
- **Public session API** (deterministic — resolves gate findings):
  ```csharp
  public sealed class SettingsEditSession : IDisposable {
      // Factory: returns the opened session (null when blocked) + the result. The CALLER (UI Menu
      // epic) holds the single reference and passes it back on every open attempt (ADR-0004:165
      // one-session-at-a-time). The factory keeps NO global state — the non-reentrancy check is
      // explicit: if the caller passes a session that is still IsOpen, the result is SessionActive
      // and no new session is created.
      public static SettingsEditSession TryOpen(SettingsBlobService blobService,
          ISettingsLifecycleContext lifecycle, IDisplayConfirmGate displayConfirm,
          Action<string> warningSink, SettingsEditSession currentSession,
          out SettingsOpenResult result);

      public bool IsOpen { get; }
      public GameSettingsData Snapshot { get; }   // values at session start (from BlobService.Load)
      public GameSettingsData Working { get; }    // editable copy

      // SetValue validates: category-to-type mapping is fixed (Difficulty→int, Controls→ControlsData,
      // Audio→AudioData, Display→DisplayData, Accessibility→AccessibilityData, Camera→CameraData);
      // null → ArgumentNullException; wrong type → ArgumentException; out-of-range enum →
      // ArgumentOutOfRangeException. Throwing (not silent reject) — a type mismatch is a programming
      // error. No-op when Closed.
      //
      // Display candidates (resolution/fullscreen — GDD:302): a DisplayData value whose
      // resolution/fullscreen differs from the CURRENT Working display routes through
      // IDisplayConfirmGate.Confirm(candidate, callback) instead of updating Working immediately
      // (GDD:110, :198). While pending (HasPendingDisplayConfirm), Working.Display retains the prior
      // values; callback Accepted → candidate copied into Working; RejectedOrTimeout → prior values
      // stay. Non-display DisplayData fields (vsync, quality preset) apply immediately. AC-AM1's
      // "immediate" preview applies to non-display categories and non-display display fields.
      //
      // Concurrent display change while pending: a SECOND SetValue(Display) with a new candidate
      // REPLACES the pending candidate — the stored callback is swapped and the old callback becomes
      // a no-op (the session calls it with RejectedOrTimeout to keep the old candidate out of
      // Working). This avoids a queue while being the intuitive UX (latest selection wins).
      public void SetValue(SettingsCategory category, object value); // raises WorkingChanged(category) when Working actually changes
      public void RestoreDefaults();              // non-display → factory defaults; display → IDisplayConfirmGate (callback)
      public ApplyResult Apply();                 // persist Working via BlobService.Save; Committed on success,
                                                  // ApplyFailed(SaveResult) on failure, AlreadyClosed when Closed
      public void Cancel();                       // SnapshotRestored, discard Working, Closed
      public void Dispose();

      // Typed preview notifications (AC-AM1) — synchronous within the edit call. Subscribers read
      // session.Working after the event to consume the updated value (the SettingsInputPreviewEvaluator
      // binding is the Unity adapter's job — it subscribes to WorkingChanged and feeds session.Working.Controls).
      public event Action<SettingsCategory> WorkingChanged;
      public event Action<GameSettingsData> Committed;
      public event Action<GameSettingsData> SnapshotRestored;
      public event Action<SaveResult> ApplyFailed;
  }

  public enum SettingsCategory { Difficulty, Controls, Audio, Display, Accessibility, Camera }
  public enum SettingsOpenResult { Opened, BlockedCountdown, SessionActive }
  public enum ApplyResult { Success, BackupFailed, PrimaryFailed, DisplayConfirmPending, AlreadyClosed }
  ```
- **Closed lifecycle** (resolves AC-E8): after `Apply()` success, `Cancel()`, or `Dispose()`, the session is Closed (`IsOpen == false`). All mutating operations are silent no-ops when Closed (rapid toggle cannot corrupt state); `Apply()` on a Closed session returns `ApplyResult.AlreadyClosed`. A Closed session can be disposed again safely.
- **`IDisplayConfirmGate` port** (injected — resolves AC-E9; real implementation is Story 005):
  ```csharp
  public interface IDisplayConfirmGate {
      // Async contract: the gate (Story 005) owns the 15-unscaled-second timer (GDD:110) and invokes
      // the callback on outcome. While a confirmation is pending the session exposes
      // HasPendingDisplayConfirm and Apply() returns ApplyResult.DisplayConfirmPending (GDD:110:
      // "Apply is disabled while confirmation is pending"). Test fakes invoke the callback
      // immediately (synchronously) with a chosen result.
      void Confirm(DisplayCandidate candidate, Action<DisplayConfirmResult> callback);
  }
  public enum DisplayConfirmResult { Accepted, RejectedOrTimeout }
  public readonly struct DisplayCandidate { public readonly int Width, Height; public readonly int FullscreenMode; }
  ```
- **Non-reentrant** (ADR-0004:165): only one session at a time; rapid open/close (AC-E8) must not corrupt state — `TryOpen()` when a session exists returns `SessionActive` (rejected, no-op, no duplicate session). Requests processed in arrival order.
- **`ISettingsLifecycleContext` port** (injected — NEW-3 from gate):
  ```csharp
  public interface ISettingsLifecycleContext {
      bool CanOpenSettings { get; }      // true: Idle/Title, paused race, paused Countdown; FALSE: active Countdown (GDD:252)
      bool IsDifficultyEditable { get; } // false when an active race owns an immutable DifficultyProfile snapshot (GDD:299)
  }
  ```
  Fake for tests; Unity adapter consumes Simulation state via existing seam (state gate / SimulationStateMachine).
- **Runtime commit/restore seam** (resolves gate ST7/ST8): the session is a publisher, not a singleton writer. `Committed(working)` and `SnapshotRestored(snapshot)` events deliver the active/runtime settings to consumer bindings (UI, audio, display adapters mounted by their owning stories). No static singleton holds game state — consumers subscribe to the events.
- **Persistence seam** (resolves gate R2-3): the session consumes `SettingsBlobService` (Story 001) — `Load()` seeds `Snapshot`, `Save(GameSettingsData)` persists `Working` on Apply with its internal serialize→validate→backup-first→SaveResult mapping. The session never touches raw JSON or `ISettingsPersistence.Save(string)` directly.
- **Open rejection contract** (resolves gate E2/E8): `TryOpen()` consults `ISettingsLifecycleContext.CanOpenSettings` first (false → `BlockedCountdown`), then checks session existence (active → `SessionActive`). The caller distinguishes the two; tooltip presentation is UI-owned.
- **Preview notifications**: typed preview-change notifications emitted when Working changes; persistence untouched until Apply.
- **Restore Defaults** (ADR-0004:113): replaces Working with factory defaults after confirmation, previews them; changed display candidate completes DisplayConfirm (Story 005) before remaining in Working.
- **Apply failure path** (AC-S5, GDD:86): backup/primary write failure aborts Apply, keeps session Open, preserves last valid blob, retains Working for retry/Cancel.

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- [Story 001]: Persistence core (backup-first, migration, load cascade) — consumed here
- [Story 003]: DifficultyProfile data + race snapshot (AC-D7 canonical)
- [Story 004]: Listening/BindingConflict state transitions (ST2-ST6)
- [Story 005]: DisplayConfirm transitions (ST9)
- Audio/HUD/display/camera runtime output → respective epics (TD-023)

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate, round 3). The developer implements against these — do not invent new test cases during implementation.*

- **AC-ST1**: Given Settings Closed in title, paused race, and paused Countdown; When TryOpen; Then Opened (lifecycle transition). Difficulty editability follows IsDifficultyEditable (false with active race snapshot).
- **AC-D6**: Given Racing-paused or Countdown-paused lifecycle context; When query editability; Then IsDifficultyEditable == false. Edge: active Countdown without pause → CanOpenSettings false (no open possible).
- **AC-E2**: Given active Countdown; When TryOpen; Then SettingsOpenResult.BlockedCountdown (no session created, no state change). Given paused Countdown; Then TryOpen → Opened.
- **AC-E8**: Given a session already active (caller passes its IsOpen session); When TryOpen again in the same frame; Then SettingsOpenResult.SessionActive — no duplicate session, no corruption of Snapshot/Working. Repeated open/close/apply/cancel in one frame leaves a single consistent session (mutating ops on a Closed session are no-ops; Apply on Closed → AlreadyClosed).
- **AC-ST7**: Given Open with valid working values; When Apply succeeds; Then ApplyResult.Success, Committed(working) raised, session Closed. When persistence fails; Then ApplyResult.BackupFailed/PrimaryFailed, ApplyFailed(SaveResult) raised, state remains Open, Working preserved.
- **AC-ST8**: Given Open with modified working values; When Cancel; Then SnapshotRestored(snapshot) raised, Working discarded, state Closed, no persistence occurs.
- **AC-AM1**: Given change Controls/Audio/Accessibility/Camera value (non-display) or non-display Display fields (vsync/quality); When SetValue; Then WorkingChanged(category) raised synchronously, Working updated, persistence untouched until Apply. Edge: Display candidate (resolution/fullscreen differs) routes through IDisplayConfirmGate instead — Working.Display unchanged until callback Accepted.
- **AC-E9**: Given Restore Defaults confirmed; When preview; Then non-display working values match factory defaults; display candidate routed through IDisplayConfirmGate.Confirm(candidate, callback) — callback Accepted → candidate stays in working; callback RejectedOrTimeout → prior display values restored in working; while pending, HasPendingDisplayConfirm true and Apply returns DisplayConfirmPending; persistence waits for Apply.

---

## Test Evidence

**Story Type**: Logic
**Performance disposition**: No per-frame performance impact expected — the edit session runs only on user open/edit/apply/cancel (menu-driven, not in the gameplay loop); snapshot/working copies are small reference-typed models. The lifecycle context port is a query seam read only on settings-open attempts, not per frame. Tests use fakes for the lifecycle context, not per-frame hooks.
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/settings/SettingsEditSessionTests.cs` — must exist and pass
- Integration: `Assets/tests/integration/settings/SettingsLifecycleTests.cs` — lifecycle gating via ISettingsLifecycleContext fake

**Status**: [x] Created — `SettingsEditSessionTests.cs` (45 tests) + `SettingsLifecycleTests.cs` (15 tests); full suite 552/552 green (83 unit + 21 integration settings).

---

## Dependencies

- Depends on: Story 001 (Settings Persistence & Migration) — DONE required
- Unlocks: Stories 003-006 (session consumed by all)

## Completion Notes
**Completed**: 2026-08-12
**Criteria**: 7/8 fully passing + AC-AM2 deferred (next-race preview consumption requires Story 003's DifficultyProfile data + race snapshot - canonical assertion Story 003 AC-D7; this story persists the DifficultySelection value through Apply like any other category)
**Deviations**: ADVISORY — (1) TD-030: SettingsValidator does not validate DifficultySelection range on load (validator is Story 001 scope; session rejects via RequireDifficulty); (2) TD-031: ADR-0004 pseudocode drift vs shipped model; (3) TD-032: RestoreDefaults emits up to 6 sequential WorkingChanged (batch flag deferred, menu-driven); (4) ADR-0004 pseudocode types (SettingsSnapshot/VfxSettings) superseded by GameSettingsData/Camera per TD-031
**Test Evidence**: Logic — Assets/tests/unit/settings/SettingsEditSessionTests.cs (45 tests); Integration — Assets/tests/integration/settings/SettingsLifecycleTests.cs (15 tests); full suite 552/552 green
**Code Review**: Complete — 5 rounds (unity-specialist + qa-tester): 1 BLOCKING (late display outcome after Cancel), 1 REQUIRED (subscriber exceptions), 1 REQUIRED (unguarded Confirm), 1 BLOCKING (difficulty range), 3 GAPS (pending survives RestoreDefaults, Cancel Working stale, retry/identical/PlayerPrefs cleanup); QL-TEST-COVERAGE ADEQUATE (R3); LP-CODE-REVIEW APPROVED (6/6)
**Architecture**: session = publisher (events, no singletons); IDisplayConfirmGate async (Story 005 supplies real gate); generation counter for concurrent display changes; SettingsLifecycleContext maps ISimulationStateGate (Simulation ref added to Overdrive.Settings asmdef)

