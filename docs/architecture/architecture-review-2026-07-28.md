# Architecture Review Report

> **Date:** 2026-07-28
> **Engine:** Unity 6000.3.19f1 (Unity 6.3 LTS)
> **GDDs Reviewed:** 21 (all APPROVED)
> **ADRs Reviewed:** 11 (0001–0011, all Accepted)
> **Mode:** /architecture-review full

---

## Traceability Summary

| Layer | TRs Assessed | ✅ Covered | ⚠️ Partial | ❌ Gaps |
|-------|-------------|-----------|-----------|--------|
| Foundation (6 GDDs) | 87 | ~75 | ~8 | ~4 |
| Core (10 GDDs) | 118 | 99 | 9 | 7 |
| Presentation (5 GDDs) | 64 | 30 | 14 | 20 |
| **Total** | **269** | **~204** | **~31** | **~31** |

**Coverage rate:** ~76% covered, ~12% partial, ~12% gaps.

---

## Coverage Gaps (no ADR exists)

### Foundation Layer (4 gaps — 9 deferred to Beta)

| GDD | System | Gap | Priority |
|-----|--------|-----|----------|
| multiplayer-architecture.md | Multiplayer Arch | 9 TRs: MVP offline constraint, Alpha/Beta networking | Beta (deferred) |

### Core Layer (7 gaps)

| GDD | System | Gap | Priority |
|-----|--------|-----|----------|
| tire-system.md | Tire | HUD wear display thresholds | MVP |
| track-system.md | Track | Anti-cut 90% minimum distance | MVP |
| car-definition-data.md | Car Def | Per-car audio profile fields | MVP |
| car-definition-data.md | Car Def | Tier gap ~4-point average | MVP |
| race-session-manager.md | RSM | Position ranking formula | MVP |
| qualifying.md | Qualifying | Skip → P16, failed → P16 | MVP |
| grid-start.md | Grid & Start | Grid Display screen | MVP |

### Presentation Layer (20 gaps)

| GDD | System | Gap | Priority |
|-----|--------|-----|----------|
| hud.md | HUD | 8 TRs: layout, states, theming, fonts | MVP |
| camera.md | Camera | 4 TRs: look-ahead, collision avoidance, vertical follow, FOV formula | MVP |
| vfx.md | VFX | 3 TRs: vignette formula, cockpit/chase parity, pit/menu gating | MVP |
| ui-menu.md | UI Menu | 4 TRs: screen flow, navigation stack, car/track selection | MVP |

---

## Cross-ADR Conflicts (TD Analysis)

| # | Severity | Type | ADRs | Issue |
|---|----------|------|------|-------|
| H1 | 🔴 HIGH | Integration | 0006↔0011 | Pit refuel/tire-change mechanism undefined — Option B committed but no contract |
| M1 | 🟡 MED | State | 0002↔0006 | CarState.PitPhase ownership undocumented |
| M2 | 🟡 MED | Integration | 0001↔0005 | Input event timing under manual simulation |
| M3 | 🟡 MED | Integration | 0005↔0009 | AI input path into pipeline undefined |
| M4 | 🟡 MED | State | 0004↔0010 | ReducedMotion not in Settings schema |
| M5 | 🟡 MED | Integration | 0010↔0011 | PitCamera activation trigger unspecified |
| L1 | 🟢 LOW | Integration | 0001↔0008 | Ghost recording step missing from pipeline |
| L2 | 🟢 LOW | Integration | 0003↔0008 | Alpha ghost persistence path undefined |
| L3 | 🟢 LOW | Integration | 0001↔0003 | RaceReconfigure mid-tick behavior undefined |
| L4 | 🟢 LOW | Integration | 0008 | EdgeEventStream producer list missing |
| I1-I7 | ℹ️ INFO | Various | Multiple | 7 cross-ADR data access gaps |

### Blocking Conflicts

**H1 (HIGH):** ADR-0011 commits to Option B ("no direct Fuel/Tire mutation") but ADR-0006 doesn't describe how fuel load increases or tire wear resets during pit service. Resolution options: (a) PitServiceCommand in TickStartSnapshot, (b) Move PitStop to Step 5c, (c) IFuelMutator/ITireMutator ports.

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
```

**No dependency cycles. No unresolved dependencies.**

---

## GDD Revision Flags

No GDD revision flags — all GDD assumptions are design-level and consistent with verified engine behaviour.

---

## Engine Compatibility

| ADR | Verdict | Issue |
|-----|---------|-------|
| 0001 | ✅ PASS | — |
| 0002 | ✅ PASS | — |
| 0003 | ✅ PASS | — |
| 0004 | ⚠️ 1 ISSUE | `SetResolution` overload deprecation claim wrong; use `RefreshRate` struct |
| 0005 | ✅ PASS | — |
| 0006 | ✅ PASS | — |
| 0007 | ✅ PASS | — |
| 0008 | ✅ PASS | — |
| 0009 | ✅ PASS | — |
| 0010 | ✅ PASS | — |
| 0011 | ✅ PASS | — |

### Engine Specialist Findings

- **10 of 11** ADRs fully compatible with zero engine issues
- **ADR-0004**: `SetResolution` bool overload is NOT deprecated — only mixed (bool,int) and (FullScreenMode,int) overloads are. Pseudocode must use `RefreshRate` struct.
- Zero uninstalled packages referenced
- No deprecated API references

---

## Architecture Document Coverage

- All 21 systems from `systems-index.md` present in architecture layers ✅
- Data flow section covers all cross-system communication ✅
- API boundaries define all integration contracts ✅
- No orphaned architecture ✅

---

## Verdict: **CONCERNS**

**Rationale:**
- 11 ADRs cover all layers, 76% TR coverage
- 1 HIGH conflict (pit refuel/tire-change mechanism) must be resolved before Pit implementation
- 5 MED items need ADR amendments (specification gaps, not design flaws)
- 31 gaps remain — 9 deferred to Beta, 7 in Core (resolvable during story creation), 20 in Presentation (UI/UX detail)
- Engine compatibility solid for 10/11 ADRs, 1 advisory (ADR-0004 SetResolution)
- No dependency cycles, no state authority conflicts, no architecture pattern conflicts
- Performance budgets reconcile (2.7ms simulation + 2.1ms rendering within 16.6ms frame)

### Blocking Issues (must resolve before PASS)

1. **H1:** Resolve pit refuel/tire-change mechanism between ADR-0006 and ADR-0011
2. **M4:** Add ReducedMotion to Settings schema (ADR-0004)

### Required Actions Before Coding

1. **Fix H1:** Choose resolution (a), (b), or (c) for pit service contract
2. **Fix M4:** Add ReducedMotion to ADR-0004 SettingsSnapshot
3. **Fix ADR-0004:** Correct SetResolution deprecation claim, use RefreshRate struct
4. **Amend M1:** Add PitPhase enum to ADR-0002 CarState
5. **Amend M2:** Add event-queue semantics to ADR-0005
6. **Amend M3:** Define AI input adapter contract
7. **Amend M5:** Specify PitCamera trigger mechanism
