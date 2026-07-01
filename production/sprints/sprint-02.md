# Sprint 2 — Core A: "Carro na Tela"

> **Period**: 2026-06-27 to 2026-07-10 (2 weeks)
> **Mode**: full
> **Review Mode**: full

## Sprint Goal

Deliver the complete Core A layer — dev infrastructure, telemetry, input, asset management, camera, and physics — achieving "Carro na Tela" (car on screen with drivable physics).

## Capacity

| Metric            | Value            |
| ----------------- | ---------------- |
| Total days        | 10 (2 weeks × 5)|
| Hours/day         | 8                |
| Gross capacity    | 80h              |
| Buffer (20%)      | 16h              |
| **Available**         | **64h**              |
| Implementation    | ~302h estimated  |

> **Note**: Sprint 1 achieved ~9× AI acceleration (142h estimated → ~16h actual).
> Expected actual time: ~34h total.

## Execution Order (Parallel — 2 Agent Sessions)

```
COMPLETED (30/45):
  1.    Tech Debt Cleanup (4 CRITICALs + WARNings)          ✅
  2-7.  Telemetry 001-006                                  ✅
  8-16. Dev Tools 001-009                                  ✅
  17.   Tech Debt Full Cleanup (48 items)                    ✅
  18-24. Input 001-007                                     ✅
  25-30. Asset Manager 001-005b                            ✅

REMAINING (15/45):

  Phase 1 (Linear — main):
  31. Physics 001: Core Skeleton

  Phase 2 (Parallel — 2 worktrees):
  Session A (Physics)        │ Session B (Camera)
  ───────────────────────────│─────────────────────
  32. Physics 002: Grip      │ 36. Camera 001: Foundation
  33. Physics 003: Engine    │ 37. Camera 002: GSM Lifecycle
  34. Physics 004: Surface   │ 38. Camera 003: Cockpit
  35. Physics 005: Lock/Pit  │ 39. Camera 004: Occlusion
                             │ 40. Camera 005: Toggle
                             │ 41. Camera 006: FOV Shift
                             │ 42. Camera 007: Shake
                             │ 43. Camera 008: Drone
                             │ 44. Camera 009: Head Bob
                             │ 45. Camera 010: Config HMR
```

**Parallel rules:**
- Phase 1: Physics 001 runs on main (prerequisite for everything)
- Phase 2: Two git worktrees after Physics 001 merges to main
- Session A branch: `feat/physics` (Physics 002-005)
- Session B branch: `feat/camera` (Camera 001-010)
- Each worktree runs its own dev server (different ports)
- Shared files (Foundation, config, types) are read-only during Phase 2
- Each session runs full OCGS workflow: /dev-story → /code-review → /story-done
- Merge order: Physics first, then Camera

**Parallel strategy**: Physics 001 completes first on main. Then Physics 002-005 (Session A) and Camera 001-010 (Session B) run in separate git worktrees. No file overlap (`src/physics/` vs `src/camera/`). Both branches depend on Physics 001 being in main.

**Story completion rule**: each story must achieve **100% coverage on all 4 metrics** (stmts/branches/functions/lines) before advancing to the next. No exceptions.

## Tasks

### Must Have (Critical Path)

