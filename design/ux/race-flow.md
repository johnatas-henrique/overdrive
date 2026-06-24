# UX Spec: Race Flow

> **Status**: In Design
> **Author**: user + ux-designer
> **Last Updated**: 2026-06-22
> **Journey Phase(s)**: First Contact, Orientation, First Mastery
> **Platform Target**: PC (web — Electron/Tauri)
> **Template**: UX Spec

---

## Purpose & Player Need

The player has completed race setup and wants to get into the action. The Loading screen holds anticipation while assets load. The Grid Cinematic creates the tension moment before the start — the player sees the cars lined up, engines revving. The Countdown 5→1 builds the climax: "any second now." The Green Flag releases the race. When crossing the finish line, the Checkered Flag delivers the result with impact — slow-motion, freeze, drone orbit.

The entire flow is an **emotional curve**: expectation (loading) → tension (grid) → climax (green flag) → satisfaction or frustration (checkered). The UX must amplify each point without getting in the way.

---

## Flow Overview

```
[Menu Race Setup]
       │ CONFIRM
       ▼
  ┌─────────────────────────────────────┐
  │  Loading (0.5s min, skip if <0.5s)  │  ← assets load in background
  └─────────────────────────────────────┘
       │ LOADED
       ▼
  ┌─────────────────────────────────────┐
  │  Grid Cinematic (8s or skip)        │  ← cars aligned, camera on grid
  └─────────────────────────────────────┘
       │ TIMEOUT ou CONFIRM
       ▼
  ┌─────────────────────────────────────┐
  │  Countdown 5→1 (5s, 1s/light)       │  ← lights turn off one by one (red→off), beep at each light
  └─────────────────────────────────────┘
       │ GREEN FLAG
       ▼
  ╔═════════════════════════════════════╗
  ║           RACING                    ║  ← race active
  ╚═════════════════════════════════════╝
       │ CHECKERED
       ▼
  ┌─────────────────────────────────────┐
  │  Slow-motion (0.3s) → Freeze →      │
  │  Drone Orbit (max 30s, or CONFIRM)  │  ← partial results
  └─────────────────────────────────────┘
       │ SKIP ou TIMEOUT
       ▼
  ┌─────────────────────────────────────┐
  │        RESULTS SCREEN               │  ← see menu.md
  └─────────────────────────────────────┘
```

The timeline is linear and irreversible. Each transition is triggered by a timer or player input (skip). The player never goes back to a previous flow.

---

## Flow 1: Loading → PreRace (Grid Cinematic)

### Purpose

Transition the player from setup (menus) to the track without breaking immersion. The Loading screen hides technical loading; the Grid Cinematic delivers the visual payoff of seeing the cars lined up. The player arrives at the grid already in the race mood.

### Timeline

| Moment             | Duration                      | Accumulated | Description                                                               |
| ------------------ | ----------------------------- | ----------- | ------------------------------------------------------------------------- |
| **Loading**        | 0.5s minimum (skip if < 0.5s) | —           | Assets load in background. If instantaneous, jumps straight to Grid.      |
| **Grid Cinematic** | 8s (or CONFIRM skip)          | +8s         | Camera positioned in front of the grid, cars stationary, engines revving. |
| **Countdown**      | 5s (1s/light)                 | +5s         | Lights turn off sequentially 5→1. All off = GREEN. Event `race.light.countdown`.            |
| **Green Flag**     | —                             | —           | Transition to Racing. Race begins.                                        |

### What the Player Sees

**Loading**:

- Track name (large, center, `#FFFFFF`, ~72px)
- Random loading tip (below the name, `#888888`, ~16px)
- Optional: minimalist track silhouette (7.7 Track Silhouette style)
- If loading fails: error message + "Returning to menu" + return to Title
- If Race Again (assets cached): loading does not appear — instant transition to Grid

**Grid Cinematic**:

- Camera positioned at the **front of the grid**, facing the cars (ADR-0007 Grid Camera)
- The 8 cars lined up in 2×4 positions (garage ordered by qualification, player in P8 at the back)
- Player's car highlighted (camera subtly closer or slight visual emphasis)
- Grid camera follows "look-ahead": positioned ahead of the first car, pointing at the last, automatically adapting to any grid size (ADR-0015 W4-4)
- Fixed duration of **8s**. Skip via CONFIRM (ENTER/A) at any time
- Transition to Countdown: camera smoothly moves to cockpit (or chase) as the first lights turn on

### What the Player Hears

**Loading**:

