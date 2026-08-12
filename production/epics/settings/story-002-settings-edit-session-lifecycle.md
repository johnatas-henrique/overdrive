# Story 002: SettingsEditSession & Lifecycle

> **Epic**: Settings
> **Status**: Ready
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

- [ ] **AC-AM1** (re-scoped per cross-epic verifiability): Given player changes Controls/Audio/Display/Accessibility/Camera, When a working value changes, Then its supported runtime or evaluator preview updates immediately; persistence occurs only after successful Apply. *(Rewrite: working values update inside the session; SettingsInputPreviewEvaluator receives working control profile; typed preview-change notifications emitted; does NOT assert audio/HUD/display/camera output — those are consumer-epic ACs.)*
- [ ] **AC-AM2**: Given player changes Difficulty from menu outside an active race, When Apply succeeds, Then the selected profile is used at the next race initialization. Difficulty cannot change the current race snapshot. *(Cross-reference Story 003 AC-D7 canonical.)*
- [ ] **AC-ST1**: Given Settings Closed, When player opens from title or a pause menu, Then transitions to Open; all categories are browsable, while Difficulty remains disabled when the pause menu belongs to an active race or Countdown.
- [ ] **AC-ST7**: Given Settings Open, When Apply persistence succeeds, Then working values become active and state transitions to Closed; when persistence fails, state remains Open under AC-S5.
- [ ] **AC-ST8**: Given Settings Open, When Cancel is pressed, Then snapshot values are restored to runtime and state transitions to Closed.
- [ ] **AC-E2**: Given Countdown is running and not paused, When player opens Settings, Then it is blocked with tooltip: "Unavailable during countdown." Given Countdown is paused, Settings opens through the normal pause menu.
- [ ] **AC-E8**: Given player opens/closes Settings rapidly, When toggled quickly, Then no state corruption, menu responsive. *(Non-reentrant one-session-at-a-time — no duplicate sessions in one frame.)*
- [ ] **AC-E9**: Given player selects Restore Defaults and confirms, When preview updates, Then non-display working values match factory defaults; any changed resolution/fullscreen candidate completes DisplayConfirm before remaining in `working`, and all persistence still waits for Apply.
- [ ] **AC-D6** (lifecycle): Given player opens Settings from a Racing-paused or Countdown-paused pause menu, When Settings opens, Then Difficulty option is disabled/grayed out.

---

## Implementation Notes

*Derived from ADR-0004 Implementation Guidelines:*

- **`SettingsEditSession`** (ADR-0004:85-91): `Snapshot` (active values at session start) + `Working` (editable copy). `Apply()` persists Working via Story 001's SettingsPersistence (backup-first), commits as new active profile; `Cancel()` restores Snapshot to runtime and discards Working. `IDisposable`.
- **Non-reentrant** (ADR-0004:165): only one session at a time; rapid open/close (AC-E8) must not corrupt state — opening while a session exists is a no-op or rejected.
- **`ISettingsLifecycleContext` port** (injected — NEW-3 from gate):
  ```csharp
  public interface ISettingsLifecycleContext {
      bool CanOpenSettings { get; }      // true: Idle/Title, paused race, paused Countdown; FALSE: active Countdown (GDD:252)
      bool IsDifficultyEditable { get; } // false when an active race owns an immutable DifficultyProfile snapshot (GDD:299)
  }
  ```
  Fake for tests; Unity adapter consumes Simulation state via existing seam (state gate / SimulationStateMachine).
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

- **AC-ST1**: Given Settings Closed in title, paused race, and paused Countdown; When open; Then transitions to Open. Difficulty is enabled only outside an active race snapshot.
- **AC-D6**: Given Racing-paused or Countdown-paused lifecycle context; When query editability; Then Difficulty is disabled. Edge: active Countdown without pause cannot open Settings.
- **AC-E2**: Given active Countdown; When request open; Then request rejected with "Unavailable during countdown." Given paused Countdown; Then normal Settings entry succeeds.
- **AC-E8**: Given repeated open/close/apply/cancel requests in one frame; When process; Then no duplicate sessions, invalid state, or corrupted snapshot/working values.
- **AC-ST7**: Given Open with valid working values; When Apply succeeds; Then working becomes active, persistence completes, state becomes Closed. When persistence fails; Then state remains Open and working is preserved.
- **AC-ST8**: Given Open with modified working values; When Cancel; Then snapshot is restored, working discarded, state becomes Closed, no persistence occurs.
- **AC-AM1**: Given change Controls/Audio/Display/Accessibility/Camera value; When edit working value; Then supported preview/evaluator updates immediately while persistence remains untouched until Apply.
- **AC-E9**: Given Restore Defaults confirmed; When preview; Then non-display working values become factory defaults; changed display values require DisplayConfirm; persistence waits for Apply.

---

## Test Evidence

**Story Type**: Logic
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/settings/SettingsEditSessionTests.cs` — must exist and pass
- Integration: `Assets/tests/integration/settings/SettingsLifecycleTests.cs` — lifecycle gating via ISettingsLifecycleContext fake

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (Settings Persistence & Migration) — DONE required
- Unlocks: Stories 003-006 (session consumed by all)
