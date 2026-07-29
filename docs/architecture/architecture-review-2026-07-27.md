# Architecture Review Report

> **Date:** 2026-07-27
> **Engine:** Unity 6000.3.19f1 (Unity 6.3 LTS)
> **GDDs Reviewed:** 21 (all APPROVED)
> **ADRs Reviewed:** 6 (ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0008)
> **Mode:** /architecture-review full

---

## Traceability Summary

| Layer | TRs Estimated | ✅ Covered | ⚠️ Partial | ❌ Gaps |
|-------|--------------|-----------|-----------|--------|
| Foundation (6 GDDs) | ~260 | ~220 | ~15 | ~25 |
| Core (10 GDDs) | ~335 | ~80 | ~30 | ~225 |
| Presentation (5 GDDs) | ~149 | ~10 | ~5 | ~134 |
| **Total** | **~744** | **~310** | **~50** | **~384** |

**Coverage rate:** ~42% covered/partial, ~58% gaps.

The gaps follow a clear pattern: Foundation ADRs exist and cover their domains well. Core and Presentation ADRs are listed as "Required" in the architecture document but have not been created yet. This is the correct order — Foundation decisions inform Core/Presentation decisions.

---

## Coverage Gaps (no ADR exists)

### Foundation Layer (25 gaps — mostly Beta-phase deferrals)

| TR-ID | GDD | System | Requirement | Priority |
|-------|-----|--------|-------------|----------|
| TR-multi-architecture-* | multiplayer-architecture.md | Multiplayer Arch | Beta network integration (CoherenceInputSimulation, rollback, input packet format, disconnection handling) | Beta (deferred by design) |
| TR-input-system-007 | input-system.md | Input System | Mouse is UI-only in MVP — no ADR codifies this restriction | MVP |
| TR-input-system-008 | input-system.md | Input System | Dead-zone profile types (radial vs axial) partially covered | MVP |
| TR-content-pipeline-007 | content-pipeline.md | Content Pipeline | WebGL constraints enforcement (ASTC, LOD, bundle size) | MVP |
| TR-content-pipeline-008 | content-pipeline.md | Content Pipeline | Loading screen minimum 0.5s display and input blocking | MVP |

### Core Layer (225 gaps — ADRs not yet created)

| System | GDD | Gap Count | Key Missing Decisions |
|--------|-----|-----------|----------------------|
| Vehicle Physics | vehicle-physics.md | ~8 | DifficultyProfile player fields (off-track grip, wall speed-loss) |
| Fuel System | fuel-system.md | ~18 | Qualifying fuel load, pit refuel rate, fuel states |
| Tire System | tire-system.md | ~15 | Wear formula, TireCompound, pit swap mechanics |
| Pit Stop | pit-stop.md | ~14 | Entry detection, speed clamp, service duration, PitCamera |
| Qualifying | qualifying.md | ~25 | AI time generation, GridAssignment, RaceReconfigure flow |
| AI Rival | ai-rival.md | ~18 | PCG32 seeding, archetypes, overtake/defend formulas |
| Track System | track-system.md | ~16 | JSON format, surface zones, pit geometry, CrossedLapBoundary |
| Car Definition Data | car-definition-data.md | ~18 | Stat schema, formulas, validation |
| Race Session Manager | race-session-manager.md | ~17 | Position ranking, events, FinishOrderResolver |
| Grid & Start | grid-start.md | ~12 | Column stagger, Perfect Start evaluation details |

### Presentation Layer (134 gaps — ADRs not yet created)

| System | GDD | Gap Count | Key Missing Decisions |
|--------|-----|-----------|----------------------|
| Camera | camera.md | ~19 | FOV response, shake layers, collision avoidance, PitCamera |
| HUD | hud.md | ~18 | Elements, theming, track map, readability |
| Audio System | audio-system.md | ~18 | Procedural engine, tire squeal, music stings |
| VFX | vfx.md | ~15 | Speed streaks, motion blur, density presets, 1.6ms budget |
| UI Menu | ui-menu.md | ~15 | Screen flow, navigation, car turntable |

---

## Cross-ADR Conflicts

**No conflicts found.** All 6 ADRs are internally consistent:

