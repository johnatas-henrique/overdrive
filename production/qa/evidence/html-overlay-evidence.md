# Manual Test Evidence: HTML Overlay (Story 003)

**Story**: `production/epics/dev-tools/story-003-html-overlay.md`
**Date**: 2026-06-26
**Tester**: [Your name]
**Build**: [commit hash or branch]

## Test Environment

- Browser: [Brave/Chrome/Firefox version]
- OS: [Ubuntu/Windows/macOS]
- Screen resolution: [e.g., 1920×1080]

## Test Cases

### AC-3a: DOM creation and visibility toggle

| Step | Action | Expected | Actual | Pass? |
|------|--------|----------|--------|-------|
| 1 | Open game in dev mode, check Elements panel | No `div#dev-overlay` exists | | |
| 2 | Press backtick (`) | `div#dev-overlay` appears as sibling of `<canvas>` | | |
| 3 | Check overlay style | `display: flex` | | |
| 4 | Press backtick again | `display: none` | | |
| 5 | Press backtick again | `display: flex` | | |

### AC-3b/3c: Top bar metrics

| Step | Action | Expected | Actual | Pass? |
|------|--------|----------|--------|-------|
| 1 | Locate top bar | FPS, Frame, DC, Phys, Meshes visible | | |
| 2 | Check FPS counter | Numeric value, changes each frame | | |
| 3 | Check Frame time | Millisecond value | | |
| 4 | Check Draw calls | Integer | | |
| 5 | Check Physics time | Millisecond value | | |
| 6 | Check Mesh count | Integer | | |

### AC-7: pointer-events: none

| Step | Action | Expected | Actual | Pass? |
|------|--------|----------|--------|-------|
| 1 | Inspect overlay in Elements panel | `pointer-events: none` | | |
| 2 | Click on overlay area | Click passes through to canvas | | |

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Developer | | | [ ] |
| QA Lead | | | [ ] |
