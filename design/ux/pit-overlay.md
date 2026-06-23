# UX Spec: Pit Overlay

> **Status**: In Design
> **Author**: ux-designer
> **Last Updated**: 2026-06-22
> **Journey Phase(s)**: Racing (pit service sub-state)
> **Platform Target**: PC (web — Electron/Tauri)
> **Template**: UX Spec

---

## Purpose & Player Need

The player needs to track service progress (tires and fuel), know when they can leave, and make the tactical decision to exit early or wait for full fuel.

**Player goal**: Monitor fuel and tire service completion, then decide when to rejoin the race. The fantasy is pulling off a faster pit stop than the competition — leaving at the optimal moment while rivals are too conservative or too impatient.

**What would go wrong without it**: Without the pit overlay, the player would not know when tires are done or how much fuel has been loaded. The pit stop becomes a black box — the player cannot make informed strategic decisions about early exit vs full tank.

---

## Player Context on Arrival

The player arrives after actively racing at full speed. They entered the pit entry zone, the car decelerated to 80 km/h, and steering was taken over by the guidance system. The player transitions from active driving to passive observation — they are waiting for service to complete while watching rivals on track via relative timing.

**Emotional state**: Tense but strategic — every second in the pit is a second not racing. The player is watching the fuel bar fill and waiting for the tire checkmark, calculating whether to leave early or wait for full fuel.

**Voluntary**: Yes — the player chose to enter the pit lane.

---

## Navigation Position

This overlay lives at: **[Gameplay] → [Racing] → [Pit Service] → [Pit Overlay]**

Context-dependent overlay — automatically replaces the main race HUD when the car enters the pit lane. The player does not navigate to it; it appears as a consequence of entering the pit entry zone. Camera remains unchanged (chase or cockpit continues normally).

Not accessible from any other game state.

---

## Entry & Exit Points

| Entry Source | Trigger                                                                  | Player Carries This Context                                                                                                   |
| ------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Racing       | Car enters pit entry zone (`isInPitEntryZone()` → pitState = `pitEntry`) | Current fuel level, tire condition, race position, lap count. Simulation continues for all other cars while player is in pit. |

| Exit Destination  | Trigger                                                                       | Notes                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Racing (pit exit) | Confirm pressed (after tires done) OR auto-exit after `exitGraceTimeout` (3s) | Car departs pit, follows exit spline. At `pitExitZone`, overlay removed, race HUD restored, player regains control. |
| DNF Overlay       | Player runs out of fuel while in pit (edge case: stalled_in_pit)              | DNF overlay replaces pit overlay. Pit events stop firing. Ends race.                                                |

---

## Layout Specification

### Information Hierarchy

| Rank | Item          | Rationale                                                               |
| ---- | ------------- | ----------------------------------------------------------------------- |
| 1    | Tire status   | Determinant of when exit is allowed — player's primary information need |
| 2    | Fuel progress | Secondary — player watches it fill while waiting for tires              |
| 3    | Exit prompt   | Action trigger — appears only after tires are done                      |
| 4    | Team name     | Context — identifies which garage the car stopped at                    |

### Layout Zones

Single centred content panel, semi-transparent (30% dark background within the panel only). The overlay appears on top of the race HUD — not replacing it. The player can see their position, lap, and speed behind the semi-transparent panel while waiting for service. This is the same visual approach as the Pause overlay: centred overlay on top of live game+ HUD.

### Component Inventory

| Zone   | Component             | Type                 | Content                                                                | Interactive         | Pattern          |
| ------ | --------------------- | -------------------- | ---------------------------------------------------------------------- | ------------------- | ---------------- |
| Top    | Team name label       | Text                 | Team name (e.g., "LORRIS RACING")                                      | No                  | —                |
| Middle | Tire status indicator | Status + label       | "TIRES — WORKING" (yellow pulsing) or "TIRES — DONE" (green checkmark) | No                  | —                |
| Middle | Fuel progress bar     | Progress bar + label | "FUEL" + bar (0-100%) + numeric %                                      | No                  | —                |
| Bottom | Exit prompt           | Button               | "PRESS [ENTER/A] TO EXIT" (shown only after tires done)                | Yes — confirms exit | Pit Confirm Gate |
| Bottom | Waiting message       | Text                 | "WAITING — TIRE CHANGE IN PROGRESS" (shown until tires done)           | No                  | —                |