| Pair | Check | Result |
|------|-------|--------|
| ADR-0001 vs ADR-0002 | Pipeline integration (Step 6) | ✅ Consistent |
| ADR-0001 vs ADR-0003 | State ownership (Content never writes SimulationState) | ✅ Consistent |
| ADR-0001 vs ADR-0004 | Lifecycle (Settings blocked during Countdown) | ✅ Consistent |
| ADR-0001 vs ADR-0005 | Input capture (CaptureLatestRawSample before accumulator) | ✅ Consistent |
| ADR-0001 vs ADR-0008 | Recording (ReplayInitialState at GO, buffer lifecycle) | ✅ Consistent |
| ADR-0002 vs ADR-0003 | CarDefinition loaded via Addressables | ✅ Consistent |
| ADR-0002 vs ADR-0004 | DifficultyProfile consumption | ✅ Consistent |
| ADR-0002 vs ADR-0005 | ResolvedCarInput contract | ✅ Consistent |
| ADR-0003 vs ADR-0004 | No direct interaction | ✅ No conflict |
| ADR-0004 vs ADR-0005 | ControlProfile consumption | ✅ Consistent |
| ADR-0005 vs ADR-0008 | CameraToggle excluded from Ghost Recording | ✅ Consistent |

---

## ADR Dependency Order

```
Foundation (no dependencies):
  1. ADR-0001: Manual Simulation Authority

Depends on Foundation:
  2. ADR-0003: Content Pipeline (requires ADR-0001)
  3. ADR-0004: Settings Persistence (requires ADR-0001)
  4. ADR-0002: Vehicle Physics (requires ADR-0001)
  5. ADR-0005: Input Context Controller (requires ADR-0001, ADR-0004)
  6. ADR-0008: Ghost Recording (requires ADR-0001, ADR-0002)
```

No dependency cycles. No unresolved dependencies.

---

## GDD Revision Flags

No GDD revision flags — all GDD assumptions are consistent with verified engine behaviour and accepted ADRs.

---

## Engine Compatibility Issues

| ADR | Engine | Knowledge Risk | Post-Cutoff APIs | Status |
|-----|--------|---------------|------------------|--------|
| ADR-0001 | Unity 6000.3.19f1 | HIGH | Physics.Simulate, SimulationMode.Script | ✅ Verified |
| ADR-0002 | Unity 6000.3.19f1 | HIGH | Rigidbody.linearVelocity, linearDamping, angularDamping | ✅ Verified |
| ADR-0003 | Unity 6000.3.19f1 | MEDIUM | Addressables 3.1.0 APIs | 📄 Referenced |
| ADR-0004 | Unity 6000.3.19f1 | LOW | PlayerPrefs (stable) | ✅ No risk |
| ADR-0005 | Unity 6000.3.19f1 | MEDIUM | Input System 1.19.0 | 📄 Referenced |
| ADR-0008 | Unity 6000.3.19f1 | LOW | Pure C# (no engine APIs) | ✅ No risk |

All HIGH-risk APIs verified against Unity 6000.3 runtime via `unity_reflect`. MEDIUM-risk packages referenced from engine reference docs.

---

## Architecture Document Coverage

- All 21 systems from `systems-index.md` appear in the architecture layers ✅
- Data flow section covers all cross-system communication ✅
- API boundaries define all integration contracts ✅
- No orphaned architecture (systems with ADRs but no GDD) ✅
- Architecture Principles (5) are consistent with ADR decisions ✅

---

## Verdict: **CONCERNS**

**Rationale:**
- Foundation layer is well-covered: 6 ADRs, all Accepted, no conflicts
- Core and Presentation layers have significant gaps (~384 TRs without ADR coverage) — but these gaps are expected because the architecture document explicitly lists them as "Required ADRs" that haven't been created yet
- No blocking cross-ADR conflicts
- Engine compatibility is solid for all verified APIs
- The architecture document correctly identifies the required ADRs and their priority order

**The project is on track.** Foundation ADRs are complete. Core/Presentation ADRs are the natural next step.

### Blocking Issues

None. The gaps are by design — Core/Presentation ADRs are scheduled for creation after Foundation sign-off.

### Required ADRs (from architecture.md, prioritized)

**Core Layer (next priority):**
1. ADR-0006: Fuel/Tire state ownership & tick timing
2. ADR-0007: Track spline data format & conversion pipeline

**Feature Layer:**
3. ADR-0009: AI Rival deterministic architecture

**Presentation Layer:**
4. ADR-0010: Camera-VFX rendering budget & interpolation
