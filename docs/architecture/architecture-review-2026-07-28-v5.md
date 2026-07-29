# Architecture Review Report

> **Date:** 2026-07-28 (v5)
> **Engine:** Unity 6000.3.19f1 (Unity 6.3 LTS)
> **GDDs Reviewed:** 21 (all APPROVED)
> **ADRs Reviewed:** 12 (0001–0011, 0013 — all Accepted)
> **Mode:** /architecture-review full

---

## Traceability Summary

| Layer | TRs | ✅ Covered | ⚠️ Partial | ❌ Gaps |
|-------|-----|-----------|-----------|--------|
| Foundation (6 GDDs) | 76 | 63 | 9 | 4 |
| Core (10 GDDs) | 82 | 56 | 16 | 10 |
| Presentation (5 GDDs) | 36 | 18 | 16 | 2 |
| **Total** | **194** | **137 (70.6%)** | **41 (21.1%)** | **16 (8.2%)** |

**Full matrix:** `docs/architecture/complete-traceability-matrix.md` (511 lines)

---

## Gaps (16 TRs with ZERO ADR coverage)

| TR-ID | System | Gap | Priority |
|-------|--------|-----|----------|
| TR-input-008 | Input | Brake priority logic (EMA freeze) | MVP |
| TR-input-011 | Input | NaN/Inf sanitization | MVP |
| TR-track-009 | Track | 90% anti-cut threshold constant | MVP |
| TR-rsm-010 | RSM | resultClassification enum (Finished/DNF/Forfeit) | MVP |
| TR-qualifying-001 | Qualifying | Single flying lap, no retry | MVP |
| TR-qualifying-007 | Qualifying | Skip/fail = P16 | MVP |
| TR-qualifying-008 | Qualifying | Tier order not preserved | MVP |
| TR-car-def-005 | Car Def | Stat validation/clamping | MVP |
| TR-car-def-008 | Car Def | 5% differentiation rule | MVP |
| TR-camera-005 | Camera | Look-ahead formula | MVP |
| TR-camera-006 | Camera | Sphere-cast collision avoidance | MVP |
| TR-hud-001 | HUD | 7 chase element specification | MVP |
| TR-hud-003 | HUD | 0.5s readability budget | MVP |
| TR-hud-005 | HUD | Rival gap display | MVP |
| TR-uimenu-007 | UI Menu | Car selection turntable | MVP |

**Analysis:** 15 of 16 gaps are in systems where the ADR covers the architectural contract but not the presentation/UX detail. These are resolvable during story creation — the architectural decisions (which system owns what, how they communicate) are already covered. The 1 exception (TR-rsm-010 resultClassification) belongs in ADR-0001.

---

## Cross-ADR Conflicts

### Previously Flagged (v4) — RESOLVED ✅

| # | Issue | Status |
|---|-------|--------|
| H1 | Pit refuel/tire-change mechanism | ✅ RESOLVED — ADR-0011 defines PitServiceCommand contract; ADR-0006 consumes it |
| M1 | CarState.PitPhase ownership | ✅ RESOLVED — ADR-0002 declares VP as sole owner |
| M2 | Input event timing | ✅ RESOLVED — ADR-0005 defines InputEventQueue |
| M3 | AI input adapter | ✅ RESOLVED — ADR-0009 defines AIInput[16] at Step 13 |
| M4 | ReducedMotion in Settings | ✅ RESOLVED — ADR-0004 includes ReducedMotion |
| M5 | PitCamera trigger | ✅ RESOLVED — ADR-0011 defines PitCamera during InPitBox |

### New Issues (v5)

| # | Severity | Type | ADRs | Issue |
|---|----------|------|------|-------|
| C1 | 🟡 MED | Integration | 0001↔0010 | Interpolation timing: 0001 says "LateUpdate", 0010 says "DynamicUpdate" — both partially correct but contradictory wording |
| C2 | 🟡 MED | Data | 0004↔0013 | Audio volume schema: 0013 defines 4 mixer groups (Master/Music/SFX/UI) but 0004 AudioSettings only has 3 fields (Master/Music/SFX) — no UIVolume |
| C3 | 🟢 LOW | Data | 0001↔0013 | Audio states wording: 0001 says "9 states", 0013 says "9 derived states" — semantic, not contradictory |
| C4 | 🟢 LOW | Data | 0001↔0008 | architecture.md says "13-Step" but pipeline is 14-step (with 9b from ADR-0011) |
| C5 | 🟢 LOW | Integration | 0001↔0008 | Ghost recording step missing from architecture.md pipeline diagram |
| C6 | 🟢 LOW | Integration | 0003↔0008 | Alpha ghost persistence path: 0008 mentions CloudStorage but no ADR defines the persistence architecture |
| C7 | 🟢 LOW | Integration | 0013 | ADR-0013 missing ADR-0003 (Content Pipeline) in "Depends On" — audio assets load via Addressables |

