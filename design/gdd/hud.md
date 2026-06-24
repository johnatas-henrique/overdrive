# HUD

> **Status**: Design Complete
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Speed That Is Felt

## Overview

The HUD system renders real-time race information on screen: speed, position, lap counter, fuel and tire status, minimap, and race-state overlays (pit status, DNF, checkered flag). It is a **consumer-only** system — it reads state from Event Bus events and renders via Babylon.js GUI (AdvancedDynamicTexture), never writing to gameplay state.

Visual design is owned by the art bible (`design/art/art-bible.md`, Section 7). This GDD defines what data is displayed, how blocks are structured, and the event-to-visual mappings.

---

## Player Fantasy

The player glances at the HUD and instantly knows everything they need: speed, how many laps remain, their position, fuel level, and tire condition. They never need a pause menu to assess their race state. The information is reliable, readable at a glance, and gets out of the way during intense racing.

---

## Detailed Design

### Core Rules

**1. Event-driven, no polling.** All HUD elements update in response to Event Bus events. No per-tick polling of systems. The HUD subscribes once at init and reacts to dispatch. **Exception: SpeedBlock reads `playerCar.physics.speedKmh` directly every frame** — speed needs smooth 60fps updates and is a trivial property read with zero system coupling (no event dispatch overhead needed for a value that changes 60×/s). Resource bars (fuel, tire) are throttled to ~6 updates/s via Event Bus events, never polled.

**2. Modular blocks.** Each HUD element (speed, lap counter, fuel bar, etc.) is an independent block. Blocks can be repositioned, resized, or hidden via `HudConfig` at init or through HMR.

**3. Consumer-only.** The HUD never emits events. It reads state from event payloads and renders. Zero coupling to gameplay logic.

**4. Mechanical transitions.** HUD animations follow the art bible rule (Section 7.6): mechanical, not organic. Flips, ticks, cuts. No smooth fades or easing curves.

**5. Zone-based responsive layout.** HUD blocks live inside named zones (left, center, right) that use percentage or star-based widths. The AdvancedDynamicTexture uses `idealWidth = 1920` — Babylon.js auto-scales all controls proportionally to the actual viewport, so reference sizes are consistent across resolutions. Block positions and sizes within a zone are relative to that zone's container, never absolute screen pixels. `HudConfig` defines zone widths and block-to-zone assignment, not per-block x/y coordinates.

**6. Pit overlay appears over race HUD.** When the car enters the pit state, a simplified pit overlay appears as a centred semi-transparent panel over the existing race HUD:

- Refuel progress bar (filled from `pit.fuel_status` events)
- Tire change indicator (from `pit.tire_status` events)
- Ready-to-exit prompt (press confirm)

The pit overlay is a centred panel (30% dark background) on its own GUI layer over the main HUD. The race HUD remains visible behind it — the player can see position, lap, and speed while waiting for service.

From the Pit Stop GDD: fuel is displayed as a progress bar filling in real-time; tire change is shown with a text indicator (WORKING/DONE). Camera remains unchanged.

### Block Architecture

```
HudContainer (AdvancedDynamicTexture, idealWidth=1920)
  ├── TopRow (horizontal stack)
  │   ├── TopLeftZone     ── LapTimesBlock (CUR / LAST / BEST)
  │   ├── TopCenterZone   ── SpeedBlock (km/h + gear ordinal)
  │   └── TopRightZone    ── StackPanel[ PositionBlock, LapBlock ]
  │
  ├── CentreOverlays
  │   ├── CountdownBlock     — 5 red → 1 → GREEN lights sequence (above track centre)
  │   └── AlertBlock         — contextual messages, max 2 (FIFO)
  │
  ├── MinimapBlock           — right column, below top-right zone
  │
  ├── BottomRightZone        ── StackPanel[ FuelBar, TireBar ]
  │
  ├── PitOverlayBlock        — centred semi-transparent panel over HUD
  ├── DNFOverlay             — screen darkens, "DNF" text, reason subtitle
  └── CheckeredOverlay       — animated checkered flag + top 3 + player position

  HudBlock (abstract interface)
    ├── id: string
    ├── onActivate(ctx: HudContext): void
    ├── onDeactivate(ctx: HudContext): void
    └── config: HudBlockConfig
```

### Init & Lifecycle

