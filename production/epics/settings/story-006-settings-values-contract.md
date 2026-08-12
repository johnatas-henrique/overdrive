# Story 006: Settings Values Contract (Audio/Accessibility/Camera)

> **Epic**: Settings
> **Status**: Ready
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

**Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS) | **Risk**: LOW (no engine APIs — pure value contract + validation)

**Engine Notes**: None.

**Control Manifest Rules (Foundation layer)**:
- Required: `show_chase_hud_in_cockpit` controls chase-overlay visibility without changing HUD data ownership — source: ADR-0004, ADR-0014
- Guardrail: Override precedence — Performance protection has highest runtime authority (may force VFX density to Low); Reduced Motion next forces camera shake, look-ahead, dynamic FOV, and Motion Blur off. Overrides never rewrite persisted preferences — source: GDD:114, ADR-0010

---

## Acceptance Criteria

*From GDD `design/gdd/settings.md`, scoped to this story (re-scoped per cross-epic verifiability — concrete Settings-owned contract criteria, NOT consumer behavior):*

- [ ] **AC-A1** (scoped): Given Master volume port, When change value, Then a typed audio update is emitted immediately. *(Audible mixer behavior deferred to Audio epic — TD-023.)*
- [ ] **AC-A2** (scoped): Given Music volume zero, When set positive, Then MusicSettings update requests resume. *(Audible playback proof deferred — TD-023.)*
- [ ] **AC-A3** (scoped): Given SFX volume zero, When apply preview, Then SFX channel value is zero. *(Mixer silence proof deferred — TD-023.)*
- [ ] **AC-A4** (scoped): Given Master and Music values, When change Music, Then only Music field/output command changes. *(Mixer isolation proof deferred — TD-023.)*
- [ ] **AC-A5** (scoped): Given any audio setting, When change, Then update is immediate and does not require restart. *(Audio runtime proof deferred — TD-023.)*
- [ ] **AC-AC1** (scoped): Given text scale .75, When apply preview, Then effective scale is 75%. *(Layout/clipping rendering deferred to HUD/UI.)*
- [ ] **AC-AC2** (scoped): Given text scale 2.0, When apply preview, Then effective scale is 200%. *(Reflow/scroll strategy deferred to HUD/UI.)*
- [ ] **AC-AC3** (scoped): Given selected colorblind mode, When apply, Then accessibility port emits selected palette to UI/HUD adapter.
- [ ] **AC-AC4** (scoped): Given critical state under each palette, When presentation model inspected, Then a label/pattern/shape cue remains in addition to color. *(Settings validates the model requirement is present in the emitted palette contract; rendering deferred.)*
- [ ] **AC-AC5** (scoped): Given accessibility value changed, When update, Then runtime preview changes immediately without restart.
- [ ] **AC-CAM1** (scoped): Given shake intensity, When change, Then camera settings port emits immediate intensity update.
- [ ] **AC-CAM2** (scoped): Given Reduced Motion off and no higher override, When toggle Motion Blur, Then VFX preference updates immediately.
- [ ] **AC-CAM3** (scoped): Given camera setting changed, When update, Then runtime update occurs without restart.
- [ ] **AC-CAM4** (scoped): Given Reduced Motion enabled, When resolve runtime preferences, Then shake/look-ahead/dynamic FOV/blur are suppressed while base FOV, mode transitions, collision avoidance, and saved preferences remain unchanged. *(Preference-resolution logic here; camera execution deferred.)*
- [ ] **AC-CAM5** (scoped — HUD-owned behavior): Given cockpit HUD preference On/Off, When resolve, Then the emitted preference is On by default; when Off, chase elements excluded. *(Eight-element overlay BEHAVIOR deferred to HUD epic.)*
- [ ] **AC-CAM6** (scoped): Given Motion Blur saved On, When enable then disable Reduced Motion, Then the saved player preference returns to On (not rewritten by the override). *(VFX execution evidence deferred.)*
- [ ] **AC-E5** (scoped): Given text scale exactly .75 and 2.0 (boundary), When applied, Then boundary values are accepted and validated. *(Rendering deferred.)*
- [ ] **AC-E7** (scoped): Given Music muted/volume zero, When unmute and set positive, Then stored volume is restored, not max, and a resume request is emitted. *(Audio playback proof deferred — TD-023.)*
- [ ] **AC-E10**: Given PerformanceReduced and Reduced Motion are both active, When rendering preferences are resolved, Then PerformanceReduced owns VFX density, Reduced Motion suppresses motion effects, and persisted player values remain unchanged.

---

## Implementation Notes

*Derived from ADR-0004 + ADR-0010 + ADR-0014 Implementation Guidelines:*

