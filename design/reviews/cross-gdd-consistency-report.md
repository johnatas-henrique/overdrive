# Cross-GDD Consistency Report — Overdrive

**Review**: Phase 2 of /review-all-gdds
**Date**: 2026-07-26
**Method**: Full read of all 21 system GDDs + game-concept.md + systems-index.md
**GDDs analyzed**: input-system, simulation-architecture, settings, content-pipeline, ghost-recording, multiplayer-architecture, vehicle-physics, camera, hud, audio-system, fuel-system, tire-system, pit-stop, qualifying, ai-rival, track-system, car-definition-data, race-session-manager, grid-start, vfx, ui-menu
**Status**: 9 BLOCKING (🔴), 12 WARNING (⚠️)

---

## 2a: Dependency Bidirectionality

For every GDD's Dependencies section, checked that each listed dependency is reciprocal in the target GDD.

### 🔴 TiR-01: Tire System → UI Menu not reciprocated

| Field | Value |
|-------|-------|
| **Systems** | Tire System, UI Menu |
| **Source** | `design/gdd/tire-system.md` — Dependencies table (line ~182): `UI Menu: Outbound, Tire wear rate comparison, Hard` |
| **Missing** | `design/gdd/ui-menu.md` — Dependencies table (lines 155-167): lists Settings, Track, Car Definition Data, Qualifying, RSM, Simulation Architecture, Camera, Audio, Content Pipeline, Input System. **Does not list Tire System or Fuel System.** |
| **What it is** | Tire System claims it outputs wear-rate comparison data to UI Menu for the pre-race screen (`"Displays the pre-race tire comparison"`). UI Menu's Dependencies and Interactions tables have no inbound from Tire. No mention of tire comparison UI anywhere in UI Menu's screen specifications. |
| **Impact** | Pre-race tire comparison data has no documented consumption path. |

### 🔴 FuR-01: Fuel System → UI Menu not reciprocated

| Field | Value |
|-------|-------|
| **Systems** | Fuel System, UI Menu |
| **Source** | `design/gdd/fuel-system.md` — Interactions table: `UI Menu: Outbound, Fuel rate comparison data, Displays the pre-race fuel comparison` |
| **Missing** | Same as TiR-01 — UI Menu lacks inbound from Fuel System |
| **Impact** | Pre-race fuel comparison data has no documented consumption path. |

### ⚠️ VP-01: Vehicle Physics does not list VFX as a consumer

| Field | Value |
|-------|-------|
| **Systems** | Vehicle Physics, VFX |
| **Source** | `design/gdd/vfx.md` — Dependencies (line 205): `Vehicle Physics: Inbound (Hard) — Speed, grip, wall contact drives all VFX` |
| **Missing** | `design/gdd/vehicle-physics.md` — Interactions table (lines 205-220): lists Simulation, Settings, Fuel, Tire, Camera, HUD, Audio, AI Rival, Ghost, Multiplayer, Car Def, Grid & Start, Track, Pit Stop. **No VFX entry.** |
| **Impact** | The hard dependency that VFX places on Vehicle Physics (speed, grip, wall contact) is not acknowledged by Vehicle Physics. |

### ⚠️ TiR-02: Tire System does not list VFX as a consumer

| Field | Value |
|-------|-------|
| **Systems** | Tire System, VFX |
| **Source** | `design/gdd/vfx.md` — Dependencies (line 209): `Tire System: Inbound (Soft) — Wear % drives smoke intensity` |
| **Missing** | `design/gdd/tire-system.md` — Dependencies table: lists Vehicle Physics, Fuel, Track, Pit Stop, HUD, Audio, Settings, AI Rival, Car Definition Data, Race Session Manager, **but not VFX**. |
| **Impact** | The soft dependency from VFX on tire wear data is not reciprocated. |

### ⚠️ Trk-01: Track System does not list VFX as a consumer

| Field | Value |
|-------|-------|
| **Systems** | Track System, VFX |
| **Source** | `design/gdd/vfx.md` — Dependencies (line 206): `Track: Inbound (Hard) — Surface type drives dust` |
| **Missing** | `design/gdd/track-system.md` — Dependencies table (lines 194-207): lists Vehicle Physics, Tire, Fuel, Camera, AI Rival, HUD, Content Pipeline, Simulation Architecture, RSM, Pit Stop, Grid & Start, Qualifying. **No VFX entry.** |
| **Impact** | The hard dependency VFX places on Track surface data is not acknowledged by Track System. |