- Ambient engine (low) if assets already loaded
- No music — silence or ambient engine creates anticipation

**Grid Cinematic**:

- Idling engines (8s loop)
- 500ms crossfade: ambient engine → pre-race tension (breathing, engine roar)
- Countdown: sharp beep at each light. At green flag, general acceleration sound + race music begins

### Entry Trigger

- `gsm.state.entered` with `from: 'Loading', to: 'PreRace'` — fired when assets finish loading
- Loading screen disappears instantly (`isVisible = false`), race scene appears

### Exit Triggers

| Trigger     | Condition                | Destination                    |
| ----------- | ------------------------ | ------------------------------ |
| **Timeout** | 8s elapsed without input | Countdown starts automatically |
| **Skip**    | CONFIRM during Grid      | Jumps to Countdown immediately |
| **Error**   | Loading fails            | Returns to Menu (Title)        |

### States & Variants

| State                       | Trigger           | What Changes                                        |
| --------------------------- | ----------------- | --------------------------------------------------- |
| **Normal**                  | Grid loaded       | Camera on grid, cars visible, duration 8s           |
| **Loading required**        | Assets not cached | Loading screen visible with progress. Actual wait.  |
| **Race Again (no loading)** | Assets cached     | Instant transition — Loading does not appear        |
| **Loading error**           | Loading failure   | Error message + "Returning to menu" + GSM → Menu    |
| **Skip**                    | CONFIRM pressed   | Grid interrupted, immediate transition to Countdown |

### Interaction Map

| Component      | Action | Keyboard | Gamepad | Feedback           | Outcome                           |
| -------------- | ------ | -------- | ------- | ------------------ | --------------------------------- |
| Grid Cinematic | Skip   | ENTER    | A       | Instant transition | Jumps to Countdown                |
| Grid Cinematic | (none) | —        | —       | Timer expired (8s) | Automatic transition to Countdown |

### Events Fired

| Trigger                         | Event                  | Payload                                                                                        |
| ------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| Grid complete (timeout or skip) | `race.starting`        | `{ tick }` — emitted on the first pipeline tick after Countdown starts (deferred for HUD init) |
| Light turns on                  | `race.light.countdown` | `{ lightsOn: 1..5 }` — 5 times, 1s interval                                                    |

### Edge Cases

1. **Assets load in 200ms**: Loading does not appear — direct transition to Grid Cinematic. The player sees the grid without artificial delay.
2. **Assets take >5s**: Loading continues until complete. There is no loading timeout — the player waits as long as needed.
3. **Grid cinematic skipped immediately**: The countdown starts on the same frame. The player misses the grid scene but not the countdown.
4. **Loading fails after grid cinematic starts**: Does not occur — grid cinematic only starts after loading is complete. If an asset becomes corrupted during execution, the error is handled by the Asset Manager (ADR-0003).

---

## Flow 2: PreRace → Racing (Countdown & Green Flag)

### Purpose

Build the climax of the final seconds before the race. Each light that turns on increases tension. When the 5th light turns on and the green flag triggers, energy explodes — the cars launch, the music starts, the race is alive. The player should not want to skip this moment on the first race.

### Timeline

| Moment               | Duration | Accumulated | Description                                               |
| -------------------- | -------- | ----------- | --------------------------------------------------------- |
| **Light 1 turns on** | 1.0s     | 1.0s        | First green light (`lightsOn: 1`). Beep.                  |
| **Light 2 turns on** | 1.0s     | 2.0s        | Second light (`lightsOn: 2`). Beep.                       |
| **Light 3 turns on** | 1.0s     | 3.0s        | Third light (`lightsOn: 3`). Beep.                        |
| **Light 4 turns on** | 1.0s     | 4.0s        | Fourth light (`lightsOn: 4`). Beep.                       |
| **Light 5 turns on** | 1.0s     | 5.0s        | Fifth light (`lightsOn: 5`). Beep.                        |
| **Green Flag**       | —        | 5.0s        | Release: `race.green.flag` emitted. Physics unlocks cars. |

Total fixed: **5 seconds**. No countdown skip — the player waits for all 5 lights.

### What the Player Sees

- Camera smoothly transitions from grid camera to **cockpit camera** (default) or **chase camera** (if the player switched before the race)
- 5 circles on the upper-center HUD: all red (off). Every 1s, one turns **green** (on)
- The lit circle stays green — it does not go out. The effect is of "lights turning on", not "lights passing by"
- When the 5th light turns on (and all 5 are green), the green flag fires
- HUD blocks appear (speed, position, lap, resources) — before the green flag, the HUD is clean (countdown only)

