# Simulation Architecture

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Speed You Can Feel

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Manual 60 Hz local simulation, script-controlled physics, render interpolation, local race states, grid-lock countdown, and an in-memory recordable input stream that is always discarded. |
| MVP architecture constraints | Simulation is separated from rendering; input and race state cross explicit tick boundaries; pause never relies on `Time.timeScale`. |
| Alpha | Local replay, ghost persistence, and sharing consume recorded `SimulationInput`; no network authority. |
| Beta | A future network simulation driver may replace the local driver without changing gameplay-system contracts. |
| Release | Not designed. |

### Unassigned / Open Phase Decisions
- The concrete networking SDK/API and rollback policy are Beta design decisions, not MVP requirements.

### Review Boundary
For MVP review, Alpha/Beta drivers are non-blocking context. They block MVP approval only if an MVP rule removes the explicit local simulation boundaries above.

## Overview

**Simulation Architecture** is the fixed-timestep heartbeat of the local MVP — it decouples simulation from rendering, ensures a stable 60 Hz tick boundary for physics, input, AI, fuel and tires, and owns the authoritative local `SimulationState`. It drives one whole-scene `Physics.Simulate()` call per tick with `SimulationMode.Script`, publishes immutable tick snapshots for consumers, and provides manual visual interpolation. PhysX repeatability is only required for the same executable running on the same physical machine and environment; MVP makes no cross-machine or cross-platform determinism claim.

**Interaction:** Automatic — the player never interacts with it directly. They experience it as consistent, predictable car behavior at any frame rate.

**Why it exists:** Without explicit tick boundaries, systems would observe each other mid-update, rendering would leak into gameplay, and the same local run would become difficult to reproduce and test. The architecture protects local consistency; it does not claim that separate PhysX clients can agree on a canonical multiplayer state.

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

- **Fixed step duration:** `FIXED_DT = 1/60` seconds (~16.667 ms). `Time.fixedDeltaTime` is configured to the same value for Unity-facing configuration, but simulation-path systems receive `FIXED_DT` explicitly and do not use `Time.deltaTime`, `Time.fixedDeltaTime`, or `Time.inFixedTimeStep` to decide gameplay timing.
- **Accumulator and focus lifecycle boundary:** Before reading `Time.unscaledDeltaTime`, consume focus-loss/focus-return notifications. The frame in which focus changes adds no delta. If focus is lost while Countdown or Racing is active, Simulation immediately executes a non-physics lifecycle boundary before accumulator evaluation: record the active source state as `resumeState`, transition to Paused, preserve the existing sub-tick remainder, and publish one Paused lifecycle snapshot without incrementing counters, updating domain systems, or calling `Physics.Simulate`. Focus return never auto-resumes. While Simulation is active on ordinary focused frames, accumulate `Time.unscaledDeltaTime`, clamp to `2 × FIXED_DT`, and permanently discard time above the clamp. When Paused, do not add elapsed time and preserve the existing sub-tick remainder for Resume.
- **Counters:** `simulationStepCount` increments for every completed physics tick, including Countdown. `activeRaceStepCount` increments after every physics tick that **started** in `Racing`, including the tick that detects player finish; it drives `sim_time = activeRaceStepCount × FIXED_DT`. The tick that decrements `countdownRemainingTicks` from 1 to 0 is the 300th and final Countdown tick: it increments `simulationStepCount`, publishes the first Racing snapshot with `activeRaceStepCount = 0` and `sim_time = 0.0`, and does not increment `activeRaceStepCount`. The next tick begins in Racing. Countdown uses `countdownRemainingTicks`, not race time.
- **Manual control:** The system calls `Physics.Simulate(FIXED_DT)` exactly once per simulation tick, with `Physics.simulationMode = SimulationMode.Script`. Automatic physics simulation is prohibited.
- **Performance gate:** Before content expansion, the representative 16-car prototype with AI, Fuel, Tire, RSM and the MVP in-memory recordable-input capture must be profiled for at least 60 seconds on at least three candidate PC machines. A tick measurement covers all fixed-tick work from Steps 1–13, including input resolution, domain updates, `Physics.Simulate`, CarState readout, RSM, snapshots and conditionally executed next-tick AI; it excludes rendering, UI and presentation-only Update work. The lowest-cost machine that empirically achieves p95 ≤ 6 ms per tick and maximum observed tick ≤ 8 ms becomes the MVP performance baseline and is recorded in a follow-up ADR. Simplified colliders and layer-based collision filtering are mandatory inputs to that prototype. `docs/research/mvp-performance-baseline-2026-07.md` records why a desk-research hardware choice is not evidence for this gate.
- **Performance protection:** Measure display FPS from `Time.unscaledDeltaTime` only while `SimulationState` is Countdown or Racing. `PerformanceReducedSeverity` has one MVP value, `Reduced`; `PerformanceReduced { severity: Reduced, observedFps }` is emitted below 30 FPS for 3 continuous seconds, reduces optional VFX/render quality, and shows a non-blocking HUD warning. The below-15 timer starts at 0 when PerformanceReduced emits; while reduced, any frame at or above 15 FPS resets that timer. If FPS remains below 15 for another continuous 3 seconds, request Paused with reason `Performance`; show Resume and Return to Menu. Resume clears both sustained-FPS timers and the reduced state only if FPS is at or above 30. If FPS remains below 30, the current timers and reduced state persist so protection can re-trigger. `performanceRecoveryTimer` starts at 0 when recovery begins; while reduced, 3 continuous seconds at or above 30 FPS restore VFX/render quality, clear the warning, and reset both sustained-FPS timers; any frame below 30 resets `performanceRecoveryTimer`. If FPS subsequently falls below 30 after recovery clears, the below-30 timer restarts at 0 and protection re-arms. Idle, Finished, Results, or Loading always reset both sustained-FPS timers, `performanceRecoveryTimer`, and the reduced state. This may pause the session for player protection, but never changes `FIXED_DT`, `Time.timeScale`, or gameplay formulas.

**2. Render Interpolation**

Rendering happens in `Update()` at the display's native frame rate. Between the last simulation step and the current render frame, visual positions are interpolated:

- **Interpolation factor:** `α = accumulator / FIXED_DT` (range [0.0, 1.0))
- **Visual position:** `Vector3.Lerp(previous_step_position, current_step_position, α)`
- **Visual rotation:** `Quaternion.Slerp(previous_step_rotation, current_step_rotation, α)`

Interpolation applies only to a separate **visual hierarchy** (visual transforms, VFX, camera) — never to an authoritative Rigidbody Transform or simulation state. Simulation state at step N is authoritative; the render interpolates between step N-1 and step N. All participating Rigidbodies use `Rigidbody.interpolation = None`; Unity interpolation and `PhysicsScene.InterpolateBodies()` are not used. The visual pass runs in `LateUpdate()` after the tick loop, and after every completed physics step the previous/current visual buffers advance so a multi-step frame still interpolates only its final two completed states.

**Visual snappiness rule:** Interpolation is always between the two most recent completed simulation steps. A step is completed only after `Physics.Simulate(FIXED_DT)` returns and the ascending-`carId` CarState readout has captured every Rigidbody. The simulation never waits for rendering. The player always sees the latest possible state, preserving arcade responsiveness.

**3. Input Sampling and Tick Processing**

