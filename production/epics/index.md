# Epics Index

Last Updated: 2026-08-16
Engine: Unity 6000.3.22f1 (Unity 6.3 LTS)

| Epic | Layer | System | GDD | Stories | Status |
|------|-------|--------|-----|---------|--------|
| Input System | Foundation | Input | design/gdd/input-system.md | 8 (8 done) | Done |
| Simulation Kernel | Foundation | Simulation Architecture | design/gdd/simulation-architecture.md | 8 (8 done) | Done |
| Settings | Foundation | Settings | design/gdd/settings.md | 6 (6 done) | Done — stories 3-2..3-7 complete (persistence/migration, edit session, difficulty profile, control bindings, display confirm, values contract) |
| Content Pipeline | Foundation | Content Pipeline | design/gdd/content-pipeline.md | 7 (7 done) | COMPLETE — all stories done (Address Mirror, State Machine & Kernel Handshake, Race Load, Race Unload, Startup/Catalog/Fatal, Loading Screen, Quality Profiles WebGL) |
| Ghost Recording | Foundation | Ghost Recording | design/gdd/ghost-recording.md | 0 (0 done) | Ready (MVP buffer delivered by Simulation Kernel story 2-8 — Pcg32, GhostBuffer, DeterminismHarness; storage/CRC32/cache/cloud are Alpha scope) |
| Multiplayer Architecture | Foundation | Multiplayer Architecture | design/gdd/multiplayer-architecture.md | 1 (1 done) | Done — story 3-1 (Isolation Boundary) complete; constraint epic (no runtime network in MVP; ADR-0016/0017 ratified) |
| Vehicle Physics — Dynamics | Core | Vehicle Physics | design/gdd/vehicle-physics.md | 5 (0 done) | Ready — S1·F1, est. 5 stories, ADR-0002/0001, kernel step 6 |
| Vehicle Physics — Feel & Telemetry | Core | Vehicle Physics | design/gdd/vehicle-physics.md | 5 (0 done) | Ready — S1·F1, est. 5 stories, ADR-0002/0014/0010, telemetry contract + dev rig |
| Race Flow | Core | RSM + Qualifying + Grid & Start | design/gdd/race-session-manager.md + qualifying.md + grid-start.md | 8 (0 done) | Ready — S1·F2, est. 8 stories, ADR-0018/0013, kernel steps 9/10 |
| AI Rival | Core | AI Rival | design/gdd/ai-rival.md | 8 (0 done) | Ready — S1·F3, est. 8 stories, ADR-0009, kernel step 13 |
| Track | Core | Track | design/gdd/track-system.md | 8 (0 done) | Ready — S2·F1, est. 8 stories, ADR-0007, 4 MVP tracks |
| Car Definition Data | Core | Car Definition Data | design/gdd/car-definition-data.md | 4 (0 done) | Ready — S2·F1, est. 4 stories, ADR-0015, 16 teams |
| Race Strategy | Core | Fuel + Tire + Pit Stop | design/gdd/fuel-system.md + tire-system.md + pit-stop.md | 5 (0 done) | Ready — S2·F2, est. 5 stories, ADR-0006/0011, kernel steps 5a/5b/9b |
| Camera | Core + Presentation | Camera | design/gdd/camera.md | 4 (0 done) | Ready — S2·F3, est. 4 stories, ADR-0010 |
| HUD | Core + Presentation | HUD | design/gdd/hud.md | 4 (0 done) | Ready — S2·F3, est. 4 stories, ADR-0014 |
| Audio | Core + Presentation | Audio | design/gdd/audio-system.md | 4 (0 done) | Ready — S2·F3, est. 4 stories, ADR-0012 |
| VFX | Presentation | VFX | design/gdd/vfx.md | 3 (0 done) | Ready — S2·F3, est. 3 stories, ADR-0010 |
| UI Menu | Presentation | UI Menu | design/gdd/ui-menu.md | 6 (0 done) | Ready — S2·F4, est. 6 stories, ADR-0019, production bootstrapper (TD-038) |

**Processing order (per systems-index.md Dependency Layers):**
1. Foundation: Input → Simulation Kernel → Settings → Content Pipeline → Ghost Recording → Multiplayer Architecture (COMPLETE)
2. Core (12 epics, 2-orchestrator plan 2026-08-16, 4 phases): S1 kernel/loop (vehicle-physics-dynamics → vehicle-physics-feel → race-flow → ai-rival) + S2 data/presentation (track+car-definition-data → race-strategy → camera+hud+audio+vfx → ui-menu). Estimates in stories (calibrated 0.3×); sessions run parallel on own branches, merge to main per phase (bridges: VP→consumers; Track/CarDef→AI).

**Handoff sequence (story-level, per PR-EPIC review 2026-08-06):**
Input contracts → Kernel contract spine → Content Pipeline (lifecycle contracts) → Kernel lifecycle/replay integration closure, with Settings `DifficultyProfile` schema available before the final closure. Core-epic pipeline integrations (Steps 5a/5b, 6, 9b, 10, 13) are delivered by the owning Core epics per the Simulation Kernel Integration Contract — no retroactive wiring stories.

**Next steps:**
- **Core layer epics READY (12/12 created 2026-08-16) + ALL stories created 2026-08-16** — 64 Core stories (17 S1 dynamics/feel + 8 race-flow + 8 ai-rival; 13 S2 data/strategy + 18 presentation) + 30 Foundation = 94 total. Track grew 5→8 on 2026-08-16 (006 trackside manifest/validation, 007 authoring tool, 008 runtime assembly) per the track-authoring decision (spline + placement manifest mounted at runtime, one generic scene, reference circuits measured not redistributed). Next: `/sprint-plan` with real story counts + topic branch merge. Two-session plan at `docs/plans/sprint4-mvp-flow-2026-08-16.html`.
- Foundation layer COMPLETE (Sprint 3 closed 14/14 on 2026-08-15; retrospective at `production/sprints/sprint-3-retrospective.md`; gate production→polish FAIL advisory — blockers are all post-Core).
- Pre-Production → Production gate passed 2026-08-09 (user override; report at `production/gate-checks/pre-production-to-production-2026-08-09.md`). Core epics deferred per #1816 until Foundation matures.
- Known pre-story sign-off resolved 2026-08-06: systems-index.md Progress Tracker updated to Approved for Input / Simulation Architecture / Content Pipeline (evidence: ADR-0003:240 ratification 2026-08-05, ADR-0005:136-140 sanitization, architecture-review v6 2026-08-06 0 conflicts). Tracker now matches GDD headers.
