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

## Execution Order (Linear — Solo Dev)

```
1.  Tech Debt Cleanup (4 CRITICALs + WARNings)
2.  Telemetry 001: Data Model
3.  Telemetry 002: Sampling Loop
4.  Telemetry 003: Console Summary
5.  Telemetry 004: JSON Export
6.  Telemetry 005: Race Lifecycle
7.  Telemetry 006: Noop Behavior
8.  Dev Tools 001: Compile Guard
9.  Dev Tools 003: HTML Overlay ← provides IDevTools interface
10. Dev Tools 002: Input Keybinds ← depends on IDevTools.toggle()
11. Dev Tools 004: Config Tree
12. Dev Tools 005: Event Bus Inspector
13. Dev Tools 006: GSM Visualizer
14. Dev Tools 007: Sim Snapshot Panel
15. Dev Tools 008: AI Telemetry Tab  ← uses Telemetry data model
16. Input 001: Interface Types
17. Input 002: Dead Zone Formula
18. Input 003: Player Input Polling
19. Input 004: Focus/Disconnect Safety
20. Input 005: GSM State Integration
21. Input 006: Debounce Edge Cases
22. Input 007: Device Detection
23. Asset Manager 001: Init Two-Scene (replace playground)
24. Asset Manager 002: Load Cache
25. Asset Manager 003: Loading Events
26. Asset Manager 004: Unload/Dispose Edge Cases
27. Asset Manager 005a: Preload Concurrency
28. Asset Manager 005b: GSM Orchestration
29. Physics 001: Core Skeleton
30. Physics 002: Arcade Grip Model
31. Physics 003: Engine/Gears/Drag/Braking
32. Physics 004: Surface Handling (Offtrack/Kerbs)
33. Physics 005: Lock/Pit/External Inputs/Events
34. Camera 001: Foundation
35. Camera 002: GSM Camera Lifecycle
36. Camera 003: Cockpit Camera
37. Camera 004: Chase Camera Occlusion
38. Camera 005: Cockpit/Chase Toggle
39. Camera 006: Speed FOV Shift
40. Camera 007: Camera Shake System
41. Camera 008: Drone Camera Orbit
42. Camera 009: Head Bob + Lateral Lean
43. Camera 010: Camera Config HMR
```

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
| 16 | Input 001: Interface Types                   | 2h    | —          |
| 17 | Input 002: Dead Zone Formula                 | 3h    | #16        |
| 18 | Input 003: Player Input Polling              | 10h   | #17        |
| 19 | Input 004: Focus/Disconnect Safety           | 5h    | #18        |
| 20 | Input 005: GSM State Integration             | 5h    | #18        |
| 21 | Input 006: Debounce Edge Cases               | 4h    | #18        |
| 22 | Input 007: Device Detection                  | 3h    | #16        |
| 23 | Asset Manager 001: Init Two-Scene            | 6h    | —          |
| 24 | Asset Manager 002: Load Cache                | 10h   | #23        |
| 25 | Asset Manager 003: Loading Events            | 8h    | #24        |
| 26 | Asset Manager 004: Unload/Dispose Edge Cases | 10h   | #24        |
| 27 | Asset Manager 005a: Preload Concurrency      | 8h    | #24        |
| 28 | Asset Manager 005b: GSM Orchestration        | 6h    | #23        |
| 29 | Physics 001: Core Skeleton                   | 20h   | #22        |
| 30 | Physics 002: Arcade Grip Model               | 10h   | #29        |
| 31 | Physics 003: Engine/Gears/Drag/Braking       | 10h   | #30        |
| 32 | Physics 004: Surface Handling (Offtrack)     | 6h    | #30        |
| 33 | Physics 005: Lock/Pit/External Inputs        | 12h   | #30        |
| 34 | Camera 001: Foundation                       | 8h    | #29        |
| 35 | Camera 002: GSM Camera Lifecycle             | 8h    | #34        |
| 36 | Camera 003: Cockpit Camera                   | 10h   | #34        |
| 37 | Camera 004: Chase Camera Occlusion           | 10h   | #36        |
| 38 | Camera 005: Cockpit/Chase Toggle             | 4h    | #36, #37   |
| 39 | Camera 006: Speed FOV Shift                  | 4h    | #34        |
| 40 | Camera 007: Camera Shake System              | 8h    | #34        |
| 41 | Camera 008: Drone Camera Orbit               | 8h    | #34        |
| 42 | Camera 009: Head Bob + Lateral Lean          | 5h    | #36        |
| 43 | Camera 010: Camera Config HMR                | 4h    | #34        |

### Should Have

(Empty — all 43 stories are critical path for Core A)

### Nice to Have

(None)

### Execution Phases

Sequential execution — one story at a time:

| Phase | Stories                         | Est.  |
| ----- | ------------------------------- | ----- |
| 1     | #1 (Tech Debt)                  | 25h   |
| 2     | #2-7 (Telemetry 001-006)        | 26h   |
| 3     | #8-15 (Dev Tools 001-008)       | 44h   |
| 4     | #16-22 (Input)                  | 32h   |
| 5     | #23-28 (Asset Manager)          | 48h   |
| 6     | #29-33 (Physics)                | 58h   |
| 7     | #34-43 (Camera)                 | 69h   |

## Carryover from Previous Sprint

N/A — Sprint 1 complete with zero carryover.

## Risks

| Risk                                   | Probability | Impact | Mitigation                                     |
| -------------------------------------- | ----------- | ------ | ---------------------------------------------- |
| CRITICAL tech-debt reveals more issues | Medium      | High   | 25h estimate includes investigation buffer     |
| Physics Havok integration complexity   | Medium      | High   | ADR-0008 defines 3-phase approach; follow spec |
| Camera chase occlusion edge cases      | Low         | Medium | 10h estimate; simplify if needed               |
| 43 stories in 2 weeks                  | Low         | Medium | AI acceleration ~9× from Sprint 1              |

## Dependencies on External Factors

- Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12 — already installed
- Foundation layer (Sprint 1) — complete, merged to main

## Definition of Done for this Sprint

- [ ] All 43 stories completed
- [ ] Tech debt register cleaned (4 CRITICALs resolved)
- [ ] Playground removed (replaced by Asset Manager two-scene setup)
- [ ] All stories have passing unit tests
- [ ] Smoke check passed
- [ ] No S1 or S2 bugs
- [ ] Code reviewed and merged to main
- [ ] Previous action items from retro addressed: PR review as blocking gate
