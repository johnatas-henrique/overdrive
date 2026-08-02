# Input System

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-08-01
> **Implements Pillar**: Speed You Can Feel

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Keyboard/mouse and gamepad control, device switching, dead zones, EMA, rebinding, and `SimulationInput` generation for local races. |
| MVP architecture constraints | `SimulationInput` is the sole gameplay-input contract per simulation tick; no downstream system consumes raw device input. |
| Alpha | Recorded-input Replay state. |
| Beta | Not designed; no network-specific input behavior is active. |
| Release | Not designed. |

### Unassigned / Open Phase Decisions
- Haptics and rumble are out of MVP; no later phase is assigned.

### Review Boundary
For MVP review, Replay is compatibility context only. It blocks MVP approval only if MVP input processing breaks the `SimulationInput` contract.

## Overview

The Input System captures player actions from keyboard, mouse, and gamepad devices, converts raw hardware signals into game-level gameplay values and UI actions, and delivers them to downstream systems with minimal latency. It handles device detection, dead zone filtering, EMA smoothing, and automatic device switching — ensuring the player always has responsive, predictable control regardless of input method. Pit entry is physical through the Track pit-entry zone; no Pit gameplay action exists in MVP. Without this system, no gameplay is possible: it is the first link between the player's intent and the car's behavior on track.

## Player Fantasy

**Framing:** Pure Response — the input is invisible. The player never thinks about controls; they think about the track, the rivals, and the strategy. Every car responds with the same crispness — the difference between a Tier 4 and Tier 1 car is speed and handling, not how the steering feels under the player's hands.

**Emotional target:** Confidence. The player trusts that pressing left makes the car go left, pressing the brake slows down proportionally, and every input is exactly as responsive as they expect. No surprises, no lag, no dead zones that eat inputs. The controls disappear, and only the race remains.

**Pillar alignment:** Speed You Can Feel — input responsiveness is the foundation of speed perception. If the input feels sluggish, speed feels wrong.

**Design test:** Can the player forget they're using a controller? If they're thinking about the input instead of the race, the system has failed.

## Detailed Rules

### Core Rules

1. **Action Asset and Contexts:** Before implementation, `Assets/InputSystem_Actions.inputactions` is replaced from the Unity template with two action maps:
    - `OverdriveGameplay`: `Accelerate`, `Brake`, `Steer`, `Pause`, and `CameraToggle`.
    - `OverdriveUI`: `Navigate`, `Point`, `Click`, `Confirm`, `Cancel`, and context-gated `Pause`.
    - `InputContextController` is the sole owner of action-map and `InputSystemUIInputModule` activation. `OverdriveGameplay` is enabled only in `GameplayRacing`, `GameplayQualifying`, and `GameplayCountdown`. `OverdriveUI` is enabled in `UI`, `PitTransit`, and `PitService`. Exactly one action map is enabled at a time; no other component may enable either map directly.
    - `InputSystemUIInputModule` is enabled only for normal menu routing inside `UI`. It is disabled during Loading-blocked input, Finished Presentation, PitTransit, and PitService. Finished Presentation routes Confirm and Pause directly to UI Presentation and suppresses Cancel. PitService routes Confirm directly to Pit Stop after service eligibility; PitTransit routes no actions.
    - `Accelerate`, `Brake`, `Steer`, and `CameraToggle` are remappable in MVP. Reserved bindings cannot be replaced or removed: `Confirm` is Enter / gamepad South; `Cancel` is Escape / gamepad East; gameplay `Pause` is Escape / gamepad Start; Finished-only UI `Pause` is P / gamepad Start. Pause is not a rebinding target.
    - When enabled for normal menu UI, `InputSystemUIInputModule` references `OverdriveUI.Confirm` as Submit and `OverdriveUI.Cancel` as Cancel. Direct-routing and blocked modes keep the module disabled. No gameplay action is reused as a UI action and no binding override is copied between maps.

