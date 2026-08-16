# ADR-0018: Race Session Manager Authority — Ranking, Lap Authority, and Finish Resolution

## Status

Accepted

## Date

2026-08-05

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Core / Session |
| **Knowledge Risk** | LOW — pure C# logic, no engine-specific APIs |
| **References Consulted** | `design/gdd/race-session-manager.md`, `docs/architecture/architecture.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | EditMode unit tests for ranking tie-breaks, lap-boundary wrap, and pace-only projection |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (Simulation captures PostFinishSnapshot at lifecycle transition; Simulation is sole writer of SimulationState). ADR-0007 (Track provides `CrossedLapBoundary`, spline mapping, pitSpline → racingSpline progress mapping, 90% distance gate data) |
| **Enables** | HUD (position/lap readout), Audio (lap/position stings), AI Rival (pit projection reads LapCompleted), Results screen (resolved finish order), Grid & Start (GridAssignment creation) |
| **Blocks** | Results presentation, terminal flow, and any consumer of position ranking or finish order |
| **Ordering Note** | Created in response to architecture-review-2026-08-05-v4 coverage gaps TR-rsm-001/002/003 — ranking, lap authority, and FinishOrderResolver lacked a dedicated ADR decision |

## Context

RSM owns race-state tracking (lap count, position, race time, events) and result resolution. Three of its contracts existed only in the GDD and the master architecture without an Accepted ADR decision: the exact position-ranking algorithm, the lap-authority composition (boundary crossing + 90% distance gate), and the FinishOrderResolver pace-only projection policy. This ADR ratifies them so implementation has a single authoritative source.

Position ranking uses spline position (where the car is on the racing surface), not totalDistance — totalDistance is anti-cut/telemetry only and never ranks live position (race-session-manager.md:50, 64-66).

## Decision

### Position Ranking (TR-rsm-001)

All 16 cars are ranked per tick by:

```
position = rank(cars) by:
  1. lapCount DESC
  2. splinePosition DESC (within same lapCount)
  3. positionEntryStep ASC
  4. carId ASC (stable tie-break)
