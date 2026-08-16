# Asset Specs — System: Car Definition Data

> **Team**: Minarae (team_tier3_a)
> **Car Reference**: Minardi M188B/M189
> **Art Bible**: design/art/art-bible.md
> **Generated**: 2026-07-28
> **Status**: 1 asset specced / 0 approved / 0 in production

---

## ASSET-001 — Car: Minarae (Minardi M188B/M189 Parody)

| Field | Value |
|-------|-------|
| Category | 3D Asset (Reference) |
| Team ID | team_tier3_a |
| Car Reference | Minardi M188B/M189 |
| Real-World Team | Minardi-Ford |
| Livery Base | Lois Yellow body with Black and White panels |
| Base Mesh | Shared (LOD0-3, 35k→1k tris) |
| Texture | 2048×2048, ASTC 6×6, PNG source |
| Material | URP Simple Lit, smoothness 0.25 |
| Background | Solid gray (#CCCCCC) |
| Driver | Not included |
| Car Numbers | Not included (add as decal post-gen) |
| View | Package of 8 angle renders |
| Reference Photo | https://f1colours.sebpatrick.co.uk/teams/minardi/ |

### Location in Project

| Asset | Path |
|-------|------|
| Base Mesh | Assets/Art/Cars/Base/Models/ |
| Texture | Assets/Art/Cars/tier3a/Textures/ |
| Material | Assets/Art/Cars/tier3a/Materials/ |
| Prefab | Assets/Art/Cars/tier3a/Prefabs/ |

### Art Bible Anchors

- §2.2 Team Identity: Primary #F5C518 (Lois Yellow), Secondary #1A1A1A (Black) / #FFF8F0 (White)
- §5.5 Era: 1989 F1 silhouette — low nose, no halo, open cockpit, exposed driver helmet area
- §8.1 Polygon Budget: LOD0 35k tris, LOD1 12.5k, LOD2 4k, LOD3 1k
- §8.3 Texture Standards: 2048², all cars equal quality, ASTC 6×6
- §8.5 Shader: URP Simple Lit, single material per car

### Livery Description

Lois Yellow (#F5C518) body covering the monocoque, nose cone, sidepods, and engine cover — approximately 60% of visible surface. Black (#1A1A1A) covering the sidepod lower panels, front wing mainplanes, rear wing mainplane, and a stripe along the engine cover sides — approximately 25%. White (#FFF8F0) covering the front wing endplates, rear wing endplates, and small accent panels on the nose cone — approximately 15%. The defining visual element is the bright Lois Yellow body with black lower panels and white wing endplates creating a high-contrast, distinctive livery. Clean, sculpted sidepod inlet shapes. Open wheels with visible double-wishbone suspension arms. No wheel covers — brake discs visible behind spokes.

Sponsor decals simulated as geometric color blocks (no text): small rectangular white panels on sidepod surfaces. No real brand logos.

---

### Generation Prompts (Copy each one separately)

#### Prompt 1 — Front 3/4 View

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Minardi M188B/M189 livery reference. Lois Yellow body (#F5C518) with black (#1A1A1A) sidepod lower panels and front wing, white (#FFF8F0) wing endplates. High-contrast yellow, black, and white livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Full car visible from front three-quarter view, approximately 45 degrees from front, slightly elevated camera angle, entire car in frame. 16:9 aspect ratio.
```

#### Prompt 2 — Side Profile

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Minardi M188B/M189 livery reference. Lois Yellow body (#F5C518) with black (#1A1A1A) sidepod lower panels and front wing, white (#FFF8F0) wing endplates. High-contrast yellow, black, and white livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Perfect side profile view, lateral view, wheel center at same height as camera, entire car visible in profile from nose to rear wing. 16:9 aspect ratio.
```

#### Prompt 3 — Rear 3/4 View

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Minardi M188B/M189 livery reference. Lois Yellow body (#F5C518) with black (#1A1A1A) sidepod lower panels and front wing, white (#FFF8F0) wing endplates. High-contrast yellow, black, and white livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels, visible exhaust pipes at rear. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Rear three-quarter view, camera at wheel center height — same eye level as the side profile view, rotated approximately 45 degrees around the car to show the rear section, entire car in frame from rear-left or rear-right angle. 16:9 aspect ratio.
```

#### Prompt 4 — Front View (Head-On)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Minardi M188B/M189 livery reference. Lois Yellow body (#F5C518) with black (#1A1A1A) sidepod lower panels and front wing, white (#FFF8F0) wing endplates. High-contrast yellow, black, and white livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at wheel center height, positioned directly behind the car at ground level, exhaust centered in frame, rear wing full face visible, rear wheels symmetrical. 16:9 aspect ratio.
```

#### Prompt 5 — Rear View (Direct)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Minardi M188B/M189 livery reference. Lois Yellow body (#F5C518) with black (#1A1A1A) sidepod lower panels and front wing, white (#FFF8F0) wing endplates. High-contrast yellow, black, and white livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible from behind. Exposed rear wheels with visible tread pattern, twin exhaust pipes at center rear, black rear diffuser, visible rear suspension arms. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at ground level centered behind the car, rear wing centered and full face visible symmetrical, exhaust pipes centered below wing, rear wheels symmetrical on both sides, entire rear section in frame. 16:9 aspect ratio.
```

#### Prompt 6 — Cockpit POV (Driver's Eye)

```
Kosuke Fujishima and Hino Matsuri fusion style, driver's eye view from inside the cockpit of a 1989 Minardi M188B/M189 Formula 1 car — the first F1 car entirely designed using CAD/CAM technology. A round 3-spoke black suede MOMO steering wheel dominates the center of the frame. The rim is thin suede with 4 silver hex bolts on the hub. Through the upper opening of the steering wheel, visible on the dark matte carbon fiber dashboard behind it, sits an early digital dashboard display — not analog gauges but a rectangular LCD module with glowing green alphanumeric characters showing RPM as a numeric readout, gear position, speed, water temperature, and oil pressure as digital values. This was a pioneering digital instrument cluster for a small backmarker team, unusual for 1989 when even top teams still used analog tachometers. The display shows bar-graph style RPM indication and numeric telemetry data. A few small warning indicator lights sit beside the digital panel. One small green indicator light at top-left. One small red push-button at bottom-right. A metallic spherical gear knob on a short H-pattern 6-speed lever to the right. Carbon fiber monocoque walls with Lois Yellow and black livery panels. Two rectangular side mirrors with orange trim. Tight cockpit opening with close-fitting monocoque walls. No driver, no helmet, no hands. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

#### Prompt 7 — Cockpit POV (Helmet Cam, Slightly Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, helmet camera view from inside the cockpit of a 1989 Minardi M188B/M189 Formula 1 car, slightly elevated looking down and forward. The round 3-spoke black suede MOMO steering wheel with 4 silver hex bolts fills the lower half — it is the dominant element. Through the upper opening of the wheel rim, visible on the dark matte dashboard: the early digital LCD display panel — a rectangular black glass module with glowing green numerals and bar-graph characters showing RPM, speed, gear position, and telemetry data. This is NOT an analog tachometer — the Minardi was one of very few 1989 F1 cars with a fully digital instrument cluster, a pioneering approach for a small team. The digital readout provides numeric RPM indication, eliminating the traditional sweeping needle. Small warning indicator lights beside the digital panel. One green indicator light. One red push-button. Red seat bolsters. Carbon fiber floor with metallic gear knob on the right. Transparent windscreen at top. Tire tread visible above cockpit. Lois Yellow and black livery panels. No driver, empty cockpit. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

#### Prompt 8 — Cockpit Interior Reference (Empty, Diagonal Above)

```
Kosuke Fujishima and Hino Matsuri fusion style, looking down into the empty open cockpit of a 1989 Minardi M188B/M189 Formula 1 car from above-left diagonal angle. The round 3-spoke black suede MOMO steering wheel is mounted on the steering column. On the dark trapezoidal carbon fiber dashboard behind the wheel: a pioneering digital LCD instrument cluster — a rectangular black glass display module with glowing green alphanumeric characters showing RPM as a numeric bar-graph, speed, gear, water temperature, and oil pressure — all digital readouts, no analog needles, no circular gauge faces. This digital dashboard was unusual for a small team in 1989 and was made possible by the car being the first F1 car fully designed using CAD/CAM. Small warning indicator lights beside the digital panel. One green indicator light at top-left. One red push-button at bottom-right. H-pattern 6-speed gear lever with metallic spherical knob on the right. Black carbon fiber seat with red bolsters. Tight cockpit walls with Lois Yellow and black livery, leaving minimal elbow room. Transparent windscreen. Two rectangular side mirrors with orange trim. No driver, no helmet, no hands. Cel-shaded painted style, Fujishima and Matsuri fusion. 16:9 aspect ratio.
```

---

### Technical Notes (from Technical Artist)

- **Colliders**: Compound primitive — box (body) + sphere (wheels × 4), no mesh collider
- **Rigging**: No skeleton — wheels rotate via script, no suspension bones in MVP
- **FBX Export**: -Z Forward, Y Up, Scale 1.0, Face smoothing, Triangulate
- **UV**: Single 2048² atlas, all 16 teams share same UV layout
- **Texture Variants**: 16 teams × 2 drivers = 32 texture files (or 16 if driver numbers baked)
- **Addressables Group**: Cars/team_tier3_a
- **WebGL Note**: 2048² texture (~5.3 MB) exceeds the 3 MB per-car bundle budget — downsample to 1024² for WebGL

**Status:** Updated — 8 prompts (6 angles + 2 cockpit variations).

---

### Trellis 2 Multiview Input (4 Image Sets)

Use these 4 prompts (front, left, back, right) to generate images for Trellis 2 multiview 3D reconstruction. Generate each at 1024×1024, 1:1 aspect ratio, PNG with transparent/removed background.

#### Trellis Front — Front View (Head-On)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Minardi M188B/M189 livery reference. Lois Yellow body (#F5C518) with black (#1A1A1A) sidepod lower panels and front wing, white (#FFF8F0) wing endplates. High-contrast yellow, black, and white livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct front view, camera at wheel center height, positioned directly in front of the car at ground level, nose centered in frame, front wing full face visible, front wheels symmetrical. 1:1 aspect ratio.
```

#### Trellis Left — Side Profile (Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Minardi M188B/M189 livery reference. Lois Yellow body (#F5C518) with black (#1A1A1A) sidepod lower panels and front wing, white (#FFF8F0) wing endplates. High-contrast yellow, black, and white livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Left side profile view, camera elevated approximately 30 degrees above horizontal, cockpit opening visible from above, entire car visible in profile from nose to rear wing. 1:1 aspect ratio.
```

#### Trellis Back — Rear View (Direct)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Minardi M188B/M189 livery reference. Lois Yellow body (#F5C518) with black (#1A1A1A) sidepod lower panels and front wing, white (#FFF8F0) wing endplates. High-contrast yellow, black, and white livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible from behind. Exposed rear wheels with visible tread pattern, twin exhaust pipes at center rear, black rear diffuser, visible rear suspension arms. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Direct rear view, camera at wheel center height, positioned directly behind the car at ground level, exhaust centered in frame, rear wing full face visible, rear wheels symmetrical. 1:1 aspect ratio.
```

#### Trellis Right — Side Profile (Elevated)

```
Kosuke Fujishima and Hino Matsuri fusion style, 1989 formula 1 car, Minardi M188B/M189 livery reference. Lois Yellow body (#F5C518) with black (#1A1A1A) sidepod lower panels and front wing, white (#FFF8F0) wing endplates. High-contrast yellow, black, and white livery. Racing sponsor decals as geometric shapes on sidepods — rectangular white panels simulating text placement. No real brand logos, no text. Minimalist livery reference, clean painted texture. Solid gray background (#CCCCCC), no driver, no driver helmet visible, no car numbers. Empty cockpit visible. Low nose, open cockpit, visible suspension arms, exposed wheels. Cel-shaded, painted textures, no photo-realism, no normal maps, no shadows on background. Right side profile view, camera elevated approximately 30 degrees above horizontal, cockpit opening visible from above, entire car visible in profile from nose to rear wing. 1:1 aspect ratio.
```
