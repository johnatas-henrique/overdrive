# Review Log: HUD — Overdrive

## Lean Review — 2026-07-24 — Verdict: NEEDS REVISION

Scope signal: L

Review boundary: MVP race, qualifying, pit, results, accessibility, and authoritative local-state contracts. Alpha Ghost Delta and future cockpit variants remained non-blocking.

Specialists: none — lean mode.

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: L

Specialists: none — lean mode

Blocking items: 0 | Recommended: 2

Summary: Fresh lean re-review confirmed all prior findings were resolved. Cross-GDD consistency check found 2 RECOMMENDED issues: AI Rival interaction table incorrectly claimed AI outputs rival gap/position to HUD (RSM owns this), and SA Dependencies table omitted PerformanceReduced and Finished-only result metadata. Both issues were corrected.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found data-flow attribution issues.

Blocking items: 10 | Recommended: 4
Prior verdict resolved: First review.

### Findings

| Finding | Severity | Resolution |
|---|---|---|
| HUD described Chase as primary while Camera defines Cockpit as primary | Blocking | Aligned HUD overview with Cockpit-primary, Chase-optional camera design. |
| Full cockpit overlay had no Settings field or screen | Blocking | Added `show_chase_hud_in_cockpit` to Settings schema, Camera category, UI, and acceptance criteria. |
| Overlay default and element budget were contradictory | Blocking | Kept the full overlay enabled by default per the product decision; documented 11 total elements as a preference rather than a hard cap, while retaining the two-information-per-glance readability rule. |
| Pit HUD did not distinguish PitTransit/Exiting from InPitBox | Blocking | Race HUD remains visible during transit and exit; the service overlay appears only in InPitBox. |
| Results did not define Forfeit presentation | Blocking | Results now shows Forfeit classification, completed laps, and accumulated race time without final position or AI projection. |
| Results transition skipped Finished Presentation and `resolutionComplete` | Blocking | Results begins only after Finished Presentation dismissal and resolution completion. |
| Tire bar terminology mixed wear and remaining life | Blocking | HUD now consistently displays tire remaining life while retaining wear/state semantics. |
| Team color conflicted with state colors on resource fills | Blocking | Fuel/Tire fills use state colors; team colors remain on borders, position, speed, and decorative accents. |
| Camera, Track, Pit Stop, and Settings were absent from dependencies | Blocking | Added direct interaction and dependency contracts. |
| Acceptance criteria and edge cases lacked overlay, PIT THIS LAP, Forfeit, and local Results coverage | Blocking | Added coverage for all four paths and PerformanceReduced telemetry preservation. |
| The previous 8-element value lacked an on-disk rationale | Recommended | Confirmed it was a heuristic rather than a demonstrated technical hard cap and updated project memory after the product decision. |
| Qualifying overlay needed a state exception | Recommended | Overlay respects Qualifying's three-element HUD and does not reintroduce Rival Gap or Track Map. |
| Pit tire display needed remaining-life semantics | Recommended | At 2s service, HUD shows 100% remaining / 0% wear. |
| Camera overlay behavior required direct Camera/Settings contracts | Recommended | Added Camera and Settings dependencies and propagated the option to Settings AC-CAM5. |

### MVP Contracts Confirmed

- Cockpit is the primary camera/HUD layout; Chase is optional.
- `Show Chase HUD in Cockpit` is On by default and can be disabled with one Settings option.
- The overlay adds all seven active Chase elements during Race; state-specific HUD rules still suppress race-only elements during Qualifying.
- Results distinguishes normal finish from Forfeit.
- PitTransit/Exiting retain the race HUD; InPitBox owns the service overlay.

### Files Revised During This Lean Review

- `design/gdd/hud.md`
- `design/gdd/settings.md`
- `design/gdd/systems-index.md`

## Review — 2026-07-25 — Verdict: APPROVED

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review with exhaustive artifacts confirmed all prior findings were resolved. 8/8 sections present, 12/12 dependencies validated, 12/12 cross-GDD consistency checks pass. Internal consistency verified: all data-flow claims across Overview, Rules, Interactions, and Dependencies are consistent. Non-MVP constraint check passes. All prior review findings resolved.

Prior verdict resolved: Yes — all 2 findings from the 2026-07-25 NEEDS REVISION review were resolved (AI Rival interaction attribution, SA Dependencies completeness).