### What the Player Hears

- **Sharp beep** at each light that turns on (~500ms, 440Hz)
- Idling engines (continuation from Grid Cinematic)
- **Green flag**: sudden acceleration sound from all cars + race music begins (500ms crossfade from pre-race tension)

### Entry Trigger

- `race.starting` emitted when Grid Cinematic ends (timeout or skip)
- Camera transitions to cockpit/chase within the first 1-2 ticks
- The first light turns on on the tick following `race.starting`

### Exit Trigger

- `race.green.flag` emitted after the 5th light turns on (5s from countdown start)
- Signals Physics to unlock cars (`physics.setLocked(carId, false)`)
- HUD starts updating normally (position, speed, fuel, tire)
- Audio: crossfade to race music + accelerating engine

### States & Variants

| State                  | Trigger                 | What Changes                               |
| ---------------------- | ----------------------- | ------------------------------------------ |
| **Countdown active**   | Grid ended              | Lights turning on sequentially. HUD clean. |
| **Green flag**         | 5th light turns on      | Cars unlocked. HUD active. Race begins.    |
| **Race start delayed** | (not applicable in MVP) | Always fixed 5s. No false start in arcade. |

### Interaction Map

| Component  | Action | Keyboard | Gamepad | Feedback                           | Outcome               |
| ---------- | ------ | -------- | ------- | ---------------------------------- | --------------------- |
| Countdown  | —      | —        | —       | Lights turn on, beep at each tick  | Automatic 5s sequence |
| Green Flag | —      | —        | —       | General acceleration, music starts | Race released         |

**Note**: Countdown is unbreakable. No player input accelerates or interrupts the sequence.

### Events Fired

| Trigger            | Event                  | Payload                                                    |
| ------------------ | ---------------------- | ---------------------------------------------------------- |
| Countdown start    | `race.starting`        | `{ tick }` — emitted on the first pipeline tick after Grid |
| At each light      | `race.light.countdown` | `{ lightsOn: 1..5 }` — 5 emissions, 1s between each        |
| 5th light turns on | `race.green.flag`      | `{ tick }` — releases cars, HUD, audio                     |

### Edge Cases

1. **Tab blur during countdown**: The countdown does NOT freeze — the timer keeps running (determinism, ADR-0002). When the player returns, they may be at the green flag. Inputs zeroed by Tab Blur Safety do not affect the locked simulation.
2. **Pause during countdown**: **Not allowed.** The countdown is unbreakable — ESC/START does not open pause until the green flag. (GSM remains in PreRace, not Racing — pause only exists in Racing.)
3. **HUD does not appear before green flag**: Intentional. HUD blocks stay hidden during countdown (visible only after `race.green.flag`). Only the countdown lights block is visible.
4. **Multiple `race.starting` emitted**: Protected by the RM sub-state machine (ADR-0015) — the event is only emitted once per race.

---

## Flow 3: Racing → PostRace (Checkered & Results)

### Purpose

Deliver the moment of victory (or defeat) with the weight it deserves. The slow-motion captures the last instant of the race. The drone orbit gives the player time to process the result before being taken to the results screen. The flow is a **breather** between the tension of the race and the analysis of the results.

### Timeline

| Moment             | Duration                  | Accumulated | Description                                                                      |
| ------------------ | ------------------------- | ----------- | -------------------------------------------------------------------------------- |
| **Checkered Flag** | —                         | —           | Race Management detects race-end condition. `race.checkered` emitted.            |
| **Slow-motion**    | 0.3s                      | 0.3s        | Simulation runs at 50% speed. Camera stays on active view.                       |
| **Freeze**         | 0.5s                      | 0.8s        | Simulation freezes. Current frame displayed as still. "CHEQUERED FLAG" overlaid. |
| **Drone Orbit**    | max 30s (or CONFIRM skip) | 30.8s       | Camera transitions to drone orbiting the player's car. Partial result appears.   |
| **Results Screen** | —                         | —           | Transition to results screen (menu.md). `gsm.state.entered(PostRace)`.           |

### What the Player Sees

**Checkered Flag + Slow-motion**:

- Simulation continues for 0.3s at **50% of normal speed** (tick pipeline executes dt/2)
- Camera stays on the active view (cockpit or chase) — the player sees the car slowing down in slow-motion
- HUD continues updating (speed dropping, final position)

**Freeze**:

