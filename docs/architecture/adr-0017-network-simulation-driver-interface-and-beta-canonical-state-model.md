# ADR-0017: Network Simulation Driver and Beta Reconciliation Boundary

## Status
Accepted (Beta scope). This ADR selects no real-time SDK. The rollback isolation mechanism (D4) was decided 2026-08-05: full kinematic restore of all simulated cars per replay frame.

## Date
2026-08-05

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Beta real-time networking boundary |
| **Knowledge Risk** | HIGH. The concrete Beta SDK and its APIs remain unselected. |
| **References Consulted** | ADR-0001, ADR-0005, ADR-0006, ADR-0008, ADR-0016, `multiplayer-architecture.md`, `simulation-architecture.md` |
| **Post-Cutoff APIs Used** | None. No real-time SDK is adopted. |
| **Verification Required** | Before Beta implementation, measure the selected SDK under PC and WebGL network conditions and validate every reliability/performance threshold in this ADR. |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001, ADR-0005, ADR-0006, ADR-0008, ADR-0016 |
| **Enables** | Beta real-time SDK evaluation and implementation |
| **Blocks** | No MVP or Alpha behavior |
| **Ordering Note** | ADR-0016 separates Alpha online-services selection from Beta real-time SDK selection. This ADR defines the project contract that a Beta SDK must satisfy. |

## Context

### Problem Statement

Beta real-time racing needs a project-owned boundary between Simulation and a
future networking driver. The boundary must preserve manual simulation
authority, prevent local PhysX from becoming cross-machine canonical truth, and
define how late remote input is reconciled without advancing forward-only race
domains twice.

This ADR does not select a transport, relay, room provider, or vendor. It
defines the contract and the decisions that the eventual Beta implementation
must satisfy.

### Constraints

- The manual accumulator and its canonical 14-step tick pipeline remain
  Simulation's authority.
- `Physics.Simulate(FIXED_DT)` is called only by Simulation.
- Local PhysX is not cross-machine deterministic (ADR-0001).
- MVP gameplay systems import no transport or provider runtime types.
- Ghost Recording's continuous `SimulationInput` stream remains 12 bytes/tick;
  network metadata must not silently alter that file format.
- Fuel, Tire, Pit Stop, RSM, AI, countdown, counters, and lifecycle progression
  are forward-only domains.

## Decision

### D1 — Canonical state and corrective reconciliation

The Beta network contract is input-authoritative prediction with owner-published
kinematic reconciliation. Each owner publishes only its car's corrective
kinematic state; remote clients use received input history for best-effort
prediction and converge to corrective state when local PhysX diverges.

No cross-machine PhysX determinism is claimed. A selected SDK may supply
transport, rooms, relay/server topology, and synchronization mechanics only if
it can implement this project-owned contract as a guest of Simulation.

### D2 — Network simulation driver interface

```csharp
public delegate void RemoteInputsReceivedHandler(uint simulationFrame, ReadOnlySpan<NetworkInput> inputs);

public interface INetworkSimulationDriver {
    void SubmitInputs(ReadOnlySpan<SimulationInput> localInputs, uint simulationFrame);
    int SerializeSnapshot(in PublishedSimulationSnapshot snapshot, Span<byte> destination);
    void Rollback(uint toFrame, in SimulationRollbackState state);
    NetworkInput GetPredictedInput(int carId, uint frame);
    event RemoteInputsReceivedHandler RemoteInputsReceived;
}
```

- The driver is a guest: it never calls `Physics.Simulate`, owns no
  `FixedUpdate`, and never writes `SimulationState`.
- Simulation owns published snapshots; the driver serializes only the selected
  owner-car data into caller-provided storage.
- One connection may multiplex all player streams; connection objects are not
  input parameters.
- The 14-byte `NetworkInput` transport layout must explicitly map the consumed
  12-byte `SimulationInput` and its network metadata before Beta implementation.
  Bits 0–2 are defined by the GDD packet table, Bit 3 is reserved, Bit 4 is
  `InputAvailability`, and Bits 5–7 remain reserved until explicitly defined.

### D3 — Input reliability is measured, not hard-coded

No fixed 10-tick or 12-tick missing-input window is accepted by this ADR.
Before Beta implementation, the selected driver must define an
`InputReliabilityPolicy` from empirical PC and WebGL measurements:

