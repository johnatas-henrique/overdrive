# Benetton B189 Animation Inventory

## Status

**Date:** 2026-07-31  
**Scene:** `f1_1989_benetton_b189_f_blender_pilot_stage1_wheels_aligned_clean.blend`  
**Inventory source:** Blender scene inspection  
**Candidate objects inspected:** 95

This inventory separates static asset preparation from runtime animation ownership. It is a pilot document for the other cars supplied in the same FBX pattern.

## Evidence Summary

- Wheel roots and child groups are present.
- Front wheel root, tire, and disk offsets are mirrored in the clean Stage 1 copy.
- `STEER_HR` exists as a separate cockpit steering-wheel group.
- Dashboard elements exist as separate meshes.
- Suspension empties and suspension-related meshes exist.
- No candidate object has embedded Blender animation data, constraints, or drivers.
- `benetton0-6` is a separate rear light candidate at the rear center of the car and is the only user of material `BENLAMP`.
- `BENLAMP` is not yet configured for dynamic brake-light emission: its emission color is black and no emission link exists.
- No driver mesh or `DRIVER:*` rig exists in this car FBX; package metadata points to an external `DRIVE_BASE.fbx`. The exact `DRIVE_BASE.fbx` was found at the `F1 1989` asset root and imported successfully with the complete driver body, helmet, visor, and 55-bone `DRIVER:*` armature. Its final test copy is scaled, aligned, textured, and Action-tested in a separate Blender file.
- The isolated completeness audit confirms that the apparent missing pilot parts in the cockpit render are occluded by cockpit geometry rather than absent from `DRIVE_BASE.fbx`.
- Material Preview defects in gloves/wrists and stale helmet texture nodes were corrected; the Nannini-specific face texture remains blocked because the supplied skin folder contains no facial texture.
- Driver texture datablocks are packed into the final Blender test copy so the suit, gloves, helmet, and visor survive reopening without relying on relative WSL/Windows paths.
- `STEER02-3` is a standalone mesh outside the `STEER_HR` hierarchy and requires a deliberate ownership decision.

## External Animation Content

The package contains twelve `.ksanim` clips. The parser decoded all twelve, including both supported binary layouts.

| Clip | Targets/frames | Confirmed content | Overdrive treatment |
|---|---:|---|---|
| `steer.ksanim` | 56 / 5,600 | Driver torso, arms, hands, fingers, legs, and feet | Map to reusable DriverPrefab; do not attach to car mesh |
| `car_susp_lf.ksanim` | 11 / 1,100 | LF hub, suspension mesh, wheel, tire, rim, blur rim, pusharm, suspension arms | Map to front-left car visual controller |
| `car_susp_rf.ksanim` | 11 / 1,100 | RF hub, suspension mesh, wheel, tire, rim, blur rim, pusharm, suspension arms | Map to front-right car visual controller |
| `car_susp_lr.ksanim` | 10 / 1,000 | LR transmission, hub, suspension mesh, wheel, tire, rim, blur rim, suspension arms | Map to rear-left car visual controller |
| `car_susp_rr.ksanim` | 10 / 1,000 | RR transmission, hub, suspension mesh, wheel, tire, rim, blur rim, suspension arms | Map to rear-right car visual controller |
| `car_shift.ksanim` | 25 / 2,525 | Driver torso, right arm, right hand, and fingers | Map to driver gear-change presentation |
| `shift.ksanim` | 55 / 5,500 | Driver rig using the version 1 matrix layout | Decode to driver animation data; validate against shift pose |
| `shift_up.ksanim` | 61 / 6,100 | Driver rig, helmet, helmet glass, helmet plastic, and driver body | Map to DriverPrefab gear-up clip |
| `shift_dw.ksanim` | 61 / 6,100 | Driver rig, helmet, helmet glass, helmet plastic, and driver body | Map to DriverPrefab gear-down clip |
| `HELMETRAIN.ksanim` | 1 / 101 | `RAIN_HELMET` | Evaluate as a separate weather effect, not a car animation |
| `rainmod.ksanim` | 1 / 101 | `rainmod` | Evaluate as a separate weather effect |
| `sphererain.ksanim` | 1 / 101 | `sphererain` | Evaluate as a separate weather effect |

