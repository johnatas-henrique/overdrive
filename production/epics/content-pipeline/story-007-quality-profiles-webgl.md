# Story 007: Quality Profiles (WebGL)

> **Epic**: Content Pipeline
> **Status**: Complete

## Completion Notes

**Completed**: 2026-08-15
**Criteria**: 4/4 passing (0 deferred — AC-WG5 real WebGL-build verification deferred to TD-026 profiling gate + WebGL build smoke with named destination; URP/VFX execution proven by Settings Story 005's own tests, VFX epic owns execution)
**Deviations**: None — asmdef reference additions (Content→Settings.Core, Settings→Content, Content.Unity→Settings.Core, test→Settings+Settings.Core+URP) are in-scope per the story Implementation Notes
**Test Evidence**: Integration — 23 tests (22 `QualityProfileIntegrationTests.cs` incl. isolation sentinel + 1 `StartupErrorIntegrationTests.cs` pre-startup guard); 992/992 PlayMode + 43/43 EditMode green
**Code Review**: Complete (unity-specialist APPROVED R1; qa-tester TESTABLE R4 — 3 production fixes from pre-spawn audit: pre-startup attach guard, non-fatal SafePublish on both hooks, LogWarning containment; 5 test-hardenings from review rounds: real-adapter end-to-end, load-order spy, non-tautological reapply sequence, dispose desync, isolation sentinel)
**Gates**: LP-CODE-REVIEW APPROVED · QL-TEST-COVERAGE ADEQUATE
**Tech debt**: TD-038 extended (quality adapter wiring — bootstrapper call site, same destination); TD-039 registered (complete-traceability-matrix desaligned with registry — matrix↔registry sync); TR-content-009 registered (quality profiles QP1/QP2/WG5, active)
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: M (3-4h)

## Context

**GDD**: `design/gdd/content-pipeline.md`
**Requirement**: TR-content-005 (dependent — measured budgets deferred to TD-026)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0003: Content Pipeline and Addressables; ADR-0010: Camera/VFX Rendering Budget and Interpolation
**ADR Decision Summary**: Settings owns the selected/default quality preset (Medium WebGL, High PC, Low explicit fallback). Content applies ONLY the texture mipmap policy (`QualitySettings.globalTextureMipmapLimit`). URP/VFX owns post-processing and render-scale behavior. Cross-story integration proves the Content mipmap policy reflects the same applied preset (`ActivePreset` → mipmap limit).

**Engine**: Unity 6000.3.22f1 (Unity 6.3 LTS) | **Risk**: LOW

**Engine Notes**: `QualitySettings.globalTextureMipmapLimit` per quality level (GDD QP1/QP2) — settable in PlayMode (unlike Screen.SetResolution), so the real Unity applier IS integration-testable. URP render pipeline asset configuration owned by Settings Story 005's `IQualityPresetApplier`. Unity 6000.3.22f1: `globalTextureMipmapLimit` is a single global int (0-3, 0 = full resolution).

**Performance disposition**: Mipmap policy is config-once-at-load + on-override-change — no per-frame cost; the runtime override path reacts only to state changes (event-driven, never polling). No per-frame performance impact expected beyond the initial `globalTextureMipmapLimit` write (a single engine call, negligible).

**Control Manifest Rules (Foundation layer)**:
- Required: 5 DifficultyProfiles + 4 QualityPresets (Low/Medium/High/Ultra) — source: ADR-0004 (Settings epic)
- Guardrail: Performance protection has highest runtime authority (may force VFX density to Low) — source: GDD:114, ADR-0010

---

## Acceptance Criteria

*From GDD `design/gdd/content-pipeline.md`, scoped to this story (QP1/QP2 split — gate NEW-05):*

- [ ] **AC-QP1a (Content-owned)**: Given Settings provides quality = Low (WebGL), When content loads, Then car textures use lower resolution via `QualitySettings.globalTextureMipmapLimit` for the Low quality level.
- [ ] **AC-QP2a (Content-owned)**: Given Settings provides quality = High (PC), When content loads, Then car textures use full resolution via `QualitySettings.globalTextureMipmapLimit` = 0 for the High quality level.
- [ ] **AC-WG5**: Given WebGL build, When quality settings load, Then Medium profile applies by default; Low profile is available as the memory/performance fallback.
- [ ] **Cross-story integration** (gate R1 re-scope): Given a Settings preset applied via `IQualityPresetApplier.ApplyPreset` (ActivePreset = source of truth), When content loads or an override changes, Then the Content mipmap policy reflects the SAME applied preset consistently; PerformanceReduced override (via `IQualityOverrideSource`) → Low-equivalent mipmap limit without rewriting persisted prefs; override clears → returns to the working preset's limit (event-driven restore). *(URP/VFX execution — render scale, post-processing — is proven in Settings Story 005's own tests and owned by the VFX epic; this story proves Content-side consistency with the same applied preset, not URP execution.)*