```typescript
// HUD init — called once when GSM transitions to Racing
function init(config: HudConfig): void {
  // config specifies which blocks are active and their positions
  // Default: all blocks active, art-bible default positions
  blocks.forEach((block) => {
    if (config.blocks.includes(block.id)) {
      block.onActivate(hudContext);
    }
  });
}

// HUD lifecycle tied to GSM:
// Menu → GSM enter Menu → HUD deactivates (no race HUD)
// Menu → GSM enter PreRace → no HUD (camera-only)
// PreRace → GSM enter Racing → HUD init
// Racing → GSM enter Paused → HUD adds pause overlay (semi-transparent, on top of race HUD)
// Paused → GSM enter Racing → HUD removes pause overlay, resumes full race HUD
// Racing → GSM enter PostRace → HUD deactivates (results shown by PostRace)
```

### Event Subscriptions

| Event                      | Block                       | Reaction                                                                                                                                 |
| -------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `race.starting`            | CountdownBlock              | Show 5 red lights. React to `race.light.countdown` — each event turns off one light (5→4→…→1→0). On `race.green.flag`, remove the block. |
| `race.green.flag`          | All                         | Enable all race HUD blocks. Start speed display (if not already started by countdown timer expiry).                                      |
| `car.lap.completed`        | LapBlock, LapTimesBlock     | LapBlock: update lap counter "Lap 3/5". LapTimesBlock: update last lap time, check if new fastest.                                       |
| `position.changed`         | PositionBlock, GapInfoBlock | PositionBlock: update position number, show ▲/▼ indicator for 1.5s. GapInfoBlock: update time deltas to car ahead and leader.            |
| `car.dnf`                  | DNFOverlay                  | If player: screen darkens, "DNF" shown. If rival: position grid grays out their entry.                                                   |
| `race.checkered`           | CheckeredOverlay            | Show animated checkered flag. Display top 3 + player position.                                                                           |
| `race.completed`           | All                         | HUD deactivates. Results handled by PostRace system.                                                                                     |
| `pit.status`               | PitOverlayBlock             | If status is `pitStopped`: show pit overlay panel (fuel bar, tire status, confirm prompt). When status returns to `onTrack`: hide panel. |
| `pit.fuel_status`          | PitOverlayBlock             | Update fuel progress bar in pit overlay.                                                                                                 |
| `pit.tire_status`          | PitOverlayBlock             | Update tire change icons. Show check marks as each tire is done.                                                                         |
| — (tick data from Physics) | SpeedBlock                  | Speed value from Physics car state, read every frame — see Core Rule #1 exception.                                                       |

### Block Details

#### SpeedBlock

- Displays current speed in km/h as a bold white number (art bible 7.3 — 72px at 1920 ideal)
- Updates every frame from `playerCar.physics.speedKmh`
- Unit label "km/h" in muted text below, ~15% of speed font size
- No animation — number changes instantly each frame
- Range: 0–360 km/h (F1 1991 top speed ~320 km/h at Monza, 360 is safe margin)

#### LapBlock

- Format: "Lap {current}/{total}" — e.g., "Lap 2/4"
- Total laps from `RaceConfiguration.lapCount`
- Reacts to `car.lap.completed` event
- Mechanical flip animation (0.1s tick, no smooth transition) per art bible 7.6
- Bold white text, ~60% of speed font size, on rgba(0,0,0,0.35) background

#### PositionBlock

- Format: "{current}/{total}" — e.g., "3/8"
- Change indicator: ▲ (gained), ▼ (lost), — (unchanged). No number.
- Indicator fades after 1.5s per art bible 7.3
- Reacts to `position.changed` event
- Bold white text, ~70% of speed font size, on rgba(0,0,0,0.35) background

#### GapInfoBlock

- Time delta to car ahead ("+1.2s →") and delta to leader ("+0.8s L")
- Format: signed seconds with tenths precision (e.g., "+1.2s →")
- Reacts to `position.changed` event (updates when overtakes or gaps change)
- Light grey text, ~24px at 1920, below position block
- No animation

#### LapTimesBlock

- Three rows: current split (live), last lap (from `car.lap.completed`), fastest lap
- Format: "MM:SS.mmm" — e.g., "1:34.200"
- Labels: "CUR", "LAST", "BEST" in muted grey
- Current split updates every frame (direct read, same as SpeedBlock exception)
- Last lap and fastest lap update on `car.lap.completed` event
- Fastest lap in accent colour (highlight) when beaten
- Top-left zone

#### ResourcesBlock

