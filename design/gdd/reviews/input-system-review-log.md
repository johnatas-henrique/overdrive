# Review Log: Input System — Overdrive

## MVP Full Review — 2026-07-23 — Verdict: APPROVED

Scope signal: L

Review boundary: MVP active behavior and explicit MVP architecture constraints only. Replay, Ghost Recording, Multiplayer, Coherence, and other future-phase behavior were compatibility context only and did not block approval unless they contradicted `SimulationInput`.

Specialists: game-designer, systems-designer, ux-designer, unity-specialist, qa-lead, performance-analyst, gameplay-programmer, creative-director.

Final result: All Input-owned MVP blockers and recommendations found during the review cycles were resolved. The final independent gate reported no remaining Input-owned design, contract, UX-flow, timing, feasibility, or Unity API defects.

### Approved MVP Contracts

| Contract | Approved Rule |
|---|---|
| Simulation input | `SimulationInput` is the sole per-tick gameplay-input contract. Downstream MVP systems never consume raw device input. |
| Processing pipeline | Dynamic Update captures `RawInputSample`; the game per-tick routine applies dead zone, EMA, brake priority, and produces `SimulationInput` at the 60 Hz simulation boundary. |
| Game/UI maps | `OverdriveGameplay` and `OverdriveUI` are mutually exclusive. Gameplay map: Accelerate, Brake, Steer, Pause. UI map: Navigate, Point, Click, Confirm, Cancel. Pit entry is physical through Track's pit-entry zone. |
| Reserved navigation | Confirm = Enter/South; Cancel = Escape/East; Pause = Escape/Start in gameplay contexts. Confirm, Cancel, and Pause cannot be removed or remapped. |
| Context handoff | Gameplay ↔ UI clears pending gameplay edges. Controls held at the transition remain ignored until released and pressed again. |
| Pause resume | UI → Racing, Qualifying, or Countdown reinitializes EMA from current post-dead-zone raw values. Countdown → Racing preserves EMA state. |
| Brake priority | Brake forces `accelerateOut = 0`; Accelerate EMA freezes while Brake is active and resumes from its pre-brake state after release. |
| Default scheme | KeyboardMouse is active at desktop and WebGL start. Gamepad takes over only after a meaningful input: South/East/West/North/Start, trigger above threshold, or stick magnitude above inner threshold. |
| Qualifying | `RaceMode.Qualifying` runs under shared `SimulationState.Racing`; Vehicle Physics ignores pit-entry zones during Qualifying. |
| Return Cutscene | UI context; Confirm skips to Qualifying Grid Screen; Cancel is ignored; driving stays disabled. |
| Perfect Start | Grid & Start evaluates post-dead-zone, pre-EMA throttle/brake. The arming window is GO-12 through GO-1; the raw condition must also hold on GO. |
| Settings preview | Settings owns `SettingsInputPreviewEvaluator`; it is UI-only, uses the same dead-zone/EMA formulas, and never reads/writes SimulationInput or advances simulation. |

### Findings Resolved

| Finding | Resolution |
|---|---|
| SimulationInput implicit contract | Added named fields, ranges, consumers, and pre-EMA/post-dead-zone semantics. |
| UI Confirm/Pause collision | Replaced UI Cancel reuse of Pause with reserved UI Confirm/Cancel actions. |
| Escape pause immediately cancelling UI | Added neutral-release context-handoff rule and AC coverage. |
| Qualifying duplicated simulation state | Established `RaceMode.Qualifying` under shared `SimulationState.Racing`. |
| Return Cutscene input dead zone | Defined UI Confirm skip and ignored UI Cancel behavior. |
| Missing Input AC coverage | Expanded Acceptance Criteria to 56 deterministic MVP checks. |
| Shared formula drift risk | Registered `ema_smoothing` and `dead_zone_normalization` in `design/registry/entities.yaml`. |

### Final Gate Evidence

The final independent review gates returned PASS for game design, systems contracts, UX flows, Unity Input System API feasibility, timing, and implementation feasibility. The creative-director synthesis returned APPROVE.

### False Positives Discarded

| Claim | Evidence for discard |
|---|---|
| AC-23 used an unspecified button threshold | Final `input-system.md` AC-23 explicitly names South, East, West, North, and Start. |
| Countdown resume had no EMA acceptance criterion | Final AC-41 explicitly includes Racing, Qualifying, and Countdown. |
| WebGL exposure and qualifying-to-countdown lacked ACs | Final AC-55 and AC-56 cover those paths. |
| Return Cutscene went directly to Countdown | Final flow is Flying Lap → Return Cutscene → Qualifying Grid Screen → GameplayCountdown. |

### External Findings Deferred

| Finding | Owner | Boundary |
|---|---|---|
| Vehicle Physics refers to `SimulationInput.steer` rather than `steerOut` | Vehicle Physics review | External consumer documentation defect; does not alter Input ownership or approval. |

### Files Revised During This Review

- `design/gdd/input-system.md`
- `design/gdd/settings.md`
- `design/gdd/ui-menu.md`
- `design/gdd/simulation-architecture.md`
- `design/gdd/race-session-manager.md`
- `design/gdd/qualifying.md`
- `design/gdd/grid-start.md`
- `design/registry/entities.yaml`

## Lean Review — 2026-07-24 — Verdict: NEEDS REVISION

Scope signal: M

Review boundary: MVP active behavior and explicit MVP architecture constraints only. Future Ghost, Replay, Multiplayer, and Coherence behavior remained non-blocking compatibility context.

Specialists: none — lean mode.