Input System processes platform events in Dynamic Update and owns `InputContextController`, active-scheme arbitration, raw capture, dead zones, EMA, and SimulationInput construction. At the beginning of the Simulation driver's `Update()`, before reading or modifying the accumulator, Simulation calls Input-owned `CaptureLatestRawSample()` exactly once and receives the immutable `RawInputSample` for that render update. While the gameplay map is active, Input queues a rising edge only for Pause. CameraToggle remains a direct presentation event. Confirm and Cancel use Input's context-specific UI routing and never enter a fixed tick.

At each fixed simulation tick, Simulation Architecture performs this exact order:
1. Build immutable `TickStartSnapshot` from the prior `PublishedSimulationSnapshot` plus cached `AIInput` prepared by Step 13 of the prior tick.
2. Invoke Input System's tick processor with the latest immutable `RawInputSample` and combine player `SimulationInput` with cached `AIInput` into ascending-`carId` `ResolvedCarInput[]`.
3. Consume the gameplay `pauseEdge` and `pendingPerformancePause` exactly once. `PerformanceMonitor` runs in Update(), sets `pendingPerformancePause = true` when the below-15 threshold is reached, and does not mutate SimulationState. Step 3 clears that flag when consumed. Before clearing a consumed gameplay `pauseEdge` on a tick that started in Racing, append standalone `EdgeEvent(simulationStepCount, Pause)` to the MVP in-memory recordable-input buffer. That lifecycle boundary has no continuous sample for the same step because steps 4–13 do not execute; replay processes the event before it consumes the next available continuous record. Countdown Pause is not recorded because the race stream has not started. When Countdown or Racing transitions to Paused through manual pause or performance protection, record that originating state as `resumeState` before publishing the non-ticking lifecycle snapshot. Focus loss is already resolved by the pre-accumulator lifecycle boundary and never reaches Step 3. Finished-only UI Pause is direct UI Presentation input and never starts a physics tick. Pit entry remains physical.
4. If the tick started in Countdown, decrement `countdownRemainingTicks` once. If it reaches zero, schedule GO after this tick's grid-locked physics step; do not increment `activeRaceStepCount` on the GO tick.
5. Update Tire and Fuel runtime state from `TickStartSnapshot` and the corresponding `ResolvedCarInput[carId]`. Per-tick consumption/wear applies its per-second formula multiplied by `FIXED_DT`; Countdown and Qualifying explicitly skip both.
6. Apply all Vehicle Physics forces and controls in stable ascending `carId` order. During Countdown, GridLocked suppresses vehicle movement force, stores the grid pose, clears `linearVelocity` and `angularVelocity`, and updates only engine/wheel visual state before simulation.
7. Call `Physics.Simulate(FIXED_DT)` once for the whole physics scene.
8. If GO was scheduled, GridLocked restores its final grid pose, clears linear/angular velocity, releases grid lock, and Simulation transitions to Racing with `activeRaceStepCount = 0` and `sim_time = 0.0`. Simulation captures immutable `ReplayInitialState` from the locked race configuration, GridAssignment, initial domain state, race seed, active DifficultyProfile ID, content version hash, and Grid & Start's `perfectStartRemainingTicks` result before the first Racing tick.
9. Read resulting CarStates in stable ascending `carId` order. Vehicle Physics tests final transforms against Track pit-entry zones, queues `Pitting` for the next tick, and never changes pit behavior during the physics step that crossed the zone.
10. Race Session Manager evaluates laps, positions, finish conditions and pit events from those final CarStates. On finish or retirement, it returns `FinishDetected` with `resultKind`, player classification and `playerFinishTime`; it never captures snapshots or writes `SimulationState`.
11. After the completed `Physics.Simulate()` call, increment `simulationStepCount`; if the tick started in Racing, increment `activeRaceStepCount`. Then consume RSM outputs before publication. For `FinishDetected`, Simulation captures `PostFinishSnapshot`, passes it once to RSM's FinishOrderResolver, receives `ResolvedFinishOrder`, applies `TransitionRequest(Finished, resolvedFinishOrder)`, and freezes the resolved order. RSM never writes SimulationState directly.
12. Publish immutable `PublishedSimulationSnapshot` for presentation and next-tick consumers. If the tick started in Racing, append only the player `accelerateOut`, `brakeOut`, and `steerOut` values consumed by Vehicle Physics to the MVP in-memory continuous stream and record the tick order separately from the continuous sample. Countdown produces no continuous sample; its resulting race-start state is represented by `ReplayInitialState`.
13. If the published state has a future active tick (`Countdown`, `Racing`, or Alpha `Replay`), AI reads only that published snapshot and computes cached `AIInput` for the next tick. AI also caches the full `DifficultyProfile` fields at race initialization (from `ReplayInitialState`) and uses them throughout the race; the snapshot carries only the profile ID for verification. If the published state is Idle, Loading, Paused, Finished, or Results, skip AI evaluation and clear any stale cached input; AI never runs after a finish result is resolved.

**Replay branch (Alpha+, non-MVP):** When `SimulationState` is Replay, Step 2 bypasses the Input System tick processor and injects recorded `SimulationInput` verbatim. Steps 1 and 3–12 remain unchanged; Step 13 reads the published Replay snapshot and prepares cached AIInput only while Replay has another tick. Live raw capture, dead zones, EMA, and live edge queues do not execute.

#### Snapshot Schemas

Simulation Architecture is the only assembler and owner of these immutable value snapshots. Vehicle Physics, Fuel, Tire and RSM expose read-only domain outputs; Simulation copies them after their declared tick stage. No consumer mutates a snapshot or pushes fields into one.

| Snapshot | Fields | Capture point | Consumers |
|----------|--------|---------------|-----------|
| `TickStartSnapshot` | Prior `simulationStepCount`, `activeRaceStepCount`, `sim_time`, `SimulationState`, `RaceMode`, `countdownRemainingTicks`; ascending-`carId` prior `CarState[]`, Fuel state[], Tire state[], RSM position/lap/rival-gap state[]; cached `AIInput[]` | Step 1; values except cached AIInput copy from the prior PublishedSimulationSnapshot; cached AIInput comes from Step 13 of the prior tick | Input, Fuel, Tire, Vehicle Physics |
| `PublishedSimulationSnapshot` | Current `simulationStepCount`, `activeRaceStepCount`, `sim_time`, `SimulationState`, `RaceMode`, active immutable `DifficultyProfile` ID, `countdownRemainingTicks`; ascending-`carId` current `CarState[]`, Fuel state[], Tire state[], RSM position/lap/rival-gap state[]; when Paused: Simulation-owned `resumeState`; `PerformanceReduced { severity, observedFps }` when active; when Finished or Results after a normal/qualifying completion: RSM-owned copies of `resultKind`, `resolutionComplete`, `playerFinishTime`, `terminalPresentationRequest`, and `ResolvedFinishOrder`; when Results follows a forfeit: `resultClassification = Forfeit`, `forfeitLapCount`, and `raceTimeAtForfeit` | Step 12 for active ticks; lifecycle transition for Idle, Loading, Paused, Finished, or Results | AI on active ticks, HUD, Camera, RSM next tick, UI Presentation |
| `PostFinishSnapshot` | Immutable copy of final post-physics CarState[], RSM lap/position state, `playerFinishTime`, `resultKind`, player classification, existing DNF state and tick counters from the first tick where RSM returns `FinishDetected` | Step 11, before FinishOrderResolver | FinishOrderResolver only |
| `ReplayInitialState` | Version, race configuration ID, content version hash, race seed, DifficultyProfile ID, immutable GridAssignment, ascending car IDs, initial Fuel/Tire state, and `perfectStartRemainingTicks` | GO lifecycle boundary after grid-lock release, before first Racing tick | MVP recordability validation; Alpha Ghost replay initialization |

