# Story 006: Settings Values Contract (Audio/Accessibility/Camera)

> **Epic**: Settings
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: M (4-5h)

## Context

**GDD**: `design/gdd/settings.md`
**Requirement**: `TR-settings-007`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0004: Settings Persistence and Control Profile Schema; ADR-0010: Camera/VFX Rendering Budget and Interpolation; ADR-0014: HUD Data Contract and Layout
**ADR Decision Summary**: Settings exposes per-system setting values via typed ports; runtime application (audio output, HUD rendering, camera/VFX effects) belongs to the consuming epics (Audio, HUD, Camera, VFX). CameraSettings is the source of truth for ReducedMotion (VFX/Accessibility delegate to it). `show_chase_hud_in_cockpit` controls chase-overlay visibility without changing HUD data ownership.

**Engine**: Unity 6000.3.22f1 (Unity 6.3 LTS) | **Risk**: LOW (no engine APIs — pure value contract + validation)

**Engine Notes**: None.

**Control Manifest Rules (Foundation layer)**:
- Required: `show_chase_hud_in_cockpit` controls chase-overlay visibility without changing HUD data ownership — source: ADR-0004, ADR-0014
- Guardrail: Override precedence — Performance protection has highest runtime authority (may force VFX density to Low); Reduced Motion next forces camera shake, look-ahead, dynamic FOV, and Motion Blur off. Overrides never rewrite persisted preferences — source: GDD:114, ADR-0010

---

## Acceptance Criteria

*From GDD `design/gdd/settings.md`, scoped to this story (re-scoped per cross-epic verifiability — concrete Settings-owned contract criteria, NOT consumer behavior):*