### ASCII Wireframe

```
┌──────────────────────────────────────┐
│  ┌─────────┐ ┌──────┐  ┌──────────┐ │  ← Race HUD visible behind
│  │ P3      │ │ L5/5 │  │ 245km/h  │ │
│  │ +1.2s   │ │      │  │ ▮▮▮▮▮▮▮▮  │ │
│  └─────────┘ └──────┘  └──────────┘ │
│                                      │
│   ┌────────────────────────────┐     │
│   │      LORRIS RACING         │     │  ← Semi-transparent panel
│   │                            │     │     (30% dark bg, centred)
│   │  ┌──────────────────────┐  │     │
│   │  │  ⏳ TIRES — WORKING  │  │     │
│   │  └──────────────────────┘  │     │
│   │                            │     │
│   │  ┌──────────────────────┐  │     │
│   │  │  FUEL  ██████░░ 64% │  │     │
│   │  └──────────────────────┘  │     │
│   │                            │     │
│   │  ┌──────────────────────┐  │     │
│   │  │  WAITING — TIRE      │  │     │
│   │  │  CHANGE IN PROGRESS  │  │     │
│   │  └──────────────────────┘  │     │
│   │                            │     │
│   │  — or after tires done —   │     │
│   │                            │     │
│   │  ╔══════════════════════╗  │     │
│   │  ║ PRESS [ENTER] TO EXIT║  │     │
│   │  ╚══════════════════════╝  │     │
│   └────────────────────────────┘     │
│                                      │
└──────────────────────────────────────┘
```

---

## States & Variants

| State                    | Trigger                                     | What Changes                                                                                                    |
| ------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Service in progress**  | Car stops at garage (`pitStopped`)          | Panel shows TIRES WORKING (yellow pulse), FUEL bar filling (per-tick). Exit button hidden.                      |
| **Tires done**           | `tiresDone = true`                          | TIRES switches to DONE (green checkmark ✓). Exit button appears. Player may confirm to leave with partial fuel. |
| **Exiting**              | Confirm pressed                             | Panel dismissed. HUD remains visible. Car departs pit.                                                          |
| **Auto-exit**            | Fuel full + `exitGraceTimeout` (3s) elapsed | Same as Exiting — no player action required.                                                                    |
| **DNF (stalled in pit)** | Fuel runs out during service                | Pit panel replaced by DNF overlay. Race ends.                                                                   |

---

## Interaction Map

Mapping interactions for: Keyboard/Mouse + Gamepad (Full). Primary Input: Gamepad.

Single interactive element — the exit prompt. No navigation needed.

| Component   | Action | Keyboard | Gamepad | Feedback                     | Outcome                                                         |
| ----------- | ------ | -------- | ------- | ---------------------------- | --------------------------------------------------------------- |
| Exit prompt | Press  | ENTER    | A       | Brief button highlight flash | Car departs pit. Panel dismissed. HUD restored to full display. |

> **`confirm` action during pit**: Until `tiresDone = true`, ENTER/A is ignored (Pit Confirm Gate pattern). The waiting message informs the player why.

---

## Events Fired

| Player Action       | Event Fired                          | Payload              | Notes                                    |
| ------------------- | ------------------------------------ | -------------------- | ---------------------------------------- |
| Car enters pit zone | `pit.status` (pitEntry → pitStopped) | `carId`              | Triggered by Pit Stop system, not player |
| Tires complete      | `pit.tire_status` (done)             | `carId`              | Triggered by Pit Stop system             |
| Fuel progresses     | `pit.fuel_status` (x%)               | `carId, fuelPercent` | Per-tick update from Pit Stop system     |
| Confirm exit        | Set `pitState = departing`           | `carId`              | Clears `pendingDNF` per ADR-0014         |

---

## Transitions & Animations

