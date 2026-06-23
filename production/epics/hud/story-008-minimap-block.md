# Story 008: MinimapBlock

> **Epic**: HUD
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Visual/Feel
> **Manifest Version**: 2026-06-21
> **Estimate**: 10h

## Context

**GDD**: `design/gdd/hud.md`
**Requirement**: `TR-HUD-008` — MinimapBlock requires track outline polyline from Track+Environment. Must not crash if absent — renders empty dark container with "MAP" label.

**ADR Governing Implementation**: ADR-0018: HUD Layout & Blocks
**ADR Decision Summary**: Pure Babylon.js GUI controls in Phase 1: MultiLine for track outline, Ellipse controls for car position dots. Updates on `position.changed` only (not every frame). Static track outline, no rotation or zoom. Container-level rotation/scale reserved for Phase 2.

**Engine**: Babylon.js 9.12.0 | **Risk**: MEDIUM
**Engine Notes**: Use `MultiLine` (not `Line`) for polyline track outline — Babylon.js `Line` is single-segment only. `Ellipse` for position dots. Coordinates in GUI space (not 3D space) — track polyline must be pre-projected to 2D by Track+Environment system. `MultiLine` takes `points: Vector2[]` via `addPoints()` or constructor.

**Control Manifest Rules (this layer)**:

- Required: P3 (create-once toggle-visibility)
- Forbidden: P-F4 (never use HTML/CSS for HUD)
- Guardrail: P-G1 (HUD < 0.3ms GPU per frame)

## Acceptance Criteria

_From GDD MinimapBlock section:_

- [ ] AC-1: Square container with dark background `rgba(0,0,0,0.5)` in centre-right area of screen
- [ ] AC-2: Track outline rendered as `MultiLine` control — white (#FFFFFF), 2px stroke, static after creation
- [ ] AC-3: Car position dots rendered as `Ellipse` controls in team colours (~8px diameter) — positioned via `left`/`top` relative to container
- [ ] AC-4: Position dots update when `position.changed` fires — dot positions jump to new coordinates (no smooth interpolation)
- [ ] AC-5: Without polyline data at init: renders empty dark container with "MAP" text label — no crash, no errors logged
- [ ] AC-6: Phase 1 only — static track outline, no rotation, no zoom

## Implementation Notes

_Derived from ADR-0018 Implementation Guidelines:_

1. **MultiLine for track**: Babylon.js `MultiLine` accepts an array of points:

   ```typescript
   const outline = new MultiLine("trackOutline");
   outline.points = polylineData.map((p) => new Vector2(p.x, p.y)); // 2D projected coords
   outline.strokeWidth = 2;
   outline.color = "#FFFFFF";
   outline.isVisible = true;
   minimapContainer.addControl(outline);
   ```

2. **Coordinate mapping**: Track+Environment provides a 2D polyline. The minimap container normalises these coordinates to fit within its bounds with 5% padding.

3. **Car dots**: `Ellipse` with `width=8`, `height=8`. Colour from team colour lookup. Position set via `left` and `top` in pixels relative to the minimap container. Team colours should be provided by the entity system or a colour palette config.

4. **Missing polyline guard**: If `polyline === null || polyline.length < 3` at init, show a single TextBlock "MAP" in subdued grey, centred in the dark container. Do not create MultiLine or Ellipse controls.

5. **Performance note**: Minimap is the most expensive HUD block. If profiling shows frame rate impact, it's the first block to disable via HudConfig flag. The race is fully playable without it.

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Rotation with car heading — Phase 2 (future)
- Zoom in/out — Phase 2 (future)
- DynamicTexture (Canvas2D) fallback — Phase 2 (if needed)

## QA Test Cases

_Manual verification steps — written by qa-lead at story creation:_

- **AC-1**: Square container with dark background
  - Setup: HUD active with minimap enabled, polyline data provided
  - Verify: Minimap container background
  - Pass condition: Background rgba(0,0,0,0.5), container is square

- **AC-2**: Track outline rendered
  - Setup: Polyline data provided at init
  - Verify: MultiLine controls inside minimap container
  - Pass condition: White track outline visible, static

- **AC-3**: Car dots in team colours
  - Setup: position.changed emitted with position data
  - Verify: Ellipse controls on minimap
  - Pass condition: ~8px dots, colours match cars, positions update on event

- **AC-5**: Missing polyline — no crash, "MAP" label
  - Setup: No polyline data provided
  - Verify: Minimap container output
  - Pass condition: Dark container with "MAP" text, no console errors

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**: `production/qa/evidence/minimapBlock-evidence.md` + sign-off
**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 003 (HudManager — registration)
- Unlocks: None directly
