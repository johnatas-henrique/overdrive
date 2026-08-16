# Gate Check: Technical Setup → Pre-Production

> **Date:** 2026-07-28
> **Verdict:** CONCERNS
> **Mode:** full (all 4 directors spawned)

---

## Director Panel

| Director | Verdict | Summary |
|----------|---------|---------|
| Creative Director | CONCERNS | Pillars sound, 2 minor doc items remaining |
| Technical Director | CONCERNS | Architecture sound, C1/C2 already resolved, 5 doc fixes + test scaffold |
| Producer | CONCERNS | MVP realistic, architecture review needs re-run, HUD/Qualifying ADRs needed |
| Art Director | READY | Art bible fully actionable, no blockers |

---

## Sprint 0 Closure Checklist (must complete before re-running gate)

### Fix 1 — architecture.md pipeline heading

**File:** `docs/architecture/architecture.md`
**Line ~227:** Change `13-Step Tick Pipeline` → `14-Step Tick Pipeline`
**Reason:** Pipeline was expanded from 13 to 14 steps when ADR-0011 added Step 9b. The body already shows14 steps but the heading is stale.

### Fix 2 — architecture.md ADR count header

**File:** `docs/architecture/architecture.md`
**Line ~7:** Change `All 11 ADRs (0001-0011)` → `All 12 ADRs (0001-0011, 0013)`
**Reason:** ADR-0013 (Audio System) was created but the header wasn't updated.

### Fix 3 — architecture.md ADR Audit section

**File:** `docs/architecture/architecture.md`
**Lines ~533-545:** The ADR Audit table only covers ADR-0001. Add audit rows for ADR-0002 through ADR-0013.
**Reason:** Incomplete audit — all12 ADRs should be listed.

### Fix 4 — ADR-0001: Add resultClassification enum

**File:** `docs/architecture/adr-0001-manual-simulation-authority-and-determinism-boundary.md`
**Action:** Add `resultClassification` enum definition (Finished, DNF, Forfeit) to the RSM interaction section.
**Reason:** TR-rsm-010 is a GAP in the traceability matrix — no ADR covers the resultClassification enum.

### Fix 5 — Test scaffold

**Action:** Run `/test-setup` to create:
- `tests/EditMode/` with `.asmdef`
- `tests/PlayMode/` with `.asmdef`
- `.github/workflows/tests.yml` CI workflow
- At least one example test file

**Reason:** Required artifact for Pre-Production gate. Package `com.unity.test-framework 1.6.0` is installed but no test directories exist.

### Fix 6 — UX interaction patterns init

**Action:** Create `design/ux/interaction-patterns.md` with minimal structure (pattern names, empty sections).
**Reason:** Required artifact for Pre-Production gate.

### Fix 7 — Concept year alignment

**File:** `design/gdd/game-concept.md`
**Action:** Change "Based on Super Monaco GP (1990)" → "Based on Super Monaco GP (1990–91 era)"
**Reason:** Art bible says "in-game year is 1991" — align both documents.

---

## After completing Fixes 1-7

1. Re-run `/architecture-review` in the other session → expect PASS (C1/C2 already resolved in ADRs)
2. Come back to this session
3. Re-run `/gate-check` → should now pass all artifact and quality checks

---

## What is already DONE (confirmed by TD reading actual ADR files)

- ✅ C1 (interpolation wording) — ADR-0001 has "Interpolation Phases (LateUpdate)" section; ADR-0010 references it
- ✅ C2 (audio volume) — ADR-0004 AudioSettings now has `UiVolume` field
- ✅ C3 (RefreshRate) — ADR-0004 line 181 uses `new RefreshRate { numerator, denominator }`
- ✅ C5 (Audio ADR) — ADR-0013 exists, Accepted, references ADR-0003 in Depends On

---

## Non-blocking recommendations (Pre-Production Sprint 1+)

These do NOT block the gate but should be planned:

1. **HUD ADR** — 40% coverage, plan for Sprint 1-2
2. **Qualifying ADR** — 4 gaps, plan for Sprint 1
3. **6-month checkpoint** — put on sprint calendar from day one
4. **Content pipeline validation** — first track through GPX→Python→JSON→Addressables in Sprint 1
5. **TD-on-call rule** — stories blocked by missing arch decisions escalate same day
