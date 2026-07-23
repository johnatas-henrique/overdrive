# Simulation Architecture

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-21
> **Implements Pillar**: Speed You Can Feel

## Overview

**Simulation Architecture** is the fixed-timestep heartbeat of the game — it decouples simulation from rendering, ensuring that physics, input processing, AI decisions, fuel consumption, and tire degradation all advance at a consistent 60 Hz regardless of the display's frame rate. The system drives a manual simulation loop at 60 Hz using `Physics.Simulate()` with `SimulationMode.Script`, provides render interpolation for smooth visuals at any frame rate, and delivers a deterministic simulation clock that Ghost Recording and Coherence networking depend on. Without this system, simulation speed would vary with hardware performance, making races inconsistent across machines and breaking the determinism required for ghost replay and multiplayer synchronization.

**Interaction:** Automatic — the player never interacts with it directly. They experience it as consistent, predictable car behavior at any frame rate.

**Why it exists:** Without fixed-timestep simulation, a car at 30 FPS behaves differently than the same car at 120 FPS — turns are wider, fuel burns slower, AI reacts later. The game loses competitive integrity.

## Player Fantasy

**Framing:** Indirect — the player never thinks about timesteps, render separation, or simulation clocks. They think about the track, the car, and the rivals. This system is the invisible guarantee that makes those thoughts honest.

**Emotional target:** Trust. Not the dramatic kind — the quiet, athletic kind. The feeling of a track that doesn't lie to you. When I lose, I lost. When I win, I won. Nothing cheats for me, nothing cheats against me.

**Anchor moment:** A practice session where the player retries the same corner ten times. The tenth attempt and the first attempt give the same answer. The player builds a real mental model — and that model is rewarded. The track is steady under them, even when they're not.

**Pillar alignment:** Every Short Race Matters — each result is permanent and real because the world is honest. Speed You Can Feel — the speed is solid, not jittery.

**Design test:** Does the player ever suspect the game cheated them? If yes, this system has failed.

## Detailed Design

### Core Rules

**1. Simulation Clock**

The simulation runs on a fixed 60 Hz timestep driven by a manual accumulator in `Update()`, not Unity's built-in `FixedUpdate`. This gives the system full control over timing, input sampling, and render interpolation.

- **Fixed step duration:** `FIXED_DT = 1/60` seconds (~16.667 ms)
- **Accumulator:** Accumulates real elapsed time each frame. When it reaches `FIXED_DT`, one simulation step fires and the accumulator decrements. If it exceeds `2 × FIXED_DT` (spiral-of-death protection), it is clamped — the simulation slows down rather than consuming unbounded CPU.
- **Simulation time:** `sim_time = step_count × FIXED_DT`. Used by Ghost Recording and HUD for display.
- **Manual control:** The system calls `Physics.Simulate(FIXED_DT)` explicitly each step, with `Physics.simulationMode = SimulationMode.Script`. This decouples physics from Unity's internal clock and ensures deterministic step ordering.

**2. Render Interpolation**

Rendering happens in `Update()` at the display's native frame rate. Between the last simulation step and the current render frame, visual positions are interpolated:

- **Interpolation factor:** `α = accumulator / FIXED_DT` (range 0.0–1.0)
- **Visual position:** `Vector3.Lerp(previous_step_position, current_step_position, α)`
- **Visual rotation:** `Quaternion.Slerp(previous_step_rotation, current_step_rotation, α)`

Interpolation applies only to **visual representation** (transform, VFX, camera) — never to simulation state. Simulation state at step N is authoritative; the render interpolates between step N-1 and step N.

**Visual snappiness rule:** Interpolation is always between the two most recent completed simulation steps. The simulation never waits for rendering. The player always sees the latest possible state, preserving arcade responsiveness.

**3. Input Buffering**

Input arrives from the Input System during `Update()` (variable rate). The simulation consumes it during fixed steps (60 Hz).

- **Buffer:** The most recent input values are stored in a ring buffer of size 2.
- **Accumulation:** Each `Update()` frame reads raw input and stores it in the buffer.
- **Consumption:** Each fixed step reads the **latest** buffered input. If multiple steps fire in one `Update()` frame (at low display FPS), they all consume the same input — correct because the input hasn't changed.
- **Latency:** Worst case, input is one fixed step old (16.67 ms). At 60 Hz display, imperceptible. At 30 Hz display, maximum input-to-simulation lag is ~33 ms — within arcade tolerance.