The external clips also reference names that do not directly exist in the current FBX, such as `SUSP_LF_MESH`, `ARM_LF_UPPER`, `LR_PUSHARM`, and `TRANSMISSION_R_0`. These require a mapping layer rather than blind name matching.

No external clip was found for wipers, movable aerodynamic parts, or dedicated brake-light activation. Those behaviors remain candidates for Unity procedural controllers or material-driven effects.

## Measured Suspension Motion

Keyframe measurement shows that target presence and target motion are different facts:

- `HUB_LF`, `HUB_RF`, `HUB_LR`, and `HUB_RR` translate by approximately `0.035984` units across the clip. They are suspension travel references, not rolling animations.
- Suspension arm targets such as `ARM_LF_LOWER`, `ARM_LF_UPPER`, `ARM_RF_LOWER`, `ARM_RF_UPPER`, `ARM_LR_UPPER`, `ARM_LR_LOWER`, `ARM_RR_UPPER`, and `ARM_RR_LOWER` contain rotation changes while their positions remain fixed.
- `WHEEL_*`, `TIRE_*`, `RIM_*`, and `RIM_BLUR_*` are present in the suspension clips but have no independent transform change in the measured data. Their runtime rolling, steering, and blur behavior must therefore be handled by the car visual controller unless a parent-space interpretation later proves otherwise.
- `TRANSMISSION_L_0` and `TRANSMISSION_R_0` are present in the rear clips but have no independent transform change in the measured sample. They are currently treated as static/reference targets pending hierarchy mapping.

This prevents a common implementation error: blindly converting every KSANIM target into a runtime animation. The adapter must preserve only meaningful motion and assign procedural ownership where the clip is a reference or rest-pose channel.

## Inventory Table

| Domain | Objects | Current structure | Runtime purpose | Blender preparation | Status |
|---|---|---|---|---|---|
| Wheel roots | `WHEEL_LF`, `WHEEL_RF`, `WHEEL_LR`, `WHEEL_RR` | Top-level empties with wheel children | Steering and rolling pivots | Keep as runtime roots; verify vertical steering axis | READY FOR TEST |
| Tires | `TYRE_LF/RF/LR/RR` and `TYRE_*_SUB*` | Tire empties parented to wheel roots | Rolling and tire visual response | Keep child hierarchy; verify local axes | READY FOR TEST |
| Rims | `RIM_LF/RF/LR/RR` and `RIM_*_SUB*` | Rim empties parented to wheel roots | Rolling and wheel appearance | Preserve mirrored offsets | READY FOR TEST |
| Blur rims | `RIM_BLUR_LF/RF/LR/RR` and submeshes | Blur groups parented to wheel roots | Speed-dependent wheel blur | Decide runtime visibility/LOD rule | NEEDS UNITY RULE |
| Brake discs | `DISK_LF/RF/LR/RR` | Meshes parented to wheel roots | Rolling disc presentation | Preserve mirrored local offsets | READY FOR TEST |
| Front suspension pivots | `SUSP_LF`, `SUSP_RF` | Top-level empties with caliper/arm children and `DIR_SUSP*` | Suspension presentation | Validate pivot and travel axis | NEEDS PIVOT AUDIT |
| Rear suspension pivots | `SUSP_LR`, `SUSP_RR` | Top-level empties with caliper/arm children and `DIR_SUSP*` | Suspension presentation | Validate pivot and travel axis | NEEDS PIVOT AUDIT |
| Suspension mesh groups | `SUSP1`, `SUSP2`, `SUSP3`, `SUSP4` | Top-level empties with `benetton_suspa0_* -1` meshes | Visible suspension components | Test whether group origins represent useful pivots | NEEDS PIVOT AUDIT |
| Suspension direction markers | `DIR_SUSP1`–`DIR_SUSP4` | Empty children of `SUSP_*` groups | Possible direction/reference markers | Confirm whether these are source helpers or usable pivots | NEEDS IDENTIFICATION |
| Brake/caliper assemblies | `benetton_*_cal-2`, `benetton_*_cal_002` | Children of `SUSP_*` groups | Static or suspension-linked brake detail | Confirm whether they should follow suspension or remain fixed | NEEDS TEST |
| Steering wheel root | `STEER_HR` | Top-level empty with wheel parts | Car-owned steering wheel rotation | Verify rotation center and axis | READY FOR PIVOT TEST |
| Steering wheel body | `STEER02`, `STEER02-1`, `STEER02-2` | Children of `STEER_HR` | Steering wheel geometry | Keep under `STEER_HR` | READY FOR TEST |
| Steering wheel screw | `STEER02-3_001`, `STEER02-3_002` | Nested child under `STEER_HR` | Steering wheel detail | Keep with wheel | READY FOR TEST |
| Steering wheel buttons | `STEER02-4`, `STEER02-5`, `STEER02-6` | Children of `STEER_HR` | Wheel-mounted controls/details | Animate only if a visible button press is required | OPTIONAL |
| Orphan steering mesh | `STEER02-3` | Top-level mesh, not under `STEER_HR` | Unclear; likely related steering detail | Identify before export; do not animate blindly | BLOCKING OWNERSHIP QUESTION |
| Dashboard elements | `benetton_dash0-006`, `benetton_dash0-1`, `benetton_dash0-4`, `benetton_dash0-5` | Independent top-level meshes | Speed/RPM/gear/instrument presentation | Identify each element and its pivot/material role | NEEDS INSTRUMENT AUDIT |
| Brake light | `benetton0-6` | Separate four-vertex rear-center plane using exclusive `BENLAMP` material | Brake-state emission response | Add/validate emission and confirm the red texture region | FOUND; NEEDS EMISSION |
| Pilot | No `DRIVER:*` objects | Absent from FBX | Arms, hands, body, and steering pose | Supply/create separate reusable pilot rig | EXTERNAL ASSET REQUIRED |

