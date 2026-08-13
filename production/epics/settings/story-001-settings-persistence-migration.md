# Story 001: Settings Persistence & Migration

> **Epic**: Settings
> **Status**: Complete
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
- [ ] **AC-S3**: Given valid settings JSON in PlayerPrefs, When game launches, Then settings are deserialized, validated per field, and published to the exposed consumer ports (the settings model consumed by this story's load contract). *(Runtime consumers across systems — audio, display, controls, difficulty — are mounted by their owning stories; this AC verifies the persistence layer's publication boundary, not their consumption.)*
- [ ] **AC-S4**: Given corrupted settings JSON, When game launches, Then backup restored; if backup also corrupt, factory defaults loaded.
- [ ] **AC-S5**: Given PlayerPrefs cannot persist the backup or primary blob, When Apply runs, Then Apply reports `SaveResult != Success` (abort), the last valid persisted blob and backup remain recoverable, the working input remains unchanged, and defaults are not substituted. *(The "Settings remains Open" UI state is owned by SettingsEditSession — Story 002; this story's seam is the SaveResult failure + preserved blob/preview.)*
- [ ] **AC-S6**: Given a valid version-1 blob, When migration runs, Then it produces a valid version-3 blob with stick inner/outer dead zone and per-action EMA defaults, without vibration, player-owned trigger threshold, or subtitles.
- [ ] **AC-S7**: Given a valid version-2 blob, When migration runs, Then it produces a valid version-3 blob that discards `trigger_dead_zone_inner` and `subtitles` while preserving all remaining supported values.
- [ ] **AC-E1** (value-level): Given WebGL localStorage is full, When Apply attempts persistence, Then Apply returns failure (`SaveResult != Success`), the last valid persisted blob and backup remain recoverable, and defaults are not substituted. *(Presentation of the save error — "shown" — is UI-owned (Story 002/UI epic); this story's seam is the failure result + preserved state. OS-level localStorage semantics not claimed — simulated via store throwing on SetString/Save; platform evidence deferred)*
- [ ] **AC-E3**: Given the game closes or crashes with unapplied working settings, When it relaunches, Then the last successfully persisted primary or valid backup loads; unapplied preview values do not become authoritative. *(Simulated restart test: new store instance loads only persisted data — does not claim to prove an OS crash)*
- [ ] **AC-E4**: Given two actions bound to same key (external edit), When game loads, Then first action keeps binding, second reset to default, and a warning is reported through the injectable warning sink. *(The sink is an engine-free `Action<string>`-style callback on the loader — no UnityEngine console dependency in the core; see Implementation Notes.)*

---

## Implementation Notes

*Derived from ADR-0004 Implementation Guidelines:*

- **Assembly**: Two-assembly split (architecture decision 2026-08-12 — validated by unity-specialist; the story's original single-assembly premise was technically impossible because `Overdrive.Settings` referencing `Overdrive.Input` transitively inherits `UnityEngine.InputSystem`, making any "engine-free core" inside it engine-dependent):
  - `Overdrive.Settings.Core` (`Assets/source/Settings.Core/Overdrive.Settings.Core.asmdef`) — **engine-free, zero references** (`noEngineReferences: true`): persistence model (`GameSettingsData`), migration v1→v3, per-field validator, load cascade, `IPlayerPrefsStore` port, `SaveResult`, minimal hand-rolled JSON parser/serializer (no System.Text.Json/Newtonsoft/JsonUtility available; migration requires structural JSON access). Core defines its OWN PascalCase model — it does NOT parse into `Overdrive.Input.ControlProfile` (Input is Unity-dependent via InputSystem).
  - `Overdrive.Settings` (`Assets/source/Settings/Overdrive.Settings.asmdef`) — **Unity-backed**, references `Core` + `Overdrive.Input` + `Overdrive.Simulation`: `PlayerPrefsStore` adapter (implements `IPlayerPrefsStore` over `UnityEngine.PlayerPrefs`) + loader wiring (warning sink → `Debug.LogWarning`). Adapter maps `GameSettingsData` ↔ `Input.ControlProfile` (consuming `ControlProfile.Sanitize` for profile validation — NOT re-implemented).
  - Tests reference `Overdrive.Settings.Core` only → genuinely engine-free with fake store.
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
- **Save sequence** (ADR-0004:48, :62): serialize → validate → write backup → write primary → `Save()` → report Success. A backup-write or primary-write failure aborts Apply (returns `SaveResult != Success`), preserves last valid blob, retains working input, shows retryable save error (UI-owned). If primary fails after backup succeeds, attempt restore primary from backup; failure leaves backup intact for next-launch recovery.
- **Load cascade** (ADR-0004:204-210): read primary → if corrupt/missing try backup → if backup also corrupt/missing factory defaults + "Settings restored" message → migrate loaded blob to current version (sequential v1→v2→v3) → validate every field (non-finite NaN/Inf → per-field default).
- **Migration** (ADR-0004:88, GDD:88): v1 migrates `dead_zone` → `stick_dead_zone_inner`, applies defaults for stick outer threshold and per-action EMA alpha, discards unused vibration field. v2→v3 discards player-owned `trigger_dead_zone_inner` and `subtitles`. Every successful migration validated as version 3 before replacing primary. Never jump versions — process sequentially.
- **`SaveResult` enum**: `{ Success, BackupFailed, PrimaryFailed }` (ADR-0004:76).
- **Schema version**: `CurrentVersion = 3` (ADR-0004:80).
- **Per-field validation**: every numeric field validated; NaN/Inf → approved default (GDD:84, ADR-0004:44).
- **Warning sink** (AC-E4): the loader exposes an engine-free warning callback (`Action<string> warning`) — tests inject a recording sink to observe duplicate-binding warnings; the Unity adapter forwards it to `Debug.LogWarning`. No UnityEngine reference in the core.
- **Factory defaults ownership**: the six-category default model (difficulty, controls, audio, display, accessibility, camera — GDD settings.md:52-59) is defined by THIS story's core (the load contract). Stories 002-006 consume it; they do not re-define it.
- **Performance disposition**: No per-frame performance impact expected — persistence runs only during load and Apply (single JSON blob < 10 KB, one-time deserialize/validate/migrate); no gameplay-loop work is added. Tests use the fake store, not per-frame hooks.

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
- **AC-S3**: Given valid version-3 blob; When launch; Then values deserialize, validate, and are published to the consumer ports defined by this story's load contract. Edge: valid zero volume and boundary text scale remain valid. *(Runtime consumers across systems are mounted by their owning stories — not asserted here.)*
- **AC-S4**: Given corrupt primary and valid backup; When launch; Then backup loads. Given both corrupt; Then factory defaults load with restoration notice.
- **AC-S5**: Given backup or primary write fails; When Apply; Then Apply returns failure (`SaveResult != Success`), the last valid blob/backup remain recoverable, the working input is unchanged, and no defaults are substituted. *(Open/preview UI state is Story 002 — not asserted here.)*
- **AC-S6**: Given valid v1 blob; When migrate; Then v3 blob contains migrated stick values and EMA defaults, with vibration, trigger ownership, and subtitles removed.
- **AC-S7**: Given valid v2 blob; When migrate; Then v3 blob removes player trigger threshold/subtitles and preserves all supported values.
- **AC-E1**: Given simulated full WebGL storage; When Apply; Then Apply returns failure, prior primary/backup remain recoverable, and defaults are not substituted. *(Error presentation is UI-owned — not asserted here.)*
- **AC-E3**: Given unapplied working changes; When terminate/relaunch; Then last successful primary or backup loads, never the unapplied preview.
- **AC-E4**: Given duplicate external bindings; When load; Then first binding remains and second resets with a warning recorded by the injectable warning sink. Edge: duplicates involving reserved bindings are rejected rather than reassigned.

---

## Test Evidence

**Story Type**: Logic
**Performance disposition**: No per-frame performance impact expected — persistence runs only during load and Apply (single JSON blob < 10 KB, one-time deserialize/validate/migrate); no gameplay-loop work is added. Tests use the fake store, not per-frame hooks.
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/settings/SettingsPersistenceTests.cs` (fake IPlayerPrefsStore, engine-free — references `Overdrive.Settings.Core` only) + `Assets/tests/unit/settings/SettingsUnitTests.asmdef` — must exist and pass
- Integration evidence: PlayerPrefs adapter smoke test (real SetString/Save/get round-trip in EditMode) — `Assets/tests/integration/settings/SettingsPersistenceIntegrationTests.cs`

**Status**: [x] Created and passing
- Unit: `Assets/tests/unit/settings/SettingsPersistenceTests.cs` — 35 tests, `SettingsUnitTests` assembly (engine-free, references `Overdrive.Settings.Core` only)
- Integration: `Assets/tests/integration/settings/SettingsPersistenceIntegrationTests.cs` — 6 tests, `SettingsIntegrationTests` assembly (real PlayerPrefs round-trip + SettingsLoader end-to-end)
- Full suite: 489/489 PlayMode green (2026-08-12)

---

## Scope Note (2026-08-12)

- **Out-of-scope file touched**: `Assets/tests/unit/multiplayer/MultiplayerIsolationTests.cs` — the story 3-1 guardrail `AC4_OnlyKnownNonEditorGameplayAssemblies` hardcoded the 3 gameplay assemblies known at that time; this story adds 2 new non-editor assemblies (`Overdrive.Settings`, `Overdrive.Settings.Core`), so the guardrail was extended to the 5 known assemblies (fail-closed preserved — any undeclared assembly still fails). Renamed to reflect the set (not just "Three"). Valid coupling: the guardrail exists precisely to detect new assemblies.
- **QA edge deferred (AC-E4 reserved-binding rejection)**: the QA Test Cases edge "duplicates involving reserved bindings are rejected rather than reassigned" requires knowledge of WHICH binding ids are reserved — that is the Input binding catalog, delivered by Story 004 (rebinding flow). This story's core de-duplicates by path without a catalog seam; reserved-binding rejection lands with Story 004. Documented in the Completion Notes as a deferred QA edge, not a defect.

---

## Dependencies

- Depends on: None (first Settings story)
- Unlocks: Stories 002-006 (all consume the persistence core)

## Completion Notes
**Completed**: 2026-08-12
**Criteria**: 10/10 passing (0 deferred)
**Deviations**: ADVISORY — (1) AC-E4 reserved-binding QA edge deferred to Story 004 (catalog seam, TD-029); (2) out-of-scope file touched: `MultiplayerIsolationTests.cs` guardrail extended 3→5 known gameplay assemblies (valid coupling, fail-closed preserved).
**Test Evidence**: Logic — `Assets/tests/unit/settings/SettingsPersistenceTests.cs` (36 tests) + `Assets/tests/integration/settings/SettingsPersistenceIntegrationTests.cs` (6 tests); full suite 490/490 PlayMode green.
**Code Review**: Complete — unity-specialist APPROVED (R2) + qa-tester TESTABLE (R4, 4 rounds) + lead-programmer APPROVED WITH CONCERNS → all 3 concerns resolved (Save() helper extraction, ISettingsPersistence interface, codec per-category helpers); QL-TEST-COVERAGE ADEQUATE (R2).
**Tech Debt**: TD-027 (ADR-0004 camera drift), TD-028 (ADR-0004 BindingOverride drift), TD-029 (reserved-binding rejection → Story 004)