| Field | Required rule |
|---|---|
| Clock alignment | Relay/room frame mapping, synchronization cadence, drift correction, and maximum clock uncertainty are explicit. |
| Input delay | Any intentional input delay is explicit and distinct from packet-loss handling. |
| Jitter buffer | Depth and adaptation policy are explicit. |
| Redundancy | Packets carry sequenced, acknowledged, sliding input history so isolated loss is repaired by later packets. |
| `W_drop` | Inclusive maximum acceptable remote input age; derived from p99 arrival age, jitter, and clock uncertainty. |
| `W_rollback` | Must be greater than or equal to `W_drop` and remain inside the measured rollback CPU budget. |
| Held-last | Repeats the last consumed remote command only within the defined missing-input policy; it is never AI takeover. |
| Timeout | Disconnect/reconnect behavior is separate from `W_drop`; a missing-input window is not a disconnect timer. |

AC-CP2 becomes parameterized: an input arriving `W_drop + 2` ticks late is
discarded, held-last behavior engages only when input age exceeds `W_drop`, and
presentation must meet the approved correction metric. The numeric value is
recorded only after Beta measurement.

### D4 — Rollback pipeline and forward-only boundary

`SimulationRollbackState` contains per-car corrective kinematic state for
**all 16 simulated cars**: position, rotation, `linearVelocity`, and
`angularVelocity`. Simulation invokes `driver.Rollback` only to reset
driver-side prediction state, then Simulation restores **every car** to the
captured pre-replay kinematic state and executes this named replay subset:

```text
resolve recorded remote inputs
→ apply Vehicle Physics forces
→ one whole-scene Physics.Simulate(FIXED_DT)
→ VehiclePhysics.ReadCarState
→ publish corrective remote-car state
```

Local and AI cars are restored and re-simulated with their original inputs;
local PhysX determinism (ADR-0001) guarantees their resulting state is
unchanged, so **no car advances more than once per replay frame**. The CPU
cost of the full restore is a Beta empirical measurement, but the mechanism
is decided and SDK-independent.

Rollback never re-runs raw input capture, countdown decrement, Fuel, Tire, Pit
Stop, RSM, counters, Ghost Recording, or AI evaluation. AI uses cached input;
its counter-based PCG32 derivation (ADR-0009) is not part of
`SimulationRollbackState`.

| Domain | Rollback behavior |
|---|---|
| All simulated vehicle kinematics and recorded remote inputs | Restore and replay |
| Vehicle Physics | Re-simulate whole scene once per replay frame |
| Fuel, Tire, Pit Stop, RSM, countdown, counters | Forward-only; never re-run |
| AI | Cached inputs only; counter-based RNG, never advanced |
| Ghost Recording | Never capture replay ticks |
| HUD, map, camera, VFX | Consume published corrective state; never simulate or advance gameplay |

Rollback spans the remote cars whose late input is being reconciled. The exact
car count and p95/max cost are Beta empirical measurements; no 16-car or
15-car cost estimate is accepted as a final budget.

### D5 — Presentation handoff

Simulation publishes ordered corrective remote-car state through its existing
LateUpdate interpolation path. Presentation consumes that path and owns only
additional correction smoothing; it never invokes simulation, replays domain
state, or changes input history. Before Beta implementation, the Camera and HUD
contracts must define correction cadence, interpolation delay, maximum per-frame
visible correction, and the measurable meaning of “no visual pop.”

### D6 — Manual accumulator amendment

The driver integrates with the manual accumulator as a guest. Focus-loss,
performance gating, Pause consumption, countdown, and the canonical 14-step
pipeline remain Simulation authority. A future SDK evaluation must prove that
its loop, clock, and transport model can operate under this ownership model.

### D7 — Disconnect and reconnection lifecycle (TR-multiplayer-008)

Disconnection is a **connection-session event**, not a missing-input condition:
`W_drop`/held-last cover input aging, while a disconnect is declared when the
transport session is lost or an explicit heartbeat/ack deadline passes. The
reconnect lifecycle contract:

| Stage | Required rule |
|---|---|
| Detection | A slot is considered disconnected when the transport session is lost or the connection-level timeout passes. The missing-input policy (`W_drop`, held-last) is never a disconnect timer. |
| Reconnect attempts | The Beta driver makes at most **five** reconnect attempts with **exponential backoff** (attempt N waits `base × 2^N` with a configured cap). A slot may not ping the provider faster than the retry policy allows. |
| Resynchronization | On successful reconnect, the driver performs the room/relay resync defined by its `InputReliabilityPolicy` (clock re-alignment, re-established sequence space) before normal play resumes. |
| AI takeover | If the five attempts are exhausted, the slot is transferred to **AI control** for the remainder of the session. AI uses the existing cached-input path (ADR-0009); the slot is never left empty and never re-enters held-last. |
| Re-entry | A reconnected slot resumes with the same corrective-kinematics path as any remote car; no ghost-like playback is performed. |

