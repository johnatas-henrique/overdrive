# Cross-GDD Consistency Report — Overdrive

**Review**: Corpus hygiene refresh after accepted design decisions
**Date**: 2026-07-27
**Scope**: Current on-disk 21-system MVP corpus
**Status**: 0 BLOCKING, 9 WARNING

---

## Resolved items from the previous review

The six disputed items the user explicitly accepted are now reflected in the source docs:

1. **Fuel ↔ UI Menu** — resolved; `fuel-system.md` and `ui-menu.md` now reciprocate the pre-race fuel comparison path.
2. **Track anti-cut ownership** — resolved; `track-system.md` now states Track owns the geometry helper and Race Session Manager owns the 90% distance gate.
3. **HUD tire numeric readout** — resolved; `hud.md` shows the tire bar with numeric `X%` plus state color.
4. **Grid spacing** — resolved; `track-system.md` and `grid-start.md` both use 8 m row spacing and 3.5 m column spacing.
5. **Pit lane bottleneck / 16-box layout** — resolved; `track-system.md` defines the two-lane F1-style pit model with 16 offset boxes and no queueing.
6. **FinishOrderResolver simplification** — resolved; `race-session-manager.md` keeps the pace-only MVP projection and explicitly marks it cosmetic.

---

## Remaining warnings on disk

These are still present in the current corpus, but they are non-blocking hygiene items:

- **TiR-02** — Tire System still lacks a VFX reciprocal entry.
- **Cam-01** — Camera/HUD still disagree on the Hard vs Soft label for the camera dependency.
- **Settings-01** — Camera Reduced Motion text still omits the Motion Blur mention that Settings and VFX already include.
- **UI-02** — UI Menu still hardcodes the current MVP track names instead of pointing only at the data-driven track list.
- **Pit-02** — Fuel fill rate is still described in both Fuel System and Pit Stop.
- **Pit-03** — Tire swap time is still described in both Tire System and Pit Stop.
- **Pit-04** — AI resource safety margin is still described in both AI Rival and Pit Stop.
- **UI-03** — Grid display duration is duplicated between UI Menu and Grid & Start.
- **RSM-01** — Countdown duration is duplicated between Race Session Manager and Grid & Start.

All of the above are documentation hygiene / ownership-clarity issues, not gameplay blockers.

---

## Verdict

**CONCERNS**

No blocking contradictions remain in the resolved six items. The corpus is consistent enough to continue architecture, but the remaining warnings should be cleaned up before calling the documentation fully tidy.
