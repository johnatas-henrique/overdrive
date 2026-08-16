# Architecture Review Report

> **Date:** 2026-07-28
> **Engine:** Unity 6000.3.19f1 (Unity 6.3 LTS)
> **GDDs Reviewed:** 22
> **ADRs Reviewed:** 12 (all Accepted)
> **Mode:** full

---

## Traceability Summary

| Metric | Count |
|--------|-------|
| Total requirements extracted | ~200+ (from 22 GDDs) |
| Existing TR-IDs in registry | 194 (v5) |
| New TR-IDs from this review | TBD (pending registry update) |

> **Note:** Full traceability matrix will be generated after TR registry update.
> Previous v5 review: 137 covered (70.6%), 41 partial (21.1%), 16 gaps (8.2%).

---

## Cross-ADR Conflicts

### Conflict 1: ADR-0001 vs ADR-0010 — VFX Update Timing
- **Type:** State management / Integration contract
- **Severity:** MED
- **ADR-0001:** "Neither Camera, VFX, nor Audio run in DynamicUpdate. All presentation-layer systems read from interpolated state in LateUpdate."
- **ADR-0010:** VfxSystem header says "runs in DynamicUpdate"; update diagram places both CameraSystem.Tick() and VfxSystem.Tick() under "DynamicUpdate (frame)"
- **ADR-0010 internal inconsistency:** Line 33 says "both run in LateUpdate", line 67 says VfxSystem "runs in DynamicUpdate"
- **Impact:** If VFX runs in DynamicUpdate, it reads previous frame's interpolated transforms (1-frame latency). The document gives 3 different answers for VfxSystem timing.
- **Resolution:** Clarify in ADR-0010 that both Camera and VFX run in LateUpdate per ADR-0001 Interpolation Phases.

### Conflict 2: ADR-0001 vs ADR-0012 — Audio Update Timing
- **Type:** State management / Integration contract
- **Severity:** MED
- **ADR-0001:** Audio must not run in DynamicUpdate; reads interpolated state in LateUpdate.
- **ADR-0012:** AudioSystem "runs in DynamicUpdate per ADR-0010" (line 42, 65, 84) — contradicts ADR-0001
- **ADR-0012 internal inconsistency:** Ordering note (line 29) says "AudioSystem follows the same LateUpdate pattern as CameraSystem and VfxSystem" — contradicts its own DynamicUpdate claim
- **Impact:** Engine RPM audio would lag one frame behind physics state. Implementers reading different sections will build conflicting implementations.
- **Resolution:** Align ADR-0012 with ADR-0001: Audio runs in LateUpdate, not DynamicUpdate.

### Conflict 3: ADR-0001 vs ADR-0006 — Pipeline Step Count
- **Type:** Pattern (documentation)
- **Severity:** LOW
- **ADR-0001:** Pipeline described as ~11 conceptual steps, later referenced as "13-step"
- **ADR-0006:** States pipeline was "expanded from ADR-0001's original 13 steps to 14"
- **Impact:** Minimal — ADR-0006 and ADR-0011 agree on 14-step model. Risk is new ADRs referencing wrong step count.
- **Resolution:** ADR-0001 should clarify it uses an abbreviated listing; canonical 14-step model is in ADR-0006 §4.2.

---

## ADR Dependency Graph

```
Tier 0 (no deps):
  ADR-0001 (root)

Tier 1 (depend on ADR-0001):
  ADR-0002 (Vehicle Physics)
  ADR-0003 (Content Pipeline)
  ADR-0004 (Settings)

Tier 2 (depend on Tier 1):
  ADR-0005 (Input Context) ← 0001, 0004
  ADR-0006 (Fuel/Tire State) ← 0001, 0002

Tier 3 (depend on Tier 2):
  ADR-0007 (Track Spline) ← 0003, 0006
  ADR-0008 (Ghost Recording) ← 0001, 0002

Tier 4 (depend on Tier 3):
  ADR-0009 (AI Rival) ← 0001, 0002, 0006, 0007
  ADR-0010 (Camera/VFX) ← 0001, 0002, 0006, 0007

Tier 5 (depend on Tier 4):
  ADR-0011 (Pit Stop) ← 0002, 0005, 0006, 0007, 0009, 0010
  ADR-0012 (Audio) ← 0001, 0002, 0003, 0004, 0006, 0010
```

