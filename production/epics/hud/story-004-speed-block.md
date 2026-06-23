# Story 004: SpeedBlock

> **Epic**: HUD
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/hud.md`
**Requirement**: `TR-HUD-002` — All HUD updates driven by Event Bus events (consumer-only). SpeedBlock reads `playerCar.physics.speedKmh` at 20Hz throttle via Event Bus.

**ADR Governing Implementation**: ADR-0018: HUD Layout & Blocks
**ADR Decision Summary**: SpeedBlock uses Event Bus with 20Hz throttle (every 3 ticks at 60fps). Physics emits `speed.changed: { carId, speedKmh, gear }` at throttle-controlled rate. Fallback path: if 20Hz proves jittery, increase to 60Hz (every tick) → if still unsatisfactory, direct read via HudContext.playerCar.

**Engine**: Babylon.js 9.12.0 | **Risk**: MEDIUM
**Engine Notes**: TextBlock for speed display (72px bold white). Standard Babylon.js GUI — no special APIs needed. Text set via `textBlock.text = String(value)`.

**Control Manifest Rules (this layer)**:

- Required: P5 (SpeedBlock at 20Hz via Event Bus, every 3 ticks), P6 (event-driven for all blocks)
- Forbidden: P-F4 (never use HTML/CSS for HUD)
- Guardrail: P-G1 (HUD < 0.3ms GPU per frame)

## Acceptance Criteria

_From GDD SpeedBlock section, ADR-0018 SpeedBlock Event Bus decision:_

- [ ] AC-1: Speed displays numerical km/h as bold white text, 72px at 1920 reference
- [ ] AC-2: Updates arrive via Event Bus event `speed.changed` — emitted at 20Hz (every 3 ticks at 60fps simulation)
- [ ] AC-3: Display shows correct value matching `speed.changed` payload — clamped to 0–360 km/h range
- [ ] AC-4: Gear displayed as ordinal below speed: "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th". Special values: "N" (neutral), "R" (reverse), "?" (unknown)
- [ ] AC-5: At 0 km/h on grid/PreRace, shows "0" — no special placeholder
- [ ] AC-6: Clamping: negative values → 0, values > 360 → 360

## Implementation Notes

_Derived from ADR-0018 Implementation Guidelines:_

1. **Speed only via Event Bus**: Subscribe to `speed.changed` event. Do NOT read `playerCar.physics.speedKmh` directly. The ADR rejected direct reads for consistency.

2. **Speed event payload**: `speed.changed: { carId: string, speedKmh: number, gear: number }`. Filter on `carId === playerCarId`.

3. **Throttle is on the emitter**: Physics emits `speed.changed` at 20Hz (every 3 ticks). The HUD does NOT throttle on the receiving end — it renders every received event.

4. **Gear ordinal mapping**:

   ```typescript
   function gearOrdinal(gear: number): string {
     const map: Record<number, string> = {
       0: "N", -1: "R", 1: "1st", 2: "2nd", 3: "3rd",
       4: "4th", 5: "5th", 6: "6th", 7: "7th", 8: "8th"
     };
     return map[gear] ?? "?";
   }
   ```

5. **Speed text**: `textBlock.text = String(Math.round(speedKmh))` — no decimal places. Integer display.

6. **Gear text**: Smaller font ~15% of speed font size (~10-11px at 1920), muted grey, positioned below the speed number or beside.

7. **No animation** — number changes instantly each frame per art bible mechanical rule.

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 005: LapBlock & PositionBlock (different blocks in same zone)
- Story 006: GapInfoBlock (separate event-driven block)
- RPM bar — not in MVP Phase 1 (epic lists "numeric speed + RPM bar" but GDD/UX omit RPM bar)

## QA Test Cases

_Manual verification steps — written by qa-lead at story creation:_

- **AC-1**: Speed display format
  - Setup: HudManager active during simulated race, emit `speed.changed` with `{ speedKmh: 245 }`
  - Verify: Inspect TextBlock properties
  - Pass condition: `text="245"`, `fontSize=72`, `color="#FFFFFF"`, `fontWeight="bold"`

- **AC-2**: Updates at 20Hz
  - Setup: Event Bus emits `speed.changed` every tick (60Hz simulation)
  - Verify: Count how many times speed text changes in 60 game ticks
  - Pass condition: Speed text changes exactly 20 times ±1

- **AC-3**: Correct value from Event Bus
  - Setup: Emit speed.changed with values 0, 100, 245, 360
  - Verify: Read speed text after each emission
  - Pass condition: Text shows "0", "100", "245", "360" respectively

- **AC-4**: Gear ordinal displayed
  - Setup: Emit speed.changed with gear values 0, 1, 2, 3, 4, 5, 6, 7, 8, -1
  - Verify: Read gear text
  - Pass condition: "N", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "R" respectively

- **AC-6**: Clamping
  - Setup: Emit speed.changed with -10, 0, 360, 400
  - Verify: Read speed text
  - Pass condition: "0", "0", "360", "360" respectively

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/speedBlock-evidence.md` + sign-off
**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 003 (HudManager — for registration and lifecycle)
- Unlocks: None directly
