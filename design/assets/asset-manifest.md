# Asset Manifest

> Last updated: 2026-07-29

## Progress Summary

| Total | Needed | In Progress | Done | Approved |
|-------|--------|-------------|------|----------|
| 34 | 34 | 0 | 0 | 0 |

## Assets by Context

### System: Car Definition Data
| Asset ID | Name | Category | Status | Spec File |
|----------|------|----------|--------|-----------|
| ASSET-001 | Car — team_tier1_a (McLaren-Honda MP4/5) | 3D Asset (Reference) | Needed | design/assets/specs/team_tier1_a-car-assets.md |
| ASSET-002 | Car — team_tier1_b (Ferrari F1-89/640) | 3D Asset (Reference) | Needed | design/assets/specs/team_tier1_b-car-assets.md |
| ASSET-003 | Car — team_tier1_c (Williams-Renault FW12C/FW13) | 3D Asset (Reference) | Needed | design/assets/specs/team_tier1_c-car-assets.md |
| ASSET-004 | Car — team_tier1_d (Benetton-Ford B188/B189) | 3D Asset (Reference) | Needed | design/assets/specs/team_tier1_d-car-assets.md |
| ASSET-005 | Car — team_tier2_a (March-Leyton House-Judd CG891) | 3D Asset (Reference) | Needed | design/assets/specs/team_tier2_a-car-assets.md |
| ASSET-006 | Car — team_tier2_b (Lotus-Judd 101) | 3D Asset (Reference) | Needed | design/assets/specs/team_tier2_b-car-assets.md |
| ASSET-007 | Car — team_tier2_c (Tyrrell-Ford 017B/018) | 3D Asset (Reference) | Needed | design/assets/specs/team_tier2_c-car-assets.md |
| ASSET-008 | Car — team_tier2_d (Brabham-Judd BT58) | 3D Asset (Reference) | Needed | design/assets/specs/team_tier2_d-car-assets.md |
| ASSET-009 | Car — team_tier3_a (Minardi-Ford M188B/M189) | 3D Asset (Reference) | Needed | design/assets/specs/team_tier3_a-car-assets.md |
| ASSET-010 | Car — team_tier3_b (Ligier-Ford JS33) | 3D Asset (Reference) | Needed | design/assets/specs/team_tier3_b-car-assets.md |
| ASSET-011 | Car — team_tier3_c (Dallara-BMS-Ford F189) | 3D Asset (Reference) | Needed | design/assets/specs/team_tier3_c-car-assets.md |
| ASSET-012 | Car — team_tier3_d (Arrows-Ford A11) | 3D Asset (Reference) | Needed | design/assets/specs/team_tier3_d-car-assets.md |
| ASSET-013 | Car — team_tier4_a (Rial-Ford ARC2) | 3D Asset (Reference) | Needed | design/assets/specs/team_tier4_a-car-assets.md |
| ASSET-014 | Car — team_tier4_b (Coloni-Ford FC188B/C3) | 3D Asset (Reference) | Needed | design/assets/specs/team_tier4_b-car-assets.md |
| ASSET-015 | Car — team_tier4_c (Onyx-Ford ORE-1) | 3D Asset (Reference) | Needed | design/assets/specs/team_tier4_c-car-assets.md |
| ASSET-016 | Car — team_tier4_d (Zakspeed-Yamaha ZR891) ★ | 3D Asset (Reference) | Needed | design/assets/specs/team_tier4_d-car-assets.md |

