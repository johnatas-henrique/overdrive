# Epics Index

Last Updated: 2026-08-06
Engine: Unity 6000.3.19f1 (Unity 6.3 LTS)

| Epic | Layer | System | GDD | Stories | Status |
|------|-------|--------|-----|---------|--------|
| Input System | Foundation | Input | design/gdd/input-system.md | Not yet created | Ready |
| Simulation Kernel | Foundation | Simulation Architecture | design/gdd/simulation-architecture.md | Not yet created | Ready |
| Settings | Foundation | Settings | design/gdd/settings.md | Not yet created | Ready |
| Content Pipeline | Foundation | Content Pipeline | design/gdd/content-pipeline.md | Not yet created | Ready |
| Ghost Recording | Foundation | Ghost Recording | design/gdd/ghost-recording.md | Not yet created | Ready (enabling/traceability — MVP buffer owned by Simulation Kernel) |
| Multiplayer Architecture | Foundation | Multiplayer Architecture | design/gdd/multiplayer-architecture.md | Not yet created | Ready (constraint — no runtime network in MVP) |

**Processing order (per systems-index.md Dependency Layers — Foundation):**
1. Input System → 2. Simulation Kernel → 3. Settings → 4. Content Pipeline → 5. Ghost Recording → 6. Multiplayer Architecture

**Handoff sequence (story-level, per PR-EPIC review 2026-08-06):**
Input contracts → Kernel contract spine → Content Pipeline (lifecycle contracts) → Kernel lifecycle/replay integration closure, with Settings `DifficultyProfile` schema available before the final closure. Core-epic pipeline integrations (Steps 5a/5b, 6, 9b, 10, 13) are delivered by the owning Core epics per the Simulation Kernel Integration Contract — no retroactive wiring stories.

**Next steps:**
- Run `/create-stories [epic-slug]` per epic, in processing order
- Run `/gate-check pre-production` after Foundation + Core epics complete (Foundation + Core are required for the Pre-Production → Production gate)
- Known pre-story sign-off resolved 2026-08-06: systems-index.md Progress Tracker updated to Approved for Input / Simulation Architecture / Content Pipeline (evidence: ADR-0003:240 ratification 2026-08-05, ADR-0005:136-140 sanitization, architecture-review v6 2026-08-06 0 conflicts). Tracker now matches GDD headers.
