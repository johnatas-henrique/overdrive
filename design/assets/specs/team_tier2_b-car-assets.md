# Asset Specs — System: Car Definition Data

> **Team**: Losel (team_tier2_b)
> **Car Reference**: Lotus 101
> **Art Bible**: design/art/art-bible.md
> **Generated**: 2026-07-28
> **Status**: 1 asset specced / 0 approved / 0 in production

---

## ASSET-001 — Car: Losel (Lotus 101 Parody)

| Field | Value |
|-------|-------|
| Category | 3D Asset (Reference) |
| Team ID | team_tier2_b |
| Car Reference | Lotus 101 |
| Real-World Team | Lotus-Judd |
| Livery Base | Camel Yellow body with Dark Blue accents |
| Base Mesh | Shared (LOD0-3, 35k→1k tris) |
| Texture | 2048×2048, ASTC 6×6, PNG source |
| Material | URP Simple Lit, smoothness 0.25 |
| Background | Solid gray (#CCCCCC) |
| Driver | Not included |
| Car Numbers | Not included (add as decal post-gen) |
| View | Package of 8 angle renders |
| Reference Photo | https://www.motorsportretro.com/2014/08/camel-lotus-101/ |

### Location in Project

| Asset | Path |
|-------|------|
| Base Mesh | Assets/Art/Cars/Base/Models/ |
| Texture | Assets/Art/Cars/tier2b/Textures/ |
| Material | Assets/Art/Cars/tier2b/Materials/ |
| Prefab | Assets/Art/Cars/tier2b/Prefabs/ |

### Art Bible Anchors

- §2.2 Team Identity: Primary #E8A830 (Camel Yellow), Secondary #1A3A6B (Dark Blue)
- §5.5 Era: 1989 F1 silhouette — low nose, no halo, open cockpit, exposed driver helmet area
- §8.1 Polygon Budget: LOD0 35k tris, LOD1 12.5k, LOD2 4k, LOD3 1k
- §8.3 Texture Standards: 2048², all cars equal quality, ASTC 6×6
- §8.5 Shader: URP Simple Lit, single material per car

### Livery Description

Camel Yellow (#E8A830) body covering the monocoque, nose cone, sidepods, engine cover, and front wing mainplanes — approximately 65% of visible surface. Dark Blue (#1A3A6B) covering the sidepod lower sections, a longitudinal central stripe on the engine cover and nose, rear wing mainplane and endplates, and front wing endplates — approximately 35%. The defining visual element is the bold Camel Yellow body contrasted by the dark blue stripe running from the nose tip through the engine cover to the rear wing. Clean, sculpted sidepod inlet shapes. Open wheels with visible double-wishbone suspension arms. No wheel covers — brake discs visible behind spokes.

Sponsor decals simulated as geometric color blocks (no text): small white rectangular panels on sidepod surfaces. No real brand logos.

---

### Generation Prompts (Copy each one separately)

#### Prompt 1 — Front 3/4 View

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Lotus 101 livery reference. Camel Yellow body (#E8A830) with dark blue (#1A3A6B) central stripe and wing accents. Bold yellow and blue contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Full car visible from front three-quarter view, approximately 45 degrees from front, slightly elevated camera angle, entire car in frame. 16:9 aspect ratio.
```

#### Prompt 2 — Side Profile

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Lotus 101 livery reference. Camel Yellow body (#E8A830) with dark blue (#1A3A6B) central stripe and wing accents. Bold yellow and blue contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Perfect side profile view, lateral view, wheel center at same height as camera, entire car visible in profile from nose to rear wing. 16:9 aspect ratio.
```

#### Prompt 3 — Rear 3/4 View

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Lotus 101 livery reference. Camel Yellow body (#E8A830) with dark blue (#1A3A6B) central stripe and wing accents. Bold yellow and blue contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels, visible exhaust pipes at rear. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Rear three-quarter view, camera at wheel center height — same eye level as the side profile view, rotated approximately 45 degrees around the car to show the rear section, entire car in frame from rear-left or rear-right angle. 16:9 aspect ratio.
```

#### Prompt 4 — Front View (Head-On)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Lotus 101 livery reference. Camel Yellow body (#E8A830) with dark blue (#1A3A6B) central stripe and wing accents. Bold yellow and blue contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at wheel center height, positioned directly behind the car at ground level, exhaust centered in frame, rear wing full face visible, rear wheels symmetrical. 16:9 aspect ratio.
```

#### Prompt 5 — Rear View (Direct)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Lotus 101 livery reference. Camel Yellow body (#E8A830) with dark blue (#1A3A6B) central stripe and wing accents. Bold yellow and blue contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible from behind. Exposed rear wheels with visible tread pattern, twin exhaust pipes at center rear, black rear diffuser, visible rear suspension arms. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at ground level centered behind the car, rear wing centered and full face visible symmetrical, exhaust pipes centered below wing, rear wheels symmetrical on both sides, entire rear section in frame. 16:9 aspect ratio.
```

#### Prompt 6 — Cockpit POV (Driver's Eye)

```
Kosuke Fujishima and Hino Matsuri fusion style, driver's eye view from inside the cockpit of a 1989 Lotus 101 Formula 1 car — the narrowest cockpit on the grid. A special narrow MOMO flat-bottom 3-spoke steering wheel, built to a smaller diameter than standard to fit the exceptionally tight cockpit walls, dominates the center of the frame. The rim is black suede with 4 silver hex bolts on the hub, and the reduced diameter is immediately noticeable — the wheel sits closer to the driver and has less clearance to the monocoque sides than any other car. Through the upper opening of the steering wheel, visible on the dark matte carbon fiber dashboard behind it, sits an analog tachometer — a Smiths or similar British instrument with a round gauge face, white markings, and a thin red needle, mounted in a very tight dashboard space. Smaller analog auxiliary gauges are packed closely beside and below the tachometer — water temperature, oil pressure — all traditional round dials with black faces and thin metal needles. No digital displays. One small green indicator light at top-left. One small red push-button at bottom-right. A metallic spherical gear knob on a short H-pattern 6-speed lever to the right. Carbon fiber monocoque walls with Camel Yellow and dark blue livery panels. Two rectangular side mirrors with orange trim. Extremely narrow cockpit opening — the tightest in the 1989 F1 field, with the driver barely fitting between the monocoque sides, requiring MOMO to build a bespoke smaller wheel. No driver, no helmet, no hands. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

#### Prompt 7 — Cockpit POV (Helmet Cam, Slightly Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, helmet camera view from inside the cockpit of a 1989 Lotus 101 Formula 1 car, slightly elevated looking down and forward. The narrow MOMO flat-bottom suede steering wheel, noticeably smaller diameter than standard, fills the lower half — its compact size and flat-bottom D-shaped profile are the most distinctive elements, the reduced clearance to the cockpit walls visible on each side. Through the upper opening of the wheel rim, visible on the dark matte dashboard: a Smiths analog tachometer with a traditional round gauge face, white markings, and red needle — a classic British instrument. Small analog auxiliary gauges for water temperature and oil pressure are packed tightly beside it. No digital displays — only traditional round dials. One green indicator light. One red push-button. Red seat bolsters. Carbon fiber floor with metallic 6-speed gear knob on the right. Transparent windscreen at top. Tire tread visible above cockpit. Camel Yellow and dark blue livery panels. No driver, empty cockpit. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

#### Prompt 8 — Cockpit Interior Reference (Empty, Diagonal Above)

```
Kosuke Fujishima and Hino Matsuri fusion style, looking down into the empty open cockpit of a 1989 Lotus 101 Formula 1 car from above-left diagonal angle. The narrow MOMO flat-bottom 3-spoke suede steering wheel, custom-built to a smaller diameter than standard, is mounted on the steering column — its compact D-shaped silhouette is the most distinctive element in the cockpit, chosen specifically because a standard wheel would not fit the Lotus's extremely narrow monocoque. On the dark trapezoidal carbon fiber dashboard behind the wheel: a Smiths analog tachometer with traditional round gauge face and white markings — a classic British gauge. Smaller analog auxiliary dials for water temperature and oil pressure are packed tightly beside it. All analog, no digital displays. One green indicator light at top-left. One red push-button at bottom-right. H-pattern 6-speed gear lever with metallic spherical knob on the right. Black carbon fiber seat with red bolsters. Extremely narrow and compact cockpit walls with Camel Yellow and dark blue livery — the tightest cockpit fit in the field, with the monocoque sides visibly closer together than any other 1989 F1 car. Transparent windscreen. Two rectangular side mirrors with orange trim. No driver, no helmet, no hands. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

---

### Technical Notes (from Technical Artist)

- **Colliders**: Compound primitive — box (body) + sphere (wheels × 4), no mesh collider
- **Rigging**: No skeleton — wheels rotate via script, no suspension bones in MVP
- **FBX Export**: -Z Forward, Y Up, Scale 1.0, Face smoothing, Triangulate
- **UV**: Single 2048² atlas, all 16 teams share same UV layout
- **Texture Variants**: 16 teams × 2 drivers = 32 texture files (or 16 if driver numbers baked)
- **Addressables Group**: Cars/team_tier2_b
- **WebGL Note**: 2048² texture (~5.3 MB) exceeds the 3 MB per-car bundle budget — downsample to 1024² for WebGL

**Status:** Updated — 8 prompts (6 angles + 2 cockpit variations).

---

### Trellis 2 Multiview Input (4 Image Sets)

Use these 4 prompts (front, left, back, right) to generate images for Trellis 2 multiview 3D reconstruction. Generate each at 1024×1024, 1:1 aspect ratio, PNG with transparent/removed background.

#### Trellis Front — Front View (Head-On)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Lotus 101 livery reference. Camel Yellow body (#E8A830) with dark blue (#1A3A6B) central stripe and wing accents. Bold yellow and blue contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct front view, camera at wheel center height, positioned directly in front of the car at ground level, nose centered in frame, front wing full face visible, front wheels symmetrical. 1:1 aspect ratio.
```

#### Trellis Left — Side Profile (Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Lotus 101 livery reference. Camel Yellow body (#E8A830) with dark blue (#1A3A6B) central stripe and wing accents. Bold yellow and blue contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Left side profile view, camera elevated approximately 30 degrees above horizontal, cockpit opening visible from above, entire car visible in profile from nose to rear wing. 1:1 aspect ratio.
```

#### Trellis Back — Rear View (Direct)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Lotus 101 livery reference. Camel Yellow body (#E8A830) with dark blue (#1A3A6B) central stripe and wing accents. Bold yellow and blue contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible from behind. Exposed rear wheels with visible tread pattern, twin exhaust pipes at center rear, black rear diffuser, visible rear suspension arms. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at wheel center height, positioned directly behind the car at ground level, exhaust centered in frame, rear wing full face visible, rear wheels symmetrical. 1:1 aspect ratio.
```

#### Trellis Right — Side Profile (Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Lotus 101 livery reference. Camel Yellow body (#E8A830) with dark blue (#1A3A6B) central stripe and wing accents. Bold yellow and blue contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Right side profile view, camera elevated approximately 30 degrees above horizontal, cockpit opening visible from above, entire car visible in profile from nose to rear wing. 1:1 aspect ratio.
```
