# Story 001: Settings Persistence & Migration

> **Epic**: Settings
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: M (3-4h)

## Context

**GDD**: `design/gdd/settings.md`
**Requirement**: `TR-settings-001`, `TR-settings-002`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0004: Settings Persistence and Control Profile Schema
**ADR Decision Summary**: Settings uses PlayerPrefs single JSON blob (`OverdriveSettings` + `OverdriveSettings_Backup`) with backup-first atomic write, schema migration v1→v3 sequential, and per-field validation with fallback to approved defaults. Every successful save calls `PlayerPrefs.Save()` explicitly.

**Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS) | **Risk**: LOW (PlayerPrefs API stable, no post-cutoff APIs)

**Engine Notes**: None — ADR-0004 Knowledge Risk LOW; PlayerPrefs is stable across Unity 6 releases. Persistence note (ADR-0004:62): `SetString` alone does not flush synchronously on some platforms — explicit `PlayerPrefs.Save()` required after backup-first write, before reporting Success.

**Control Manifest Rules (Foundation layer)**:
- Required: Settings uses PlayerPrefs single JSON blob with backup-first write and transactional preview; schema migration runs on load (v1→v2→v3 sequentially, never by jump) — source: ADR-0004
- Required: Every successful save must call `PlayerPrefs.Save()` explicitly after the backup-first write completes, before reporting Success — source: ADR-0004
- Forbidden: Never use individual PlayerPrefs keys per setting (no atomicity, no built-in migration, stale keys accumulate) — source: ADR-0004
- Forbidden: Never use a JSON file on disk for settings (no atomic write guarantee on all platforms, no benefit at <10 KB blob size) — source: ADR-0004

---

## Acceptance Criteria

*From GDD `design/gdd/settings.md`, scoped to this story:*

- [ ] **AC-S1**: Given no saved settings (first launch), When game starts, Then default settings loaded, all 6 categories reflect defaults.
- [ ] **AC-S2**: Given player changes any setting, When Apply succeeds, Then version-3 JSON is written to PlayerPrefs and any valid previous primary was persisted to backup first.
- [ ] **AC-S3**: Given valid settings JSON in PlayerPrefs, When game launches, Then settings loaded and applied to all systems.
- [ ] **AC-S4**: Given corrupted settings JSON, When game launches, Then backup restored; if backup also corrupt, factory defaults loaded.
- [ ] **AC-S5**: Given PlayerPrefs cannot persist the backup or primary blob, When Apply runs, Then Apply aborts, Settings remains Open, the last valid persisted blob remains recoverable, the working preview remains available for retry/Cancel, and defaults are not substituted.
- [ ] **AC-S6**: Given a valid version-1 blob, When migration runs, Then it produces a valid version-3 blob with stick inner/outer dead zone and per-action EMA defaults, without vibration, player-owned trigger threshold, or subtitles.
- [ ] **AC-S7**: Given a valid version-2 blob, When migration runs, Then it produces a valid version-3 blob that discards `trigger_dead_zone_inner` and `subtitles` while preserving all remaining supported values.
- [ ] **AC-E1** (value-level): Given WebGL localStorage is full, When Apply attempts persistence, Then a save error is shown, Apply aborts, the last valid persisted blob and backup remain recoverable, and defaults are not substituted. *(OS-level localStorage semantics not claimed — simulated via store throwing on SetString/Save; platform evidence deferred)*
- [ ] **AC-E3**: Given the game closes or crashes with unapplied working settings, When it relaunches, Then the last successfully persisted primary or valid backup loads; unapplied preview values do not become authoritative. *(Simulated restart test: new store instance loads only persisted data — does not claim to prove an OS crash)*
- [ ] **AC-E4**: Given two actions bound to same key (external edit), When game loads, Then first action keeps binding, second reset to default with console warning.

---

## Implementation Notes

*Derived from ADR-0004 Implementation Guidelines:*

- **Assembly**: New `Overdrive.Settings` assembly (`Assets/source/Settings/Overdrive.Settings.asmdef`) — Unity-backed (PlayerPrefs is UnityEngine), references `Overdrive.Simulation` + `Overdrive.Input` (for ControlProfile/BindingCatalog types). No cycle: Input → Simulation; Settings → Input + Simulation.
- **Two layers**: engine-free core logic (migration, validation, load cascade — no UnityEngine) + thin Unity adapter (PlayerPrefs store).
- **`IPlayerPrefsStore` port** (injected into core):
  ```csharp
  public interface IPlayerPrefsStore {
      string GetString(string key);
      bool HasKey(string key);
      void SetString(string key, string value);
      void Save();
  }
  ```
  Adapter implements over `UnityEngine.PlayerPrefs`. Core tests use a fake with call-sequence recording.