- [ ] **AC-A1** (scoped): Given Master volume port, When change value, Then a typed audio update is emitted immediately. *(Audible mixer behavior deferred to Audio epic — TD-023.)*
- [ ] **AC-A2** (scoped): Given Music muted (MuteMusic true, stored volume preserved), When unmute and set positive, Then the emitted AudioSettingsUpdate carries MuteMusic false and the STORED MusicVolume — a typed resume signal. *(Audible playback proof deferred — TD-023.)*
- [ ] **AC-A3** (scoped): Given SFX volume zero, When apply preview, Then SFX channel value is zero. *(Mixer silence proof deferred — TD-023.)*
- [ ] **AC-A4** (scoped): Given Master and Music values, When change Music, Then the emitted AudioSettingsUpdate preserves MasterVolume while changing MusicVolume (full-payload emission; consumers observe the field delta). *(Mixer isolation proof deferred — TD-023.)*
- [ ] **AC-A5** (scoped): Given any audio setting, When change, Then the typed update is emitted synchronously on Working change and the store is untouched (no persistence mutation). *(Audio runtime proof deferred — TD-023.)*
- [ ] **AC-AC1** (scoped): Given text scale .75, When apply preview, Then the emitted AccessibilityUpdate carries TextScale 0.75. *(Layout/clipping rendering deferred to HUD/UI.)*
- [ ] **AC-AC2** (scoped): Given text scale 2.0, When apply preview, Then the emitted AccessibilityUpdate carries TextScale 2.0. *(Reflow/scroll strategy deferred to HUD/UI.)*
- [ ] **AC-AC3** (scoped): Given selected colorblind mode, When apply, Then AccessibilitySettingsPort emits a typed AccessibilityUpdate whose Cues are the per-state palette for the selected mode (PaletteCue list covering Critical/Warning/Normal — the metadata is contract-owned and structurally identical across modes; the color component differs per mode and is deferred, not modeled).
- [ ] **AC-AC4** (scoped): Given critical state under each palette, When the palette contract is inspected, Then each PaletteCue carries a label plus pattern/shape cue metadata (Settings validates the metadata is present for every critical state; rendering deferred).
- [ ] **AC-AC5** (scoped): Given accessibility value changed, When update, Then the typed update is emitted immediately on Working change without persistence mutation.
- [ ] **AC-CAM1** (scoped): Given shake intensity, When change, Then camera settings port emits immediate intensity update.
- [ ] **AC-CAM2** (scoped): Given Reduced Motion off and no higher override, When toggle Motion Blur, Then the emitted CameraSettingsUpdate carries the new MotionBlur value. *(VFX runtime consumption deferred.)*
- [ ] **AC-CAM3** (scoped): Given camera setting changed, When update, Then the camera port emits the typed update synchronously on Working change.
- [ ] **AC-CAM4** (scoped): Given Reduced Motion enabled and no higher override, When resolve runtime preferences via the override resolver, Then the resolved RuntimePreferences suppress shake/motion-blur/dynamic-FOV while the SAVED CameraSettings input remains bit-identical (pure merge over readonly inputs — the resolver has no persistence path and never mutates the saved snapshot; base FOV, mode transitions, and collision avoidance are camera-epic internals outside this contract). *(Preference-resolution logic here; camera execution deferred.)*
- [ ] **AC-CAM5** (scoped — Settings-owned): Given cockpit HUD preference, When resolve, Then the emitted CameraSettingsUpdate carries ShowChaseHudInCockpit default On; when Off, the preference is emitted as Off. *(Eight-element overlay BEHAVIOR deferred to HUD epic.)*
- [ ] **AC-CAM6** (scoped): Given Motion Blur saved On, When resolve with Reduced Motion enabled then disabled, Then the resolved MotionBlurEffective returns to On — the SAVED preference is never rewritten by the override. *(VFX execution evidence deferred.)*
- [ ] **AC-E5** (scoped): Given text scale exactly .75 and 2.0 (boundary), When applied, Then boundary values are accepted and validated. *(Rendering deferred.)*
- [ ] **AC-E7** (scoped): Given Music muted with stored volume 0.7, When unmute and set positive, Then the emitted AudioSettingsUpdate carries the STORED volume (0.7), not max, with MuteMusic false — a typed resume signal. *(Audio playback proof deferred — TD-023.)*
- [ ] **AC-E10**: Given PerformanceReduced and Reduced Motion are both active, When rendering preferences are resolved via the override resolver, Then the resolved RuntimePreferences have EffectiveVfxDensity forced to Low by PerformanceReduced, motion effects suppressed by ReducedMotion, and persisted player values remain unchanged.

---

## Implementation Notes

*Derived from ADR-0004 + ADR-0010 + ADR-0014 Implementation Guidelines:*

- **Concrete value contracts** (gate R3 — unified: the SHIPPED Story 001 models `AudioData`/`CameraData`/`AccessibilityData` ARE the persisted schema; the `*Update` payloads below ARE the value contracts emitted by the ports; fields mirror the shipped models 1:1 — no re-schema, no duplicate struct names):
  ```csharp
  // Value contract payloads (Overdrive.Settings.Core, engine-free) — emitted by the ports:
  public readonly struct AudioSettingsUpdate {
      public readonly float MasterVolume;  // 0.0-1.0, default 0.8 (GDD:146)
      public readonly float MusicVolume;   // 0.0-1.0, default 0.7 (GDD:147) — ALWAYS the STORED volume; mute never zeros it
      public readonly float SfxVolume;     // 0.0-1.0, default 0.8 (GDD:148)
      public readonly float UiVolume;      // 0.0-1.0, default 0.6 (GDD:149)
      public readonly bool MuteMusic;      // default false
      public readonly bool MuteSfx;        // default false
  }

  public readonly struct CameraSettingsUpdate {
      public readonly bool ReducedMotion;         // SINGLE source of truth (ADR-0004:104-108)
      public readonly float ShakeIntensity;       // 0.0-2.0, default 1.0 (GDD:158)
      public readonly bool MotionBlur;            // default On (GDD:159)
      public readonly bool ShowChaseHudInCockpit; // default On (GDD:161, ADR-0014) — TR-007
  }

  public readonly struct AccessibilityUpdate {
      public readonly bool ReducedMotion;   // RESOLVED at emission from CameraSettings (passed into Publish) — never stored
      public readonly float TextScale;      // 0.75-2.0, default 1.0 (GDD:156 — ADR-0004 says 1.0-2.0; GDD wins, reconciled)
      public readonly ColorblindMode Mode;  // None/Protanopia/Deuteranopia/Tritanopia
      public readonly PaletteCue[] Cues;    // per-state palette with cue metadata (AC-AC3/AC-AC4)
  }

  // VFX quality uses the EXISTING enum QualityPresetId (Low/Medium/High/Ultra/Custom) — no new enum.
  // ASSEMBLY DECISION (gate R4): QualityPresetId and VfxDensityLevel MOVE from Overdrive.Settings
  // (DisplayContracts.cs, 3-6) to Overdrive.Settings.Core — they are pure domain enums with no Unity
  // dependency, and the VfxSettingsPort/resolver in Core must reference them. Cross-story refactor:
  // 3-6 files (DisplayContracts, QualityPresetApplier, DisplaySettingsOrchestrator + tests) update
  // refs via using — same pattern as CancelActiveConfirmation (3-6 R14). Factory default is
  // platform-dependent: High on PC, Medium on WebGL (GDD). QualityPresetId.Custom is the VSync
  // override marker (3-6).
  ```