2. **Gameplay Actions:**
   - `Accelerate` (analog 0–1, gamepad right trigger / keyboard W or Up)
   - `Brake` (analog 0–1, gamepad left trigger / keyboard S or Down)
   - `Steer` (analog -1 to 1, gamepad left stick / keyboard A or Left = -1, D or Right = +1)
    - `Pause` (digital, keyboard Escape / gamepad Start). It is available only in gameplay contexts and requests pause.
     - `Pause` (UI-only in `SimulationState.Finished`, digital, keyboard P / gamepad Start). It toggles UI Presentation's terminal timer without reusing Escape/Cancel or changing SimulationState.
     - `CameraToggle` (digital, keyboard C / gamepad North-Y-Triangle). Its performed/rising edge is routed directly to Camera during Dynamic Update, producing one mode switch per press. Holding the control does not repeat until it is released and pressed again. It is presentation-only and is not forwarded into `SimulationInput`, the simulation tick, Replay, or Ghost Recording.
    - `Confirm` (UI-only digital, keyboard Enter / gamepad South)
    - `Cancel` (UI-only digital, keyboard Escape / gamepad East)

   **OverdriveUI defaults:**

   | Action | Keyboard | Gamepad | Mouse | Output |
   |--------|----------|---------|-------|--------|
   | `Navigate` | Arrow keys and WASD | Left stick and D-pad | — | Vector2 |
   | `Point` | — | — | Pointer position | Vector2 |
    | `Click` | — | — | Primary button | Button |
    | `Confirm` | Enter | South | — | Button |
    | `Cancel` | Escape | East | — | Button |
    | `Pause` | P | Start | — | Button (Finished-only) |

    **OverdriveGameplay defaults:**

    | Action | Keyboard | Gamepad | Mouse | Output |
    |--------|----------|---------|-------|--------|
    | `Accelerate` | W or Up | Right trigger | — | Axis 0–1 |
    | `Brake` | S or Down | Left trigger | — | Axis 0–1 |
    | `Steer` | A or Left, D or Right | Left stick | — | Axis -1–1 |
    | `Pause` | Escape | Start | — | Button (gameplay-only) |
    | `CameraToggle` | C | North / Y / Triangle | — | Button (presentation-only) |

    **Remappable binding slots:**

    | Scheme | Action / composite part | Slots |
    |--------|-------------------------|-------|
    | KeyboardMouse | Accelerate | Primary W; Secondary Up |
    | KeyboardMouse | Brake | Primary S; Secondary Down |
    | KeyboardMouse | Steer Negative / Left | Primary A; Secondary Left Arrow |
    | KeyboardMouse | Steer Positive / Right | Primary D; Secondary Right Arrow |
    | KeyboardMouse | CameraToggle | Primary C; Secondary unassigned |
    | Gamepad | Accelerate | Right Trigger |
    | Gamepad | Brake | Left Trigger |
    | Gamepad | Steer | Left Stick |
    | Gamepad | CameraToggle | North / Y / Triangle |

    Settings selects one concrete slot. Keyboard Steer rebinds the selected 1D-axis composite part by stable binding ID/index; it never rebinds the composite root. Action IDs and binding IDs become stable after the first shipped settings schema. If a saved override references an unknown ID, Input discards only that override, restores that slot's default, and reports the migration result to Settings.

3. **Keyboard/Mouse Role:** Keyboard keys map directly to raw gameplay values: W/S produce 1 or 0; A/D and Left/Right produce -1, 0, or +1. There is no keyboard-specific ramp. Mouse is UI-only in MVP: hover, primary click, pointer selection, and Settings interaction. It never produces Accelerate, Brake, or Steer. Keyboard/mouse and gamepad remain equivalent complete-control schemes because each can start, pause, configure, and complete a race. Navigate stops at the boundary of its current focus group and never wraps automatically. In UI contexts only, Pointer movement of at least 2 pixels or Click makes the pointer visible and assigns focus before activation; Navigate, Confirm, or Cancel from keyboard/gamepad hides the pointer and makes that device family the active UI scheme.

    **ActiveControlScheme arbitration:** Input owns one global `ActiveControlScheme = KeyboardMouse | Gamepad` used by gameplay capture, prompt glyphs, and pointer policy. KeyboardMouse is the startup default. The most recently processed meaningful device event wins. If both schemes produce meaningful events in the same Dynamic Update, the current scheme remains active to prevent oscillation.
    - KeyboardMouse meaningful events: any bound keyboard gameplay or UI action, Click, or pointer movement with magnitude at least 2 pixels in the update.
    - Gamepad meaningful events: South, East, West, North, Start, any D-pad direction, trigger value above the trigger threshold, or stick magnitude above the stick inner threshold.
    - Binding candidates captured during Settings Listening never change `ActiveControlScheme`; a later meaningful event after Listening ends may change it.

4. **Per-Control Dead Zone Profile:**
   - Gamepad sticks use a radial profile: magnitude ≤ 0.15 outputs 0.0, magnitude ≥ 0.95 outputs unit magnitude, and values between thresholds are normalized across the 0.15–0.95 range.
   - Gamepad triggers use an axial profile: value ≤ 0.05 outputs 0.0; values above 0.05 are normalized across the remaining range to 1.0.
    - Profiles are data-driven and applied per control class during the 60 Hz input-processing step. Players may configure stick dead-zone values; trigger threshold remains design tuning in MVP.
    - Keyboard and mouse pointer input have no dead zone.
    - Every loaded profile is validated before use: `0 ≤ stick_dead_zone_inner < stick_dead_zone_outer ≤ 1`, `0 ≤ trigger_inner < 1`, and every EMA alpha is within `[0,1]`. Invalid persisted values fall back per field to the approved default and produce one rate-limited warning per settings load, not one warning per tick.

