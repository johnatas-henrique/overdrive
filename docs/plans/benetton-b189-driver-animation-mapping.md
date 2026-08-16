# Benetton B189 Driver Animation Mapping

## Status

**Date:** 2026-07-31  
**Source clip:** `animations/steer.ksanim`  
**Source model:** Benetton B189 converted FBX  
**Parser:** `tools/ksanim/parse_ksanim.py`

## Findings

The parser decoded the clip successfully:

- 56 animation targets;
- 100 frames per target;
- 5,600 transform frames total;
- Version 2 KSANIM layout;
- Quaternion, position, and scale data validated.

The current FBX contains **zero objects named `DRIVER:*`**. Therefore the clip cannot be applied directly to the current scene without a separate driver mesh and rig.

## Driver Asset Reference Found in the Package

The package does not contain a driver KN5. Its only KN5 files are the car model and `collider.kn5`.

The included support files identify the expected external driver asset:

```text
data/driver3d.ini
  MODEL NAME=driver_80

driver_base_pos.knh
  MODEL: DRIVE_BASE.fbx
  FBX: DRIVE_BASE.fbx
```

This indicates that the author expects a shared `DRIVE_BASE.fbx` asset, not a driver embedded in each car FBX. The `.knh` file also contains the expected `DRIVER:*` rig names and positional data.

### Request to the author

Request the following exact asset/package from the author:

1. `DRIVE_BASE.fbx` or the current equivalent of that shared driver model;
2. the armature with the `DRIVER:*` bone/object names preserved;
3. the driver mesh parts, helmet, visor, and material/UV references;
4. confirmation that it is compatible with `steer.ksanim`, `shift.ksanim`, `shift_up.ksanim`, and `shift_dw.ksanim`.

The existing `driver_base_pos.knh`, driver textures, and animation clips should be supplied alongside that model if the author provides a replacement package.

## `DriverRig_Mods.blend` Verification

The author supplied `DriverRig_Mods.blend` at the `F1 1989` asset root. It is a strong candidate for the missing driver source:

- four driver mesh parts: `RT_Suit`, `RT_Head`, `RT_Gloves`, and `RT_Shoes`;
- deformation armature `COG` with 58 bones;
- control armature `Control` with 130 bones;
- cockpit reference, steering, gear-shift, brake-pedal, and accelerator objects;
- 13 Blender Actions, including `steer`, `shift`, `shiftpad_up`, `shiftpad_down`, `brake`, and `accel`;
- Blender 5.2 Action layers containing real keyed channels, not empty Action datablocks.

The file is not directly compatible with the Assetto Corsa target names. Its deformation bones use names such as `LeftArm`, `LeftForeArm`, `LeftHand`, `RightArm`, `RightHand`, and `A_Head`, while the `.ksanim` files use `DRIVER:RIG_Arm_L`, `DRIVER:RIG_ForeArm_L`, `DRIVER:RIG_HAND_L`, and similar names. A retarget map is required.

The library contains zero image datablocks during inspection. Its five materials may therefore require external texture relinking or material reconstruction before Unity export.

### Current conclusion

`DriverRig_Mods.blend` is suitable as a pilot rig source and may be the author's Blender equivalent of `DRIVE_BASE.fbx`, but that equivalence is not yet confirmed. Ask the author whether this file is the intended shared driver asset and whether its Actions are the authoritative replacements for the `.ksanim` clips.

## Integration Test Result

The file was appended to a separate Benetton test copy without modifying the clean Stage 1 asset:

```text
f1_1989_benetton_b189_f_driver_rig_test.blend
```

The `steer` Action was assigned to the control armature and evaluated across frames 0–200. The driver gloves changed position between sampled frames and returned to the initial pose at the end of the clip. This confirms that the rig contains usable animation data.

Evidence:

```text
Assets/Screenshots/benetton_b189_driver_rig_steer_test.png
f1_1989_benetton_b189_f_driver_rig_steer_test.blend
```

The test also exposed the remaining integration work:

- the driver is not yet positioned inside the Benetton cockpit;
- the frame-50 evidence image shows a bare `RT_Head`; no helmet mesh was present in `DriverRig_Mods.blend`;
- the curved geometry visible around the seated figure belongs to the `RT_Suit` driver mesh. The cockpit reference was hidden during the evidence capture, so it is not a piece of the Benetton car;
- the appended materials did not expose image datablocks during inspection, so final suit/helmet texture relinking is unresolved;
- the control-rig bone names do not match the `DRIVER:*` names used by the Assetto Corsa clips;
- the existing `steer` Action uses the control rig and must be retargeted or exported through the deformation armature.

The package's `driver3d.ini` references external helmet objects such as `DRIVER:HELMET` and `412t2_helmet_berger`, but those meshes are not included in `DriverRig_Mods.blend`. A helmet mesh must therefore be requested or supplied separately before the driver is production-ready.