- **Schema reconciliation (gate F12)**: MuteMusic/MuteSfx added (GDD:77-80 has them; ADR-0004:116-121 omits). TextScale range 0.75-2.0 (GDD:156; ADR-0004:132 says 1.0-2.0 — GDD is authoritative, drift noted). Camera fields: this story uses GDD's player-owned camera settings (shake/motion blur/reduced motion/show-chase-hud); ADR-0004's FovSpeedMultiplier/LookAheadDistance are camera-epic internal fields, not player-owned — reconciled via doc note.
- **No competing ReducedMotion copies** (gate F12): VFX and Accessibility delegate to CameraSettings.ReducedMotion — the stored structs never duplicate it; only the emitted AccessibilityUpdate carries the resolved value (see ports below).
- **Typed ports** (gate R2 — concrete engine-free classes in Overdrive.Settings.Core; pure mappers from the session Working to typed payloads; the SettingsEditSession from Story 002 owns the subscription — on WorkingChanged (Working copy replaced) the session calls each port's Publish; emission is synchronous, per-category, and never persists — persistence is Apply-only):
  ```csharp
  public sealed class AudioSettingsPort {
      public event Action<AudioSettingsUpdate> Updated;
      public void Publish(AudioData working); // maps AudioData → AudioSettingsUpdate, raises Updated
  }
  public sealed class AccessibilitySettingsPort {
      public event Action<AccessibilityUpdate> Updated;
      public void Publish(AccessibilityData working, bool cameraReducedMotion);
      // TextScale + Mode + Cues from AccessibilityData; ReducedMotion resolved from CameraSettings (passed in) at emission
  }
  public sealed class CameraSettingsPort {
      public event Action<CameraSettingsUpdate> Updated;
      public void Publish(CameraData working); // maps CameraData → CameraSettingsUpdate
  }
  public sealed class VfxSettingsPort {
      public event Action<QualityPresetId> Updated;
      public void Publish(QualityPresetId working); // uses the existing 3-6 enum (Low/Medium/High/Ultra/Custom)
  }
  ```
- **Session wiring** (gate R3/R4/R5 + unity-specialist consultant — concrete against the shipped session): `SettingsEditSession` (Story 002) has a PRIVATE constructor and a static 5-arg `TryOpen(blobService, lifecycle, displayConfirm, warningSink, currentSession, out result)`. C# forbids optional parameters before a required `out` parameter, so this story uses an **overload pair**: the existing 5-arg `TryOpen` (unchanged, delegates to the new one with null ports — source-compatible for existing callers) plus a new full overload `TryOpen(blobService, lifecycle, displayConfirm, warningSink, currentSession, out result, AudioSettingsPort? audio, AccessibilitySettingsPort? accessibility, CameraSettingsPort? camera, VfxSettingsPort? vfx)` — nullable reference types signal null-safety at the call site; a null port is a no-op publisher (guard: null is allowed, never throws ArgumentNullException for ports). The private ctor stores the ports; the session exposes `AudioSettingsPort Audio`, `AccessibilitySettingsPort Accessibility`, `CameraSettingsPort Camera`, `VfxSettingsPort Vfx` as readonly properties. On `WorkingChanged` (SetValue / Apply-preview) the session publishes the PORTS in a fixed order — **Camera → Accessibility (ReducedMotion resolved from the just-published camera Working) → Audio → Vfx** — while the LEGACY `WorkingChanged` per-category events keep firing exactly as before (Story 002 behavior preserved; port publication is additive). VFX has no `SettingsCategory` — the session converts `working.Display.QualityPreset` (int) to `QualityPresetId` (0=Low, 1=Medium, 2=High, 3=Ultra) and calls `Vfx.Publish(...)`; out-of-range (outside 0..3) and Custom are rejected at the Display SetValue guard / fall back to Medium (1) at load (gate R5). The session NEVER persists on emission — persistence is Apply-only (Story 002).
  **RestoreDefaults batch mode** (consultant BLOCKING — RestoreDefaults calls SetValue 5× sequentially, which would publish the ports 5× with partially-updated Working): add a `_suppressPortPublishing` flag — set before the SetValue cascade, cleared after; the ports publish ONCE after all categories are set, in Camera→Accessibility→Audio→Vfx order, so the accessibility ReducedMotion is always fresh. Legacy per-category WorkingChanged events still fire per SetValue (Story 002 behavior untouched).
  **Re-entrancy guard** (consultant REQUIRED): a `_isPublishing` flag — a port `Updated` handler that calls back into the session (SetValue/TryOpen/Apply during publication) throws `InvalidOperationException` (consistent with the ArgumentOutOfRangeException guard pattern from Story 003).
- **Working → payload mapping** (gate R2 — the value structs mirror the shipped Story 001 models field-for-field; no re-schema):
  - `AudioData(master, music, sfx, ui, muteMusic, muteSfx)` → `AudioSettingsUpdate` same fields. `MusicVolume` is ALWAYS the STORED volume — mute never zeros it; `MuteMusic` is the flag the mixer consumes. Unmute (AC-E7) = re-emit with `MuteMusic=false` and the stored `MusicVolume` intact.
  - `CameraData(shakeIntensity, motionBlur, reducedMotion, showChaseHudInCockpit)` → `CameraSettingsUpdate` same fields.
  - `AccessibilityData(colorblindMode int, textScale)` → `AccessibilityUpdate`: `ColorblindMode` enum mapped 0=None, 1=Protanopia, 2=Deuteranopia, 3=Tritanopia; `TextScale` passed through; `Cues` built per-mode (see palette contract); `cameraReducedMotion` passed into `ReducedMotion` (resolved, not stored).
- **Palette state set + per-mode mapping** (gate R2 — AC-AC3/AC-AC4):
  ```csharp
  public static class PaletteStateIds {
      public const string Critical = "critical";
      public const string Warning = "warning";
      public const string Normal = "normal";
  }
  // Every emitted AccessibilityUpdate.Cues MUST contain at least Critical, Warning, Normal,
  // each with a non-empty Label AND at least one cue (HasPatternCue || HasShapeCue) — AC-AC4
  // holds for EVERY ColorblindMode including None. Per-mode palettes differ ONLY in the color
  // component (not modeled here — color rendering is deferred); the cue METADATA is
  // contract-owned and structurally identical across modes (gate R4: the port maps each
  // ColorblindMode to its PaletteCue[] — construction is a per-mode lookup, not a color computation).
  ```
- **Typed value contract payloads** (gate R3 — canonical single declaration, see Concrete value contracts above for domains/defaults):
  ```csharp
  public enum ColorblindMode { None, Protanopia, Deuteranopia, Tritanopia }
  public readonly struct PaletteCue {
      public readonly string StateId;      // "critical" | "warning" | "normal" (PaletteStateIds)
      public readonly string Label;        // label/name cue beyond color (AC-AC4)
      public readonly bool HasPatternCue;  // pattern cue present beyond color (AC-AC4)
      public readonly bool HasShapeCue;    // shape cue present beyond color (AC-AC4)
  }
  ```
- **Override resolution seam** (gate R1/R4 — AC-CAM4/AC-CAM6/AC-E10): pure injected resolver, no persistence mutation:
  ```csharp
  public readonly struct OverrideState {
      public readonly bool PerformanceReduced;    // forces EFFECTIVE VFX DENSITY to Low (GDD:114 — density, not the whole preset)
      public readonly bool ReducedMotionOverride; // suppresses motion effects
  }
  public readonly struct RuntimePreferences {
      public readonly bool ReducedMotionEffective;
      public readonly float ShakeIntensityEffective; // 0 when suppressed
      public readonly bool MotionBlurEffective;
      public readonly bool DynamicFovSuppressed;
      public readonly bool LookAheadSuppressed;      // GDD:114/ADR-0010 — reduced motion also suppresses look-ahead
      public readonly QualityPresetId SavedVfxQuality;    // unchanged — the player's saved preset
      public readonly VfxDensityLevel EffectiveVfxDensity; // Low when PerformanceReduced; else mapped from saved preset (3-6 mapping)
  }
  public interface IRuntimePreferenceResolver {
      RuntimePreferences Resolve(CameraSettingsUpdate saved, QualityPresetId savedVfx, OverrideState overrides);
  }
  // TRUTH TABLE (gate R4/R5 — explicit):
  //   ReducedMotionEffective      = overrides.ReducedMotionOverride || saved.ReducedMotion
  //   ShakeIntensityEffective     = 0 if ReducedMotionEffective else saved.ShakeIntensity
  //   MotionBlurEffective         = !ReducedMotionEffective && saved.MotionBlur
  //   DynamicFovSuppressed        = ReducedMotionEffective
  //   LookAheadSuppressed         = ReducedMotionEffective
  //   EffectiveVfxDensity         = Low if overrides.PerformanceReduced else density from savedVfx (identity mapping, below)
  //   SavedVfxQuality             = savedVfx (always the unchanged persisted preset)
  // PRESET→DENSITY mapping (gate R5 — explicit, from the 3-6 QualityPresetMapping): Low→Low, Medium→Medium,
  // High→High, Ultra→Ultra (identity). QualityPresetId.Custom (the 3-6 VSync marker) is never persisted
  // and never reaches the resolver — it is rejected at the session Display guard and the load validator
  // falls back to Medium (1).
  // No override active → passthrough of saved values; saved inputs are readonly and never mutated.
  ```
- **Stored-volume/unmute semantics (AC-E7)**: the port emits the STORED MusicVolume (whatever non-zero value was persisted before mute), never max, with MuteMusic false — the typed resume signal is the re-emission itself.
- **Domain validation** (gate R3 — two distinct paths, no contradiction): LOAD path (SettingsValidator, Story 001) — non-finite numbers → factory default, applied during the load cascade; SET-VALUE path (this story's category guards) — out-of-range values THROW `ArgumentOutOfRangeException` and the Working is left untouched: TextScale outside 0.75-2.0 (boundaries .75 and 2.0 accepted — AC-E5), invalid ColorblindMode enum value, ShakeIntensity outside 0-2. Same guard pattern as DifficultySelection.RequireDifficulty (Story 003). No clamping anywhere — rejection is explicit.
- **Defaults reconciliation (gate R2/R4/R5 + unity-specialist consultant — this story owns the value contract, so it corrects the shipped Story 001 factory defaults, the validator fallbacks, AND the codec fallbacks to the GDD)**: `AudioData.Default` (1f/1f/1f/1f) → GDD:146-149 (Master 0.8, Music 0.7, SFX 0.8, UI 0.6); `CameraData.Default.ShakeIntensity` (0.5) → GDD:158 (1.0); `CameraData.Default.ShowChaseHudInCockpit` (false) → GDD:161/ADR-0014 (On — cockpit is default/primary); `SettingsValidator` fallbacks (SettingsValidator.cs:33-40) AND `SettingsJsonCodec` DeserializeAudio/DeserializeCamera fallbacks updated to the same values so load-path defaults match the contract (the shipped `Codec_MissingCategoryObjectsUseDefaults` test would otherwise break after `*.Default` changes). **Validator shake_intensity max is 1.0 today — must become 2.0** (consultant BLOCKING: the validator would silently destroy player values 1.5–2.0 on reload; validator max 2.0 + fallback 1.0; codec fallback 1.0). `AccessibilityData.Default` (colorblindMode 0, TextScale 1.0) already matches. Existing tests compare against `*.Default` relatively, so the correction is non-breaking.

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- Audible audio output → Audio epic (TD-023, ADR-0012)
- Text rendering/clipping/reflow → HUD/UI epics
- Camera shake/look-ahead/dynamic-FOV execution → Camera epic (ADR-0010)
- VFX density/motion-blur execution → VFX epic (ADR-0010)
- AC-CAM5 chase-overlay BEHAVIOR → HUD epic (ADR-0014)
- Settings menu screen UI → UI Menu epic

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate, round 3). The developer implements against these — do not invent new test cases during implementation.*

- **AC-A1**: Given Master volume port; When change value; Then typed audio update is emitted immediately. Audible mixer behavior deferred to Audio epic/TD-023.
- **AC-A2**: Given Music muted (stored volume preserved); When unmute and set positive; Then the emitted AudioSettingsUpdate carries MuteMusic false and the STORED MusicVolume. Audible playback proof deferred.
- **AC-A3**: Given SFX volume zero; When apply preview; Then SFX channel value is zero. Mixer silence proof deferred.
- **AC-A4**: Given Master and Music values; When change Music; Then only Music field/output command changes. Mixer isolation proof deferred.
- **AC-A5**: Given any audio setting; When change; Then the typed update is emitted synchronously on Working change; no persistence mutation. Audio runtime proof deferred.
- **AC-AC1**: Given text scale .75; When apply preview; Then the emitted AccessibilityUpdate carries TextScale 0.75. (Rendering deferred.)
- **AC-AC2**: Given text scale 2.0; When apply preview; Then the emitted AccessibilityUpdate carries TextScale 2.0. (Rendering deferred.)
- **AC-AC3**: Given selected colorblind mode; When apply; Then AccessibilitySettingsPort emits a typed AccessibilityUpdate whose Cues cover Critical/Warning/Normal for the selected mode.
- **AC-AC4**: Given critical state under each palette; When inspect the palette contract; Then each PaletteCue carries a label plus pattern/shape cue metadata.
- **AC-AC5**: Given accessibility value changed; When update; Then the typed update is emitted immediately on Working change without persistence mutation.
- **AC-CAM1**: Given shake intensity; When change; Then camera settings port emits immediate intensity update.
- **AC-CAM2**: Given Reduced Motion off and no higher override; When toggle Motion Blur; Then the emitted CameraSettingsUpdate carries the new MotionBlur value.
- **AC-CAM3**: Given camera setting changed; When update; Then the camera port emits the typed update synchronously on Working change.
- **AC-CAM4**: Given Reduced Motion enabled; When resolve runtime preferences via the override resolver; Then shake/motion-blur/dynamic-FOV are suppressed while the SAVED CameraSettings input remains bit-identical (pure merge — no persistence path).
- **AC-CAM5**: Given cockpit HUD preference; When resolve; Then the emitted CameraSettingsUpdate carries ShowChaseHudInCockpit default On. Final HUD element rendering deferred to HUD epic.
- **AC-CAM6**: Given Motion Blur saved On; When resolve with Reduced Motion enabled then disabled; Then the resolved MotionBlurEffective returns to On — the SAVED preference is never rewritten. VFX execution evidence deferred to VFX epic.
- **AC-E5**: Given text scale exactly .75 and 2.0; When apply; Then boundary values are accepted and validated.
- **AC-E7**: Given Music muted with stored volume 0.7; When unmute and set positive; Then the emitted AudioSettingsUpdate carries the STORED volume (0.7), not max, with MuteMusic false. Audio playback proof deferred.
- **AC-E10**: Given PerformanceReduced and Reduced Motion active; When resolve rendering preferences; Then EffectiveVfxDensity is forced to Low by PerformanceReduced, motion effects are suppressed by ReducedMotion, and the persisted player values remain unchanged (the resolver never persists).

---

## Test Evidence

**Story Type**: Logic
**Performance disposition**: No per-frame performance impact expected — the value contracts, override resolution, and typed port emissions are menu-time and session-init one-shot computations on immutable readonly structs; they never run in the gameplay loop (the ports publish on Working change, which happens only while the Settings screen is open). Override resolution (AC-CAM4/E10) is a pure preference merge executed once per apply, not per frame.
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/settings/SettingsValuesContractTests.cs` — value validation, defaults, override precedence, typed port emissions
- Integration: `Assets/tests/integration/settings/SettingsRuntimeIntegrationTests.cs` — edit-session integration with value ports

**Status**: [x] Created — 66 unit tests (SettingsValuesContractTests.cs) + 5 integration (SettingsRuntimeIntegrationTests.cs) — suite 785/785 green (code review complete: qa-tester TESTABLE + unity-specialist APPROVED)

---

## Dependencies

- Depends on: Story 001 (Settings Persistence & Migration) — DONE; Story 002 (EditSession — values flow through Working)
- Unlocks: Audio, HUD, Camera, VFX epics consume the value ports

---

## Completion Notes

**Completed**: 2026-08-14
**Criteria**: 19/19 passing (0 deferred)
**Deviations**: ADVISORY — audio/HUD/camera/VFX runtime deferred to consuming epics (TD-023, documented per-AC); defaults reconciled to GDD over draft-era ADR-0004 (TD-027/028/031 pattern); enums moved to Core — cross-story refs updated in 3-6 files (DisplayContracts, QualityPresetApplier, DisplaySettingsIntegrationTests)
**Test Evidence**: Logic — 66 unit (SettingsValuesContractTests.cs) + 5 integration (SettingsRuntimeIntegrationTests.cs); suite 785/785 green, zero regressions
**Code Review**: Complete — 6 rounds qa-tester (TESTABLE) + unity-specialist (APPROVED); 8 production defects fixed (SafePublish, _pendingDisplay full payload, monotonic version, NaN guards, IsOpen on all 5 publication sites, recursion guard, reentrancy guards incl. Dispose, LogWarning double-fault)
**Gates**: QL-TEST-COVERAGE ADEQUATE (19/19 mutation-adequate) + LP-CODE-REVIEW APPROVED (0 blockers, 2 non-blocking suggestions → TD-036/TD-037)
**Tech debt logged**: TD-036 (AccessibilityUpdate.Cues as IReadOnlyList), TD-037 (ToQualityPresetId explicit case 3) — 2 items this story
**Cross-story scope**: enum move (QualityPresetId/VfxDensityLevel → Core) touched 3-6 Unity-backed files; shipped 2-field BindingOverride contract governs (TD-028)
**Next recommended**: Story 3-8 Content Groups & Address Mirror (production/epics/content-pipeline/story-001-content-groups-address-mirror.md)