5. **Per-Frame Capture and Per-Tick Processing:** The configured Input System update mode is `ProcessEventsInDynamicUpdate`. After platform events have been processed, the Simulation driver begins its `Update()` by invoking Input-owned `CaptureLatestRawSample()` before reading or modifying the simulation accumulator. This same-call ordering is authoritative; no dependency on relative MonoBehaviour script order is permitted.

    **RawInputSample contract:**

    | Field | Type / Range | Purpose |
    |-------|--------------|---------|
    | `captureSequence` | uint64 monotonic | Orders render-update captures for diagnostics and tests |
    | `activeScheme` | KeyboardMouse / Gamepad | Selects the controls sampled into this immutable value |
    | `accelerateRaw` | float 0.0–1.0 | Raw selected-scheme throttle before dead zone |
    | `brakeRaw` | float 0.0–1.0 | Raw selected-scheme brake before dead zone |
    | `steerRaw` | float -1.0–1.0 | Raw selected-scheme steer before dead zone |
    | `pauseRise` | bool | First pending gameplay Pause rise observed since the prior capture |
    | `inputAvailability` | Available / NoInputDevice | Whether an eligible scheme can provide gameplay input |
    | `validityFlags` | bit flags | Marks non-finite or invalid source channels before processing |

    Non-finite raw channels retain the last valid filtered output for that channel and produce a rate-limited warning. While `OverdriveGameplay` is active, only Pause rising edges enter the pending simulation flag. Repeated rises while pending are ignored; the first simulation tick in that render update consumes and clears it. CameraToggle does not enter RawInputSample or a simulation flag: its performed/rising edge routes directly to Camera in the same Dynamic Update and cannot repeat until release.

    Routing depends on the active Input Context. Normal UI routes Navigate, Point, Click, Confirm, and Cancel through `InputSystemUIInputModule`. Finished Presentation and PitService use their direct routes above; Loading and PitTransit route nothing. No gameplay edge is queued in any UI-map context. At every simulation tick, Simulation invokes the Input-owned tick processor with the latest immutable RawInputSample; Input applies validation, dead zone, EMA, and brake priority and returns SimulationInput. If one render frame contains multiple simulation ticks, every tick processes the same sample and advances EMA once; Pause is consumed only by the first. Replay bypasses live capture and the tick routine.

    **Context handoff:** On every Gameplay ↔ UI context transition, the pending `pauseEdge` is cleared. Every newly enabled digital action and UI Navigate control already actuated at the transition is latched until neutral/released, preventing Pause → Cancel, held Confirm, held Navigate, or held CameraToggle from firing in the new context. Accelerate, Brake, and Steer are continuous gameplay values and are exempt when returning from UI to gameplay: they apply immediately on Resume, and EMA initializes from their current post-dead-zone raw values.

    **Finished UI Pause:** `OverdriveUI.Pause` is routed to UI Presentation, the controller for UI Menu's Finished Presentation screen, only while `SimulationState.Finished`; it is ignored in every other UI context and is not assigned to `InputSystemUIInputModule`. UI Presentation toggles its terminal timer and never queues a gameplay edge.

    **SimulationInput contract:**

    | Field | Range / Type | Consumer purpose |
    |---|---|---|
    | `accelerateOut` | float 0.0–1.0 | Vehicle Physics throttle |
    | `brakeOut` | float 0.0–1.0 | Vehicle Physics brake |
    | `steerOut` | float -1.0–1.0 | Vehicle Physics steer |
    | `rawThrottlePostDeadZone` | float 0.0–1.0 | Grid & Start Perfect Start evaluation |
    | `rawBrakePostDeadZone` | float 0.0–1.0 | Grid & Start Perfect Start evaluation |
    | `rawSteerPostDeadZone` | float -1.0–1.0 | Diagnostics and future-compatible recording boundary |
    | `pauseEdge` | bool | One local gameplay request, consumed once |
    | `inputAvailability` | `Available` / `NoInputDevice` | HUD availability feedback |

    `SimulationInput` is the sole gameplay-input contract per tick. `rawXxxPostDeadZone` fields are sampled after their applicable dead-zone normalization but before EMA and brake-priority processing. Simulation's MVP recordable stream and Alpha Ghost's persistent continuous stream contain only `accelerateOut`, `brakeOut`, and `steerOut`; neither redefines the gameplay contract.

6. **EMA, Brake Priority, and Output Contract:**
   - `Accelerate`: α = 0.3; `Brake`: α = 0.3; `Steer`: α = 0.5.
   - EMA accepts -1.0 to 1.0 for Steer and 0.0 to 1.0 for Accelerate and Brake.
    - Input sanitization (per ADR-0005): raw channels are validated after dead-zone normalization and before EMA — NaN or Infinity replaced by 0.0f; values outside [-1.0, 1.0] clamped. Prevents erratic behavior from hardware defects or driver bugs.
    - Brake priority is explicit: `brakeOut = filteredBrake`; `accelerateOut = 0 when rawBrakePostDeadZone > 0, otherwise filteredAccelerate`.
    - While brake priority is active, Accelerate EMA state is frozen at its last pre-brake value. It does not advance toward current raw throttle and does not reset. When raw brake returns to 0, the next tick resumes the EMA recurrence from that frozen value.
    - Vehicle Physics receives `accelerateOut`, `brakeOut`, and `steerOut` once per 60 Hz tick and adds no second input ramp or smoothing layer.
    - On active scheme change, the pending `pauseEdge` is cleared and EMA previous values initialize from the newly selected scheme's current post-dead-zone values. No filtered value carries from the prior scheme.
    - On `UI → GameplayRacing`, `PitTransit → GameplayRacing`, `UI → GameplayQualifying`, or `UI → GameplayCountdown` resume without a scheme change, the pending `pauseEdge` is cleared and EMA previous values initialize from the current active scheme's post-dead-zone Accelerate, Brake, and Steer values. Newly enabled digital gameplay actions remain neutral-release latched. Countdown → Racing is the exception: EMA state continues without reset.

**Note:** All numerical values (dead-zone thresholds and EMA alphas) are starting points that require playtesting and refinement.

### Input Contexts and Transitions

