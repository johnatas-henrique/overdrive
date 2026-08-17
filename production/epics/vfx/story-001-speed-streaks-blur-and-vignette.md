# Story 001: Speed Streaks, Blur & Vignette

> **Epic**: VFX
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Visual/Feel
> **Manifest Version**: 2026-08-05
> **Estimate**: 2.0h

## Context

**GDD**: `design/gdd/vfx.md`
**Requirement**: `TR-vfx-001` (speed streaks from global_max_velocity, onset 100), `TR-vfx-002` (budget ≤1.6ms), `TR-vfx-004` (URP RenderGraph/FullScreenPass)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0010: Camera-VFX Rendering Budget and Interpolation (VFX budget ≤1.6ms; screen-space via URP RenderGraph/FullScreenPass — legacy Blit obsolete; Motion Blur via URP Volume overrides — no Off enum, Low preset disables override)
**ADR Decision Summary**: Directional velocity language. Injected `VfxSpeedInput { speedKmh, globalMaxVelocity }` → StreakIntensity via the approved formula (100 → 0; 316/340 → ≈0.90; 340 → 1.0; above max capped). Blur: injected speed + `RuntimePreferences.MotionBlurEffective` → blur amount (0.25 at 50% global max; false → URP Motion Blur override DISABLED, not an Off enum). Vignette: injected speed/global max → 0.0 at exactly 60% threshold, increases above. Render implementation via concrete URP FullScreenPassRendererFeature/RenderGraph seam — RecordRenderGraph used, no legacy Blit/Execute. Density scaling: Low 50%, Medium 75%, High/Ultra 100%, Low vignette disabled.

**Engine**: Unity 6000.3.22f1 | **Risk**: HIGH
**Engine Notes**: URP 17.3 post-cutoff — Render Graph APIs verified stable via runtime reflection; FullScreenPassRendererFeature for screen-space speed lines (legacy Blit obsolete).

**Control Manifest Rules (this layer)**:
- Required: streaks scale from global_max_velocity, onset 100 km/h; budget ≤1.6ms (VFX-only)
- Required: Motion Blur via URP Volume override (Low preset disables — no Off enum); RenderGraph/FullScreenPass

---

## Acceptance Criteria

*From vfx.md + ADR-0010, scoped per QL-STORY-READY 2026-08-16:*

- [ ] **Speed output**: injected `VfxSpeedInput { speedKmh, globalMaxVelocity }` → StreakIntensity: 100 → 0, 316/340 → ≈0.90, 340 → 1.0, values above max capped (VP telemetry is an input — VFX never derives/mutates it)
- [ ] **Blur**: injected speed + MotionBlurEffective → blur 0.25 at 50% global max; effective false → URP Motion Blur override disabled (not an Off enum)
- [ ] **Vignette**: injected speed/global max → 0.0 at exactly 60% threshold; increases above per GDD formula
- [ ] **Render**: speed-line/vignette pass via a concrete URP FullScreenPassRendererFeature/RenderGraph seam; RecordRenderGraph used; no legacy Blit()/Execute()
- [ ] **Density scaling**: Low 50%, Medium 75%, High/Ultra 100% for streaks/blur/vignette; Low vignette disabled
- [ ] **Budget**: VFX-only ≤1.6ms measured with an agreed metric (VFX-only vs Camera+VFX scope defined; percentile/peak, car count, hardware, duration — epic-level performance gate)

---

## Implementation Notes

*Derived from ADR-0010 Implementation Guidelines:*

- All inputs injected at seams (speed telemetry, runtime preferences) — VFX is a consumer
- The speed-line/vignette pass is a URP FullScreenPassRendererFeature using Render Graph API (RecordRenderGraph)
- Motion Blur override: when effective = false, the URP Volume override is DISABLED — the URP enum has no Off value (2026-08-05 amendment)
- The performance budget is an epic-level gate with a defined metric — "measured in rig" is insufficient alone
- **Screen-space anchoring (rig gap closure 2026-08-16)**: speed streaks/vignette are screen-space effects (FullScreenPass) — they never anchor to car nodes; car-mounted emitters (Story 002) use the semantic socket-slot contract (`CarSocketAnchors` on the car prefab), never object-name lookups.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 002/003]: particles, runtime policy/parity
- [vehicle-physics-feel]: global_max_velocity production (consumed)
- [Settings]: MotionBlurEffective resolution (consumed)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-SPEED**: global max 340 → 100/316/340/>340 → 0/≈0.90/1.0/capped 1.0 (screenshots show directional streaks)
- **AC-BLUR**: Motion Blur saved On, effective On → 0.25 at 170 km/h; Reduced Motion → override disabled; saved value remains On
- **AC-VIGNETTE**: global max 340 → below/exactly at/above 204 km/h → 0 at exactly 204, increases above
- **AC-RENDER**: renderer feature + Game View → FullScreenPass/RenderGraph path active; no legacy Blit/Execute
- **AC-DENSITY**: all presets → multipliers + Low vignette disabled per GDD
- **AC-BUDGET**: representative VFX benchmark → VFX-only ≤1.6ms per agreed metric

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**:
- Visual/Feel: `production/qa/evidence/vfx-speed-effects-evidence.md` + screenshots
- Seam tests: `Assets/tests/integration/vfx/VfxSpeedTests.cs` (intensity/blur/vignette numeric contracts)
- Performance: profiler benchmark evidence (epic gate)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: vehicle-physics-feel (global_max_velocity), Settings (runtime preferences)
- Unlocks: Story 002/003 (particles compose with screen-space effects)
