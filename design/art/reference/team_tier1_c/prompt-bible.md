# Prompt Bible — Team Tier 1 C

> **Asset:** Millions team — provisional 1989 FW13-derived Formula 1 car
> **Team ID:** `team_tier1_c`
> **Reference packet:** `design/art/reference/team_tier1_c/`
> **Art Bible:** `design/art/art-bible.md`
> **Status:** Ready for controlled generation testing
> **Generated:** 2026-08-12

## 1. Purpose

This prompt bible defines the controlled image-generation package for the Team Tier 1 C exterior. The active generation basis is now the **1989 FW13**, selected because its visual prior produced a more accurate air-intake structure. The current reference packet still contains FW12C photographs and is therefore temporary; those references will be replaced or supplemented with real FW13 photographs before finalizing the production prompts. Mixed FW12C/FW13 descriptions remain excluded so every generated view describes one coherent vehicle.

The prompts are written for independent visual testing. They establish the exterior silhouette, camera position, livery placement, and simplified cockpit opening. They do not guarantee pixel-level identity between independent generations; the approved lateral image becomes the identity source for the later square-prep and four-panel workflows.

## 2. Reference Evidence

### Primary exterior references

| File | Evidence use |
|---|---|
| `side-right.jpg` | Primary lateral proportion, cockpit opening, sidepod, wheel placement, nose, engine cover, rear wing, and livery layout. |
| `744631.jpg` | Lateral exterior confirmation; useful for body height, sidepod volume, and wheel relationship. |
| `front.jpg` | Front width, nose, front wing, front wheels, and front suspension. |
| `rear.jpg` | Rear width, rear wing, rear tires, diffuser area, and rear suspension. |
| `front-left.webp` | Front-left volume, nose-to-sidepod transition, cockpit height, and front wing depth. |
| `front-right.jpg` | Front-right volume and upper-surface confirmation. |
| `rear-left.jpg` | Rear volume, engine cover, rear wing, rear tires, and diffuser relationship. |
| `front-right 2.jpg` | Additional front three-quarter evidence. |
| `front-right 3.jpg` | Additional front-right volume evidence. |

### Cockpit references

| File | Evidence use |
|---|---|
| `cockpit-2.jpg` | General racing-seat, harness, carbon-fiber, and interior-structure reference. |
| `cockpit1.jpg` | Period instrument-area reference only; do not reproduce its exact historical layout. |

### Reference limitations

- The source images are historical photographs rather than orthographic drawings.
- Several images show restored or display-car configurations.
- Historical sponsor graphics and numbers are evidence only and are not part of the generated asset.
- The upper surface is partially inferred from elevated three-quarter views.
- The underside is out of scope.

## 3. Production Rules

### 3.1 Exterior geometry

- The exterior geometry is bilaterally symmetric.
- Model one side and create the opposite side by deterministic horizontal mirroring after selecting the best lateral candidate.
- Do not reproduce historical left/right asymmetries as geometry.
- Front and rear wings, sidepods, cockpit surround, suspension, wheels, and air intakes are symmetric.
- Prompt A and Prompt B are independent lateral candidates for visual comparison only; neither is treated as a literal mirror by the image model.

### 3.2 Visual markings

- Car numbers, sponsor-like blocks, and team markings are added later as decals or material details.
- Generation prompts use plain painted surfaces and simple livery boundaries.
- Readable words, logos, brand names, historical numbers, and sponsor graphics are not part of the generated exterior.

### 3.3 Shared cockpit interior

The visible cockpit opening and external surround belong to this car. The internal functional cockpit is a shared production asset used by every car:

- one simplified driver;
- one shared seat;
- one shared simplified dashboard;
- one shared steering wheel;
- one shared pedal block;
- one shared harness solution;
- one shared animation rig.

Exterior prompts describe only a simple open cockpit and clean surround. The detailed interior is generated separately and must not determine the exterior silhouette.

### 3.4 Livery and color targets

The prompt text deliberately avoids branded color names. Use direct visual descriptions with approximate sampled RGB targets:

- rich medium racing blue painted body, target approximately RGB (20, 65, 105);
- clear bright primary yellow painted surfaces, target approximately RGB (250, 215, 5);
- warm neutral white painted panels, target approximately RGB (245, 242, 225);
- matte carbon-black functional parts, target approximately RGB (26, 26, 26).