| Input Context | Simulation / Session Mapping | Allowed Actions |
|-------|-------------|-----------------|
 | `GameplayRacing` | `SimulationState.Racing` + `RaceMode.Race` | Accelerate, Brake, Steer, Pause, CameraToggle |
 | `GameplayQualifying` | `SimulationState.Racing` + `RaceMode.Qualifying` | Accelerate, Brake, Steer, Pause, CameraToggle |
 | `GameplayCountdown` | `SimulationState.Countdown` + `RaceMode.Race` | Accelerate, Brake, Steer, Pause, CameraToggle |
| `UI` | `Paused`, `Finished`, `Results`, `Loading`, title, Settings, Qualifying Not Started, Finished Presentation, Qualifying Results, or Listening | Navigate, Point, Click, Confirm, Cancel; Pause only while `SimulationState.Finished` |
| `PitTransit` | `SimulationState.Racing` + Pit Stop `PitTransit` or `Exiting` | OverdriveUI enabled but all UI actions ignored; no driving actions |
| `PitService` | `SimulationState.Racing` + Pit Stop `InPitBox` | Confirm after tire swap; Cancel ignored; no driving actions |
| `Replay` | Alpha+ only | None (read-only) |

Transitions:
- `UI → UI (Loading)`: Player starts qualifying; Input remains UI-routed but blocked while `ContentLoadRequest(RaceMode.Qualifying)` is active
- `UI (Loading) → GameplayQualifying`: Simulation accepts `RaceLoadReady(RaceMode.Qualifying)` and enters Racing without Countdown
- `GameplayQualifying → UI`: Player pauses qualifying; Simulation transitions to `Paused` while `RaceMode.Qualifying` is retained
- `UI → GameplayQualifying`: Player resumes paused qualifying
- `GameplayQualifying → UI`: Qualifying flying lap completes or fails; Simulation enters `SimulationState.Finished`, Finished Presentation becomes active, and driving input is disabled
- `UI → GameplayCountdown`: Qualifying Results sends `StartRaceRequested`; Input remains in UI during Loading and changes to GameplayCountdown only after Simulation accepts `RaceLoadReady(RaceMode.Race, gridAssignment)`
- `GameplayCountdown → GameplayRacing`: GO releases grid lock; Simulation enters Racing and Input changes context on the GO tick
- `GameplayRacing → UI`: Player pauses mid-race or race finishes; Simulation selects `Paused` or `Finished` respectively
- `GameplayRacing → PitTransit`: Vehicle Physics crosses Track's pit-entry zone after physics; Pit Stop enters PitTransit and no driving input remains active
- `PitTransit → PitService`: Car reaches pit box; Confirm remains ignored until tire swap reaches 2s
- `PitService → PitTransit`: Confirm arrives after tire swap or tank reaches full; Pit Stop begins Exiting
- `PitTransit → GameplayRacing`: RSM publishes PitExit after the automated exit phase completes
- `UI → GameplayRacing`: Player resumes a paused race
- `GameplayCountdown → UI`: Player pauses the countdown
- `UI → GameplayCountdown`: Player resumes the countdown
- Any → `Replay`: Alpha+ ghost replay mode

### Interactions with Other Systems

| System | Direction | Data | Interface |
|--------|-----------|------|-----------|
| Simulation Architecture | Outbound | `SimulationInput` | Generated once per 60 Hz tick from the latest RawInputSample. |
| Vehicle Physics | Outbound via Simulation | Accelerate, Brake, Steer | Consumes the authoritative SimulationInput once per fixed tick. |
| Grid & Start | Outbound via Simulation | `SimulationInput.rawThrottlePostDeadZone`, `rawBrakePostDeadZone` | Perfect Start owns the timing window and evaluates raw values, never EMA output. |
| UI Menu | Outbound | OverdriveUI Confirm, Cancel, navigation, pointer, active control scheme | UI-only input; mouse never controls the car. |
| Camera | Outbound | `CameraToggle` performed/rising edge | Routes immediately during Dynamic Update, once per press; never enters SimulationInput or Ghost Recording. |
| Ghost Recording | Outbound via Simulation | Recordable SimulationInput boundary + tick index | Simulation captures and discards the MVP stream; Alpha Ghost persistence consumes the same continuous input Vehicle Physics received. |
| Settings | Inbound | Binding-slot overrides, stick profile, and per-channel EMA alpha | Configuration changes apply when the next SimulationInput is built. Trigger threshold remains Input-owned tuning. |
| HUD | Outbound | `SimulationInput.inputAvailability` | `NoInputDevice` persists until an available scheme is selected, then clears. HUD owns its transient presentation. |

## Formulas

### EMA Smoothing

`output = α × raw_input + (1 - α) × previous_output`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Alpha | α | float | 0.0–1.0 | Smoothing factor (0 = no response, 1 = no smoothing) |
| Post-dead-zone input | raw | float | -1.0–1.0 for Steer; 0.0–1.0 otherwise | Current input after applicable dead-zone normalization and before EMA |
| Previous Output | prev | float | -1.0–1.0 for Steer; 0.0–1.0 otherwise | Last tick's smoothed output |

**Tick domain:** The recurrence executes once per 60 Hz simulation tick.
**Output Range:** -1.0 to 1.0 for Steer; 0.0 to 1.0 for Accelerate and Brake.
**Behavior at extremes:** α=0 → output never changes; α=1 → output = raw (no smoothing)
**Example:** α=0.3, raw=1.0, prev=0.0 produces 0.3, then 0.51, 0.657, 0.7599, and 0.83193 over the first five ticks. It reaches ≥0.95 on tick 9.

