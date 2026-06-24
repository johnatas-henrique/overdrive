# Sprint 1 Risk Register

> **Last Updated**: 2026-06-24
> **Owner**: producer (solo dev)
> **Review Cadence**: Weekly (each Friday)

| #  | Risk | Probability | Impact | Mitigation | Owner | Review Date | Status |
|----|------|-------------|--------|------------|-------|-------------|--------|
| 1 | Foundation underestimation (first sprint, no velocity baseline) | Medium | High | 11% margin + IA acceleration. Track actual hours per story in sprint-status.yaml. If midpoint actuals > 1.2× estimate, negotiate scope. | producer | 2026-07-08 | Active |
| 2 | Integration cascade — Stories 1-23 block all 6 Integration stories (11, 19, 22, 27, 28) | Medium | High | Implement in strict dependency order. Week 1 covers ConfigManager + EventBus (fast, low risk). Identify integration blockers early. | producer | 2026-07-01 | Active |
| 3 | Test infra not pre-built — going from 4 to ~85 tests | Low | Medium | Test patterns from existing SeededRandom tests. Vitest + helpers can be written inline per test file. | producer | 2026-06-30 | Active |
| 4 | HMR integration depends on Vite API details | Low | Medium | Story 003b is only 2h; spike early in week 1 to validate approach. | producer | 2026-06-27 | Active |
| 5 | Havok import side-effect (tree-shaking) | Low | High | Known pattern from scaffolding.md — already handled with side-effect import. | producer | 2026-06-24 | Monitored |
| 6 | Solo dev context switching / overcommit | Medium | Medium | 5-week sprint with 20% buffer. No parallel work outside sprint scope. | producer | 2026-07-08 | Active |
| 7 | Architecture.md audio references stale (V1 vs V2) | Low | Low | Corrected pre-sprint. No implementation depends on audio docs in Sprint 1. | producer | 2026-06-24 | Resolved |
| 8 | Deferred items from previous gate not tracked | Medium | Low | Backlog created — see `production/backlog/deferred-items.md`. Review weekly. | producer | 2026-06-24 | Resolved (prose expanded, 2026-06-24) |

## Risk Escalation

If any risk materialises (probability becomes near-certain or impact increases):

1. Log the escalation in this register with updated assessment
2. Evaluate scope negotiation within Sprint 1 (Should-Have tier is empty for this sprint — defer carryover to Sprint 2)
3. If blocker threatens sprint goal, escalate via `/help`
