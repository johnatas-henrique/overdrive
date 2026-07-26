# Cross-GDD Review Report

**Date:** 2026-07-25
**GDDs Reviewed:** 21 system GDDs + game-concept.md + systems-index.md
**Systems Covered:** Input, Simulation Architecture, Settings, Content Pipeline, Ghost Recording, Multiplayer Architecture, Vehicle Physics, Camera, HUD, Audio, Fuel, Tire, Pit Stop, Qualifying, AI Rival, Track, Car Definition Data, Race Session Manager, Grid & Start, VFX, UI Menu
**Review Mode:** Full (consistency + design theory)
**Verdict:** CONCERNS

---

## Consistency Issues

### Blocking (7)

**B1 — UI Menu Missing Tire/Fuel Dependencies**
- Check: 2a (Dependency Bidirectionality)
- Systems: Tire System, Fuel System → UI Menu
- UI Menu Dependencies section has no inbound entries for Tire or Fuel, yet both claim to output pre-race comparison data (Hard dependency). Tire GDD line 206: "Pre-race screen: Show tire wear rate comparison." Fuel GDD line 214: "Pre-race screen: Show fuel consumption rate comparison." UI Menu does not list either as a dependency.
- Resolution: Add Tire and Fuel as inbound Hard dependencies in UI Menu Dependencies section.

**B2 — Surface Wear Modifier Mismatch (Track vs Tire)**
- Check: 2b (Rule Contradictions)
- Systems: Track System, Tire System
- Track System surface table (line 85): off-track surfaces = 2.5 wear modifier. Tire System tuning knob (line 192): surface penalty (off-track) = 3.0. Tire System formula range (line 142): surface_penalty 1.0–2.5. Three-way conflict: Track says 2.5, Tire formula range caps at 2.5, Tire tuning knob says 3.0.
- Resolution: Align all three to the same value. If 2.5 is correct, update Tire tuning knob from 3.0 to 2.5. If 3.0 is correct, extend Tire formula range to [1.0, 3.0] and update Track surface table.

**B3 — Grid Display Timeout Four-Way Conflict**
- Check: 2b/2f (Rule Contradictions + AC Cross-Check)
- Systems: UI Menu, Qualifying, Grid & Start
- UI Menu core rules (line 54): "Grid Display after qualifying has Start Race button with no timeout and no Back option." But UI Menu AC (line 198): "Confirm is pressed or its 5-second timeout expires." Qualifying (line 69): "5 seconds OR player presses Confirm to skip." Grid & Start (line 53): "Duration: 5 seconds OR player presses Confirm to skip." Three GDDs say 5s, UI Menu core rules say "no timeout."
- Resolution: Clarify: post-qualifying Grid Display has no timeout (Start Race button only), post-skip Grid Display has 5s timeout. Update UI Menu AC-198 to distinguish these cases.

**B4 — Column Spacing Mismatch (Track vs Grid & Start)**
- Check: 2b/2d (Rule Contradictions + Ownership)
- Systems: Track System, Grid & Start
- Grid & Start (line 49): "Column spacing: 3.5m." Track System (line 102): "~8m between rows, 3.5m between columns." Track System tuning knob (line 221): "Grid column spacing: 2 m" with range 1.5–3 m. Grid & Start says 3.5m, Track core rules say 3.5m, but Track tuning knob says 2m with a range that excludes 3.5m.
- Resolution: Update Track System tuning knob from 2m to 3.5m and adjust range to 2.5–5m to match Grid & Start.

**B5 — Tire Formula Range Excludes Tuning Knob**
- Check: 2e (Formula Compatibility)
- Systems: Tire System (internal)
- Tire wear formula (line 142): surface_penalty range [1.0, 2.5]. Tire tuning knob (line 192): surface penalty (off-track) = 3.0. The tuning knob value exceeds the formula's declared range. If the formula clamps to 2.5, the tuning knob at 3.0 is inert.
- Resolution: Either extend formula range to [1.0, 3.0] or reduce tuning knob to 2.5. Must align with B2 resolution.

