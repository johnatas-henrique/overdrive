# Story 004: Publication Contract (Step 12)

> **Epic**: Race Flow
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.0h

## Context

**GDD**: `design/gdd/race-session-manager.md` + `simulation-architecture.md` (published snapshot)
**Requirement**: ADR-0018 Contract Note — Step 12 Publication (codified by improve-codebase-architecture C12, user-approved 2026-08-15)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0018: Race Session Manager Authority (Contract Note §139-159)
**ADR Decision Summary**: The production publish step (spine index 11, replacing the test-local `PublishStep` fabrication) must satisfy: (1) exactly one snapshot per executed tick; (2) terminal wins — a resolved `PostFinishSnapshot` is published verbatim with its resolved classification; (3) current-state fallback while no terminal exists; (4) read-only — never mutates simulation state.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C# pipeline step — the kernel provides the context (`context.PublishSnapshot`, `context.TerminalSnapshot`).

**Control Manifest Rules (this layer)**:
- Required: exactly one snapshot per executed tick; terminal wins; current-state fallback; read-only

---

## Acceptance Criteria

*From ADR-0018 Contract Note, scoped per QL-STORY-READY 2026-08-16:*

- [ ] During one executed tick, the publish step invokes the publish callback exactly once
- [ ] Given current state + a resolved terminal snapshot → the terminal snapshot is published verbatim (never dropped/replaced)
- [ ] Given no terminal → the actual current-state snapshot is published
- [ ] The step reads context and publishes; simulation state and context inputs are unchanged after execution

---

## Implementation Notes

*Derived from ADR-0018 Contract Note:*

- This story replaces the test-local `PublishStep` fabrication (`Assets/tests/integration/simulation/TestSteps.cs`) with the production implementation; the integration suite then validates against the real publication path
- The published snapshot is the consumer boundary for Camera/VFX/Audio/HUD (ADR-0010/0014)
- Terminal = `context.TerminalSnapshot != null` (produced by the RSM consume step)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 002]: resolver output (the terminal's resolved classification — consumed here)
- [Camera/HUD/Audio/VFX epics]: consumer reads
- [Simulation Kernel]: step spine (this step plugs into the shipped kernel)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (exactly one)**: one executed tick → publish callback exactly once
- **AC-2 (terminal wins)**: current state + resolved terminal → terminal published verbatim; edge: terminal present but resolved classification must not be dropped
- **AC-3 (current-state fallback)**: no terminal → actual current-state snapshot published
- **AC-4 (read-only)**: snapshot context → simulation state and context inputs unchanged

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/RaceSessionManagerTests.cs` (or existing PublicationTests) — real publication path replaces the fabrication

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002 (resolver terminal), Simulation Kernel (step context)
- Unlocks: Presentation consumers (Camera/HUD/Audio/VFX read the real publication path)