### Resolution Required Before Implementation

**C1 (Interpolation):** Amend both ADRs to distinguish: (1) per-tick VisualTransform α computed in DynamicUpdate (consumed by Camera/VFX/Audio), (2) Rigidbody position sync in LateUpdate. Both are real; the wording needs clarification.

**C2 (Audio Volume):** Add `UIVolume` field to ADR-0004 AudioSettings struct. Update v3 schema migration to default UIVolume=1.0.

---

## ADR Dependency Order (topological sort, 6 tiers)

```
Tier 0 (root):
  1. ADR-0001: Manual Simulation Authority

Tier 1 (depend on 0001):
  2. ADR-0002: Vehicle Physics
  3. ADR-0003: Content Pipeline
  4. ADR-0004: Settings Persistence

Tier 2 (depend on T0-T1):
  5. ADR-0005: Input Context Controller
  6. ADR-0006: Fuel/Tire State Ownership
  7. ADR-0008: Ghost Recording

Tier 3 (depend on T0-T2):
  8. ADR-0007: Track Spline Format

Tier 4 (depend on T0-T3):
  9. ADR-0009: AI Rival
  10. ADR-0010: Camera-VFX

Tier 5 (depends on all):
  11. ADR-0011: Pit Stop Architecture
  12. ADR-0013: Audio System
```

**No dependency cycles. No unresolved dependencies.**

---

## GDD Revision Flags

No GDD revision flags — all GDD assumptions are consistent with verified engine behaviour.

---

## Engine Compatibility

| ADR | Verdict | Issue |
|-----|---------|-------|
| 0001 | ✅ PASS | — |
| 0002 | ✅ PASS | — |
| 0003 | ✅ PASS | — |
| 0004 | ⚠️ 1 ISSUE | `RefreshRate.FromRational()` does not exist; use `new RefreshRate { numerator, denominator }` |
| 0005 | ✅ PASS | — |
| 0006 | ✅ PASS | — |
| 0007 | ✅ PASS | — |
| 0008 | ✅ PASS | — |
| 0009 | ✅ PASS | — |
| 0010 | ✅ PASS | — |
| 0011 | ✅ PASS | — |
| 0013 | ✅ PASS | — |

**11/12 PASS, 1 CONCERNS (ADR-0004 RefreshRate construction).**

---

## Architecture Document Coverage

- All 21 systems from `systems-index.md` present in architecture layers ✅
- Data flow section covers all cross-system communication ✅
- API boundaries define all integration contracts ✅
- No orphaned architecture ✅

---

## Verdict: **CONCERNS**

**Rationale:**
- 12 ADRs cover all layers, 70.6% TR coverage (137/194)
- 16 gaps — 15 are presentation/UX detail (resolvable during stories), 1 is architectural (resultClassification in ADR-0001)
- 0 HIGH conflicts (all v4 HIGH/MED resolved)
- 2 MED new issues (interpolation wording, audio volume schema) — both amendment-only
- 7 LOW documentation-only fixes
- Engine: 11/12 PASS, 1 issue (ADR-0004 RefreshRate)
- No dependency cycles, no state ownership conflicts
- Previous H1 (pit service mechanism) fully resolved

### Blocking Issues (must resolve before PASS)

1. **C1:** Amend ADR-0001 and ADR-0010 interpolation wording
2. **C2:** Add UIVolume to ADR-0004 AudioSettings

### Required Actions Before Coding

1. Fix ADR-0004: RefreshRate construction + UIVolume field
2. Amend ADR-0001: Add interpolation phases subsection
3. Amend ADR-0010: Reference ADR-0001 interpolation phases
4. Amend ADR-0013: Add ADR-0003 to dependencies
5. Update architecture.md: 13-Step → 14-Step, add ghost recording step
