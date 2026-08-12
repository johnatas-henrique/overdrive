# Story 003: DifficultyProfile Data & Race Snapshot

> **Epic**: Settings
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: L (5-6h)

## Context

**GDD**: `design/gdd/settings.md`
**Requirement**: `TR-settings-004`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0004: Settings Persistence and Control Profile Schema; ADR-0001: Manual Simulation Authority and Determinism Boundary
**ADR Decision Summary**: DifficultyProfile is immutable and snapshotted at race initialization by Simulation; current-race difficulty never changes. Five profiles (Very Easy through Very Hard) live as ScriptableObject assets under `Assets/Settings/Difficulty/`. Settings owns the assets; Simulation snapshots the resolved struct at race init via `Settings.GetProfile(id)`. Car Definition stats and stat-to-physics formulas remain immutable at every difficulty.

**Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS) | **Risk**: HIGH (cross-assembly contract expansion — Simulation owns the difficulty contract per ADR-0001)

**Engine Notes**: DifficultyProfile is a Simulation-owned contract (ADR-0001 — Simulation transports the profile to race consumers). This story expands the existing Level-only stub to the full field set — additive, preserving constructor compatibility.

**Control Manifest Rules (Foundation layer)**:
- Required: 5 DifficultyProfiles (Very Easy–Very Hard); Difficulty is immutable, snapshotted at race init; Settings blocked during active Countdown — source: ADR-0004
- Guardrail: Difficulty is immutable per race — snapshotted at race initialization, never mutated mid-race — source: ADR-0004, ADR-0001

---

## Acceptance Criteria

*From GDD `design/gdd/settings.md`, scoped to this story:*

- [ ] **AC-D1**: Given Very Easy is selected, When the race profile resolves, Then the profile contains AI precision 90%, error multiplier 1.5, pace noise ±8%, player off-track grip 0.60, and wall speed loss 0.20. *(Tier-pressure benchmark DEFERRED — TD-024.)*
- [ ] **AC-D2**: Given Easy is selected, When the race profile resolves, Then the values match the Easy row (95%, 1.2×, ±5%, 0.50, 0.30). *(Benchmark deferred — TD-024.)*
- [ ] **AC-D3**: Given Normal is selected, When the race profile resolves, Then the values match the Normal row (100%, 1.0×, ±2%, 0.40, 0.40). *(Benchmark deferred — TD-024.)*
- [ ] **AC-D4**: Given Hard is selected, When the race profile resolves, Then the values match the Hard row (100%, 0.5×, ±0%, 0.30, 0.50). *(Benchmark deferred — TD-024.)*
- [ ] **AC-D5**: Given Very Hard is selected, When the race profile resolves, Then the values match the Very Hard row (100%, 0.0×, ±0%, 0.25, 0.60). *(Benchmark deferred — TD-024.)*
- [ ] **AC-D7** (canonical — AM2 cross-references this): Given player changes Difficulty from menu outside an active race, When Apply succeeds, Then the selected profile ID is stored and used for the next race. Difficulty cannot change the current race snapshot.
- [ ] **AC-D8** (scoped): Given all five DifficultyProfiles, When their schema is inspected, Then the schema contains NO mutable Car Definition stats or stat-to-physics formula fields — only AI and player-recovery fields differ. *(Full cross-difficulty identity proof DEFERRED — TD-025.)*

---

## Implementation Notes

*Derived from ADR-0004 + ADR-0001 Implementation Guidelines:*

