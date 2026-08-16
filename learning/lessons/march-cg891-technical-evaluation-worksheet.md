# March CG891 — Technical Evaluation Worksheet

**Source asset:** `D:\projects\assets\1989\march cg891\source\f1_1989_march_cg891_f.fbx`

**Purpose:** record evidence while evaluating one imported car. This worksheet is intentionally practical: each row must be backed by an observation, measurement, or reproducible Blender/Unity check.

**Current phase:** Criteria 1–7 audited; March approved as the first technical test candidate, pending license verification.

---

## Status vocabulary

| Status | Meaning |
|---|---|
| `PASS` | The criterion is verified and does not block the next step. |
| `WARNING` | The asset imported, but preparation or conversion is required. Continue only with the limitation recorded. |
| `BLOCKER` | The current source cannot proceed through the planned pipeline without a different source, converter, or major reconstruction. |
| `PENDING` | Not inspected yet. Do not infer a result. |

---

## Live evaluation table

| # | Criterion | Evidence from the current March import | Status | Impact on Overdrive | Action / decision |
|---:|---|---|---|---|---|
| 1 | Source format and import route | Source is FBX. Blender accepted it. The scene contains 117 objects, including 90 mesh objects and 25 empties. The main body objects `march` and `march-1` exist. Thirty-five image datablocks were found; the external DDS/BMP files are present in the source folder. Body materials connect texture Alpha to Principled Alpha, and several body textures have fully transparent Alpha. | `WARNING` | Geometry survived, but the original game shader/material behavior did not. The body is present; it is visually transparent in Material Preview/Rendered. | Preserve the imported scene as a `.blend` checkpoint. Adapt materials in a later step. Do not delete geometry or textures. |
| 2 | Hierarchy and useful part separation | The model is stored in one Blender `Collection`. It contains body meshes, wings, wheels, suspension, cockpit details, 25 empties, camera, and light. Wheel parts are grouped under empties such as `WHEEL_LF`; suspension parts use empties such as `SUSP_LF`. There is no single car-root object. | `WARNING` | The source is well separated for editing and animation, but it is not yet organized as a reusable Unity prefab. | Keep the source hierarchy. Create a dedicated car root later, after the import/material audit. |
| 3 | Scene scale and object transforms | Blender scene units are Metric, meters, `scale_length = 1.0`. Imported model objects have object scale `0.01`. The main body is approximately `0.0395 m` long in its evaluated Blender dimensions, while its mesh data is approximately 100× larger before object scale. | `WARNING` | The import applied a 0.01 object scale. This is a pipeline conversion issue, not evidence that the model was authored as a tiny car. Scaling must be normalized before Unity export. | Do not apply or change scale yet. Record the issue, then normalize the complete car as one unit after a root object exists. |
| 4 | Triangle count and mesh cost | Current imported scene: 28,052 evaluated triangles, 21,956 vertices, 90 mesh objects. The largest mesh is `march` at 2,110 triangles. | `PASS` for a source candidate | This is not excessive for a first game-car candidate. The number of objects is high, but the total mesh is modest. It is much easier to simplify or merge than a high-density sculpt. | Keep the detailed source. Later create a runtime organization and LODs; do not reduce geometry before materials and scale are stable. |
| 5 | UV maps | Every inspected mesh exposes `UVChannel_1` through `UVChannel_4`. `UVChannel_1` is the active livery channel. UV islands are visible, left/right body regions are separated, distortion is low, and the selected sidepod measures approximately `0.17670 × 0.35700` UV units (`362 × 731 px` at 2048×2048). The engine-cover side measures approximately `0.12055 × 0.28916` (`247 × 592 px`). `Select Overlap` found small candidates concentrated in simple/seam-like areas; no large sponsor panel was implicated. | `PASS` for livery space; `WARNING` for intentional overlap review | Main livery surfaces have usable texture resolution. Uniform/seamless areas may share UVs, but future numbers, logos, damage, or directional markings must not rely on overlapped regions. `UVChannel_2` still requires a separate lightmap-overlap check. | Preserve the source UVs. Record the overlap exception. Do not repack or edit UVs during the import checkpoint. Inspect `UVChannel_2` separately before baked-lighting decisions. |
| 6 | Materials and textures | The repaired scene contains 42 materials and 33 textures with no missing texture references. The Assetto Corsa Alpha-mask connections that hid opaque body, carbon floor, cockpit, dashboard, and steering geometry were removed where appropriate. The exterior and internal cockpit are now visible, including buttons, gear lever, dashboard, and steering wheel. | `PASS` with conversion note | The source material data is discoverable and replaceable. Unity/URP material conversion and later material consolidation remain preparation work. | Preserve RGB → Base Color and normal-map routes. Keep Alpha only where it represents genuine glass, glow, LED, blur, or cutout behavior. Do not remove Alpha blindly. |
| 7 | Animation and rigging data | No armature, Actions, or Shape Keys exist. Four wheel groups (`WHEEL_LF`, `WHEEL_RF`, `WHEEL_LR`, `WHEEL_RR`) contain separated disc, rim, tyre, and blur branches. Their audited origins are at world `0,0,0`, so the groups are useful organization but not functional wheel pivots yet. | `WARNING` | The model is a clean static source. Wheel separation reduces future setup work, but steering and rolling pivots must be created later. | Create a rolling pivot for each complete wheel assembly; add a steering pivot above each front rolling pivot. Do not move mesh parts individually. |
| 8 | LOD structure | No LOD policy has been verified in the current import. The source contains many named parts, but part count is not the same as LOD support. | `PENDING` | Runtime LODs will be needed for 16 simultaneous cars, but their absence in the source is not a rejection reason. | Build LODs after selecting the base asset and defining the runtime mesh budget. |
| 9 | Colliders | No Unity collider setup has been inspected. Blender empties named for wheels/suspension are not physics colliders by themselves. | `PENDING` | Missing colliders are normal in a render/model source. They must be authored for the game. | Inspect and create colliders in the Unity integration phase. |
| 10 | Cockpit integration | The source contains a visible and usable internal cockpit with dashboard, buttons, gear lever, and steering wheel. The exterior cockpit boundary is usable. A generic shared cockpit remains an architectural option, not a requirement for this candidate. | `PASS` | This candidate can be tested with its existing cockpit. A shared cockpit module may still be introduced later for cross-car consistency. | Preserve the cockpit during the first Unity test; compare against the shared cockpit contract later. |
| 11 | License and provenance | The asset is located in a downloaded 1989 pack. Commercial/game-use rights have not been verified from the original license or download page. | `BLOCKER` until verified | Technical quality cannot override an incompatible license. | Locate and preserve the license/readme before using the asset in a distributable build. |

