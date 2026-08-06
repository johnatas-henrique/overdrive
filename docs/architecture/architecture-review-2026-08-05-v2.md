# Architecture Review — Consistency Rerun

> **Date:** 2026-08-05  
> **Mode:** `/architecture-review consistency`  
> **Engine:** Unity 6000.3.19f1 (Unity 6.3 LTS)  
> **Scope:** 17 ADRs, master architecture, technical preferences, control manifest, architecture registry, and Multiplayer Architecture GDD.

## Executive Verdict

### Verdict: FAIL

The Alpha online-services / Beta real-time correction is internally consistent
and introduced no new conflicts. The overall consistency gate still fails
because the active control manifest contains implementation-critical rules that
contradict accepted ADRs.

The required correction is not a networking redesign. It is a control-manifest
regeneration plus the listed stale-contract fixes.

## Corrected Networking Decision — PASS

The following decision chain is consistent across ADR-0016, ADR-0017,
`multiplayer-architecture.md`, `technical-preferences.md`, `architecture.md`,
and `architecture.yaml`:

| Decision | Verified contract |
|---|---|
| MVP provider state | No online-services or real-time provider selected or linked |
| Alpha provider state | Select identity and durable ghost-sharing services only |
| Beta provider state | Select the real-time racing SDK separately through an Accepted ADR |
| Coherence | Candidate only; not an approved dependency or storage commitment |
| Simulation ownership | Manual accumulator and `Physics.Simulate` remain Simulation authority |
| Input reliability | `W_drop`, `W_rollback`, input delay, jitter buffer, redundancy, and timeout are Beta-measured |
| Rollback boundary | Fuel, Tire, Pit Stop, RSM, AI, counters, and Ghost Recording are forward-only |
| Presentation | Corrective remote state enters the existing LateUpdate interpolation path; presentation only smooths it |

The former networking review blockers are resolved:

- Rollback no longer uses incorrect numeric pipeline-step references.
- Coherence is no longer committed in authority documents.
- ADR-0016 no longer selects a Beta SDK; ADR-0017 defines only the project contract.
- No future-dated WebGL transport claim remains.
- The former 10-tick / 12-tick contradiction is replaced by measured `W_drop` and `W_rollback`.
- `NetworkInput` flags are aligned: Bits 0-2 defined, Bit 3 reserved, Bit 4 `InputAvailability`, Bits 5-7 reserved.

## Blocking Conflicts

### 1. ForceMode rule contradicts Vehicle Physics ADR

- **Control manifest:** `docs/architecture/control-manifest.md:77` requires `ForceMode.Acceleration` for grip forces.
- **Authority:** `docs/architecture/adr-0002-vehicle-physics-implementation-pattern.md:153` requires `ForceMode.Force` and records that `ForceMode.Acceleration` caused mass-multiplied extreme forces in the prototype.
- **Impact:** A programmer following the manifest can recreate the 14,140 m/s² force error.
- **Required correction:** Regenerate the control manifest so its grip-force rule matches ADR-0002.

### 2. Pit refueling reads the wrong source

- **Control manifest:** `docs/architecture/control-manifest.md:93` says FuelSystem reads `CarState.PitPhase`.
- **Authority:** `docs/architecture/adr-0006-fuel-tire-state-ownership-and-tick-timing.md:110-115` requires `TickStartSnapshot.PitServiceCommand[carId]`.
- **Impact:** The manifest bypasses the formal Option B pit-service command contract.
- **Required correction:** FuelSystem must read `PitServiceCommand.active` and `targetFuel`, not `CarState.PitPhase`.

### 3. Pit tire swap reads the wrong source

- **Control manifest:** `docs/architecture/control-manifest.md:94` says TireSystem reads `CarState.PitPhase`.
- **Authority:** `docs/architecture/adr-0006-fuel-tire-state-ownership-and-tick-timing.md:112-115` requires `PitServiceCommand.tireSwapRequired`.
- **Impact:** The same stale manifest can bypass the pit-service contract for tire reset.
- **Required correction:** TireSystem must read `PitServiceCommand.active` and `tireSwapRequired` from `TickStartSnapshot`.

### 4. Presentation update phase is wrong in the control manifest

- **Control manifest:** `docs/architecture/control-manifest.md:152-153` says CameraSystem and VfxSystem run in DynamicUpdate.
- **Authorities:** ADR-0001 interpolation phases and ADR-0010 Update Timing require LateUpdate after visual interpolation.
- **Impact:** Implementers can read pre-interpolation or stale visual state, causing jitter.
- **Required correction:** CameraSystem and VfxSystem must run in LateUpdate consuming interpolated `VisualTransform`.