*(AC-QP1b/QP2b — post-processing + render-scale — owned by Settings Story 005; URP/VFX owns execution. Cross-referenced, not duplicated.)*

---

## Implementation Notes

*Derived from ADR-0003 + ADR-0010 + Settings Story 005:*

- **`IQualityProfileSource` port** (engine-free, `Overdrive.Content` — gate F11 + assembly decision 2026-08-15):
  ```csharp
  public interface IQualityProfileSource {
      QualityPresetId Current { get; }  // Low/Medium/High/Ultra — Settings.Core enum
  }
  ```
  Assembly decision: `Overdrive.Content.asmdef` gains `Overdrive.Settings.Core` in references (engine-free → engine-free, no cycle: Content → Settings.Core → Simulation). Justification: `QualityPresetId` was moved to Settings.Core in Story 3-6/3-7 explicitly "for runtime preference resolver access" — the Content pipeline is that runtime resolver. No enum duplication.
- **Adapter** (`Overdrive.Settings` assembly): `SettingsQualityProfileSource : IQualityProfileSource` reads `QualityPresetApplier.ActivePreset` (private set — set by `ApplyPreset`, the source of truth for the last APPLIED preset). Wiring: the app/bootstrapper creates the adapter and injects it into the Content composition root (`AttachQualityProfiles` — additive, pattern of `AttachLoadingScreen`); no compile-time dependency Settings→Content beyond the interface reference.
- **Mipmap resolver** (engine-free, `Overdrive.Content`): `MipmapLimitResolver` — pure preset→limit table. Proposed mapping (adjustable tuning, GDD only fixes Low=higher / High=0): Low→2, Medium→1, High→0, Ultra→0, Custom→1. NOTE (unity-specialist REQUIRED): the 0-3 range is a POLICY of the resolver, not an engine constraint — `globalTextureMipmapLimit` accepts any int; the resolver returns exact ints and tests assert exact expected values (0/1/2).
- **`ITextureMipmapApplier` port** (engine-free, `Overdrive.Content`): `void Apply(int limit)` — seams the engine call so the core stays engine-free; Unity implementation `UnityTextureMipmapApplier` (`Overdrive.Content.Unity`) writes `QualitySettings.globalTextureMipmapLimit` (integration-testable in PlayMode).
- **When applied**: at race load (content loads textures under the current preset — AC-QP1a/QP2a) and on runtime override changes (PerformanceReduced → Low-equivalent limit; restore on override clear) — event-driven, never per-frame.
- **Ownership** (gate F11): Settings owns selected/default preset; Content applies only texture mipmap policy; URP/VFX owns post-processing + render-scale. Platform defaults: Medium WebGL, High PC, Low explicit fallback.
- **Mipmap mapping**: Low → higher `globalTextureMipmapLimit` (lower res); High → `globalTextureMipmapLimit = 0` (full res).
- **Runtime fallback override** (gate R1 BLOCKING — seam specified):
  ```csharp
  public interface IQualityOverrideSource {
      bool IsReduced { get; }               // true while performance protection forces Low-equivalent quality
      event Action<bool> Changed;           // fires on IsReduced transitions (true = reduced, false = restored)
  }
  ```
  Engine-free (`Overdrive.Content`), driven in tests by a fake. Real wiring: `SettingsQualityOverrideSource` (**Overdrive.Settings** assembly — co-located with the profile adapter; Settings already references Simulation) connects `PerformanceMonitor.PerformanceStatusChanged` (story 007 — Reduced/Restored transitions, exactly-once per transition) to the port. The override NEVER rewrites persisted prefs — it only remaps the mipmap limit while active; on `Changed(false)` the mipmap returns to the working preset's limit (event-driven restore). Note: `MarkCustomOverride` (3-6) firing before a load → Content sees Custom → limit 1 (Medium-equivalent, ADR-0010-acceptable — custom display tweaks do not degrade textures below Medium).