**B6 — Qualifying AC-242 Stale Tiebreaker**
- Check: 2f (AC Cross-Check)
- Systems: Qualifying (internal)
- AC-242 (line 242): "GIVEN two AI with identical times, WHEN tiebreak runs, THEN higher tier gets better position." But Core Rules (line 82), Formulas (line 170), Edge Cases (line 189), and AC-248 (line 248) all say stable `car_id` breaks ties. AC-242 is stale from a previous partial fix.
- Resolution: Update AC-242 to say stable `car_id` determines order, matching the rest of the GDD.

**B7 — game-concept vs Fuel Math Mismatch**
- Check: 3c/Concept (Dominant Strategy + Cross-cutting)
- Systems: game-concept.md, Fuel System
- game-concept.md (line 268): "In most 5-lap races, the player must pit to refuel — the tank does not last the full race at full throttle." game-concept.md Scope (line 294): "mandatory pit in most races." Fuel GDD math: worst Efficiency (4), full throttle = 0.018 L/s. 8L tank lasts 444s. Standard 5-lap race = 375s. Tank does NOT empty. Even the worst car at full throttle finishes without pitting.
- Resolution: game-concept.md is CORRECT — design intent is mandatory pits. Fuel GDD needs tuning: increase base_rate or decrease tank_size so worst-case full-throttle consumption empties the tank before race end. Target: ~80-90% of race distance at full throttle for worst Efficiency.

### Warnings (18)

**W1 — Vehicle Physics Missing VFX Consumer**
- Check: 2a
- Vehicle Physics Dependencies does not list VFX as a downstream consumer. VFX reads speed, grip state, and wall contact from Vehicle Physics.

**W2 — Track Missing VFX Consumer**
- Check: 2a
- Track Dependencies does not list VFX. VFX reads surface type from Track for dust particles.

**W3 — Content Pipeline → HUD Loading Progress Not Reciprocated**
- Check: 2a
- Content Pipeline lists HUD as outbound (loading progress). HUD Dependencies does not list Content Pipeline.

**W4 — systems-index Track Count vs Track GDD**
- Check: 2c (Stale Reference)
- systems-index (line 27): "1 track (MVP)." Track GDD Phase Scope (line 12): "MVP: Four tracks." Track GDD also lists Monaco, Silverstone, Spa, Monza in game-concept.md. Contradiction.

**W5 — Shared Tuning Knobs with Unclear Authority**
- Check: 2d
- Pit lane speed limit appears in both Track (line 215) and Pit Stop (line 197). Fuel fill rate appears in Fuel (line 201) and Pit Stop (line 194). Tire swap time appears in Tire (line 195) and Pit Stop (line 195). Authority is unclear.

**W6 — Fuel Tank Capacity Ownership**
- Check: 2e
- 8L tank capacity is stated in Fuel Core Rules but not in the Formula section's variable tables. It's a constant that should be explicitly owned.

**W7 — MVP Progression Loop Gap**
- Check: 3a
- MVP has no seat-ascension loop. Position-only feedback may not validate whether the career progression will feel earned.

**W8 — Player Attention Budget Exceeds Threshold**
- Check: 3b
- 5 concurrent active systems (driving, rivals, fuel, tire, pit timing) during core race loop. Recommended limit is 4.

**W9 — No-Pit Strategy May Dominate**
- Check: 3c
- Worst-Efficiency full-throttle consumption (6.75L of 8L) doesn't empty tank in 5 laps. Lift-and-coast makes pit optional for all cars.

**W10 — Lift-Off Rotation Has No Resource Cost**
- Check: 3c
- Lift-off rotation (release throttle while turning) has no fuel or tire penalty beyond the lift itself. May become a zero-cost dominant cornering technique.

**W11 — Low-Fuel Speed Bonus Creates Perverse Incentive**
- Check: 3d
- Fuel < 25% gives +1% top speed. Players may target 24% fuel for permanent speed benefit, undermining resource anxiety.

