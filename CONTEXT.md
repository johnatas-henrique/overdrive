# Overdrive

A 90's Formula 1 racing game with deterministic manual simulation. The domain is organized around two time scales (simulation tick vs render frame), an authoritative session lifecycle (Idle → Loading → Countdown → Racing → Paused → Finished → Results), deterministic replay and ghost recording, an authoritative input contract, a per-car state machine, and a race session lifecycle.

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

**Accumulator**:
The driver-owned buffer of render-frame time awaiting simulation ticks. Each Update adds the frame delta and consumes whole FIXED_DT ticks, clamped to a maximum of two ticks per frame — time above the clamp is permanently discarded, never caught up later.
_Avoid_: frame buffer, delta accumulator

**Spine**:
The fixed 14-step invocation order that executes one simulation tick. Each step is an injectable seam (`ISimulationPipelineStep`); the Kernel enforces exactly 14 steps at construction.
_Avoid_: pipeline, step chain

**Pipeline Step**:
One slot in the Spine, identified by a canonical index (Countdown 3, Physics 6, GO 7, Readout 8, RSM 9-10, Publish 11, AI 12). Extensible slots run a no-op by default.
_Avoid_: system, handler

**PostFinishSnapshot**:
The terminal snapshot published when a race resolves — frozen car/fuel/tire arrays plus RSM state and classification, consumed by the finish presentation.
_Avoid_: result snapshot, final state

**Performance Signal**:
The producer-only notification that display FPS fell below the reduction threshold (30) or recovered, and that a performance pause was requested (below 15 for 3s). The Kernel emits it; consumers (HUD, VFX) only listen.
_Avoid_: fps event, performance warning

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

**AIInput**:
The cached rival input fed to the tick pipeline independently of the live capture path. It is cleared outside Countdown/Racing — a resolved race never produces rival input.
_Avoid_: ai input, rival input

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

**Grid Assignment**:
The immutable handoff of where every car starts. A Race carries the full grid-slot sequence; Qualifying carries only the pit-box slot — Qualifying has no starting grid because the car leaves from the pit box on its out-lap.
_Avoid_: grid, lineup, starting grid

**Pit Box**:
The designated pit stall a car occupies during pit work and where a Qualifying car spawns for its out-lap. Distinct from a Grid Slot: the pit box is not a starting position.
_Avoid_: pit, box, pit lane (pit lane is the road)

**Countdown**:
The pre-race phase of exactly 300 simulation ticks before GO. Each unpaused tick decrements once; it is the only authority that schedules GO. Fuel and Tire are not consumed during Countdown.
_Avoid_: lights sequence, countdown timer (the display)

**GO**:
The tick that decrements the countdown from 1 to 0. It restores the car to its grid pose, clears velocity, releases grid lock only after that tick's physics, and starts Racing with a fresh accumulator.
_Avoid_: start, launch (launch is the Perfect Start mechanic)

**Grid Lock**:
The state where a car during Countdown is held at its grid pose with zero velocity while wheel/engine visuals still animate. Released at GO, after physics.
_Avoid_: launch hold, grid hold

**Retry**:
The recovery from a failed physics tick. A Race retries by restarting the countdown (Countdown failure) or reloading the race (Racing failure); Qualifying has exactly one attempt and no retry.
_Avoid_: restart, redo

**Qualifying**:
The classification session producing the starting grid, one attempt per car.
_Avoid_: classification, time trial

**Perfect Start**:
The launch mechanic evaluated at GO from throttle timing.
_Avoid_: launch, race start

**Pit Stop**:
A planned stop in the pit box, entered physically (driving into the pit zone).
_Avoid_: pit, box stop

### Race Lifecycle

**SimulationState**:
The authoritative session lifecycle: Idle → Loading → Countdown → Racing → Paused → Finished → Results. All domain mutation flows through the state machine; nothing writes simulation state directly.
_Avoid_: phase, stage, game state

**Pause**:
The interruption that suspends ticking (Countdown or Racing origin). Entering Paused freezes the accumulator; resume returns to the recorded origin state with no caught-up time.
_Avoid_: pause state (redundant), freeze

**ResumeState**:
The state recorded at pause entry, returned to on resume. Distinct from the current state — a pause in Racing resumes to Racing, not Countdown.
_Avoid_: resume target, return state

**Forfeit**:
The explicit abandonment of a race, the only path to Results without a Finish. A forfeit race is classified separately from a finished one.
_Avoid_: retire, quit, abandon

**Finish**:
The moment the RSM resolves the race — the terminal evaluation that freezes car/fuel/tire state and publishes the finish snapshot. The following state is Finished, then Results after UI dismissal.
_Avoid_: race over, end

**Results**:
The post-race state where the resolved order is presented and the player chooses next action (re-race, unload). Reaching Results discards the ghost buffer.
_Avoid_: result screen, post-race

**Content Load**:
The transition into a session — the state machine requests the track/car content, and the race begins only after loading completes (Loading → Countdown).
_Avoid_: loading, content load

**Content Unload**:
The handshake that tears down a session after Results — requested on dismissal, and the state returns to Idle only when the content confirms unload completion.
_Avoid_: teardown, cleanup

**Lifecycle Error**:
A content-load failure that aborts the session (missing track, catalog, or shared content). The state machine raises it; the composition root decides the recovery (back to Idle or retry).
_Avoid_: error, exception (in a domain sense)

### Determinism & Ghost

**Ghost Record**:
The recorded per-tick input stream (accelerate/brake/steer + tick index) used for the visual ghost comparison. Distinct from Replay: a ghost replays the recording of one run beside a live run.
_Avoid_: ghost data, recording

**EdgeEvent**:
A parallel lifecycle marker (Pause) recorded alongside the continuous ghost stream, carrying the tick index at which the boundary occurred.
_Avoid_: edge, marker, event flag

**ReplayInitialState**:
The immutable capture at GO of everything a replay needs — seed, grid, car/resource initial state, Perfect Start counter, difficulty — frozen before the first Racing tick. A replay is valid only when its seed and initial state match.
_Avoid_: replay state, initial state (ambiguous)

**DifficultyProfile**:
The player-facing difficulty settings captured into ReplayInitialState and consumed by the AI rival. Delivered by the Settings epic; the Kernel captures it as an opaque value.
_Avoid_: difficulty, level (ambiguous)

### Content & Teams

**Track**:
A circuit defined by an authored racing spline, plus a pit spline and its mapping to the racing surface.
_Avoid_: level, circuit, course

**Team**:
One of the 16 constructors, canonically identified as `team_tierX_Y`. No official names yet; constructor names are reference only, never primary identifiers.
_Avoid_: the SMGP/F1 constructor names as primary identifiers