| #  | Story                                        | Est.  | Depends On |
| -- | -------------------------------------------- | ----- | ---------- |
| 1  | Tech Debt Cleanup (4 CRITICALs + WARNings)   | 25h   | —          |
| 2  | Telemetry 001: Data Model                    | 3h    | —          |
| 3  | Telemetry 002: Sampling Loop                 | 6h    | #2         |
| 4  | Telemetry 003: Console Summary               | 3h    | #3         |
| 5  | Telemetry 004: JSON Export                   | 4h    | #3         |
| 6  | Telemetry 005: Race Lifecycle                | 6h    | #3         |
| 7  | Telemetry 006: Noop Behavior                 | 4h    | #2         |
| 8  | Dev Tools 001: Compile Guard                 | 3h    | —          |
| 9  | Dev Tools 002: Input Keybinds                | 3h    | #8         |
| 10 | Dev Tools 003: HTML Overlay                  | 10h   | #9         |
| 11 | Dev Tools 004: Config Tree                   | 6h    | #10        |
| 12 | Dev Tools 005: Event Bus Inspector           | 6h    | #10        |
| 13 | Dev Tools 006: GSM Visualizer                | 5h    | #10        |
| 14 | Dev Tools 007: Sim Snapshot Panel            | 6h    | #10        |
| 15 | Dev Tools 008: AI Telemetry Tab              | 5h    | #10, #2    |
| 16 | Dev Tools 009: CSS Refactor                  | 4h    | #14        |
| 17 | Tech Debt Full Cleanup (48 items)             | 40h   | #1-16      |
| 18 | Input 001: Interface Types                   | 2h    | —          |
| 19 | Input 002: Dead Zone Formula                 | 3h    | #18        |
| 20 | Input 003: Player Input Polling              | 10h   | #19        |
| 21 | Input 004: Focus/Disconnect Safety           | 5h    | #20        |
| 22 | Input 005: GSM State Integration             | 5h    | #20        |
| 23 | Input 006: Debounce Edge Cases               | 4h    | #20        |
| 24 | Input 007: Device Detection                  | 3h    | #18        |
| 25 | Asset Manager 001: Init Two-Scene            | 6h    | —          |
| 26 | Asset Manager 002: Load Cache                | 10h   | #25        |
| 27 | Asset Manager 003: Loading Events            | 8h    | #26        |
| 28 | Asset Manager 004: Unload/Dispose Edge Cases | 10h   | #26        |
| 29 | Asset Manager 005a: Preload Concurrency      | 8h    | #26        |
| 30 | Asset Manager 005b: GSM Orchestration        | 6h    | #25        |
| 31 | Physics 001: Core Skeleton                   | 20h   | #24        |
| 32 | Physics 002: Arcade Grip Model               | 10h   | #31        |
| 33 | Physics 003: Engine/Gears/Drag/Braking       | 10h   | #32        |
| 34 | Physics 004: Surface Handling (Offtrack)     | 6h    | #32        |
| 35 | Physics 005: Lock/Pit/External Inputs        | 12h   | #32        |
| 36 | Camera 001: Foundation                       | 8h    | #31        |
| 37 | Camera 002: GSM Camera Lifecycle             | 8h    | #36        |
| 38 | Camera 003: Cockpit Camera                   | 10h   | #36        |
| 39 | Camera 004: Chase Camera Occlusion           | 10h   | #38        |
| 40 | Camera 005: Cockpit/Chase Toggle             | 4h    | #38, #39   |
| 41 | Camera 006: Speed FOV Shift                  | 4h    | #36        |
| 42 | Camera 007: Camera Shake System              | 8h    | #36        |
| 43 | Camera 008: Drone Camera Orbit               | 8h    | #36        |
| 44 | Camera 009: Head Bob + Lateral Lean          | 5h    | #38        |
| 45 | Camera 010: Camera Config HMR                | 4h    | #36        |

### Should Have

(Empty — all 45 stories are critical path for Core A)

### Nice to Have

(None)

### Execution Phases

Parallel execution — 2 agent sessions after Physics 001:

| Phase | Session A                   | Session B              | Est.  |
| ----- | --------------------------- | ---------------------- | ----- |
| 1     | #1 (Tech Debt)              | —                      | 25h   |
| 2     | #2-7 (Telemetry 001-006)    | —                      | 26h   |
| 3     | #8-16 (Dev Tools 001-009)   | —                      | 48h   |
| 4     | #17 (Tech Debt Full Cleanup)| —                      | 40h   |
| 5     | #18-24 (Input 001-007)      | #25-30 (Asset Manager) | 32h   |
| 6     | #31 (Physics 001)           | — *(waits)*            | 20h   |
| 7     | #32-35 (Physics 002-005)    | #36-45 (Camera 001-010)| 58h+69h |

> **Phase 7 parallelism**: Physics 002-005 and Camera 001-010 run simultaneously.
> No file overlap (`src/physics/` vs `src/camera/`).
> Both branches depend on Physics 001 being in main.

## Carryover from Previous Sprint

N/A — Sprint 1 complete with zero carryover.

## Risks

| Risk                                   | Probability | Impact | Mitigation                                     |
| -------------------------------------- | ----------- | ------ | ---------------------------------------------- |
| CRITICAL tech-debt reveals more issues | Medium      | High   | 25h estimate includes investigation buffer     |
| Physics Havok integration complexity   | Medium      | High   | ADR-0008 defines 3-phase approach; follow spec |
| Camera chase occlusion edge cases      | Low         | Medium | 10h estimate; simplify if needed               |
| 45 stories in 2 weeks                  | Low         | Medium | AI acceleration ~9× from Sprint 1              |

## Dependencies on External Factors

- Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12 — already installed
- Foundation layer (Sprint 1) — complete, merged to main

## Definition of Done for this Sprint

- [ ] All 45 stories completed
- [ ] Tech debt register cleaned (4 CRITICALs resolved)
- [ ] Playground removed (replaced by Asset Manager two-scene setup)
- [ ] All stories have passing unit tests
- [ ] Smoke check passed
- [ ] No S1 or S2 bugs
- [ ] Code reviewed and merged to main
- [ ] Previous action items from retro addressed: PR review as blocking gate