- **Assembly references** (gate R1 BLOCKING): `Overdrive.Settings.asmdef` gains `Overdrive.Content` (the adapter implements `IQualityProfileSource`); `Overdrive.Content.asmdef` gains `Overdrive.Settings.Core` (QualityPresetId); `ContentIntegrationTests.asmdef` gains `Overdrive.Settings` + `Overdrive.Settings.Core` (real adapter + enum in the integration test). No cycles: Settings → Content → Settings.Core → Simulation.
- **TR anchor** (gate R1 REQUIRED + R1 code-review): TR-content-005 covers memory budgets only — it stays as the TD-026 dependency anchor, NOT as the quality-profiles requirement. QP1/QP2/WG5 have no dedicated TR; a TD-033-style registry amendment is registered at story closure as **TR-content-009** (quality profiles) — the NEXT FREE ID in the registry (001-008 exist). NOTE (code-review R2): complete-traceability-matrix.md is DESALIGNED with the registry — it assigns 009=OOM and 010=ContentUnloadComplete with semantics that differ from registry 005-008 as well; the matrix is a derived doc, the registry is the source of truth. A matrix sync is a docs debt registered at closure.
- **Custom preset** (gate R1/R2): `QualityPresetApplier.MarkCustomOverride()` (3-6) sets `ActivePreset = Custom` when the user customizes display settings — so the source CAN report Custom. `ResolveMapping(Custom)` throws (3-6 contract); the Content resolver therefore falls back to the default: **`MipmapLimitResolver(Custom) → 1` (Medium-equivalent limit)** — documented + tested. Rationale: Custom is a display-customization state with no preset mapping; the mipmap policy uses the quality default (Medium = DefaultPreset, also the WebGL default).

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- Post-processing + render-scale → Settings Story 005 (IQualityPresetApplier) + URP/VFX epics
- Measured WebGL bundle size ≤3MB (WG4), ASTC 6×6 (WG2), LODs (WG3), heap 768MB (WG1), OOM (WG6) → TD-026 (profiling gate — require representative Core content)
- Memory budgets MB1/2/6/7 → TD-026

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate). The developer implements against these — do not invent new test cases during implementation.*

- **AC-QP1a**: Given quality = Low (WebGL); When content loads; Then car textures use lower resolution via globalTextureMipmapLimit for Low. Edge: MipmapLimitResolver maps Low→2 **normatively** (table Low→2, Medium→1, High→0, Ultra→0) and the real Unity applier is asserted at load time (`QualitySettings.globalTextureMipmapLimit == 2` in PlayMode).
- **AC-QP2a**: Given quality = High (PC); When content loads; Then full resolution via globalTextureMipmapLimit = 0. Edge: resolver maps High→0; real applier asserted == 0.
- **AC-WG5**: Given WebGL build; When quality settings load; Then Medium default; Low available as fallback. Edge: explicit Low selection works; adapter reports the APPLIED preset (ActivePreset), never the persisted-only value; **real WebGL-default verification (build-level) is deferred to the WebGL target gate** (destiny: TD-026 profiling gate + WebGL build smoke).
- **Cross-story**: Given Settings preset applied; When content loads / override changes; Then Content mipmap limit == resolver(preset) consistently (resolver covers Low/Medium/High/Ultra/Custom — Custom falls back to Medium-equivalent); PerformanceReduced override → Low-equivalent limit; persisted quality_preset unchanged; event call-counts exact (1 per transition); override clears → returns to working preset limit (event-driven restore). Edge: `MipmapLimitResolver(Custom)` asserted to the EXACT expected value 1 (independent expected-value assertion, not resolver→applier self-consistency — a wrong Custom mutation must fail the test).

---

## Test Evidence

**Story Type**: Integration
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Integration: `Assets/tests/integration/content/QualityProfileIntegrationTests.cs` — Content-only consistency: applied preset (`ActivePreset` via `IQualityProfileSource`) → mipmap limit (resolver + real `UnityTextureMipmapApplier`), runtime fallback override (fake `IQualityOverrideSource` → Low-equivalent limit → restore) — must exist and pass

**Status**: [x] Created and passing — `Assets/tests/integration/content/QualityProfileIntegrationTests.cs` (22 tests incl. isolation sentinel, `ContentIntegrationTests` assembly) + `StartupErrorIntegrationTests.cs` (pre-startup attach guard, 1 test) — 992/992 PlayMode + 43/43 EditMode green (2026-08-15)

---

## Dependencies

- Depends on: Story 003 (Race Load — content loads under quality) — DONE; **Settings Story 005** (Display Confirm & Quality Presets — IQualityProfileSource) — DONE required
- Unlocks: None directly (VFX epics consume density)