`PostFinishSnapshot` is not a mutable results object. FinishOrderResolver reads it once and returns `ResolvedFinishOrder { entriesByPosition[] }`; each entry contains `carId`, final classification (`Finished` or `DNF`), finish position, and final/projected time. It never runs PhysX, Fuel, Tire, Pit, collisions, or tactical AI.

**Non-ticking lifecycle output:** On entry to Idle, Loading, Paused, Finished, or Results, Simulation publishes one immutable lifecycle snapshot: state/presentation metadata changes, while CarState, Fuel, Tire, and RSM values copy the most recent authoritative outputs unchanged. Vehicle Physics, Fuel, Tire, and RSM retain those last outputs until the next active tick. No periodic simulation snapshot is published while the state remains non-ticking.

If multiple fixed ticks execute in one render frame, each tick uses the same latest raw sample and advances EMA once. Input feel therefore remains tied to simulation time, not display refresh.

**4. Recordable Input Strategy**

At the GO lifecycle boundary, Simulation captures `ReplayInitialState`. During MVP Racing, it appends the authoritative continuous `accelerateOut`, `brakeOut`, and `steerOut` consumed by Vehicle Physics once per completed 60 Hz tick and stores consumed Pause edges in a parallel standalone event stream. The in-memory buffer validates recordability and performance cost; MVP always discards it on Results, Forfeit, load failure, or return to Idle. It is never serialized, compared against a personal best, exposed in UI, replayed, uploaded, or coupled to CloudStorage. Alpha Ghost Recording may persist these streams, add lap-split metadata, and reserve a corrective-snapshot stream for cross-machine visual playback without changing the MVP tick boundary.

**5. Determinism Rules**

- **Random:** All gameplay randomness uses project-owned PCG32 with an explicit `uint64` seed, deterministic state transition, and named `NextUInt`, `NextFloat01`, and range helpers. `UnityEngine.Random` is prohibited on the simulation path.
- **Time scale:** `Time.timeScale` is never modified during gameplay. Pause is implemented by skipping simulation steps, not by setting `timeScale = 0`.
- **Math:** All simulation-path math uses `Unity.Mathematics` (`float3`, `math.*`) consistently. No mixing with `System.MathF`.
- **No simulation logic in `Update()`:** Gameplay state changes happen inside the fixed step except for explicit non-physics lifecycle boundaries. `Update()` handles rendering, input accumulation, VFX, and the display-FPS monitor. Focus loss may publish Paused before accumulator evaluation, and UI Presentation dismissal may transition Finished to Results; neither path calls Physics, changes race clocks/resources/CarState, or alters a locked result.
- **No simulation code in `FixedUpdate()`:** Unity invokes `FixedUpdate()` independently of the manual accumulator even when `Physics.simulationMode = SimulationMode.Script`. It must not mutate Rigidbody state, CarState, Fuel, Tire, RSM, AI, or any gameplay state; the manual accumulator loop is the only simulation writer.
- **Physics callbacks:** Simulation-path systems must not mutate gameplay state through `OnCollision*` or `OnTrigger*` callbacks. Contacts and overlap state are read explicitly in the declared post-`Physics.Simulate()` tick stage.
- **PhysX boundary:** Same executable on the same physical machine/environment must satisfy deterministic replay validation. Cross-machine and cross-platform PhysX equivalence are not guaranteed. Alpha ghost playback corrects visual trajectory with recorded state snapshots; Beta canonical multiplayer state must not depend on local PhysX.

**6. Simulation States**

**Authority:** Simulation Architecture is the only writer of `SimulationState`. Race Session Manager owns `RaceMode`, race rules and transition requests; Content Pipeline emits load and unload lifecycle signals; neither writes SimulationState directly. `RaceMode.Race` and `RaceMode.Qualifying` both execute under `SimulationState.Racing`; the mode changes session rules and input context without duplicating physics, timing, pause, or render behavior. Qualifying selects `GameplayQualifying`, which ignores physical pit-entry zones while retaining Accelerate, Brake, Steer, and Pause. Qualifying enters Racing directly from Loading and never enters `SimulationState.Countdown`; Countdown is exclusively the standing-start state for `RaceMode.Race`.

| State | Description | Simulation Active | Rendering | Input Consumed |
|-------|-------------|-------------------|-----------|----------------|
| `Idle` | No race loaded; Content has released race assets | No | Title/menu UI | UI only |
| `Loading` | Track and car assets loading; simulation not started | No | Content/loading UI | UI only; Cancel/Back ignored after load begins except explicit Content error |
| `Countdown` | Pre-race 5-second lights sequence; simulation runs, Settings blocked, vehicle grid-locked and unable to reach a pit-entry zone | Yes | Yes (interpolated) | Accelerate, Brake, Steer, Pause |
| `Racing` | Active race; full simulation and input | Yes | Yes (interpolated) | Yes |
| `Finished` | Player objective ended; terminal presentation holds the player car for up to 5s while result is already resolved | No; resolver ran in the finishing Racing tick and no subsequent PhysX, Fuel, Tire, Pit, collision, or tactical AI tick runs | Player-car terminal presentation; UI Presentation owns the timer and pause flag | UI Confirm, UI Pause |
| `Paused` | Player paused; simulation frozen, time stops | No | Yes (static frame) | Menu only |
| `Results` | Resolved Race or Qualifying result; simulation frozen while the result-specific UI is active | No | Yes (static frame) | Menu only |
| `Replay` | Ghost replay (Alpha+); simulation replays recorded input | Yes (replay mode) | Yes (interpolated) | No |

**Finished terminology:** **Finished Presentation** is the UI Menu screen shown while SimulationState is Finished. **UI Presentation** is that screen's controller; it owns the presentation timer, pause flag, and `DismissTerminalPresentation` signal. Neither owns SimulationState or race data.

**Transition rules:**

| From | To | Trigger |
|------|----|---------|
| `Idle` | `Loading` | Grid Display sends `StartRaceRequested`; RSM returns `TransitionRequest(Loading, RaceStartRequested, gridAssignment)` and Simulation sends the corresponding ContentLoadRequest |
| `Loading` | `Countdown` | `RaceLoadReady(RaceMode.Race, gridAssignment)` accepted by Simulation |
| `Loading` | `Racing` | `RaceLoadReady(RaceMode.Qualifying)` accepted by Simulation |
| `Loading` | `Idle` | Content emits `ContentLoadError`; Content releases partial race assets and UI shows the error on Title |
| `Countdown` | `Racing` | Countdown timer reaches zero ("GO") |
| `Countdown` | `Paused` | Player presses Pause |
| `Paused` | `Countdown` | Player resumes before GO |
| `Racing` | `Paused` | Player presses Pause |
| `Countdown` or `Racing` | `Paused` | Performance protection requests pause after FPS remains below 15 for 3 additional seconds following PerformanceReduced |
| `Paused` | `Racing` | Player resumes from pause |
| `Paused` | `Results` | Player selects Return to Menu while resume state is Countdown or Racing; RSM records `resultClassification = Forfeit` and emits `RaceAborted(Forfeit)` |
| `Racing` | `Finished` | Player crosses finish line on final lap, or retires (fuel empty and stopped) with DNF classification |
| `Finished` | `Results` | Resolution is complete and player dismisses terminal presentation; `resultKind` selects Race Results or Qualifying Results/Grid Display |
| `Results` | `Loading` | Race Results starts another race, or Qualifying Results/Grid Display sends `StartRaceRequested`; RSM returns a Loading TransitionRequest and Simulation sends the matching ContentLoadRequest (Content Pipeline calls this `Race Reconfigure`) |
| `Results` | `Results` | Player selects Continue or Back to Title; Simulation sends `ContentUnloadRequest` and remains Results while unload is in progress |
| `Results` | `Idle` | Content emits `ContentUnloadComplete` after all race instances and handles are released |
| `Results` | `Replay` | Player watches ghost replay (Alpha+, non-MVP) |
| `Replay` | `Results` | Replay ends or player exits (Alpha+, non-MVP) |

