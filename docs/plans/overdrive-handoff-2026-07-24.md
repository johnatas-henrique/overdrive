# Overdrive Review Handoff

Date: 2026-07-24
Project: `/mnt/d/projects/overdrive`

## Immediate Objective

Start a **fresh lean re-review cycle** for the 21 system GDDs, beginning with `design/gdd/input-system.md` in the order defined by `design/gdd/systems-index.md`.

Do **not** start with `/review-all-gdds`. That holistic review is only valid after every individual GDD has completed its fresh re-review and is marked Approved.

## Current Project State

- `production/review-mode.txt` is `lean`.
- The first lean pass was completed across the 21 system GDDs.
- The GDDs remain `Revised — Pending Re-review`; they must not be treated as Approved.
- The central tracker is `design/gdd/systems-index.md`.
- The next individual re-review is `input-system.md`.
- The final consistency check was completed after correcting stale registry entries and source residues.
- No commits were created, staged, pushed, or amended.

## Mandatory Review Procedure

For each GDD:

1. Invoke/use `design-review` with `--depth lean`.
2. Execute all five phases in order:
   - Phase 0: parse arguments.
   - Phase 1: load the target, design standards, concept, dependencies, and prior review log.
   - Phase 2: verify all eight required sections.
   - Phase 3: perform internal, implementability, and cross-system analysis.
   - Phase 4: produce the formal read-only review report.
   - Phase 5: use the required question widgets and write/update only after the selected action.
3. Do not use `Task`, specialist agents, adversarial reviews, or simulated specialist reports. Lean means one-agent analysis.
4. Keep exactly one GDD active in the task list.
5. Build the complete finding ledger before editing.
6. Resolve all deducible findings in one consolidated batch.
7. Before any fresh re-review, verify the complete batch with:
   - rule/formula/edge-case → acceptance-criteria matrix;
   - producer → consumer contract matrix;
   - semantic-occurrence matrix;
   - final-file readback against the approved draft.
8. If a product decision cannot be deduced from the GDDs and existing decisions, stop before editing and ask one grouped question. Do not invent behavior.
9. After each GDD completion, update the tracker and review log through the skill's required widgets, then compact context immediately and continue with the next GDD.

## Important Process Rules

- Never replace a skill phase with ad-hoc reasoning.
- Never invoke the same skill again while the current skill execution is unfinished. Continue the current phase/state.
- Never treat a successful write or a clean stale-term search as completion.
- Never create the loop: partial correction → new review → new finding → new review.
- A re-review is not autonomous: follow the Phase 5 choice and the user's standing workflow.
- The three-pass limit is the default. An exception requires explicit user authorization and must consolidate all findings and conclude; it cannot become a new cycle.
- `--depth lean` is the operative mode. The global `review-mode.txt` setting does not replace the skill argument.
- Do not mark a GDD Approved merely because its first lean pass was corrected. The current baseline is pending fresh re-review.
- MVP review may use Ghost Recording and Multiplayer Architecture only as architectural-constraint sources. Their Alpha/Beta behavior is not an MVP blocker unless it violates an explicit MVP constraint.

## Correct Next Sequence

1. Fresh session.
2. Lean re-review: `input-system.md`.
3. Continue through all 21 system GDDs in systems-index order.
4. Mark each GDD Approved only after its individual fresh re-review and Phase 5 closure are complete.
5. Run `/consistency-check full` if any GDD or registry values changed during the re-review cycle.
6. Only then run `/review-all-gdds` for holistic cross-GDD design review.

## Wall-Clock Evidence

Verified timestamps from the previous wall-clock check:

- Previous measured timestamp: `2026-07-24T13:37:23-03:00`.
- Current measured timestamp: `2026-07-24T20:31:33-03:00`.
- Elapsed interval: `6h54m10s`.

This interval is measured from the previous recorded timestamp and is **not** an isolated duration for the consistency check alone.

User-provided comparison: the previous exception-heavy workflow consumed approximately 61 hours and had reached only the second GDD. The current lean, controlled workflow completed the individual pass over all 21 GDDs plus the consistency check within the measured interval. The conclusion is empirical: workflow compliance is faster than local exceptions and ad-hoc restarts.

## Consistency Check Result

The final full consistency scan found:

- 16 registered entities, all team stats/archetypes consistent.
- 0 registered items.
- 10 registered formulas.
- 7 registered constants.
- No unresolved cross-GDD value conflicts.
- Five stale registry entries were corrected:
  - `player_pit_advisory`
  - `vfx_intensity`
  - `qualifying_time`
  - `position_ranking`
  - `global_max_velocity`
- During the verification, stale source text was also corrected in `vfx.md`, `race-session-manager.md`, and the Vehicle Physics Fuel/Tire dependency contract.
- Final consistency verdict: `PASS — consistency check complete`.

## Source-of-Truth Artifacts

Use these files rather than relying on this handoff for design details:

- `design/gdd/systems-index.md` — review order, phase scope, tracker.
- `design/gdd/` — system GDDs.
- `design/gdd/reviews/` — per-GDD review history; verify the latest entry before re-review.
- `design/registry/entities.yaml` — cross-GDD entities, formulas, and constants.
- `production/review-mode.txt` — current global mode (`lean`).
- `production/session-state/active.md` — living session checkpoint.
- `docs/architecture/adr-0001-manual-simulation-authority-and-determinism-boundary.md` — architecture-phase ADR; do not treat ADR absence as a GDD review defect.

## Resolved Decisions Not to Reopen Without Direct Contradicting Evidence

- MVP scope is 21 systems; Ghost and Multiplayer are future systems with MVP architectural constraints only.
- Simulation uses a manual 60 Hz accumulator and explicit `Physics.Simulate`; no gameplay `FixedUpdate`.
- Countdown is 5 seconds / 300 ticks; GO is tick 300.
- Qualifying is `RaceMode.Qualifying` inside `SimulationState.Racing`.
- GridAssignment is an immutable `carId → gridSlot` list produced by RSM.
- Pit entry is physical; there is no Pit input action; Confirm/Enter permits early player exit after the 2-second tire swap.
- AI collision behavior in MVP uses Vehicle Physics collision resolution and deterministic Recovering; active obstacle avoidance is Alpha.
- Difficulty affects AI competence, not Fuel/Tire rules or Car Definition max-speed formulas.
- HUD cockpit Chase overlay is enabled by default and optional; total cockpit presentation can show 11 elements, while readability remains governed by the 0.5-second/two-information-per-glance rule.

## Suggested Skills for the Next Agent

- `design-review` with `--depth lean` for each individual GDD.
- `consistency-check` after the individual cycle or after registry-affecting changes.
- `review-all-gdds` only after all individual GDDs are Approved.
- `handoff` only when another session must take over again.

## Final Warning

Do not optimize the workflow by skipping a phase, creating an exception, restarting the skill, or asking for a re-review outside the selected Phase 5 path. The wall-clock evidence shows that these shortcuts increase total duration and reduce reliability.