### ⚠️ CP-01: Content Pipeline → HUD not reciprocated

| Field | Value |
|-------|-------|
| **Systems** | Content Pipeline, HUD |
| **Source** | `design/gdd/content-pipeline.md` — Dependencies (line 212): `HUD: Outbound (Soft) — loading progress percentage` |
| **Missing** | `design/gdd/hud.md` — Dependencies table: lists Fuel, Tire, Vehicle Physics, RSM, Simulation, Car Definition Data, Ghost Recording, Input System, Camera, Track, Pit Stop, Settings. **No Content Pipeline entry.** |
| **Impact** | Minor — loading progress HUD element has no documented consumption source. |

### ⚠️ Cam-01: Camera→HUD direction label mismatch (Soft vs Hard)

| Field | Value |
|-------|-------|
| **Systems** | Camera, HUD |
| **Source** | `design/gdd/camera.md` — Dependencies: `HUD: Downstream (Soft) — Camera mode, FOV → HUD layout adaptation` |
| **vs** | `design/gdd/hud.md` — Dependencies: `Camera: Inbound (Hard) — Camera mode, FOV, position` |
| **What it is** | Camera classifies the HUD dependency as Soft; HUD classifies the same dependency as Hard. |
| **Impact** | Minor label inconsistency. If this data is truly required for HUD layout (e.g., cockpit overlay positioning), it is Hard. |

---

## 2b: Rule Contradictions

For each game rule, mechanic, or constraint, checked for contradicting definitions across GDDs.

### 🔴 Trk-02 / TiR-03: Off-track surface wear modifier mismatch (2.5 vs 3.0)

| Field | Value |
|-------|-------|
| **Systems** | Track System, Tire System |
| **Source 1** | `design/gdd/track-system.md` — Surface Types table (lines 79-86): Wear modifier for Gravel/Grass/Runoff = **2.5**. Also AC line 248: *"Track-provided surface wear modifier is 2.5× the on-track rate."* |
| **Source 2** | `design/gdd/tire-system.md` — Tuning Knobs (line 192): `Surface penalty (off-track) | Current Value: **3.0** | Safe Range: 1.5–5.0`. But `design/gdd/tire-system.md` — Formula variable table: `surface_penalty | float | **1.0–2.5** | Asphalt=1.0, kerb=1.2, off-track=2.5`. |
| **Contradiction** | Track says off-track wear modifier = **2.5**. Tire system's tuning knob says **3.0**. Additionally, Tire system's own formula range (1.0–2.5) excludes its own tuning knob value (3.0). |
| **Impact** | If Track provides 2.5 and Tire expects 3.0 (or vice versa), tire wear rate will differ from the authored balance. The formula range and tuning value are mutually contradictory **within the same GDD**. |

### 🔴 UI-01: Grid Display timeout — UI Menu contradicts itself + Qualifying + Grid & Start

| Field | Value |
|-------|-------|
| **Systems** | UI Menu, Qualifying, Grid & Start |
| **Source 1** | `design/gdd/ui-menu.md` — Navigation Rules (line 54): *"Grid Display after qualifying has **Start Race button with no timeout** and no Back option."* |
| **Source 2** | `design/gdd/ui-menu.md` — AC-199 (line 198): *"WHEN Confirm is pressed or its **5-second timeout** expires, THEN UI sends StartRaceRequested."* |
| **Source 3** | `design/gdd/qualifying.md` — Post-Qualifying Screen (line 69): *"Start Race button (Confirm/Enter/South) — no retry option; auto-advances after **5 seconds** per Grid & Start."* |
| **Source 4** | `design/gdd/grid-start.md` — Grid Display state (line 97): *"Duration: **5s or skip**."* |
| **Contradiction** | UI Menu Navigation Rules say **no timeout** after qualifying. UI Menu AC-199 says **5-second timeout** (all cases). Qualifying says auto-advances after **5 seconds**. Grid & Start says **5s or skip**. Four-way inconsistency: UI Menu Rules disagree with UI Menu AC, Qualifying, and Grid & Start. |
| **Impact** | Implementation ambiguity: either the post-qualifying grid waits indefinitely for player input, or it auto-advances after 5 seconds. The Qualifying and Grid & Start GDDs consistently say 5s timeout; the UI Menu Navigation Rules are the outlier. |

### ⚠️ Trk-03: Track System internal column spacing contradiction