- Simulation stops. Current frame frozen on screen
- Central overlay: **"CHEQUERED FLAG"** in large letters (72px, white, uppercase)
- HUD still visible behind the overlay (like pit-overlay, but without semi-transparency — opaque center with semi-transparent edges)
- Duration: fixed 0.5s — the player does not interact during freeze
- Fade out of "CHEQUERED FLAG" in the last 0.2s of freeze (smooth transition)

**Drone Orbit**:

- 0.5s transition from current camera to ArcRotateCamera in drone mode (ADR-0007)
- Camera orbits the player's car at **1 revolution per 15s**
- Player's car visible at the center of the orbit. Other cars may be visible in the background
- Reduced HUD: only speed + position (if not yet calculated). Remaining blocks fade out
- Bottom-corner indicator: "Press ENTER/A to skip" (Context-Sensitive Hints pattern)
- Partial result: final position + total time in the upper corner (if already calculated)
- If the player does not interact: 30s maximum, then automatic transition to Results

**Results Screen** (see menu.md):

- Position with count-up animation (1→2→...→final, ~200ms/digit)
- Total time in MM:SS.mmm
- Fastest lap (if applicable)
- Rival reaction text (italic, snarky/arrogant)
- Buttons: RACE AGAIN / MAIN MENU

### What the Player Hears

- **Slow-motion**: race audio slows down proportionally (pitch drop, without cutting)
- **Freeze**: abrupt silence — engine, music, everything cuts on the frozen frame
- **Drone**: results music (post-race) starts with 500ms crossfade. Player's car engine idling (loop)
- **Results**: "tick" sound at each count-up digit (if assets allow). Results music continues

### Entry Trigger

- Race Management detects **one of 3 end conditions** (ADR-0015):
  1. Player crosses the finish line on the final lap → Normal Checkered
  2. Player is last and the second-to-last car ahead has already finished → Immediate Checkered (wherever the player is)
  3. Leader has finished and the player is ≥1 lap behind → Player finishes the current lap → Checkered

- `race.checkered` emitted by the RM. HUD receives the event and stops updating position/gap (speed and gear continue).

### Exit Triggers

| Trigger | Condition | Destination |
| **Drone timeout** | 30s without input | Drone transitions to Results |
| **Skip** | CONFIRM during Drone | Drone interrupted, Results appears immediately |
| **Automatic drone skip (DNF)** | Player DNF before the checkered flag | Automatic drone skip — goes straight to Results |

### States & Variants

| State                | Trigger                                    | What Changes                                                                   |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| **Normal Checkered** | Player crosses finish line                 | Full slow-motion + freeze + drone                                              |
| **Last place**       | Second-to-last ahead finished              | Checkered wherever the player is — no slow-motion (simulation already stopped) |
| **One lap behind**   | Leader finished, player ≥1 lap behind      | Player finishes current lap → Checkered                                        |
| **DNF**              | Car stopped (fuel empty + pit unreachable) | Automatic drone skip. Goes straight to Results with DNF highlighted.           |
| **Quit from pause**  | Player chose Quit in pause                 | Does not enter PostRace — goes straight to Menu. No results.                   |

### Interaction Map

| Component           | Action  | Keyboard              | Gamepad   | Feedback              | Outcome                           |
| ------------------- | ------- | --------------------- | --------- | --------------------- | --------------------------------- |
| Drone Orbit         | Skip    | ENTER                 | A         | Instant transition    | Results Screen                    |
| Drone Orbit         | (none)  | —                     | —         | Timer 30s             | Automatic transition to Results   |
| Results: Race Again | Confirm | ENTER (default focus) | A         | Transition to PreRace | Race Again (selections preserved) |
| Results: Main Menu  | Select  | ▲▼ + ENTER            | D-pad + A | Transition to Title   | Main Menu                         |

### Events Fired

| Trigger               | Event                                    | Payload                                                        |
| --------------------- | ---------------------------------------- | -------------------------------------------------------------- |
| Race end detected     | `race.checkered`                         | `{ position: number, totalTime: number, playerCarId: string }` |
| Drone skip or timeout | —                                        | — (transition pulled by GSM to PostRace)                       |
| Transfer to Results   | `gsm.state.exited({ from: 'PostRace' })` | Previous state                                                 |
| Race Again            | —                                        | `gsm.transition('PreRace')` with updated RaceConfiguration     |

### Edge Cases

1. **DNF with empty fuel on track**: Car stops (`car.stopped`), RM detects DNF. Drone orbit of the stopped car where it is. Automatic drone skip — goes straight to Results with "DNF" highlighted on position.

