# QA Sign-Off Report: Sprint 2 — Simulation Kernel

**Date**: 2026-08-12
**QA Lead sign-off**: APPROVED WITH CONDITIONS (2026-08-12)

---

## Test Coverage Summary

| Story | Type | Auto Test | Manual QA | Result |
|-------|------|-----------|-----------|--------|
| 2-1 Contract Spine | Integration | PASS | Not run | PASS |
| 2-2 Simulation Driver & Tick Clock | Logic | PASS | Not run | PASS |
| 2-3 Session Start — Content Lifecycle, Countdown & GO | Logic | PASS | Not run | PASS |
| 2-4 Interruption — Pause, Resume & Focus-Loss | Logic | PASS | Not run | PASS |
| 2-5 Session End — Finish, Results, Forfeit & Unload | Integration | PASS | Not run | PASS |
| 2-6 Presentation — Render Interpolation | Logic | PASS | Not run | PASS |
| 2-7 Performance Monitor | Logic | PASS | Not run | PASS |
| 2-8 Determinism & MVP Recordable Buffer | Logic | PASS | Not run | PASS |

418/418 PlayMode tests passed (unit 202/202 + integration 55/55 + Input 161/161 preserved). Zero Sprint 1 regressions.

---

## Bugs Found

(none — 0 manual QA executed, 0 automated failures)

---

## Deferred Engine-Integration Items (assembly gate)

| Item | Source | Deferral reason |
|------|--------|-----------------|
| p95 ≤6ms / max ≤8ms frame budget | ADR-0001 | runtime frame-time measurement; engine-free kernel cannot measure display FPS |
| AC-1.4 auto-physics / SimulationMode.Script | TD-014 | engine configuration, not Kernel scope |
| AC-5.3 Time.timeScale application | story-004 | engine API, deferred to assembly gate |
| AC-7.6 observedFps consumption | story-007 | producer-only boundary (ADR-0001) |

None of these are code defects — they are runtime verifications that require a real build, outside the engine-free `Overdrive.Simulation` assembly's scope.

---

## Verdict: APPROVED WITH CONDITIONS

All eight stories pass via automated evidence. No S1/S2 bugs open. No manual QA was required (0 manual/visual criteria in this sprint per QA plan).

**Conditions**: the assembly-gate engine-integration items listed above must be verified on a real build before final release advancement.

---

## Next Step

Resolve conditions before advancing: schedule the assembly-gate verifications (frame budget profiler run, auto-physics Script mode, timeScale application, observedFps consumption) in the next sprint or gate plan. Run `/gate-check` once the assembly-gate items are scheduled to validate phase advancement.
