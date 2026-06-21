# Cross-GDD Review Report — Foundation (MVP Phase 0)

**Date:** 2026-06-18
**GDDs Reviewed:** 9
**Systems Covered:** Data & Config Manager, Event Bus, Game State Machine, Persistence, Simulation Snapshot, Asset Manager, Entity/Car Lifecycle, Dev Tools, Determinism Contract
**Scope:** MVP Phase 0 — Foundation (pure infrastructure)

---

## Summary

Review of all 9 Foundation GDDs. Infrastructure-only systems, no gameplay — focus on dependency consistency, naming, and systems-index alignment. No blocking issues found.

---

### Consistency Issues

#### ⚠️ Incomplete dependency mapping in systems-index.md

| System                   | Missing dependency       | Detail                                |
| ------------------------ | ------------------------ | ------------------------------------- |
| **Entity/Car Lifecycle** | Asset Manager (#6)       | GDD lists it; systems-index does not. |
| **Dev Tools**            | GSM (#3)                 | GDD lists it; systems-index does not. |
| **Dev Tools**            | Simulation Snapshot (#5) | GDD lists it; systems-index does not. |

#### ⚠️ Incorrect system numbers in Dev Tools GDD

- Event Bus labelled `(#3)` → should be `(#2)`
- GSM labelled `(#4)` → should be `(#3)`
- Simulation Snapshot labelled `(#6)` → should be `(#5)`

#### ⚠️ "Developer Velocity" declared as a non-existent pillar

Dev Tools GDD line 6: `Implements Pillar: Developer Velocity`. This pillar does not exist in the four product pillars defined in game-concept.md (Speed That Is Felt, Simple Strategy Real Decisions, Racing Is Progression, Grid of Personalities). All other Foundation GDDs correctly use `Foundation — ...`.

#### ℹ️ Duplicate "Log level" knob name

Asset Manager and Dev Tools both define a `Log level` tuning knob. Same name, different domains (asset loading vs overlay output). Naming confusion only — no functional conflict.

#### ℹ️ Empty entity registry

`design/registry/entities.yaml` exists but is empty. Expected for Phase 0 — no gameplay entities defined yet. Will be populated when Phase 1 GDDs are written.

---

### Game Design Holism

No issues. All 9 GDDs are pure infrastructure — no gameplay formulas, economy loops, difficulty curves, dominant strategies, or player fantasy conflicts.

---

### GDDs Flagged for Revision

| GDD              | Reason                                    | Type          | Priority |
| ---------------- | ----------------------------------------- | ------------- | -------- |
| dev-tools.md     | Incorrect dependency numbers              | Documentation | ⚠️       |
| dev-tools.md     | "Developer Velocity" is not a game pillar | Consistency   | ⚠️       |
| systems-index.md | 3 missing dependencies                    | Consistency   | ⚠️       |

---

### Verdict: CONCERNS

No blocking issues. Safe to proceed with implementation. Corrections applied before code starts.