### 5. Pit enum vocabulary is not canonical

- **Master architecture:** `docs/architecture/architecture.md:336` defines `PitPhase { None, PitTransit, InPitBox, Exiting }`.
- **Vehicle/Pit ADRs:** ADR-0002 and ADR-0011 use `PitServicePhase { NotPitting, PitTransit, InPitBox, PitExiting }`.
- **Impact:** Type and serialized-value drift can create compile failures and incompatible state checks.
- **Required correction:** Select one canonical enum. The current recommended source is `PitServicePhase { NotPitting, PitTransit, InPitBox, PitExiting }`.

## Medium-Severity Contract Drift

| Conflict | Evidence | Required correction |
|---|---|---|
| Camera FOV ranges conflict | ADR-0010 uses 40-65° Chase / ~75-80° Cockpit; `camera.md` and `architecture.md` use 70-90° Chase / 78-95° Cockpit | Choose one data-driven FOV contract and synchronize ADR-0010, GDD, master architecture, and TR registry |
| HUD team color is consumed but absent from CarDefinition schema | ADR-0014 consumes `CarDefinitionData.teamColor`; ADR-0015 does not define it | Add `teamColor` and its data source to CarDefinition, or redirect HUD to a defined owner |
| Per-car cockpit offset is consumed but absent from CarDefinition schema | ADR-0010 and Camera GDD require it; ADR-0015 omits it | Add `cockpitOffset` to CarDefinition or define another authoritative source |
| CarAudioProfile field names diverge | ADR-0012 uses `Cylinders`, `EngineBasePitch`, `ExhaustNote`; ADR-0015 uses `engineCylinders`, `engineBasePitch`, `exhaustNote` | Select one serialized schema and update the other ADR |
| Published snapshot incorrectly claimed to contain PitServiceCommand | ADR-0011 says Step 12 publishes it; its own data flow sends it to the next TickStartSnapshot | Remove PitServiceCommand from the published-snapshot claim |

## Low-Severity Drift

| Conflict | Required correction |
|---|---|
| `architecture.md` says “13-step” pipeline in the Racing Loop | Change to “14-step” |
| ADR-0002 dependency prose says “13-step” pipeline | Change to “14-step” |
| ADR-0009 contains a stale “Step 11” published-snapshot reference | Change to Step 12 under the reconciled pipeline |
| `architecture.md` says Audio has no ADR | Remove the stale open question; ADR-0012 exists |
| HUD document count varies between 7 and 8 chase elements | Standardize on 8 persistent chase elements; Ghost is the 9th when active |
| VFX speed-line thresholds diverge from the data-driven VFX GDD | Replace hard-coded ADR values with the GDD tuning contract |
| TR registry grip formula still includes Stability in effective grip | Revise to the three-multiplier grip stack; Stability affects slip behavior only |
| Traceability matrix still names Coherence and a 10-tick rollback window | Regenerate the matrix after ADR-0016/0017 are Accepted or stamp the 2026-07-28 matrix as superseded |

## Dependency Order

The current ADR dependency graph is acyclic. ADR-0017 now correctly depends on
ADR-0008 because it preserves the Ghost Recording format and lifecycle.

Implementation order relevant to the networking boundary:

1. ADR-0001 — Simulation authority
2. ADR-0005 — Input ownership
3. ADR-0006 — Fuel/Tire timing
4. ADR-0008 — Ghost Recording format
5. ADR-0016 — Alpha online-services / Beta real-time selection boundary
6. ADR-0017 — Beta driver and reconciliation boundary

## Architecture Document Coverage

The master architecture correctly records the provider deferral after this
rerun. Its remaining defects are the Pit enum vocabulary, stale 13-step wording,
and stale Audio open question listed above.

## Required Work Before PASS

1. Regenerate `control-manifest.md` from current Accepted ADRs and verify every
   generated rule against ADR-0002, ADR-0006, ADR-0001, and ADR-0010.
2. Establish one canonical Pit enum type/value contract and synchronize every
   consumer.
3. Resolve the CarDefinition schema gaps for HUD team color and camera cockpit
   offset.
4. Resolve FOV, HUD-count, audio-schema, and VFX tuning drift.
5. Run a new formal consistency review after those corrections.

## Review Boundary

This was a `consistency` review. It does not recalculate the complete
GDD-to-ADR traceability matrix or modify the TR registry. Those operations
require a fresh `full` review after the blocking conflicts are resolved.
