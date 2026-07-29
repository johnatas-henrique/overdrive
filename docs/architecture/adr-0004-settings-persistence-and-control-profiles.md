# ADR-0004: Settings Persistence and Control Profile Schema

## Status

Accepted

## Date

2026-07-27

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Core / Settings |
| **Knowledge Risk** | LOW — PlayerPrefs API is stable and unchanged across Unity 6 releases |
| **References Consulted** | `docs/engine-reference/unity/VERSION.md`, `design/gdd/settings.md`, `design/gdd/input-system.md`, `docs/architecture/architecture.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Schema migration v1→v3 test on existing PlayerPrefs blob |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (for Settings lifecycle — blocked during Countdown, available via Pause) |
| **Enables** | ADR-0005 (Input context controller consumes control profiles). Gameplay implementation (DifficultyProfile snapshotted at race init) |
| **Blocks** | None |
| **Ordering Note** | Schema migration logic must handle pre-existing PlayerPrefs blobs from development builds |

## Context

### Problem Statement

Settings serves 9 consumer systems (Input, Simulation, Audio, HUD, UI Menu, Camera, VFX, AI Rival, Vehicle Physics) with persistent preferences (volume, controls, quality, accessibility) and race-scoped configuration (DifficultyProfile). The persistence model must be atomic (no partial saves), support schema migration, and provide transactional preview (changes apply immediately at runtime but only persist on explicit Apply).

### Constraints

- Unity `PlayerPrefs` is the only persistence API available (no file IO, no database).
- PlayerPrefs stores strings only. Settings blob is serialized as JSON.
- Backup-first write: corrupt primary must not lose data.
- Schema migration: v1→v3 (current version is 3). Past versions must upgrade forward.
- DifficultyProfile is immutable per race — snapshotted at race initialization, never mutated mid-race.
- Control profiles (dead zones, EMA alphas, bindings) validated on load — invalid values fall back to approved defaults.

### Requirements

- Must support atomic backup-first write: serialize → validate → write backup → write primary
- Must support schema migration from v1 and v2 to v3
- Must support `SettingsEditSession` with snapshot (active), working (preview), and Apply/Cancel
- Must support 9 consumer systems reading setting values
- Must support `DisplayConfirm` (15s timer for resolution/fullscreen changes)
- Must support 5 DifficultyProfiles (Very Easy through Very Hard)
- Must support 4 QualityPresets (Low/Medium/High/Ultra)
- Must validate all numeric ranges (dead zones, EMA alphas, etc.)
- Must not allow Difficulty changes mid-race

## Decision

Settings uses **PlayerPrefs single JSON blob** with **backup-first write** and **transactional preview** (`SettingsEditSession`). Schema migration runs on load. Control profiles are validated per-field with fallback to approved defaults. DifficultyProfile is immutable snapshotted at race init.

### Key Interfaces

```csharp
// Persistence
public static class SettingsPersistence {
    private const string PrimaryKey = "OverdriveSettings";
    private const string BackupKey = "OverdriveSettings_Backup";

    public static string Load();          // reads backup if primary corrupt
    public static SaveResult Save(string json);  // backup-first atomic write
}

public enum SaveResult : byte { Success, BackupFailed, PrimaryFailed }

// Schema migration
public static class SettingsMigration {
    public const byte CurrentVersion = 3;
    public static string MigrateToCurrent(string json, byte fromVersion);
}

// Transactional preview
public class SettingsEditSession : IDisposable {
    public SettingsSnapshot Snapshot { get; }    // values at session start
    public SettingsWorking Working { get; }       // editable copy

    public ApplyResult Apply();    // persist Working, commit as new active profile
    public void Cancel();          // restore Snapshot to runtime
}

public readonly struct SettingsSnapshot {
    public readonly ControlProfile Control;
    public readonly AudioSettings Audio;
    public readonly DisplaySettings Display;
    public readonly AccessibilitySettings Accessibility;
    public readonly CameraSettings Camera;
    public readonly VfxSettings Vfx;
    public readonly DifficultyProfileId Difficulty;  // immutable per race
}

// Settings sub-structs
public readonly struct CameraSettings {
    public readonly bool ReducedMotion;          // source of truth — consumed by Camera, VFX
    public readonly float FovSpeedMultiplier;    // camera FOV response to speed
    public readonly float LookAheadDistance;     // chase camera look-ahead
}

public readonly struct VfxSettings {
    public readonly bool ReducedMotion => false; // reads from CameraSettings.ReducedMotion at runtime; stored as const
    public readonly VfxQualityPreset Quality;    // Low/Medium/High/Ultra
}

