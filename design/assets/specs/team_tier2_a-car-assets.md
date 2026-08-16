# Asset Specs — System: Car Definition Data

> **Team**: May (team_tier2_a)
> **Car Reference**: March CG891
> **Art Bible**: design/art/art-bible.md
> **Generated**: 2026-07-28
> **Status**: 1 asset specced / 0 approved / 0 in production

---

## ASSET-001 — Car: May (March CG891 Parody)

| Field | Value |
|-------|-------|
| Category | 3D Asset (Reference) |
| Team ID | team_tier2_a |
| Car Reference | March CG891 |
| Real-World Team | March-Judd |
| Livery Base | Miami Blue body with Green accents |
| Base Mesh | Shared (LOD0-3, 35k→1k tris) |
| Texture | 2048×2048, ASTC 6×6, PNG source |
| Material | URP Simple Lit, smoothness 0.25 |
| Background | Solid gray (#CCCCCC) |
| Driver | Not included |
| Car Numbers | Not included (add as decal post-gen) |
| View | Package of 8 angle renders |
| Reference Photo | https://thebiggarage.jouwweb.nl/f1/f1-teams/leyton-house-f1/leyton-house-pages |

### Location in Project

| Asset | Path |
|-------|------|
| Base Mesh | Assets/Art/Cars/Base/Models/ |
| Texture | Assets/Art/Cars/tier2a/Textures/ |
| Material | Assets/Art/Cars/tier2a/Materials/ |
| Prefab | Assets/Art/Cars/tier2a/Prefabs/ |

### Art Bible Anchors

- §2.2 Team Identity: Primary #66C5C5 (Miami Blue), Secondary #2E7D32 (Green)
- §5.5 Era: 1989 F1 silhouette — low nose, no halo, open cockpit, exposed driver helmet area
- §8.1 Polygon Budget: LOD0 35k tris, LOD1 12.5k, LOD2 4k, LOD3 1k
- §8.3 Texture Standards: 2048², all cars equal quality, ASTC 6×6
- §8.5 Shader: URP Simple Lit, single material per car

### Livery Description

Miami Blue (#66C5C5) body covering the monocoque, nose cone, sidepods, engine cover, and front wing mainplanes — approximately 70% of visible surface. White (#FFF8F0) covering the sidepod lower panels, rear wing mainplane and endplates, front wing endplates, and a thin stripe along the engine cover sides — approximately 30%. The defining visual element is the bright Miami Blue body with clean white accent panels creating a crisp, fresh look. Clean, sculpted sidepod inlet shapes. Open wheels with visible double-wishbone suspension arms. No wheel covers — brake discs visible behind spokes.

Sponsor decals simulated as geometric color blocks (no text): rectangular white panels on sidepod outer surfaces. Small blue accent rectangles on the white endplates. No real brand logos.

---

### Generation Prompts (Copy each one separately)

#### Prompt 1 — Front 3/4 View

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, March CG891 livery reference. Miami Blue body (#66C5C5) with white (#FFF8F0) sidepod lower panels and wing endplates. Clean blue and white contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Full car visible from front three-quarter view, approximately 45 degrees from front, slightly elevated camera angle, entire car in frame. 16:9 aspect ratio.
```

#### Prompt 2 — Side Profile

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, March CG891 livery reference. Miami Blue body (#66C5C5) with white (#FFF8F0) sidepod lower panels and wing endplates. Clean blue and white contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Perfect side profile view, lateral view, wheel center at same height as camera, entire car visible in profile from nose to rear wing. 16:9 aspect ratio.
```

#### Prompt 3 — Rear 3/4 View

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, March CG891 livery reference. Miami Blue body (#66C5C5) with white (#FFF8F0) sidepod lower panels and wing endplates. Clean blue and white contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels, visible exhaust pipes at rear. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Rear three-quarter view, camera at wheel center height — same eye level as the side profile view, rotated approximately 45 degrees around the car to show the rear section, entire car in frame from rear-left or rear-right angle. 16:9 aspect ratio.
```

#### Prompt 4 — Front View (Head-On)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, March CG891 livery reference. Miami Blue body (#66C5C5) with white (#FFF8F0) sidepod lower panels and wing endplates. Clean blue and white contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at wheel center height, positioned directly behind the car at ground level, exhaust centered in frame, rear wing full face visible, rear wheels symmetrical. 16:9 aspect ratio.
```

#### Prompt 5 — Rear View (Direct)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, March CG891 livery reference. Miami Blue body (#66C5C5) with white (#FFF8F0) sidepod lower panels and wing endplates. Clean blue and white contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible from behind. Exposed rear wheels with visible tread pattern, twin exhaust pipes at center rear, black rear diffuser, visible rear suspension arms. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at ground level centered behind the car, rear wing centered and full face visible symmetrical, exhaust pipes centered below wing, rear wheels symmetrical on both sides, entire rear section in frame. 16:9 aspect ratio.
```

#### Prompt 6 — Cockpit POV (Driver's Eye)

```
Kosuke Fujishima and Hino Matsuri fusion style, driver's eye view from inside the cockpit of a 1989 March CG891 Formula 1 car. A small-diameter round 3-spoke suede steering wheel, noticeably smaller than typical 1989 F1 wheels, dominates the center of the frame — the March used a compact rack-and-pinion wheel designed to fit the extremely narrow monocoque engineered by Adrian Newey. The rim is thin suede with 4 silver hex bolts on the hub. Through the upper opening of the steering wheel, visible on the dark matte carbon fiber dashboard behind it, sits a minimal analog tachometer — a compact round gauge with a black face and thin white markings, kept deliberately simple and functional in Newey's minimalist style. Below the tachometer is a tight row of only essential auxiliary gauges — small circular dials for oil pressure and water temperature. No digital displays, no extraneous instruments — the March dashboard strips away everything non-essential. One small green indicator light at top-left. One small red push-button at bottom-right. A metallic spherical gear knob on a short H-pattern 6-speed lever to the right. Carbon fiber monocoque walls with Miami Blue and white livery panels. Two rectangular side mirrors with orange trim. Exceptionally narrow cockpit opening — the March monocoque was one of the slimmest on the grid, designed around the inboard gear cluster that enabled a full-width diffuser. No driver, no helmet, no hands. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

#### Prompt 7 — Cockpit POV (Helmet Cam, Slightly Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, helmet camera view from inside the cockpit of a 1989 March CG891 Formula 1 car, slightly elevated looking down and forward. The compact small-diameter round 3-spoke suede steering wheel with 4 silver hex bolts fills the lower half — noticeably smaller than a typical F1 wheel, designed specifically for the tight Newey-designed monocoque. Through the upper opening of the wheel rim, visible on the dark matte dashboard: a minimal analog tachometer with black face and white markings — a sparse, functional gauge. Below it, a tight row of small essential auxiliary gauges for oil pressure and water temperature, arranged in a neat line. The layout is stark and purposefully minimal — Adrian Newey's design philosophy of removing everything unnecessary. One green indicator light. One red push-button. Red seat bolsters. Carbon fiber floor with metallic 6-speed gear knob on the right. Transparent windscreen at top. Tire tread visible above cockpit. Miami Blue and white livery panels. No driver, empty cockpit. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

#### Prompt 8 — Cockpit Interior Reference (Empty, Diagonal Above)

```
Kosuke Fujishima and Hino Matsuri fusion style, looking down into the empty open cockpit of a 1989 March CG891 Formula 1 car from above-left diagonal angle. The compact small-diameter round 3-spoke suede steering wheel is mounted on the steering column — its reduced size is immediately apparent against the narrow carbon fiber monocoque, visibly smaller than wheels from other teams. On the dark trapezoidal carbon fiber dashboard behind the wheel: a minimal analog tachometer with black face and white markings — only the essential gauge. A sparse row of small auxiliary gauges for oil pressure and water temperature sits below. The Adrian Newey-designed dashboard is the sparsest in the 1989 field, with no digital displays and no redundant instruments — every element serves a purpose. One green indicator light at top-left. One red push-button at bottom-right. H-pattern 6-speed gear lever with metallic spherical knob on the right. Black carbon fiber seat with red bolsters. Extremely narrow cockpit walls with Miami Blue and white livery — the monocoque is visibly more compact than rival cars. Transparent windscreen. Two rectangular side mirrors with orange trim. No driver, no helmet, no hands. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

---

### Technical Notes (from Technical Artist)

- **Colliders**: Compound primitive — box (body) + sphere (wheels × 4), no mesh collider
- **Rigging**: No skeleton — wheels rotate via script, no suspension bones in MVP
- **FBX Export**: -Z Forward, Y Up, Scale 1.0, Face smoothing, Triangulate
- **UV**: Single 2048² atlas, all 16 teams share same UV layout
- **Texture Variants**: 16 teams × 2 drivers = 32 texture files (or 16 if driver numbers baked)
- **Addressables Group**: Cars/team_tier2_a
- **WebGL Note**: 2048² texture (~5.3 MB) exceeds the 3 MB per-car bundle budget — downsample to 1024² for WebGL

**Status:** Updated — 8 prompts (6 angles + 2 cockpit variations).

---

### Trellis 2 Multiview Input (4 Image Sets)

Use these 4 prompts (front, left, back, right) to generate images for Trellis 2 multiview 3D reconstruction. Generate each at 1024×1024, 1:1 aspect ratio, PNG with transparent/removed background.

#### Trellis Front — Front View (Head-On)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, March CG891 livery reference. Miami Blue body (#66C5C5) with white (#FFF8F0) sidepod lower panels and wing endplates. Clean blue and white contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct front view, camera at wheel center height, positioned directly in front of the car at ground level, nose centered in frame, front wing full face visible, front wheels symmetrical. 1:1 aspect ratio.
```

#### Trellis Left — Side Profile (Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, March CG891 livery reference. Miami Blue body (#66C5C5) with white (#FFF8F0) sidepod lower panels and wing endplates. Clean blue and white contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Left side profile view, camera elevated approximately 30 degrees above horizontal, cockpit opening visible from above, entire car visible in profile from nose to rear wing. 1:1 aspect ratio.
```

#### Trellis Back — Rear View (Direct)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, March CG891 livery reference. Miami Blue body (#66C5C5) with white (#FFF8F0) sidepod lower panels and wing endplates. Clean blue and white contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible from behind. Exposed rear wheels with visible tread pattern, twin exhaust pipes at center rear, black rear diffuser, visible rear suspension arms. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at wheel center height, positioned directly behind the car at ground level, exhaust centered in frame, rear wing full face visible, rear wheels symmetrical. 1:1 aspect ratio.
```

#### Trellis Right — Side Profile (Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, March CG891 livery reference. Miami Blue body (#66C5C5) with white (#FFF8F0) sidepod lower panels and wing endplates. Clean blue and white contrast. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Right side profile view, camera elevated approximately 30 degrees above horizontal, cockpit opening visible from above, entire car visible in profile from nose to rear wing. 1:1 aspect ratio.
```