### Brake Priority

`brakeOut = filteredBrake`

`accelerateOut = 0 if rawBrakePostDeadZone > 0; otherwise filteredAccelerate`

### Dead-Zone Normalization

For a gamepad stick with raw vector `v`, magnitude `m = |v|`, inner threshold `i = 0.15`, and outer threshold `o = 0.95`:

`stick_out = 0 when m ≤ i; otherwise normalize(v) × clamp((m - i) / (o - i), 0, 1)`

For a trigger with raw value `t` and inner threshold `i = 0.05`:

`trigger_out = 0 when t ≤ i; otherwise clamp((t - i) / (1 - i), 0, 1)`

## Edge Cases

- **If gamepad disconnects mid-race:** The disconnected scheme's raw values are discarded at the next capture. If KeyboardMouse is available, it becomes active; the pending `pauseEdge` clears and EMA initializes from its current post-dead-zone values. Race telemetry continues without freezing.
- **If all devices disconnect:** The next SimulationInput forces accelerate, brake, and steer to 0 and sets `inputAvailability = NoInputDevice`. The car coasts. HUD presents its transient overlay while this condition persists; availability returns only after a valid scheme is selected.
- **If player presses both accelerate and brake simultaneously:** Brake takes priority. Brake output remains filtered Brake; Accelerate output is 0 while raw Brake remains above its dead-zone threshold.
- **If player switches device during qualifying:** The next SimulationInput uses the new available scheme. Qualifying continues.
- **If EMA receives NaN or infinity internally:** Clamp to last valid output. Log warning. (Input sanitization at the raw-input stage already replaces NaN/Infinity with 0.0f before EMA — this rule covers EMA-internal NaN from extreme recurrence states.)
- **If Settings enters Listening:** `OverdriveGameplay` is disabled. `OverdriveUI.Cancel` cancels capture; `OverdriveUI.Confirm` confirms a non-binding modal choice. Captured race-action candidates return Captured, Conflict, or Rejected. Reserved Confirm, Cancel, and Pause bindings cannot be replaced or removed.
- **If a WebGL browser delays gamepad exposure until focus or user interaction:** KeyboardMouse remains active until gamepad South, East, West, North, Start, any D-pad direction, trigger input above the trigger threshold, or stick magnitude above the stick inner threshold is received.
- **If a gamepad reconnects:** KeyboardMouse remains active until that same meaningful-input threshold is met, then the active scheme changes to Gamepad and initializes EMA from the selected raw sample.
- **If desktop starts with KeyboardMouse and gamepad both available:** KeyboardMouse is initially active. Gamepad takes control only after the same meaningful-input threshold is met.
- **If KeyboardMouse input occurs while Gamepad is active:** A bound keyboard gameplay/UI action, Click, or pointer movement of at least 2 pixels changes ActiveControlScheme to KeyboardMouse. Analog gameplay EMA initializes from the selected keyboard values at the next tick.
- **If both schemes produce meaningful events in one Dynamic Update:** Keep the current ActiveControlScheme for that update. A later meaningful event may switch it.
- **If a saved binding override references an unknown action or binding ID:** Discard only that override, restore the affected slot default, preserve other valid overrides, and report the fallback to Settings.
- **If a player presses Pause repeatedly before a simulation tick:** Pause retains one pending rising edge only; no more than one request is consumed on that tick.

## Dependencies

| System | Direction | Type | Data Flow |
|--------|-----------|------|-----------|
| Simulation Architecture | Bidirectional | Hard | Simulation calls Input-owned `CaptureLatestRawSample()` before accumulator evaluation, selects the Input Context, and invokes the tick processor; Input returns authoritative SimulationInput once per fixed tick. |
| Vehicle Physics | Outbound via Simulation | Hard | SimulationInput → Vehicle Physics once per 60 Hz tick. |
| Grid & Start | Outbound via Simulation | Hard | SimulationInput.rawThrottlePostDeadZone and rawBrakePostDeadZone → Perfect Start evaluation; gameplay controls remain active during Countdown. |
| UI Menu | Outbound | Hard | OverdriveUI navigation, pointer, and active scheme → UI Menu. |
| Camera | Outbound | Hard | CameraToggle performed/rising edge → immediate presentation-only mode switch. |
| Ghost Recording | Outbound via Simulation | Architecture constraint | MVP exposes a recordable SimulationInput + tick boundary; Alpha Ghost Recording consumes it. |
| Settings | Inbound | Hard | Settings → Input: per-slot overrides for Accelerate, Brake, Steer Left/Right or analog Steer, and CameraToggle plus stick profile and per-channel EMA alpha. Trigger threshold and reserved Confirm, Cancel, and Pause bindings are not overridden. |
| HUD | Outbound | Soft | Input availability → HUD transient overlay only. |
| Pit Stop | Inbound | Hard | Direct Confirm action in PitService → Pit Stop (after tire-swap eligibility) |
| Qualifying | Inbound | Hard | GameplayQualifying context → qualifying controls |

## Tuning Knobs