**W12 — Tire Degradation Positive Feedback Loop**
- Check: 3d
- Wear → grip loss → sliding → more wear. Bounded by grip_floor 0.20 but may create a sudden "grip cliff" if base wear rate is miscalibrated.

**W13 — Multiplayer Architecture Pillar Mismatch**
- Check: 3f
- Header says "Implements Pillar: Speed You Can Feel" but Player Fantasy section claims "Every Short Race Matters" + "Earn the Next Seat."

**W14 — Fuel/Tire Per-Lap Delta Ownership Clarity**
- Check: 2b
- Both Fuel and Tire snapshot per-lap deltas at LapCompleted. No conflict, but the ownership boundary (who calculates consumption vs who owns the delta) could be clearer.

**W15 — Settings Dead-Zone Field Naming**
- Check: 2c
- Settings stores `stick_dead_zone_inner`; Input System uses the same name. Naming matches but field ownership in Settings schema could be explicit.

**W16 — EMA Alpha Dual Definition**
- Check: 2d
- EMA alpha knobs defined in both Input System and Settings Tuning Knobs with identical ranges. Settings owns persistence, Input owns defaults.

**W17 — Fuel Bar Color Boundary Language**
- Check: 2f
- HUD says "green > 50%, yellow 25-50%, red < 25%." Fuel says "Full: 100%-50%, Conserving: 50%-25%, Critical: <25%." Boundaries match but language differs on inclusivity at 50%.

**W18 — Very Easy AI May Be Comically Erratic**
- Check: 3e
- Very Easy: AI error 1.5×, pace noise ±8%. May produce visibly erratic behavior rather than believably easier competition.

---

## Game Design Issues

### Blocking (1)
B7 (same as Consistency B7)

### Warnings (6)
W7–W13 (listed above)

---

## Cross-System Scenario Issues

Scenarios walked: 5 (Race Core Loop, Pit Stop, Qualifying→Race Transition, Finish Resolution, Difficulty Propagation)

### Blockers
None.

### Warnings
None.

### Info
ℹ️ **Race Core Loop** — Tire System reads `slideState` from `TickStartSnapshot` (prior tick's CarState), creating a 1-tick delay in the tire wear aggression multiplier. By design but worth noting for tuning.

---

## GDDs Flagged for Revision

| GDD | Reason | Type | Priority |
|-----|--------|------|----------|
| tire-system.md | surface_penalty formula range excludes tuning knob; surface wear modifier mismatch with Track | Consistency | Blocking |
| track-system.md | Column spacing tuning knob 2m conflicts with Grid & Start 3.5m; surface wear 2.5 conflicts with Tire tuning 3.0 | Consistency | Blocking |
| grid-start.md | Column spacing 3.5m conflicts with Track tuning knob 2m | Consistency | Blocking |
| qualifying.md | AC-242 stale tiebreaker (says tier, rules say car_id) | Consistency | Blocking |
| ui-menu.md | Missing Tire/Fuel deps; Grid Display timeout "no timeout" conflicts with AC 5s | Consistency | Blocking |
| game-concept.md | "Mandatory pit" claim — confirmed CORRECT by user. Design intent is mandatory pits. Fuel GDD needs tuning to match. | Design Theory | Resolved (no change needed) |
| fuel-system.md | Base rate must be tuned so worst-Efficiency full-throttle empties tank before race end. Design intent (game-concept) is mandatory pits. | Design Theory | Blocking |
| multiplayer-architecture.md | Header pillar contradicts own Player Fantasy text | Design Theory | Warning |

---

## Session State

- Verdict: CONCERNS
- GDDs reviewed: 23
- Flagged for revision: tire-system, track-system, grid-start, qualifying, ui-menu, fuel-system, multiplayer-architecture
- Blocking issues: 7 (B1-B6 consistency + B7 Fuel tuning to match game-concept design intent)
- Recommended next: Fix blocking issues, then re-run /review-all-gdds or proceed to /create-architecture
