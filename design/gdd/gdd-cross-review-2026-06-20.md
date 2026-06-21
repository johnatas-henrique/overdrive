# Cross-GDD Review Report

**Date:** 2026-06-20 (second run — post-fix verification)
**Skill:** `/review-all-gdds` (Phases 1–5)
**Verdict:** PASS — 0 BLOCKERS

---

## Scope

- **GDDs reviewed:** 24 system GDDs + game-concept.md + systems-index.md (26 total)
- **Registry:** 8 team entities, 1 constant (`physics.pitSpeedLimit = 80 km/h`)
- **Previous verdict:** FAIL (2 BLOCKERS, 15 WARNINGS) — all resolved and verified

---

## Phase 2: Cross-GDD Consistency

### Blocking

**None.** All 2 prior BLOCKERS (B-1 race.starting timing, B-2 pendingDNF not cleared on pit entry) verified fixed in race-management.md.

### Warnings

| ID  | GDD                     | Line                | Issue                                                                                  | Recommendation                                                   |
| --- | ----------------------- | ------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| W-1 | camera.md               | 241                 | `drone.skip_delay` still snake_case — escaped camelCase normalization pass             | Rename to `drone.skipDelay`                                      |
| W-2 | determinism-contract.md | 72–82               | FixedUpdatePipeline does not include Pit Stop at #8. Spatial detection note unresolved | Add Pit Stop as slot #8 or remove spatial detection placeholders |
| W-3 | fuel.md, tire-wear.md   | Interactions tables | AI Driver reads fuelLevel and tireCondition but is not listed as a consumer            | Add "AI Driver" row to Fuel and Tire Wear interactions           |

### Info

| ID  | GDD              | Issue                                                                                     |
| --- | ---------------- | ----------------------------------------------------------------------------------------- |
| I-1 | asset-manager.md | Dependencies section doesn't list Event Bus or GSM despite using both                     |
| I-2 | ai-driver.md:235 | mistakeChance formula can produce negative values at Hard difficulty                      |
| I-3 | ai-driver.md:207 | teamPerformance exceeds documented [0–1.0] range at Hard difficulty (1.20)                |
| I-4 | pit-stop.md:179  | AI pit trigger "critical" threshold undefined                                             |
| I-5 | tire-wear.md:193 | Lists Track+Environment as Hard dependency but offTrack data flows via Physics            |
| I-6 | systems-index.md | Dependency summaries incomplete for 5 GDDs (Camera, Fuel, Tire Wear, Collision, Pit Stop) |

---

## Phase 3: Game Design Holism

### Blocking

**None.** All checks pass.

### Warnings

| ID   | Check            | Issue                                                                                                                                                        | Recommendation                                                                                                              |
| ---- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| W-3a | Difficulty Curve | Default race length (3 laps) bypasses fuel/tire strategy — player finishes with ~25% fuel remaining at full throttle. Pillar 2 invisible at default settings | Consider defaulting to 5 laps when difficulty is Normal/Hard, or adding a UI hint about strategic depth at longer distances |
| W-3b | Difficulty Curve | 25% difficulty steps (0.8/1.0/1.2) are coarse. Gap between player's backmarker car and front-runners may conflict with "not punitive" anti-pillar            | Add Easy+ and Hard- steps (e.g. 0.85, 1.15) or leave for playtesting validation                                             |

### Info

| ID   | Check             | Observation                                                                                   |
| ---- | ----------------- | --------------------------------------------------------------------------------------------- |
| I-7  | Progression Loop  | Clear primary driver (speed + position). Fuel/tire subordinate resources, not competing loops |
| I-8  | Attention Budget  | 2–3 active systems, 3–4 glance monitors — well within budget                                  |
| I-9  | Dominant Strategy | No single dominant strategy. Push-and-pit vs coast-and-finish are genuine trade-offs          |
| I-10 | Economic Loop     | No in-race economy in Phase 1. All resources finite per race, reset between races             |
| I-11 | Pillar Alignment  | All 11 systems map to ≥1 pillar. All anti-pillars respected                                   |
| I-12 | Player Fantasy    | High coherence — 1991 F1 parody identity consistent across all layers                         |

---

## Phase 4: Cross-System Scenario Walkthrough

### Scenarios Walked

1. Race Start
2. Overtaking
3. Pit Stop Entry → Service → Exit
4. Fuel + Tire Interaction
5. Race End

### Blocking

**None.** All 5 scenarios produce clean interaction chains.

### Warnings

**None.** No cross-system interaction issues found.

### Info

| ID   | Scenario   | Observation                                                                                                                                                                                                                       |
| ---- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I-13 | Race Start | Confirm routing ownership ambiguous: Input.md says confirm → RM, RM.md confirms skip directly to GSM. Both converge functionally                                                                                                  |
| I-14 | Pit Stop   | DNF guard only checks `isInPitEntryZone` (spatial), not `pitState` — edge case if car runs dry during `departing` after early refuel exit. In practice, spline follower sets position directly, so `car.stopped` unlikely to fire |
| I-15 | Race End   | Tiebreaker (equal totalDistance → grid position) documented in edge cases but not implemented in `buildResults()` pseudocode                                                                                                      |
| I-16 | Race End   | Pipeline order: Pit Stop after RM → 1-tick latency for pit car positions in position grid. Acceptable for pit operations measured in seconds                                                                                      |

---

## Verdict: PASS

**Zero blocking issues.** All 2 prior BLOCKERS verified fixed. All 5 WARNINGS from the initial PASS resolved during handoff (difficulty expanded to 5 levels, default laps changed to 5, camera knob camelCase, pipeline slot fixed, AI Driver interactions added).

**Recommended next steps:**

1. Run `/consistency-check` — populate entity registry with any new cross-system constants
2. Run `/gate-check` — validate Systems Design → Technical Setup phase transition

---

## Warnings Resolved During Handoff

| ID   | Issue                                                     | Resolution                                                                     |
| ---- | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| W-1  | camera.md `drone.skip_delay` snake_case                   | Renamed to `drone.skipDelay`                                                   |
| W-2  | determinism-contract.md pipeline missing Pit Stop slot #8 | Added Pit Stop at #8, spatial detection moved to pre-Physics placeholder       |
| W-3  | fuel.md + tire-wear.md missing AI Driver in interactions  | AI Driver rows added to both tables                                            |
| W-3a | Default 3 laps bypasses fuel/tire strategy                | Default changed to 5 laps across single-race.md, menu-lite.md, game-concept.md |
| W-3b | 3 coarse difficulty steps (0.8/1.0/1.2)                   | Expanded to 5 levels: 0.75/0.875/1.0/1.125/1.25 across all GDDs                |