public readonly struct AudioSettings {
    public readonly float MasterVolume;          // 0.0–1.0
    public readonly float SfxVolume;             // 0.0–1.0
    public readonly float MusicVolume;           // 0.0–1.0
    public readonly float UiVolume;              // 0.0–1.0 (per ADR-0012 — 4 mixer groups)
}

public readonly struct DisplaySettings {
    public readonly int ResolutionWidth, ResolutionHeight;
    public readonly FullScreenMode ScreenMode;
    public readonly int RefreshRateNumerator, RefreshRateDenominator;  // for RefreshRate struct
    public readonly bool Vsync;
}

public readonly struct AccessibilitySettings {
    public readonly bool ReducedMotion;          // convenience access (delegates to CameraSettings)
    public readonly float TextScale;             // 1.0–2.0
}

// Control profile (the critical cross-system schema)
// TriggerDeadZoneInner is NOT player-owned — always overwritten from Input-owned tuning on load
// (v2→v3 migration discards the player-owned trigger value)
public struct ControlProfile {
    public float StickDeadZoneInner;   // 0.0–0.95, default 0.15
    public float StickDeadZoneOuter;   // > inner, ≤ 1.0, default 0.95
    public float AccelerateEmaAlpha;   // [0, 1], default 0.3. NaN/Inf → default
    public float BrakeEmaAlpha;        // [0, 1], default 0.3. NaN/Inf → default
    public float SteerEmaAlpha;        // [0, 1], default 0.5. NaN/Inf → default
    public BindingOverride[] Bindings; // per-action override slots
}

public readonly struct BindingOverride {
    public readonly Guid ActionId;     // stable after first shipped schema
    public readonly Guid BindingId;
    public readonly string Path;       // e.g. "<Keyboard>/w"
    public readonly bool IsReserved;   // true for Confirm, Cancel, Pause — cannot be rebound
}

// Settings-owned UI evaluator for dead-zone + EMA preview
// Does NOT read or write SimulationInput. Does NOT advance simulation.
// Called while Settings is open (game paused or in menu).
public class SettingsInputPreviewEvaluator {
    public float EvaluatePreview(float rawValue, ControlScheme scheme);
    // Same formulas as InputSystem per-tick routine, applied to a single axis
}
```

### State Machine

Settings has 5 states: **Closed**, **Open**, **Listening**, **BindingConflict**, **DisplayConfirm**. Only one `SettingsEditSession` can exist at a time (`Save` is non-reentrant; rapid open/close does not corrupt state).

DifficultyProfile data lives as **5 ScriptableObject assets** under `Assets/Settings/Difficulty/` — one per tier (Very Easy through Very Hard). Settings owns the assets. Simulation snapshots the resolved struct at race init via `Settings.GetProfile(id)`.

```
Closed → Open (menu or pause)
  Open → User edits Working (runtime previews immediately)
  Open → Listening (user clicked rebind slot)
  Listening → captured valid binding → BindingConflict (if key already used)
  Listening → captured reserved action (Confirm/Cancel/Pause) → rejected, return to Open
  BindingConflict → player overrides → Open
  BindingConflict → player cancels → Open
  Open → Apply: validate → serialize → write to backup key →
         if backup ok → write to primary key →
         if primary fails → attempt restore from backup →
         if restore fails → backup intact for next-launch recovery →
         Keep Settings open, retain working preview, show error
   Open → DisplayConfirm (resolution/fullscreen changes):
         Screen.SetResolution(w, h, FullScreenMode.FullScreenWindow,
             new RefreshRate { numerator = display.RefreshRateNumerator,
                               denominator = display.RefreshRateDenominator })
         Use `RefreshRate` struct exclusively. The overloads with `int preferredRefreshRate`
         are deprecated in Unity 6000.3 — `RefreshRate` struct is the correct API.
         DisplayConfirm → Keep → Apply (success, close)
         DisplayConfirm → Cancel → restore pre-preview
         DisplayConfirm → timeout (15s) → restore pre-preview
         DisplayConfirm → focus loss → restore pre-preview
  Open → Cancel → restore Snapshot → discard Working → Closed
  Open → Restore Defaults → DisplayConfirm (if resolution changed)

Countdown:
  Countdown active → Settings BLOCKED (no Open)
  Countdown paused → Open via Pause menu → Difficulty disabled
    (race owns immutable DifficultyProfile snapshot)

Race paused:
  Pause → Open → Difficulty disabled (race owns immutable snapshot)
  All other categories editable with same transactional model

Load cascade (when Settings blob is read):
  Read primary key
  If primary corrupt/missing → try backup key
  If backup also corrupt/missing → factory defaults + "Settings restored" message
  Migrate loaded blob to current version (sequential v1→v2→v3)
  Validate every field: non-finite (NaN/Inf) → fall back to approved default per field