The rich medium racing blue covers the monocoque, nose center, middle body band, and lower engine-cover sides. The clear bright primary yellow covers the upper nose transition, cockpit surround, and the continuous engine cover that rises to its designed top behind the driver; it must read as clean primary yellow rather than orange, ochre, or tan. The engine cover is a narrow, coherent body form with a smooth tapered upper silhouette. A small black roll-hoop or air-intake opening is an inset detail within the yellow upper structure; it does not replace the yellow cover and does not create a separate oversized dome. Warm neutral white appears on selected lower sidepod panels and complete front and rear wing surfaces; it must read as painted white rather than gray, green, or mint. Matte carbon-black is used for tires, suspension, functional wing supports, and cockpit interior.

These values are targets for generation guidance, not a guarantee of exact pixel values. Final material colors are normalized later in the texture/material stage.

### 3.5 Style and presentation

- Overdrive visual identity: hand-crafted 1990s Japanese racing anime translated into a clean game asset.
- Use cel-shaded painted clarity and confident mechanical linework.
- Use a neutral light-gray studio background.
- Keep the complete vehicle inside the frame with generous margin.
- Keep camera height and scale consistent within each view family.
- External ground shadows are removed later with deterministic BiRefNet preprocessing.

## 4. Locked ComfyUI Baseline

Use these parameters for controlled comparisons unless a later experiment explicitly changes one variable:

| Parameter | Value |
|---|---|
| Diffusion model | `krea2_turbo_int8_convrot.safetensors` |
| Text encoder | `qwen3vl_4b_fp8_scaled.safetensors` |
| VAE | `qwen_image_vae.safetensors` |
| Style LoRA | `hina_Krea2Turbo_animeEnhance_v1.0.safetensors` |
| LoRA strength | `0.85` |
| Resolution | `1280×720` for presentation and design validation |
| Steps | `8` |
| CFG | `1.0` |
| Sampler | `euler` |
| Scheduler | `simple` |
| Denoise | `1.0` |
| Enhancer | Off |
| Seed | Use a new recorded seed per candidate; check cache behavior before claiming independent outputs |

The text `anime style` must remain at the beginning of every prompt when the animeEnhance LoRA is enabled.

### v2 color audit

The 16-image v2 comparison (8 side candidates and 8 front candidates) showed a consistent palette shift rather than random seed variation. The generated blue was too saturated and electrically bright, the generated yellow was too orange, and the generated white often shifted toward cold gray or mint. The revised prompts therefore use a darker, more restrained racing blue target RGB (20, 65, 105), clear primary yellow target RGB (250, 215, 5), and warm neutral white target RGB (245, 242, 225). These remain visual guidance rather than exact material values. The tested v2 images used LoRA strength 0.95, while the locked bible baseline remains 0.85; this parameter difference must be recorded in future comparisons. The engine-cover correction is geometric: preserve the full yellow upper cover to its designed height, but describe it as narrow, coherent, and smoothly tapered, with only a small black inset roll-hoop or air-intake detail.

## 5. Prompt Delivery Rules

- Copy one prompt at a time as one physical line.
- Use a single detailed natural-language positive prompt.
- The Krea2 Turbo negative branch remains connected to `ConditioningZeroOut`; it is not an editable negative-text prompt.
- Keep the prompt enhancer disabled when exact prompt comparisons matter.
- Prioritize subject, camera, composition, geometry, palette, and style in that order.
- Record the seed, output filename, and whether the output was a cache replay.

## 6. Shared Prompt Block

This information is repeated intentionally so each base prompt can be copied independently. The livery is a fixed three-band exterior scheme, not a free color distribution: yellow on the upper body, blue through the middle body band, and warm neutral white on the lower body and complete wing surfaces. The yellow engine cover continues to the designed top behind the driver; the black roll-hoop or air-intake opening is only a small inset detail in that yellow structure. The wording uses visual descriptions instead of team, sponsor, model, or branded color names.

`anime style, Overdrive 1990s Japanese racing anime game asset, 1989 FW13-derived open-wheel Formula 1 car, compact low open-wheel silhouette, rich medium racing blue middle body band target RGB 20 65 105, clear bright primary yellow upper body and engine-cover surfaces target RGB 250 215 5, warm neutral white lower body panels and front/rear wing surfaces target RGB 245 242 225, matte carbon-black tires suspension cockpit opening and structural supports target RGB 26 26 26, fixed three-band livery with yellow above blue above warm neutral white, plain uninterrupted painted surfaces, simple clean color boundaries, bilaterally symmetric exterior geometry, continuous narrow yellow engine cover rising to its designed top behind the driver, with one small narrow black roll-hoop or air-intake opening inset into the yellow upper structure, a thin central structural detail with a simple rounded profile, no oversized separate yellow tower or broad bubble, cel-shaded painted clarity, confident mechanical linework, neutral light-gray studio background, complete car centered with generous margin`