**State behavior details:**

- **Idle → Loading:** Simulation accepts a selected race configuration and requests Content loading. No simulation tick runs until a valid readiness signal arrives.
- **Loading → Countdown:** Simulation initializes `accumulator = 0`, `simulationStepCount = 0`, `activeRaceStepCount = 0`, `sim_time = 0`, resource state and all car positions from `RaceLoadReady(RaceMode.Race, gridAssignment)`. Grid & Start applies the locked `GridAssignment` before the first Countdown tick.
- **Loading → Idle:** On ContentLoadError, Content releases partial race assets; Simulation publishes Idle and UI presents the error on Title. Normal Cancel/Back remains ignored while Loading is in progress.
- **Loading → Racing (Qualifying):** Simulation initializes `accumulator = 0`, the same clocks and local state, then Race Session Manager supplies `RaceMode.Qualifying`; the qualifying car spawns at pit exit with `GameplayQualifying`. No Countdown state, grid lock, lights sequence, or pre-GO tick occurs for Qualifying.
- **Countdown:** `countdownRemainingTicks` initializes to 300 and is the only authority for GO. Each unpaused tick decrements it once. Fuel and Tire remain at their initial race values. Vehicle Physics holds grid lock while allowing wheel/engine visual state; Pit and Settings remain blocked. When the 300th tick completes, GO releases grid lock, `activeRaceStepCount` begins at 0, and current input drives Racing without EMA reset.
- **Racing:** Full simulation. All systems tick in the declared pipeline. Input is forwarded and the MVP recordable-input buffer captures the authoritative player SimulationInput with tick index; the buffer remains invisible and non-persistent.
- **Finished:** Both Qualifying and Race enter the same terminal presentation after their result resolves in the finishing Racing tick. Player result is fixed, race controls are disabled, and Camera consumes `terminalPresentationRequest` from the published snapshot. UI Presentation owns the unscaled up-to-5-second timer and `terminalPresentationPaused`; it automatically pauses its timer while the application is unfocused. Confirm may dismiss immediately; P/Start toggles only the UI-owned timer. While the timer has remaining time and no dismissal occurs, Finished remains unchanged and runs no physics or AI tick. On timer expiry, UI Presentation emits `DismissTerminalPresentation`; Simulation transitions to Results without mutating race data or running physics. `resultKind` selects Race Results or Qualifying Results/Grid Display. At a race finish, `FinishOrderResolver` reads `PostFinishSnapshot` once: completed drivers and player result remain immutable; unfinished AI are behind the player and receive `projectedFinishTime = playerFinishTime + remainingDistance / expectedRacePace`; existing DNF remains DNF; ties use current RSM order then `carId`. On player retirement, player classification is DNF and the same resolver projects every non-DNF unfinished AI without waiting. It does not execute PhysX, Fuel, Tire, Pit, collisions, or tactical AI. It must produce the same Results whether the player waits or advances.
- **Paused:** `resumeState` is Simulation-owned and records the Countdown or Racing state active immediately before manual pause, focus-loss pause, or performance pause. Accumulator remainder is preserved but no elapsed time is accumulated and no simulation tick runs. Focus regain leaves this state intact until explicit Resume.
- **Results:** Simulation is frozen after Finished resolves or a forfeit. `resultKind = Race` presents Race Results; `resultKind = Qualifying` presents Qualifying Results/Grid Display. A forfeit retains only `resultClassification = Forfeit`, `forfeitLapCount`, and `raceTimeAtForfeit`, with no final position. The MVP recordable-input buffer is always discarded on entry. A Countdown forfeit sets `forfeitLapCount = 0` and `raceTimeAtForfeit = 0.0`. Start Race or Next Race transitions to Loading. Continue/Back sends `ContentUnloadRequest`, keeps Simulation in Results while unload executes, and transitions to Idle only after `ContentUnloadComplete`. No global leaderboard submission occurs in MVP.
- **Replay (Alpha+, non-MVP):** Simulation runs in replay mode using the explicit Replay branch above. Recorded SimulationInput is injected directly once per tick; live Input System raw capture, dead zones, EMA, and edge queues are bypassed.

### Interactions with Other Systems

| System | Direction | Data Flow | Timing | Interface Description |
|--------|-----------|-----------|--------|----------------------|
| **Input System** | Inbound | Player SimulationInput and UI Presentation controls | Per Update capture; processed per fixed tick or by UI Presentation | InputSystem owns device events, raw capture, dead zones, EMA, and Input Context. Simulation invokes its tick processor and transports resulting player SimulationInput; Finished-only P/Start routes to UI Presentation, never to a physics tick. |
| **Settings** | Inbound | Immutable `DifficultyProfile` | Race initialization | Simulation resolves and snapshots the selected external profile, transports AI precision/error/pace fields to AI and player recovery fields to Vehicle Physics, and never mutates Car Definition formulas or current-race difficulty. |
| **Vehicle Physics** | Bidirectional | Input values in → car state (position, velocity, rotation) out | Per fixed step | Simulation calls Vehicle Physics with current input and FIXED_DT. Vehicle Physics writes car state back. Tight coupling — Vehicle Physics IS the core of the simulation step. |
| **Fuel System** | Bidirectional | `ResolvedCarInput[carId]` in → fuel state out | Per fixed step | Fuel reads the same resolved throttle value as Vehicle Physics. Consumption applied during simulation step. State is copied into snapshot. |
| **Tire System** | Bidirectional | `ResolvedCarInput[carId]` in → tire grip state out | Per fixed step | Tire reads resolved steering plus speed/surface contact for wear calculation. Grip modifies Vehicle Physics handling. Both read/write within same step. |
| **AI Rival** | Bidirectional | Published state in → AI decisions (input values) out | After a published state with a future active tick | AI reads only the published snapshot (all positions, speeds, fuel, tires) and produces cached input for the next active tick; it cannot affect the snapshot it observed and is skipped for non-ticking states. |
| **Future Network Driver** | Future | Future local input/state integration | Beta decision | A future network driver may replace the local driver without changing SimulationInput, CarState, tick or state contracts. SDK, rollback and canonical-state implementation require a separate Beta ADR. |
| **Ghost Recording** | Architecture boundary / future bidirectional | ReplayInitialState, MVP in-memory continuous input + standalone Pause stream; Alpha replay input | GO boundary, completed Racing tick, or consumed Pause boundary | MVP validates and discards all recordable data without persistence or UI. Alpha may serialize it, add lap/correction metadata, and provide recorded input during Replay. |
| **Race Session Manager** | Bidirectional | Final post-physics CarState in; events, `FinishDetected`, `ResolvedFinishOrder`, and `TransitionRequest` out | Per completed tick | RSM reads final post-physics state, determines lap/position/finish, returns `FinishDetected`; Simulation captures PostFinishSnapshot, then RSM resolves order and returns `TransitionRequest` before the current snapshot publishes. For QualifyingComplete, TransitionRequest carries locked `GridAssignment`. |
| **Content Pipeline** | Bidirectional | Load/unload requests out; readiness, error, and unload-complete signals in | Loading or Results lifecycle | Simulation sends `ContentLoadRequest(RaceMode.Qualifying)`, `ContentLoadRequest(RaceMode.Race, gridAssignment)`, or `ContentUnloadRequest`. Content returns `RaceLoadReady(RaceMode.Qualifying)`, `RaceLoadReady(RaceMode.Race, gridAssignment)`, `ContentLoadError`, or `ContentUnloadComplete`. Simulation alone selects Countdown for Race, Racing for Qualifying, and Idle after unload completion. Content Pipeline uses a `CP_` prefix for its own state names to avoid collisions with Simulation states. |
| **Grid & Start** | Outbound | Immutable `GridAssignment` and grid-lock lifecycle | Before the first Countdown tick and at GO | Simulation passes the RSM-produced assignment to Grid & Start before Countdown; Grid & Start applies grid slots and releases grid lock on the GO boundary. |
| **HUD** | Outbound | Published simulation state, Finished-only immutable result metadata, and `PerformanceReduced` status | Per `Update()` frame | HUD reads latest published state for state/result presentation. Speed, fuel, tire, position and lap data come directly from their domain owners, never interpolated visual positions. |
| **Camera** | Outbound | Visual car position/rotation and `terminalPresentationRequest` | Per `Update()` frame (interpolated) | Camera reads interpolated visual transform, not raw simulation state, and enters terminal view only from immutable published request. |
| **UI Menu** | Bidirectional | `terminalPresentationRequest` out; `DismissTerminalPresentation`, result navigation, and `StartRaceRequested` in | Finished and Results lifecycle | UI Presentation owns its timer/pause and emits dismissal. Simulation performs Finished → Results, then Results → Loading or the unload handshake without physics. |

