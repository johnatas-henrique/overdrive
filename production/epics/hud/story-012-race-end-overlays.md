# Story 012: RaceEndOverlays (DNF + Checkered)

> **Epic**: HUD
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/hud.md`
**Requirement**: `TR-HUD-012` — Race end overlays: DNF overlay (position frozen, reason shown) and Checkered overlay (slow-motion, freeze frame). Triggered by race.\* events.

**ADR Governing Implementation**: ADR-0018: HUD Layout & Blocks
**ADR Decision Summary**: Both overlays are top-level ADT children (not in Grid). DNF: instant display, dark overlay + centred text. Checkered: brief 0.3s animation then static display. Both remain visible until GSM transitions to PostRace.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Rectangle for dark overlay. TextBlock for DNF text and race results. Standard Babylon.js GUI. No special animation APIs needed.

**Control Manifest Rules (this layer)**:

- Required: P3 (create-once toggle-visibility)
- Forbidden: P-F4 (never use HTML/CSS for HUD)
- Guardrail: P-G1 (HUD < 0.3ms GPU per frame)

## Acceptance Criteria

_From GDD DNFOverlay and CheckeredOverlay sections:_

- [ ] AC-1: DNF: screen dims with a dark overlay `rgba(0,0,0,0.6)` covering the full ADT
- [ ] AC-2: DNF: centred "DNF" text in bold white, ~108px at 1080p (approximately 10% of viewport height)
- [ ] AC-3: DNF: reason subtitle shown below "DNF" — "FUEL EMPTY" or "STALLED IN PIT" (text from payload `car.dnf: { reason: string }`) in muted white, ~27px (25% of DNF text size)
- [ ] AC-4: DNF: remains visible until GSM transitions to PostRace — then overlay hides
- [ ] AC-5: Checkered: brief animated checkered flag overlay (0.3s visual effect via HudAnimator MECHANICAL)
- [ ] AC-6: Checkered: top 3 displayed as "P1 · TeamName", "P2 · TeamName", "P3 · TeamName" in bold white, ~8% viewport height
- [ ] AC-7: Checkered: if player is in P1–P3, shows only top 3 (player entry highlighted in gold #FFD700). If player is P4–P8, shows top 3 + "P(X) · You" at bottom in highlighted colour.
- [ ] AC-8: Checkered: remains visible until GSM transitions to PostRace

## Implementation Notes

_Derived from ADR-0018 Implementation Guidelines and GDD:_

1. **DNF trigger**: Event `car.dnf: { carId: string, reason: string }`. Filter `carId === playerCarId`. Known reasons: `"FUEL EMPTY"`, `"STALLED IN PIT"`. Extensible — render whatever reason string is provided.

2. **DNF layout**: Full-screen Rectangle overlay with background `rgba(0,0,0,0.6)`. DNF TextBlock centred both axes. Reason TextBlock below DNF, ~25% font size.

3. **Checkered trigger**: Event `race.checkered: { results: Array<{ position: number, carId: string, teamName: string, isPlayer: boolean }> }`. The results array is pre-sorted by position.

4. **Checkered animation**: Brief visual effect (0.3s). Implementation: start with overlay alpha=0, use HudAnimator MECHANICAL to snap to alpha=1 after 0.3s. Then display results. The "slow-motion entry" described in the GDD is a camera/drone effect, not a HUD effect — out of scope.

5. **Player highlighting**: Match `results[].carId` against playerCarId. If player is in positions 1-3, highlight their row with `#FFD700` (gold) colour. If position 4+, add extra row at bottom "P(X) · You" in gold.

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 003: HudManager — overlay registration and lifecycle
- Camera drone orbit / slow-motion entry effect (PostRace camera, not HUD)
- PostRace results screen (separate system, not HUD)

## QA Test Cases

_Manual verification steps — written by qa-lead at story creation:_

- **AC-1**: DNF dark overlay
  - Setup: Emit `car.dnf` with reason "FUEL EMPTY"
  - Verify: DNF overlay
  - Pass condition: Full-screen dark overlay rgba(0,0,0,0.6) applied

- **AC-2**: DNF centred text
  - Setup: As above
  - Verify: "DNF" text
  - Pass condition: Centred, ~108px, bold white

- **AC-3**: DNF reason subtitle
  - Setup: DNF with reason "STALLED IN PIT"
  - Verify: Secondary text
  - Pass condition: "STALLED IN PIT" visible below DNF, ~27px, muted white

- **AC-4**: DNF stays until PostRace
  - Setup: DNF overlay active
  - When: GSM transitions to PostRace
  - Verify: Overlay state
  - Pass condition: DNF overlay hidden after PostRace

- **AC-5**: Checkered brief animation
  - Setup: Emit `race.checkered` with results
  - Verify: Checkered overlay appearance
  - Pass condition: Overlay appears after ~0.3s (MECHANICAL snap)

- **AC-6**: Top 3 display
  - Setup: Results with player at P2
  - Verify: Top 3 text
  - Pass condition: "P1 · Alpha Racing", "P2 · Beta Team", "P3 · Gamma Motorsport"

- **AC-7**: Player P4–P8 shows extra row
  - Setup: Results with player at P5
  - Verify: Bottom of checkered overlay
  - Pass condition: Top 3 + "P5 · You" in gold
  - Setup: Results with player at P1
  - Verify: No extra row
  - Pass condition: Only top 3, P1 row highlighted in gold (#FFD700)

- **AC-8**: Checkered stays until PostRace
  - Setup: Checkered overlay active
  - When: GSM transitions to PostRace
  - Verify: Overlay state
  - Pass condition: Checkered overlay hidden

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/raceEndOverlays-evidence.md` + sign-off
**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (HudAnimator — checkered 0.3s fade-in), Story 003 (HudManager — registration)
- Unlocks: None directly