Blocking items: 1 | Recommended: 3
Prior verdict resolved: No — this review found residual defects in the post-approval revision state.

### Findings

| Finding | Severity | Resolution |
|---|---|---|
| Overview still listed `Pit` and `Menu` as gameplay actions after the Pit action had been removed from MVP | Blocking | Replaced the stale action list with the authoritative MVP input boundary: Accelerate, Brake, Steer, and Pause; UI navigation and physical pit entry are described separately. |
| Processing formula labels did not consistently use the authoritative `SimulationInput` field names | Recommended | Aligned formula variables with `accelerateOut`, `brakeOut`, `steerOut`, and the post-dead-zone raw fields. |
| Perfect Start acceptance criterion referred to an undefined “raw launch condition” | Recommended | Made the criterion explicit: `rawThrottlePostDeadZone > 0.5` and `rawBrakePostDeadZone == 0` within the approved GO window. |
| The update-mode requirement used an ambiguous API-style name | Recommended | Rephrased it as the configured Input System update mode and retained `ProcessEventsInDynamicUpdate` as the required value. |

### Revised MVP Contract Notes

- Pause keeps Escape/Start as the default gameplay binding but may be rebound only when Pause itself is the rebinding target; reserved UI navigation bindings remain protected for all other targets.
- The revised GDD remains `Revised — Pending Re-review`; the prior APPROVED verdict is not carried forward automatically.

### Files Revised During This Lean Review

- `design/gdd/input-system.md`
- `design/gdd/systems-index.md`
- `production/session-state/active.md`

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: L

Specialists: none — lean mode

Blocking items: 4 | Recommended: 4

Summary: The fresh lean re-review confirmed that all four findings from the prior lean pass were resolved, then found stale Qualifying terminal-flow criteria, contradictory Pause rebinding rules, a missing Input-to-Camera delivery contract for `CameraToggle`, and an undefined second pending edge flag. All blocking and advisory findings were corrected in one consolidated batch and verified through rule-to-acceptance-criteria, producer-to-consumer, semantic-occurrence, and final-file readback matrices; Input remains Revised — Pending Re-review for a third fresh lean pass.

Prior verdict resolved: Yes — all findings from the 2026-07-24 lean review were resolved before this fresh re-review; this pass found new defects.

## Review — 2026-07-25 — Verdict: APPROVED

Scope signal: L

Specialists: none — lean mode

Blocking items: 0 | Recommended: 2 (review log stale entries only — GDD not affected)

Summary: Fresh lean re-review confirmed all prior findings were resolved. GDD is comprehensive with 8/8 sections present, 70 acceptance criteria, correct formulas, and consistent cross-system dependencies. No blocking or recommended issues found in the GDD itself. Two stale entries identified in this review log (Return Cutscene reference and Pause rebinding rule) — historical records superseded by this entry.

Prior verdict resolved: Yes — all 8 findings from the 2026-07-25 lean review were resolved before this fresh re-review; this pass found zero GDD defects.

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: L

Specialists: none — lean mode

Blocking items: 0 | Recommended: 1

Summary: Fresh lean re-review confirmed all prior findings were resolved. Cross-GDD consistency check found 1 recommended issue: stick dead-zone field naming mismatch between Input System (`stick_inner`, `stick_outer`) and Settings (`stick_dead_zone_inner`, `stick_dead_zone_outer`). The naming mismatch was corrected in Input System to align with Settings. GDD remains Revised — Pending Re-review for a fresh pass to confirm the fix.

Prior verdict resolved: Yes — all findings from prior reviews were resolved; this pass found 1 cross-GDD naming issue which was corrected.

## Review — 2026-07-25 — Verdict: APPROVED

Scope signal: L

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean review with complete file reads (375 lines target + 2,899 lines related GDDs). Phase 2: 8/8 sections present. Phase 3.1: 20 formula tests pass, 13 edge case checks consistent, 8 dependencies confirmed bidirectional. Phase 3.2: 15 rule precision checks high, 0 hand-wave sections, 7 performance aspects addressed. Phase 3.3: 8 cross-GDD contracts verified consistent, 4 tone/pillar alignments confirmed, 0 unintended interactions. Ledger is clean because all prior phases produced clean output.

Prior verdict resolved: Yes — the stick dead-zone naming mismatch from the 2026-07-25 lean review was corrected in the prior pass; this fresh review found zero new defects.

## Review — 2026-08-01 — Verdict: APPROVED

Scope signal: L

Specialists: none — lean mode

Blocking items: 0 | Recommended: 1

Summary: Re-review after the parallel agent's Grid Display → Qualifying Results rename (3 points: transition, AC-54, AC-56) — rename clean, zero residual references. Full contract re-verification against ADRs 0004/0005/0011: EMA alphas (0.3/0.3/0.5), brake priority with frozen EMA, latching, dead zones, reserved bindings, ProcessEventsInDynamicUpdate, SettingsInputPreviewEvaluator, PitService Confirm routing, ActiveControlScheme arbitration — all aligned. One recommended (stale Last Updated header) corrected in-session.

Cross-ADR note for architecture-review (Skill 3): ADR-0005 lines 53/73/111-119 mandate InputEventQueue (ring buffer, 8 entries, drained at simulation Step 2) for CameraToggle routing, while ADR-0010 line 39 and this GDD use direct InputAction.performed routing in DynamicUpdate. The GDD follows ADR-0010 + decision #1450 and is correct; ADR-0005's InputEventQueue is obsolete and must be reconciled in the architecture review.

Prior verdict resolved: Yes — the 25/07 APPROVED verdict stood; the rename introduced no regressions.
