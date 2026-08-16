# Epic: Content Pipeline

> **Layer**: Foundation
> **GDD**: design/gdd/content-pipeline.md
> **Architecture Module**: Content Pipeline (Foundation Layer — module ownership per docs/architecture/architecture.md:145-152)
> **Status**: Ready (stories created)
> **Stories**: 7 created — 001 Content Groups & Address Mirror, 002 CP_ State Machine & Kernel Handshake, 003 Race Load Orchestration, 004 Race Unload, 005 Startup/Catalog/Fatal Errors, 006 Loading Screen, 007 Quality Profiles (WebGL)

## Overview

Content Pipeline is the asset loading and packaging layer that manages how game content — cars, tracks, audio, UI, VFX — is organized into Addressable groups (Shared / `Cars/{teamId}` / `Tracks/{trackId}`), loaded on demand per race (track + 16 car bundles in parallel), and unloaded when no longer needed (instances first via `ReleaseInstance`, then base handles via `Release`). It owns the CP_ state machine (Idle/Loading Track/Loading Cars/Ready/Racing/Race Reconfigure/Unloading), the loading screen (progress by bytes, 0.5s minimum, input blocked), and the error contracts (car failure is recoverable via `CarLoadDegraded`, track failure aborts via `ContentLoadError`, Shared failure is fatal, catalog init retries once). The epic's Foundation stories prove behavior with fixtures — state transitions, async loading, error handling, cleanup, loading UI. Memory budgets (PC 730–1320 MB / WebGL 415–670 MB), load ceilings (5s PC / 10s Web), and WebGL limits are declared targets whose measured verification is owned by the ADR-0001 16-car profiling gate and its follow-up benchmark ADR — not by this epic's stories.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0003: Content Pipeline and Addressables | 3 Addressable group categories; parallel loading; CP_ state machine; per-car/per-track bundles; `ReleaseInstance`/`Release` unload order; `CarLoadDegraded` non-fatal | MEDIUM |
| ADR-0001: Manual Simulation Authority and Determinism Boundary | `ContentLoadRequest`/`RaceLoadReady`/`ContentUnloadRequest`/`ContentUnloadComplete` handshake with Simulation; Content never writes `SimulationState`; Back/Cancel blocked after loading begins | HIGH |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-content-001 | 3 Addressable groups: Shared, Cars/{teamId}, Tracks/{trackId} | ADR-0003 ✅ |
| TR-content-002 | Parallel loading of track + 16 car bundles | ADR-0003 ✅ |
| TR-content-003 | CP_ state machine with RaceReconfigure for qualifying-to-race transition | ADR-0003 ✅ |
| TR-content-004 | Error handling: car failure → CarLoadDegraded (non-fatal, continue with 15); track abort → ContentLoadError; shared fatal; catalog retry | ADR-0003 ✅ |
| TR-content-005 | Memory budgets: PC 730-1320 MB, WebGL 415-670 MB per race | ADR-0003 ✅ (dependent verification — representative Core car/track content required; validated by the ADR-0001 16-car profiling gate + follow-up benchmark ADR, per simulation-architecture.md:56) |
| TR-content-006 | Addressable instances and handles are released with `ReleaseInstance`/`Release`; race unload completes before Idle | ADR-0001, ADR-0003 ✅ |
| TR-content-007 | Race loading must complete within 5 seconds on PC and 10 seconds on Web | ADR-0003 ✅ (dependent verification — measured against real content once representative Core assets exist; declared target, not a Foundation-fixture assertion) |
| TR-content-008 | Back/Cancel is blocked after loading begins; unload and partial-failure cleanup have explicit completion signals | ADR-0001, ADR-0003 ✅ |

**Untraced requirements**: None — 8/8 covered by Accepted ADRs.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/content-pipeline.md` are verified (behavioral criteria with fixtures)
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`
- The lifecycle handshake contracts with the Simulation Kernel close: `RaceLoadReady(RaceMode.Qualifying)`, `RaceLoadReady(RaceMode.Race, gridAssignment)`, `ContentLoadError`, `ContentUnloadComplete` verified against the Kernel's published contracts
- TR-content-005/007 (budgets, load ceilings) and WebGL limits (heap 768MB, ASTC 6×6, 3 LODs, ≤3MB bundles) are recorded as dependent verification owned by the profiling gate — the epic declares the targets, does not claim to pass them without representative content

## Next Step

Run `/story-readiness [story-path]` then `/dev-story [story-path]` for each story, in dependency order: 001 → 002 → 003 → 004/005/006 → 007.

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Content Groups & Address Mirror | Config/Data + Editor | Ready | ADR-0003 |
| 002 | CP_ State Machine & Kernel Handshake | Logic | Ready | ADR-0003, ADR-0001 |
| 003 | Race Load Orchestration | Integration | Ready | ADR-0003 |
| 004 | Race Unload | Logic | Ready | ADR-0003 |
| 005 | Startup, Catalog & Fatal Errors | Logic | Ready | ADR-0003 |
| 006 | Loading Screen | UI | Ready | ADR-0003 |
| 007 | Quality Profiles (WebGL) | Integration | Ready | ADR-0003, ADR-0010 |