```

## Alternatives Considered

### Alternative 1: Individual PlayerPrefs Keys

- **Description:** Each setting stored as its own PlayerPrefs key (~30+ keys).
- **Pros:** Simple reads. No serialization overhead.
- **Cons:** No atomicity (partial save on crash). No built-in migration. Hard to add new keys without stale keys accumulating.
- **Rejection Reason:** Atomicity and migration are requirements. Single blob with version field provides both.

### Alternative 2: JSON File on Disk

- **Description:** Write settings.json to `Application.persistentDataPath`.
- **Pros:** Human-readable. Not limited to PlayerPrefs string size.
- **Cons:** Requires file IO path handling. PlayerPrefs already handles cross-platform persistence for small blobs. No atomic write guarantee on all platforms.
- **Rejection Reason:** PlayerPrefs is simpler, already cross-platform, and the blob is under 10 KB. File IO adds no benefit for this scale.

## Consequences

### Positive

- **Atomic saves:** Backup-first write prevents data loss. Only one valid blob exists at any time.
- **Transactional preview:** Runtime immediately reflects edits; Apply is an explicit decision.
- **Schema evolution:** Version field + forward-only migration. Deprecated fields (v1 vibration, v2 subtitles) are discarded during migration, not carried forward.
- **Control profile validation:** Invalid persisted values per-field fall back to defaults. A corrupted dead-zone value never locks player input.
- **Difficulty immutability:** Race fairness guaranteed — no mid-race difficulty cheating.
- **9 consumer systems:** Single `SettingsSnapshot` value type consumed by all. No per-system parsing.

### Negative

- **Blob size:** Single PlayerPrefs string up to 1 MB on some platforms. Settings blob is ~5 KB. No concern.
- **Migration testing:** Each schema version must be tested against the migration pipeline. v1 and v2 blobs must be preserved in test fixtures.
- **No per-field granularity:** Changing one value rewrites the entire blob. At ~5 KB this is irrelevant.

### Risks

- **PlayerPrefs corruption on mobile/WebGL:** Rare but documented. Mitigation: Backup-first write and CRC validation on load.
- **Schema version gap:** If a user skips two versions (v1→v3 directly), the migration must chain through v2 logic. Mitigation: Migration pipeline processes each version sequentially, not by jump.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| settings.md | PlayerPrefs blob "OverdriveSettings" + backup | SettingsPersistence with PrimaryKey/BackupKey and atomic write |
| settings.md | Schema migration v1→v3 | SettingsMigration with sequential version processing |
| settings.md | Snapshot/working/preview model | SettingsEditSession with Apply/Cancel/IDisposable |
| settings.md | Control profile validation (stick inner < outer, EMA in [0,1]) | Per-field validation with fallback to approved defaults |
| settings.md | Difficulty immutable per race | DifficultyProfileId snapshotted at race init |
| settings.md | DisplayConfirm 15s timer | Separate DisplayConfirm flow within EditSession |
| input-system.md | Binding IDs stable after first shipped schema | BindingOverride uses Guid ActionId + BindingId |
| simulation-architecture.md | Settings blocked during active Countdown | Lifecycle integration per ADR-0001 |

## Validation Criteria

- [ ] Backup-first atomic write: simulate crash between backup write and primary write — primary is recoverable from backup
- [ ] PrimaryFailed recovery: if backup succeeded, attempt restore from backup. If restore also fails, backup stays intact for next-launch recovery.
- [ ] Load cascade: primary corrupt → try backup → backup also corrupt → factory defaults + "Settings restored" message
- [ ] Schema migration: v1 blob → v3 blob (dead_zone→stick_dead_zone_inner, discard vibration, discard subtitles)
- [ ] Control profile validation: inner > outer or NaN/Inf → both fall back to defaults
- [ ] Reserved bindings (Confirm, Cancel, Pause) rejected during Listening — cannot be rebound, replaced, or removed
- [ ] Unsupported resolution → fall back to nearest supported, show warning, no crash
- [ ] Transactional preview: Audio slider change heard immediately; Cancel restores previous volume
- [ ] Difficulty immutability: change difficulty during Paused → next race uses new value, current race unaffected
- [ ] DisplayConfirm: 15s timer elapses → restore pre-preview resolution
- [ ] PlayerPrefs blob human-readable (JSON schema stable across game versions)

## Related Decisions

- ADR-0001: Manual Simulation Authority (Countdown Settings block, Pause flow)
- ADR-0005: Input Context Controller & Action Map Inventory (consumes ControlProfile)
