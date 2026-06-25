# Tech Debt Register

- **2026-06-24** (Story 002: Core Event Bus): ~~`once()` stub not tested~~ — RESOLVED in Story 003
- **2026-06-24** (Story 003: Edge Cases): qa-lead QL-TEST-COVERAGE reported inaccurate test counts per AC (e.g., AC-4a: said 4, actual 3) — coverage verdict correct but counts unreliable — tracked from production/epics/event-bus/story-003-edge-cases.md
- **2026-06-24** (Story 001: Core FSM): `getCurrentState()` is public with `@internal` tag — ADR-0024 Decision 6 rejects "available but discouraged" pattern. Acceptable for Story 001 (tests need it), but should be restricted or removed when Story 003 (Event Bus) lands — tracked from production/epics/game-state-machine/story-001-core-fsm-transition-table.md
- **2026-06-24** (Story 002: Async Lifecycle Hooks): `console.warn` in foundation module (line 225) — hard to intercept/redirect. Replace with Event Bus emission when Story 003 lands — tracked from production/epics/game-state-machine/story-002-async-lifecycle-hooks.md
