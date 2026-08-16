# Asset Specs — System: Car Definition Data

> **Team**: Bullets (team_tier3_d)
> **Car Reference**: Arrows A11
> **Art Bible**: design/art/art-bible.md
> **Generated**: 2026-07-28
> **Status**: 1 asset specced / 0 approved / 0 in production

---

## ASSET-001 — Car: Bullets (Arrows A11 Parody)

| Field | Value |
|-------|-------|
| Category | 3D Asset (Reference) |
| Team ID | team_tier3_d |
| Car Reference | Arrows A11 |
| Real-World Team | Arrows-Ford |
| Livery Base | White body with Red and Blue panels |
| Base Mesh | Shared (LOD0-3, 35k→1k tris) |
| Texture | 2048×2048, ASTC 6×6, PNG source |
| Material | URP Simple Lit, smoothness 0.25 |
| Background | Solid gray (#CCCCCC) |
| Driver | Not included |
| Car Numbers | Not included (add as decal post-gen) |
| View | Package of 8 angle renders |
| Reference Photo | https://f1colours.sebpatrick.co.uk/teams/arrows/ |

### Location in Project

| Asset | Path |
|-------|------|
| Base Mesh | Assets/Art/Cars/Base/Models/ |
| Texture | Assets/Art/Cars/tier3d/Textures/ |
| Material | Assets/Art/Cars/tier3d/Materials/ |
| Prefab | Assets/Art/Cars/tier3d/Prefabs/ |

### Art Bible Anchors

- §2.2 Team Identity: Primary #FFF8F0 (White), Secondary #E03C31 (Red) / #1E4D8C (Blue)
- §5.5 Era: 1989 F1 silhouette — low nose, no halo, open cockpit, exposed driver helmet area
- §8.1 Polygon Budget: LOD0 35k tris, LOD1 12.5k, LOD2 4k, LOD3 1k
- §8.3 Texture Standards: 2048², all cars equal quality, ASTC 6×6
- §8.5 Shader: URP Simple Lit, single material per car

### Livery Description

White (#FFF8F0) body covering the monocoque, nose cone, sidepod uppers, and engine cover — approximately 60% of visible surface. Red (#E03C31) covering the sidepod lower panels, a bold longitudinal stripe on the engine cover center, rear wing mainplane, and front wing mainplanes — approximately 25%. Blue (#1E4D8C) on the front wing endplates, rear wing endplates, and thin accent stripes on the sidepods — approximately 15%. The defining visual element is the predominantly white body with red and blue accent panels creating a patriotic tricolor livery. Clean, sculpted sidepod inlet shapes. Open wheels with visible double-wishbone suspension arms. No wheel covers — brake discs visible behind spokes.

Sponsor decals simulated as geometric color blocks (no text): rectangular white panels on sidepod outer surfaces. No real brand logos.

---

### Generation Prompts (Copy each one separately)

#### Prompt 1 — Front 3/4 View

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Arrows A11 livery reference. White body (#FFF8F0) with red (#E03C31) sidepod lower panels and engine cover stripe, blue (#1E4D8C) wing endplates. Tricolor white, red, and blue livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Full car visible from front three-quarter view, approximately 45 degrees from front, slightly elevated camera angle, entire car in frame. 16:9 aspect ratio.
```

#### Prompt 2 — Side Profile

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Arrows A11 livery reference. White body (#FFF8F0) with red (#E03C31) sidepod lower panels and engine cover stripe, blue (#1E4D8C) wing endplates. Tricolor white, red, and blue livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Perfect side profile view, lateral view, wheel center at same height as camera, entire car visible in profile from nose to rear wing. 16:9 aspect ratio.
```

#### Prompt 3 — Rear 3/4 View

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Arrows A11 livery reference. White body (#FFF8F0) with red (#E03C31) sidepod lower panels and engine cover stripe, blue (#1E4D8C) wing endplates. Tricolor white, red, and blue livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels, visible exhaust pipes at rear. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Rear three-quarter view, camera at wheel center height — same eye level as the side profile view, rotated approximately 45 degrees around the car to show the rear section, entire car in frame from rear-left or rear-right angle. 16:9 aspect ratio.
```

#### Prompt 4 — Front View (Head-On)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Arrows A11 livery reference. White body (#FFF8F0) with red (#E03C31) sidepod lower panels and engine cover stripe, blue (#1E4D8C) wing endplates. Tricolor white, red, and blue livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at wheel center height, positioned directly behind the car at ground level, exhaust centered in frame, rear wing full face visible, rear wheels symmetrical. 16:9 aspect ratio.
```

#### Prompt 5 — Rear View (Direct)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Arrows A11 livery reference. White body (#FFF8F0) with red (#E03C31) sidepod lower panels and engine cover stripe, blue (#1E4D8C) wing endplates. Tricolor white, red, and blue livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible from behind. Exposed rear wheels with visible tread pattern, twin exhaust pipes at center rear, black rear diffuser, visible rear suspension arms. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at ground level centered behind the car, rear wing centered and full face visible symmetrical, exhaust pipes centered below wing, rear wheels symmetrical on both sides, entire rear section in frame. 16:9 aspect ratio.
```

#### Prompt 6 — Cockpit POV (Driver's Eye)

```
Kosuke Fujishima and Hino Matsuri fusion style, driver's eye view from inside the cockpit of a 1989 Arrows A11 Formula 1 car — designed by Ross Brawn. A round 3-spoke black suede Arrows-Hewland steering wheel dominates the center of the frame, the Arrows team logo visible at the hub. The rim is thin suede with 4 silver hex bolts. Through the upper opening of the steering wheel, visible on the dark matte carbon fiber dashboard behind it, sits a Stack analog tachometer — a traditional circular gauge with a black face, white numbered markings around its perimeter, and a thin red sweeping needle, recognizable from the Stack brand instrument styling. Below the tachometer are analog auxiliary gauges for water temperature and oil pressure — round dials with black faces and thin metal needles. One small green indicator light at top-left. One small red push-button at bottom-right. A metallic spherical gear knob on a short lever to the right — and this is a unique feature for 1989: the Arrows A11 used an H-pattern 5-speed gearbox, the only 5-speed on the entire 1989 F1 grid while all other cars used 6-speed gearboxes. Carbon fiber monocoque walls with white and red livery panels. Two rectangular side mirrors with orange trim. Narrow cockpit opening with straight sidepod walls — a clean, uncluttered cockpit area designed by Ross Brawn. No driver, no helmet, no hands. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

#### Prompt 7 — Cockpit POV (Helmet Cam, Slightly Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, helmet camera view from inside the cockpit of a 1989 Arrows A11 Formula 1 car, slightly elevated looking down and forward. The round 3-spoke black suede Arrows-Hewland steering wheel with 4 silver hex bolts fills the lower half — it is the dominant element. Through the upper opening of the wheel rim, visible on the dark matte dashboard: a Stack analog tachometer with traditional circular gauge face, black background, white markings, and red sweeping needle — a classic analog instrument. Below it, small analog auxiliary gauges for water temperature and oil pressure. One green indicator light. One red push-button. Red seat bolsters. Carbon fiber floor with metallic gear knob on the right — the lever controls an H-pattern 5-speed gearbox, unique on the 1989 grid. Transparent windscreen at top. Tire tread visible above cockpit. White and red livery panels. No driver, empty cockpit. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

#### Prompt 8 — Cockpit Interior Reference (Empty, Diagonal Above)

```
Kosuke Fujishima and Hino Matsuri fusion style, looking down into the empty open cockpit of a 1989 Arrows A11 Formula 1 car from above-left diagonal angle. The round 3-spoke black suede Arrows-Hewland steering wheel is mounted on the steering column, the Arrows logo at the hub. On the dark trapezoidal carbon fiber dashboard behind the wheel: a Stack analog tachometer with traditional circular gauge face, black background, white markings, and red needle — a classic analog instrument. Analog auxiliary gauges for water temperature and oil pressure below. One green indicator light at top-left. One red push-button at bottom-right. The most distinctive feature: the H-pattern gear lever on the right controls a 5-speed gearbox, unique in the 1989 F1 field — the lever has only five forward gate positions instead of the usual six. Black carbon fiber seat with red bolsters. Narrow cockpit walls with white and red livery, the Ross Brawn-designed monocoque functional and clean. Transparent windscreen. Two rectangular side mirrors with orange trim. No driver, no helmet, no hands. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

---

### Technical Notes (from Technical Artist)

- **Colliders**: Compound primitive — box (body) + sphere (wheels × 4), no mesh collider
- **Rigging**: No skeleton — wheels rotate via script, no suspension bones in MVP
- **FBX Export**: -Z Forward, Y Up, Scale 1.0, Face smoothing, Triangulate
- **UV**: Single 2048² atlas, all 16 teams share same UV layout
- **Texture Variants**: 16 teams × 2 drivers = 32 texture files (or 16 if driver numbers baked)
- **Addressables Group**: Cars/team_tier3_d
- **WebGL Note**: 2048² texture (~5.3 MB) exceeds the 3 MB per-car bundle budget — downsample to 1024² for WebGL

**Status:** Updated — 8 prompts (6 angles + 2 cockpit variations).

---

### Trellis 2 Multiview Input (4 Image Sets)

Use these 4 prompts (front, left, back, right) to generate images for Trellis 2 multiview 3D reconstruction. Generate each at 1024×1024, 1:1 aspect ratio, PNG with transparent/removed background.

#### Trellis Front — Front View (Head-On)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Arrows A11 livery reference. White body (#FFF8F0) with red (#E03C31) sidepod lower panels and engine cover stripe, blue (#1E4D8C) wing endplates. Tricolor white, red, and blue livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct front view, camera at wheel center height, positioned directly in front of the car at ground level, nose centered in frame, front wing full face visible, front wheels symmetrical. 1:1 aspect ratio.
```

#### Trellis Left — Side Profile (Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Arrows A11 livery reference. White body (#FFF8F0) with red (#E03C31) sidepod lower panels and engine cover stripe, blue (#1E4D8C) wing endplates. Tricolor white, red, and blue livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Left side profile view, camera elevated approximately 30 degrees above horizontal, cockpit opening visible from above, entire car visible in profile from nose to rear wing. 1:1 aspect ratio.
```

#### Trellis Back — Rear View (Direct)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Arrows A11 livery reference. White body (#FFF8F0) with red (#E03C31) sidepod lower panels and engine cover stripe, blue (#1E4D8C) wing endplates. Tricolor white, red, and blue livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible from behind. Exposed rear wheels with visible tread pattern, twin exhaust pipes at center rear, black rear diffuser, visible rear suspension arms. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at wheel center height, positioned directly behind the car at ground level, exhaust centered in frame, rear wing full face visible, rear wheels symmetrical. 1:1 aspect ratio.
```

#### Trellis Right — Side Profile (Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Arrows A11 livery reference. White body (#FFF8F0) with red (#E03C31) sidepod lower panels and engine cover stripe, blue (#1E4D8C) wing endplates. Tricolor white, red, and blue livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Right side profile view, camera elevated approximately 30 degrees above horizontal, cockpit opening visible from above, entire car visible in profile from nose to rear wing. 1:1 aspect ratio.
```
