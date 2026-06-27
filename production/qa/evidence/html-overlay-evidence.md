# Manual Test Evidence: HTML Overlay (Story 003)

**Story**: `production/epics/dev-tools/story-003-html-overlay.md`
**Date**: 2026-06-27
**Tester**: Johnatas
**Build**: feat/sprint-02-core-a (1e83dcd)

## Test Environment

- Browser: Brave (latest)
- OS: Windows
- Screen resolution: 3440×1440

## Test Cases

### AC-3a: DOM creation and visibility toggle

| Step | Action | Expected | Actual | Pass? |
|------|--------|----------|--------|-------|
| 1 | Open game in dev mode, check Elements panel | No `div#dev-overlay` exists | No overlay in DOM | ✅ |
| 2 | Press backtick (`) | `div#dev-overlay` appears as sibling of `<canvas>` | Overlay appeared as sibling of canvas | ✅ |
| 3 | Check overlay style | `display: flex` | display: flex confirmed | ✅ |
| 4 | Press backtick again | `display: none` | display: none confirmed | ✅ |
| 5 | Press backtick again | `display: flex` | display: flex confirmed | ✅ |

### AC-3b/3c: Top bar metrics

| Step | Action | Expected | Actual | Pass? |
|------|--------|----------|--------|-------|
| 1 | Locate top bar | FPS, Frame, DC, Phys, Meshes visible | All 5 metrics visible | ✅ |
| 2 | Check FPS counter | Numeric value, changes each frame | Numeric, updates each frame | ✅ |
| 3 | Check Frame time | Millisecond value | Millisecond value shown | ✅ |
| 4 | Check Draw calls | Integer | Integer shown | ✅ |
| 5 | Check Physics time | Millisecond value | Millisecond value shown | ✅ |
| 6 | Check Mesh count | Integer | Integer shown | ✅ |

### AC-7: pointer-events: none

| Step | Action | Expected | Actual | Pass? |
|------|--------|----------|--------|-------|
| 1 | Inspect overlay in Elements panel | `pointer-events: none` | pointer-events: none confirmed | ✅ |
| 2 | Click on overlay area | Click passes through to canvas | Click passes through to canvas | ✅ |

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Developer | Johnatas | 2026-06-27 | ✅ |
| QA Lead | | | [ ] |