| Field | Value |
|-------|-------|
| **Systems** | Track System (internal) |
| **Source** | `design/gdd/track-system.md` — Core Rules section 5 (line 103): *"Standard F1 grid spacing: ~8m between rows, **3.5m between columns**"* |
| **vs** | `design/gdd/track-system.md` — Tuning Knobs (line 221): `Grid column spacing | **2 m** | 1.5–3 m` |
| **Contradiction** | Track's own description says 3.5m column spacing, but its Tuning Knob says 2m with range 1.5–3m. The tuning knob safe range (max 3m) cannot accommodate the described value (3.5m). |
| **Impact** | If the tuning knob is authoritative, grid columns will be 1.5m narrower than described. If the description is authoritative, the tuning knob range is wrong. |

### ⚠️ Settings-01: Camera labels Reduced Motion effects differently

| Field | Value |
|-------|-------|
| **Systems** | Settings, Camera, VFX |
| **Source 1** | `design/gdd/settings.md` — Camera tab: Reduced Motion forces shake, look-ahead, dynamic FOV, and **Motion Blur** off. AC-CAM6: *"Motion Blur is saved On and Reduced Motion is enabled then disabled... Motion Blur returns to the working On preference."* |
| **Source 2** | `design/gdd/camera.md` — Reduced Motion (line 67): *"camera shake amplitude is 0°, look-ahead is 0 m, and dynamic FOV is disabled"*. **No mention of Motion Blur.** |
| **Source 3** | `design/gdd/vfx.md` — Reduced Motion: *"Motion Blur is forced Off and Camera suppresses shake, dynamic FOV, and look-ahead."* |
| **Observation** | VFX acknowledges Motion Blur is part of Reduced Motion. Camera does not. Settings' Camera tab includes the Motion Blur toggle, so it's natural for Settings to mention it — but Camera's own Reduced Motion description should also note that Motion Blur is suppressed. |
| **Impact** | Low — VFX correctly describes the suppression. Camera's silence on Motion Blur in Reduced Motion is an omission, not a contradiction. |

---

## 2c: Stale References

For every cross-document reference, verified the referenced element still exists in the target GDD with the same name and behavior.

### ⚠️ SI-01: systems-index.md says "1 track (MVP)" vs actual scope

| Field | Value |
|-------|-------|
| **Systems** | Systems Index, Track System |
| **Source** | `design/gdd/systems-index.md` — Track row (line 27): `1 track (MVP), spline architecture, surface types` |
| **vs** | `design/gdd/track-system.md` — Phase Scope (line 12): `MVP: **Four tracks**, spline data, surfaces, pit lane, grid positions, and local race geometry.` |
| **What it is** | The systems index (status: Draft, last updated 2026-07-25) says "1 track" but the Track System GDD (status: Revised, same date) says "Four tracks". The index was probably not updated after the Track GDD revision. |
| **Impact** | Minor — systems index is for planning, not contract. But the mismatch suggests the index is stale. |

### ⚠️ Trk-04: Track column spacing (description 3.5m vs tuning 2m) — also a stale reference

Already documented under Trk-03 / 2b. The description in Core Rules §5 references "Standard F1 grid spacing" data; the Tuning Knob has drifted from it.

### ⚠️ UI-02: UI Menu's Screen Specifications mention only 4 tracks

| Field | Value |
|-------|-------|
| **Source** | `design/gdd/ui-menu.md` — Track Selection screen (line 61): *"4 track cards with map layout, name, distance, elevation"*, footnoted `Monaco, Silverstone, Spa, Monza` |
| **vs** | `design/gdd/track-system.md` — Phase Scope: MVP = Four tracks. Also Alpha = four tracks; Beta = eight or more; Release = sixteen. |
| **What it is** | UI Menu lists specific track names including Monza. Track GDD does not name specific tracks. This is cross-referencing compatible as long as the UI tracks correspond to the Track System's data-driven track list. Not a contradiction, but the hardcoded list in UI Menu could become stale if track names change. |
| **Impact** | Low — track list is data-driven per Track GDD, so UI Menu will display whatever tracks exist. |

---

## 2d: Data and Tuning Knob Ownership Conflicts

Scan all Tuning Knobs sections across all GDDs and flag duplicates (two GDDs claiming to own the same tuning knob).

### ⚠️ Pit-01 / Trk-05: Pit lane speed limit — Track System AND Pit Stop

