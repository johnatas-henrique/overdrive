# Epic: Settings

> **Layer**: Foundation
> **GDD**: design/gdd/settings.md
> **Architecture Module**: Settings (Foundation Layer — module ownership per docs/architecture/architecture.md:136-143)
> **Status**: Ready (stories created)
> **Stories**: 6 created — 001 Persistence & Migration, 002 EditSession & Lifecycle, 003 DifficultyProfile, 004 Control Bindings, 005 Display & Quality, 006 Values Contract

## Overview

Settings is the centralized configuration layer that stores and applies player preferences across all game systems — difficulty level, control remapping, audio volume, display options, and accessibility features. It persists between sessions as a single JSON blob in `PlayerPrefs` with a backup-first atomic write sequence, exposes values to every gameplay system at startup, and previews supported runtime changes through a transactional edit session (`SettingsEditSession` with snapshot/working/Apply/Cancel). Difficulty is delivered to Simulation as an immutable `DifficultyProfile` snapshotted at race initialization. Without this epic, every player preference would need its own ad-hoc storage, leading to inconsistent behavior and lost configurations between sessions.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0004: Settings Persistence and Control Profiles | PlayerPrefs single JSON blob with backup-first write and explicit `PlayerPrefs.Save()`; transactional preview; schema migration v1→v3; per-field profile validation with default fallback | LOW |
| ADR-0001: Manual Simulation Authority and Determinism Boundary | `DifficultyProfile` is immutable and snapshotted at race initialization by Simulation; current-race difficulty never changes | HIGH |
| ADR-0010: Camera/VFX Rendering Budget and Interpolation | Quality presets configure render scale and VFX density; camera shake / Reduced Motion preferences consumed by Camera | MEDIUM |
| ADR-0014: HUD Data Contract and Layout | `show_chase_hud_in_cockpit` controls chase-overlay visibility without changing HUD data ownership | MEDIUM |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-settings-001 | Single JSON blob in PlayerPrefs under OverdriveSettings with backup-first atomic write | ADR-0004 ✅ |
| TR-settings-002 | Schema migration v1 to v3 with sequential version processing | ADR-0004 ✅ |
| TR-settings-003 | SettingsEditSession with snapshot, working copy, and Apply/Cancel | ADR-0004 ✅ |
| TR-settings-004 | DifficultyProfile immutable per race; snapshotted at race initialization | ADR-0001, ADR-0004 ✅ |
| TR-settings-005 | ControlProfile validation: stick_inner < stick_outer, EMA alpha in 0 to 1; invalid falls back to defaults | ADR-0004 ✅ |
| TR-settings-006 | Display changes use `RefreshRate`, a 15-second confirmation, and rollback on timeout, cancellation, or focus loss | ADR-0004 ✅ |
| TR-settings-007 | `show_chase_hud_in_cockpit` controls chase-overlay visibility without changing HUD data ownership | ADR-0004, ADR-0014 ✅ |
| TR-settings-008 | Four quality presets configure render scale and VFX density without requiring recompilation | ADR-0004, ADR-0010 ✅ |

**Untraced requirements**: None — 8/8 covered by Accepted ADRs.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/settings.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`
- The `DifficultyProfile` schema is published and consumed by the Simulation Kernel's GO lifecycle closure (per the Kernel handoff sequence — the profile ID is part of `ReplayInitialState`)
- Binding overrides are keyed to the Input System's stable action/binding IDs (Input epic handoff); trigger threshold remains Input-owned tuning

## Next Step

Run `/story-readiness [story-path]` then `/dev-story [story-path]` for each story, in dependency order: 001 → 002 → 003/004/005/006 (003-006 depend on 001; 005 also depends on 002).

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Settings Persistence & Migration | Logic | Ready | ADR-0004 |
| 002 | SettingsEditSession & Lifecycle | Logic | Ready | ADR-0004 |
| 003 | DifficultyProfile Data & Race Snapshot | Integration | Ready | ADR-0004, ADR-0001 |
| 004 | Control Bindings & Rebinding State Machine | Logic | Ready | ADR-0004, ADR-0005 |
| 005 | Display Confirm & Quality Presets | Integration | Ready | ADR-0004, ADR-0010 |
| 006 | Settings Values Contract | Logic | Ready | ADR-0004, ADR-0010, ADR-0014 |
