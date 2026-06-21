# Consistency Check Report

**Date:** 2026-06-20
**Skill:** `/consistency-check`
**Registry entries:** 8 entities, 0 items, 0 formulas, 1 constant
**GDDs scanned:** 26 system GDDs

---

## Conflicts Found

None. All 9 registered entries verified across all GDDs with zero conflicts.

## Clean Entries

✅ 9/9 registry entries — see details below:

| Type     | Name                  | Registry Value         | Verified In                                                                                                                                                   |
| -------- | --------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity   | macklen               | tp=1.00, Front-runner  | ai-driver.md (source). Referenced as teamId in entity-car-lifecycle.md, asset-manager.md, data-config-manager.md, telemetry-recorder.md — no value conflicts. |
| Entity   | willard               | tp=0.95, Front-runner  | ai-driver.md (source). Referenced as teamId elsewhere — no value conflicts.                                                                                   |
| Entity   | ferrell               | tp=0.63, Podium threat | ai-driver.md (source).                                                                                                                                        |
| Entity   | bennett               | tp=0.53, Midfield      | ai-driver.md (source).                                                                                                                                        |
| Entity   | jordash               | tp=0.31, Midfield      | ai-driver.md (source).                                                                                                                                        |
| Entity   | tyrant                | tp=0.29, Midfield      | ai-driver.md (source).                                                                                                                                        |
| Entity   | lorris                | tp=0.15, Backmarker    | ai-driver.md (source).                                                                                                                                        |
| Entity   | laytonHall            | tp=0.08, Backmarker    | ai-driver.md (source).                                                                                                                                        |
| Constant | physics.pitSpeedLimit | 80 km/h                | physics-handling.md (source). Referenced in pit-stop.md — same value.                                                                                         |

## Unverifiable References (no conflict, informational)

- entity-car-lifecycle.md: `teamId: string` — type constraint only, no numeric value
- asset-manager.md: `get('car.macklen')` — asset path, no performance attribute
- data-config-manager.md: `get('teams.macklen.motor')` — config path, no performance attribute
- telemetry-recorder.md: `"macklen": { "...": "..." }` — telemetry schema, no performance value

**Verdict: PASS**
