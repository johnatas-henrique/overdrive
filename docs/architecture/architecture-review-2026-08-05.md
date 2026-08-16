# Architecture Consistency Review — ADR-0016 and ADR-0017

> Date: 2026-08-05  
> Mode: `/architecture-review consistency`  
> Focus: ADR-0016 and ADR-0017  
> Verdict: **FAIL**

## Scope and Method

This is a formal consistency-only architecture review. All 17 ADRs in
`docs/architecture/` were read and compared pairwise. The review also read
`docs/architecture/architecture.md` and
`docs/framework/technical-preferences.md` where they define architecture
contracts that ADR-0016 and ADR-0017 claim to amend or supersede.

The L0 scan found no literal `## Summary` section in the ADR or GDD corpus.
`docs/consistency-failures.md` does not exist, so there was no prior conflict
ledger to incorporate.

This consistency mode does not extract GDD technical requirements, build a
GDD-to-TR traceability matrix, audit engine APIs, or assess master-architecture
coverage. It must not be interpreted as a replacement for a future `full`
architecture review.

## Repository State

- `adr-0016-multiplayer-sdk-deferral-and-boundary.md` and
  `adr-0017-network-simulation-driver-interface-and-beta-canonical-state-model.md`
  are untracked worktree files at review time.
- Related multiplayer GDD files are modified in the worktree.
- The review does not infer whether those GDD modifications already apply
  ADR-0017's listed amendments; that requires a GDD-inclusive review.

## Pairwise Comparison Coverage

All 136 unique ADR pairs were compared:

| Pair group | Count |
|---|---:|
| ADR-0001 through ADR-0008, internal pairs | 28 |
| ADR-0001 through ADR-0008 against ADR-0009 through ADR-0017 | 72 |
| ADR-0009 through ADR-0017, internal pairs | 36 |
| **Total** | **136** |

## Blocking Findings

### B1. ADR-0017 rollback step numbers contradict the canonical tick pipeline

**Severity:** HIGH  
**Documents:** ADR-0006, ADR-0017, `architecture.md`

ADR-0017 describes rollback as re-running “Step 4 (input replay),” “Step 8
(readout),” and “Step 9 (contact evaluation)”
(`adr-0017-network-simulation-driver-interface-and-beta-canonical-state-model.md:75`).

The accepted canonical pipeline instead defines:

| Canonical step | Operation |
|---:|---|
| 4 | Decrement Countdown |
| 6 | Apply Vehicle Physics forces |
| 7 | `Physics.Simulate(FIXED_DT)` |
| 8 | GO grid-lock release |
| 9 | `VehiclePhysics.ReadCarState()` |
| 11 | Increment counters |
| 12 | Publish snapshot |

Sources: `adr-0006-fuel-tire-state-ownership-and-tick-timing.md:89-105`,
`architecture.md:241-257`.

**Impact:** a Beta implementation can replay lifecycle operations that must not
re-run, omit the actual readout, or attach rollback behavior to the wrong phase.

**Required correction:** replace the incorrect numeric mapping with exact
canonical operation names, or remap the rollback subset to the accepted
14-step pipeline.

### B2. Coherence is both a committed architecture choice and a deferred candidate

**Severity:** HIGH  
**Documents:** ADR-0016, `technical-preferences.md`, `architecture.md`

The technical preferences declare Coherence 2.1 as the multiplayer SDK, specify
60 Hz bidirectional networking, prediction/rollback, and CloudStorage ghost
storage (`technical-preferences.md:12,60`). The master architecture calls
Coherence integration defined for Beta and names Coherence CloudStorage
(`architecture.md:213,321`).

ADR-0016 instead declares that no SDK is selected for MVP or Alpha and records
Coherence as a Tier 3 candidate with a 30 Hz cap
(`adr-0016-multiplayer-sdk-deferral-and-boundary.md:50,71`).

**Impact:** the project has two incompatible authorities for network SDK and
Alpha ghost-storage strategy. ADR-0017 cannot make a mechanical SDK choice
while the current authority documents disagree.

**Required correction:** choose one authority before ADR-0016 is accepted:

1. preserve SDK deferral and remove Coherence as an approved SDK/backend;
2. retain Coherence as the chosen SDK and revise ADR-0016 accordingly; or
3. retain Coherence only as a non-binding research candidate.

### B3. Neither ADR owns the SDK-selection decision consistently

**Severity:** MEDIUM  
**Documents:** ADR-0016, ADR-0017

ADR-0016 says that the SDK choice will be made in ADR-0017
(`adr-0016-multiplayer-sdk-deferral-and-boundary.md:50`). ADR-0017 says SDK
selection and ratification are deferred until Beta start
(`adr-0017-network-simulation-driver-interface-and-beta-canonical-state-model.md:4`).

**Impact:** neither document becomes the ratified SDK-selection decision.

**Required correction:** either make ADR-0017 select the SDK, rename it as an
interface-only ADR and name a future selection ADR, or revise ADR-0016 to
state that ADR-0017 never selects an SDK.

### B4. ADR-0016 contains future-dated evidence and an unresolved transport claim

**Severity:** MEDIUM  
**Document:** ADR-0016

ADR-0016 claims WebSocket/WSS browser transport was “verified 2026-08-06”
(`adr-0016-multiplayer-sdk-deferral-and-boundary.md:40`). The ADR date and this
review date are 2026-08-05, so that verification is future-dated and cannot
support the proposed decision. The same ADR says that it deliberately does not
resolve WebGL transport finally (`:57`).