| Knob | Default | Range | Too Low | Too High |
|------|---------|-------|---------|----------|
| EMA Alpha (Accelerate) | 0.3 | 0.1–0.8 | Sluggish throttle response | Twitchy, no smoothing |
| EMA Alpha (Brake) | 0.3 | 0.1–0.8 | Sluggish brake response | Twitchy, no smoothing |
| EMA Alpha (Steer) | 0.5 | 0.2–0.8 | Over-smoothed, unresponsive | Twitchy steering, amplifies stick noise |
| Dead Zone Inner (Stick) | 0.15 | 0.05–0.25 | Drift from stick noise | Misses small inputs |
| Dead Zone Outer (Stick) | 0.95 | 0.85–1.0 | Loses range at edges | Can't reach full output |
| Dead Zone Inner (Trigger) | 0.05 | 0.0–0.10 | False triggers | Misses light presses |

## Visual/Audio Requirements

Input owns no race VFX or audio. UI Menu and Settings own prompt glyphs and rebinding feedback; Camera owns CameraToggle presentation; HUD owns the NoInputDevice overlay. Any optional input confirmation audio is specified by the relevant UI UX document, not by gameplay input.

## UI Requirements

Settings displays the stable binding slots and Input-provided display strings. UI Menu consumes ActiveControlScheme for prompt glyphs and pointer visibility. Finished Presentation and PitService use direct action routing and must not invoke generic UI Submit/Cancel handlers.

## Acceptance Criteria