## 7. Base Exterior Generation Prompts

Only two prompts are used as the base production poses:

- **Prompt A — master lateral reference:** establishes length, wheelbase, cockpit position, sidepod profile, rear suspension, wing placement, and the complete three-band livery.
- **Prompt B — master front reference:** establishes front width, nose width, front-wing span, front suspension, wing colors, and the front-facing livery bands.

Generate several candidates for Prompt A first. Select the best lateral candidate, then generate Prompt B and select the front candidate that is compatible with it. The pair must be approved together before four-panel generation. The right side is produced by deterministic mirroring; it is not a separate base prompt.

### Prompt A — Master lateral reference

Generate multiple seeds and keep the best single left-side candidate. Match the supplied historical side reference's external shape and livery placement. The side view must show an open cockpit and a continuous, narrow yellow engine cover rising to its designed top behind the driver and tapering smoothly toward the rear wing. The black roll-hoop or air-intake opening is a small inset detail within that yellow structure, not a separate body volume.

```text
anime style, Overdrive 1990s Japanese racing anime game asset, 1989 FW13-derived open-wheel Formula 1 car, compact low open-wheel silhouette, low narrow nose, open cockpit, exposed slick tires, rich medium racing blue middle body band target RGB 20 65 105, clear bright primary yellow upper body and engine-cover surfaces target RGB 250 215 5, warm neutral white lower body panels target RGB 245 242 225, warm neutral white front wing and rear wing planes and endplates target RGB 245 242 225, matte carbon-black tires and structural parts target RGB 26 26 26, fixed three-band livery running continuously from nose to rear: yellow upper band above blue middle band above warm neutral white lower band, clean horizontal blue-to-white boundary along the lower sidepod, yellow cockpit surround and upper engine cover, continuous narrow yellow engine cover rising to its designed top behind the driver's head with a smooth tapered silhouette, and a small black roll-hoop or air-intake opening inset into the yellow upper structure, no oversized separate yellow dome or broad bubble, clearly visible simple two-link rear suspension at the near-side rear wheel: one thin straight upper black control link and one thin straight lower black control link, both nearly horizontal and parallel, each with one clean attachment at the wheel hub and one clean attachment at the rear body, isolated links with open space between them, white rear wing, strict flat left side elevation at wheel-hub height, camera exactly beside the car, horizon aligned with wheel hubs, nose pointing left, only the near-side wheels visibly exposed, upper surfaces nearly edge-on, bilaterally symmetric exterior geometry, plain unmarked painted surfaces, neutral light-gray studio background, one complete car centered with generous margin, 16:9 composition
```

### Prompt B — Master front reference

Generate this after selecting Prompt A. Match the selected lateral candidate's nose, wheel size, cockpit position, body proportions, and three-band livery. In the front view, the upper central body behind the nose must remain yellow, the middle nose must remain blue, and the lower/front-wing region must remain warm neutral white.

```text
anime style, Overdrive 1990s Japanese racing anime game asset, the same 1989 FW13-derived open-wheel Formula 1 car as the approved lateral reference, direct front elevation, low narrow rich medium racing blue middle nose and center body target RGB 20 65 105, clear bright primary yellow upper nose transition and cockpit surround visible above the blue center target RGB 250 215 5, continuous clear yellow engine cover rising to its designed top behind the driver, with the small black roll-hoop or air-intake opening inset into the yellow structure, warm neutral white lower front body, sidepod faces, front wing planes, and front wing endplates target RGB 245 242 225, fixed front-facing three-band livery reading from top to bottom as yellow upper body, blue middle nose, warm neutral white lower wing and body, wide layered warm neutral white front wing with dark structural supports, exposed front slick tires, simple symmetric double-wishbone suspension with clean straight links, small black roll-hoop or air-intake opening inset into the continuous yellow upper structure, with no oversized separate yellow dome or broad bubble, all visible wing surfaces are warm neutral white rather than blue, equal left and right geometry, bilaterally symmetric exterior geometry, plain unmarked painted surfaces, neutral light-gray studio background, one complete car centered with generous margin, camera centered on the longitudinal axis at front-wheel-hub height, nose centered, front wing horizontal, 1:1 composition
```