## Formulas

### Simulation Time

`sim_time = activeRaceStepCount × FIXED_DT`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Active Race Step Count | activeRaceStepCount | uint32 | 0–∞ | Monotonic counter of simulation steps since GO; excludes Countdown |
| Fixed Delta Time | FIXED_DT | float | constant | 1/60 ≈ 0.016667 seconds |

**Output Range:** 0.0 to ∞ seconds
**Example:** After 3600 active race steps: sim_time = 3600 × (1/60) = 60.0 seconds (1 minute)

### Render Interpolation Factor

`α = accumulator / FIXED_DT`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Accumulator residue | accumulator | float | 0.0–<FIXED_DT | Remaining time after all ticks fire, before next simulation step |
| Fixed Delta Time | FIXED_DT | float | constant | 1/60 seconds |

**Output Range:** [0.0, 1.0). α approaches 1.0 but the next tick fires before it reaches 1.0.
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

- **If display drops below 15 FPS:** Accumulator is clamped at `2 × FIXED_DT`; excess time is discarded. The game must expose a performance warning rather than claim equal wall-clock competitiveness. The 16-car profiling gate determines whether content may expand.
- **If player tabs out mid-race:** The focus-change frame adds no elapsed delta. Before accumulator evaluation, the focus lifecycle boundary publishes Paused without a physics tick or counter increment and preserves the sub-tick remainder. Focus return leaves the game paused until explicit Resume. No catch-up is attempted.
- **If `Physics.Simulate()` throws:** Catch and log. Freeze simulation state. Show error message. Offer retry from last checkpoint (race start for MVP).
- **If Ghost Recording data is corrupted:** Replay falls back to "no ghost available" state. Race still runs normally; ghost display is skipped.
- **If Alpha corrective ghost state arrives:** Apply it only as visual ghost correction after the local tick; it never writes MVP player simulation state.
- **If no new Dynamic Update sample exists for multiple ticks in one render frame:** Reuse the latest valid `RawInputSample` for every tick and advance EMA once per tick. If Input System reports `NoInputDevice`, consume its zeroed SimulationInput instead; Simulation never invents a second fallback state.
- **If simulation step takes longer than `FIXED_DT`:** The accumulator builds up. Multiple steps fire in the next `Update()` frame. If this persists, the spiral-of-death clamp engages and simulation slows.
- **If two cars collide at the exact same position:** PhysX resolves the contact for the local scene. The result is only guaranteed repeatable in the same executable and physical environment; it is never used as cross-machine canonical truth.
- **If race is paused during a collision:** Physics state is frozen mid-contact. On resume, the next step resolves the collision normally. No physics drift.
- **If player switches device during a race:** The latest RawInputSample is replaced at the next input capture. The next SimulationInput uses the active available scheme, clears the pending Pause edge, and initializes each EMA previous value from that scheme's current post-dead-zone value. No filtered value carries across schemes.

## Dependencies

| System | Direction | Type | Data Flow |
|--------|-----------|------|-----------|
| Input System | Upstream | Hard | Input → Simulation: authoritative SimulationInput once per fixed tick; Input owns raw capture and queued edges internally |
| Vehicle Physics | Bidirectional | Hard | Simulation → Physics: FIXED_DT + input values. Physics → Simulation: car state (position, velocity, rotation) |
| Fuel System | Bidirectional | Hard | Simulation → Fuel: throttle value per step. Fuel → Simulation: fuel state |
| Tire System | Bidirectional | Hard | Simulation → Tire: steering, speed, surface contact. Tire → Simulation: grip multiplier |
| AI Rival | Bidirectional | Hard | Simulation → AI: all 16 car states. AI → Simulation: input values for AI-controlled cars |
| Future Network Driver | Future | Deferred | No MVP dependency. A Beta driver may replace local transport without changing SimulationInput, CarState, tick or state contracts; SDK/rollback/canonical state require a separate ADR. |
| Content Pipeline | Bidirectional | Hard | Simulation → Content Pipeline: `ContentLoadRequest(RaceMode.Qualifying)`, `ContentLoadRequest(RaceMode.Race, gridAssignment)`, or `ContentUnloadRequest`; Content Pipeline → Simulation: `RaceLoadReady(RaceMode.Qualifying)`, `RaceLoadReady(RaceMode.Race, gridAssignment)`, `ContentLoadError`, or `ContentUnloadComplete`. Content never writes SimulationState. |
| Ghost Recording | Architecture constraint / future bidirectional | Deferred runtime feature | MVP captures and discards the recordable stream; Alpha may persist it and feed replay input back through Simulation. |
| Race Session Manager | Bidirectional | Hard | Simulation → RSM: sim time, car positions. RSM → Simulation: race events (lap complete, finish, pit entry) |
| HUD | Downstream | Soft | Simulation → HUD: SimulationState, sim_time, countdown ticks, PerformanceReduced status, and Finished-only immutable result metadata. HUD reads domain telemetry from each owning system. |
| Camera | Downstream | Soft | Simulation → Camera: interpolated visual transform for smooth camera movement |
| Settings | Inbound | Hard | Settings → Simulation: immutable DifficultyProfile at race initialization. Simulation transports approved profile fields and owns the fixed MVP timestep; Settings cannot change the current snapshot or `FIXED_DT`. |
| Grid & Start | Outbound | Hard | Simulation → Grid & Start: immutable `GridAssignment` and grid-lock release boundary |
| VFX | Downstream | Soft | Simulation → VFX: active lifecycle state and PerformanceReduced quality signal |
| Audio | Downstream | Soft | Simulation → Audio: active lifecycle state and fixed-step timing reference; engine data remains owned by Vehicle Physics |