```

- `splinePosition` is main-spline progress (0.0–1.0). On the racing surface it is the car's racing-spline projection; in pit lane it is Track's authored `pitSpline → racingSpline` mapping (race-session-manager.md:68).
- Tie tolerance: two cars with identical lapCount AND splinePosition within 0.001 tolerance — the car with the lower recorded `positionEntryStep` ranks higher; if identical, stable `carId` breaks the tie (race-session-manager.md:70).
- **Edge case — same-step finish-line crossing:** two cars crossing the finish line in the same tick — the car with the higher spline position at the previous step ranks first (race-session-manager.md:205).
- **Edge case — pit exit ahead of another car:** spline position correctly reflects physical position; the car physically ahead has higher spline position and ranks higher (race-session-manager.md:213).
- `totalDistance` is never used for live position ranking; it feeds anti-cut validation and telemetry only (race-session-manager.md:50).

### Lap Authority (TR-rsm-002)

A lap counts when BOTH conditions hold (race-session-manager.md:82-89):

1. **Boundary crossing:** the car crosses the start/finish line. Track exposes `CrossedLapBoundary(previousMappedProgress, currentMappedProgress)` — an authoritative wrap test over the main spline or the authored pit-spline mapping. It works even when one tick crosses from 0.94 to 0.01 (wrap across 1.0 → 0.0).
2. **Minimum distance:** `distanceSinceLastLap > trackLength × 0.90` — anti-cut: the car must traverse 90% of the track between boundary crossings.

Output: `LapCompleted(carId, lapNumber, lapTime)` fires when all conditions are met. Fuel and Tire independently snapshot their own per-lap deltas at this boundary; AI Rival and Pit Stop consume those owner-published values for next-lap forecasting (race-session-manager.md:89).

Ownership split:
- **Track** provides the boundary-crossing test and the 90% distance accumulator data (`totalDistance` forward-distance tracking: `max(0, mapped_progress_delta × trackLength)` with one wrap adjustment; reverse and lateral movement do not increase the anti-cut accumulator — race-session-manager.md:78).
- **RSM** owns the lap-counting rule composition (both conditions), the lap counter per car, and the `LapCompleted` event. RSM is the lap-authority owner; Track is the detection provider.

Pit lane behavior: the racing spline is the single source of truth for lap progress. Track maps every pit-spline sample to main-spline progress and exposes `CrossedLapBoundary`; the line crossing inside pit lane counts as a lap completion (race-session-manager.md:91).

### FinishOrderResolver (TR-rsm-003)

When the player crosses the finish line on `totalLaps` (or retires), Simulation captures the immutable **PostFinishSnapshot** at the finished transition and hands it to RSM once. RSM runs FinishOrderResolver once and returns `ResolvedFinishOrder { entriesByPosition[] }`; every entry carries `carId`, final classification (`Finished` or `DNF`), finish position, and final/projected time (race-session-manager.md:101).

- The resolver consumes **one** PostFinishSnapshot — a single read. It never re-runs PhysX, Fuel, Tire, Pit, collisions, or tactical AI (race-session-manager.md:101).
- Player result is locked; the resolver projects unfinished trailing AI **by pace only** (race-session-manager.md:98).
- **Expected race pace** for each unfinished AI (race-session-manager.md:103):
  - If the AI has two completed laps: `trackLength / mean(lastTwoCompletedLapTimes)`.
  - Otherwise: `trackLength / sessionTargetLapTime`, where `sessionTargetLapTime` is that AI's pre-generated qualifying time for the current track and difficulty. This fallback exists before racing begins, including when the player skips Qualifying.
- **MVP approximation:** the projection does not account for AI pit status, low fuel, or worn tires at the snapshot moment. Accepted for MVP because the projection is cosmetic — it determines only the final standing order among trailing AI for the results screen. Future phases may add pit/resource penalties (race-session-manager.md:105).
- **Forfeit:** `Forfeit` is voluntary Return to Menu before Finished; it has no final position and never invokes FinishOrderResolver (race-session-manager.md:55).
- **DNF:** DNF cars keep their classification in `ResolvedFinishOrder`; no fabricated position is created for them.

### RSM Ownership Summary (ratified)

| Contract | Owner | Consumer(s) |
|----------|-------|-------------|
| Position ranking algorithm | RSM | HUD, Track Map, Results |
| Lap counting rule (boundary + 90% gate) | RSM (rule), Track (detection data) | Fuel, Tire, AI Rival, Pit Stop via `LapCompleted` |
| FinishOrderResolver | RSM | Results, Camera (terminal presentation), Audio |
| `LapCompleted` / `PositionChanged` / `PitEntry` / `PitExit` / `RaceFinished` events | RSM | Fuel, Tire, AI, Pit Stop, HUD, Camera |
| `TransitionRequest` production | RSM | Simulation (sole state-machine writer) |
| `GridAssignment` creation | RSM | Grid & Start, Content Pipeline |

## Consequences

### Positive

- Single authoritative source for ranking, lap authority, and finish resolution — resolves TR-rsm-001/002/003 coverage gaps.
- Ranking and lap rules are pure C# — unit-testable without a scene (tie-breaks, wrap, anti-cut).
- Clear ownership split (RSM rule vs Track detection) prevents duplicate lap-counting implementations.
- Pace-only projection keeps the resolver stateless and cheap; single PostFinishSnapshot read preserves the immutable-boundary model from ADR-0001.

### Negative

- Pace-only projection ignores pit/resource state at finish — cosmetic inaccuracy for trailing AI accepted for MVP.
- Lap counting depends on Track's `CrossedLapBoundary` and 90% accumulator being correct; a Track bug silently corrupts lap counts (mitigated by Track's own ADR-0007 validation criteria).

## GDD Requirements Addressed

| GDD | Requirement |
|-----|-------------|
| race-session-manager.md | Position ranking by lapCount DESC, splinePosition DESC, positionEntryStep ASC, carId ASC |
| race-session-manager.md | Lap counts only on boundary crossing + >90% track traversal |
| race-session-manager.md | FinishOrderResolver consumes one PostFinishSnapshot and projects unfinished AI by pace only |
| race-session-manager.md | Result classification Finished/DNF/Forfeit; Forfeit never invokes resolver |
| grid-start.md | GridAssignment immutable creation by RSM |

## Validation Criteria

- [ ] EditMode test: two cars with identical lapCount and splinePosition within 0.001 tolerance resolve by positionEntryStep, then carId
- [ ] EditMode test: same-step finish-line crossing ranks the car with higher previous-step spline position first
- [ ] EditMode test: wrap crossing 0.94 → 0.01 with distanceSinceLastLap > 90% fires LapCompleted; with < 90% it does not (anti-cut)
- [ ] EditMode test: reverse movement does not increase the anti-cut accumulator
- [ ] EditMode test: FinishOrderResolver with a trailing AI at two completed laps uses mean(lastTwoCompletedLapTimes); with fewer laps uses sessionTargetLapTime
- [ ] EditMode test: Forfeit classification produces no final position and no resolver invocation

## Related Decisions

- ADR-0001: PostFinishSnapshot capture, Simulation sole SimulationState writer, Finished/Results lifecycle
- ADR-0007: Track spline, pitSpline → racingSpline mapping, CrossedLapBoundary, 90% distance gate data
- ADR-0013: Qualifying ResultKind reuses the same snapshot and resolver path (resultKind = Qualifying)

## GDD Revision Flags

None — this ADR ratifies existing GDD text; no GDD change required.

## Contract Note — Spine Step 12 Publication (2026-08-15)

Codified by improve-codebase-architecture C12 (user-approved) so the RSM epic implements
the production publish step against an explicit contract instead of test-owned behavior.
The contract, as enforced by the test-local `PublishStep`
(`Assets/tests/integration/simulation/TestSteps.cs`, spine index 11):

1. **Exactly one snapshot per executed tick** — `context.PublishSnapshot` is called exactly
   once per tick; consumers (Camera, VFX, Audio, HUD) always receive a
   `PublishedSimulationSnapshot`. Zero publications per tick is a contract violation.
2. **Terminal wins** — when the RSM consume step produced a `PostFinishSnapshot`
   (`context.TerminalSnapshot != null`), it is published verbatim with its resolved
   classification; the production step must never drop or replace a resolved terminal.
3. **Current-state fallback** — while no terminal exists, the published snapshot must
   reflect the tick's actual `SimulationState` (the test-local step fabricates a Racing
   terminal; the production RSM publishes the true current-state snapshot instead).
4. **Read-only** — the step reads context and publishes; it never mutates simulation state.

When the RSM epic ships the production step-12 implementation, it must satisfy 1-4; the
test-local fabrication is then replaced and the integration suite validates against the
real publication path.
