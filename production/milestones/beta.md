# Milestone: Beta

## Overview

- **Target Date**: TBD
- **Type**: Beta
- **Duration**: TBD
- **Number of Sprints**: TBD

## Milestone Goal

Add real-time multiplayer racing on top of the completed Alpha: up to 16 players race together via a real-time racing SDK (rooms, transport, input delivery, clock alignment, prediction, reconciliation). Beta separately selects a real-time racing SDK (ADR-0016) that must satisfy the project-owned driver contract and reconciliation boundary defined by ADR-0017. The SDK operates as a guest of the manual simulation accumulator.

## Success Criteria

- [ ] A real-time racing SDK is selected via a new/amended Accepted ADR, evaluated against ADR-0017's integration contract using current primary sources and an empirical network/performance prototype (ADR-0016:96-101, ADR-0017 Migration Plan)
- [ ] Selected SDK operates as a guest of the manual accumulator — it never calls `Physics.Simulate`, owns no `FixedUpdate`, and never writes `SimulationState` (ADR-0017 D2)
- [ ] `INetworkSimulationDriver` is implemented and satisfies the driver boundary (ADR-0017 D2)
- [ ] Input-authoritative prediction with owner-published kinematic reconciliation works — each owner publishes only its car's corrective state; remote clients converge on it (ADR-0017 D1)
- [ ] `InputReliabilityPolicy` is established from empirical PC and WebGL measurements, not hard-coded: clock alignment, input delay, jitter buffer, redundancy, `W_drop`, `W_rollback`, held-last, timeout (ADR-0017 D3)
- [ ] Rollback pipeline works: `SimulationRollbackState` restores all 16 cars, re-simulates the named replay subset once per frame, and never re-runs Fuel/Tire/Pit Stop/RSM/AI/counters/Ghost Recording (ADR-0017 D4)
- [ ] Rollback CPU cost measured and within the accepted simulation budget (p95/max) — no fixed car-count estimate accepted as final (ADR-0017 D4)
- [ ] Disconnect/reconnect lifecycle works: at most 5 reconnect attempts with exponential backoff, resync, then AI takeover — Simulation never pauses/rewinds for a reconnecting slot (ADR-0017 D7)
- [ ] 16-player rooms race without a connection slot left empty (AI takeover path, ADR-0017 D7)
- [ ] WebGL transport viability confirmed with the selected SDK (ADR-0016:52, Beta criterion)
- [ ] Camera/HUD correction contract defined and tested — no visual pop above the measurable limit (ADR-0017 D5)

## Feature List

### Must Ship (Milestone Fails Without These)

| Feature | Design Doc | Owner | Sprint Target | Status |
|---------|-----------|-------|--------------|--------|
| Real-time racing SDK selection (ADR) | ADR-0016, ADR-0017 | technical-director | TBD | Deferred — decision open |
| `INetworkSimulationDriver` implementation | design/gdd/multiplayer-architecture.md | multiplayer-architecture epic | TBD | Deferred — post-Alpha |
| Rooms, transport, relay topology | design/gdd/multiplayer-architecture.md | multiplayer-architecture epic | TBD | Deferred — SDK-dependent |
| Prediction + reconciliation | ADR-0017 D1 | multiplayer-architecture epic | TBD | Deferred |
| Reconnect lifecycle | ADR-0017 D7 | multiplayer-architecture epic | TBD | Deferred |

### Should Ship (Planned but Cuttable)

| Feature | Design Doc | Owner | Sprint Target | Cut Impact | Status |
|---------|-----------|-------|--------------|-----------|--------|
| (none defined yet) | | | | | |

### Stretch Goals (Only if Ahead of Schedule)

| Feature | Design Doc | Owner | Value Add |
|---------|-----------|-------|----------|
| (none defined yet) | | | |

## Open Decisions (must close before Beta implementation)

| Decision | Depends On | Current State |
|---------|-----------|---------------|
| Real-time SDK selection | ADR-0017 contract + fresh primary-source research + empirical prototype | **TBD — deferred (ADR-0016, ADR-0017)** |
| `InputReliabilityPolicy` numeric values (W_drop, W_rollback, jitter buffer, etc.) | SDK + measured PC/WebGL network conditions | **TBD — measured, not hard-coded (ADR-0017 D3)** |
| Rollback CPU budget (car count, p95/max) | measured prototype | **TBD — empirical (ADR-0017 D4)** |
| Camera/HUD correction criteria | design work before Beta implementation | **TBD (ADR-0017 D5)** |

## Quality Gates

| Gate | Threshold | Measurement Method |
|------|-----------|-------------------|
| SDK selection ADR | Accepted, evaluated against ADR-0017 integration contract | ADR + empirical network/performance prototype (ADR-0016, ADR-0017 Validation Criteria) |
| Driver is a guest | Never calls Physics.Simulate, owns no FixedUpdate, never writes SimulationState | Code review (ADR-0017 D2) |
| Reliability policy measured | W_drop/W_rollback/jitter/input-delay/redundancy/timeout documented from measurements | Empirical PC + WebGL measurement (ADR-0017 D3) |
| Rollback cost in budget | p95/max within accepted simulation budget | Performance profiling (ADR-0017 D4) |
| No MVP/Alpha build links a real-time SDK | 0 links | Build inspection (ADR-0017 Validation Criteria) |

## Risk Register

| Risk | Probability | Impact | Mitigation | Owner | Status |
|------|------------|--------|-----------|-------|--------|
| Candidate SDK fails guest/reliability/WebGL requirements | Medium | Rejection → another evaluation | Reject rather than weaken Simulation authority (ADR-0017 D7) | technical-director | TBD |
| PhysX reconciliation shows visual pops | Medium | Player-visible correction | Camera/HUD correction contract with explicit limit (ADR-0017 D5, Risk) | technical-director | TBD |
| Input redundancy exceeds bandwidth budget | Medium | Bandwidth overrun | Measure packet format and AC-CP3 together (ADR-0017 Risk) | technical-director | TBD |

## Dependencies

### Internal Dependencies

| Feature | Depends On | Owner of Dependency | Status |
|---------|-----------|-------------------|--------|
| Real-time racing | Alpha complete (ghost sharing), MVP simulation | Alpha milestone | Not started |

### External Dependencies

| Dependency | Provider | Status | Risk if Delayed |
|-----------|---------|--------|----------------|
| Real-time racing SDK | **TBD — not selected (ADR-0016/0017)** | Deferred | Real-time racing blocked until selection |
| WebGL transport | **TBD — evaluated with selected SDK** (ADR-0016:52) | Deferred | WebGL racing blocked |

## Review Schedule

| Date | Review Type | Attendees |
|------|-----------|-----------|
| TBD | SDK selection review | Producer, technical-director |
| TBD | Milestone review | Full team |
