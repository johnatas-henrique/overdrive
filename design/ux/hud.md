# HUD Design

> **Status**: In Design
> **Author**: ux-designer
> **Last Updated**: 2026-06-22
> **Template**: HUD Design

---

## HUD Philosophy

"Minimal but present" — information-dense but unobtrusive. Speed, position, laps, fuel, tires, gap/timing, and lap times are always visible. The minimap is the only configurable element (toggle on/off, MVP default: on). In Alpha, 3-5 layout presets let the player reposition blocks. In MVP, a single fixed layout shows everything.

The HUD is the pilot's instrument panel — reliable, readable at a glance, and out of the way during intense racing. It never requires the player to look away from the track for more than a split second.

---

## Information Architecture

### Full Information Inventory

| #   | Item                                        | Source                                        |
| --- | ------------------------------------------- | --------------------------------------------- |
| 1   | Speed (km/h) + gear                         | Physics (direct read per frame)               |
| 2   | Lap counter                                 | Race Management (`car.lap.completed`)         |
| 3   | Position (current / total, e.g., "3/8")     | Race Management (`position.changed`)          |
| 4   | Position change indicator (▲N / ▼N / —)     | Race Management (`position.changed`)          |
| 5   | Fuel level (0–100%)                         | Fuel system (throttled event)                 |
| 6   | Tire condition (0–100%)                     | Tire Wear system (throttled event)            |
| 7   | Minimap                                     | Track + Environment (2D polyline)             |
| 8   | Countdown lights (5→1→green)                | Race Management (`race.light.countdown`)      |
| 9   | Alert messages                              | Contextual (PIT READY, FUEL EMPTY, etc.)      |
| 10  | Gap info — time delta to car ahead / leader | Race Management (direct or event)             |
| 11  | Lap times (current, last lap, fastest lap)  | Race Management (`car.lap.completed` payload) |
| 12  | Pit overlay panel                           | Pit Stop (`pit.status` and sub-events)        |
| 13  | DNF overlay                                 | Race Management (`car.dnf`)                   |
| 14  | Checkered overlay                           | Race Management (`race.checkered`)            |

### Categorization

| Item                     | Category       | Notes                                                 |
| ------------------------ | -------------- | ----------------------------------------------------- |
| Speed + gear             | **Must Show**  | Updated every frame. Primary data.                    |
| Lap counter              | **Must Show**  | Essential for strategy decisions.                     |
| Position (current/total) | **Must Show**  | Shows "3/8" — context of grid size.                   |
| Position change (▲/▼)    | **Contextual** | Fades after 1.5s. Visible only when position changes. |
| Fuel level               | **Must Show**  | Strategic resource — always visible.                  |
| Tire condition           | **Must Show**  | Strategic resource — always visible.                  |
| Minimap                  | **On Demand**  | Toggle on/off via HudConfig. Default: on.             |
| Countdown lights         | **Contextual** | Visible only during grid countdown sub-state.         |
| Alert messages           | **Contextual** | Appear per trigger, max 2 simultaneous (FIFO).        |
| Gap info                 | **Must Show**  | Time delta to cars ahead/behind.                      |
| Lap times                | **Must Show**  | Current, last, fastest — visible at all times.        |
| Pit overlay panel        | **Contextual** | Replaces HUD display zone during pit service.         |
| DNF overlay              | **Contextual** | Player DNF only.                                      |
| Checkered overlay        | **Contextual** | Race end only.                                        |

**Conflict check**: 8 Must Show items is appropriate for a racing game — the player needs all critical data simultaneously. No conflict with "Minimal but present" philosophy because each item is a single number or short bar, not a dense panel.

---

## Layout Zones