| Knob | Track System | Pit Stop |
|------|-------------|----------|
| Pit lane speed limit | 80 km/h (range 60–120) | 80 km/h (range 60–120) |

Both list identical values and ranges. The Track System should provide the physical limit; Pit Stop could reference it rather than duplicate it. The values match, so no gameplay conflict — but design authority is split.

### ⚠️ Pit-02 / FuR-02: Fuel fill rate — Fuel System AND Pit Stop

| Knob | Fuel System | Pit Stop |
|------|-------------|----------|
| Fuel fill rate | 0.8 L/s (fixed MVP) | 0.8 L/s (fixed MVP) |

Same knob claimed by both. Values are identical. Fuel System should own the fill rate since it owns fuel volume; Pit Stop should reference it.

### ⚠️ Pit-03 / TiR-04: Tire swap time — Tire System AND Pit Stop

| Knob | Tire System | Pit Stop |
|------|-------------|----------|
| Tire swap time | 2 s (range 1–4 s) | 2 s (range 1–4 s) |

Same knob claimed by both. Values match. Tire System should own the swap time since it owns tire mechanics; Pit Stop should reference it.

### ⚠️ Pit-04 / AiR-01: AI resource safety margin — AI Rival AND Pit Stop

| Knob | AI Rival | Pit Stop |
|------|----------|----------|
| AI resource safety margin | 10% next-lap forecast (range 0–20%) | AI resource safety margin | 10% (range 0–20%) |

Same knob claimed by both. AI Rival decides the pit entry; Pit Stop provides the forecast math. The ownership boundary is unclear — who tunes this value?

### ⚠️ Gs-01 / Trk-06: Row and column spacing — Grid & Start AND Track System

| Knob | Grid & Start | Track System |
|------|-------------|--------------|
| Row spacing | 8.0m (range 6–10m) | 8 m (range 6–12 m) |
| Column spacing | **3.5m** (range 2.5–5m) | **2 m** (range 1.5–3 m) |

Row spacing values are close (8.0 vs 8) and ranges overlap, so consistent. **Column spacing is a BLOCKING conflict** (see 2b Trk-02/Trk-03). The values differ (3.5m vs 2m) and the safe ranges don't overlap meaningfully. This will produce different grid geometry depending on which system is authoritative.

### ⚠️ UI-03 / Gs-02: Grid display duration — UI Menu AND Grid & Start

| Knob | UI Menu | Grid & Start |
|------|---------|--------------|
| Grid display duration | 5s (range 3–10s) | 5s (range 3–10s) |

Values match. Minor ownership split: Grid & Start owns grid formation, UI Menu owns the display screen. This is an intentional overlap.

### ⚠️ RSM-01 / Gs-03: Countdown duration — Race Session Manager AND Grid & Start

| Knob | Race Session Manager | Grid & Start |
|------|---------------------|--------------|
| Countdown duration | 5.0s / 300 ticks | 5s / 300 ticks |

Values match. RSM tracks the timer, Grid & Start owns the lights sequence. Clear coordination, minor ownership overlap.

---

## 2e: Formula Compatibility

For connected formulas, checked that output ranges match expected input ranges.

### 🔴 Trk-07 / TiR-05: Tire surface_penalty formula range excludes own tuning knob

| Field | Value |
|-------|-------|
| **Source 1** | `design/gdd/tire-system.md` — Formula variable table: `surface_penalty | float | **1.0–2.5**` |
| **Source 2** | `design/gdd/tire-system.md` — Tuning Knobs: `Surface penalty (off-track) | Current Value: **3.0** | Safe Range: 1.5–**5.0**` |
| **Formula relationship** | `tire_wear_rate = base_rate × distance_factor × aggression × **surface_penalty** × efficiency_modifier` |
| **Issue** | The formula's declared variable range (1.0–2.5) **excludes** the tuning knob's current value (3.0) and half the tuning knob's safe range (2.5–5.0). The surface_penalty variable cannot legally take the value 3.0 if the formula enforces its declared range. Also, Track System's surface wear modifier caps at 2.5. |
| **Impact** | If the formula clamps to [1.0, 2.5], the tuning knob value 3.0 is never applied, and the **tuning is inert**. If the formula doesn't clamp and accepts 3.0, it exceeds the Track System's authored surface modifier. |

### ⚠️ VPh-01: Grip decomposition — Tire runtime grip floor (0.20) matches Vehicle Physics floor (0.20)

