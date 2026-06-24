# Story 003: HudManager — Init, Grid & Lifecycle

> **Epic**: HUD
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/hud.md`
**Requirements**: `TR-HUD-001` (Single ADT with idealHeight=1080, responsive to 16:9/ultrawide) + `TR-HUD-005` (HUD lifecycle: activate on Racing, deactivate on PostRace, pit overlay on pit.status)

**ADR Governing Implementation**: ADR-0018: HUD Layout & Blocks
**ADR Decision Summary**: Single AdvancedDynamicTexture with idealHeight=1080, useSmallestIdeal=false. Grid with 3 proportional columns using widthFraction (left=0.20, center=0.58, right=0.22). Create-once/toggle-visibility lifecycle. All controls created at init, isVisible toggled per activation. Block registration via map of id→HudBlock.

**Engine**: Babylon.js 9.12.0 | **Risk**: MEDIUM
**Engine Notes**: `AdvancedDynamicTexture.CreateFullscreenUI("hud", true)` — not `new AdvancedDynamicTexture(...)`. Grid uses `addColumnDefinition(fraction)` — no `ColumnDefinition` wrapper class exists in 9.x. `addControl()` triggers layout recompute — must be called only at init.

**Control Manifest Rules (this layer)**:

- Required: P1 (single ADT, idealHeight=1080, useSmallestIdeal=false), P2 (Grid widthFraction, NO ParameterType.Star), P3 (create-once toggle-visibility)
- Forbidden: P-F4 (never use HTML/CSS for HUD), P-F5 (never destroy/recreate controls), P-F7 (never attach blocks directly to ADT)
- Guardrail: P-G1 (HUD < 0.3ms GPU per frame)

## Acceptance Criteria

_From GDD Init & Lifecycle, ADR-0018 Architecture and Validation Criteria:_

- [ ] AC-1: `AdvancedDynamicTexture.CreateFullscreenUI("hud", true)` called once — `adt.idealHeight = 1080`, `adt.useSmallestIdeal = false`
- [ ] AC-2: Grid has exactly 3 columns added via `grid.addColumnDefinition(fraction)` — left=0.20, center=0.58, right=0.22 (sum=1.0)
- [ ] AC-3: All blocks are created at init (their constructors create all GUI controls). `init()` registers blocks in the Grid. Zero `addControl()` calls occur during racing.
- [ ] AC-4: All blocks with `visible: true` in config are visible after init; blocks with `visible: false` remain hidden
- [ ] AC-5: `deactivate()` sets all block containers `isVisible = false` and unsubscribes all Event Bus subscriptions for every block
- [ ] AC-6: HUD activates on GSM `gsm.state.entered` with state `Racing` — calls `init(config)` with default or loaded HudConfig
- [ ] AC-7: HUD deactivates on GSM `gsm.state.entered` with state `PostRace` — calls `deactivate()`, all blocks invisible
- [ ] AC-8: HUD with zero active blocks in config runs silently — no errors, no visible elements

## Implementation Notes

_Derived from ADR-0018 Implementation Guidelines:_

1. **ADT creation**:

   ```typescript
   const adt = AdvancedDynamicTexture.CreateFullscreenUI("hud", true);
   adt.idealHeight = 1080;
   adt.useSmallestIdeal = false;
   ```

2. **Grid setup** (Babylon.js 9.x API — no ColumnDefinition class):

   ```typescript
   const grid = new Grid("hudGrid");
   grid.width = "100%";
   grid.height = "100%";
   grid.addColumnDefinition(0.2); // left zone
   grid.addColumnDefinition(0.58); // center zone
   grid.addColumnDefinition(0.22); // right zone
   grid.addRowDefinition(1.0); // single row — overlays are top-level ADT children
   adt.addControl(grid);
   ```

3. **Block creation flow**: HudManager constructor creates all known blocks via `new SpeedBlock(ctx)`, `new LapBlock(ctx)`, etc. Each block's constructor creates its GUI controls and stores them in `block.container`. `init()` adds containers to the Grid cells. Nothing is created during race.

4. **Block registration**: `Map<string, HudBlock>` populated at init. `onActivate()` performs: `container.isVisible = true` + subscribe events. `onDeactivate()` performs: `container.isVisible = false` + unsubscribe all.

5. **Cell attachment**: `grid.addControl(block.container, row, column)` — row=0, column by zone index. Overlays (countdown, pit, DNF, checkered) are added to ADT directly (not Grid), positioned absolutely or centered.

6. **GSM lifecycle**: Subscribe to Event Bus at HudManager construction (before any Racing state):
   - `gsm.state.entered({ to: 'Racing' })` → `init(config)`
   - `gsm.state.entered({ to: 'PostRace' })` → `deactivate()`
   - `gsm.state.entered({ to: 'Paused' })` → blur overlay (not dimmed)
   - `gsm.state.exited({ from: 'Paused' })` → unblur

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 002: HudBlock interface & HudConfig types, validation, HMR
- Story 001: HudAnimator — update() called each tick from HudManager
- Stories 004-012: Individual block implementations (registered here)

## QA Test Cases

_Manual verification steps — written by qa-lead at story creation:_

- **AC-1**: ADT with idealHeight=1080
  - Setup: Initialize HudManager with default config
  - Verify: Inspect `hudManager.adt`
  - Pass condition: `adt.idealHeight === 1080` and `adt.useSmallestIdeal === false`

- **AC-2**: Grid with 3 proportional columns
  - Setup: After init, inspect grid object's column definitions
  - Verify: `grid.columnCount === 3`, column widths
  - Pass condition: Column widths are 0.20, 0.58, 0.22 ±0.01

- **AC-3**: No addControl during race
  - Setup: Spy on `container.addControl`
  - Verify: Count addControl calls during init vs during a simulated race tick
  - Pass condition: addControl called N times during init, 0 during simulated race ticks

- **AC-4**: Visible blocks after init
  - Setup: init with config where speed.visible=true, minimap.visible=false
  - Verify: `speedBlock.container.isVisible === true`, `minimapBlock.container.isVisible === false`
  - Pass condition: visibility matches config

- **AC-5**: deactivate hides all
  - Setup: HUD active with visible blocks
  - When: `hudManager.deactivate()` called
  - Verify: All block containers `isVisible === false`, emit test Event Bus event → no handler reacts
  - Pass condition: All blocks invisible, subscriptions disconnected

- **AC-6/7**: GSM lifecycle
  - Setup: HudManager created, GSM transitions to Racing then PostRace
  - Verify: Block visibility after each transition
  - Pass condition: Blocks visible during Racing, invisible after PostRace

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/hudManager-evidence.md` + sign-off
**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 002 (HudBlock interface, HudConfig types)
- Unlocks: Stories 004-012 (all blocks register through HudManager)