### V5 experimental variant — FW13 historical prior test

This is a controlled experiment only. It does not replace the approved FW12C baseline above. The only historical change is FW12C → FW13; camera, livery, suspension, air-intake geometry, and generation parameters remain otherwise equivalent. Use these two prompts for the V5 side/front comparison. If the air-intake changes materially, the historical model prior is contributing to the defect; if it does not, the defect is caused by Krea2's generic open-wheel interpretation.

#### V5-A — FW13 master lateral reference

```text
anime style, Overdrive 1990s Japanese racing anime game asset, 1989 FW13-derived open-wheel Formula 1 car, compact low open-wheel silhouette, low narrow nose, open cockpit, exposed slick tires, rich medium racing blue middle body band target RGB 20 65 105, clear bright primary yellow upper body and continuous engine-cover surfaces target RGB 250 215 5, warm neutral white lower body panels and complete front and rear wing surfaces target RGB 245 242 225, matte carbon-black tires suspension and structural parts target RGB 26 26 26, fixed three-band livery running continuously from nose to rear with yellow upper band above blue middle band above warm neutral white lower band, narrow coherent yellow engine cover rising to its designed top behind the driver and tapering smoothly toward the rear wing, one small narrow black roll-hoop or air-intake opening inset into the yellow engine cover, the black opening is a thin central structural detail and does not form a separate yellow tower, simple rear suspension with straight dark links only, strict flat left side elevation at wheel-hub height, camera exactly beside the car, horizon aligned with wheel hubs, nose pointing left, only the near-side wheels visibly exposed, upper surfaces nearly edge-on, bilaterally symmetric exterior geometry, plain unmarked painted surfaces, neutral light-gray studio background, one complete car centered with generous margin, 16:9 composition
```

#### V5-B — FW13 master front reference

```text
anime style, Overdrive 1990s Japanese racing anime game asset, the same 1989 FW13-derived open-wheel Formula 1 car as the approved V5 lateral reference, direct front elevation, low narrow rich medium racing blue middle nose and center body target RGB 20 65 105, clear bright primary yellow upper nose transition and cockpit surround target RGB 250 215 5, continuous narrow yellow engine cover visible behind the nose and rising to its designed top, one small narrow black roll-hoop or air-intake opening centered within the yellow upper structure, the black opening is a thin central structural detail with a simple rounded profile, the yellow body remains a narrow tapered surround and does not become a broad square tower, warm neutral white lower body, sidepod faces, complete front wing planes, and front wing endplates target RGB 245 242 225, fixed front-facing three-band livery reading from top to bottom as yellow upper body, blue middle nose, warm neutral white lower wing and body, exposed front slick tires, simple symmetric double-wishbone front suspension with clean straight links, equal left and right geometry, bilaterally symmetric exterior geometry, plain unmarked painted surfaces, neutral light-gray studio background, one complete car centered with generous margin, camera centered on the longitudinal axis at front-wheel-hub height, nose centered, front wing horizontal, 1:1 composition
```

### V6 controlled variant — FW13 rear-suspension prompt test

V6 keeps the successful V5 FW13 air-intake wording and changes only the rear-suspension description. The purpose is to test whether more explicit positive geometry improves the side view. Use V6-A for the lateral candidate and V6-B for the matched front candidate. The FW12C photographs in the current folder remain temporary evidence until real FW13 photographs are added.

#### V6-A — FW13 lateral with explicit two-link rear suspension

```text
anime style, Overdrive 1990s Japanese racing anime game asset, 1989 FW13-derived open-wheel Formula 1 car, compact low open-wheel silhouette, low narrow nose, open cockpit, exposed slick tires, rich medium racing blue middle body band target RGB 20 65 105, clear bright primary yellow upper body and continuous engine-cover surfaces target RGB 250 215 5, warm neutral white lower body panels and complete front and rear wing surfaces target RGB 245 242 225, matte carbon-black tires suspension and structural parts target RGB 26 26 26, fixed three-band livery running continuously from nose to rear with yellow upper band above blue middle band above warm neutral white lower band, narrow coherent yellow engine cover rising to its designed top behind the driver and tapering smoothly toward the rear wing, one small narrow black roll-hoop or air-intake opening inset into the yellow engine cover, the black opening is a thin central structural detail and does not form a separate yellow tower, clearly visible simple two-link rear suspension at the near-side rear wheel: one thin straight upper black control link and one thin straight lower black control link, both nearly horizontal and parallel, each with one clean attachment at the wheel hub and one clean attachment at the rear body, isolated links with open space between them, strict flat left side elevation at wheel-hub height, camera exactly beside the car, horizon aligned with wheel hubs, nose pointing left, only the near-side wheels visibly exposed, upper surfaces nearly edge-on, bilaterally symmetric exterior geometry, plain unmarked painted surfaces, neutral light-gray studio background, one complete car centered with generous margin, 16:9 composition
```