- **Keys**: `"OverdriveSettings"` (primary) + `"OverdriveSettings_Backup"` (backup) — ADR-0004:69-70.
- **Save sequence** (ADR-0004:48, :62): serialize → validate → write backup → write primary → `Save()` → report Success. A backup-write or primary-write failure aborts Apply, keeps Settings open, preserves last valid blob, retains working preview, shows retryable save error. If primary fails after backup succeeds, attempt restore primary from backup; failure leaves backup intact for next-launch recovery.
- **Load cascade** (ADR-0004:204-210): read primary → if corrupt/missing try backup → if backup also corrupt/missing factory defaults + "Settings restored" message → migrate loaded blob to current version (sequential v1→v2→v3) → validate every field (non-finite NaN/Inf → per-field default).
- **Migration** (ADR-0004:88, GDD:88): v1 migrates `dead_zone` → `stick_dead_zone_inner`, applies defaults for stick outer threshold and per-action EMA alpha, discards unused vibration field. v2→v3 discards player-owned `trigger_dead_zone_inner` and `subtitles`. Every successful migration validated as version 3 before replacing primary. Never jump versions — process sequentially.
- **`SaveResult` enum**: `{ Success, BackupFailed, PrimaryFailed }` (ADR-0004:76).
- **Schema version**: `CurrentVersion = 3` (ADR-0004:80).
- **Per-field validation**: every numeric field validated; NaN/Inf → approved default (GDD:84, ADR-0004:44).

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- [Story 002]: SettingsEditSession (snapshot/working/Apply/Cancel lifecycle)
- [Story 004]: Control bindings rebinding flow
- [Story 005]: Display confirm + quality presets
- PlayerPrefs OS-level crash semantics (E1/E3 platform evidence) → integration gate
- Migration fixture blobs v1/v2: created as test fixtures in this story's test assembly

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate, round 3). The developer implements against these — do not invent new test cases during implementation.*

- **AC-S1**: Given no primary/backup; When load first launch; Then version-3 defaults are active across all six categories. Edge: failed initial write keeps defaults active and reports warning.
- **AC-S2**: Given valid prior primary; When Apply; Then backup is written and flushed before version-3 primary replacement. Edge: no prior primary means backup is not required.
- **AC-S3**: Given valid version-3 blob; When launch; Then values deserialize, validate, and are applied to all exposed consumer ports. Edge: valid zero volume and boundary text scale remain valid.
- **AC-S4**: Given corrupt primary and valid backup; When launch; Then backup loads. Given both corrupt; Then factory defaults load with restoration notice.
- **AC-S5**: Given backup or primary write fails; When Apply; Then Apply returns failure, Settings remains Open, working preview remains, and last valid blob/backup remains recoverable.
- **AC-S6**: Given valid v1 blob; When migrate; Then v3 blob contains migrated stick values and EMA defaults, with vibration, trigger ownership, and subtitles removed.
- **AC-S7**: Given valid v2 blob; When migrate; Then v3 blob removes player trigger threshold/subtitles and preserves all supported values.
- **AC-E1**: Given simulated full WebGL storage; When Apply; Then retryable save error appears and prior primary/backup remain recoverable.
- **AC-E3**: Given unapplied working changes; When terminate/relaunch; Then last successful primary or backup loads, never the unapplied preview.
- **AC-E4**: Given duplicate external bindings; When load; Then first binding remains and second resets with warning. Edge: duplicates involving reserved bindings are rejected rather than reassigned.

---

## Test Evidence

**Story Type**: Logic
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/settings/SettingsPersistenceTests.cs` — must exist and pass (via fake IPlayerPrefsStore)
- Integration evidence: PlayerPrefs adapter smoke test (real SetString/Save/get round-trip in EditMode) — part of the same test file or `Assets/tests/integration/settings/SettingsPersistenceIntegrationTests.cs`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None (first Settings story)
- Unlocks: Stories 002-006 (all consume the persistence core)