| Field | Value |
|-------|-------|
| **Source 1** | `design/gdd/tire-system.md` — Formula: `grip_floor = 0.20` |
| **Source 2** | `design/gdd/vehicle-physics.md` — Grip formula (line 234): `effective_grip = clamp(... 0.20, 1.20)` |
| **Assessment** | The 0.20 floor is consistent between both GDDs. No issue. |

### ⚠️ VPh-02: Fuel low-speed bonus → Vehicle Physics model

| Source | `design/gdd/fuel-system.md`: `When fuel < 25%, apply a +1% top speed bonus` |
| Source | `design/gdd/vehicle-physics.md`: `Fuel state/max-speed modifier ← bidirectional` |
| **Assessment** | Vehicle Physics acknowledges it receives a fuel-state max-speed modifier from Fuel System. The formula details (exact 1%) are in Fuel's domain. Compatible. |

### ⚠️ Pit-05 / FuR-03: Fill rate → pit service duration

| Source 1 | `design/gdd/fuel-system.md`: Fuel fill rate = 0.8 L/s. Tank capacity not explicitly stated. |
| Source 2 | `design/gdd/pit-stop.md`: `service_duration = max(2s, (8 - fuel) / 0.8)` — assumes tank capacity is **8 L**. |
| Source 3 | `design/gdd/qualifying.md`: `qualifying_fuel_load = min(**8.0L**, ...)` |

Pit Stop's formula hardcodes `8 L` as the tank capacity. Fuel System does not declare a tank capacity, but Qualifying uses 8.0L as a cap. This is consistent in practice but the 8L tank capacity should be declared in Fuel System's Core Rules, not buried in Pit Stop's formula.

---

## 2f: Acceptance Criteria Cross-Check

Scan ACs across all GDDs for contradictions (GDD-A says X cannot happen, GDD-B says X must happen).

### 🔴 UI-04: UI Menu AC-199 vs UI Menu Navigation Rules (same GDD)

Already covered in 2b UI-01. Summary:
- `design/gdd/ui-menu.md` — Navigation Rules line 54: Grid Display after qualifying has **no timeout**.
- `design/gdd/ui-menu.md` — AC-199 line 198: **5-second timeout** when Grid Display is open.

Same GDD, contradicting statements. One of them must change.

### ⚠️ UI-05: Qualifying AC vs UI Menu Navigation Rules (Grid Display timeout)

- `design/gdd/qualifying.md` — Post-Qualifying Screen (line 69): *"auto-advances after **5 seconds** per Grid & Start"*.
- `design/gdd/grid-start.md` — Grid Display (line 97): *"Duration: **5s or skip**"*.
- `design/gdd/ui-menu.md` — Navigation Rules line 54: *"Grid Display after qualifying has Start Race button with **no timeout** and no Back option"*.

Qualifying and Grid & Start both consistently state a 5-second timeout. UI Menu's "no timeout" contradicts both. Resolve in favor of Qualifying + Grid & Start or update all three to agree.

### ⚠️ Qua-01: Qualifying AC says higher tier wins ties — contradicts tiebreaker stable carId rule

| Field | Value |
|-------|-------|
| **Source** | `design/gdd/qualifying.md` — AC-242 (line 242): *"GIVEN two AI with identical times, WHEN tiebreak runs, THEN **higher tier gets better position**."* |
| **vs** | `design/gdd/qualifying.md` — Core Rules line 83: *"Tier order is not artificially preserved... deterministic tiebreakers apply only to **exact equal times**."* |
| **vs** | `design/gdd/qualifying.md` — Formulas line 170: *"ties broken by **stable car ID** (deterministic, same as Grid & Start)."* |
| **vs** | `design/gdd/qualifying.md` — Edge Cases line 190: *"tie by stable car_id (deterministic, same as Grid & Start)"* |
| **vs** | `design/gdd/qualifying.md` — AC-248 (line 248): *"stable car_id determines the deterministic order"* |
| **Contradiction** | AC-242 says "higher tier gets better position" but the rest of the GDD (Core Rules, Formulas, Edge Cases, AC-248) consistently says stable car_id determines ties. AC-242 contradicts the rest of its own GDD. |
| **Impact** | The surviving policy is "stable car_id for exact ties" (per formulas + edge cases + AC-248). AC-242 is wrong. This was flagged in Lean re-review (line 127: "1 BLOCKING (tiebreaker edge case)") and marked corrected, but AC-242 was missed. |

