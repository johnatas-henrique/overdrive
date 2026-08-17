# ASR Car Import Pipeline — Lotus 101 Playbook

Purpose: single process for importing the ASR Formula 1989 package (25 cars)
into the Overdrive Unity project, avoiding every bug found on the Lotus 101.

## 1. Source asset state (what ASR delivers)

- Pre-converted FBX inside the unpacked kn5 folder
- DDS textures (65), livery skins at 2048×2048
- Empty-based hierarchy: TYRE_* / RIM_* / WHEEL_* / SUSP1-4 / STEER_HR / ARROW_RPM
- Triangle count ~22.7k (within the 50k LOD0 budget — no decimation needed)
- **Scale varies per car — always measure**: Zakspeed imports 1:1 real (4.478 m); the March Sketchfab copy came at object scale 0.01. Measure the world bounding box in Blender before proceeding (target ~4.5 m).
- **Texture paths may point at a `.backup` folder**: the FBX can reference `unp_<car>.kn5.backup\` with degraded DDS (512², alpha=0) instead of the main folder (2048², alpha=1). Re-point at import.
- **Extra pack assets beyond the FBX**: `data/driver3d.ini` + driver skins + `animations/HELMETRAIN.ksanim` (full driver rig/animation → base for the separate DriverPrefab domain), `collider.kn5` (external-bounds reference; convertible KN5→FBX with the same converter), `animations/*.ksanim` (steer/susp/shift for the Unity animation script), `skins/` (official liveries), `data/cameras.ini`.

## 2. Blender pre-export checklist (do BEFORE exporting)

1. **Convert all textures DDS→PNG with `img.save()`, NOT `img.save_render()`**
   — save_render applies Blender's display color transform and washes colors
   out (Camel yellow became brown). save() keeps raw pixel values.
2. **Verify every material has its texture node populated** — no empty
   Image Texture nodes. Blender shows black when empty; Unity shows grey
   (Simple Lit default): same problem, different symptom per engine.
   The Lotus floor (LOBODYSUB) shipped with empty nodes — 75 nodes had to be
   re-pointed after export.
3. **Remove ALL Alpha connections — systemic, not placeholder-only.** Every DDS is DXT5
   (always has an alpha channel) and the Blender FBX importer links texture alpha to
   the Principled Alpha + sets HASHED blend by default (Blender issue #85612). The AC
   shader uses the alpha channel as a detail mask (plastic, scratches, paint cuts),
   NOT global transparency. Fix systemically: unlink Alpha + set OPAQUE on all
   materials EXCEPT real transparency (RIM_BLUR wheel blur). Symptom: masked parts
   (floor, cockpit, interior, mirror) render half-transparent or invisible — a missing
   part is usually broken alpha, not a missing mesh. (Lotus's 151 placeholder-alpha
   links are a special case; same fix.)
4. **Remove/hide LOD duplicates (LOD B/C/D + collider) if the FBX carries
   them** — stacked LODs cause z-fighting. Keep only LOD0 visible. Before
   hiding, distinguish real parts (suspension, wings, LEDs) from LOD
   duplicates — the Leyton House cleanup accidentally hid the rear wing.
5. **Check for normal maps in base color slots** (`_n` suffix = normal map).
   The Lotus needle (int_plastic_red_n) landed in the base slot and rendered
   black. Create a clean red material instead.
6. **Standardize Empty rotations before export.** The FBX Z-up→Y-up
   conversion produced inconsistent empties (WHEEL_LF X=270, TYRE_LR X=90
   vs others 0; STEER_HR X:-90). Zero them in Blender or normalize after
   import in Unity — pick one side and stay consistent.
7. **Un-hide ALL objects before exporting** — the FBX exporter skips hidden
   objects (first export was a 33 KB empty file).
8. **Check triangle count** — target < 50k LOD0. ~23k needs no decimation;
   Leyton House at 193k exceeded budget 4×.
9. **Consolidate materials** — Lotus: 43 materials; Leyton House: 79.
   Target ~5–10 semantic groups (paint, carbon, interior, glass, rubber,
   brakes, LED) for sane Unity import.
10. **Verify hierarchy naming**: TYRE_LF/LR/RF/RR, WHEEL_LF/LR/RF/RR,
    SUSP1-4, STEER_HR, ARROW_RPM — the animation script depends on these.
11. **Re-point texture paths**: FBX may reference `unp_<car>.kn5.backup\` with
    degraded DDS (512², alpha=0) instead of the main folder (2048², alpha=1).
    Remove `.backup` from every image path and reload before exporting.
12. **Check scale per car**: Zakspeed imports 1:1 real (4.478 m); March
    (Sketchfab copy) came at 0.01 — always measure the world bounding box and
    normalize to real F1 (~4.5 m) before export.
13. **Dedup materials**: the FBX importer creates `.001` duplicates (Zakspeed:
    24 used of 39 created) — re-map meshes to the base material and delete
    orphans before exporting.

## 3. Unity post-import checklist

1. Convert all materials to URP Simple Lit with per-group smoothness:
   carbon/interior 0.15, paint 0.4, glass/mirror 0.05, discs/brakes 0.3.
   (Alpha was already fixed in Blender — all OPAQUE except RIM_BLUR; do not
   re-enable transparency in Unity.)
2. Fix the needle: red base color (0.9, 0.05, 0.02), smoothness 0.3 —
   do not rely on the normal-map texture.
3. Attach CarAnimationTest.cs and validate in Play mode: wheel spin,
   steering + wheel sync, needle sweep, LED colors, digital displays,
   column buttons, suspension, mirror, camera switching (1/2/3/C).
4. Confirm zero console errors before considering the car "done".

## 4. Known issues & deferred decisions

- **March CG891 (Sketchfab copy) is NOT official ASR**: someone bought the ASR
  pack, modified it, and reposted to Sketchfab — license not authorized. Use the
  canonical car from the purchased pack instead; treat the Sketchfab copy as
  reference only.
- **Driver is a separate domain**: the pack ships the full driver (driver3d.ini,
  driver skins, HELMETRAIN.ksanim) — use it as the base for the Overdrive
  DriverPrefab (rig + animations), not as part of the car geometry.
- **License (AC 1989)**: purchase in progress by the user, who has direct contact
  with the asset author (the author supplied the KN5→FBX converter in use).
- **Mirror**: RenderTexture 256×128 + camera validated as functional, but the
  camera must be positioned above the engine cover with car-body culling for
  the real implementation (ADR-0010).
- **Empty rotations**: decide Blender-side normalization vs Unity-side — TODO
  before the 25-car batch starts.
- **Digital displays**: TextMesh placeholders (gear 1–6, speed 0–320, lap
  1–23, position 1–16) until the real HUD exists.
- **LED colors** come from the comled texture names (red/yellow/green/blue).
- **Lotus 101 test car** was left with broken textures — not a production
  asset; source raw files stay in D:\projects\assets.