### System: Track System — Shared Assets
| Asset ID | Name | Category | Status | Spec File |
|----------|------|----------|--------|-----------|
| ASSET-101 | Concrete barrier segment | Track Geometry | Needed | design/assets/specs/trackside-shared-assets.md |
| ASSET-102 | Tire barrier (stack) | Track Safety | Needed | design/assets/specs/trackside-shared-assets.md |
| ASSET-103 | Grandstand (small) | Track Architecture | Needed | design/assets/specs/trackside-shared-assets.md |
| ASSET-104 | Grandstand (large) | Track Architecture | Needed | design/assets/specs/trackside-shared-assets.md |
| ASSET-105a | Tree — conifer | Track Vegetation | Needed | design/assets/specs/trackside-shared-assets.md |
| ASSET-105b | Tree — broadleaf | Track Vegetation | Needed | design/assets/specs/trackside-shared-assets.md |
| ASSET-105c | Tree — tall (palm) | Track Vegetation | Needed | design/assets/specs/trackside-shared-assets.md |
| ASSET-106 | Distance board | Track Signage | Needed | design/assets/specs/trackside-shared-assets.md |
| ASSET-107 | Sponsor billboard | Track Signage | Needed | design/assets/specs/trackside-shared-assets.md |
| ASSET-108 | Flag post | Track Signage | Needed | design/assets/specs/trackside-shared-assets.md |
| ASSET-109 | Light pole | Track Architecture | Needed | design/assets/specs/trackside-shared-assets.md |
| ASSET-110 | Track limit sign | Track Signage | Needed | design/assets/specs/trackside-shared-assets.md |

### System: Track System — Pit Building
| Asset ID | Name | Category | Status | Spec File |
|----------|------|----------|--------|-----------|
| ASSET-111 | Pit building (base) | Track Architecture | Needed | design/assets/specs/pit-building-assets.md |
| ASSET-112 | Pit wall segment | Track Geometry | Needed | design/assets/specs/pit-building-assets.md |
| ASSET-113 | Pit box markings | Track Decal | Needed | design/assets/specs/pit-building-assets.md |
| ASSET-114 | Start/finish gantry | Track Architecture | Needed | design/assets/specs/pit-building-assets.md |
| ASSET-115 | Pit entry/exit sign | Track Signage | Needed | design/assets/specs/pit-building-assets.md |

## Track Scene Specs

| Track ID | Display Name | Key Landmarks | Spec File |
|----------|-------------|---------------|-----------|
| track_monaco | Monaco | Casino, Fairmont Hotel, Harbour, Hotel de Paris, Piscine, yachts; modular temporary pit | design/assets/specs/track-monaco-assets.md |
| track_silverstone | Silverstone | Open airfield — simplest, mostly barriers + 1987 pit building | design/assets/specs/track-silverstone-assets.md |
| track_spa | Spa-Francorchamps | Englebert/Uniroyal Tower, Eau Rouge bridge, Ardennes forest | design/assets/specs/track-spa-assets.md |
| track_monza | Monza | Sopraelevata ruins, Central Grandstand, park forest, old garages, 1989 pit complex | design/assets/specs/track-monza-assets.md |

## Assets not requiring AI generation

These are defined in art bible or GDDs but don't need spec files — they're procedural, in-engine, or asset-store sourced.

| Item | Source | Method |
|------|--------|--------|
| Asphalt / kerb / gravel textures | Track System | Procedural materials |
| HUD icons | Art Bible §6 | In-engine vector drawing |
| VFX textures (spark, smoke, speed line, confetti) | Art Bible §7 | Procedural / shader |
| UI backgrounds, panels | Art Bible §6 | In-engine USS styling |
| Audio (engine SFX) | ADR-0012 | Procedural oscillators |
| Track spline geometry | ADR-0007 | Spline generation pipeline |

## Blockout Strategy

**Phase 1 — Blockout (playable immediately):**
- Track rendered from spline (asphalt + kerb + grass)
- Collision barriers generated from spline (procedural mesh collider)
- Colored Primitives (Cube/Sphere) in place of each trackside object
- Each block approximates the final asset's color and size
- Playable from day one

**Phase 2 — Gradual Replacement:**
- Each spec becomes an asset generation task
- As 3D models are created (AI, Blender, asset store), blocks are replaced with real assets
- Track becomes visually richer without refactoring placement

**Phase 3 — Final:**
- All placeholders replaced by final assets
- Only the additive Scene needs updating (GameObject swap)
- Apenas a Scene additive precisa ser tocada (troca o GameObject)
