# Story 008: AI Collision Recovery

> **Epic**: AI Rival
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.0h

## Context

**GDD**: `design/gdd/ai-rival.md` (GDD AC — MVP collision: affected AI enters Recovering; no active obstacle avoidance)
**Requirement**: GDD AC "Given an MVP AI collision occurs, WHEN Vehicle Physics resolves it, THEN the affected AI enters Recovering and no active obstacle-avoidance decision runs" — added as a distinct story per QL-STORY-READY 2026-08-16
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0009: AI Rival Deterministic Architecture (§MVP Scope — no active obstacle avoidance; collisions resolved by Vehicle Physics)
**ADR Decision Summary**: MVP AI has no active obstacle avoidance — car-to-car collision is resolved by Vehicle Physics; the affected AI enters a Recovering state. No avoidance decision runs.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C# — consumes the VP collision-result seam.

**Control Manifest Rules (this layer)**:
- Required: MVP no active obstacle avoidance — collision handled by VP; AI enters Recovering
- Required: recovery uses the documented recovery modifier and returns to the racing line via the AI state seam

---

## Acceptance Criteria

*From ADR-0009 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] A VP collision-result seam (per-car collision signal) causes the affected AI to enter `Recovering`
- [ ] No active obstacle-avoidance decision is invoked during/after the collision
- [ ] Recovery uses the documented recovery modifier and returns to the racing line through the AI state seam
- [ ] Non-collision events and unrelated-car collision events do not change the AI's state

---

## Implementation Notes

*Derived from ADR-0009 Implementation Guidelines:*

- The VP collision seam is the same contact signal Vehicle Physics produces (vehicle-physics-dynamics story 005) — consumed read-only
- `Recovering` is an AI state modifier (part of the state_modifier range in the target-speed model — Story 002)
- No avoidance: the AI does not steer around other cars — it resumes its normal target-speed model after recovery

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [vehicle-physics-dynamics Story 005]: collision resolution itself (consumed)
- [Story 002]: target-speed state modifier (consumed)
- Active obstacle avoidance: Alpha extension (out of MVP)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (recovering)**: VP collision seam for car X → car X enters Recovering; edge: collision with non-car, simultaneous multi-car
- **AC-2 (no avoidance)**: no active avoidance decision invoked during/after; edge: car ahead in Recovering window
- **AC-3 (recovery)**: recovery modifier applied, returns to the racing line via the state seam; edge: recovery interrupted by a second collision
- **AC-4 (isolation)**: non-collision events and unrelated-car collisions do not change the AI's state

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/AiRivalTests.cs` — collision → Recovering → recovery with fakes
- Logic companion: `Assets/tests/unit/simulation/AiRivalTests.cs`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002 (state modifier), vehicle-physics-dynamics Story 005 (collision seam)
- Unlocks: 16-car race integrity (recovery after contact)