---

## What the current evidence means

### 1. The body is not missing

The body exists as mesh data. The visible failure is caused by material conversion:

```text
body texture Alpha → Principled BSDF Alpha → transparent body
```

This is an import/shader compatibility problem. It is recorded under criteria 1 and 6. It is not a reason to discard the model yet.

### 2. Ninety mesh objects do not automatically mean excessive detail

The current import contains:

- 90 mesh objects;
- 25 empties used for grouping or pivots;
- 28,052 total triangles;
- approximately 21,956 vertices.

The important distinction is:

| Question | Correct interpretation |
|---|---|
| Does the model have many objects? | Yes. That mostly describes organization and part separation. |
| Does it have excessive polygon density? | No evidence of that. 28k triangles is modest for a source vehicle. |
| Is every small object needed at runtime? | No. Some cockpit controls, bolts, wheel blur meshes, and tiny details can be merged, hidden, or removed later. |
| Is detailed source geometry harmful? | Usually no. A detailed source is useful if it can produce simpler runtime versions. |
| Should we simplify immediately? | No. First preserve the source, solve scale/materials, then create runtime versions. |

The production rule is:

> **Keep a detailed master source; create a separate optimized runtime representation.**

The source model and the Unity runtime model do not need to be identical.

### 3. One base mesh for many teams

This makes sense only under a specific condition:

> The cars must share the same exterior geometry, and the visual difference must be expressible through materials, textures, decals, and small interchangeable parts.

A texture swap can change:

- paint colors;
- numbers;
- sponsor markings;
- stripes and livery;
- tire markings;
- small material properties.

A texture swap cannot change:

- wheelbase;
- nose shape;
- sidepod shape;
- rear-wing geometry;
- cockpit opening;
- airbox silhouette;
- suspension layout.

Therefore the recommended architecture is not “one March mesh for every historically different F1 car.” It is:

1. **One shared technical foundation** — driver rig, cockpit interior, wheel animation, common attachment conventions, common material slots, common Unity prefab structure.
2. **Several exterior geometry families** — one body mesh per genuinely different chassis silhouette.
3. **Multiple team liveries per compatible exterior family** — texture/material variants wherever geometry is truly shared.

For the MVP, using one exterior as a test base is sensible. It is not yet evidence that the March CG891 can represent every other 1989–1991 car.

### 4. Driver rigging

“Rigging” is the correct term.

The driver rig can be created once if all cars use:

