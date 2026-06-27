# Story 007: Simulation Snapshot Panel

> **Epic**: Dev Tools
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/dev-tools.md`
**Requirement**: `TR-DVT-004`
_Simulation Snapshot debug panel — list of registered ISnapshotable systems, per-system hash, hash diff between snapshots, take/restore controls._

**ADR Governing Implementation**: ADR-0009: Dev Tools Architecture (with ADR-0017: Simulation Snapshot)
**ADR Decision Summary**: Dev Tools reads registered `ISnapshotable` systems from SimulationSnapshot. Per-system FNV-1a 64-bit hash displayed (TR-SSN-004). Hash diff as green ✓ / red ✗ indicators. Take/Restore controls guarded by `import.meta.env.DEV` — exception to read-only rule for deliberate debug actions.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No Babylon.js imports needed — pure DOM + SimulationSnapshot integration.

**Control Manifest Rules (this layer)**:

- **Required** (D6): Dev Tools: read-only on all systems — never writes state, never emits Event Bus events
- **Required** (F33): `ISnapshotable` — `systemId`, `serialize()`, `deserialize()`, `hash()`
- **Required** (F34): Two-tier hashing — FNV-1a 64-bit for tick-level, SHA-256 for network/save integrity
- **Exception (D6)**: Snapshot take/restore controls under `import.meta.env.DEV` guard are permitted as deliberate debug actions. They call `SimulationSnapshot.takeSnapshot()` / `restoreSnapshot()` through public API — Dev Tools never writes to any system directly.

---

## Acceptance Criteria

_From GDD `design/gdd/dev-tools.md`, scoped to this story:_

- [ ] AC-7a: List of registered `ISnapshotable` systems with system IDs displayed
- [ ] AC-7b: Per-system FNV-1a 64-bit hash displayed; same state always produces same hash (deterministic)
- [ ] AC-7c: Hash diff between current and last taken snapshot — green ✓ indicator if match, red ✗ indicator if changed, highlighting which systems have diverged
- [ ] AC-7d: Take/Restore snapshot controls (guarded by `import.meta.env.DEV`)

---

## Implementation Notes

_Derived from ADR-0009 Implementation Guidelines:_

1. **Data source**: Reads from `SimulationSnapshot` public API — registered `ISnapshotable` systems with `systemId`, `hash()`, `serialize()`.

2. **Hash display** (AC-7b): Displays the FNV-1a 64-bit hash as a hex string. Same state always produces the same hash (deterministic).

3. **Hash diff** (AC-7c): On each refresh tick, compare each system's current `hash()` against the hash stored from the last `takeSnapshot()` call. Display:
   - Green ✓ row when hashes match (no change since last snapshot)
   - Red ✗ row when hashes differ (state has diverged)
   - First time (no snapshot taken yet): "—" (no baseline)

4. **Take snapshot** (AC-7d): Button calls `SimulationSnapshot.takeSnapshot()` under `import.meta.env.DEV` guard. Stores the resulting hashes per system for diff comparison.

5. **Restore snapshot** (AC-7d): Button calls `SimulationSnapshot.restoreSnapshot()` under `import.meta.env.DEV` guard. Dev Tools reads `restoreSnapshot()`'s return value `{ succeeded: string[], failed: Array<{ systemId, error }> }` and displays the result.

6. **Write rule exception**: Take/Restore are deliberate developer actions calling SimulationSnapshot's public API. Dev Tools never writes to any system directly.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 003]: HTML overlay shell, `IDevTools` interface, tab scaffolding
- [Story 004]: Config tree panel
- [Story 005]: Event Bus inspector
- [Story 006]: GSM visualizer panel
- [Story 008]: AI Telemetry tab

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-7a**: registered systems list
  - Given: SimulationSnapshot has 4 registered systems: `"physics"`, `"fuel"`, `"tire"`, `"ai"`
  - When: Dev Tools Sim Snapshot tab is opened
  - Then: the system list shows physics, fuel, tire, ai

- **AC-7b**: FNV-1a hash display
  - Given: a registered system `"fuel"` with known state `{ fuelLevel: 50 }`
  - When: Dev Tools displays the hash for `"fuel"`
  - Then: the displayed hash value matches FNV-1a 64-bit of `serialize()`
  - Edge cases: same state always produces the same hash (deterministic)

- **AC-7c**: hash diff
  - Given: a snapshot was taken at tick 100 (all systems hashed)
  - When: the system state has not changed (no tick advanced)
  - Then: all systems show ✓ (match) in the diff column
  - When: a tick advances and physics state changes
  - Then: physics shows ✗ (mismatch); other systems show ✓

- **AC-7d**: take/restore
  - Given: snapshot S was taken at tick 100 with known state
  - When: simulation advances 10 ticks (state changes)
  - And: the developer clicks "Restore" for snapshot S
  - Then: all systems' state is restored to the tick-100 state
  - And: all system hashes match the snapshot's hashes

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/dev-tools/sim-snapshot-panel_test.ts` or documented playtest

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 (needs overlay shell + `IDevTools.registerDataSource`)
- Unlocks: None