## Tuning Knobs

| Knob | Default | Range | Too Low | Too High |
|------|---------|-------|---------|----------|
| Fixed Timestep (FIXED_DT) | 0.01667s (60 Hz) | Fixed for MVP | N/A | Changing it invalidates all tick contracts and requires a new ADR |
| Spiral-of-Death Clamp | 2× FIXED_DT | Fixed for MVP; changes require design review | N/A | N/A |
| Raw Input Sample Capacity | Latest sample | Fixed | Stale input after delayed Update | Unnecessary historical input processing |
| Countdown Duration | 5.0s (300 steps) | Fixed for MVP; changes require design review | N/A | N/A |
| Render Interpolation | Always on | On/Off | Not applicable (always on for smooth visuals) | N/A |
| Simulation p95 tick cost | ≤ 6 ms | Empirically selected PC baseline | Content may not expand until the baseline protocol selects a passing machine | Misses 60 FPS frame budget |
| Simulation maximum tick cost | ≤ 8 ms | Empirically selected PC baseline | N/A | Investigation/blocker before expansion |

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
- **AC-1.2:** **Given** Racing receives exactly 30.0 FPS frame durations of `2 × FIXED_DT`, **When** 10 seconds of wall-clock time elapse, **Then** exactly 600 simulation steps execute and no time is discarded; only frames exceeding `2 × FIXED_DT` fall under AC-1.6.
- **AC-1.3:** **Given** a frame takes 18ms (at 60Hz fixed timestep of ~16.67ms), **When** the frame completes, **Then** the accumulator holds approximately 1.33ms of leftover time for the next frame.
- **AC-1.4:** **Given** the accumulator has accumulated ≥ FIXED_DT, **When** the simulation loop runs, **Then** Physics.Simulate(FIXED_DT) is called once per accumulated step, and no call to Unity's automatic Physics simulation occurs.
- **AC-1.5:** **Given** a frame exceeds `2 × FIXED_DT` due to system load, **When** the simulation loop processes the frame, **Then** the accumulator is clamped to `2 × FIXED_DT`, and at most 2 simulation steps execute in that frame.
- **AC-1.6:** **Given** the accumulator exceeds 2× FIXED_DT after a long frame, **When** it is clamped, **Then** time above the clamp is permanently discarded and the next normal frame resumes ordinary fixed-step processing without catch-up.
- **AC-1.7:** **Given** Countdown reaches GO, **When** the first Racing snapshot publishes, **Then** `activeRaceStepCount = 0` and `sim_time = 0.0`.
- **AC-1.8:** **Given** a Racing snapshot publishes after N Racing physics ticks, **When** its counters are read, **Then** `sim_time = activeRaceStepCount × FIXED_DT` within ±1e-6.
- **AC-1.9:** **Given** Countdown is active, **When** any snapshot publishes, **Then** `sim_time = 0.0` regardless of `simulationStepCount`.

### 2. Render Interpolation

- **AC-2.1:** **Given** the accumulator holds 8ms after the latest simulation step, **When** the render pass calculates interpolation alpha, **Then** α = accumulator / FIXED_DT ≈ 0.48 (±0.02).
- **AC-2.2:** **Given** a constant-velocity test car, a 60Hz display, and a 60Hz simulation, **When** 10 consecutive frames render, **Then** every visual pose equals `Lerp(previousStep, currentStep, accumulator_remainder / FIXED_DT)` within 1e-4 units and the positions are monotonic along the velocity vector.
- **AC-2.3:** **Given** a constant-velocity test car, a 30Hz display, and a 60Hz simulation, **When** 10 consecutive frames render, **Then** every visual pose equals `Lerp(previousStep, currentStep, accumulator_remainder / FIXED_DT)` within 1e-4 units and the positions are monotonic along the velocity vector.
- **AC-2.4:** **Given** a constant-velocity test car, a 144Hz display, and a 60Hz simulation, **When** 10 consecutive frames render, **Then** every visual pose equals `Lerp(previousStep, currentStep, accumulator_remainder / FIXED_DT)` within 1e-4 units and the positions are monotonic along the velocity vector.
- **AC-2.5:** **Given** two simulation snapshots with positions P0, P1 and rotations R0, R1, **When** the render pass interpolates, **Then** position is computed as Lerp(P0, P1, α) and rotation as Slerp(R0, R1, α).
- **AC-2.6:** **Given** the accumulator holds a remainder after the last simulation step, **When** the render pass interpolates, **Then** α is always in the range [0, 1), and the visual never leads ahead of the simulation state.

### 3. Input Sampling and Tick Processing

- **AC-3.1:** **Given** several Dynamic Update captures occur before one fixed tick, **When** the tick builds SimulationInput, **Then** it uses the latest RawInputSample.
- **AC-3.1a:** **Given** a Simulation-driver Update begins, **When** the accumulator is evaluated, **Then** Input-owned `CaptureLatestRawSample()` has already executed exactly once in that same call path and no MonoBehaviour script-order assumption is required.
- **AC-3.2:** **Given** the same raw sample is used by two fixed ticks in one render frame, **When** both ticks execute, **Then** each advances EMA exactly once.
- **AC-3.3:** **Contract reference — Input System AC-7.** **Given** identical raw input sequences at 30 FPS and 144 FPS, **When** both runs execute the same 60 fixed ticks, **Then** Simulation consumes the identical per-tick SimulationInput sequence verified by Input System.
- **AC-3.4:** **Given** a Pause rising edge is captured, **When** the next fixed tick begins, **Then** the edge is consumed once at that tick boundary.
- **AC-3.5:** **Contract reference — Input System AC-8.** **Given** a gamepad disconnect is observed while KeyboardMouse remains available, **When** the next fixed tick builds SimulationInput, **Then** Simulation consumes KeyboardMouse input without freezing race simulation.
- **AC-3.6:** **Given** a `PublishedSimulationSnapshot` is published, **When** AI, HUD, Camera, or RSM reads it, **Then** no consumer mutation can change the published value or any domain owner state.
- **AC-3.7:** **Given** a fixed tick begins, **When** player SimulationInput and cached AIInput are combined, **Then** each car has exactly one ascending-`carId` `ResolvedCarInput` consumed identically by Fuel, Tire, and Vehicle Physics.
- **AC-3.8:** **Given** Simulation enters Idle, Loading, Paused, Finished, or Results, **When** a consumer reads the lifecycle snapshot or direct domain outputs before the next active tick, **Then** state/presentation metadata reflects the transition and CarState, Fuel, Tire, and RSM values equal their last authoritative tick values.
- **AC-3.9:** **Given** GO releases grid lock, **When** the first Racing tick is about to begin, **Then** ReplayInitialState contains the locked race configuration, content hash, seed, DifficultyProfile, GridAssignment, car IDs, initial resources, and `perfectStartRemainingTicks` before any continuous record is appended.
- **AC-3.10:** **Given** a Racing Pause edge is consumed, **When** the lifecycle boundary is recorded, **Then** one standalone EdgeEvent is appended and no continuous input sample is required for that same simulationStepCount.

### 4. State Transitions