## Steam SDK and `DRIVE_BASE.fbx` Verification

The Assetto Corsa SDK was installed through Steam under:

```text
Assetto Corsa Editor/
```

The installation contains `ksEditor.exe`, editor support files, shaders, and basic sample objects, but it does not contain:

```text
sdk/dev/car_pipeline_2.0rev/Driver animation/DRIVE_BASE.fbx
```

A complete search of the Steam `steamapps` tree found no `DRIVE_BASE.fbx`, `driver_base_pos.knh`, or equivalent driver model. The Steam Editor package is therefore insufficient by itself to recover the expected shared driver asset.

The exact file was subsequently found at the root of the supplied 1989 asset folder:

```text
D:\projects\assets\F1 1989\DRIVE_BASE.fbx
```

The file is 833,392 bytes and imports successfully into Blender. It contains:

- `DRIVER:DRIVER` armature with 55 `DRIVER:*` bones;
- `DRIVER:Driver_Body` mesh;
- `DRIVER:HELMET` mesh;
- `DRIVER:HELMET_GLASS` mesh;
- `DRIVER:HELMET_plastic` mesh;
- three imported Actions, including a primary 121-frame driver Action.

This is the correct driver asset for the Benetton package. `DriverRig_Mods.blend` is a separate authoring/control rig and is no longer the preferred production source.

Integration evidence:

```text
Assets/Screenshots/drive_base_fbx_import_test.png
D:\projects\assets\F1 1989\cars\f1_1989_Benetton_B189\f1_1989_benetton_b189_f_drive_base_fbx_test.blend
```

The imported meshes show incorrect/missing material appearance in the first Blender test, so material relinking remains necessary. Positioning into the Benetton cockpit is also still pending.

## Final Integration Test Copy

The old `DriverRig_Test` collection and its unused legacy Actions were removed only from the final test copy. The source `DriverRig_Mods.blend` file was preserved.

Final test file:

```text
f1_1989_benetton_b189_f_driver_base_scaled_test.blend
```

The `DRIVE_BASE` root is preserved at the FBX-authored scale and placed under `DriverPresentationRoot` with a scale factor of `100`, avoiding modification of the imported Action channels.

The first material relink exposed that `DRIVER_Suit2.dds` is an alpha/mask-style texture for this mesh. Connecting its alpha made the suit disappear. The final test therefore uses:

```text
RT_DriverSuit       → 2016_Suit_DIFF.dds
RT_Gloves           → DRIVER_Gloves.dds + alpha
RT_Helemt           → HELMET_1985.dds
RT_HELMET_Glass     → HELMET_1985_Glass.dds + alpha
RT_HELMET_Strip     → HELMET_1985_Glass.dds + alpha
```

The primary imported driver Action remains active on `DRIVER:DRIVER`:

```text
DRIVER:DRIVER|Take 001|BaseLayer
```

It was tested at frame 60 with hand and forearm motion. A final cockpit render confirmed the driver, helmet, gloves, suit, and steering pose in the Benetton cockpit.

Evidence:

```text
Assets/Screenshots/drive_base_driver_suit_diff_test.png
Assets/Screenshots/drive_base_benetton_cockpit_final_render.png
```

## Completeness Audit

The final isolated render was compared with the cockpit render after the user identified that the pilot did not appear fully visible.

Confirmed from mesh inspection:

- `DRIVER:Driver_Body` contains 4,813 polygons;
- the face, suit, and glove material slots contain 640, 1,797, and 2,376 polygons respectively;
- `DRIVER:HELMET`, `DRIVER:HELMET_GLASS`, and `DRIVER:HELMET_plastic` are separate visible meshes;
- no driver object is hidden or disabled for render;
- the `_DEFAULT_` material slot has zero polygons and does not remove geometry.

The isolated render shows the complete body, arms, hands, legs, shoes, helmet, visor, and suit. The cockpit render hides part of the torso and legs behind the cockpit geometry; that is occlusion by the car, not missing driver mesh. The isolated completeness evidence is:

```text
Assets/Screenshots/drive_base_driver_completeness_isolated.png
```

The remaining presentation check is a final cockpit-camera render from the actual player viewpoint. The current side render is a diagnostic alignment view, not the final in-game camera view.

## Texture Persistence Fix

The first saved test copy retained a relative suit texture path and did not reliably reload the driver textures after reopening through the Windows Blender process. The final test copy now uses fresh packed image datablocks for the suit, gloves, helmet, and visor textures.

Final Material Preview evidence:

```text
Assets/Screenshots/drive_base_materials_packed_final_preview.png
```

The saved file is:

```text
f1_1989_benetton_b189_f_driver_base_scaled_test.blend
```

The verified final preview shows the Nannini suit and gloves, with the helmet and visor textures loaded from packed images rather than dependent on the WSL/Windows path bridge.