**Required correction:** remove or redraft the future-dated assertion as a
Beta verification requirement, and keep the transport status consistently
deferred until evidence exists.

### B5. ADR-0017 defines two incompatible AC-CP2 windows

**Severity:** MEDIUM  
**Document:** ADR-0017

ADR-0017 defines a 10-tick window at lines 70 and 118, but cites AC-CP2 as a
12-tick drop at lines 128 and 150.

**Impact:** packet-loss behavior has no single implementation or validation
target.

**Required correction:** choose one authoritative window and synchronize every
reference, acceptance criterion, and test plan.

## Unresolved Integration Contracts

These are not literal contradictions, but each blocks implementation readiness.

| ID | Issue | Evidence | Required resolution |
|---|---|---|---|
| U1 | Rollback versus forward-only pit state | ADR-0017 excludes Fuel/Tire, Pit Stop and RSM from re-simulation while re-running physics/readout (`adr-0017:75`). Pit service is carried by `PitServiceCommand` in `TickStartSnapshot` (`adr-0011:89-104,116-122`). | Define whether `PitState`, `PitServiceCommand`, and pit presentation are restored, frozen, excluded, or re-derived during rollback. |
| U2 | Remote-car presentation cadence | Camera/VFX assumes two 60 Hz tick snapshots (`adr-0010:47-57`); ADR-0017 specifies 5 Hz default / 10 Hz divergence snapshots (`adr-0017:51,116`). | Define the remote interpolation, correction smoothing, and consumer contract before Beta implementation. |
| U3 | Rollback state source/schema | ADR-0002 uses `VehicleSimState.Velocity`; ADR-0017 introduces `SimulationRollbackState.linearVelocity` without declaring a mapping (`adr-0002:108-122`, `adr-0017:75`). | Define source data, field names, serialization layout, and ownership. |
| U4 | Network input/ghost relation | Ghost input is 12 bytes/tick; network input is 14 bytes with flags (`adr-0008:41,91-94`, `adr-0017:51,78,141`). | State explicitly that the ghost payload is the 12-byte subset and define all network flag bits. |
| U5 | Acceptance TR set mismatch | ADR-0016 requires TR-multiplayer-001/004/005; ADR-0017 also adds 002 (`adr-0016:153`, `adr-0017:153`). | Declare one shared acceptance set. |
| U6 | Stale ADR title | ADR-0016 enables “Network SDK Selection and Simulation Architecture Amendment”; ADR-0017 has a different title (`adr-0016:25`, `adr-0017:1`). | Update the cross-reference. |

## Pre-existing Architecture Debt

The following conflicts predate ADR-0016/0017 and must not be attributed to
the new documents. They remain relevant because network serialization and
rollback consume several shared contracts.

| Severity | Documents | Conflict |
|---|---|---|
| Medium | ADR-0002 ↔ ADR-0006 | ADR-0002 rejects `ForceMode.Acceleration`; ADR-0006 describes it as the governing stance. |
| Low | ADR-0001 internal | Prose says 13-step pipeline; canonical list has 14 steps. |
| Low | ADR-0009 ↔ ADR-0011 | Published snapshot content differs, affecting future snapshot serialization. |
| Medium | ADR-0009 ↔ ADR-0013 | Qualifying AI-time dependency/ownership is circular in documentation. |
| Medium | ADR-0010 ↔ ADR-0011 | `PitPhase`, `PitServicePhase`, `PitExiting`, and `Exiting` vocabulary diverges. |
| Medium | ADR-0012 ↔ ADR-0015 | `CarAudioProfile.Cylinders` versus `engineCylinders`. |
| Medium | ADR-0014 ↔ ADR-0015 | HUD reads `CarDefinitionData.teamColor`; ADR-0015 does not define that field. |

The master architecture additionally contains stale camera, HUD, audio, VFX,
and networking statements that diverge from accepted ADRs. The Coherence
contradiction is the only one that blocks ADR-0016/0017 directly in this review.

## Dependency Order

The declared dependency graph is acyclic:

```text
Foundation: ADR-0001
Layer 1:    ADR-0002, ADR-0003, ADR-0004, ADR-0016
Layer 2:    ADR-0005, ADR-0006, ADR-0008, ADR-0017
Layer 3:    ADR-0007, ADR-0009, ADR-0010, ADR-0012
Layer 4:    ADR-0011, ADR-0013, ADR-0014
Layer 5:    ADR-0015
```

No declared dependency cycle was found.

## Required Future ADRs

1. **Before Beta:** an accepted amendment or dedicated ADR defining remote-car
   interpolation and the rollback treatment of forward-only systems.
2. **Before Alpha ghost sharing:** a dedicated Alpha Cloud Storage, identity,
   quota, and ownership ADR. ADR-0008 and ADR-0016 defer this boundary but do
   not define it.

## Verdict: FAIL

ADR-0016 and ADR-0017 must not be accepted in their current form. The blocking
issues are the wrong rollback step mapping, contradictory Coherence authority,
undefined SDK-selection owner, future-dated transport evidence, and the
10-tick/12-tick AC-CP2 contradiction.

The multiplayer deferral strategy itself is not rejected. The current proposed
documents are rejected only as an internally consistent, implementation-ready
architecture specification.
