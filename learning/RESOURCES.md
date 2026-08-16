# Overdrive Asset Production Resources

Curated high-trust sources for producing 3D models, images, and cutscenes in the Overdrive style. Paths are relative to the repo root.

## Knowledge

- [Project: Art Bible — `design/art/art-bible.md`](../design/art/art-bible.md)
  Authoritative style definition: visual identity (§1), palette (§2), lighting (§3), material/shader standards (§8.5: Simple Lit + Unlit, no PBR metallic), polygon budgets (§8.1), texture standards (§8.3), prohibitions (§9). Use for: every conformance check.
- [Project: Car asset spec (McLaren MP4/5 parody) — `design/assets/specs/team_tier1_a-car-assets.md`](../design/assets/specs/team_tier1_a-car-assets.md)
  Generation prompts (8 views + 4 Trellis multiview), livery description, technical notes (FBX export -Z forward/Y up, single 2048² atlas, compound colliders, no skeleton). Use for: car generation and restyle workflows.
- [Project: Krea2 prompt book — `design/art/prompts/krea2-prompt-book.md`](../design/art/prompts/krea2-prompt-book.md)
  Prompt language that produced the approved concept art. Use for: writing new generation prompts.
- [Project: Style anchor prompt — `design/art/style-anchor-prompt.md`](../design/art/style-anchor-prompt.md)
  Compact style anchor for consistent generation. Use for: any generation task.
- [Project: ASR car import pipeline — `docs/plans/asr-car-import-pipeline.md`](../docs/plans/asr-car-import-pipeline.md)
  Validated FBX import pipeline (Lotus 101 pilot, LOD0 <50k tris). Use for: restyling the 16-car ASR 1991 carset.
- [Project: Reference image catalog — `design/art/reference-catalog.md`](../design/art/reference-catalog.md)
  Curated visual references. Use for: grounding style discussions.
- [Project: Conformed generated references — `design/art/reference/generated/`](../design/art/reference/generated/)
  Krea2 outputs that passed the conformance checklist (exterior + cockpit). Use for: study examples in lessons.

## Wisdom (Communities)

- None yet — user has not opted in; revisit when the mission needs external feedback (revisit at video/cutscene lesson).

## Gaps

- NPR/toon shading in Unity URP (Simple Lit vs toon shader limits, outlines) — needs verified sources before the materials lesson.
- Trellis 2 / multiview 3D reconstruction (ComfyUI node) — verify current version and workflow before the practical generation lesson.
- Blender texture-painting / NPR workflow — verify current Blender LTS docs.
- Video generation models for cutscenes — compare current options when we reach that lesson.
- License check for Asset Store "Cartoon Formula 1991" (modification/commercial use) before any purchase.