- **AC-4.0:** **Given** SimulationState is Idle, **When** the player starts Single Race from Title, **Then** Simulation transitions to Loading and sends ContentLoadRequest.
- **AC-4.1:** **Given** the game is in Loading state for `RaceMode.Race` and all required assets plus `gridAssignment` are ready, **When** Simulation accepts `RaceLoadReady(RaceMode.Race, gridAssignment)`, **Then** the state transitions to Countdown.
- **AC-4.1a:** **Given** Loading receives `RaceLoadReady(RaceMode.Qualifying)`, **When** Simulation accepts it, **Then** state transitions to Racing with RaceMode.Qualifying and GameplayQualifying input context.
- **AC-4.1aa:** **Given** Qualifying content becomes ready, **When** Simulation starts the session, **Then** no Countdown tick, grid lock, or lights sequence executes and the first active state is Racing with RaceMode.Qualifying.
- **AC-4.1b:** **Given** SimulationState is not Loading, **When** `RaceLoadReady` arrives, **Then** Simulation ignores it and state remains unchanged.
- **AC-4.1c:** **Given** SimulationState is Loading, **When** Content emits `ContentLoadError`, **Then** Simulation transitions to Idle, Content releases partial race assets, and UI receives error metadata for Title.
- **AC-4.1d:** **Given** Loading transitions to Countdown or Racing, **When** Simulation initializes the session, **Then** `accumulator = 0` before the first active tick.
- **AC-4.2:** **Given** Countdown initializes, **When** its first unpaused simulation tick begins, **Then** `countdownRemainingTicks` equals 300.
- **AC-4.3:** **Given** Countdown has processed 299 unpaused simulation ticks, **When** the next tick completes, **Then** `countdownRemainingTicks` reaches zero, grid lock releases, and the state transitions to Racing.
- **AC-4.4:** **Given** Countdown is active, **When** any of its 300 unpaused simulation ticks processes Accelerate, Brake, or Steer, **Then** SimulationInput and EMA advance while Vehicle Physics keeps the car stationary under grid lock.
- **AC-4.4a:** **Given** Countdown is active, **When** all 300 unpaused ticks complete, **Then** Fuel and Tire remain at their initial race values.
- **AC-4.4b:** **Given** Countdown decrements from 1 to 0 on its 300th tick, **When** that tick completes, **Then** it increments `simulationStepCount`, releases grid lock after Physics.Simulate, publishes Racing with `activeRaceStepCount = 0`, and the following tick is the first tick that starts Racing.
- **AC-4.5:** **Given** Countdown is active, **When** Pause transitions simulation to Paused, **Then** no countdown ticks execute until resume and the remaining tick count is preserved, matching Input System AC-15.
- **AC-4.6:** **Given** the game is in Racing state, **When** the player presses the pause button, **Then** the state transitions to Paused.
- **AC-4.6a:** **Given** Countdown or Racing is active, **When** Simulation enters Paused through the pause button, focus lifecycle boundary, or performance protection, **Then** it records the originating state as `resumeState` before publishing the Paused lifecycle snapshot.
- **AC-4.7:** **Given** the game is in Paused state, **When** the player resumes, **Then** the state returns to its recorded `resumeState` of Countdown or Racing.
- **AC-4.8:** **Given** the game is in Racing state and the player crosses the finish line on the final lap, **When** the finish condition is detected, **Then** the state transitions to Finished, player race controls are disabled, and FinishOrderResolver runs once from the locked snapshot.
- **AC-4.8dnf:** **Given** Racing detects fuel empty and the player car stopped on track, **When** RSM returns FinishDetected with player DNF, **Then** Simulation enters Finished and resolves all non-DNF unfinished AI from PostFinishSnapshot without waiting for live simulation.
- **AC-4.8a:** **Given** `resultKind = Race` or `Qualifying`, **When** resolution is complete and terminal presentation is dismissed, **Then** Simulation transitions from Finished to Results without a physics tick and `resultKind` selects the result-specific UI.
- **AC-4.8b:** **Given** `resultKind = Qualifying`, **When** the flying lap completes or fails, **Then** `resolutionComplete` is immediately true, Finished Presentation begins, and Confirm or its 5-second timeout transitions Simulation to Results and opens Qualifying Results/Grid Display.
- **AC-4.8c:** **Given** terminal presentation is active, **When** P or gamepad Start toggles UI Pause, **Then** UI Presentation freezes or resumes its timer while SimulationState remains Finished and no physics tick executes.
- **AC-4.8d:** **Given** terminal presentation is active, **When** Simulation publishes state, **Then** PublishedSimulationSnapshot contains immutable RSM-originated copies of `resultKind`, `resolutionComplete`, `playerFinishTime`, `terminalPresentationRequest`, and `ResolvedFinishOrder` for Camera, HUD, and UI Presentation.
- **AC-4.8e:** **Given** FinishOrderResolver receives a locked post-finish snapshot, **When** it resolves trailing AI, **Then** completed drivers and player result remain immutable; DNF remains DNF; ties use RSM order then carId; and no PhysX, Fuel, Tire, Pit, collision or tactical AI executes.
- **AC-4.8f:** **Given** a Racing tick first detects player finish, **When** RSM returns FinishDetected, **Then** Simulation captures PostFinishSnapshot once, RSM returns ResolvedFinishOrder and `TransitionRequest(Finished)`, the current tick publishes Finished, and no subsequent Finished tick runs physics or resource simulation.
- **AC-4.8g:** **Given** UI Presentation dismisses a Race or Qualifying terminal request, **When** Simulation consumes DismissTerminalPresentation, **Then** Finished transitions to Results without Physics.Simulate or race-data mutation.
- **AC-4.8h:** **Given** Simulation is in Results with `resultKind = Qualifying` and Qualifying Results confirms Start Race, **When** RSM returns `TransitionRequest(Loading, QualifyingComplete, gridAssignment)`, **Then** Simulation enters Loading, sends `ContentLoadRequest(Race, gridAssignment)`, and transitions to Countdown only after `RaceLoadReady(RaceMode.Race, gridAssignment)`.
- **AC-4.8i:** **Given** SimulationState is Finished and UI Presentation's terminal timer has remaining time, **When** no `DismissTerminalPresentation` arrives, **Then** Finished remains unchanged and no physics tick executes; when the timer expires, UI Presentation emits dismissal and Simulation follows the Race or Qualifying result path.
- **AC-4.8j:** **Given** a finishing Racing tick publishes SimulationState.Finished, **When** Step 13 is reached, **Then** AI evaluation is skipped, stale cached AIInput is cleared, and no tactical AI executes after result resolution.
- **AC-4.9 (Alpha+, non-MVP):** **Given** the game is in Results state, **When** the player selects "Watch Replay", **Then** the state transitions to Replay.
- **AC-4.10:** **Given** the game is in Results state, **When** the player selects "Next Race", **Then** the state transitions to Loading.
- **AC-4.10a:** **Given** the game is in Results state, **When** the player selects Continue or Back, **Then** Simulation sends `ContentUnloadRequest`, remains Results, and executes no simulation tick while unload is in progress.
- **AC-4.10b:** **Given** Simulation is waiting in Results after `ContentUnloadRequest`, **When** Content emits `ContentUnloadComplete`, **Then** Simulation publishes Idle with no race assets retained.
- **AC-4.11:** **Given** the game is in Loading state, **When** any event other than loading completion occurs, **Then** the state remains Loading and no simulation steps execute.
- **AC-4.12:** **Given** a Paused state whose `resumeState` is Countdown or Racing, **When** the player selects Return to Menu, **Then** Simulation transitions directly to Results without a resumed physics tick; RSM publishes `resultClassification = Forfeit`, `forfeitLapCount`, and `raceTimeAtForfeit`, with no final position; and Ghost Recording receives `RaceAborted(Forfeit)` and discards its partial buffer.
- **AC-4.13:** **Given** the game is in Loading state, **When** the update loop runs, **Then** no simulation steps (Physics.Simulate) are executed.