#### V6-B — FW13 matched front reference

```text
anime style, Overdrive 1990s Japanese racing anime game asset, the same 1989 FW13-derived open-wheel Formula 1 car as the approved V6 lateral reference, direct front elevation, low narrow rich medium racing blue middle nose and center body target RGB 20 65 105, clear bright primary yellow upper nose transition and cockpit surround target RGB 250 215 5, continuous narrow yellow engine cover visible behind the nose and rising to its designed top, one small narrow black roll-hoop or air-intake opening centered within the yellow upper structure, the black opening is a thin central structural detail with a simple rounded profile, the yellow body remains a narrow tapered surround and does not become a broad square tower, warm neutral white lower body, sidepod faces, complete front wing planes, and front wing endplates target RGB 245 242 225, fixed front-facing three-band livery reading from top to bottom as yellow upper body, blue middle nose, warm neutral white lower wing and body, exposed front slick tires, simple symmetric double-wishbone front suspension with clean straight links, equal left and right geometry, bilaterally symmetric exterior geometry, plain unmarked painted surfaces, neutral light-gray studio background, one complete car centered with generous margin, camera centered on the longitudinal axis at front-wheel-hub height, nose centered, front wing horizontal, 1:1 composition
```

### Auxiliary views

The following views are optional evidence only. They are not additional base identities and must follow the approved A+B geometry and livery.

#### Auxiliary View 1 — Direct rear

```text
anime style, the same open-wheel Formula 1 car as the approved A+B base pair, direct rear elevation, broad exposed rear slick tires, rich medium racing blue middle body band target RGB 20 65 105, clear bright primary yellow upper engine-cover and cockpit-surround surfaces target RGB 250 215 5, warm neutral white lower rear body and complete rear wing planes and endplates target RGB 245 242 225, matte carbon-black diffuser tires and structural supports target RGB 26 26 26, fixed yellow-above-blue-above-warm-neutral-white livery, one small centered functional red rear rain light, simple symmetric rear suspension with clean straight links, no extra rods or branches, small black roll-hoop or air-intake opening inset into the continuous yellow upper structure, with no oversized separate yellow dome or broad bubble, camera centered at rear-wheel-hub height, rear wing horizontal, equal left and right geometry, plain unmarked painted surfaces, neutral light-gray studio background, one complete car centered with generous margin, 1:1 composition
```

#### Auxiliary View 2 — Orthographic top

```text
anime style, the same open-wheel Formula 1 car as the approved A+B base pair, one complete car in a strict top elevation, narrow nose, front wing, front tires, tapered sidepods, cockpit opening, continuous yellow engine cover rising to its designed top behind the driver, small black roll-hoop or air-intake opening inset into that structure, rear tires, and rear wing, clear bright primary yellow upper center and engine-cover surfaces target RGB 250 215 5, rich medium racing blue middle center band target RGB 20 65 105, warm neutral white lower sidepod and wing surfaces target RGB 245 242 225, fixed continuous yellow-above-blue-above-warm-neutral-white livery, bilaterally symmetric geometry, one car centered with generous margin, camera directly above the longitudinal axis, equal left and right geometry, plain unmarked painted surfaces, neutral light-gray studio background, 1:1 composition
```

#### Auxiliary View 3 — Front-left three-quarter

```text
anime style, the same open-wheel Formula 1 car as the approved A+B base pair, front-left three-quarter view, preserve the approved wheelbase nose cockpit and sidepod proportions, clear bright primary yellow upper body and engine-cover surfaces target RGB 250 215 5, rich medium racing blue middle body band target RGB 20 65 105, warm neutral white lower body and front wing surfaces target RGB 245 242 225, continuous yellow engine cover rising to its designed top behind the driver, with a small black roll-hoop or air-intake opening inset into the yellow structure and no oversized separate dome, clean visible front suspension, plain unmarked painted surfaces, bilaterally symmetric exterior geometry, neutral light-gray studio background, one complete car centered with generous margin, 16:9 composition
```