**4. Ghost Recording Input Strategy**

Ghost Recording captures raw input at **render frame rate** (every `Update()`), not at fixed-step rate. This preserves the full resolution of the player's actual input — critical for ghost fidelity. During replay, the recorded input is fed back through the same deterministic simulation loop, reproducing identical behavior.

**5. Determinism Rules**

- **Random:** `Random.InitState(seed)` called at race start with a fixed seed per track. All gameplay randomness (AI decisions, tire wear rolls) uses a custom PRNG with known seed, not `UnityEngine.Random`.
- **Time scale:** `Time.timeScale` is never modified during gameplay. Pause is implemented by skipping simulation steps, not by setting `timeScale = 0`.
- **Math:** All simulation-path math uses `Unity.Mathematics` (`float3`, `math.*`) consistently. No mixing with `System.MathF`.
- **No simulation logic in `Update()`:** All gameplay state changes happen inside the fixed step. `Update()` only handles rendering, input accumulation, and VFX — never simulation-affecting logic.

**6. Simulation States**

| State | Description | Simulation Active | Rendering | Input Consumed |
|-------|-------------|-------------------|-----------|----------------|
| `Loading` | Track and car assets loading; simulation not started | No | No | No |
| `Countdown` | Pre-race countdown (3-2-1-GO); simulation runs, input blocked | Yes | Yes (interpolated) | No |
| `Racing` | Active race; full simulation and input | Yes | Yes (interpolated) | Yes |
| `Paused` | Player paused; simulation frozen, time stops | No | Yes (static frame) | Menu only |
| `Results` | Race finished; simulation frozen on final state | No | Yes (static frame) | Menu only |
| `Replay` | Ghost replay (Alpha+); simulation replays recorded input | Yes (replay mode) | Yes (interpolated) | No |

**Transition rules:**

| From | To | Trigger |
|------|----|---------|
| `Loading` | `Countdown` | All assets loaded, scene ready |
| `Countdown` | `Racing` | Countdown timer reaches zero ("GO") |
| `Racing` | `Paused` | Player presses Pause |
| `Paused` | `Racing` | Player resumes from pause |
| `Paused` | `Results` | Player quits mid-race (forfeit) |
| `Racing` | `Results` | Player crosses finish line on final lap, or all cars finish |
| `Results` | `Loading` | Player starts a new race |
| `Results` | `Replay` | Player watches ghost replay (Alpha+) |
| `Replay` | `Results` | Replay ends or player exits |
| Any | `Loading` | Player returns to menu (race abort) |

**State behavior details:**

- **Loading → Countdown:** Simulation clock initialized (step = 0, sim_time = 0). Car positions set to grid. No simulation steps fire until countdown begins.
- **Countdown:** Simulation steps run so cars can be visually positioned (engine idle animation, camera shake). Player input is discarded. Countdown lasts 3 seconds (180 steps).
- **Racing:** Full simulation. All systems tick. Input consumed, recorded, and forwarded. Ghost Recording captures snapshots each step.
- **Paused:** Accumulator frozen. No simulation steps. `Update()` continues to render the last frame (static). Menu input only.
- **Results:** Same as Paused but triggered by race completion. Final snapshot written to Ghost Recording. Leaderboard submission happens here.
- **Replay:** Simulation runs in replay mode. Instead of reading live input, it reads recorded input from Ghost Recording. All systems tick identically to `Racing` — only the input source differs.

### Interactions with Other Systems

