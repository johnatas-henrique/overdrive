# Story 008: Results Screen — Count-Up + Race Actions

> **Epic**: Menu LITE
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Visual/Feel
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/menu-lite.md`
**Requirement**: `TR-MENU-010` — Results screen on GSM PostRace. Position count-up animation (~200ms per digit). Total time and fastest lap in MM:SS.mmm format. Rival reaction text.

**ADR Governing Implementation**: ADR-0019: Menu LITE Architecture
**ADR Decision Summary**: Results screen triggered by GSM `PostRace` entry. Pre-created container with top 3 classification, player position, fastest lap, rival reaction, count-up animation, Race Again / Main Menu buttons. "Race Again" calls `requestTransition(PostRace→PreRace)` and re-emits cached `RaceConfiguration` (with new seed). "Main Menu" pops to Title.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: `TextBlock` for position/time text. Count-up animation via async/await with `setTimeout` (acceptable for one-shot menu animation). `Button` for Race Again / Main Menu.

**Control Manifest Rules (this layer)**:

- Required: P7 — screen stack push/pop
- Required: P8 — pre-created controls, instant `isVisible`
- Required: P9 — instant transitions
- Forbidden: P-F6 — no fade/slide in Phase 1

---

## Acceptance Criteria

_From GDD `design/gdd/menu-lite.md`, scoped to this story:_

- [ ] When GSM enters `PostRace` state, the Results screen is pushed onto the screen stack.
- [ ] Top 3 classification displayed with position (P1, P2, P3), driver name, and total race time for each.
- [ ] If the player finished in 1st–3rd, their row is highlighted with the team accent colour.
- [ ] If the player finished outside top 3, a separate row below the top 3 shows their position with a "YOU" label. Top 3 always shown.
- [ ] Fastest lap displayed with driver name (may not be the player). Time format: MM:SS.mmm.
- [ ] Rival reaction text appears: one line, italic, ironic/arrogant 90s-style trash talk. Reaction is from the highest-standing rival, determined by the player's position band (win, mid-pack, DNF).
- [ ] At least 2 distinct rival reaction variants exist for each position band (win, mid-pack, DNF), sourced from config pool.
- [ ] If the player DNF'd: position shows "DNF", rival reaction uses DNF variant set, total race time shows "—".
- [ ] If race telemetry data is missing: incomplete fields show "—" (not blank, not "undefined").
- [ ] **Position count-up animation**: when Results appears, the player's finish position digits count up from 1 to final position. ~200ms per digit increment. One-time animation, non-essential (runs to completion or skips if interrupted).
- [ ] **"Race Again" button**: calls `gsm.requestTransition(PostRace→PreRace)` and re-emits the cached `RaceConfiguration` with a new `seed`. No asset reload needed — assets from previous race remain cached.
- [ ] **"Main Menu" button**: pops back to Title via screen stack (clears any race state).
- [ ] Applies Misto dark-panel style per art bible §7.1.

---

## Implementation Notes

_Derived from ADR-0019 Implementation Guidelines:_

- Results screen display layout per UX spec `design/ux/menu.md`:
  ```
  P1  MACKLEN     12:30.200
  P2  FERREL      12:32.100
  P3  LORRIS      12:34.567  ← YOU
  Fastest lap: 1:32.400 (MACKLEN)
  "You got lucky out there."  — Macklen
  [RACE AGAIN]      [MAIN MENU]
  ```
- Top 3: `TextBlock` with monospace font for time alignment. Row background reflects accent colour for player.
- Position outside top 3:
  ```
  P1  MACKLEN     12:30.200
  P2  FERREL      12:32.100
  P3  WILLARD     12:33.800
  P7  LORRIS      12:45.100  ← YOU
  ```
- Count-up animation:
  ```typescript
  async function countUpAnimation(finalPosition: number): Promise<void> {
    const steps = Math.max(finalPosition, 1);
    const intervalMs = Math.min(500 / steps, 100);
    for (let i = 0; i < steps; i++) {
      await delay(intervalMs);
      positionTextBlock.text = `P${i + 1}`;
    }
    positionTextBlock.text = `P${finalPosition}`;
  }
  ```
- Rival reaction: fetched from config data (keyed by rival personality + position band). Config provides 2+ variants per band.
- "Race Again": `this.raceConfig.seed = Date.now()` (new seed each race). Call `gsm.requestTransition('PreRace')`. The `RaceConfiguration` is emitted from Menu LITE (not passed through GSM).
- "Main Menu": `pop()` repeatedly until stack has only Title (or `clearToRoot()` method on screen stack).
- DNF: position text block shows "DNF". Total time shows "—". Rival reaction selects from DNF variant set.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 001: Screen stack push/pop, GSM Event Bus integration — this story uses them
- Story 007: Loading screen, `tryTransition()` infrastructure
- Race data population: provided by Race Management + Race Results systems

---

## QA Test Cases

_Manual verification steps:_

### V-008-1: Top 3 classification visible

- **Setup**: Complete a race so GSM enters PostRace state.
- **Verify**: Positions 1, 2, 3 shown with driver name + total race time.
- **Pass condition**: All 3 positions displayed, times formatted as MM:SS.mmm.

### V-008-2: Player highlighted if in top 3

- **Setup**: Finish race in position 2.
- **Verify**: Player row in top 3 has accent highlight.
- **Pass condition**: Player's row visually distinct from other rows.
- **And**: Finish race in position 7.
- **Verify**: Player position shown as separate row below top 3 with "YOU" label.
- **Pass condition**: Separate row visible, labelled, not overlapping top 3.

### V-008-3: Fastest lap displayed

- **Setup**: Results visible.
- **Verify**: Fastest lap time shown with driver name (may differ from winner).
- **Pass condition**: "Fastest lap: 1:32.400 (DRIVER)" formatted correctly.

### V-008-4: Rival reaction text visible

- **Setup**: Results visible.
- **Verify**: One line of italic text. Tone is ironic/arrogant trash-talk.
- **Pass condition**: Reaction text legible, italic, attributed to rival driver name. Changes based on position band.

### V-008-5: DNF handling

- **Setup**: Player DNFs.
- **Verify**: Position shows "DNF". Total race time shows "—". Rival reaction uses DNF variant.
- **Pass condition**: Clear DNF state, no crash, no blank fields.

### V-008-6: Incomplete data shows "—"

- **Setup**: Race telemetry missing for a field (e.g., fuel consumption).
- **Verify**: Missing field displays "—" (not blank, not "undefined", not "null").
- **Pass condition**: Graceful degradation of missing data.

### V-008-7: Position count-up animation

- **Setup**: Results appears after race.
- **Verify**: Position digits count up (~200ms per digit). Animation plays once, then stops.
- **Pass condition**: Smooth count-up, stops at final position, no looping.

### V-008-8: "Race Again" → PreRace (selections preserved)

- **Setup**: Results visible after race.
- **When**: Press "Race Again".
- **Verify**: Race starts with same team, track, lap count, difficulty. No re-selection needed.
- **Pass condition**: Instant transition to PreRace with same configuration (new seed only).

### V-008-9: "Main Menu" → Title

- **Setup**: Results visible.
- **When**: Press "Main Menu".
- **Verify**: Title screen appears. Must press ENTER to re-enter flow.
- **Pass condition**: Returns to clean Title state.

### V-008-10: Rival variant diversity

- **Setup**: Return to Results 4+ times with different positions.
- **Verify**: Each position band (win, mid-pack, DNF) shows 2+ distinct reaction lines.
- **Pass condition**: No repeats within 3 consecutive shows for the same band.

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**: `production/qa/evidence/story-008-results-evidence.md` + sign-off

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (MenuLite Core — screen stack + GSM + input), Story 007 (Loading → GSM transition — activates GSM flow)
- Unlocks: End-to-end Menu LITE flow complete