- **Simulation contract expansion** (F7): `DifficultyProfile` in `Overdrive.Simulation` (`Assets/source/Simulation/SimulationContracts.cs:186-192`) is currently `public DifficultyProfile(int level = 0) => Level = level;` — Level-only. This story expands it additively to:
  ```csharp
  public readonly struct DifficultyProfile {
      public readonly int Level;            // 0-4 (Very Easy..Very Hard)
      public readonly float AiPrecision;    // 0.90 / 0.95 / 1.00 / 1.00 / 1.00
      public readonly float AiErrorMultiplier; // 1.5 / 1.2 / 1.0 / 0.5 / 0.0
      public readonly float PaceNoise;      // 0.08 / 0.05 / 0.02 / 0.0 / 0.0 (±)
      public readonly float PlayerOffTrackGrip;   // 0.60 / 0.50 / 0.40 / 0.30 / 0.25
      public readonly float PlayerWallSpeedLoss;  // 0.20 / 0.30 / 0.40 / 0.50 / 0.60
  }
  ```
  Constructor compatibility preserved (existing `new DifficultyProfile(level)` call sites compile). ReplayInitialState already carries it immutably (SimulationContracts.cs:391-420) and the GO capture input/provider also carry it (424-460) — expansion is additive.
- **5 ScriptableObject assets** (ADR-0004:167): `Assets/Settings/Difficulty/Difficulty_VeryEasy.asset` … `Difficulty_VeryHard.asset` — one per tier, Settings-owned. Created + validated (fields in approved ranges) by this story or a dependent Config/Data story.
- **`Settings.GetProfile(id)`** (ADR-0004:167): Settings-owned resolver that maps a stored profile ID → the immutable Simulation `DifficultyProfile` struct.
- **Race-init composition root**: a seam supplies the immutable profile to `ReplayInitialState` at race initialization. Test proves the captured profile is immutable and selected by ID. (The GO capture already carries DifficultyProfile — verify wiring through the existing `IReplayInitialStateProvider` seam from Story 2-8.)
- **Field name normalization** (GDD:94): Settings "AI precision" → `ai_precision` internal; "AI error mult" → `ai_error_multiplier`; "Pace noise" → `pace_noise`; "Player off-track grip" → `player_off_track_grip`; "Player wall speed loss" → `player_wall_speed_loss`.
- **Immutability**: No current-race setting change mutates the snapshot (GDD:94, ADR-0001).

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- AC-D1..D5 tier-pressure benchmark → AI Rival + Vehicle Physics assembly gate (TD-024)
- AC-D8 full Car Definition/AI/Physics identity invariant → AI/VP/CarDef integration epic (TD-025)
- AC-D6 (Difficulty disabled in paused race) → Story 002 lifecycle
- Profile values as balance data tuning (the 5 rows themselves) → balance-tuning workflow, not code

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate, round 3). The developer implements against these — do not invent new test cases during implementation.*

- **AC-D1**: Given Very Easy profile; When resolve race profile; Then values are 90%, 1.5×, ±8%, 0.60, 0.20. Tier-pressure benchmark is deferred to TD-024.
- **AC-D2**: Given Easy; When resolve; Then profile values match Easy row. Benchmark deferred.
- **AC-D3**: Given Normal; When resolve; Then profile values match Normal row. Benchmark deferred.
- **AC-D4**: Given Hard; When resolve; Then profile values match Hard row. Benchmark deferred.
- **AC-D5**: Given Very Hard; When resolve; Then profile values match Very Hard row. Benchmark deferred.
- **AC-D7**: Given no active race; When Apply selected difficulty; Then ID persists and is used at next race initialization. Given active race; Then current snapshot remains unchanged.
- **AC-D8**: Given all five profiles; When compare Car Definition/stat-formula fields; Then immutable car fields and formulas are identical. Full AI/VP/CarDef integration deferred to TD-025.
- **AC-AM2**: Given changed difficulty outside race; When Apply then initialize next race; Then next race receives new profile while current race remains immutable.

---

## Test Evidence

**Story Type**: Integration
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/settings/DifficultyProfileTests.cs` — profile data + resolver + immutability
- Integration: `Assets/tests/integration/settings/DifficultyProfileIntegrationTests.cs` — race-init composition-root seam supplies immutable profile to ReplayInitialState

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (Settings Persistence & Migration) — DONE; Simulation Kernel Story 2-8 (ReplayInitialState + IReplayInitialStateProvider seam) — DONE
- Unlocks: None directly (AI Rival + Vehicle Physics consume the expanded profile in their epics)
