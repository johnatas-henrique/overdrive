# Story 004: Pit Projection

> **Epic**: AI Rival
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.0h

## Context

**GDD**: `design/gdd/ai-rival.md`
**Requirement**: `TR-ai-003` (pit projection — logic half, split per QL-STORY-READY 2026-08-16)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0009: AI Rival Deterministic Architecture (§MVP Scope pit decisions)
**ADR Decision Summary**: Pit decisions use deterministic resource projection: forecast next-lap Fuel + Tire from observed lap deltas + 110% margin. Each AI pits before a non-final next lap only if post-current-lap resources cannot cover that forecast; never before lap 1, never before the final lap. AI waits for full fuel. Difficulty does not change the decision.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C#.

**Control Manifest Rules (this layer)**:
- Required: pit projection with 1.10× margin; never before lap 1; never before the final lap
- Required: pit decision independent of difficulty

---

## Acceptance Criteria

*From ADR-0009 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Given post-lap fuel/tire resources, last completed-lap usage, current lap, total laps, and margin → commit to pit when either resource is below `1.10 × projected next-lap use` (fuel OR tire)
- [ ] No pit commitment before the first completed lap
- [ ] No pit commitment when the next lap is the final lap
- [ ] Difficulty input does not change the decision
- [ ] Equality at exactly 110% is explicitly defined and tested (resolved: `below 1.10×` commits; exactly 1.10× does NOT commit — strict)

---

## Implementation Notes

*Derived from ADR-0009 Implementation Guidelines:*

- Pure projection function over the resource inputs — the LapCompleted event consumption is Story 005's adapter
- `pitProjectionMargin = 1.10` is the per-archetype field (Story 001 archetype data)
- The projection never reads Fuel/Tire state directly — it consumes the per-lap deltas supplied by the seam

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 005]: LapCompleted adapter (consumes this projection)
- [Story 008]: collision recovery (moved out per gate)
- [race-strategy epic]: FuelState/TireState production

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (commit rule)**: either insufficient fuel or insufficient tire → commit; edge: both sufficient
- **AC-2 (110% boundary)**: exactly 110% → no commit (strict); just below → commit
- **AC-3 (lap restrictions)**: pre-lap-1 and next-final-lap → never commit; edge: current lap = totalLaps − 1
- **AC-4 (difficulty)**: difficulty changes do not alter the projection

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/simulation/AiRivalTests.cs` — pit projection boundaries, strict 110% rule

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (archetype margin)
- Unlocks: Story 005 (adapter), race-strategy pit interplay