| System | Direction | Data Flow | Timing | Interface Description |
|--------|-----------|-----------|--------|----------------------|
| **Input System** | Inbound | Normalized input values (accelerate, brake, steer) | Per `Update()` frame → buffered → consumed per fixed step | Input System writes to ring buffer; Simulation reads latest values on step. Digital events (Pause, Pit) fire as immediate triggers outside the fixed loop. |
| **Vehicle Physics** | Bidirectional | Input values in → car state (position, velocity, rotation) out | Per fixed step | Simulation calls Vehicle Physics with current input and FIXED_DT. Vehicle Physics writes car state back. Tight coupling — Vehicle Physics IS the core of the simulation step. |
| **Fuel System** | Bidirectional | Throttle value in → fuel state out | Per fixed step | Fuel reads the same throttle value as Vehicle Physics. Consumption applied during simulation step. State included in snapshot. |
| **Tire System** | Bidirectional | Driving inputs in → tire grip state out | Per fixed step | Tire reads steering, speed, surface contact for wear calculation. Grip modifies Vehicle Physics handling. Both read/write within same step. |
| **AI Rival** | Bidirectional | All 16 car states in → AI decisions (input values) out | Per fixed step | AI reads full simulation state (all positions, speeds, fuel, tires) and produces input values for its car. AI decisions are part of the simulation step — they affect snapshot and ghost data. |
| **Coherence Networking** | Bidirectional | Simulation state out; server state in | 60 Hz bidirectional (server + client) | **MVP/Alpha:** Simulation sends state to Coherence for async features (ghost upload, leaderboard). **Beta:** `CoherenceInputSimulation<TState>` replaces the manual accumulator loop — the base class handles frame stepping, time synchronization, input buffering, and rollback. The four overrides (`SetInputs`, `Simulate`, `CreateState`, `Rollback`) implement the same behavior as the manual loop. PhysX runs inside `Simulate()` for local collision feel, but canonical state is kinematic (position, rotation, velocity) for cross-machine determinism. See `design/gdd/multiplayer-architecture.md` for full network integration spec. |
| **Ghost Recording** | Outbound | Input + state snapshots per step | Per fixed step | Ghost Recording writes a snapshot every step during `Racing`. During `Replay`, Ghost Recording provides the input values. Snapshot format is the contract between these systems. |
| **Race Session Manager** | Bidirectional | Race state (lap, position, timer) in; race events (start, finish, pit entry) out | Per step + event triggers | Race Session Manager reads simulation time and car positions to determine lap counts, positions, and finish conditions. Fires events (lap complete, race finished, pit entry) that other systems consume. |
| **HUD** | Outbound | Simulation state for display | Per `Update()` frame | HUD reads latest simulation state and renders. Speed, fuel, tire, position, lap data read from simulation's current state (step N), not interpolated visual positions. Ensures HUD numbers always reflect authoritative simulation. |
| **Camera** | Outbound | Visual car position and rotation | Per `Update()` frame (interpolated) | Camera reads interpolated visual transform, not raw simulation state. Ensures smooth camera movement matching the visual car, not physics tick positions. |

## Formulas

### Simulation Time

`sim_time = step_count × FIXED_DT`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Step Count | step_count | uint32 | 0–∞ | Monotonic counter of simulation steps since race start |
| Fixed Delta Time | FIXED_DT | float | constant | 1/60 ≈ 0.016667 seconds |

**Output Range:** 0.0 to ∞ seconds
**Example:** After 3600 steps: sim_time = 3600 × 0.016667 = 60.0 seconds (1 minute)

### Render Interpolation Factor

`α = accumulator / FIXED_DT`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Accumulator | accumulator | float | 0.0–FIXED_DT | Remaining time before next simulation step |
| Fixed Delta Time | FIXED_DT | float | constant | 1/60 seconds |

**Output Range:** 0.0 (just stepped) to 1.0 (about to step)
**Example:** accumulator = 0.008s, FIXED_DT = 0.01667s → α = 0.48 (48% between steps)

### Spiral-of-Death Clamp

`accumulator = min(accumulator, 2 × FIXED_DT)`

If the accumulator exceeds twice the fixed step, the simulation slows down rather than consuming unbounded CPU. At display rates below ~30 FPS, the simulation reduces speed proportionally.

| Display FPS | Accumulator per frame | Steps per frame | Behavior |
|-------------|----------------------|-----------------|----------|
| 60 | ~0.0167s | 1 | Normal |
| 30 | ~0.0333s | 2 | Normal (interpolated) |
| 20 | ~0.05s | 2 (clamped from 3) | Simulation slows to ~40 Hz |
| 15 | ~0.0667s | 2 (clamped from 4) | Simulation slows to ~30 Hz |

## Edge Cases

