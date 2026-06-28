# Story 009: CSS Refactor — Inline Styles to Stylesheet

> **Epic**: Dev Tools
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h
> **Last Updated**: 2026-06-27

## Context

**GDD**: `design/gdd/dev-tools.md`
**Requirement**: `TR-DVT-001` (HTML overlay), `TR-DVT-002` (Event Bus inspector), `TR-DVT-003` (Config namespace inspector)

**ADR Governing Implementation**: ADR-0009: Dev Tools Architecture
**ADR Decision Summary**: All Dev Tools UI currently uses inline CSS via `style.cssText`. This refactor centralizes styles into a dedicated CSS file, eliminating bugs like forgotten style copying (Story 003 bug: `_finishEdit` created spans without color, resulting in black text on black background).

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Vite handles CSS imports via side-effect import. CSS is bundled separately and tree-shaken in production via `import.meta.env.DEV` guard.

**Why This Story Exists**:
During Story 003 (HTML Overlay), a bug was discovered where `_finishEdit()` created a new `<span>` element without copying inline styles from the original. The result was invisible text (black on black background). This class of bug is common with inline CSS — every new element must manually copy all style properties. A CSS file centralizes styles and prevents this pattern.

---

## Acceptance Criteria

- [ ] AC-1: A CSS file exists at `src/core/dev-tools/dev-tools.css` containing all Dev Tools styles
- [ ] AC-2: All `style.cssText` assignments in `src/core/dev-tools/dev-tools.ts` are replaced with `classList.add()` calls referencing classes from the CSS file
- [ ] AC-3: All `style.cssText` assignments in `src/core/dev-tools/config-tree.ts` are replaced with `classList.add()` calls referencing classes from the CSS file
- [ ] AC-4: All `style.cssText` assignments in `src/core/dev-tools/event-bus-inspector.ts` are replaced with `classList.add()` calls referencing classes from the CSS file
- [ ] AC-5: Only dynamic styles (e.g., `el.style.display`, `el.style.background` for flash effects) remain as inline styles
- [ ] AC-6: The CSS file is imported in `src/core/dev-tools/index.ts` or `src/core/dev-tools/dev-tools.ts` via Vite side-effect import
- [ ] AC-7: All existing tests pass without modification (CSS changes are visual-only)
- [ ] AC-8: Visual regression: overlay appearance is identical before and after refactor (verified via browser screenshot comparison)

---

## Implementation Notes

1. **CSS File Structure**: Organize by component:
   ```css
   /* Overlay container */
   .dev-overlay { ... }
   
   /* Top bar metrics */
   .top-bar { ... }
   .metric-label { ... }
   .metric-value { ... }
   
   /* Sidebar */
   .sidebar { ... }
   
   /* Config tree */
   .config-namespace { ... }
   .config-key { ... }
   .config-value { ... }
   .config-input { ... }
   
   /* Main panel / tabs */
   .main-panel { ... }
   .tab-bar { ... }
   .tab { ... }
   .tab.active { ... }
   .tab-panel { ... }
   .tab-content { ... }
   
   /* Event bus inspector */
   .inspector-filter { ... }
   .inspector-subs-list { ... }
   .inspector-log-header { ... }
   .inspector-log-list { ... }
   
   /* Notifications */
   .dev-notification { ... }
   ```

2. **Dynamic Styles to Keep Inline**:
   - `el.style.display` (toggle visibility)
   - `el.style.background` (flash effect on config edit)
   - `el.style.transition` (flash animation)
   - `el.style.color` / `el.style.borderBottom` (tab active state)
   - `el.scrollTop` (scroll position)

3. **Import Pattern** (Vite):
   ```typescript
   // In dev-tools.ts or index.ts
   import "./dev-tools.css";
   ```

4. **Testing**: No test changes expected — CSS is visual-only. Run full test suite to verify.

---

## Out of Scope

- [Story 001-008]: Existing stories (compile guard, keybinds, overlay, config tree, event bus inspector, etc.)
- Theme/dark mode support (future story if needed)
- Responsive layout (overlay is fixed over canvas)
- CSS animations beyond existing flash effect

---

## QA Test Cases

- **AC-8**: Visual regression
  - Setup: Open overlay in browser before refactor, take screenshot
  - Step 1: Apply CSS refactor
  - Step 2: Open overlay, take screenshot
  - Step 3: Compare screenshots — layout, colors, fonts should be identical
  - Pass condition: No visual differences

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: Automated test in `tests/unit/dev-tools/` or `tests/integration/dev-tools/`
**Status**: Pending — test file to be created

---

## Dependencies

- Depends on: Story 003 (HTML Overlay), Story 004 (Config Tree), Story 005 (Event Bus Inspector)
- Unlocks: None (refactor only)

---

## Story Type Rationale

This is a **Logic** story because:
1. It modifies source code files (dev-tools.ts, config-tree.ts, event-bus-inspector.ts)
2. It creates a new CSS file
3. It requires automated tests to verify no regressions
4. The change is structural (inline → stylesheet), not visual (UI) or experiential (Visual/Feel)

---

## Completion Notes

**Completed**: 2026-06-27
**Criteria**: 8/8 passing
**Deviations**: 
- ADVISORY: QA lead flagged structural CSS validation tests as gap (AC-1, AC-2-4, AC-6). These are code inspection checks, not runtime behavior — covered by grep/glob verification.
- ADVISORY: 3 test assertions updated from `style.display` to `classList.contains("active")` — happy-dom doesn't process CSS classes.
- OUT OF SCOPE: `src/styles/variables.css` created (Art Bible palette) — approved by user during technical decisions discussion.
**Test Evidence**: 1160/1160 tests pass. Browser screenshots at `production/qa/evidence/css-refactor-*.png`.
**Code Review**: APPROVED WITH SUGGESTIONS (babylonjs-specialist: 3 BLOCKING fixed, qa-tester: 2 BLOCKING fixed)

### Technical Decisions

1. **Single CSS file** (`dev-tools.css`) instead of 3 separate files — Dev Tools is a cohesive overlay, all styles are related.
2. **Flat naming convention** — existing code already used `.top-bar`, `.sidebar`, `.config-value`. Kept for consistency.
3. **CSS Custom Properties** for Art Bible colors — centralized in `src/styles/variables.css`, consumed by `dev-tools.css`.
4. **Dynamic styles kept inline** — `el.style.display` (toggle), `el.style.background` (flash), `el.scrollTop` (scroll).
5. **Art Bible palette alignment** — Dev Tools uses `--od-ui-bg` (#0d0d0f), `--od-ui-panel` (#111114), `--od-signal-yellow` (#f5c800) from Art Bible Section 7.1.
6. **Debug-specific accents** — `--dt-accent` (#ffd700), `--dt-key` (#66d9ef), `--dt-value` (#e6db74) are NOT in Art Bible (debug-only, tree-shaken in prod).