2. **DNF during pit stop**: Does not occur — RM checks pit state before confirming DNF (ADR-0015). Car in pit cannot DNF.

3. **Multiple simultaneous end conditions**: RM processes in priority order (1: player finished all laps; 2: last place; 3: one lap behind). Only one `race.checkered` emitted.

4. **Slow-motion carries the car past the line**: Slow-motion lasts 0.3s at 50% speed — the car may advance a few meters past the line before the freeze. This is acceptable and desired (the car "passes" the line and decelerates naturally).

5. **Drone orbit clips through geometry**: ArcRotateCamera with variable alpha. If the orbit collides with track geometry, the camera may clip — acceptable for MVP. Post-MVP: camera adjusts alpha/beta to avoid clipping with a minimum collision radius.

6. **Race Again without loading**: Uses current RaceConfiguration + cached AssetContainers. GSM → PreRace directly. Loading screen does not appear (see Flow 1 Race Again state).

---

## Cross-Flow Concerns

### GSM State Management

- All state transitions (Loading → PreRace → Racing → PostRace) are managed by the GSM (ADR-0024)
- Transitions are deferred to the **end of the current tick** — maximum 1 transition per tick
- GSM emits `gsm.state.exited({ from, to })` + `gsm.state.entered({ from, to })` on each transition
- Reactive systems listen to GSM events, never call `gsm.getCurrent()` (Core Rule 3, ADR-0024)

### Pipeline State During Transitions

| Flow                         | Pipeline State                                       | Duration | Notes                                                               |
| ---------------------------- | ---------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| Loading → PreRace            | Pipeline **not started** (no simulation running yet) | —        | Only Loading scene rendering                                        |
| PreRace → Racing (Countdown) | Pipeline **running, cars locked**                    | 5s       | Physics, AI, Fuel, Tire execute but do not change position (locked) |
| Green Flag → Racing          | Pipeline **running, cars free**                      | —        | `physics.setLocked(carId, false)`                                   |
| Checkered (slow-motion)      | Pipeline running at **50% dt**                       | 0.3s     | `FIXED_DT / 2` for slow-motion                                      |
| Freeze                       | Pipeline **paused**                                  | 0.5s     | No slots execute                                                    |
| Drone Orbit / Results        | Pipeline **paused** (race ended)                     | —        | HUD blocks stop updating                                            |

### Tab Blur / Disconnect

- **Loading**: If the player switches tabs, loading continues in background. When they return, the grid cinematic shows what has been loaded (no wait timeout)
- **Countdown**: **Does not freeze** on tab blur — determinism requires fixed timing. When the player returns, they may be at the green flag or already racing (normal — tab blur safety zeroes inputs, simulation runs without input)
- **Checkered → PostRace**: If tab blur during drone, the 30s timer continues. Drone may be skipped automatically if the timer expires while the player is away

### HUD Visibility per Flow State

| Flow State              | Visible HUD Blocks                                             |
| ----------------------- | -------------------------------------------------------------- |
| Loading                 | None (loading screen only)                                     |
| Grid Cinematic          | None (grid scene only)                                         |
| Countdown               | Countdown Lights only                                          |
| Green Flag → Racing     | All (speed, position, lap, fuel, tire, alerts, gap, lap times) |
| Checkered (slow-motion) | All — continues updating                                       |
| Freeze                  | All — frozen on the last frame                                 |
| Drone Orbit             | Reduced: speed + position + "Press skip" hint                  |
| Results                 | HUD hidden (results screen replaces it)                        |

---

## Data Requirements

| Data                                              | Source                      | Read / Write         | Flow                     |
| ------------------------------------------------- | --------------------------- | -------------------- | ------------------------ |
| RaceConfiguration (team, track, laps, difficulty) | Menu LITE                   | Read                 | Loading → PreRace        |
| Loading screen track name                         | TrackConfig                 | Read                 | Loading                  |
| Random loading tips                               | ConfigManager (tip pool)    | Read                 | Loading                  |
| Grid positions (qualification order)              | Race Management             | Read                 | Grid Cinematic           |
| Countdown lights state                            | RM (`lightsOn`)             | Read (via Event Bus) | Countdown                |
| Player speed                                      | Physics (direct read)       | Read                 | Racing, Checkered, Drone |
| Player position + gap                             | Race Management             | Read (via Event Bus) | Racing, Checkered, Drone |
| Lap counter                                       | Race Management             | Read (via Event Bus) | Racing, Checkered        |
| Fuel / Tire condition                             | Fuel, Tire Wear             | Read (via Event Bus) | Racing                   |
| Race results (position, total time, fastest lap)  | Race Management             | Read                 | Drone, Results           |
| Rival reaction data                               | Race Management / AI Driver | Read                 | Results                  |