### 5. Determinism

- **AC-5.1:** **Given** two fresh runs on the same executable and physical machine/environment with identical PCG32 seed, inputs and track, **When** both run for 300 ticks, **Then** vehicle positions at tick 300 differ by ≤ 0.001 units.
- **AC-5.2:** **Given** PCG32 initializes with seed = 12345, **When** its named methods are sampled in a standalone test, **Then** the documented sequence of `NextUInt` values matches exactly; UnityEngine.Random is not called.
- **AC-5.3:** **Given** the game enters Paused or loses focus, **When** Update continues or resumes, **Then** Time.timeScale remains unchanged, elapsed time is not accumulated, and the pre-pause accumulator remainder is preserved until explicit Resume.
- **AC-5.4:** **Given** scalar or vector math executes on the simulation path, **When** it clamps, normalizes or otherwise mutates authoritative state, **Then** it uses Unity.Mathematics types (`math`, `float3`, `quaternion`) rather than UnityEngine.Vector3/Mathf. Visual-only interpolation remains outside this simulation-path rule.
- **AC-5.5:** **Given** five fresh-process runs on the same executable and physical machine/environment with the same seed and inputs, **When** each completes a 5-lap race, **Then** final CarStates of all 16 cars differ by ≤ 0.001 units; no cross-machine claim is made.

### 6. Ghost Recording

- **AC-6.1:** **MVP architecture constraint.** **Given** Racing is active, **When** a tick completes, **Then** the authoritative continuous SimulationInput and tick index are appended once to an in-memory recordable buffer; consumed Pause edges use the parallel event stream, and the complete buffer is discarded without serialization or UI when Results, Forfeit, load failure, or Idle is reached.
- **AC-6.2:** **Alpha scope.** A ghost recorded on another machine uses corrective snapshots for visual trajectory correction; it never requires cross-machine PhysX equivalence.
- **AC-6.3:** **Alpha scope.** Persisted ghost load/playback is deferred and has no MVP acceptance criterion.

### 7. Edge Cases

- **AC-7.1:** **Given** the game is in Racing or Countdown with accumulator below `FIXED_DT`, **When** application focus is lost, **Then** the pre-accumulator lifecycle boundary immediately publishes Paused without waiting for a physics tick and focus return still requires explicit Resume.
- **AC-7.1a:** **Given** focus loss is consumed before accumulator evaluation, **When** the lifecycle boundary executes, **Then** it records `resumeState`, preserves accumulator remainder, increments no counter, updates no domain system, and calls no `Physics.Simulate`.
- **AC-7.1b:** **Given** application focus changes, **When** that Update frame evaluates its accumulator, **Then** it adds no `Time.unscaledDeltaTime` and preserves the pre-change remainder.
- **AC-7.1c:** **Given** Finished Presentation has 3 seconds remaining, **When** application focus is lost for 30 seconds and then returns, **Then** UI Presentation retains 3 seconds remaining until focused presentation time resumes and SimulationState remains Finished.
- **AC-7.2:** **Given** one render frame contains multiple simulation ticks and no newer Dynamic Update sample, **When** Simulation resolves each tick, **Then** every tick processes the latest valid RawInputSample and advances EMA once.
- **AC-7.3:** **Given** a ghost file with invalid header or truncated data, **When** the replay system attempts to load it, **Then** an error is logged, the ghost is discarded, and the race/replay proceeds without ghost data.
- **AC-7.4:** **Given** the game is Paused for 30 seconds, **When** the player resumes, **Then** the accumulator retains its pre-pause remainder, adds no paused elapsed time, and runs no catch-up steps.
- **AC-7.5:** **Given** a 200ms frame spike, **When** the accumulator is clamped to `2 × FIXED_DT`, **Then** exactly two simulation steps execute and no catch-up executes in later frames.
- **AC-7.6:** **Given** SimulationState is Countdown or Racing and display FPS remains below 30 for 3 continuous seconds, **When** performance protection evaluates, **Then** Simulation emits `PerformanceReduced { severity: Reduced, observedFps }` without changing FIXED_DT or Time.timeScale and HUD shows a non-blocking warning.
- **AC-7.6a:** **Given** SimulationState is Idle, Loading, Paused, Finished, or Results, **When** display FPS remains below 30 for 3 continuous seconds, **Then** PerformanceReduced is not emitted and both sustained-FPS timers remain at 0.
- **AC-7.7:** **Given** FPS remains below 15 for another continuous 3 seconds after PerformanceReduced, **When** performance protection evaluates, **Then** Simulation enters Paused with reason Performance and HUD exposes Resume and Return to Menu.
- **AC-7.7a:** **Given** PerformanceReduced is active, **When** the player resumes and FPS is at or above 30, **Then** both sustained-FPS timers reset to 0 and the reduced state clears.
- **AC-7.7b:** **Given** PerformanceReduced is active, **When** Simulation enters Finished, Results, or Loading, **Then** both sustained-FPS timers reset to 0, the reduced state clears, and HUD removes its warning.
- **AC-7.7c:** **Given** PerformanceReduced is active, **When** the player resumes and FPS remains below 30, **Then** the sustained-FPS timers and reduced state persist so protection can re-trigger.
- **AC-7.7d:** **Given** PerformanceReduced is active, **When** FPS remains at or above 30 for 3 continuous seconds without a pause, **Then** Simulation restores VFX/render quality, clears the warning, and resets both sustained-FPS timers; any frame below 30 resets the recovery timer.
- **AC-7.7e:** **Given** PerformanceReduced has cleared after automatic recovery, **When** FPS subsequently remains below 30 for 3 continuous seconds, **Then** the below-30 timer re-arms from 0 and Simulation emits PerformanceReduced again.
- **AC-7.7f:** **Given** any sustained-FPS or performanceRecoveryTimer is non-zero, **When** Simulation enters Idle, Loading, Finished, or Results, **Then** all performance timers reset to 0 and the reduced state clears.
- **AC-7.8:** **Given** Input System reports `NoInputDevice` at a tick boundary, **When** Simulation builds input, **Then** it consumes zeroed Accelerate, Brake, and Steer plus `inputAvailability = NoInputDevice` until an available scheme returns.
- **AC-7.9:** **Given** the active input scheme changes during Racing, **When** the next capture occurs, **Then** the next SimulationInput uses the new active scheme without interrupting the tick loop.
- **AC-7.10:** **Given** `Physics.Simulate(FIXED_DT)` throws, **When** Simulation handles the exception, **Then** it freezes authoritative state, logs the error, and exposes retry without executing another tick; retry restarts Countdown at `countdownRemainingTicks = 300` if the exception occurred during Countdown, otherwise reloads the current race from its start.

## Open Questions

- **Ghost Recording snapshot format:** **Deferred to Alpha.** MVP captures and discards only the in-memory recordable SimulationInput and Pause-edge streams; it stores no corrective state snapshots.
- **WebGL conditional compilation:** **Deferred to platform optimization.** MVP simulation contracts remain platform-neutral.
