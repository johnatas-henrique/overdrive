# Story 007: Quality Profiles (WebGL)

> **Epic**: Content Pipeline
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: M (3-4h)

## Context

**GDD**: `design/gdd/content-pipeline.md`
**Requirement**: TR-content-005 (dependent — measured budgets deferred to TD-026)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0003: Content Pipeline and Addressables; ADR-0010: Camera/VFX Rendering Budget and Interpolation
**ADR Decision Summary**: Settings owns the selected/default quality preset (Medium WebGL, High PC, Low explicit fallback). Content applies ONLY the texture mipmap policy (`QualitySettings.globalTextureMipmapLimit`). URP/VFX owns post-processing and render-scale behavior. Cross-story integration proves Settings preset → URP/VFX applier + Content mipmap policy.

**Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS) | **Risk**: LOW

**Engine Notes**: `QualitySettings.globalTextureMipmapLimit` per quality level (GDD QP1/QP2). URP render pipeline asset configuration owned by Settings Story 005's `IQualityPresetApplier`.

**Control Manifest Rules (Foundation layer)**:
- Required: 5 DifficultyProfiles + 4 QualityPresets (Low/Medium/High/Ultra) — source: ADR-0004 (Settings epic)
- Guardrail: Performance protection has highest runtime authority (may force VFX density to Low) — source: GDD:114, ADR-0010

---

## Acceptance Criteria

*From GDD `design/gdd/content-pipeline.md`, scoped to this story (QP1/QP2 split — gate NEW-05):*

- [ ] **AC-QP1a (Content-owned)**: Given Settings provides quality = Low (WebGL), When content loads, Then car textures use lower resolution via `QualitySettings.globalTextureMipmapLimit` for the Low quality level.
- [ ] **AC-QP2a (Content-owned)**: Given Settings provides quality = High (PC), When content loads, Then car textures use full resolution via `QualitySettings.globalTextureMipmapLimit` = 0 for the High quality level.
- [ ] **AC-WG5**: Given WebGL build, When quality settings load, Then Medium profile applies by default; Low profile is available as the memory/performance fallback.
- [ ] **Cross-story integration**: Given a Settings quality preset selection, When applied, Then the URP/VFX applier (Settings Story 005 IQualityPresetApplier) AND the Content mipmap policy both take effect consistently, including runtime fallback overrides (PerformanceReduced → Low density).

*(AC-QP1b/QP2b — post-processing + render-scale — owned by Settings Story 005; URP/VFX owns execution. Cross-referenced, not duplicated.)*

---

## Implementation Notes

*Derived from ADR-0003 + ADR-0010 + Settings Story 005:*

- **`IQualityProfileSource` port** (gate F11):
  ```csharp
  public interface IQualityProfileSource {
      QualityPresetId Current { get; }  // Low/Medium/High/Ultra
  }
  ```
  Settings Story 005 (Display Confirm & Quality Presets) owns the source (its IQualityPresetApplier); Content consumes `IQualityProfileSource.Current` and applies ONLY the texture mipmap policy. Settings Story 006 does NOT provide quality (gate F11 correction).
- **Ownership** (gate F11): Settings owns selected/default preset; Content applies only texture mipmap policy (`globalTextureMipmapLimit`); URP/VFX owns post-processing + render-scale. Platform defaults: Medium WebGL, High PC, Low explicit fallback.
- **Mipmap mapping**: Low → higher `globalTextureMipmapLimit` (lower res); High → `globalTextureMipmapLimit = 0` (full res).
- **Runtime fallback** (GDD:114, ADR-0010): PerformanceReduced may force VFX density to Low — an override, never rewriting persisted preferences. Cross-story integration test proves Settings preset → applier + Content mipmap consistent under override.

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- Post-processing + render-scale → Settings Story 005 (IQualityPresetApplier) + URP/VFX epics
- Measured WebGL bundle size ≤3MB (WG4), ASTC 6×6 (WG2), LODs (WG3), heap 768MB (WG1), OOM (WG6) → TD-026 (profiling gate — require representative Core content)
- Memory budgets MB1/2/6/7 → TD-026

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate). The developer implements against these — do not invent new test cases during implementation.*

- **AC-QP1a**: Given quality = Low (WebGL); When content loads; Then car textures use lower resolution via globalTextureMipmapLimit for Low. Edge: each quality level's limit mapping correct.
- **AC-QP2a**: Given quality = High (PC); When content loads; Then full resolution via globalTextureMipmapLimit = 0. Edge: High = 0 limit.
- **AC-WG5**: Given WebGL build; When quality settings load; Then Medium default; Low available as fallback. Edge: explicit Low selection works.
- **Cross-story**: Given Settings preset; When applied; Then URP/VFX applier + Content mipmap both take effect consistently; PerformanceReduced → Low density override without rewriting persisted prefs. Edge: override clears → returns to working preset.

---

## Test Evidence

**Story Type**: Integration
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Integration: `Assets/tests/integration/content/QualityProfileIntegrationTests.cs` — Settings preset → URP/VFX applier + Content mipmap policy, runtime fallback override — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 (Race Load — content loads under quality) — DONE; **Settings Story 005** (Display Confirm & Quality Presets — IQualityProfileSource) — DONE required
- Unlocks: None directly (VFX epics consume density)