- **Concrete value contracts** (ADR-0004:103-133), reconciled per gate F12:
  ```csharp
  public readonly struct AudioSettings {
      public readonly float MasterVolume;  // 0.0-1.0, default 0.8
      public readonly float MusicVolume;   // 0.0-1.0, default 0.7
      public readonly float SfxVolume;     // 0.0-1.0, default 0.8
      public readonly float UiVolume;      // 0.0-1.0, default 0.6
      public readonly bool MuteMusic;      // GDD:77-80 — ADR-0004 omits; this story reconciles (adds to schema)
      public readonly bool MuteSfx;        // GDD:77-80 — same reconciliation
  }

  public readonly struct CameraSettings {
      public readonly bool ReducedMotion;         // SINGLE source of truth (ADR-0004:104-108)
      public readonly float ShakeIntensity;       // 0.0-2.0, default 1.0 (GDD:158)
      public readonly bool MotionBlur;            // default On (GDD:159)
      public readonly bool ShowChaseHudInCockpit; // default On (GDD:161) — TR-007
  }

  public readonly struct AccessibilitySettings {
      public readonly bool ReducedMotion;   // convenience access — DELEGATES to CameraSettings (ADR-0004:130-132)
      public readonly float TextScale;      // 0.75-2.0, default 1.0 (GDD:156 — ADR-0004 says 1.0-2.0; GDD wins, reconciled)
      public readonly ColorblindMode Mode;  // None/Protanopia/Deuteranopia/Tritanopia
  }

  public readonly struct VfxSettings {
      public readonly VfxQualityPreset Quality; // Low/Medium/High/Ultra (ADR-0004:110-114)
      // ReducedMotion NOT owned here — consumed from CameraSettings
  }
  ```
- **Schema reconciliation (gate F12)**: MuteMusic/MuteSfx added (GDD:77-80 has them; ADR-0004:116-121 omits). TextScale range 0.75-2.0 (GDD:156; ADR-0004:132 says 1.0-2.0 — GDD is authoritative, drift noted). Camera fields: this story uses GDD's player-owned camera settings (shake/motion blur/reduced motion/show-chase-hud); ADR-0004's FovSpeedMultiplier/LookAheadDistance are camera-epic internal fields, not player-owned — reconciled via doc note.
- **No competing ReducedMotion copies** (gate F12): VFX and Accessibility delegate to CameraSettings.ReducedMotion.
- **Override precedence (AC-E10, GDD:114, ADR-0010)**: resolved via an injected override-provider seam returning effective prefs. PerformanceReduced owns VFX density; ReducedMotion suppresses motion effects; persisted player values NEVER rewritten.
- **Typed ports**: AudioSettingsPort, AccessibilityPort, CameraSettingsPort, VfxSettingsPort — each emits typed update notifications on Working change (preview immediate); persistence untouched until Apply (Story 002).

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
- **AC-A2**: Given Music volume zero; When set positive; Then MusicSettings update requests resume. Audible playback proof deferred.
- **AC-A3**: Given SFX volume zero; When apply preview; Then SFX channel value is zero. Mixer silence proof deferred.
- **AC-A4**: Given Master and Music values; When change Music; Then only Music field/output command changes. Mixer isolation proof deferred.
- **AC-A5**: Given any audio setting; When change; Then update is immediate and does not require restart. Audio runtime proof deferred.
- **AC-AC1**: Given text scale .75; When apply preview; Then effective scale is 75% and layout reports no clipping. (Rendering deferred.)
- **AC-AC2**: Given text scale 2.0; When apply preview; Then effective scale is 200% and reflow/scroll strategy activates. (Rendering deferred.)
- **AC-AC3**: Given selected colorblind mode; When apply; Then accessibility port emits selected palette to UI/HUD adapter.
- **AC-AC4**: Given critical state under each palette; When inspect presentation model; Then label/pattern/shape cue remains in addition to color.
- **AC-AC5**: Given accessibility value changed; When update; Then runtime preview changes immediately without restart.
- **AC-CAM1**: Given shake intensity; When change; Then camera settings port emits immediate intensity update.
- **AC-CAM2**: Given Reduced Motion off and no higher override; When toggle Motion Blur; Then VFX preference updates immediately.
- **AC-CAM3**: Given camera setting changed; When update; Then runtime update occurs without restart.
- **AC-CAM4**: Given Reduced Motion enabled; When resolve runtime preferences; Then shake/look-ahead/dynamic FOV/blur are suppressed while base FOV, mode transitions, collision avoidance, and saved preferences remain unchanged.
- **AC-CAM5**: Given cockpit HUD preference On/Off; When render HUD; Then output requests eight Chase + four cockpit elements when On, four only when Off. Final HUD evidence deferred to HUD epic.
- **AC-CAM6**: Given Motion Blur saved On; When enable then disable Reduced Motion; Then runtime preference returns to On. VFX execution evidence deferred to VFX epic.
- **AC-E5**: Given text scale exactly .75 and 2.0; When apply; Then boundary values are accepted and layout remains valid.
- **AC-E7**: Given Music muted/volume zero; When unmute and set positive; Then stored volume is restored, not max, and resume request is emitted. Audio playback proof deferred.
- **AC-E10**: Given PerformanceReduced and Reduced Motion active; When resolve rendering preferences; Then PerformanceReduced owns VFX density, Reduced Motion owns motion suppression, and persisted player values are unchanged.

---

## Test Evidence

**Story Type**: Logic
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/settings/SettingsValueContractTests.cs` — value validation, defaults, override precedence, typed port emissions
- Integration: `Assets/tests/integration/settings/SettingsRuntimeIntegrationTests.cs` — edit-session integration with value ports

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (Settings Persistence & Migration) — DONE; Story 002 (EditSession — values flow through Working)
- Unlocks: Audio, HUD, Camera, VFX epics consume the value ports
