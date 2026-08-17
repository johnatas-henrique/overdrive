# Story 007: AI Determinism & Race-Init Snapshot

> **Epic**: AI Rival
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/ai-rival.md` (determinism ACs)
**Requirement**: `TR-ai-004` (determinism verification), GDD AC "same seed → identical results"
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0009: AI Rival Deterministic Architecture (§Determinism, §Validation Criteria)
**ADR Decision Summary**: Same seed + same snapshot sequence = identical AI decisions. `ReplayInitialState` captures only SimSeed; every AI draw is re-derivable. DifficultyProfile is snapshotted at race initialization — Settings changes afterward do not affect active AI until the next race.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C# verification harness (companion to the simulation-kernel DeterminismHarness).

**Control Manifest Rules (this layer)**:
- Required: same seed + same snapshot sequence → identical AIInput across runs
- Required: DifficultyProfile snapshotted at race init; mid-race changes have no effect

---

## Acceptance Criteria

*From ADR-0009 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Three runs with the same seed and pre-recorded snapshot sequence produce identical complete AIInput sequences
- [ ] DifficultyProfile is copied/snapshotted at race initialization; provider changes mid-race do not affect the active AI
- [ ] A new race may receive a new profile
- [ ] `AIInput` is a readonly value type with no per-car object allocation (caller-owned buffer — Story 006's contract)

---

## Implementation Notes

*Derived from ADR-0009 Implementation Guidelines:*

- The harness reuses the simulation-kernel DeterminismReplayTests pattern (same seed + recorded snapshot sequence → byte-identical AI outputs across 3 runs)
- The profile snapshot is a copy at race init (the kernel's ReplayInitialState captures the profile ID — settings epic provides it)
- The byte-for-byte comparison covers ALL AI outputs (steer/brake/throttle per car per tick)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 006]: the adapter (consumed by the harness)
- [settings epic]: DifficultyProfile provision
- [Simulation Kernel]: ReplayInitialState capture (shipped)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (determinism)**: 3 runs, same seed + snapshot sequence → byte-for-byte identical across all AI outputs
- **AC-2 (profile snapshot)**: mid-race DifficultyProfile mutation → no effect on active AI; next race accepts new profile
- **AC-3 (zero-allocation)**: AIInput readonly value type; allocation test uses the caller-owned buffer

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/AiRivalTests.cs` (or DeterminismReplayTests extension) — 3-run byte-identical verification

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 006 (adapter), Simulation Kernel (DeterminismHarness, ReplayInitialState)
- Unlocks: race determinism gate (same seed → same race outcome)
