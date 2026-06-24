# Story 003: DNF Classification & Positioning in Results

> **Epic**: Race Results
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/race-management.md` (sections: DNF Detection, Race End & Results, Edge Cases)
**Requirement**: `TR-RM-004` — `DNF lifecycle: pendingDNF (on fuel_empty) → exceptions (if regained speed) → DNF (on car.stopped) with isDNF(carId) flag`; `TR-RM-007` — results aggregation

**ADR Governing Implementation**: ADR-0015: Race Management
**ADR Decision Summary**: DNF cars are placed after all finishers in results, sorted by totalDistance among themselves. DNS registry populates `dnf` boolean and `dnfReason` string. Tiebreaker for equal totalDistance: gridPosition from RaceConfiguration.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No engine APIs used — pure TypeScript data classification.

**Control Manifest Rules (this layer)**:

- Required: C54 (DNF lifecycle), C55 (3 race-end conditions)
- Forbidden: None specific
- Guardrail: C-G7 (Race Management < 0.01ms/tick)

---

## Acceptance Criteria

_From GDD `design/gdd/race-management.md`, scoped to this story:_

- [ ] **AC-1**: DNF cars are placed after all finishers in the results array
- [ ] **AC-2**: DNF cars among themselves are sorted by `totalDistance` descending (most distance = highest position among DNF)
- [ ] **AC-3**: The `dnf` field in `RaceResult` is `true` for DNF cars, `false` for finishers
- [ ] **AC-4**: `dnfReason` propagates from the DNF registry (valid values: `'fuel_empty'`, `'stalled_in_pit'`)
- [ ] **AC-5**: All 8 cars DNF → all appear in results, player is last (P8)
- [ ] **AC-6**: Player DNF on first lap → results computed with whatever distance each car had covered
- [ ] **AC-7**: Tiebreaker for equal `totalDistance`: `gridPosition` (whoever started ahead wins — from `RaceConfiguration` grid order established at `init()`)
- [ ] **AC-8**: Mixed field (some finishers, some DNF) — DNF cars are correctly placed after ALL finishers regardless of a DNF car's individual distance

---

## Implementation Notes

_Derived from ADR-0015 Implementation Guidelines:_

1. **Sort priority** — in `buildResults()`, the sort comparator must check `dnf` status first:

   ```typescript
   entries.sort((a, b) => {
     if (a.dnf !== b.dnf) return a.dnf ? 1 : -1; // finishers first
     return b.totalDistance - a.totalDistance; // then by distance
   });
   ```

2. **DNF reason** — read from `dnfRegistry: Map<string, DNFReason>`. Valid `DNFReason` values: `'fuel_empty'`, `'stalled_in_pit'`. Non-DNF cars have `dnfReason: undefined`.

3. **Tiebreaker** — if two cars have identical `totalDistance`, break the tie using starting grid position. Store the grid order at `init()` from `RaceConfiguration`. Lower grid position (closer to P1) wins.

4. **All-DNF scenario** — when no car finishes, the sort still produces a consistent ordering by `totalDistance` descending. No special case needed — the sort naturally handles it.

5. **First-lap DNF** — `lapCount` will be 0 for all cars, `totalDistance = 0 × trackLength + splinePosition`. Some cars may not have crossed start line — `splinePosition` may be 0. Results are still valid.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 001**: Base `buildResults()` sorting and RaceResult interface
- **Story 002**: Fastest lap tracking (unrelated to DNF)
- **Story 004**: JSON serialization of results
- **RM Core Story 005**: DNF lifecycle — fuel empty detection (already in RM Core)
- **RM Core Story 006**: DNF exceptions — pit entry, stalled in pit, last lap (already in RM Core)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1/8**: DNF cars placed after all finishers regardless of distance
  - Given: 4 cars — Finisher A (totalDist=5000), Finisher B (totalDist=4800), DNF X (totalDist=4900), DNF Y (totalDist=2000)
  - When: buildResults() sorts the results
  - Then: Order is A (P1), B (P2), X (P3), Y (P4) — DNF X's 4900m does NOT put it ahead of Finisher B's 4800m
  - Edge cases: DNF car with MORE distance than any finisher still placed last; all finishers; no finishers

- **AC-2**: DNF cars sorted among themselves by distance descending
  - Given: 3 DNF cars with distances 4000, 4500, 3500
  - When: DNF group is sorted
  - Then: Order is 4500 → 4000 → 3500
  - Edge cases: All DNF at 0 distance (first-lap DNF); identical distances (fall through to tiebreaker)

- **AC-3/4**: dnf and dnfReason fields are correct
  - Given: Car A finished normally, Car B DNF with 'fuel_empty', Car C DNF with 'stalled_in_pit'
  - When: buildResults() is called
  - Then: Car A → { dnf: false, dnfReason: undefined }; Car B → { dnf: true, dnfReason: 'fuel_empty' }; Car C → { dnf: true, dnfReason: 'stalled_in_pit' }
  - Edge cases: dnfReason is undefined for non-DNF cars; empty DNF registry

- **AC-5**: All 8 cars DNF — player is last (P8)
  - Given: All 8 cars DNF, player has totalDist=800, AI cars have distances 2000..500
  - When: buildResults() is called
  - Then: All 8 cars appear in results; player has finalPosition=8 (last among DNF by distance)
  - Edge cases: Player has most distance among DNF → P1 (all DNF field); player at exactly 0 distance

- **AC-6**: Player DNF on first lap — partial distance results
  - Given: Player DNF detected at tick 300, all cars have <1 lap distance
  - When: endRace() is called
  - Then: Each car's totalDistance = 0 × trackLength + splinePosition at tick 300
  - Edge cases: Some cars haven't crossed start line (splinePosition=0) → totalDistance=0

- **AC-7**: Tiebreaker for equal totalDistance — grid position wins
  - Given: Car A (started P1) and Car B (started P2) both have totalDistance = 5200
  - When: buildResults() sorts tied cars
  - Then: Car A has finalPosition before Car B (A ahead by grid position)
  - Edge cases: 3+ cars tied at same distance; grid positions sequential; no position wrap-around

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/race-management/dnf-classification_test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (buildResults sorting mechanics), RM Core Story 005/006 (DNF lifecycle — populates dnfRegistry)
- Unlocks: Results display can show correct DNF placement