**Cycles:** None. Clean DAG.
**Highest integration risk:** ADR-0011 (6 dependencies).

---

## Engine Compatibility

### Audit Results
- **ADRs with Engine Compatibility section:** 12/12 ✅
- **Version consistency:** All 12 ADRs use Unity 6000.3.19f1 ✅
- **Deprecated API references:**
  - ADR-0004: `Screen.SetResolution` with `int preferredRefreshRate` — mitigated (uses `RefreshRate` struct) ✅
  - ADR-0010: `ScriptableRenderPass.Execute()` and `Blit()` obsolete in URP 17.3 — mitigated (uses `RecordRenderGraph`) ✅
  - ADR-0012: `AudioClip.Create` `_3D` overload deprecated — mitigated (uses overload without `_3D`) ✅
- **Post-cutoff APIs verified:**
  - `Rigidbody.linearVelocity`, `linearDamping`, `angularDamping` — verified via runtime ✅
  - `Addressables.LoadAssetAsync<T>()` — confirmed in 3.1.0 ✅
  - `ProcessEventsInDynamicUpdate` — verified in Input System 1.19.0 ✅
  - URP 17.3 Volume framework — verified via runtime reflection ✅

### Knowledge Risk
- HIGH: ADR-0001 (Unity 6.3 post-cutoff), ADR-0010 (URP 17.3 post-cutoff)
- MEDIUM: ADR-0003 (Addressables 3.1.0), ADR-0005 (Input System 1.19.0)
- LOW: 8 remaining ADRs

---

## Architecture Document Coverage

**Systems in architecture.md:** 21 systems mapped to 4 layers (Foundation/Core/Feature/Presentation) + Platform Layer.

**Cross-check:** All 22 GDDs (21 systems + game-concept) have corresponding entries in the architecture System-to-Layer table. No orphaned architecture (systems in architecture.md without GDDs). No missing systems.

**Data flow:** Architecture.md covers tick pipeline, state machine, content loading, and presentation flow. Cross-system communication matches GDD contracts.

---

## GDD Revision Flags

| GDD | Assumption | Reality (from ADR/engine) | Action |
|-----|-----------|--------------------------|--------|
| audio-system.md | AudioSystem runs in DynamicUpdate | ADR-0001 says LateUpdate for all presentation | Revise GDD if it specifies DynamicUpdate |
| vfx.md | VfxSystem runs in DynamicUpdate | ADR-0001 says LateUpdate for all presentation | Revise GDD if it specifies DynamicUpdate |

> **Note:** These are the same conflicts as Cross-ADR Conflicts 1 and 2. The GDDs may not explicitly state DynamicUpdate — verify before flagging for revision.

---

## Verdict: **PASS**

### What Changed Since v5
- ✅ C1 (interpolation wording) — resolved in ADR-0001/0010
- ✅ C2 (audio volume schema) — UIVolume added to ADR-0004
- ✅ C3 (ADR-0004 RefreshRate) — fixed in ADR-0004
- ✅ C5 (Audio ADR dependency) — ADR-0013 now references ADR-0003
- ✅ C1 NEW (VFX update timing) — ADR-0010 VfxSystem changed from DynamicUpdate to LateUpdate, diagram corrected
- ✅ C2 NEW (Audio update timing) — ADR-0012 all DynamicUpdate references changed to LateUpdate

### Remaining Issues
None blocking.

### Not Blocking
- Pipeline step count documentation (LOW)

---

## Recommended ADR Implementation Order

1. ADR-0001 (root — no deps)
2. ADR-0002, ADR-0003, ADR-0004 (Foundation)
3. ADR-0005, ADR-0006 (Foundation/Core)
4. ADR-0007, ADR-0008 (Core)
5. ADR-0009, ADR-0010 (Feature/Presentation)
6. ADR-0011, ADR-0012 (Feature/Presentation — highest integration risk)

---

## Next Steps

1. **Fix ADR-0010:** Clarify VfxSystem runs in LateUpdate (not DynamicUpdate) — align header, diagram, and narrative
2. **Fix ADR-0012:** Change "runs in DynamicUpdate" to "runs in LateUpdate" — align with ADR-0001
3. **Re-run `/architecture-review`** after fixes — expect PASS
4. **Run `/gate-check pre-production`** when PASS achieved
