# Architecture Review — 2026-08-01

**Date:** 2026-08-01
**Scope:** 3 new ADRs (0013, 0014, 0015) + 4 modified ADRs (0005, 0006, 0007, 0010) + full cross-ADR consistency check
**Engine:** Unity 6000.3.19f1, URP 17.3.0, Input System 1.19.0
**Method:** Formal /architecture-review skill execution (9 phases)

## Verdict: **PASS WITH CORRECTIONS APPLIED**

All findings identified in this review were corrected in-session. The 3 new ADRs (0013, 0014, 0015) are ready for status transition to **Accepted**. No blocking issues remain.

---

## Scope

This review covers the 3 ADRs created 2026-07-31 by the parallel agent (post v5 review) plus the 4 ADRs modified in the same window:

| ADR | Status at review start | Change |
|-----|----------------------|--------|
| 0013 Qualifying Session Format | Proposed | New |
| 0014 HUD Data Contract & Layout | Proposed | New |
| 0015 Car Definition Data Validation | Proposed | New |
| 0005 Input Context Controller | Accepted | Modified (CameraToggle mechanism) |
| 0006 Fuel/Tire State Ownership | Accepted | Modified (gating) |
| 0007 Track Spline Format | Accepted | Modified (pit lane) |
| 0010 Camera-VFX Budget | Accepted | Modified (rendering) |

## Review Team

- Lead: main agent (formal skill execution)
- Sub-agents: 2 (cross-ADR consistency scan + engine compatibility audit)

---

## Findings

### HIGH — A1: ADR-0015 `engineType` string field

**Location:** adr-0015-car-definition-data-validation.md
**Issue:** ADR-0015 defined an `engineType: string` field for the car audio profile. ADR-0012 (Audio, Accepted 2026-07-28) replaced the `engineType` string with the `CarAudioProfile` struct (cylinders + exhaust note) — the string type is obsolete and would contradict the Accepted audio architecture.
**Fix applied:** ADR-0015 now documents `CarAudioProfile` mirroring ADR-0012. Added ADR-0012 to ADR-0015 Depends On. Comment at line 79 records the removal.

### HIGH — A2: Qualifying spawn model — pit box + out-lap

**Location:** adr-0013-qualifying-session-format.md vs qualifying.md (GDD)
**Issue:** ADR-0013 (new) defines spawn at **pit box** with a driven **out-lap** through pit lane. The qualifying.md GDD (Approved 2026-07-26) defined spawn at **pit exit** with no out-lap. The GDD was stale relative to the new architecture decision.
**Decision (user, design-review Q4):** ADR-0013 wins — pit box + out-lap model.
**Fix applied (Phase 5b):** qualifying.md updated (3 lines: Overview, state table, edge case). simulation-architecture.md:170 updated (Loading → Racing Qualifying spawn). ADR-0013:238 risk reworded from "pit exit spawn position" to "pit box position varies by track" for internal consistency.

### MEDIUM — M1: ADR-0005 InputEventQueue vs direct route

**Location:** adr-0005-input-context-controller-and-action-map-inventory.md vs adr-0010-camera-vfx-rendering-budget-and-interpolation.md
**Issue:** ADR-0005 (27/07) routed CameraToggle via `InputEventQueue` (ring buffer, dequeued at simulation Step 2). ADR-0010 (28/07) specifies "triggered by InputAction.performed" — direct route in DynamicUpdate. The GDD input-system.md uses the direct route. Two ADRs contradict on the same event path.
**Decision (user, M1):** Direct route wins — CameraToggle is a presentation-only event (per memory: rising edge in DynamicUpdate, one toggle per button press, does not enter SimulationInput).
**Fix applied:** ADR-0005 InputEventQueue removed (0 occurrences). CameraToggle documented as direct InputAction.performed → Camera, no queue, no Step 2 involvement.

### MEDIUM — M2: HUD element count 7 → 8 (+ Ghost 9th)

**Location:** adr-0014-hud-data-contract-and-layout.md, architecture.md
**Issue:** ADR-0014 specified "Chase: 7 elements". The HUD GDD (re-reviewed 2026-08-01) establishes **8 chase elements** (Speed+Gear, Position, Lap, Fuel, Tire, LapTime, Rival, Map) — Position/Lap split. Ghost Recording adds a 9th element outside MVP.
**Fix applied:** ADR-0014 corrected in 5 points (line 54 camera modes, line 81 cockpit overlay, line 97 Chase HUD Layout, line 125 cockpit overlay toggle, line 142 performance budget 8 × ~0.013ms). Ghost 9th element documented as Alpha+ additive note. architecture.md:220 corrected (7→8 chase).

### MEDIUM — M3: Out-lap fuel/tire gating

**Location:** adr-0006-fuel-tire-state-ownership-and-tick-timing.md
**Issue:** Sub-agent flagged that ADR-0006 lacked explicit out-lap gating for qualifying.
**Verification:** No fix needed — ADR-0013:109 "No fuel consumption during out-lap" + ADR-0006:148 "fuel and tire do not change during non-Racing states" already gate the out-lap correctly. Out-lap = non-Racing (no consumption), flying lap = Racing (consumption active). Chain is coherent.

### LOW — L1: Chinese characters in ADR-0013

**Location:** adr-0013-qualifying-session-format.md:214
**Issue:** "Three淘汰 sessions like modern F1" — CJK character in English technical document.
**Fix applied:** "Three elimination sessions like modern F1 (Q1/Q2/Q3)".