- the same driver skeleton;
- the same animation set;
- the same steering-wheel interaction convention;
- compatible seat, hand, shoulder, and pedal positions.

The best reusable unit is:

```text
SharedCockpitPrefab
├── DriverSkeleton
├── DriverAnimations
├── Seat
├── Harness
├── SteeringWheel
├── Dashboard
└── Pedals
```

Each exterior car then provides a compatible cockpit opening and a placement transform. Small per-car offsets may still be necessary. One rig does not mean every car has identical proportions; it means the rig has a controlled attachment contract.

---

## Root object versus Collection

The current `Collection` is **not** the car root.

### Collection

A Blender Collection is an organizational folder in the Outliner. It can contain objects, but it does not provide a single transform pivot for the entire car.

### Object root

A car root should be an Empty or another dedicated object:

```text
CAR_March_CG891_ROOT
├── Body
├── FrontWing
├── RearWing
├── CockpitExterior
├── WHEEL_LF
├── WHEEL_RF
├── WHEEL_LR
├── WHEEL_RR
├── SUSP_LF
├── SUSP_RF
├── SUSP_LR
└── SUSP_RR
```

The root controls the complete car's:

- position;
- rotation;
- scale;
- export origin;
- Unity prefab placement;
- shared rig attachment coordinate system.

The current scene has useful local parents such as `WHEEL_LF` and `SUSP_LF`, but no global car-root object. That is a hierarchy warning, not a geometry failure.

---

## Why the model appears to be 0.01 in size

The scene is configured correctly for metric meters:

```text
Unit System: Metric
Unit Scale: 1.0
Length Unit: Meters
```

The imported objects themselves have:

```text
Object Scale: 0.01, 0.01, 0.01
```

This means the FBX importer applied a 0.01 transform scale to the objects. The source mesh coordinates are roughly 100 times larger than the evaluated object dimensions. The correct fix is **not** to scale individual parts one by one.

Correct later workflow:

1. Create one global car root.
2. Parent the complete car hierarchy to that root.
3. Verify the car's real length against the intended game scale.
4. Normalize the complete hierarchy as one unit.
5. Apply transforms only after the hierarchy is stable.
6. Recheck wheel pivots and cockpit placement.

Do not perform this normalization during the current import checkpoint.

---

## Showing object origins in Blender

To show the origin of every object:

1. Move the mouse over the **3D Viewport**.
2. At the top-right, locate the **Overlays** button. It is the icon with two overlapping circles.
3. Click the small dropdown arrow immediately beside that button.
4. In the popover, find the **Objects** section.
5. Enable **Origins** or **Origins (All)**, depending on the Blender version.
6. Close the popover.

The origins appear as small dots:

- orange dot: selected object's origin;
- other colored dots: origins of other visible objects;
- an Empty's origin is also its visible control shape/pivot.

For this asset, enable origins while inspecting `WHEEL_LF`, `WHEEL_RF`, `WHEEL_LR`, `WHEEL_RR`, and the body objects. Do not move any origin yet. The purpose of this step is observation only.

If the option is not visible, first confirm that the dropdown arrow next to the Overlays icon was opened; clicking the main Overlays icon alone only toggles all overlays on or off.

---

## Current decision

The March CG891 is a valid technical test candidate:

- geometry imported and visually verified;
- body, floor, cockpit, dashboard, buttons, gear lever, steering wheel, wings, wheels, and suspension are visible;
- source mesh cost is modest;
- UV layout is usable for livery work;
- source material conversion is understood and the incorrect Alpha-mask routes were repaired;
- wheel and suspension groupings are useful;
- object scale needs later normalization;
- no global car root exists yet;
- no functional wheel pivots exist yet;
- license remains unverified.

**Do not discard it because of the former transparent body, the 117 collection items, or the absence of imported animation.** Those are understood preparation issues. The license is the only current potential hard blocker.

**Technical verdict:** **APPROVED AS THE FIRST TEST CANDIDATE.** The March CG891 has usable exterior geometry, a functional visible cockpit, modest mesh cost, usable UVs, recoverable source materials, and separable wheel/suspension structures. It has no imported animation, but this is a preparation warning rather than a rejection reason. The next production tasks are global root/scale normalization, functional wheel pivots, Unity material conversion, LODs, and colliders.

**Release verdict:** license remains a potential blocker until the original source license explicitly permits modification and redistribution in a compiled game.

**Next controlled action:** preserve this audited checkpoint, then proceed to hierarchy/root organization. Do not discard the asset because it has no armature or Actions; create the animation pivots as part of the runtime preparation phase.
