# Epic: VFX

> **Layer**: Presentation
> **GDD**: design/gdd/vfx.md
> **Architecture Module**: VFX presentation (directional velocity language; ADR-0010 rendering budget; URP RenderGraph/FullScreenPass)
> **Status**: Ready
> **Stories**: 3 stories created (2 Visual/Feel, 1 Integration) — see table below
> **Estimate**: 3 stories (~4.5h active — calibrated 0.3×, sprint-3 retrospective)
> **Session**: S2 · Phase 3 (2-orchestrator plan 2026-08-16)
> **Depends on**: vehicle-physics-feel (velocity telemetry); settings (quality presets + Reduced Motion + VFX density); ADR-0010. MVP criterion (VFX directional velocity) — not polish-only.

## Overview

The directional-velocity VFX language: speed streaks scaling from global_max_velocity (onset at 100 km/h — global_max_velocity derived from per-car max_velocity per CW3); total VFX budget ≤ 1.6ms per frame (10% of the 60 FPS budget); four density presets (Low/Medium/High/Ultra) with PerformanceReduced forcing Low; screen-space effects via URP RenderGraph/FullScreenPass; Motion Blur via URP Volume overrides; Reduced Motion disables blur/shake while preserving non-motion visibility; tire-smoke live cap. Integrates with the quality pipeline (story 3-14: QualityPresetId + VfxDensityLevel in Settings.Core) and the PerformanceMonitor override path.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0010: Camera/VFX Rendering Budget and Interpolation | VFX budget ≤ 1.6ms; density presets; PerformanceReduced → Low; interpolation pattern | MEDIUM |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-vfx-001 | Speed streaks scale from global_max_velocity; onset at 100 km/h | ADR-0010 ✅ |
| TR-vfx-002 | Total VFX budget ≤ 1.6ms per frame (10% of 60 FPS budget) | ADR-0010 ✅ |
| TR-vfx-003 | 4 density presets: Low, Medium, High, Ultra; PerformanceReduced forces Low | ADR-0010 ✅ |
| TR-vfx-004 | Screen-space effects use URP RenderGraph/FullScreenPass; Motion Blur uses URP Volume overrides | ADR-0010 ✅ |
| TR-vfx-005 | Reduced Motion disables blur/shake while preserving non-motion visibility; tire-smoke live cap | ADR-0010 ✅ |

**Untraced requirements**: None — 5/5 covered by Accepted ADRs.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria of `design/gdd/vfx.md` are verified
- Speed-streak onset/scale verified in the dev rig with screenshot evidence
- VFX budget verified within the ≤1.6ms budget (profiler evidence — ADR-0001 profiling gate co-verifies)
- Density preset switching + PerformanceReduced → Low verified with the settings quality pipeline (3-14)
- All Visual/Feel stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/story-readiness` on the first story to begin implementation.

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Speed Streaks, Blur & Vignette | Visual/Feel | Ready | ADR-0010 |
| 002 | Particle Effects — Sparks & Tire Smoke | Visual/Feel | Ready | ADR-0010 |
| 003 | Runtime Quality Policy & Camera Parity | Integration | Ready | ADR-0010 |

*Note: 3 stories (not 2) — QL-STORY-READY 2026-08-16 mandated particles/policy split; performance budget moved to epic-level gate with defined metric; grip_loss→emission mapping is Tire-owned.*