---

## Accessibility

Standard tier (MVP), per `design/accessibility-requirements.md`.

| Aspect                   | Compliant? | How                                                                                                                                                   |
| ------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Flashing lights**      | ✅         | Countdown 5 lights at 1s interval — no stroboscopic effect (≤3 flashes/s). Below the risk threshold.                                                  |
| **Pre-race warning**     | ✅         | Photosensitivity warning on game startup (menu.md + accessibility-requirements.md).                                                                   |
| **Slow-motion**          | ✅         | 0.3s at 50% — too short to cause motion sickness. No player input during slow-motion.                                                                 |
| **Drone orbit**          | ⚠️         | 1 revolution every 15s is smooth. If playtesting reveals discomfort, add an automatic drone skip option.                                              |
| **Countdown colors**     | ✅         | Red→green lights are redundant with position (1st, 2nd, etc.). No information depends solely on color — the number of lit lights is self-explanatory. |
| **Reduced HUD on drone** | ✅         | Less visual information reduces cognitive load. "Press skip" hint always visible.                                                                     |
| **Tab blur safety**      | ✅         | Inputs zeroed. Simulation keeps running. Player returns to a consistent state.                                                                        |

---

## Acceptance Criteria

- [ ] Loading screen appears for at least 0.5s if there is actual loading, and is skipped if loading is instant (< 0.5s)
- [ ] Grid Cinematic shows the 8 cars lined up for 8s, with skip via CONFIRM
- [ ] Countdown 5→1 turns on one green light every 1 second, with an audible beep at each light
- [ ] Green Flag unlocks the cars and the race starts immediately after the 5th light
- [ ] Checkered Flag activates slow-motion (0.3s at 50% dt) followed by freeze (0.5s) with "CHEQUERED FLAG" overlay
- [ ] Drone orbit shows the player's car at 1 rotation/15s, for a maximum of 30s or until CONFIRM skip
- [ ] Results Screen appears after drone (skip or timeout) with position count-up, total time, fastest lap, and rival reaction
- [ ] Race Again loads the same configuration without a visible Loading screen (assets cached)
- [ ] Tab blur during countdown does not interrupt the sequence — the player returns to the current race state
- [ ] DNF handled correctly: car with no fuel that cannot reach the pit → `car.stopped` → RM emits DNF → automatic drone skip → Results with DNF highlighted
- [ ] ESC/Start does not open pause during countdown (GSM still in PreRace, not Racing)
- [ ] Quit from pause does not emit race.completed — goes straight to Menu without entering PostRace

---

## Localization Considerations

| Element              | String                                      | Max Length (EN)                        | Layout Risk                                                     |
| -------------------- | ------------------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| Overlay text         | CHEQUERED FLAG                              | 14 chars                               | Medium — 40% expansion (~20 chars) may wrap at narrow viewports |
| Skip hint            | Press ENTER/A to skip                       | 21 chars (variable by device key name) | Low — bottom edge, auto-sizes                                   |
| Loading stalled text | Still loading...                            | 18 chars                               | Low                                                             |
| Error text           | Failed to load assets. Returning to menu... | 48 chars                               | Low — single line, user won't stare at it                       |
| Loading tips         | (full sentences)                            | ~60 chars                              | Medium — tip pool may need per-locale curation                  |
| DNF text             | DNF                                         | 3 chars                                | Low                                                             |

All loading tips require per-locale adaptation. Tip pool is stored in ConfigManager and can be extended per locale post-MVP. Character limits above are for English; 40% expansion budget should be maintained.

---

## Open Questions

| Question                                                                | Owner            | Deadline           | Resolution   |
| ----------------------------------------------------------------------- | ---------------- | ------------------ | ------------ |
| Does drone orbit cause discomfort over a continuous 30s? Reduce to 15s? | Playtest         | MVP playtest       | [Unresolved] |
| Should slow-motion have a longer transition (0.5s instead of 0.3s)?     | Game feel tuning | MVP playtest       | [Unresolved] |
| Should the partial result on drone include gap to the leader?           | UX               | MVP implementation | [Unresolved] |
| Does results music need variation by position (P1 vs DNF)?              | Audio design     | MVP implementation | [Unresolved] |