- **If display drops below 15 FPS:** Accumulator is clamped at `2 × FIXED_DT`. Simulation slows to ~30 Hz. Visuals become choppy but gameplay remains consistent. No spiral of death.
- **If player tabs out mid-race:** `Time.deltaTime` spikes. Accumulator clamps at `2 × FIXED_DT`. On return, simulation catches up in 1-2 frames. Race state is preserved. No desync.
- **If `Physics.Simulate()` throws:** Catch and log. Freeze simulation state. Show error message. Offer retry from last checkpoint (race start for MVP).
- **If Ghost Recording data is corrupted:** Replay falls back to "no ghost available" state. Race still runs normally; ghost display is skipped.
- **If Coherence server state arrives during a simulation step:** Queue the server state. Apply at the next step boundary — never mid-step. Prevents partial state corruption.
- **If input buffer is empty at step consumption:** Use the last known input values. This can happen if `Update()` is delayed beyond `FIXED_DT`. The car coasts with last known throttle/steer for one step.
- **If simulation step takes longer than `FIXED_DT`:** The accumulator builds up. Multiple steps fire in the next `Update()` frame. If this persists, the spiral-of-death clamp engages and simulation slows.
- **If two cars collide at the exact same position:** PhysX contact resolution handles it. The simulation step produces a deterministic outcome for the same input — the collision response is part of the snapshot.
- **If race is paused during a collision:** Physics state is frozen mid-contact. On resume, the next step resolves the collision normally. No physics drift.
- **If player switches device during a race:** Input buffer is cleared and repopulated from the new device on the next `Update()` frame. One step may use stale input (16.67 ms gap). Imperceptible.

## Dependencies

| System | Direction | Type | Data Flow |
|--------|-----------|------|-----------|
| Input System | Upstream | Hard | Input → Simulation: normalized input values buffered per frame |
| Vehicle Physics | Bidirectional | Hard | Simulation → Physics: FIXED_DT + input values. Physics → Simulation: car state (position, velocity, rotation) |
| Fuel System | Bidirectional | Hard | Simulation → Fuel: throttle value per step. Fuel → Simulation: fuel state |
| Tire System | Bidirectional | Hard | Simulation → Tire: steering, speed, surface contact. Tire → Simulation: grip multiplier |
| AI Rival | Bidirectional | Hard | Simulation → AI: all 16 car states. AI → Simulation: input values for AI-controlled cars |
| Coherence Networking | Bidirectional | Hard | Simulation → Coherence: state snapshots at server tick rate. Coherence → Simulation: authoritative server state. Server tick rate (30 Hz vs 60 Hz) is a Multiplayer Architecture decision — not blocking for MVP async multiplayer. |
| Ghost Recording | Bidirectional | Hard | Simulation → Ghost: input + state snapshots per step. Ghost → Simulation: recorded input during replay |
| Race Session Manager | Bidirectional | Hard | Simulation → RSM: sim time, car positions. RSM → Simulation: race events (lap complete, finish, pit entry) |
| HUD | Downstream | Soft | Simulation → HUD: current state for display (speed, fuel, tire, position, lap) |
| Camera | Downstream | Soft | Simulation → Camera: interpolated visual transform for smooth camera movement |
| Settings | Downstream | Soft | Settings → Simulation: fixed timestep value (for debugging/tuning only — 60 Hz is the default) |

## Tuning Knobs

| Knob | Default | Range | Too Low | Too High |
|------|---------|-------|---------|----------|
| Fixed Timestep (FIXED_DT) | 0.01667s (60 Hz) | 0.00833–0.03333 (120–30 Hz) | Higher CPU cost, no perceptible gameplay benefit | Physics instability, choppy simulation |
| Spiral-of-Death Clamp | 2× FIXED_DT | 1–5× FIXED_DT | Simulation slows at even minor frame drops | Allows too many steps per frame, CPU spike risk |
| Input Buffer Size | 2 frames | 1–4 frames | Input dropped if Update is delayed | Increased input latency |
| Countdown Duration | 3.0s (180 steps) | 2.0–5.0s | Player not ready | Too slow, breaks flow |
| Render Interpolation | Always on | On/Off | Not applicable (always on for smooth visuals) | N/A |

## Visual/Audio Requirements

This system has no direct visual or audio output. It provides timing and state that other systems consume:
- **Camera** reads interpolated visual transform (produced by this system)
- **VFX** reads simulation state for directional velocity effects (produced by this system)
- **Audio** reads simulation step timing for engine RPM and speed-dependent sounds (produced by this system)

No VFX, animation, or audio assets are owned by this system.

## UI Requirements

This system has no UI. It is pure infrastructure.

The only player-facing UI interaction is the **Pause** state, which freezes the simulation. The pause menu itself is owned by the UI Menu System.

## Acceptance Criteria

### 1. Simulation Clock — Fixed Timestep

