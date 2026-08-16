# Asset Specs — System: Car Definition Data

> **Team**: Rigel (team_tier4_a)
> **Car Reference**: Rial ARC2
> **Art Bible**: design/art/art-bible.md
> **Generated**: 2026-07-28
> **Status**: 1 asset specced / 0 approved / 0 in production

---

## ASSET-001 — Car: Rigel (Rial ARC2 Parody)

| Field | Value |
|-------|-------|
| Category | 3D Asset (Reference) |
| Team ID | team_tier4_a |
| Car Reference | Rial ARC2 |
| Real-World Team | Rial-Ford |
| Livery Base | Rial Blue body with Yellow accents |
| Base Mesh | Shared (LOD0-3, 35k→1k tris) |
| Texture | 2048×2048, ASTC 6×6, PNG source |
| Material | URP Simple Lit, smoothness 0.25 |
| Background | Solid gray (#CCCCCC) |
| Driver | Not included |
| Car Numbers | Not included (add as decal post-gen) |
| View | Package of 8 angle renders |
| Reference Photo | https://f1colours.sebpatrick.co.uk/teams/rial/ |

### Location in Project

| Asset | Path |
|-------|------|
| Base Mesh | Assets/Art/Cars/Base/Models/ |
| Texture | Assets/Art/Cars/tier4a/Textures/ |
| Material | Assets/Art/Cars/tier4a/Materials/ |
| Prefab | Assets/Art/Cars/tier4a/Prefabs/ |

### Art Bible Anchors

- §2.2 Team Identity: Primary #1A3A8C (Rial Blue), Secondary #F5C518 (Yellow)
- §5.5 Era: 1989 F1 silhouette — low nose, no halo, open cockpit, exposed driver helmet area
- §8.1 Polygon Budget: LOD0 35k tris, LOD1 12.5k, LOD2 4k, LOD3 1k
- §8.3 Texture Standards: 2048², all cars equal quality, ASTC 6×6
- §8.5 Shader: URP Simple Lit, single material per car

### Livery Description

Rial Blue (#1A3A8C) body covering the monocoque, nose cone, sidepods, engine cover, and front wing mainplanes — approximately 70% of visible surface. Yellow (#F5C518) covering the sidepod lower panels, rear wing mainplane and endplates, front wing endplates, and a thin longitudinal stripe on the engine cover — approximately 30%. The defining visual element is the deep Rial Blue body with bright yellow accent panels creating a strong blue and yellow contrast. Clean, sculpted sidepod inlet shapes. Open wheels with visible double-wishbone suspension arms. No wheel covers — brake discs visible behind spokes.

Sponsor decals simulated as geometric color blocks (no text): small rectangular white panels on sidepod surfaces. No real brand logos.

---

### Generation Prompts (Copy each one separately)

#### Prompt 1 — Front 3/4 View

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Rial ARC2 livery reference. Rial Blue body (#1A3A8C) with yellow (#F5C518) sidepod lower panels and wing endplates. Bold blue and yellow livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Full car visible from front three-quarter view, approximately 45 degrees from front, slightly elevated camera angle, entire car in frame. 16:9 aspect ratio.
```

#### Prompt 2 — Side Profile

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Rial ARC2 livery reference. Rial Blue body (#1A3A8C) with yellow (#F5C518) sidepod lower panels and wing endplates. Bold blue and yellow livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Perfect side profile view, lateral view, wheel center at same height as camera, entire car visible in profile from nose to rear wing. 16:9 aspect ratio.
```

#### Prompt 3 — Rear 3/4 View

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Rial ARC2 livery reference. Rial Blue body (#1A3A8C) with yellow (#F5C518) sidepod lower panels and wing endplates. Bold blue and yellow livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels, visible exhaust pipes at rear. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Rear three-quarter view, camera at wheel center height — same eye level as the side profile view, rotated approximately 45 degrees around the car to show the rear section, entire car in frame from rear-left or rear-right angle. 16:9 aspect ratio.
```

#### Prompt 4 — Front View (Head-On)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Rial ARC2 livery reference. Rial Blue body (#1A3A8C) with yellow (#F5C518) sidepod lower panels and wing endplates. Bold blue and yellow livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at wheel center height, positioned directly behind the car at ground level, exhaust centered in frame, rear wing full face visible, rear wheels symmetrical. 16:9 aspect ratio.
```

#### Prompt 5 — Rear View (Direct)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Rial ARC2 livery reference. Rial Blue body (#1A3A8C) with yellow (#F5C518) sidepod lower panels and wing endplates. Bold blue and yellow livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible from behind. Exposed rear wheels with visible tread pattern, twin exhaust pipes at center rear, black rear diffuser, visible rear suspension arms. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at ground level centered behind the car, rear wing centered and full face visible symmetrical, exhaust pipes centered below wing, rear wheels symmetrical on both sides, entire rear section in frame. 16:9 aspect ratio.
```

#### Prompt 6 — Cockpit POV (Driver's Eye)

```
Kosuke Fujishima and Hino Matsuri fusion style, driver's eye view from inside the cockpit of a 1989 Rial ARC2 Formula 1 car. A round 3-spoke black suede Jack Knight steering wheel dominates the center of the frame — it is the main focal point, the Jack Knight brand logo on the hub. The rim is thin suede with 4 silver hex bolts. Through the upper opening of the steering wheel, visible on the dark matte carbon fiber dashboard behind it, sits a conventional analog tachometer — a basic full-round gauge with a black face, white numbers, and a thin red needle, no frills. Below the tachometer are minimal analog auxiliary gauges for water temperature and oil pressure — simple functional round dials with black faces. Everything is basic and minimal — the Rial was a budget team and the cockpit reflects that, with no digital displays, no complex electronics, just the essential instruments stripped of any luxury. One small green indicator light at top-left. One small red push-button at bottom-right. A metallic spherical gear knob on a short H-pattern 6-speed lever to the right. Carbon fiber monocoque walls with Rial Blue and yellow livery panels. Two rectangular side mirrors with orange trim. Tight cockpit opening with a very compact layout — the Rial ARC2 was built to minimum dimensions by a team operating on a shoestring budget. No driver, no helmet, no hands. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

#### Prompt 7 — Cockpit POV (Helmet Cam, Slightly Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, helmet camera view from inside the cockpit of a 1989 Rial ARC2 Formula 1 car, slightly elevated looking down and forward. The round 3-spoke black suede Jack Knight steering wheel with 4 silver hex bolts fills the lower half — it is the dominant element. Through the upper opening of the wheel rim, visible on the dark matte dashboard: a basic analog tachometer with black face and white markings — a simple, functional gauge with no advanced features. Minimal auxiliary analog dials for water temperature and oil pressure below. The dashboard is stark and no-frills, reflecting the Rial team's limited budget — just the essential instruments and nothing more. One green indicator light. One red push-button. Red seat bolsters. Carbon fiber floor with metallic 6-speed gear knob on the right. Transparent windscreen at top. Tire tread visible above cockpit. Rial Blue and yellow livery panels. No driver, empty cockpit. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

#### Prompt 8 — Cockpit Interior Reference (Empty, Diagonal Above)

```
Kosuke Fujishima and Hino Matsuri fusion style, looking down into the empty open cockpit of a 1989 Rial ARC2 Formula 1 car from above-left diagonal angle. The round 3-spoke black suede Jack Knight steering wheel is mounted on the steering column. On the dark trapezoidal carbon fiber dashboard behind the wheel: a basic analog tachometer with simple black face and white markings — functional and minimal. Basic analog auxiliary gauges for water temperature and oil pressure below. No digital displays, no advanced electronics — the Rial cockpit is stark and purposefully minimal, reflecting a team operating on a tight budget with no room for extras. One green indicator light at top-left. One red push-button at bottom-right. H-pattern 6-speed gear lever with metallic spherical knob on the right. Black carbon fiber seat with red bolsters. Tight cockpit walls with Rial Blue and yellow livery — a no-frills cockpit design built to minimum cost. Transparent windscreen. Two rectangular side mirrors with orange trim. No driver, no helmet, no hands. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

---

### Technical Notes (from Technical Artist)

- **Colliders**: Compound primitive — box (body) + sphere (wheels × 4), no mesh collider
- **Rigging**: No skeleton — wheels rotate via script, no suspension bones in MVP
- **FBX Export**: -Z Forward, Y Up, Scale 1.0, Face smoothing, Triangulate
- **UV**: Single 2048² atlas, all 16 teams share same UV layout
- **Texture Variants**: 16 teams × 2 drivers = 32 texture files (or 16 if driver numbers baked)
- **Addressables Group**: Cars/team_tier4_a
- **WebGL Note**: 2048² texture (~5.3 MB) exceeds the 3 MB per-car bundle budget — downsample to 1024² for WebGL

**Status:** Updated — 8 prompts (6 angles + 2 cockpit variations).

---

### Trellis 2 Multiview Input (4 Image Sets)

Use these 4 prompts (front, left, back, right) to generate images for Trellis 2 multiview 3D reconstruction. Generate each at 1024×1024, 1:1 aspect ratio, PNG with transparent/removed background.

#### Trellis Front — Front View (Head-On)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Rial ARC2 livery reference. Rial Blue body (#1A3A8C) with yellow (#F5C518) sidepod lower panels and wing endplates. Bold blue and yellow livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct front view, camera at wheel center height, positioned directly in front of the car at ground level, nose centered in frame, front wing full face visible, front wheels symmetrical. 1:1 aspect ratio.
```

#### Trellis Left — Side Profile (Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Rial ARC2 livery reference. Rial Blue body (#1A3A8C) with yellow (#F5C518) sidepod lower panels and wing endplates. Bold blue and yellow livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Left side profile view, camera elevated approximately 30 degrees above horizontal, cockpit opening visible from above, entire car visible in profile from nose to rear wing. 1:1 aspect ratio.
```

#### Trellis Back — Rear View (Direct)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Rial ARC2 livery reference. Rial Blue body (#1A3A8C) with yellow (#F5C518) sidepod lower panels and wing endplates. Bold blue and yellow livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible from behind. Exposed rear wheels with visible tread pattern, twin exhaust pipes at center rear, black rear diffuser, visible rear suspension arms. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at wheel center height, positioned directly behind the car at ground level, exhaust centered in frame, rear wing full face visible, rear wheels symmetrical. 1:1 aspect ratio.
```

#### Trellis Right — Side Profile (Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Rial ARC2 livery reference. Rial Blue body (#1A3A8C) with yellow (#F5C518) sidepod lower panels and wing endplates. Bold blue and yellow livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Right side profile view, camera elevated approximately 30 degrees above horizontal, cockpit opening visible from above, entire car visible in profile from nose to rear wing. 1:1 aspect ratio.
```
