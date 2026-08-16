# Asset Specs — System: Car Definition Data

> **Team**: Firenze (team_tier1_b)
> **Car Reference**: Ferrari F1-89/640
> **Art Bible**: design/art/art-bible.md
> **Generated**: 2026-07-28
> **Status**: 1 asset specced / 0 approved / 0 in production

---

## ASSET-001 — Car: Firenze (Ferrari F1-89/640 Parody)

| Field | Value |
|-------|-------|
| Category | 3D Asset (Reference) |
| Team ID | team_tier1_b |
| Car Reference | Ferrari F1-89/640 |
| Real-World Team | Ferrari |
| Livery Base | Solid Rosso Corsa body |
| Base Mesh | Shared (LOD0-3, 35k→1k tris) |
| Texture | 2048×2048, ASTC 6×6, PNG source |
| Material | URP Simple Lit, smoothness 0.25 |
| Background | Solid gray (#CCCCCC) |
| Driver | Not included |
| Car Numbers | Not included (add as decal post-gen) |
| View | Package of 8 angle renders |
| Reference Photo | https://www.ferrari.com/en-EN/formula1/f1-89 |

### Location in Project

| Asset | Path |
|-------|------|
| Base Mesh | Assets/Art/Cars/Base/Models/ |
| Texture | Assets/Art/Cars/tier1b/Textures/ |
| Material | Assets/Art/Cars/tier1b/Materials/ |
| Prefab | Assets/Art/Cars/tier1b/Prefabs/ |

### Art Bible Anchors

- §2.2 Team Identity: Primary #DC2828 (Rosso Corsa), no secondary (solid livery)
- §5.5 Era: 1989 F1 silhouette — low nose, no halo, open cockpit, exposed driver helmet area
- §8.1 Polygon Budget: LOD0 35k tris, LOD1 12.5k, LOD2 4k, LOD3 1k
- §8.3 Texture Standards: 2048², all cars equal quality, ASTC 6×6
- §8.5 Shader: URP Simple Lit, single material per car

### Livery Description

Solid Rosso Corsa (#DC2828) body covering the monocoque, nose cone, sidepods, engine cover, front and rear wings, and endplates — approximately 95% of visible surface. Small white rectangular sponsor decal panels on sidepods and nose cone sides, tiny yellow accent stripes on the engine cover. The defining Ferrari design: clean, flowing bodywork with sculpted sidepod inlets, the distinctive low nose with a small winglet on each side of the nose cone. Open wheels with visible double-wishbone suspension arms. No wheel covers — brake discs visible behind spokes. The semi-automatic gearbox protrusion visible at the rear.

Sponsor decals simulated as geometric color blocks (no text): rectangular white panels on sidepod outer surfaces and a thin white stripe across the nose cone. Small yellow accent on rear wing endplates. No real brand logos.

---

### Generation Prompts (Copy each one separately)

#### Prompt 1 — Front 3/4 View

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Ferrari F1-89/640 livery reference. Solid Rosso Corsa red body with bright red (#DC2828) covering the entire body, wings, and nose cone. Small white rectangular sponsor panels on sidepods and nose. Thin yellow accent on rear wing endplates. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Full car visible from front three-quarter view, approximately 45 degrees from front, slightly elevated camera angle, entire car in frame. 16:9 aspect ratio.
```

#### Prompt 2 — Side Profile

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Ferrari F1-89/640 livery reference. Solid Rosso Corsa red body with bright red (#DC2828) covering the entire body, wings, and nose cone. Small white rectangular sponsor panels on sidepods and nose. Thin yellow accent on rear wing endplates. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Perfect side profile view, lateral view, wheel center at same height as camera, entire car visible in profile from nose to rear wing. 16:9 aspect ratio.
```

#### Prompt 3 — Rear 3/4 View

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Ferrari F1-89/640 livery reference. Solid Rosso Corsa red body with bright red (#DC2828) covering the entire body, wings, and nose cone. Small white rectangular sponsor panels on sidepods and nose. Thin yellow accent on rear wing endplates. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels, visible exhaust pipes at rear. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Rear three-quarter view, camera at wheel center height — same eye level as the side profile view, rotated approximately 45 degrees around the car to show the rear section, entire car in frame from rear-left or rear-right angle. 16:9 aspect ratio.
```

#### Prompt 4 — Front View (Head-On)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Ferrari F1-89/640 livery reference. Solid Rosso Corsa red body with bright red (#DC2828) covering the entire body, wings, and nose cone. Small white rectangular sponsor panels on sidepods and nose. Thin yellow accent on rear wing endplates. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at wheel center height, positioned directly behind the car at ground level, exhaust centered in frame, rear wing full face visible, rear wheels symmetrical. 16:9 aspect ratio.
```

#### Prompt 5 — Rear View (Direct)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Ferrari F1-89/640 livery reference. Solid Rosso Corsa red body with bright red (#DC2828) covering the entire body, wings, and nose cone. Small white rectangular sponsor panels on sidepods and nose. Thin yellow accent on rear wing endplates. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible from behind. Exposed rear wheels with visible tread pattern, twin exhaust pipes at center rear, black rear diffuser, visible rear suspension arms. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at ground level centered behind the car, rear wing centered and full face visible symmetrical, exhaust pipes centered below wing, rear wheels symmetrical on both sides, entire rear section in frame. 16:9 aspect ratio.
```

#### Prompt 6 — Cockpit POV (Driver's Eye)

```
Kosuke Fujishima and Hino Matsuri fusion style, driver's eye view from inside the cockpit of a 1989 Ferrari F1-89/640 Formula 1 car — the first F1 car with paddle shift. A flat-bottom MOMO 270mm 3-spoke suede steering wheel with a quick-release hub dominates the center, its squared-off lower section and compact diameter creating a purposeful racing silhouette. The suede rim is thin with 4 silver hex bolts on the hub. Behind the wheel, visible through the steering wheel opening, sits a large full-round analog tachometer centrally mounted on the dark carbon fiber dashboard — a traditional round gauge with a white face, black markings up to 14,000 RPM, and a sweeping red needle, consistent with Ferrari's classic instrument style. Flanking the tachometer are smaller analog auxiliary gauges for water temperature and oil pressure on each side. A small rectangular digital gear indicator with bright red numerals sits in the corner. Two metallic paddle shifters are positioned behind the steering wheel — right paddle for upshifts, left for downshifts — plus a smaller clutch paddle for starts and pit exits. No gear lever, no clutch pedal — only two pedals in the footwell. Carbon fiber monocoque walls with Rosso Corsa red livery panels. Two rectangular side mirrors with orange trim. Narrow cockpit opening with electronics routed through the steering column. No driver, no helmet, no hands. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

#### Prompt 7 — Cockpit POV (Helmet Cam, Slightly Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, helmet camera view from inside the cockpit of a 1989 Ferrari F1-89/640 Formula 1 car, slightly elevated looking down and forward. The MOMO flat-bottom 270mm suede steering wheel with quick-release hub and 4 silver hex bolts fills the lower half — its distinctive squared-off lower profile and compact D-shaped silhouette dominant in the frame. Through the upper opening of the wheel rim, visible on the dark matte dashboard: a large full-round analog tachometer centrally positioned with a white face, black markings, and red sweeping needle — a traditional round gauge, not an arc. Smaller analog water temperature and oil pressure gauges flank the tachometer on each side. A small digital gear indicator with bright red numerals at the lower corner. Two metallic paddle shifters visible behind the wheel on each side, plus a smaller clutch paddle. No gear lever. Only two pedals in the footwell — accelerator and brake, no clutch pedal. Red seat bolsters. Dark carbon fiber floor. Transparent windscreen at top. Tire tread visible above cockpit. Rosso Corsa red livery panels. No driver, empty cockpit. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

#### Prompt 8 — Cockpit Interior Reference (Empty, Diagonal Above)

```
Kosuke Fujishima and Hino Matsuri fusion style, looking down into the empty open cockpit of a 1989 Ferrari F1-89/640 Formula 1 car from above-left diagonal angle. The MOMO flat-bottom 270mm 3-spoke suede steering wheel with quick-release hub is mounted on the steering column — its compact D-shaped silhouette and squared-off lower edge immediately distinctive. On the dark carbon fiber dashboard behind the wheel: a large full-round analog tachometer centrally mounted with white face, black markings, and red needle — the classic Ferrari round instrument. Smaller analog water temperature and oil pressure gauges flank the tachometer on each side. A small digital gear indicator with red numerals at lower corner. Two metallic paddle shifters visible behind the wheel (right upshift, left downshift) plus a smaller clutch paddle — no gear lever anywhere, the space where a lever would be is clean and open. Only two pedals in the footwell (accelerator, brake), no clutch pedal. Black carbon fiber seat with red bolsters. Narrow cockpit walls with Rosso Corsa red livery. Transparent windscreen. Two rectangular side mirrors with orange trim. No driver, no helmet, no hands. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

---

### Technical Notes (from Technical Artist)

- **Colliders**: Compound primitive — box (body) + sphere (wheels × 4), no mesh collider
- **Rigging**: No skeleton — wheels rotate via script, no suspension bones in MVP
- **FBX Export**: -Z Forward, Y Up, Scale 1.0, Face smoothing, Triangulate
- **UV**: Single 2048² atlas, all 16 teams share same UV layout
- **Texture Variants**: 16 teams × 2 drivers = 32 texture files (or 16 if driver numbers baked)
- **Addressables Group**: Cars/team_tier1_b
- **WebGL Note**: 2048² texture (~5.3 MB) exceeds the 3 MB per-car bundle budget — downsample to 1024² for WebGL

**Status:** Updated — 8 prompts (6 angles + 2 cockpit variations).

---

### Trellis 2 Multiview Input (4 Image Sets)

Use these 4 prompts (front, left, back, right) to generate images for Trellis 2 multiview 3D reconstruction. Generate each at 1024×1024, 1:1 aspect ratio, PNG with transparent/removed background.

#### Trellis Front — Front View (Head-On)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Ferrari F1-89/640 livery reference. Solid Rosso Corsa red body with bright red (#DC2828) covering the entire body, wings, and nose cone. Small white rectangular sponsor panels on sidepods and nose. Thin yellow accent on rear wing endplates. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct front view, camera at wheel center height, positioned directly in front of the car at ground level, nose centered in frame, front wing full face visible, front wheels symmetrical. 1:1 aspect ratio.
```

#### Trellis Left — Side Profile (Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Ferrari F1-89/640 livery reference. Solid Rosso Corsa red body with bright red (#DC2828) covering the entire body, wings, and nose cone. Small white rectangular sponsor panels on sidepods and nose. Thin yellow accent on rear wing endplates. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Left side profile view, camera elevated approximately 30 degrees above horizontal, cockpit opening visible from above, entire car visible in profile from nose to rear wing. 1:1 aspect ratio.
```

#### Trellis Back — Rear View (Direct)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Ferrari F1-89/640 livery reference. Solid Rosso Corsa red body with bright red (#DC2828) covering the entire body, wings, and nose cone. Small white rectangular sponsor panels on sidepods and nose. Thin yellow accent on rear wing endplates. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible from behind. Exposed rear wheels with visible tread pattern, twin exhaust pipes at center rear, black rear diffuser, visible rear suspension arms. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at wheel center height, positioned directly behind the car at ground level, exhaust centered in frame, rear wing full face visible, rear wheels symmetrical. 1:1 aspect ratio.
```

#### Trellis Right — Side Profile (Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Ferrari F1-89/640 livery reference. Solid Rosso Corsa red body with bright red (#DC2828) covering the entire body, wings, and nose cone. Small white rectangular sponsor panels on sidepods and nose. Thin yellow accent on rear wing endplates. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Right side profile view, camera elevated approximately 30 degrees above horizontal, cockpit opening visible from above, entire car visible in profile from nose to rear wing. 1:1 aspect ratio.
```