- **AC-1.1:** **Given** the game is in the Racing state and the frame rate is above 60 FPS, **When** 10 seconds of wall-clock time elapse, **Then** exactly 600 simulation steps have been executed (±0 steps).
- **AC-1.2:** **Given** the game is in the Racing state and the frame rate drops to 30 FPS, **When** 10 seconds of wall-clock time elapse, **Then** exactly 600 simulation steps have been executed (±0 steps).
- **AC-1.3:** **Given** a frame takes 18ms (at 60Hz fixed timestep of ~16.67ms), **When** the frame completes, **Then** the accumulator holds approximately 1.33ms of leftover time for the next frame.
- **AC-1.4:** **Given** the accumulator has accumulated ≥ FIXED_DT, **When** the simulation loop runs, **Then** Physics.Simulate(FIXED_DT) is called once per accumulated step, and no call to Unity's automatic Physics simulation occurs.
- **AC-1.5:** **Given** a frame takes ≥ 33.34ms (2× FIXED_DT) due to system load, **When** the simulation loop processes the frame, **Then** the accumulator is clamped to 2× FIXED_DT, and at most 2 simulation steps execute in that frame.
- **AC-1.6:** **Given** the accumulator is clamped at 2× FIXED_DT after a long frame, **When** the next frame arrives at 16.67ms, **Then** the accumulator processes 1 step normally, and no simulation time is permanently lost.

### 2. Render Interpolation

- **AC-2.1:** **Given** the accumulator holds 8ms after the latest simulation step, **When** the render pass calculates interpolation alpha, **Then** α = accumulator / FIXED_DT ≈ 0.48 (±0.02).
- **AC-2.2:** **Given** the display refresh rate is 60Hz and the simulation runs at 60Hz, **When** the player observes vehicle position across 10 consecutive frames, **Then** no visual stutter or position snapping is perceptible (position delta between frames is ≤ 1 frame of movement).
- **AC-2.3:** **Given** the display refresh rate is 30Hz and the simulation runs at 60Hz, **When** the player observes vehicle position across 10 consecutive frames, **Then** no visual stutter or position snapping is perceptible.
- **AC-2.4:** **Given** the display refresh rate is 144Hz and the simulation runs at 60Hz, **When** the player observes vehicle position across 10 consecutive frames, **Then** no visual stutter or position snapping is perceptible.
- **AC-2.5:** **Given** two simulation snapshots with positions P0, P1 and rotations R0, R1, **When** the render pass interpolates, **Then** position is computed as Lerp(P0, P1, α) and rotation as Slerp(R0, R1, α).
- **AC-2.6:** **Given** the accumulator holds a remainder after the last simulation step, **When** the render pass interpolates, **Then** α is always in the range [0, 1], and the visual never leads ahead of the simulation state.

### 3. Input Buffering

- **AC-3.1:** **Given** the player presses throttle, brake, and steering inputs across 5 consecutive frames, **When** the simulation reads the input buffer, **Then** only the most recent 2 inputs are available, and older inputs are discarded.
- **AC-3.2:** **Given** the input buffer contains 2 entries with different steering values, **When** the simulation step executes, **Then** the most recent input (index 1) is used for the simulation step.
- **AC-3.3:** **Given** the player releases all controls for 3 frames, **When** the simulation reads the input buffer, **Then** the last non-empty input state is returned (no null/default input).
- **AC-3.4:** **Given** the player is using keyboard input, **When** the player connects a gamepad and presses throttle, **Then** the input buffer accepts the gamepad input on the next frame, and keyboard input is no longer read.
- **AC-3.5:** **Given** input is sampled once per frame before simulation steps, **When** multiple simulation steps run in a single frame (accumulator ≥ 2× FIXED_DT), **Then** all simulation steps in that frame use the same input snapshot.

### 4. State Transitions

