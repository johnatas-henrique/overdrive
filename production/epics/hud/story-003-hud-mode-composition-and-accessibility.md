# Story 003: HUD Mode Composition & Accessibility

> **Epic**: HUD
> **Status**: Ready
> **Layer**: Core + Presentation
> **Type**: UI
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/hud.md`
**Requirement**: `TR-hud-005` (cockpit 4-element warning layout; settings toggle may reveal full chase overlay)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0014: HUD Data Contract and Layout
**ADR Decision Summary**: Cockpit + Race + overlay disabled → only the 4 minimal elements (position/lap, fuel warning, tire warning, rival gap). New profile defaults `show_chase_hud_in_cockpit = On` → 4 cockpit + 8 chase = 12 elements. Qualifying renders only speed/gear, position, lap, lap time — overlay must not add Rival Gap/Track Map/fuel/tire. Settings text-scale preview (150%) reflows without clipping; Cancel restores. Colorblind mode changes fuel/tire presentation to non-color cues (labels/thresholds/UX pattern treatment — exact mapping finalized in the UX spec).

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: uGUI Canvas; Settings preview via transactional session (Settings epic).

**Control Manifest Rules (this layer)**:
- Required: cockpit minimal 4 elements; overlay default On (12-element)
- Required: qualifying 4 elements only; text-scale reflow; colorblind non-color cues

---

## Acceptance Criteria

*From hud.md + ADR-0014, scoped per QL-STORY-READY 2026-08-16 (pit service moved to Story 003 overlays):*

- [ ] Cockpit + Race + overlay disabled renders only the four minimal elements (position/lap, fuel warning, tire warning, rival gap)
- [ ] New profile defaults `show_chase_hud_in_cockpit = On`; Cockpit + Race + overlay enabled renders 4 cockpit + 8 chase = 12 elements
- [ ] Qualifying renders only speed/gear, position, lap, lap time; overlay enabled does NOT add Rival Gap, Track Map, fuel bar, or tire bar
- [ ] Supplied Settings preview at 150% reflows without clipping; Cancel restores the prior supplied scale (persistence outside this story)
- [ ] Supplied colorblind-mode setting changes fuel/tire presentation to the approved non-color cues (labels, thresholds, UX-approved pattern/icon treatment — exact mapping finalized in the UX spec)

---

## Implementation Notes

*Derived from ADR-0014 Implementation Guidelines:*

- `show_chase_hud_in_cockpit` is a Settings preference (default On per GDD) — consumed via the Settings preview seam
- Qualifying mode context suppresses chase-only elements regardless of the overlay toggle
- Colorblind cues: fuel/tire keep labels + thresholds + pattern treatment (the exact palette/pattern mapping is the HUD UX spec's deliverable)
- The accessibility mapping cannot be finalized while `design/ux/race-hud.md` is In Design — implementation defers the exact pattern mapping to the UX spec (documented dependency)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 004]: contextual overlays (pit service presentation)
- [Settings epic]: preference persistence
- [UX]: exact colorblind pattern mapping (In Design)

---

## QA Test Cases

*Written by qa-lead at story creation (manual — UI):*

- **AC-COCKPIT-OFF**: Cockpit/Race, toggle off → exactly 4 minimal elements
- **AC-COCKPIT-ON**: new profile, Cockpit/Race → setting On, 12-element composition
- **AC-QUALIFYING**: Qualifying context, overlay On and Off → only speed/position/lap/lap-time; no Rival Gap/Map
- **AC-TEXT-SCALE**: Settings preview 150% → no clipping; Cancel restores original
- **AC-COLORBLIND**: colorblind mode + fuel/tire fixtures → non-color cues present per approved UX mapping

---

## Test Evidence

**Story Type**: UI
**Required evidence**:
- UI: `production/qa/evidence/hud-mode-evidence.md` + screenshots (cockpit on/off, qualifying, text scale, colorblind)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001/002 (view model + 8 elements), Settings (preferences preview), UX spec (race-hud.md — In Design, pattern mapping dependency)
- Unlocks: Story 004 (overlays compose)
