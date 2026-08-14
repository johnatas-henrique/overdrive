# Epics Index

Last Updated: 2026-08-14
Engine: Unity 6000.3.22f1 (Unity 6.3 LTS)

| Epic | Layer | System | GDD | Stories | Status |
|------|-------|--------|-----|---------|--------|
| Input System | Foundation | Input | design/gdd/input-system.md | 8 (8 done) | Done |
| Simulation Kernel | Foundation | Simulation Architecture | design/gdd/simulation-architecture.md | 8 (8 done) | Done |
| Settings | Foundation | Settings | design/gdd/settings.md | 6 (6 done) | Done — stories 3-2..3-7 complete (persistence/migration, edit session, difficulty profile, control bindings, display confirm, values contract) |
| Content Pipeline | Foundation | Content Pipeline | design/gdd/content-pipeline.md | 7 (2 done) | In progress — stories 3-8 (Address Mirror) and 3-9 (State Machine & Kernel Handshake) done; 3-10..3-14 ready |
| Ghost Recording | Foundation | Ghost Recording | design/gdd/ghost-recording.md | 0 (0 done) | Ready (MVP buffer delivered by Simulation Kernel story 2-8 — Pcg32, GhostBuffer, DeterminismHarness; storage/CRC32/cache/cloud are Alpha scope) |
| Multiplayer Architecture | Foundation | Multiplayer Architecture | design/gdd/multiplayer-architecture.md | 1 (1 done) | Done — story 3-1 (Isolation Boundary) complete; constraint epic (no runtime network in MVP; ADR-0016/0017 ratified) |

**Processing order (per systems-index.md Dependency Layers — Foundation):**
1. Input System → 2. Simulation Kernel → 3. Settings → 4. Content Pipeline → 5. Ghost Recording → 6. Multiplayer Architecture

**Handoff sequence (story-level, per PR-EPIC review 2026-08-06):**
Input contracts → Kernel contract spine → Content Pipeline (lifecycle contracts) → Kernel lifecycle/replay integration closure, with Settings `DifficultyProfile` schema available before the final closure. Core-epic pipeline integrations (Steps 5a/5b, 6, 9b, 10, 13) are delivered by the owning Core epics per the Simulation Kernel Integration Contract — no retroactive wiring stories.

**Next steps:**
- Run `/create-stories [epic-slug]` per epic, in processing order
- Pre-Production → Production gate passed 2026-08-09 (user override; report at `production/gate-checks/pre-production-to-production-2026-08-09.md`). Core epics deferred per #1816 until Foundation matures.
- Known pre-story sign-off resolved 2026-08-06: systems-index.md Progress Tracker updated to Approved for Input / Simulation Architecture / Content Pipeline (evidence: ADR-0003:240 ratification 2026-08-05, ADR-0005:136-140 sanitization, architecture-review v6 2026-08-06 0 conflicts). Tracker now matches GDD headers.