- **AC-4.1:** **Given** the game is in Loading state and all assets are loaded, **When** the loading completion callback fires, **Then** the state transitions to Countdown.
- **AC-4.2:** **Given** the game is in Countdown state and the countdown timer reaches zero, **When** the countdown completes, **Then** the state transitions to Racing.
- **AC-4.3:** **Given** the game is in Racing state, **When** the player presses the pause button, **Then** the state transitions to Paused.
- **AC-4.4:** **Given** the game is in Paused state, **When** the player resumes, **Then** the state transitions to Racing.
- **AC-4.5:** **Given** the game is in Racing state and the player crosses the finish line on the final lap, **When** the finish condition is detected, **Then** the state transitions to Results.
- **AC-4.6:** **Given** the game is in Results state, **When** the player selects "Watch Replay", **Then** the state transitions to Replay.
- **AC-4.7:** **Given** the game is in Results state, **When** the player selects "Next Race", **Then** the state transitions to Loading.
- **AC-4.8:** **Given** the game is in Loading state, **When** any event other than loading completion occurs, **Then** the state remains Loading and no simulation steps execute.
- **AC-4.9:** **Given** the game is in Paused state, **When** the player attempts to load a new race, **Then** the state remains Paused until the player resumes and completes the Results flow.
- **AC-4.10:** **Given** the game is in Loading or Countdown state, **When** the update loop runs, **Then** no simulation steps (Physics.Simulate) are executed.

### 5. Determinism

- **AC-5.1:** **Given** two simulation instances with seed = 42, identical inputs, and identical track, **When** both run for 300 frames, **Then** the vehicle positions at frame 300 differ by ≤ 0.001 units (floating-point tolerance).
- **AC-5.2:** **Given** the game initializes a race with seed = 12345, **When** the PRNG is sampled for AI behavior, **Then** the sequence of random values matches the sequence produced by `Random.InitState(12345)` in a standalone test.
- **AC-5.3:** **Given** the game sets Time.timeScale = 0 (paused) and Time.timeScale = 1 (normal), **When** the simulation loop runs, **Then** simulation step count and physics behavior are identical regardless of timeScale value.
- **AC-5.4:** **Given** any math operation in the simulation (lerp, slerp, clamp, normalize), **When** the operation executes, **Then** it uses Unity.Mathematics types (math, math.float3, quaternion) rather than UnityEngine.Vector3/Mathf.
- **AC-5.5:** **Given** two runs on the same machine with the same seed and inputs, **When** both complete a 5-lap race, **Then** final positions of all 16 cars differ by ≤ 0.001 units.

### 6. Ghost Recording

- **AC-6.1:** **Given** the game is in Racing state, **When** the ghost system is active, **Then** vehicle position and rotation are captured once per render frame (not per simulation step).
- **AC-6.2:** **Given** a completed race with ghost data recorded, **When** the ghost is played back with the same seed and inputs, **Then** the ghost vehicle position matches the live simulation vehicle position within ≤ 0.01 units at every frame.
- **AC-6.3:** **Given** a ghost recording is saved after a race, **When** the player returns to the main menu and loads the track again, **Then** the ghost data is available for playback without re-recording.

### 7. Edge Cases

- **AC-7.1:** **Given** the game is in Racing state, **When** the player tabs out (loses application focus), **Then** the simulation pauses and resumes from the exact state when focus is regained, with no simulation steps skipped or duplicated.
- **AC-7.2:** **Given** the player is using a gamepad in Racing state, **When** the gamepad is disconnected, **Then** the game falls back to keyboard input within 1 frame, and the simulation continues without interruption.
- **AC-7.3:** **Given** a ghost file with invalid header or truncated data, **When** the replay system attempts to load it, **Then** an error is logged, the ghost is discarded, and the race/replay proceeds without ghost data.
- **AC-7.4:** **Given** the game is in Paused state for 30 seconds, **When** the player resumes, **Then** the accumulator is reset to 0, the first frame processes exactly 1 simulation step, and no time is "made up" from the pause duration.
- **AC-7.5:** **Given** a 200ms frame spike (accumulator clamped to 2× FIXED_DT = ~33.34ms), **When** the simulation processes the 2 clamped steps, **Then** no object passes through a collider (tunneling) that would not be tunneled at normal step rate.

## Open Questions

- **Minimum FPS floor:** Below what FPS should the game show a warning and reduce visual quality rather than slowing the simulation? (Current behavior: simulation slows below ~30 FPS via spiral-of-death clamp. Alternative: show "Performance Warning" and reduce VFX/render quality at 30 FPS, hard floor at 15 FPS.)
- **Ghost Recording snapshot format:** Should the snapshot include all 16 car states (current design: ~2 KB/frame, ~45 MB uncompressed for 5 laps), or only the player's car + interpolated positions of others? (Trade-off: full snapshot enables rival ghost comparison; player-only reduces storage.)
- **WebGL conditional compilation:** Should we define a `UNITY_WEBGL` build path that disables optional simulation features (qualifying timing precision, complex tire wear calculations) to stay within WebGL's tighter CPU budget?
