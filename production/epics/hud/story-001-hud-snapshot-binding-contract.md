# Story 001: HUD Snapshot Binding Contract

> **Epic**: HUD
> **Status**: Ready
> **Layer**: Core + Presentation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/hud.md`
**Requirement**: `TR-hud-004` (one authoritative data owner per element + explicit cadence)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0014: HUD Data Contract and Layout
**ADR Decision Summary**: HUD reads EXCLUSIVELY from the published/lifecycle snapshot — never live system state (Fuel, Tire, RSM, Pit Stop, Simulation, Input). Binding metadata maps each element to one authoritative snapshot owner and cadence: Speed/Gear → VP per tick, Position/Lap/Rival Gap/Map positions → RSM per tick, Fuel → FuelState, Tire → TireState, Current lap time → Simulation, Track geometry → Track snapshot. HUD output unchanged while the snapshot is frozen, even if mocked producer state changes; HUD updates only on a new published snapshot/event. Track Map is the approved composite of RSM positions + Track geometry — it never calculates race position.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: uGUI Canvas (stable); presentation reads snapshot.

**Control Manifest Rules (this layer)**:
- Required: every HUD element has ONE authoritative data owner + explicit update cadence (ADR-0014)
- Required: presentation consumes published snapshot, never live simulation state

---

## Acceptance Criteria

*From ADR-0014, scoped per QL-STORY-READY 2026-08-16 (001A split — binding contract):*

- [ ] HUD reads exclusively from the supplied published/lifecycle snapshot; no direct live-system reads
- [ ] Binding metadata maps each element to one authoritative snapshot owner + cadence (VP speed/gear per tick, RSM position/lap/rival/map per tick, Fuel fuel, Tire tire, Simulation lap time, Track geometry)
- [ ] HUD output remains unchanged while the published snapshot is frozen, even if mocked producer state changes
- [ ] HUD updates only when a new published snapshot/event is supplied
- [ ] Track Map documented as the approved composite of RSM positions + Track geometry — it never calculates race position

---

## Implementation Notes

*Derived from ADR-0014 Implementation Guidelines:*

- The binding is a view-model assembly from the snapshot — HUD components bind to the view model, never to simulation systems
- Ownership table is the story's key deliverable (element → owner → cadence)
- The 0.5s readability and ≤0.5ms budgets are the presentation story's evidence (001B)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 001B]: chase presentation (renders the bound view model)
- [race-flow/race-strategy]: producer state (consumed via snapshot)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-BIND**: freeze a published snapshot; mutate live mocked Fuel/Tire/RSM/VP → HUD unchanged until a new snapshot is published
- **AC-OWNERSHIP**: publish controlled snapshots with one field changed at a time → only the mapped element changes at its documented cadence
- **AC-SNAPSHOT-ONLY**: no direct live-system reads (spy asserts snapshot-only access)
- **AC-TRACKMAP**: Track Map renders RSM positions + Track geometry composite; never calculates race position

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/ui/HudBindingTests.cs` — snapshot binding, ownership, cadence with fakes

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: vehicle-physics-feel (snapshot/telemetry), race-flow (RSM positions), track (geometry)
- Unlocks: Story 001B (presentation binds the view model)