Ownership: the disconnect lifecycle is a **Beta driver responsibility** (it owns
the transport session), constrained by this contract. Simulation never pauses or
rewinds the race for a reconnecting slot; the AI takeover is seamless to the
tick pipeline because it uses the same cached-AI-input path.

## Alternatives Considered

### Alternative 1: Select a real-time SDK now
- **Description**: Choose a vendor and design the interface around its APIs.
- **Pros**: Concrete integration and known transport behavior.
- **Cons**: Premature before Beta, couples project architecture to changing
  package facts, and confuses Alpha online services with real-time racing.
- **Rejection Reason**: ADR-0016 defers the selection to the decision point.

### Alternative 2: State interpolation only
- **Description**: Receive remote states and interpolate without input history
  or reconciliation.
- **Pros**: Simpler implementation.
- **Cons**: Cannot meet responsive remote-racing and AC-CP1 requirements.
- **Rejection Reason**: The project requires a path for late input and
  corrective reconciliation.

### Alternative 3: Let the selected SDK own the game loop
- **Description**: Permit a package runner to own physics stepping and state.
- **Pros**: May match a package's default architecture.
- **Cons**: Violates manual simulation authority and risks duplicate or
  competing physics execution.
- **Rejection Reason**: Simulation remains the sole tick/physics authority.

## Consequences

### Positive
- Beta SDK selection is evaluated against a stable project contract.
- Alpha online-services selection remains independent.
- Rollback cannot double-consume race resources or re-trigger lifecycle events.
- Input loss is handled by a measurable reliability policy rather than an
  arbitrary tick count.

### Negative
- Beta requires empirical latency, jitter, loss, and rollback-cost measurement.
- A candidate SDK may fail the guest, reliability, or WebGL requirements.
- Camera/HUD correction criteria must be designed before Beta implementation.

### Risks
- PhysX reconciliation may still require visually noticeable corrections; the
  Beta presentation contract must set and test an explicit limit.
- Input redundancy can exceed bandwidth budgets; packet format and AC-CP3 must
  be measured together.
- A provider may not expose required clock or reliability control; reject it
  rather than weakening Simulation authority.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|---|---|---|
| multiplayer-architecture.md | SDK-agnostic integration | Defines a project-owned driver boundary without selecting a vendor |
| multiplayer-architecture.md | AC-CP1 | Requires late-input reconciliation and corrective state |
| multiplayer-architecture.md | AC-CP2 | Parameterizes the drop test from measured `W_drop` |
| multiplayer-architecture.md | Reconnect policy (TR-multiplayer-008) | Defines five exponential-backoff attempts, resync, and AI takeover in D7 |
| multiplayer-architecture.md | Input packet format | Separates 12-byte ghost input from two-byte network metadata |
| simulation-architecture.md | No local-PhysX canonical state | Uses owner-published kinematic reconciliation |
| ghost-recording.md | Ghost stream ownership | Excludes replay ticks from Ghost Recording capture |

## Performance Implications
- **MVP/Alpha:** zero real-time networking cost.
- **Beta:** choose the smallest reliability windows satisfying p99 arrival and
  CPU constraints; validate p95 and maximum replay cost against the accepted
  simulation budget before implementation.

## Migration Plan

None in MVP or Alpha. At Beta, select a real-time SDK through an Accepted ADR,
implement this interface, establish `InputReliabilityPolicy` from measurements,
and amend dependent GDD/camera contracts before shipping networked racing.

## Validation Criteria
- No MVP or Alpha build links a real-time SDK or imports transport types.
- Selected Beta SDK operates as a guest of the manual accumulator.
- `W_drop`, `W_rollback`, jitter buffer, input delay, redundancy, and timeout
  are measured and documented before implementation.
- AC-CP1 and parameterized AC-CP2 pass under documented PC and WebGL network
  conditions.
- Rollback never advances Fuel, Tire, Pit Stop, RSM, AI, counters, or Ghost
  Recording twice.

## Related Decisions
- ADR-0001 (manual simulation authority and determinism boundary)
- ADR-0005 (input processing ownership)
- ADR-0006 (Fuel/Tire tick ownership)
- ADR-0008 (Ghost Recording data format)
- ADR-0016 (Alpha services / Beta real-time selection boundary)