#### Auxiliary View 4 — Rear-left three-quarter

```text
anime style, the same open-wheel Formula 1 car as the approved A+B base pair, rear-left three-quarter view, preserve the approved wheelbase rear suspension cockpit and rear-wing proportions, clear bright primary yellow upper engine-cover surface target RGB 250 215 5, rich medium racing blue middle body band target RGB 20 65 105, warm neutral white lower rear body and rear wing surfaces target RGB 245 242 225, continuous yellow engine cover rising to its designed top behind the driver, with a small black roll-hoop or air-intake opening inset into the yellow structure and no oversized separate dome, one small centered functional red rear rain light, clean straight rear suspension links without branches, plain unmarked painted surfaces, bilaterally symmetric exterior geometry, neutral light-gray studio background, one complete car centered with generous margin, 16:9 composition
```

## 8. Shared Cockpit Interior Prompt

This prompt is for the separate reusable cockpit asset, not for exterior generation. It intentionally avoids historical instrument brands and exact period layouts.

```text
anime style, Overdrive 1990s Japanese racing anime game asset, simplified shared interior module for an early 1990s open-wheel Formula 1 cockpit, reusable across multiple symmetric race cars, black carbon-fiber monocoque tub, simple dark racing seat, compact three-spoke black steering wheel, simplified rectangular dashboard with a few clear generic instrument shapes, simple pedal block, visible harness straps, one reusable stylized racing driver in a neutral driving pose, clean low-poly-friendly forms, cel-shaded painted clarity, neutral light-gray studio background, isolated cockpit module centered with generous margin, front three-quarter camera slightly above the cockpit opening, complete module visible, consistent pivot and mounting points, 16:9 composition
```

## 9. Optional Detail Prompts

Use these only if the exterior views leave a real modeling ambiguity. They remain generic and contain no brand or sponsor triggers.

### Prompt H — Sidepod and cockpit surround

```text
anime style, clean technical reference render of the same 1989 FW13-derived open-wheel Formula 1 car, close-up of the left sidepod, cockpit surround, engine-cover transition, and front of the rear wheel, low cockpit side, narrow upper body, tapered sidepod inlet, rich medium racing blue painted body target RGB 20 65 105, clear bright primary yellow upper engine-cover surface target RGB 250 215 5, warm neutral white sidepod panel target RGB 245 242 225, matte carbon-black inlet and suspension target RGB 26 26 26, plain uninterrupted painted surfaces, controlled front-left elevated camera, complete sidepod region connected to the nose and rear body, bilaterally symmetric exterior design, cel-shaded mechanical illustration, 4:3 composition
```

### Prompt I — Front wing and suspension

```text
anime style, clean technical reference render of the same 1989 FW13-derived open-wheel Formula 1 car, close-up of the complete front wing, nose tip, front slick tires, and double-wishbone suspension, symmetric matte carbon-black wing planes target RGB 26 26 26, simple endplates, low nose, rich medium racing blue painted nose target RGB 20 65 105, clear bright primary yellow accent target RGB 250 215 5, warm neutral white painted endplate surfaces target RGB 245 242 225, plain uninterrupted painted surfaces, centered front-left elevated camera, complete wing-to-nose and suspension connection visible, bilaterally symmetric exterior design, cel-shaded mechanical illustration, 4:3 composition
```

### Prompt J — Rear wing and rear suspension

```text
anime style, clean technical reference render of the same 1989 FW13-derived open-wheel Formula 1 car, close-up of the rear wing, rear slick tires, engine-cover tail, diffuser, and rear suspension, symmetric rear wing planes and endplates, rich medium racing blue painted engine-cover center target RGB 20 65 105, clear bright primary yellow upper accent target RGB 250 215 5, warm neutral white painted wing surfaces target RGB 245 242 225, matte carbon-black functional parts target RGB 26 26 26, one small centered functional red rear rain light, plain uninterrupted painted surfaces, centered rear-left elevated camera, complete rear-wing supports and diffuser relationship visible, bilaterally symmetric exterior design, cel-shaded mechanical illustration, 4:3 composition
```

## 10. Production Selection Flow

