# Story 004: Telemetry Contracts

> **Epic**: Vehicle Physics — Feel & Telemetry
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 2.0h

## Context

**GDD**: `design/gdd/vehicle-physics.md` (§5 CarState Output, Interactions)
**Requirement**: Epic deliverable — no TR; governed by ADR-0014 (HUD data contract), ADR-0010 (camera/VFX budget), ADR-0012 (audio engine provider)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0014: HUD Data Contract and Layout (authoritative per-element data owners, explicit update cadence); ADR-0010: Camera/VFX Rendering Budget and Interpolation (interpolated snapshot consumption); ADR-0012: Audio System Architecture (procedural engine synthesis + `IEngineSoundProvider` seam)
**ADR Decision Summary**: Presentation consumers (Camera, HUD, Audio, VFX) read from the published simulation snapshot / telemetry readout — never live simulation state. Vehicle Physics owns the vehicle-derived fields; pass-through contract fields retain their authoritative owners (RSM, Fuel, Tire).

**Engine**: Unity 6000.3.22f1 | **Risk**: HIGH
**Engine Notes**: `PublishedSimulationSnapshot` (Foundation) is the consumer boundary — the telemetry adapter assembles the readout from the snapshot, not from live VP internals.

**Control Manifest Rules (this layer)**:
- Required: every HUD element has one authoritative data owner and an explicit update cadence (ADR-0014)
- Required: presentation consumes interpolated presentation state, never live simulation state
- Required: `IEngineSoundProvider` seam for audio (ADR-0012)

---

## Acceptance Criteria

*Per QL-STORY-READY 2026-08-16 (split of the original telemetry+rig story):*

- [ ] **Vehicle-owned telemetry** published: pose, velocity, velocity direction, speed, gear, RPM, throttle, slide state — assembled from completed CarState without direct consumer reads
- [ ] **Pass-through contract fields** retain authoritative owners: position/lap/rival-gap (RSM), fuel/tire (Fuel/Tire), pit-phase (Pit) — the adapter does NOT re-derive them
- [ ] **Audio seam**: `CarAudioState` built from CarState + Fuel/Tire/CarDefinition inputs; RPM and companion fields passed to `IEngineSoundProvider` unchanged (ADR-0012) — grid lock, fuel empty, pit phase, zero RPM edges
- [ ] **VFX read-only input**: `global_max_velocity` — session-wide maximum computed from the loaded car definitions at race-telemetry init; consumed read-only by VFX
- [ ] HUD field ownership + cadence verified: each HUD field comes from its authoritative owner at the documented cadence (no direct live-system access)

---

## Implementation Notes

*Derived from ADR-0014 / ADR-0010 / ADR-0012 Implementation Guidelines:*

- The telemetry adapter consumes `PublishedSimulationSnapshot` (the Foundation consumer boundary) and produces the typed readout contracts consumed by Camera/HUD/Audio/VFX epics
- `IEngineSoundProvider` is the audio seam (ADR-0012) — the Audio epic owns the synthesis implementation; this story defines `CarAudioState` and the passthrough
- `global_max_velocity` derives from the grid's car definitions (max_velocity per team) at race init — VFX reads it as immutable data (ADR-0010)
- Ownership table (authoritative owner → field) is the story's key deliverable — HUD/RSM/Fuel/Tire/Pit own their fields; VP owns only the vehicle-derived set

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 005]: dev playtest rig (consumes these contracts)
- [Camera/HUD/Audio/VFX epics]: consumer implementations (read the contracts)
- [race-flow / race-strategy epics]: RSM/Fuel/Tire field derivation

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (vehicle telemetry)**: completed CarState → pose, velocity direction, speed, gear, RPM, throttle, slide state published without direct consumer reads; edge: zero velocity, reversing, missing optional presentation data
- **AC-2 (HUD ownership/cadence)**: Vehicle + RSM + Fuel + Tire fake publishers → each HUD field from its authoritative owner at the documented cadence; edge: stale owner data, race-state transitions, no direct live-system access
- **AC-3 (audio seam)**: CarState + Fuel/Tire/CarDefinition → `CarAudioState` with RPM + companions passed unchanged; edge: grid lock, fuel empty, pit phase, zero RPM
- **AC-4 (global_max_velocity)**: loaded car definitions → session-wide maximum as read-only; edge: one car, duplicate maxima, degraded/missing car slot

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/VehiclePhysicsTests.cs` (telemetry assembly from published snapshot with fakes)
- Evidence doc: `production/qa/evidence/vehicle-physics-feel-telemetry-evidence.md`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: vehicle-physics-dynamics Story 001 (CarState schema), Story 003 (movement), Story 003 of this epic (RPM/gear from longitudinal)
- Unlocks: Story 005 (rig consumes the contracts), Camera/HUD/Audio/VFX epics (S2 F3)
