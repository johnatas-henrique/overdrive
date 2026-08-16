# Asset Specs — System: Car Definition Data

> **Team**: Madonna (team_tier1_a)
> **Car Reference**: McLaren MP4/5 (1989)
> **Art Bible**: design/art/art-bible.md
> **Generated**: 2026-07-28
> **Status**: 1 asset specced / 0 approved / 0 in production

---

## ASSET-001 — Car: Madonna (McLaren MP4/5 Parody)

| Field | Value |
|-------|-------|
| Category | 3D Asset (Reference) |
| Team ID | team_tier1_a |
| Car Reference | McLaren MP4/5 (1989) |
| Real-World Team | McLaren-Honda |
| Livery Base | White body, fluorescent red sidepods |
| Base Mesh | Shared (LOD0-3, 35k→1k tris) |
| Texture | 2048×2048, ASTC 6×6, PNG source |
| Material | URP Simple Lit, smoothness 0.25 |
| Background | Solid gray (#CCCCCC) |
| Driver | Not included |
| Car Numbers | Not included (add as decal post-gen) |
| View | Package of 8 angle renders |
| Reference Photo | https://www.formula1.com/en/latest/article/mclaren-liveries-through-the-years |

### Location in Project

| Asset | Path |
|-------|------|
| Base Mesh | Assets/Art/Cars/Base/Models/ |
| Texture | Assets/Art/Cars/tier1a/Textures/ |
| Material | Assets/Art/Cars/tier1a/Materials/ |
| Prefab | Assets/Art/Cars/tier1a/Prefabs/ |

### Art Bible Anchors

- §2.2 Team Identity: Primary #E03C31 (Marlboro Red), Secondary #FFF8F0 (White)
- §5.5 Era: 1989 F1 silhouette — low nose, no halo, open cockpit, exposed driver helmet area
- §8.1 Polygon Budget: LOD0 35k tris, LOD1 12.5k, LOD2 4k, LOD3 1k
- §8.3 Texture Standards: 2048², all cars equal quality, ASTC 6×6
- §8.5 Shader: URP Simple Lit, single material per car

### Livery Description

White body covering the monocoque, nose cone, upper engine cover, and front wing mainplanes — approximately 55% of visible surface. Bright fluorescent red (Marlboro Red) covering the sidepods (entire outer surface), engine cover lower section, rear wing mainplane and endplates, front wing endplates, nose cone tip, and mirror housings — approximately 40% of visible surface. The defining visual element is the red chevron/inverted V-shape on the nose cone pointing toward the nose tip. Large central air intake scoop above the driver's head. Clean, sculpted sidepod inlet shapes. Open wheels with visible double-wishbone suspension arms. No wheel covers — brake discs visible behind spokes.

Sponsor decals simulated as geometric color blocks (no text): rectangular white panels on sidepod outer surfaces (sponsor text area), small yellow accent stripe on engine cover sides. No real brand logos.

---

### Generation Prompts (Copy each one separately)

#### Prompt 1 — Front 3/4 View

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, McLaren MP4/5 livery reference. White body with bright fluorescent red sidepods, engine cover, and wing endplates. Red chevron on nose cone. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement, small yellow stripe on engine cover sides. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Full car visible from front three-quarter view, approximately 45 degrees from front, slightly elevated camera angle, entire car in frame. 16:9 aspect ratio.
```

#### Prompt 2 — Side Profile

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, McLaren MP4/5 livery reference. White body with bright fluorescent red sidepods, engine cover, and wing endplates. Red chevron on nose cone. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement, small yellow stripe on engine cover sides. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Perfect side profile view, lateral view, wheel center at same height as camera, entire car visible in profile from nose to rear wing. 16:9 aspect ratio.
```

#### Prompt 3 — Rear 3/4 View

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, McLaren MP4/5 livery reference. White body with bright fluorescent red sidepods, engine cover, and wing endplates. Red chevron on nose cone. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement, small yellow stripe on engine cover sides. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels, visible exhaust pipes at rear. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Rear three-quarter view, camera at wheel center height — same eye level as the side profile view, rotated approximately 45 degrees around the car to show the rear section, entire car in frame from rear-left or rear-right angle. 16:9 aspect ratio.
```

#### Prompt 4 — Front View (Head-On)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, McLaren MP4/5 livery reference. White body with bright fluorescent red sidepods, engine cover, and wing endplates. Red chevron on nose cone. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement, small yellow stripe on engine cover sides. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at wheel center height, positioned directly behind the car at ground level, exhaust centered in frame, rear wing full face visible, rear wheels symmetrical. 16:9 aspect ratio.
```

#### Prompt 5 — Rear View (Direct)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, McLaren MP4/5 livery reference. White body with bright fluorescent red sidepods, engine cover, and wing endplates. Red chevron on nose cone. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement, small yellow stripe on engine cover sides. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible from behind. Exposed rear wheels with visible tread pattern, twin exhaust pipes at center rear, black rear diffuser, visible rear suspension arms. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at ground level centered behind the car, rear wing centered and full face visible symmetrical, exhaust pipes centered below wing, rear wheels symmetrical on both sides, entire rear section in frame. 16:9 aspect ratio.
```

#### Prompt 6 — Cockpit POV (Driver's Eye)

```
Kosuke Fujishima and Hino Matsuri fusion style, driver's eye view from inside the cockpit of a 1989 McLaren MP4/5 Formula 1 car. A large black suede-wrapped round 3-spoke steering wheel with "PERSONAL" crown logo dominates the center of the frame — it is the main focal point. The rim is thin and suede-textured, with 4 silver hex bolts on the hub. Through the upper opening of the steering wheel, visible on the dark matte carbon fiber dashboard behind it, sits a horizontal orange arc-shaped tachometer (a half-circle lying on its flat edge, wider than tall, with white numbers 1 through 14 arranged along the arc and a thin red needle) — the tachometer is a wide shallow arc, NOT a full circle, occupying only the top strip of the dashboard. Directly below the tachometer arc, a small horizontal black rectangular digital display with glowing orange text showing gear and speed — the display sits in the space created by the flat bottom of the tachometer arc. Both instruments are visible through the steering wheel opening, both are compact and proportionally sized — the tachometer arc is about the width of the steering wheel hub, the display is about half that width. One small green indicator light at the top-left of the dashboard. One small red push-button at the bottom-right. No extra buttons, no extra switches, no additional controls. A metallic chrome spherical gear knob on a short stick to the right of the steering wheel. Carbon fiber monocoque walls with red and white livery panels. Two rectangular side mirrors with orange trim. Narrow cockpit opening. No driver, no helmet, no hands. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

#### Prompt 7 — Cockpit POV (Helmet Cam, Slightly Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, helmet camera view from inside the cockpit of a 1989 McLaren MP4/5 Formula 1 car, slightly elevated looking down and forward. The black round 3-spoke suede steering wheel with "PERSONAL" crown logo and 4 silver hex bolts fills the lower half — it is the dominant element. Through the upper opening of the wheel rim, visible on the dark matte dashboard: a horizontal orange arc-shaped tachometer (half-circle on its flat edge, wider than tall, white numbers 1-14 along the arc, thin red needle) — NOT a full circle, just a wide shallow arc occupying the top strip of the dashboard. Below the arc, a small horizontal black digital display with glowing orange text showing gear/speed — sitting in the flat space under the tachometer. Both instruments compact and visible through the wheel opening. One green indicator light. One red push-button. No extra buttons, no extra switches. The dashboard is small and secondary behind the large wheel. Red seat bolsters. Carbon fiber floor with metallic gear knob on the right. Transparent windscreen at top. Tire tread visible above cockpit. White and red livery panels. No driver, empty cockpit. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

#### Prompt 8 — Cockpit Interior Reference (Empty, Diagonal Above)

```
Kosuke Fujishima and Hino Matsuri fusion style, looking down into the empty open cockpit of a 1989 McLaren MP4/5 Formula 1 car from above-left diagonal angle. The black 3-spoke suede steering wheel with "PERSONAL" crown logo is the largest element, mounted on the steering column. On the dark trapezoidal carbon fiber dashboard behind the wheel: a horizontal orange arc-shaped tachometer (half-circle lying on its flat edge, wider than tall, white numbers 1-14 along the arc, thin red needle) — NOT a full circle, just a wide shallow arc at the top of the dashboard. Below the arc, a small horizontal black digital display with glowing orange text showing gear/speed. One green indicator light at top-left. One red push-button at bottom-right. No extra buttons, no extra switches, no additional gauges — just these three instruments on a clean sparse panel. Both instruments compact and proportional. H-pattern 6-speed gear lever with metallic knob on the right. Black carbon fiber seat with red bolsters. Narrow cockpit walls with red and white livery. Transparent windscreen. Two rectangular side mirrors with orange trim. No driver, no helmet, no hands. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

---

### Technical Notes (from Technical Artist)

- **Colliders**: Compound primitive — box (body) + sphere (wheels × 4), no mesh collider
- **Rigging**: No skeleton — wheels rotate via script, no suspension bones in MVP
- **FBX Export**: -Z Forward, Y Up, Scale 1.0, Face smoothing, Triangulate
- **UV**: Single 2048² atlas, all 16 teams share same UV layout
- **Texture Variants**: 16 teams × 2 drivers = 32 texture files (or 16 if driver numbers baked)
- **Addressables Group**: Cars/team_tier1_a
- **WebGL Note**: 2048² texture (~5.3 MB) exceeds the 3 MB per-car bundle budget — downsample to 1024² for WebGL

**Status:** Updated — 8 prompts (6 angles + 2 cockpit variations). Cockpit prompts rewritten from MP4/5 reference analysis. User testing needed.

---

### Trellis 2 Multiview Input (4 Image Sets)

Use these 4 prompts (front, left, back, right) to generate images for Trellis 2 multiview 3D reconstruction. Generate each at 1024×1024, 1:1 aspect ratio, PNG with transparent/removed background.

#### Trellis Front — Front View (Head-On)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, McLaren MP4/5 livery reference. White body with bright fluorescent red sidepods, engine cover, and wing endplates. Red chevron on nose cone. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement, small yellow stripe on engine cover sides. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct front view, camera at wheel center height, positioned directly in front of the car at ground level, nose centered in frame, front wing full face visible, front wheels symmetrical. 1:1 aspect ratio.
```

#### Trellis Left — Side Profile (Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, McLaren MP4/5 livery reference. White body with bright fluorescent red sidepods, engine cover, and wing endplates. Red chevron on nose cone. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement, small yellow stripe on engine cover sides. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Left side profile view, camera elevated approximately 30 degrees above horizontal, cockpit opening visible from above, entire car visible in profile from nose to rear wing. 1:1 aspect ratio.
```

#### Trellis Back — Rear View (Direct)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, McLaren MP4/5 livery reference. White body with bright fluorescent red sidepods, engine cover, and wing endplates. Red chevron on nose cone. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement, small yellow stripe on engine cover sides. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible from behind. Exposed rear wheels with visible tread pattern, twin exhaust pipes at center rear, black rear diffuser, visible rear suspension arms. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at wheel center height, positioned directly behind the car at ground level, exhaust centered in frame, rear wing full face visible, rear wheels symmetrical. 1:1 aspect ratio.
```

#### Trellis Right — Side Profile (Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, McLaren MP4/5 livery reference. White body with bright fluorescent red sidepods, engine cover, and wing endplates. Red chevron on nose cone. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement, small yellow stripe on engine cover sides. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Right side profile view, camera elevated approximately 30 degrees above horizontal, cockpit opening visible from above, entire car visible in profile from nose to rear wing. 1:1 aspect ratio.
```
