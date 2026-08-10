# Overdrive

A 90's Formula 1 racing game with deterministic manual simulation. The domain is organized around two time scales (simulation tick vs render frame), an authoritative input contract, a per-car state machine, and a race session lifecycle.

## Language

### Simulation & Time

**Simulation Tick**:
The fixed unit of simulation time (60 Hz, FIXED_DT). All domain systems run in ticks, never in frames; a render frame may run zero, one, or multiple ticks.
_Avoid_: frame, update, step (in a time sense)

**Render Frame**:
The variable unit of render time (Update). Raw input is captured once per frame; the simulation advances by ticks.
_Avoid_: tick (in a time sense)

**TickStartSnapshot**:
The read-only per-tick input consumed by all domain systems, assembled from the previous tick's outputs. Carries prior domain state and cached AI input; never the frame-level raw sample.
_Avoid_: input struct, frame snapshot

**PublishedSimulationSnapshot**:
The immutable published state that presentation (Camera, VFX, Audio, HUD) reads in LateUpdate.
_Avoid_: game state, world state

**Replay**:
Deterministic reproduction of a race from a seed plus recorded input, injected directly into Vehicle Physics without the live input pipeline (no dead-zone, EMA, or live edges).
_Avoid_: ghost (ghost is the visual comparison), playback

**Seed**:
The PCG32 seed that makes a race reproducible — same seed and input yield the same result.
_Avoid_: random seed (general)

### Input

**SimulationInput**:
The authoritative gameplay-input contract produced once per simulation tick. Nothing downstream consumes raw values.
_Avoid_: input, resolved input

**Raw Input Sample**:
The frame-level raw capture (per device), the source the tick pipeline processes into SimulationInput.
_Avoid_: SimulationInput, input event

**Input Context**:
The mutually exclusive input mode (Gameplay or UI), each backed by its own action map. The InputContextController is the sole authority over which is active.
_Avoid_: state, screen, map

**Control Scheme**:
The active input device scheme (Keyboard or Gamepad).
_Avoid_: device, input method

**Pause Edge**:
The rising edge of the Pause action, consumed by the transition that triggered it; meaningful only on Gameplay→UI transitions.
_Avoid_: pause, pause event

**Control Profile**:
The player-facing tuning (dead-zone thresholds, EMA alphas, bindings), validated by Settings. The trigger dead-zone is Input-owned, never player-configurable.
_Avoid_: settings, configuration

### Vehicle

**CarState**:
The per-tick state of a car (position, rotation, speed, throttle) read by domain systems and published for presentation.
_Avoid_: car, vehicle state

**Car Definition**:
The data model for a car (stats, audio profile, physics constants) — data, not behavior.
_Avoid_: car data, car config

**Car Stats**:
The player-facing surface attributes (Top Speed, Acceleration, Brake Power, Grip, Stability, Fuel Efficiency). The player reads the car through these bars.
_Avoid_: attributes, car specs

**Grip**:
The cornering/traction multiplier. The Tire System outputs a single grip multiplier; Vehicle Physics owns the stacking formula.
_Avoid_: traction, handling

### Race

**Race Mode**:
The mode within the Racing simulation state (Racing, Qualifying, Countdown). Qualifying is a RaceMode, not a separate simulation state.
_Avoid_: state, session type

**Race Session Manager (RSM)**:
The owner of race-state tracking (laps, positions, race time, events) and result resolution.
_Avoid_: race manager, session manager

**Grid Slot**:
The assigned starting position of a car. Distinct from live position (ranked by lap + spline position).
_Avoid_: grid position, starting position (ambiguous)

**Qualifying**:
The classification session producing the starting grid, one attempt per car.
_Avoid_: classification, time trial

**Perfect Start**:
The launch mechanic evaluated at GO from throttle timing.
_Avoid_: launch, race start

**Pit Stop**:
A planned stop in the pit box, entered physically (driving into the pit zone).
_Avoid_: pit, box stop

### Content & Teams

**Track**:
A circuit defined by an authored racing spline, plus a pit spline and its mapping to the racing surface.
_Avoid_: level, circuit, course

**Team**:
One of the 16 constructors, canonically identified as `team_tierX_Y`. No official names yet; constructor names are reference only, never primary identifiers.
_Avoid_: the SMGP/F1 constructor names as primary identifiers