1. **GIVEN** keyboard W/Up is held from rest, **WHEN** the first simulation tick processes input, **THEN** Accelerate output is 0.3 and no keyboard-only ramp is applied.
2. **GIVEN** keyboard A/Left is held from rest, **WHEN** the first simulation tick processes input, **THEN** Steer output is -0.5 and no keyboard-only ramp is applied.
3. **GIVEN** Steer raw input is -1.0 and α=0.5, **WHEN** one simulation tick processes it from rest, **THEN** Steer output is -0.5.
4. **GIVEN** a gamepad stick remains inside its radial inner threshold, **WHEN** a simulation tick processes it, **THEN** Steer output is exactly 0.0.
5. **GIVEN** raw Accelerate and raw Brake are both 1.0 from rest with Brake α = 0.3, **WHEN** the tick processes them, **THEN** Accelerate output is exactly 0.0 and Brake output equals its EMA-filtered value of 0.3.
6. **GIVEN** Accelerate alpha is 0.3 and raw Accelerate is 1.0 for nine consecutive simulation ticks, **WHEN** tick nine completes, **THEN** Accelerate output is ≥0.95.
7. **GIVEN** identical raw input sequences at 30 FPS and 144 FPS, **WHEN** each sequence advances through the same 60 simulation ticks, **THEN** both runs produce identical SimulationInput values per tick.
8. **GIVEN** InputSystem reports a gamepad disconnect while KeyboardMouse is available, **WHEN** the next SimulationInput is generated, **THEN** it uses KeyboardMouse and race telemetry remains active.
9. **GIVEN** no input scheme is available, **WHEN** the next SimulationInput is generated, **THEN** Accelerate, Brake, and Steer are all 0.0 and `inputAvailability` equals `NoInputDevice` until a valid scheme is selected.
10. **GIVEN** Settings enters Listening, **WHEN** a remappable race-action candidate arrives, **THEN** Settings receives Captured, Conflict, or Rejected and no gameplay edge is queued.
11. **GIVEN** Settings changes a control profile while simulation is paused, **WHEN** SettingsInputPreviewEvaluator renders its response, **THEN** it uses the working profile; the first 60 Hz tick after resume uses that same profile.
12. **GIVEN** UI is active, **WHEN** Enter or gamepad South is pressed, **THEN** UI Submit fires and no gameplay edge is queued.
13. **GIVEN** UI is active, **WHEN** Escape or gamepad East is pressed, **THEN** UI Cancel fires and no gameplay edge is queued.
14. **GIVEN** Countdown is active, **WHEN** the player provides Accelerate, Brake, or Steer input, **THEN** SimulationInput processes those values and Vehicle Physics keeps the car stationary under grid lock.
15. **GIVEN** Countdown is active, **WHEN** Pause rises, **THEN** Simulation transitions to Paused while Input enters UI context; Settings may open through that pause menu with Difficulty disabled and all other MVP categories available; resuming returns both to Countdown from the frozen remaining countdown tick value.
16. **GIVEN** Countdown is active, **WHEN** the player provides any driving input, **THEN** grid lock keeps the car at its grid pose and no pit-lane entry can occur before GO.
17. **GIVEN** Countdown is running and not paused, **WHEN** Settings is requested, **THEN** Settings does not open; it becomes available only after Pause transitions Countdown into UI context.
18. **GIVEN** Countdown is active and Accelerate, Brake, or Steer is held, **WHEN** GO releases grid lock, **THEN** the first Racing tick consumes the existing EMA state without reset; Brake priority remains active.
19. **GIVEN** `rawThrottlePostDeadZone > 0.5` and `rawBrakePostDeadZone == 0` occur on at least one tick from GO-12 through GO-1 and still hold on the GO tick, **WHEN** Grid & Start evaluates Perfect Start, **THEN** the result is independent of EMA output.
20. **Alpha scope. GIVEN** Replay is active with recorded Steer = 0.6 for a tick, **WHEN** the tick executes, **THEN** Vehicle Physics receives Steer = 0.6 without dead-zone or EMA processing.
21. **GIVEN** WebGL has not exposed a gamepad, **WHEN** the game starts, **THEN** KeyboardMouse remains active and gameplay input is functional.
22. **GIVEN** raw input is NaN or infinity, **WHEN** the tick processor executes, **THEN** the last valid output is retained and a warning is logged.
23. **GIVEN** a gamepad reconnects while KeyboardMouse is active, **WHEN** South, East, West, North, Start, or any D-pad direction is pressed, trigger input exceeds its threshold, or stick magnitude exceeds its inner threshold, **THEN** the active scheme changes to Gamepad and EMA initializes from the new post-dead-zone sample.
24. **GIVEN** trigger raw input is 0.05 or below, **WHEN** a tick processes it, **THEN** its normalized output is exactly 0.0.
25. **GIVEN** stick raw magnitude is 0.95 or above, **WHEN** a tick processes it, **THEN** its normalized magnitude is exactly 1.0.
26. **GIVEN** mouse movement or mouse click occurs during Racing, **WHEN** a tick processes input, **THEN** Accelerate, Brake, Steer, and Pause are unchanged by mouse input.
27. **GIVEN** EMA alpha is 0.0, **WHEN** raw input changes, **THEN** output retains its previous value; GIVEN alpha is 1.0, output equals raw input exactly.
28. **GIVEN** Pause rises during Racing, **WHEN** the next tick begins, **THEN** its edge is consumed exactly once.
29. **GIVEN** a remap candidate conflicts with a reserved Confirm, Cancel, or Pause binding, **WHEN** capture validation runs, **THEN** the candidate is rejected immediately.
30. **GIVEN** the Input System configuration loads, **WHEN** its update mode is read, **THEN** it equals `ProcessEventsInDynamicUpdate`.
31. **GIVEN** raw Brake after dead-zone equals 0.0, **WHEN** Accelerate is processed, **THEN** Accelerate output equals filtered Accelerate.
32. **GIVEN** stick magnitude is 0.55 with inner threshold 0.15 and outer threshold 0.95, **WHEN** a tick processes it, **THEN** its normalized magnitude is exactly 0.5.
33. **GIVEN** trigger raw input is 0.525 with inner threshold 0.05, **WHEN** a tick processes it, **THEN** its normalized output is exactly 0.5.
34. **GIVEN** one render update produces two simulation ticks from the same raw Accelerate value of 1.0 at rest, **WHEN** both ticks execute, **THEN** their outputs are 0.3 then 0.51 and any pending Pause edge is consumed only by the first tick.
35. **GIVEN** UI is active, **WHEN** Accelerate, Brake, or Steer is pressed, **THEN** no gameplay value or gameplay edge is emitted.
36. **GIVEN** UI is active and pointer movement assigns pointer focus, **WHEN** Navigate, Confirm, or Cancel arrives from keyboard or gamepad, **THEN** the pointer hides and that device family becomes the active UI scheme.
37. **GIVEN** RaceMode is Qualifying and the player presses Pause, **WHEN** Simulation enters Paused, **THEN** resuming restores GameplayQualifying.
38. **GIVEN** Accelerate has reached steady-state output and raw Brake rises above its dead-zone threshold, **WHEN** the next tick processes input, **THEN** Accelerate output immediately becomes 0.0 while Brake output follows its EMA filter.
39. **GIVEN** GameplayQualifying is active and the active gamepad disconnects while KeyboardMouse is available, **WHEN** the next SimulationInput is generated, **THEN** KeyboardMouse becomes active and EMA initializes from its raw sample.
40. **GIVEN** a Pause edge is pending when the active scheme changes, **WHEN** the next SimulationInput is generated, **THEN** the pending edge flag is false.
41. **GIVEN** Racing, Qualifying, or Countdown resumes from UI without an active-scheme change while Accelerate, Brake, or Steer is held, **WHEN** the first gameplay tick executes, **THEN** EMA previous values equal the current post-dead-zone analog values, those controls apply immediately, newly enabled digital actions remain neutral-release latched, and the pending `pauseEdge` flag is false.
42. **GIVEN** Brake priority is active while raw Accelerate remains non-zero, **WHEN** raw Brake returns to 0, **THEN** Accelerate EMA resumes from its frozen pre-brake value rather than from 0 or from a value accumulated during braking.
43. **GIVEN** desktop starts with KeyboardMouse and a connected gamepad, **WHEN** no meaningful gamepad input has occurred, **THEN** KeyboardMouse is the active scheme.
44. **GIVEN** Escape opens the pause menu from GameplayRacing, **WHEN** UI context becomes active while Escape remains held, **THEN** no UI Cancel fires until Escape is released and pressed again.
45. **GIVEN** an MVP Input Context is active, **WHEN** enabled action maps are inspected, **THEN** exactly one of `OverdriveGameplay` or `OverdriveUI` is enabled.
46. **GIVEN** Settings displays Confirm, Cancel, or Pause, **WHEN** the player attempts to select one as a rebinding target or remove its binding, **THEN** Listening does not begin and the fixed reserved binding remains.
47. **GIVEN** Navigate reaches a UI focus-group boundary, **WHEN** the player continues navigating outward, **THEN** focus remains on the boundary element and never wraps.
48. **GIVEN** UI is active and the pointer is hidden, **WHEN** pointer delta is at least 2 pixels or the player clicks, **THEN** the pointer becomes visible and KeyboardMouse becomes the active UI scheme; subsequent keyboard/gamepad Navigate, Confirm, or Cancel hides it and selects that device family.
49. **GIVEN** gamepad UI is active, **WHEN** Submit or Cancel is triggered, **THEN** South triggers Submit and East triggers Cancel; GIVEN gameplay is active, Start triggers Pause.
50. **GIVEN** Settings applies a stick dead-zone or EMA alpha change, **WHEN** the next 60 Hz tick builds SimulationInput, **THEN** that tick uses the working values previewed by SettingsInputPreviewEvaluator while the trigger threshold remains the Input-owned tuning value.
51. **GIVEN** keyboard gameplay input or mouse pointer input is processed, **WHEN** the dead-zone stage runs, **THEN** it leaves that channel's raw value unchanged.
52. **GIVEN** PitService is active before tire swap completes, **WHEN** Enter or South is pressed, **THEN** no exit occurs; **GIVEN** tire swap has completed, **WHEN** Enter or South is pressed, **THEN** Vehicle Physics begins pit exit with the current fuel level.
53. **GIVEN** a digital action or UI Navigate control is held during a Gameplay ↔ UI context transition, **WHEN** the new context is active, **THEN** that control is ignored until neutral/released and any gameplay edge from the old context is false; continuous Accelerate, Brake, and Steer follow AC-41 on Resume.
54. **GIVEN** Qualifying Finished Presentation is active, **WHEN** Enter or South is pressed, **THEN** UI Presentation dismisses it and opens Qualifying Results; Escape or East is ignored and all driving input remains disabled.
55. **GIVEN** WebGL exposes a gamepad after focus or user interaction while KeyboardMouse is active, **WHEN** the gamepad has not met the meaningful-input threshold, **THEN** KeyboardMouse remains the active scheme.
56. **GIVEN** Qualifying Results confirms Start Race, **WHEN** `StartRaceRequested` is accepted, **THEN** Input remains in UI throughout Loading and transitions to GameplayCountdown only after Simulation accepts `RaceLoadReady(RaceMode.Race, gridAssignment)`.
57. **GIVEN** SimulationState is Finished, **WHEN** P or gamepad Start is pressed, **THEN** UI Presentation toggles terminal presentation pause while SimulationState remains Finished; Escape/East remains suppressed and no generic UI Cancel is dispatched.
58. **GIVEN** GameplayRacing, GameplayQualifying, or GameplayCountdown is active, **WHEN** C or gamepad North/Y/Triangle produces a CameraToggle rising edge, **THEN** Camera begins one mode transition in the same Dynamic Update; holding the control produces no additional transition until release, and no CameraToggle value enters SimulationInput or Ghost Recording.
59. **GIVEN** a render Update begins after Input System Dynamic Update, **WHEN** Simulation evaluates its accumulator, **THEN** it first calls Input-owned `CaptureLatestRawSample()` and receives exactly one immutable RawInputSample with a monotonic captureSequence.
60. **GIVEN** Gamepad is active, **WHEN** a bound keyboard gameplay key is pressed, Click occurs, or pointer delta is at least 2 pixels, **THEN** ActiveControlScheme changes to KeyboardMouse before the RawInputSample for that Dynamic Update is captured.
61. **GIVEN** KeyboardMouse is active, **WHEN** any D-pad direction is pressed, **THEN** ActiveControlScheme changes to Gamepad and prompt glyphs update.
62. **GIVEN** both schemes produce meaningful events in the same Dynamic Update, **WHEN** arbitration runs, **THEN** the current ActiveControlScheme remains unchanged for that update.
63. **GIVEN** Finished Presentation is active, **WHEN** Escape/East is pressed, **THEN** InputSystemUIInputModule is disabled for that routing mode, no Cancel handler executes, and the presentation remains active.
64. **GIVEN** PitService is active after tire swap completion, **WHEN** Enter/South is pressed, **THEN** Confirm routes directly to Pit Stop exactly once and no generic UI Submit handler executes.
65. **GIVEN** PitTransit or Loading-blocked input is active, **WHEN** any UI action occurs, **THEN** InputSystemUIInputModule is disabled and no navigation, Submit, Cancel, or gameplay event is emitted.
66. **GIVEN** Settings selects KeyboardMouse Steer Left Secondary for rebinding, **WHEN** a valid candidate completes, **THEN** only that composite-part binding ID is overridden and Steer Right plus all other slots remain unchanged.
67. **GIVEN** a saved override references an unknown stable binding ID, **WHEN** overrides load, **THEN** only that slot returns to its default and all other valid overrides remain active.
68. **GIVEN** a loaded control profile has `stick_inner >= stick_outer`, non-finite thresholds, or alpha outside `[0,1]`, **WHEN** validation runs, **THEN** each invalid field returns to its approved default before any tick processing and one rate-limited warning is emitted.
69. **GIVEN** the project input asset is prepared for implementation, **WHEN** its maps and actions are inspected, **THEN** it contains `OverdriveGameplay` and `OverdriveUI` with the actions defined in Core Rule 1 and no template Player gameplay actions remain enabled.
70. **GIVEN** the player starts Qualifying, **WHEN** Content loading is active, **THEN** Input remains in blocked UI routing until Simulation accepts `RaceLoadReady(RaceMode.Qualifying)`, after which GameplayQualifying becomes the sole active gameplay context without a Countdown transition.
