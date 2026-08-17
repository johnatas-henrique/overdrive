# Story 006: Qualifying Lifecycle

> **Epic**: Race Flow
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/qualifying.md`
**Requirement**: `TR-qual-001` (session flow), `TR-qual-004` (RaceLoadReady direct entry), `TR-qual-008` (GridAssignment)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0013: Qualifying Session Format (§Session Flow, §Finished Presentation)
**ADR Decision Summary**: Given `RaceLoadReady(RaceMode.Qualifying)`, Qualifying enters Racing/GameplayQualifying directly with no Countdown and no grid-lock tick. Given a Track-provided `pitBoxId`, Qualifying emits `QualifyingSpawnSpec` (Content/VP own actual spawn). Qualifying emits `FinishedPresentationRequest(resultKind = Qualifying)` and accepts terminal dismissal; UI Menu owns Confirm/Cancel routing (Cancel ignored). Grid ranking and immutable assignment are RSM-owned (Story 003), not Qualifying's.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C# contracts; kernel/Content own the actual state transitions.

**Control Manifest Rules (this layer)**:
- Required: RaceLoadReady(RaceMode.Qualifying) → Racing/GameplayQualifying, no Countdown
- Required: Finished Presentation resultKind = Qualifying; UI Cancel ignored
- Required: pit blocked during qualifying (Pit Stop does not enter Pit Transit/InPitBox — suppression signal)

---

## Acceptance Criteria

*From ADR-0013 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Given `RaceLoadReady(RaceMode.Qualifying)` → Qualifying enters its active phase and emits the no-Countdown/no-grid-lock contract (Simulation tests the actual state transition)
- [ ] Given a Track-provided `pitBoxId` → Qualifying emits `QualifyingSpawnSpec` (spawn position/state owned by Content/VP — the spec carries boxId, stationary, engine-running)
- [ ] Qualifying emits `FinishedPresentationRequest(resultKind = Qualifying)` and accepts terminal dismissal (UI Menu owns Confirm/Cancel routing; Cancel ignored)
- [ ] Pit blocking: Qualifying emits the qualifying-mode suppression signal consumed by Pit Stop (no Pit Transit/InPitBox)
- [ ] Grid ranking/assignment NOT computed here — RSM owns (Story 003); Qualifying supplies the qualifying times and skip/fail result to RSM

---

## Implementation Notes

*Derived from ADR-0013 Implementation Guidelines:*

- The lifecycle adapter composes the Core (Story 005) with the kernel/Content/UI seams — no state-machine logic of its own beyond the phase contract
- `QualifyingSpawnSpec` is the boundary contract between Qualifying and Content/VP (spawn data, not spawn execution)
- Finished Presentation is the shared kernel lifecycle (ADR-0001) with `resultKind = Qualifying` (PostFinishSnapshot)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Simulation Kernel]: Racing/GameplayQualifying state transition
- [Content/VP]: actual pit-box spawn execution
- [ui-menu epic]: Confirm/Cancel routing
- [race-strategy epic]: pit suppression implementation

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (direct entry)**: RaceLoadReady(RaceMode.Qualifying) → active phase + no-Countdown/no-grid-lock contract emitted; edge: Simulation transition tested at kernel boundary
- **AC-2 (spawn spec)**: Track pitBoxId → QualifyingSpawnSpec with boxId/stationary/engine-running; edge: missing boxId
- **AC-3 (finished presentation)**: qualifying terminal → FinishedPresentationRequest(resultKind=Qualifying) + terminal dismissal accepted; edge: Cancel ignored (UI Menu-owned)
- **AC-4 (pit blocked)**: qualifying active → suppression signal; edge: no Pit Transit/InPitBox emitted

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/QualifyingTests.cs` — lifecycle contracts with fakes (kernel/Content/UI seams)
- Logic companion: `Assets/tests/unit/simulation/QualifyingTests.cs`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 005 (core attempt/timer), Simulation Kernel (RaceLoadReady), Track (pitBoxId seam)
- Unlocks: Story 007 (rules), ui-menu (Qualifying Results)
