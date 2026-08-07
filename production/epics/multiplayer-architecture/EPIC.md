# Epic: Multiplayer Architecture

> **Layer**: Foundation
> **GDD**: design/gdd/multiplayer-architecture.md
> **Architecture Module**: Multiplayer Architecture (ADR-only module in MVP — systems-index.md Foundation design layer; architecture.md implementation layer "Feature, ADR-only in MVP")
> **Status**: Ready (constraint epic — no runtime network implementation in MVP)
> **Stories**: Not yet created — run `/create-stories multiplayer-architecture`

## Overview

Multiplayer Architecture is a future-phase networking layer that in MVP contributes only the architectural boundary that keeps gameplay systems independent from transport types and network runtime state. This is a **constraint epic**: MVP links no online-services or real-time SDK, creates no network traffic, and forbids gameplay dependence on network runtime state (multiplayer-architecture.md:12-13, 21-28). Its MVP deliverable is one story (TR-multiplayer-001) plus permanent isolation guardrails: assembly segregation (no transport types in gameplay assemblies), zero SDK imports, and the ADR-0017 seam published as a project-owned interface (`INetworkSimulationDriver`: `SubmitInputs`, `SerializeSnapshot`, `Rollback`, `GetPredictedInput`, `RemoteInputsReceived`) in an isolated assembly with no provider implementation. Alpha (identity + durable ghost storage via ADR-0016) and Beta (real-time SDK via ADR-0017 — guest of the manual accumulator, input-authoritative prediction with owner-published kinematic reconciliation, 14-byte `NetworkInput`, empirically measured `W_drop`/`W_rollback`, reconnect with 5 exponential-backoff attempts and AI takeover) are declared as future-phase criteria in the GDD and its ADRs; they become stories only when those phases are planned.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0016: Multiplayer SDK Deferral and Boundary | MVP selects no provider; Alpha selects an online-services provider for identity + durable ghost storage; Beta separately selects a real-time SDK; the two selections are independent | HIGH |
| ADR-0017: Network Simulation Driver Interface and Beta Canonical State Model | `INetworkSimulationDriver` guest of the manual accumulator (never owns physics stepping or `SimulationState`); input-authoritative prediction with owner-published kinematic reconciliation; rollback domain boundary (kinematic-only re-sim; Fuel/Tire/Pit/RSM/AI/PCG32/Ghost forward-only) | HIGH |
| ADR-0001: Manual Simulation Authority and Determinism Boundary | The future network driver may replace the local driver without changing `SimulationInput`, `CarState`, tick, or state contracts; no cross-machine determinism guarantee in MVP | HIGH |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage | Phase |
|-------|-------------|--------------|-------|
| TR-multiplayer-001 | MVP links no online-services or real-time SDK and creates no network traffic | ADR-0016 ✅ | **MVP — the sole MVP story + isolation DoD** |
| TR-multiplayer-002 | Alpha selects identity and durable ghost storage independently from Beta's real-time SDK | ADR-0016 ✅ | Alpha — declared criteria |
| TR-multiplayer-003 | The Beta driver is a guest of the manual accumulator and never owns physics stepping or `SimulationState` | ADR-0017 ✅ | Beta — declared criteria |
| TR-multiplayer-004 | Beta's candidate `NetworkInput` is a fixed 14-byte versioned packet distinct from the 12-byte ghost record | ADR-0017 ✅ | Beta — declared criteria |
| TR-multiplayer-005 | Real-time play uses input prediction with owner-published corrective kinematic state; local PhysX is not canonical | ADR-0001, ADR-0017 ✅ | Beta — declared criteria |
| TR-multiplayer-006 | Clock alignment, input delay, jitter buffer, redundancy, `W_drop`, `W_rollback`, held-last, and timeout are empirically selected | ADR-0017 ✅ | Beta — measured parameters, declared criteria |
| TR-multiplayer-007 | Rollback replays vehicle kinematics and recorded input while Fuel, Tire, Pit, RSM, AI RNG, counters, and Ghost remain forward-only | ADR-0017 ✅ | Beta — declared criteria (ADR-0017 rollback-domain boundary) |
| TR-multiplayer-008 | Beta reconnect lifecycle includes five exponential-backoff attempts, RECONNECTING behavior, resynchronization, and AI takeover after permanent failure | ADR-0017 ✅ | Beta — declared criteria (reconnect never pauses the race) |

**Untraced requirements**: None — 8/8 covered by Accepted ADRs.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/multiplayer-architecture.md` are verified
- TR-multiplayer-001 is verified: zero network SDK linked, zero network traffic, zero transport-type imports in gameplay assemblies
- The isolation guardrails hold across every other MVP story (verified as cross-epic DoD items): no gameplay assembly imports network runtime state; `INetworkSimulationDriver` seam exists with no provider implementation
- Alpha/Beta TRs (002-008) remain declared criteria — their implementation stories are created only when the respective phase is planned, gated by ADR-0016/0017 selection criteria

## Next Step

Run `/create-stories multiplayer-architecture` to break this epic into implementable stories (MVP: constraint + isolation verification; Alpha/Beta stories deferred to their phases).