1. Generate Prompt A with multiple recorded seeds.
2. Select the best lateral candidate based on silhouette, wheelbase, cockpit position, rear suspension, wing placement, and the fixed yellow-above-blue-above-warm-neutral-white livery.
3. Generate Prompt B only after selecting Prompt A.
4. Select the front candidate compatible with Prompt A: same wheel size, nose character, front-wing scale and white color, cockpit opening, body width, suspension layout, and livery bands.
5. Treat the approved Prompt A + Prompt B pair as the only master reference package for four-panel generation.
6. Produce the right-side view by deterministic bilateral mirroring of the approved lateral geometry; do not generate a separate right-side base identity.
7. Generate auxiliary Prompts C–F only when a specific geometry question remains. They must preserve the approved A+B identity and livery.
8. Feed the approved lateral and front images as separate reference inputs to the four-panel workflows; do not combine them into one collage.
9. Generate the shared cockpit interior only after the A+B exterior pair is approved.

## 11. Four-View Reconstruction Set

The approved master side and front images are supplied as separate reference inputs to the four-panel workflows. They must not be merged into a single collage before conditioning. The primary Trellis2 package uses direct orthographic views:

| Trellis2 input | Orthographic four-panel position | Required view |
|---|---|---|
| `front` | top-left | Direct front orthographic elevation, centered and symmetric |
| `back` | top-right | Direct rear orthographic elevation, centered and symmetric |
| `left` | bottom-left | Direct left orthographic side elevation at wheel-hub height, nose pointing left |
| `right` | bottom-right | Direct right orthographic side elevation at wheel-hub height, nose pointing right |

A separate auxiliary four-panel workflow may use front-left, front-right, rear-left, and rear-right three-quarter views. Those views are for volume validation and Blender cleanup, not replacements for the direct orthographic Trellis2 package.

Before reconstruction:

1. Confirm all four panels show the same vehicle identity and livery boundaries.
2. Confirm the sheet contains exactly four cells in a 2×2 arrangement with the workflow's documented view order.
3. For the primary package, confirm that front, rear, and side views have orthographic-looking projection: parallel body lines, equal wheel scale across the relevant view, and no visible convergence.
4. Reject outputs with changed wheelbase, extra wings, extra appendages, duplicate views, an unintended third row, or major color drift.
5. Remove external background and ground shadows after splitting with the BiRefNet workflow.
6. Resize the four isolated views to the Trellis2 input resolution.
7. Keep the cockpit interior simplified and do not use a cockpit close-up as a Trellis2 view.

## 12. Approval Criteria

A candidate passes only when all applicable criteria are true:

- The car reads as one coherent 1989 FW13-derived design.
- The wheelbase, nose length, cockpit position, sidepod volume, and rear-wing position are coherent.
- The exterior geometry is bilaterally symmetric.
- The four target painted surfaces remain visually distinct: rich medium racing blue, clear bright primary yellow, warm neutral white, and matte carbon black.
- The front nose contains only the intended painted surfaces and no accidental decorative marks.
- The only accepted red exterior detail is the small centered rear rain light.
- Painted surfaces remain plain and unmarked, without readable words, logos, or generated car numbers.
- No extra wing, fin, appendage, wheel, or suspension branch appears.
- The cockpit opening remains an external characteristic while the interior remains simple and reusable.
- The entire car is visible and not cut off by the frame.
- The output is suitable for deterministic background isolation without losing body pixels.

## 13. Controlled Test Order

1. Generate Prompt A with at least eight recorded seeds.
2. Compare all Prompt A outputs against `side-right.jpg`, prioritizing rear suspension, white rear wing, fixed yellow-above-blue-above-warm-neutral-white livery, and the black roll-hoop/air-intake silhouette.
3. Select the best lateral candidate and record the source filename and seed.
4. Generate Prompt B with at least eight recorded seeds after selecting Prompt A.
5. Compare all Prompt B outputs against `front.jpg`, prioritizing warm neutral white front-wing planes, yellow upper body, blue middle nose, and warm neutral white lower region.
6. Select the compatible front candidate and approve the A+B pair.
7. Do not proceed to four-panel generation if either base pose has a wrong wing color, broken three-band livery, raised yellow airbox, or incorrect suspension.
8. Generate auxiliary Prompts C–F only when a specific geometry question remains.
9. Do not change sampler, CFG, steps, LoRA strength, and prompt wording in the same comparison round.