## Helmet Strip Verification

The helmet strip was isolated and compared against its active texture region. The result is:

- `DRIVER:HELMET_GLASS` contains 128 `RT_HELMET_Glass` polygons and 22 `RT_HELMET_Strip` polygons;
- the isolated `RT_HELMET_Strip` shows one green Benetton band;
- its UV region matches the green Benetton logo region in `HELMET_1985_Glass.dds`;
- the isolated `RT_HELMET_Glass` slot shows only the reflective dark visor and no green band;
- the transparent slot on `DRIVER:HELMET` shows an upper internal visor piece and no green band.

Evidence:

```text
Assets/Screenshots/drive_base_helmet_strip_closeup.png
Assets/Screenshots/drive_base_helmet_strip_only.png
Assets/Screenshots/drive_base_helmet_strip_texture_crop.png
Assets/Screenshots/drive_base_helmet_glass_slot_only.png
Assets/Screenshots/drive_base_helmet_transparent_slot_only.png
```

The apparent second band is therefore not a duplicated strip texture or a second strip mesh. It is the edge/overlap between the green strip and the separate reflective visor material.

## Helmet Strip UV Orientation Audit

A later UV audit identified the actual defect: the strip is one mesh with 22 faces arranged as 11 paired faces on opposite sides of the helmet. Each pair uses the same UV region, but one face has positive UV winding and the opposite face has negative UV winding.

The paired face centers are on opposite helmet sides (`X < 0` and `X > 0`). This confirms that one lateral half of the strip is horizontally mirrored in UV orientation. The minimal correction is to mirror the `U` coordinate only for the inverted half; the source texture and the strip material are otherwise correct. This UV correction has not yet been applied.

## Nannini Face Texture Status

The Benetton `19 Alessandro Nanini` skin folder was checked for a facial texture. It contains suit, glove, helmet, visor, livery, and UI metadata files, but no `DRIVER_Face`, `Face`, `Skin`, or `Head` texture.

`DRIVER_Suit2.jpg` is an atlas for the suit, gloves, and shoes; it is not a face texture and must not be assigned to `RT_DRIVER_Face`.

The stale missing `DRIVER_Face.png` node was removed from the Material Preview setup to eliminate Blender's magenta missing-texture output. `RT_DRIVER_Face` currently uses a neutral fallback color until a real Nannini face texture is supplied. Applying the requested Nannini-specific face texture is blocked because no such file exists in the supplied package or installed SDK.

## Target Domain

The clip contains targets for:

- driver root and torso;
- head and neck;
- left/right shoulders;
- left/right arms and forearms;
- left/right hands;
- finger chains;
- legs, shins, heels, and feet.

This is a driver-rig animation, not a car-cockpit animation.

## Car Objects Present in the FBX

The car-side hierarchy contains the expected presentation objects:

```text
STEER_HR
WHEEL_LF
WHEEL_RF
WHEEL_LR
WHEEL_RR
SUSP_LF
SUSP_RF
SUSP_LR
SUSP_RR
```

Dashboard meshes are also present as independent objects. These remain car-owned visuals and must not be mapped to the driver rig.

## Mapping Result

| Domain | Source targets/objects | Current FBX status | Required action |
|---|---|---|---|
| Driver body | `DRIVER:RIG_*`; external reference `DRIVE_BASE.fbx` | Missing from car FBX | Request the shared driver FBX and preserve its rig names |
| Driver hands | `DRIVER:RIG_HAND_*`, finger targets | Missing | Map to the reusable driver rig |
| Car steering wheel | `STEER_HR` | Present | Animate from vehicle steering state |
| Front wheels | `WHEEL_LF`, `WHEEL_RF` | Present | Animate steering and rolling in the car controller |
| Suspension | `SUSP_*`, `DIR_SUSP*` | Present | Validate or recreate presentation motion |
| Dashboard | `benetton_dash0-*` | Present | Animate from vehicle telemetry |

## Architectural Decision for This Pilot

The pilot will keep the domains separate:

```text
CarPrefab
├── Cockpit
├── SteeringWheel
├── Dashboard
├── Wheels
└── Suspension

DriverPrefab
├── DriverMesh
├── DriverRig
├── Arms
└── Hands
```

The vehicle publishes steering, speed, RPM, gear, and suspension presentation state. The car cockpit, wheels, dashboard, and driver presentation consume those values independently.

## Next Adapter Requirement

The parser output is ready for a second adapter layer. That adapter must:

1. accept the parsed target names and transform frames;
2. map `DRIVER:RIG_*` names to a reusable driver rig;
3. convert local transforms into Blender Actions or Unity animation data;
4. apply a per-car hand/cockpit pose offset;
5. preserve the car-owned steering wheel and dashboard as separate objects.

No direct driver-to-car mapping should be added to the Benetton FBX because the required driver targets do not exist in that file.