## Runtime Ownership

### Car-owned controllers

```text
WheelVisualController
SuspensionVisualController
SteeringWheelVisualController
DashboardVisualController
VehicleLightController
```

These controllers consume vehicle state such as speed, steering angle, RPM, gear, brake state, fuel, and suspension compression.

### Pilot-owned controller

```text
DriverPresentationController
```

This controller consumes steering and gear state but remains independent from the car mesh. It will drive the reusable driver rig and apply per-car hand/cockpit pose offsets.

## Required Data Contracts

| Visual feature | Required runtime value |
|---|---|
| Wheel rolling | vehicle speed or wheel angular velocity |
| Front steering | visual steering angle |
| Suspension | per-corner compression/travel |
| Steering wheel | visual steering angle |
| Speedometer | vehicle speed |
| Tachometer | engine RPM |
| Gear display | current gear |
| Fuel display | current fuel |
| Brake light | brake-active state |
| Dashboard switches | explicit visual state, only where needed |
| Driver hands | steering angle and gear-change state |

## Blocking Findings Before FBX Export

1. `STEER02-3` must be identified and assigned to the steering-wheel hierarchy or marked as a separate cockpit object.
2. Suspension pivot behavior must be tested manually; the presence of `SUSP_*` empties does not prove their origins are correct.
3. Dashboard meshes need classification as needles, displays, static plates, or material-driven elements.
4. `benetton0-6`/`BENLAMP` must receive a validated emission setup and a brake-state runtime contract.
5. The pilot rig remains external; `steer.ksanim` cannot be applied to this FBX until a compatible driver hierarchy exists.

## Stage 1 Completion Criteria

- [x] Wheel roots, tire groups, rim groups, and discs are inventoried.
- [x] Front wheel root, tire, and disk mirror offsets are saved in the clean Stage 1 copy.
- [x] Steering wheel group is identified.
- [x] Dashboard candidate meshes are identified.
- [x] Suspension groups and reference empties are identified.
- [x] External suspension, driver, shift, and rain animation clips are inventoried.
- [ ] Suspension pivots are validated by manual movement.
- [ ] Dashboard instruments are classified and assigned pivots/material roles.
- [x] Brake light candidate `benetton0-6` and exclusive material `BENLAMP` are identified.
- [ ] Brake-light emission and texture color are validated.
- [ ] Final export hierarchy is approved.