| Transition          | Method                    | Duration  | Notes                                                                           |
| ------------------- | ------------------------- | --------- | ------------------------------------------------------------------------------- |
| Enter (pit service) | Instant panel appear      | 0ms       | No fade — player needs immediate feedback when car stops                        |
| Exit (departure)    | Instant panel dismiss     | 0ms       | Player regains full HUD immediately                                             |
| Tire status change  | Status text + colour swap | 0ms       | WORKING (yellow) → DONE (green). Pulse animation on WORKING (CSS/JS, ~1s cycle) |
| Fuel bar fill       | Smooth bar fill per tick  | Per 1/60s | Updated each physics tick during service                                        |

---

## Data Requirements

| Data                                          | Source System                                 | Read / Write | Notes                               |
| --------------------------------------------- | --------------------------------------------- | ------------ | ----------------------------------- |
| Pit service status (`pitStopped / departing`) | Pit Stop (via Event Bus `pit.status`)         | Read         | Determines overlay visibility       |
| Tire status (`working / done`)                | Pit Stop (via Event Bus `pit.tire_status`)    | Read         | Controls tire indicator display     |
| Fuel percentage (0-100%)                      | Pit Stop (via Event Bus `pit.fuel_status`)    | Read         | Controls fuel bar fill level        |
| Team name                                     | Race Configuration (from Single Race adapter) | Read         | Display text, constant for the race |

All data is event-driven — the overlay is a consumer only. No writes.

---

## Accessibility

Standard tier (MVP launch).

| Requirement                     | Implementation                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Keyboard input                  | Single ENTER press to exit after tires done. No navigation needed.                                                                     |
| Focus indicators                | Exit button has visible focus ring (2px accent border).                                                                                |
| Text contrast                   | White text on 30% dark panel background (#000000 at 30%). Meets WCAG AA.                                                               |
| Color-independent communication | Tire status uses text ("WORKING" / "DONE") and a checkmark icon, not colour alone. Fuel percentage is shown as both bar AND numeric %. |
| Motion sensitivity              | Zero transitions (instant appear/dismiss). Pulse animation on WORKING status is optional and non-essential.                            |

---

## Localization Considerations

| Element | String                            | Max Length (EN) | Layout Risk                                                          |
| ------- | --------------------------------- | --------------- | -------------------------------------------------------------------- |
| Label   | TIRES                             | 5 chars         | Low                                                                  |
| Status  | WORKING                           | 7 chars         | Low                                                                  |
| Status  | DONE                              | 4 chars         | Low                                                                  |
| Label   | FUEL                              | 4 chars         | Low                                                                  |
| Message | WAITING — TIRE CHANGE IN PROGRESS | 32 chars        | Medium — wrapped to two lines if needed                              |
| Button  | PRESS [ENTER] TO EXIT             | 21 chars        | Low — dynamic key name per device. Gamepad shows "PRESS [A] TO EXIT" |

Team names (LORRIS RACING, MACKLEN GP, etc.) are proper nouns and stay untranslated.

---

## Acceptance Criteria

- [ ] Pit overlay appears within 1 tick of car reaching `pitStopped` state
- [ ] "TIRES — WORKING" shows yellow pulsing text while tire change is in progress
- [ ] Tire indicator switches to "TIRES — DONE" with green checkmark when `tiresDone = true`
- [ ] Fuel bar fills progressively as fuel percentage increases (per-tick updates)
- [ ] Exit prompt appears only after tires are done (Pit Confirm Gate)
- [ ] ENTER/A on exit prompt dismisses overlay and starts pit departure
- [ ] ENTER/A is silently ignored (no effect) while tire change is in progress
- [ ] Full race HUD remains visible behind the semi-transparent panel
- [ ] All text reachable and readable at 720p resolution

## Open Questions

| Question                                                                                    | Owner         | Deadline     | Resolution                                                          |
| ------------------------------------------------------------------------------------------- | ------------- | ------------ | ------------------------------------------------------------------- |
| Should the exit button show a contextual key name (ENTER vs A) based on last active device? | ux-designer   | Alpha        | [Spec assumes yes — uses Context-Sensitive Hints pattern]           |
| Does the pulse animation on WORKING status add value or feel noisy?                         | game-designer | MVP playtest | [Optional — can be static text if pulse is distracting]             |
| Should AI pit stops be visible (ghost overlay showing rival pit status)?                    | game-designer | Alpha        | [Deferred — AI pit is deterministic, no overlay needed for Phase 1] |