### LOW — L2: PostFinishSnapshot schema undefined

**Location:** adr-0001-manual-simulation-authority-and-determinism-boundary.md
**Issue:** PostFinishSnapshot referenced in 5+ locations (ADR-0001:51/70/125, ADR-0013:193/200) but its field schema was never defined anywhere.
**Fix applied:** Full 10-field schema added to ADR-0001 (PostFinishSnapshot Schema section): CarState[16], FuelState[16], TireState[16], simulationStepCount, activeRaceStepCount, resultClassification[carId], resultKind, raceTime, lapTimes[16][], raceMode. Notes source and immutability; cross-refs ADR-0013 resultKind = Qualifying.

### LOW — L3: GameState.splinePositions[16] undefined

**Location:** architecture.md:200 (GameState definition), adr-0014:73/79
**Issue:** ADR-0014 Track Map reads `GameState.splinePositions[16]` but the canonical GameState in architecture.md:200 did not list the field.
**Fix applied:** `splinePositions[16]` added to GameState definition (per-car fractional spline progress for Track Map dots and position ranking).

### LOW — L4: ClampStat silent clamping

**Location:** adr-0015-car-definition-data-validation.md:100
**Issue:** `ClampStat` returned the closest valid value with no record that the input was invalid. Silent clamping hides authoring typos in team stat ScriptableObjects (designer writes 3 wanting 4 — nobody notices).
**Fix applied:** `Debug.LogWarning` added when clamped value ≠ input, listing valid values. Fail-loud on asset authoring errors.

### LOW — L5: Bonus stale references in architecture.md

**Location:** architecture.md:117, :220
**Issue:** architecture.md:117 still said "13-step tick pipeline" (canonical is 14 per ADR-0001/0006/0011). architecture.md:220 still said "7 chase elements".
**Fix applied:** Both corrected (14-step, 8 chase).

### STRUCTURAL — S1: ADR-0006 ↔ ADR-0015 efficiency_modifier cycle

**Location:** adr-0006:41, adr-0015:26/189/197/283
**Issue:** Sub-agent flagged a dependency cycle: ADR-0006 says "formula defined in ADR-0015"; ADR-0015 depends on ADR-0006 (consumes efficiency_modifier).
**Verification:** No fix needed — this is a legitimate unidirectional consume→define relationship (ADR-0006 consumes the modifier, ADR-0015 defines it), consistent with project patterns. Both ADRs transition to Accepted together in this review.

### STRUCTURAL — S2: Fabricated TR-IDs

**Location:** adr-0013:35, adr-0015:36-37/89/122, tr-registry.yaml
**Issue:** ADR-0013 cited `TR-qualifying-001/007/008`; ADR-0015 cited `TR-car-def-005/008`. None of these IDs exist in tr-registry.yaml (the registry uses `TR-qual-XXX` and `TR-car-XXX` prefixes; only TR-qual-001..003 and TR-car-001..002 existed). Fabricated IDs would fail /story-readiness validation.
**Fix applied:**
- 5 real TR-IDs created in registry: TR-qual-004 (single flying lap format), TR-qual-005 (skip/fail → P16), TR-qual-006 (tier order not preserved), TR-car-003 (load-time validation), TR-car-004 (differentiation check) — all with source ADR references
- ADR-0013:35 corrected to TR-qual-004/005/006
- ADR-0015:36-37/89/122 corrected to TR-car-003/004

---

## Cross-ADR Consistency Scan (sub-agent)

- **Dependency graph:** 15 ADRs, no cycles beyond the legitimate S1 relationship. Dependency ordering respected (0001 root; 0002-0008 foundation; 0009-0015 consume foundation).
- **Engine compatibility:** All 15 ADRs verified against Unity 6000.3.19f1 pinned version. Post-cutoff APIs (linearVelocity, SimulationMode.Script, Physics.Simulate, RecordRenderGraph, ProcessEventsInDynamicUpdate) consistent across ADRs.
- **Terminology:** No residual "13-step" references in ADRs (only in historical review reports, which are preserved as written).
- **TR coverage:** +5 TRs created (qualifying 004-006, car 003-004). Registry now at 92 TR-IDs.

## GDD Revision Flags (Phase 5b)

| GDD | Flag | Resolution |
|-----|------|-----------|
| qualifying.md | Spawn model (pit exit → pit box + out-lap) | ✅ Applied (3 lines) |
| simulation-architecture.md | Qualifying spawn reference | ✅ Applied (line 170) |

## Traceability Update (Phase 2/3)

| ADR | TRs Addressed |
|-----|--------------|
| 0013 | TR-qual-001..006 (format, fuel load, no wear, session, skip/fail, tier order) |
| 0014 | TR-hud-001..003 (8 elements, data contracts, readability) |
| 0015 | TR-car-001..004 (16 teams/6 stats, formulas, validation, differentiation) |

## Required Actions Before Coding

None — all review findings corrected in-session.

## Validation Criteria

- [x] All 3 new ADRs internally consistent (post-fix)
- [x] No cross-ADR contradictions (M1 resolved; S1 legitimate)
- [x] All TR-IDs referenced by ADRs exist in tr-registry.yaml
- [x] Engine compatibility verified for all 15 ADRs
- [x] GDDs flagged for revision updated (qualifying, simulation-architecture)
- [x] architecture.md coverage updated to 15 ADRs

## Sign-off

- **Lead Agent:** Verdict PASS — all corrections applied in-session
- **Status transition requested:** ADR-0013, ADR-0014, ADR-0015 → Accepted