```
┌──────────────────────────────────────────────────────┐
│ ┌──────────────┐  ┌───────────┐  ┌─────────────────┐ │
│ │  LAP TIMES   │  │   SPEED   │  │  POSITION 3/8   │ │
│ │  Current 1:34│  │  245 km/h │  │  ▲1              │ │
│ │  Last    1:32│  │           │  │  Lap 3/5         │ │
│ │  Best    1:30│  │           │  │                  │ │
│ │ (upper left) │  │(upper cntr│  │ (upper right)    │ │
│ └──────────────┘  └───────────┘  └─────────────────┘ │
│                                                       │
│                                                       │
│             ⚫ ⚫ ⚫ ⚫ ⚫  (countdown, centre)          │
│                                                       │
│             "PIT READY" (alerts, centre)              │
│                                                       │
│                                                       │
│                                    ┌────────────────┐ │
│                                    │   MINIMAP      │ │
│                                    │                │ │
│                                    │ (right, below  │ │
│                                    │  position/lap) │ │
│                                    └────────────────┘ │
│                                                       │
│                              ┌────────────────────┐   │
│                              │  ⛽ ████░░ 64%     │   │
│                              │  ⚙ ██████░ 82%    │   │
│                              │ (lower right)      │   │
│                              └────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

**Zone breakdown**:

| Zone                | Position                      | Contents                                        | Rationale                                                       |
| ------------------- | ----------------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| **Top-left**        | Upper left corner             | Lap times (current, last, best)                 | Quick glance for time reference — does not distract from track  |
| **Top-centre**      | Upper centre column           | Speed + gear                                    | Primary data — line of sight with the track ahead               |
| **Top-right**       | Upper right corner            | Position (3/8) + change indicator + lap counter | Secondary race context — glance without leaving the racing line |
| **Centre-right**    | Right column, below top-right | Minimap                                         | Track overview — less frequent glance, right periphery          |
| **Lower-right**     | Bottom right corner           | Fuel bar + Tire bar + icons                     | Resource status — glance when planning pit strategy             |
| **Centre overlays** | Centre-middle                 | Countdown lights, Alert messages                | Temporary/contextual — overlay on track view                    |

**Zone widths** (reference: idealWidth 1920):

| Zone        | Width | Justification                                     |
| ----------- | ----- | ------------------------------------------------- |
| Top-left    | ~18%  | Lap times fit in narrow column                    |
| Top-centre  | ~42%  | Speed/largest element, centred naturally          |
| Top-right   | ~18%  | Position + lap + change indicator in compact area |
| Minimap     | ~18%  | Same width as right column above                  |
| Lower-right | ~18%  | Fuel + tire bars side by side, same width zone    |

Percentages are reference values — actual layout uses `widthFraction` per zone (HudConfig), not pixel values. In Alpha, 3-5 presets allow player repositioning.

### Zone Responsibilities

- **Top-left** (Lap Times): Current split (updating each tick), last completed lap, fastest lap of the session
- **Top-centre** (Speed): Digital km/h number + gear indicator. No unit label needed — iconography replaces text
- **Top-right** (Position + Lap): Position as "3/8" for grid context. Change arrow (▲/▼/—). Lap counter as "Lap 3/5"
- **Centre-right** (Minimap): Track outline + car dots in team colours. Toggle on/off via HudConfig
- **Lower-right** (Resources): Fuel bar + tire bar. Icons replace text (fuel pump ⛽ for fuel, gear ⚙ for tire)
- **Centre overlays** (Countdown + Alerts): 5 red circles for countdown. Alert text block for contextual messages

---

## HUD Elements

### Speed

| Field           | Value                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Zone**        | Top-centre                                                                                                                     |
| **Category**    | Must Show                                                                                                                      |
| **Content**     | Speed in km/h (digital number, white, 72px at 1920) + gear indicator as ordinal ("3rd", "4th", etc.), smaller, below or beside |
| **Update**      | Every frame — direct read from Physics (60fps)                                                                                 |
| **Visual form** | Bold white number. No unit label (iconography replaces text — speed is unmistakable)                                           |
| **Range**       | 0–360 km/h                                                                                                                     |
| **Animation**   | None — number changes instantly per frame                                                                                      |

### Position (with Lap Counter)

| Field           | Value                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Zone**        | Top-right                                                                                                                      |
| **Category**    | Must Show                                                                                                                      |
| **Content**     | "3/8" — current position over total grid. Change arrow (▲ / ▼ / —) below or beside (▲ gained, ▼ lost, — unchanged — no number) |
| **Update**      | Event-driven (`position.changed`)                                                                                              |
| **Visual form** | Bold white number, ~50px at 1920. ▲ green / ▼ red / — grey                                                                     |
| **Animation**   | Change indicator fades after 1.5s                                                                                              |
| **Lap counter** | "Lap 3/5" in smaller text below position. Updated on `car.lap.completed`                                                       |

### Lap Times

| Field           | Value                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Zone**        | Top-left                                                                                                                                         |
| **Category**    | Must Show                                                                                                                                        |
| **Content**     | Three rows: current split (live), last lap, fastest lap                                                                                          |
| **Format**      | "1:34.200" — MM:SS.mmm                                                                                                                           |
| **Update**      | Current split per frame during a lap. Last lap and fastest lap on `car.lap.completed` payload                                                    |
| **Visual form** | White numbers, ~32px at 1920. Labels in muted grey: "CUR", "LAST", "BEST"                                                                        |
| **Animation**   | Current split ticks every frame (no transition). Last/fastest snap-update on lap completion. Best lap in accent colour (e.g., magenta/highlight) |

### Gap Info

| Field           | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| **Zone**        | Part of top-centre or top-right (to be confirmed with layout tuning) |
| **Category**    | Must Show                                                            |
| **Content**     | Time delta to car ahead (+) and delta to leader (L)                  |
| **Format**      | "+1.2s (→) +0.8s (L)" — signed seconds with milliseconds             |
| **Update**      | Every few ticks (per tick data from Race Management)                 |
| **Visual form** | Light grey text, ~24px at 1920. Placed near position block           |
| **Animation**   | None — number changes per update                                     |

### Fuel Bar

| Field           | Value                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| **Zone**        | Lower-right                                                                                             |
| **Category**    | Must Show                                                                                               |
| **Content**     | Bar (0–100%) + numeric percentage                                                                       |
| **Visual form** | Horizontal bar, blue (#00BFFF). Fuel pump icon ⛽ replaces text label. Percentage number centred on bar |
| **Update**      | Throttled — every ~10 ticks (~6/s). Event-driven from Fuel system                                       |
| **Animation**   | Smooth bar fill per update. Critical (< 10%): bar pulses between blue and red at 0.5s interval          |
| **Bar height**  | ~40px at 1080p                                                                                          |
| **Bar width**   | ~160px at 1080p (in lower-right zone)                                                                   |

### Tire Bar

| Field           | Value                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------- |
| **Zone**        | Lower-right                                                                                   |
| **Category**    | Must Show                                                                                     |
| **Content**     | Bar (0–100%) + numeric percentage                                                             |
| **Visual form** | Horizontal bar, cyan (#00E5FF). Tire icon ⚙ replaces text label. Percentage centred on bar    |
| **Update**      | Throttled — every ~10 ticks (~6/s). Event-driven from Tire Wear system                        |
| **Animation**   | Smooth bar fill per update. Critical (≤20%): bar pulses between cyan and red at 0.5s interval |
| **Bar height**  | ~40px at 1080p (same as fuel)                                                                 |
| **Bar width**   | ~160px at 1080p (same as fuel)                                                                |

### Minimap

| Field           | Value                                                                                                                                                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zone**        | Centre-right                                                                                                                                                                                                                                                                                                              |
| **Category**    | On Demand (toggle via HudConfig)                                                                                                                                                                                                                                                                                          |
| **Content**     | Simplified track outline (2D polyline) + car position dots in team colours                                                                                                                                                                                                                                                |
| **Update**      | Event-driven — updates on `position.changed` only                                                                                                                                                                                                                                                                         |
| **Visual form** | Square container (18% screen width, ~160px at 1080p), dark background rgba(0,0,0,0.5). Track outline: 2px white polyline. Car dots: 8px diameter circles in team colours. Orientation: rotates with player car heading (north-up variant considered for Alpha). Zoom level auto-fits track to container with 10px margin. |
| **Animation**   | Position dots jump to new positions on update (no smooth interpolation)                                                                                                                                                                                                                                                   |
| **Performance** | First block to disable if profiling shows frame rate impact                                                                                                                                                                                                                                                               |

### Countdown Lights

| Field         | Value                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Zone**      | Centre overlays                                                                                                        |
| **Category**  | Contextual (countdown sub-state only)                                                                                  |
| **Content**   | 5 red circles, 24px diameter each, spaced evenly                                                                       |
| **Update**    | Event-driven (`race.light.countdown` — each event turns off one light)                                                 |
| **Animation** | Lights turn off one by one at 1s intervals (LIGHT_INTERVAL_TICKS = 60). All lights off = green flag = block disappears |
| **Position**  | Centre-top of screen, above track view                                                                                 |

### Alert Block

| Field           | Value                                                                                   |
| --------------- | --------------------------------------------------------------------------------------- |
| **Zone**        | Centre overlays (centre-middle, below countdown lights)                                 |
| **Category**    | Contextual                                                                              |
| **Content**     | Text messages: "PIT READY", "FUEL EMPTY", "CAR AHEAD", "CAR BEHIND", "+1 POS", "−1 POS" |
| **Update**      | Event-driven — each alert triggered by specific event                                   |
| **Behaviour**   | Max 2 simultaneous. FIFO replacement. Each alert auto-dismisses after 2s                |
| **Visual form** | 16px uppercase sans-serif, white text on dark background                                |
| **Animation**   | Instant appear, instant dismiss                                                         |

### Pit Overlay, DNF, Checkered

These are separate overlays:

- **Pit Overlay**: `design/ux/pit-overlay.md` — service progress panel during pit stop
- **DNF Overlay**: `design/ux/race-flow.md` Flow 3 — dark overlay with DNF text when player is eliminated
- **Checkered Overlay**: `design/ux/race-flow.md` Flow 3 — slow-motion + freeze + drone orbit sequence

They replace or overlay the active HUD per their specific triggers (pit.status, car.dnf, race.checkered).

---

## Dynamic Behaviours

| Behaviour              | Trigger                                                           | Effect                                                                         |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **HUD activation**     | GSM enters Racing state                                           | All Must Show blocks activate                                                  |
| **Countdown sequence** | `race.starting` → `race.light.countdown` (×5) → `race.green.flag` | Red lights appear one by one, turn off one by one, then disappear              |
| **Full race HUD**      | `race.green.flag`                                                 | All Must Show blocks fully active. Speed display starts.                       |
| **Pit overlay**        | `pit.status = pitStopped`                                         | Centred panel appears over HUD (semi-transparent). HUD remains visible behind. |
| **Pit exit**           | Car leaves pit exit zone                                          | Panel removed. Full HUD restored.                                              |
| **Position change**    | `position.changed`                                                | ▲/▼ indicator appears, auto-fades after 1.5s                                   |
| **Critical fuel**      | Fuel < 10%                                                        | Fuel bar pulses blue↔red at 0.5s interval                                      |
| **Critical tyre**      | Tyre ≤ 20%                                                        | Tyre bar pulses cyan↔red at 0.5s interval                                      |
| **DNF**                | `car.dnf` (player)                                                | Screen darkens (60% overlay). "DNF" + reason shown.                            |
| **Checkered**          | `race.checkered`                                                  | Overlay shows top 3 + player position.                                         |
| **HUD deactivation**   | GSM enters PostRace                                               | All blocks deactivate. PostRace handles results.                               |

---

## HUD States by Gameplay Context

| GSM State    | Sub-context    | HUD Visibility                   | Notes                                                       |
| ------------ | -------------- | -------------------------------- | ----------------------------------------------------------- |
| **Loading**  | —              | None                             | Loading screen replaces HUD entirely                        |
| **PreRace**  | Grid Cinematic | None                             | Grid cinematic visible. No HUD blocks.                      |
| **PreRace**  | Countdown      | Countdown Lights only            | Speed/position/resources hidden until green flag            |
| **Racing**   | Normal racing  | All blocks                       | Full HUD as defined in Layout Zones                         |
| **Racing**   | Pit service    | All blocks + Pit Overlay panel   | HUD visible behind semi-transparent panel                   |
| **Racing**   | Paused         | All blocks frozen behind overlay | Pause overlay centred. Race frame visible behind.           |
| **PostRace** | Drone orbit    | Reduced: speed + position only   | Remaining blocks fade out. Context-Sensitive Hints for skip |
| **PostRace** | Results        | None                             | Results screen replaces HUD entirely                        |
| **PostRace** | DNF            | Dark overlay (60%) + DNF text    | No HUD blocks visible                                       |

---

## Platform & Input Variants

| Variant                      | Difference                                   | Notes                                                   |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------- |
| **PC (1920×1080 reference)** | Full layout as specified                     | AdvancedDynamicTexture auto-scales to actual resolution |
| **Web (720p–1440p)**         | Auto-scale via Babylon.js idealHeight=1080   | No per-resolution layout changes                        |
| **Gamepad**                  | Context-sensitive hints show gamepad buttons | Single layout — hints update per last active device     |
| **Keyboard/Mouse**           | Context-sensitive hints show keyboard keys   | Same as gamepad — hints switch dynamically              |

**No platform-specific layout variants in Phase 1.** The same zone layout applies to all platforms. In Alpha, presets may offer alternative arrangements.

**Minimap toggle**: Available on all platforms via HudConfig. Default: enabled.

---

## Visual Budget

| Metric                          | Value                                                    | Notes                                                                                                                                            |
| ------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Max simultaneous elements**   | 10                                                       | Speed, gear, position, lap counter, position change arrow, fuel bar, tyre bar, minimap, gap info, lap times. Alerts and countdown are temporary. |
| **Max screen coverage**         | ~8%                                                      | All blocks are small and peripheral. At 1920×1080: ~165,000px² combined vs 2,073,600px² total screen.                                            |
| **Minimap disable impact**      | 8 elements, ~6%                                          | When minimap is toggled off, 8 elements remain covering ~6% of screen.                                                                           |
| **HUD area per zone**           | Top row ~4%, Lower-right ~2%, Centre-right (minimap) ~2% | Combined under 10%. Never obscures more than 1/10 of the play area.                                                                              |
| **Overlay (pause / pit / DNF)** | ~35% panel overlay                                       | Temporary — player not driving during overlay visibility. Centre-only, peripheral zones unaffected.                                              |

**Budget enforcement**: If profiling shows frame rate drop during MVP, minimap is the first block disabled. The toggle exists in HudConfig for this purpose.

---

## Accessibility

Standard tier (MVP launch).

| Requirement                         | Implementation                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Text contrast**                   | All text white (#FFFFFF) on dark semi-transparent backgrounds. Meets WCAG AA.                                                         |
| **Color-independent communication** | Critical fuel/tyre use pulsing animation + numeric percentage — not colour alone. Position change uses ▲/▼ arrows + green/red colour. |
| **Minimum font sizes**              | Speed: 72px at 1920 (~1.25° at 60cm viewing distance). Lap times: 32px (~0.5°). All meet minimum readable sizes.                      |
| **Motion sensitivity**              | Mechanical transitions (instant, no smooth fades). Countdown/pulse are non-essential and non-nauseating                               |
| **Keyboard navigation**             | HUD is read-only — no interactive elements during racing (pause/pit overlays handle input separately)                                 |

---

## Open Questions

| Question                                           | Resolution                                             | Status   |
| -------------------------------------------------- | ------------------------------------------------------ | -------- |
| Gap info: delta to car ahead, leader, or both?     | **Both** — show "+1.2s (→) +0.8s (L)" or similar       | Resolved |
| Gear indicator format                              | **Ordinal** — "3rd", "4th", etc.                       | Resolved |
| Lap times labels language                          | **English** — "CUR", "LAST", "BEST"                    | Resolved |
| Position change arrow: always or only when gained? | **Always** — ▲ gained, ▼ lost, — unchanged. No number. | Resolved |
| Minimap toggle default                             | **On in MVP**, toggle via HudConfig                    | Pending  |
| Gap info placement — top-centre or top-right?      | [To be decided during layout tuning]                   | Open     |
| Lap time current split: per-frame or throttled?    | [To be decided — per-frame may be expensive]           | Open     |