- Two bars stacked: Fuel (top) + Tire (bottom)
- Bar color: Fuel blue (#00BFFF), Tire cyan (#00E5FF) per art bible
- Icons replace text labels: fuel pump ⛽ for fuel, gear ⚙ for tire
- Width: 92% of zone container
- Bar height: proportional to zone height (~40% of zone per bar, with ~10% gap)
- Percentage text centered on each bar
- Fuel bar reacts to tank updates (consumed each tick — HUD updates via a throttle, not every tick, e.g., every 10 ticks or 6 times/sec)
- Tire bar reacts to tire condition changes
- Fuel critical (≤15%): bar pulses between current color and red (0.5s interval per art bible 7.6)
- Tire critical (≤20%): bar pulses similarly

**Throttle strategy for resource bars**: Fuel and tire data updates are important but don't need 60fps. The HUD reads `playerCar.runtime.fuelLevel` and `playerCar.runtime.tireCondition` every 10 ticks (~6 times/sec at 60fps) to reduce Event Bus traffic and rendering overhead.

#### MinimapBlock

- Square container in centre-right zone, fills zone with 5% padding (art bible 7.3)
- Dark background rgba(0,0,0,0.5)
- Simplified track outline (Track + Environment provides a 2D polyline for the minimap)
- Car position dots in team colors
- Only updates position when `position.changed` fires (not every tick)
- Toggle on/off via HudConfig (default: on, but first to disable for performance)
- Phase 1: static track outline, no rotation or zoom
- Future: minimap rotation with car heading, zoom in/out

The minimap is the most expensive HUD block. If performance profiling shows it impacts frame rate, it is the first block to be disabled (via HudConfig flag). The race is still fully playable without it.

#### PitOverlayBlock

- Replaces the main HUD blocks when pit.status transitions to active
- Layout: simplified, positioned for pit lane awareness
- Refuel progress bar: fills from 0% to 100%, animated smoothly (the only non-mechanical animation exception — fuel level changes at `pit.refuelRate` per tick)
- Tire change: 4 tire icons (top-left, top-right, bottom-left, bottom-right in square layout), filled with check mark as each completes
- Speed: shows "80 km/h" (pit limiter active) — it's not the variable player speed
- Exit prompt: "Press [confirm] to leave pit" appears after tire change is complete and refuel is in progress
- Returns to race HUD when pit.status returns to idle (car has left pit exit zone)

#### DNFOverlay

- Triggered by `car.dnf` where carId === playerCarId
- Screen dims with a dark overlay (rgba(0,0,0,0.6))
- Centered "DNF" text in bold white, ~10% of viewport height (at 1080p = ~108px)
- DNF reason subtitle: "FUEL EMPTY" or "STALLED IN PIT" in muted white, ~25% of DNF text size
- Remains visible until GSM transitions to PostRace
- No animation — instant display per mechanical rule

#### CheckeredOverlay

- Triggered by `race.checkered` — payload includes results
- Brief animated checkered flag overlay (0.3s per art bible 7.6)
- Displays top 3: "P1 · TeamName", "P2 · TeamName", "P3 · TeamName" in bold, ~8% vh
- If player is in top 3, shows only top 3 (player highlighted). If player is P4–P8, shows top 3 + "P(X) · You" at bottom.
- Remains visible until GSM transitions to PostRace
- Slow-motion entry effect (0.3s of 50% perceived speed, then freeze)

### HudConfig

Layout is defined by zones, not per-block coordinates. The top bar has three zones whose widths are configurable in `hud.layout`. Each zone references blocks by ID — blocks within a zone stack vertically via StackPanel. Block sizes are relative to their zone container.

```typescript
interface HudZoneConfig {
  id: string; // 'left' | 'center' | 'right'
  width: {
    value: number; // e.g., 20 for 20%
    unit: "percent" | "star"; // 'star' = fills remaining space
  };
  blocks: string[]; // ordered block IDs in this zone
  padding: {
    // percentage of zone size
    x: number; // 0.0–1.0, e.g. 0.02 = 2%
    y: number;
  };
}

interface HudBlockConfig {
  id: string; // block identifier
  visible: boolean; // default: true
  size: {
    width: number; // percentage of zone width (0.0–1.0), e.g. 0.92 = 92%
    height: number; // percentage of zone height (0.0–1.0)
  };
}

interface HudConfig {
  zones: HudZoneConfig[]; // zone layout (ordered left→right)
  blocks: HudBlockConfig[]; // all block configs (matched by id)
  animSpeed: number; // animation duration multiplier (1.0 default)
  resourcesUpdateInterval: number; // ticks between resource bar refreshes (default: 10)
}
```

**Default HudConfig** (UX spec HUD layout):

```typescript
const defaultHudConfig: HudConfig = {
  zones: [
    {
      id: "top-left",
      width: { value: 18, unit: "percent" },
      blocks: ["laptimes"],
      padding: { x: 0.015, y: 0.01 },
    },
    {
      id: "top-center",
      width: { value: 1, unit: "star" },
      blocks: ["speed"],
      padding: { x: 0, y: 0.01 },
    },
    {
      id: "top-right",
      width: { value: 18, unit: "percent" },
      blocks: ["position", "lap"],
      padding: { x: 0.015, y: 0.01 },
    },
  ],
  blocks: [
    { id: "speed", visible: true, size: { width: 1.0, height: 0.35 } },
    { id: "lap", visible: true, size: { width: 1.0, height: 0.25 } },
    { id: "position", visible: true, size: { width: 1.0, height: 0.25 } },
    { id: "laptimes", visible: true, size: { width: 0.95, height: 0.95 } },
    { id: "minimap", visible: true, size: { width: 0.95, height: 0.95 } },
    { id: "fuel", visible: true, size: { width: 0.95, height: 0.4 } },
    { id: "tire", visible: true, size: { width: 0.95, height: 0.4 } },
  ],
  animSpeed: 1.0,
  resourcesUpdateInterval: 10,
};
```

Config-driven via Data & Config Manager under the `hud.*` namespace. HMR applies changes to zone widths, block visibility, and block sizes in real-time for developer tuning. The zone structure decouples layout from block logic — you can move a block to a different zone by changing its `zones[].blocks` entry, no code change needed.

---

## States & Transitions

| State          | Description                                                                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inactive**   | No HUD visible. Default for Menu, Loading, PreRace.                                                                                                                                          |
| **Active**     | Race HUD visible. HUD initializes when GSM enters Racing. CountdownBlock shows during Countdown sub-state. Full race blocks (speed, lap, position, resources) activate on `race.green.flag`. |
| **PitOverlay** | Pit overlay shown as centred panel over race HUD. Entered when pit state is not idle. Returns to Active on idle.                                                                             |
| **DNF**        | DNF overlay shown. Entered on player DNF.                                                                                                                                                    |
| **Checkered**  | Checkered overlay shown. Entered on race.checkered.                                                                                                                                          |

Transition flow:

```
Inactive → Active (GSM → Racing, GreenFlag)
Active ←→ PitOverlay (pit.status === active/idle)
Active → DNF (car.dnf, player)
Active → Checkered (race.checkered)
Any → Inactive (GSM → PostRace)
```

---

## System Interactions

| System                  | Interaction                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Event Bus**           | Primary input. HUD subscribes to 10+ events from Race Management, Pit Stop, Fuel, Tire Wear.                                         |
| **Physics/Handling**    | Speed value read from CarEntity.physics.speedKmh (direct read, not event-driven — only exception).                                   |
| **Race Management**     | Position, lap count, race state via events (`position.changed`, `car.lap.completed`, `race.checkered`, `race.completed`, `car.dnf`). |
| **Pit Stop**            | Pit status and refuel/tire progress via events (`pit.status`, `pit.fuel_status`, `pit.tire_status`).                                 |
| **Camera**              | No direct interaction. HUD renders separately from camera view.                                                                      |
| **Data & Config**       | Reads `HudConfig` from `hud.*` namespace. Applies HMR live.                                                                          |
| **GSM**                 | HUD lifecycle: activate on Racing entry, deactivate on Racing exit.                                                                  |
| **Track + Environment** | Minimap outline polyline (2D data provided at track load).                                                                           |

---

## Edge Cases

| Case                                                       | Behaviour                                                                                                                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Player DNF and checkered in same frame**                 | Impossible — player DNF ends race immediately. The leader cannot checker in the same tick the player DNF.                                                             |
| **Pit overlay during DNF**                                 | If player DNF while in pit (stalled), DNF overlay overrides pit overlay. Pit overlay events stop firing.                                                              |
| **Speed display at 0 km/h (grid)**                         | SpeedBlock shows "0" during PreRace (grid cinematic) and Countdown sub-state. Normal operation.                                                                       |
| **Position jumps (multiple position changes in one tick)** | PositionBlock only reacts to the final state. `position.changed` fires sequentially — HUD reads the latest value. Change indicator shows net gain/loss between ticks. |
| **HUD toggled off mid-race**                               | HudConfig with no blocks → HUD renders nothing but remains Active. Blocks reactivate on config change.                                                                |
| **Minimap track outline not available**                    | MinimapBlock detects missing polyline at init → renders empty dark container with "MAP" label (subdued) — indicates missing data, not a bug.                          |
| **Fuel and tire bars at 0 in pit**                         | During refuel/tire change, fuel bar shows current level (could be 0 at garage entry). Normal — refuel fills progressively.                                            |

---

## Dependencies

| System                  | Dependency Type | Notes                                               |
| ----------------------- | --------------- | --------------------------------------------------- |
| **Event Bus**           | Hard            | All HUD updates come from events.                   |
| **Race Management**     | Hard            | Position, lap, race state.                          |
| **Physics/Handling**    | Hard            | Speed read (direct).                                |
| **Pit Stop**            | Hard            | Pit overlay via events.                             |
| **Data & Config**       | Soft            | HudConfig for block layout and visibility.          |
| **Fuel**                | Hard            | Fuel level for bar.                                 |
| **Tire Wear**           | Hard            | Tire condition for bar.                             |
| **Track + Environment** | Soft            | Minimap polyline (optional — HUD works without it). |

---

## Tuning Knobs

| Parameter                      | Default | Description                        |
| ------------------------------ | ------- | ---------------------------------- |
| `hud.layout.top-left.width`    | 18      | Top-left zone width in percent     |
| `hud.layout.top-right.width`   | 18      | Top-right zone width in percent    |
| `hud.layout.laptimes.visible`  | true    | Lap times block visible            |
| `hud.layout.minimap.visible`   | true    | Minimap block visible (toggle)     |
| `hud.layout.speed.visible`     | true    | Speed block visible                |
| `hud.layout.lap.visible`       | true    | Lap block visible                  |
| `hud.layout.position.visible`  | true    | Position block visible             |
| `hud.layout.gap.visible`       | true    | Gap info block visible             |
| `hud.layout.fuel.visible`      | true    | Fuel bar visible                   |
| `hud.layout.tire.visible`      | true    | Tire bar visible                   |
| `hud.anim.speed`               | 1.0     | Animation duration multiplier      |
| `hud.resources.updateInterval` | 10      | Ticks between resource bar updates |

All values in the `hud.*` namespace, config-driven via Data & Config Manager, HMR supported.

---

## Acceptance Criteria

1. HUD init during GreenFlag shows all default blocks (speed, lap, position, lap times, gap info, minimap, fuel, tire)
2. SpeedBlock updates every frame from Physics and displays correct km/h
3. SpeedBlock shows gear as ordinal ("3rd", "4th", etc.)
4. LapBlock updates when `car.lap.completed` fires and shows "{current}/{total}"
5. PositionBlock updates on `position.changed` with correct ▲/▼/— indicator (no number)
6. PositionBlock shows "{current}/{total}" format (e.g., "3/8")
7. Position change indicator fades after 1.5s
8. GapInfoBlock shows delta to car ahead and delta to leader
9. LapTimesBlock shows current split, last lap, and fastest lap with "CUR"/"LAST"/"BEST" labels
10. ResourcesBlock shows correct fuel and tire levels from shared state
11. ResourcesBlock uses icons (⛽ ⚙) instead of text labels
12. ResourcesBlock pulses when fuel ≤ 15% or tire ≤ 20%
13. ResourcesBlock pulses when fuel ≤ 15% or tire ≤ 20%
14. PitOverlayBlock activates on `pit.status = active` and shows refuel bar + tire check marks + exit prompt
15. PitOverlayBlock deactivates and restores race HUD when `pit.status = idle`
16. DNFOverlay activates on player DNF and shows "DNF" with reason subtitle
17. CheckeredOverlay activates on `race.checkered` and shows top 3 + player position
18. HUD deactivates on GSM PostRace transition
19. Invalid HudConfig (unknown block id) is logged and skipped — other blocks load normally
20. MinimapBlock renders correctly with provided polyline and team-colored position dots
21. MinimapBlock without polyline data renders empty dark container (no crash)
22. HUD with zero active blocks in HudConfig runs silently (no errors, no rendering)
23. Zone layout changes via HMR (zone width, block visibility, block-to-zone reassignment) take effect within 1 tick