### ⚠️ Qua-02: Qualifying tire AC vs Tire System's grip behavior

| Source 1 | `design/gdd/qualifying.md` — AC-237: *"GIVEN player completes flying lap, WHEN tire wear is checked, THEN tires are at 100% (no wear applied)."* |
| Source 2 | `design/gdd/tire-system.md` — Describes 100% grip as the initial state, with grip_floor = 0.20 when fully worn. Tire System has no special qualifying mode. |
| **Assessment** | No contradiction — Qualifying explicitlyfreezes tire wear. This is a Qualifying override of Tire System behavior, clearly documented in Qualifying's Interactions table (Tire: Inbound, 100% grip, no wear). The Tire System doesn't need to know about qualifying modes because it receives no wear triggers during qualifying. Compatible. |

### ⚠️ Qua-03: Qualifying fuel AC matches Fuel System formula

| Source 1 | `design/gdd/qualifying.md` — AC-236: *"initial load equals min(8.0L, fuel_rate_for_car × reference_flying_lap_time × 1.10)"* |
| Source 2 | `design/gdd/fuel-system.md` — Defines `fuel_rate_for_car` per-car consumption rate. |
| **Assessment** | Compatible. Qualifying borrows the fuel consumption rate from Fuel System and calculates its own load. The formula uses Fuel System's definitions. |

### ⚠️ Pit-06: Pit Stop Tire ACs match Tire System

| Source 1 | `design/gdd/pit-stop.md` — AC: *"tire swap time is 2 seconds, tire resets to 0% wear after swap"* |
| Source 2 | `design/gdd/tire-system.md` — wear model and swap behavior |
| **Assessment** | Compatible. Pit Stop owns the service timing; Tire System owns the wear reset. |

---

## Summary Table

| Check | Severity | Count |
|-------|----------|-------|
| **2a: Dependency Bidirectionality** | BLOCKING | **2** (Tire→UI Menu, Fuel→UI Menu) |
|  | WARNING | **5** (VP→VFX, Tire→VFX, Track→VFX, CP→HUD, Cam→HUD label) |
| **2b: Rule Contradictions** | BLOCKING | **2** (surface wear 2.5 vs 3.0; Grid Display timeout) |
|  | WARNING | **3** (Track column spacing internal; Reduced Motion scope; 2a findings recategorized) |
| **2c: Stale References** | WARNING | **2** (systems-index 1 track; Track column tuning vs description) |
| **2d: Tuning Knob Ownership Conflicts** | BLOCKING | **1** (Column spacing: Track 2m vs Grid & Start 3.5m) |
|  | WARNING | **5** (pit speed limit, fuel fill rate, tire swap time, AI pit margin, grid display duration) |
| **2e: Formula Compatibility** | BLOCKING | **1** (Tire surface_penalty range excludes own tuning knob) |
|  | WARNING | **1** (8L tank capacity unowned) |
| **2f: AC Cross-Check** | BLOCKING | **1** (UI Menu AC-199 vs UI Menu Navigation Rules) |
|  | WARNING | **2** (Qualifying AC-242 contradicts own tiebreaker rules; UI Menu timeout vs Qualifying/Grid & Start) |

### 🔴 BLOCKING findings requiring resolution before implementation:

1. **TiR-01 / FuR-01**: UI Menu has no inbound from Tire or Fuel Systems for pre-race wear/consumption comparison data.
2. **Trk-02 / TiR-03**: Track says off-track wear = 2.5; Tire tuning says 3.0. Tire formula range (1.0–2.5) excludes own tuning knob (3.0).
3. **UI-01 / UI-04**: Grid Display timeout policy — UI Menu says "no timeout" (post-qualifying), but UI Menu AC says 5s, Qualifying says 5s, Grid & Start says 5s. Four-way conflict.
4. **Gs-01 / Trk-06**: Column spacing — Grid & Start says 3.5m, Track says 2m. Two GDDs claim ownership with different values. Track's column spacing range (1.5–3m) cannot express 3.5m.
5. **Trk-07 / TiR-05**: Tire system surface_penalty formula range [1.0, 2.5] cannot legally express tuning knob value 3.0.
6. **Qua-01**: Qualifying AC-242 says "higher tier gets better position" but GDD's Core Rules, Formulas, Edge Cases, and AC-248 all say stable car_id. AC is stale — fix to match the consistent tiebreaker rule.
