# HUD Epic — Story Index

> **Layer**: Presentation (slot #14)
> **GDD**: `design/gdd/hud.md`
> **UX Spec**: `design/ux/hud.md`
> **Governing ADR**: ADR-0018 (HUD Layout & Blocks)
> **Total Stories**: 12
> **Status**: Stories created, ready for implementation

## Implementation Order

Stories must be implemented in dependency order:

```
001 (HudAnimator)          — utility, no deps
  ↓
002 (HudBlock & Config)    — types/interfaces, no deps
  ↓
003 (HudManager)           — lifecycle, depends on 001+002
  ↓
 ┌────┬────┬────┬────┬────┬────┬────┬────┐
004  005  006  007  008  009  010  011  012
Speed Lap/ Gap  Res  Mini Count Alert Pit  RaceEnd
      Pos  Times      map                  Overlay
```

Stories 004-012 can be implemented in any order once 003 is complete.

## Story Summary

| #   | Story                               | Type        | File                              | Depends On |
| --- | ----------------------------------- | ----------- | --------------------------------- | ---------- |
| 001 | HudAnimator                         | Logic       | `story-001-hud-animator.md`       | None       |
| 002 | HudBlock Interface & HudConfig      | Logic       | `story-002-hud-block-config.md`   | None       |
| 003 | HudManager — Init, Grid & Lifecycle | UI          | `story-003-hud-manager.md`        | 001, 002   |
| 004 | SpeedBlock                          | UI          | `story-004-speed-block.md`        | 003        |
| 005 | LapBlock & PositionBlock            | UI          | `story-005-lap-position-block.md` | 001, 003   |
| 006 | GapInfoBlock & LapTimesBlock        | UI          | `story-006-gap-info-lap-times.md` | 003        |
| 007 | ResourcesBlock                      | UI          | `story-007-resources-block.md`    | 001, 003   |
| 008 | MinimapBlock                        | Visual/Feel | `story-008-minimap-block.md`      | 003        |
| 009 | CountdownBlock                      | Visual/Feel | `story-009-countdown-block.md`    | 003        |
| 010 | AlertBlock & DeviceHint             | UI          | `story-010-alert-device-hint.md`  | 003        |
| 011 | PitOverlayBlock                     | UI          | `story-011-pit-overlay-block.md`  | 001, 003   |
| 012 | RaceEndOverlays (DNF + Checkered)   | UI          | `story-012-race-end-overlays.md`  | 001, 003   |

## QA Gate Status

QL-STORY-READY: **PASS** (after 4 blocking fixes applied)

- B1: pit.status values resolved (use GDD canonical: pitStopped/onTrack) ✅
- B2: Speed update mechanism resolved (ADR-0018 Event Bus throttle) ✅
- B3: Zone layout resolved (ADR-0018 3-column Grid) ✅
- B4: HMR mechanism resolved (ConfigManager onInvalidate callback) ✅

**Test coverage**: 2 Logic stories (001, 002) have automated test specs.
10 UI/Visual stories (003-012) have manual verification steps.
All 12 stories have AC-specific test cases embedded.

## Open Items

- Stories 009, 010, 012 have `TR-HUD-???` — need new TR-IDs added via `/architecture-review`
- ADR file name discrepancy: epic references `adr-0018-hud-layout.md`, actual file is `adr-0018-hud-layout-blocks.md`
