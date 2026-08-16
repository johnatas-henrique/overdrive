# Mission: 3D & AI Asset Production for Overdrive (Fujishima/Matsuri style)

## Why

Overdrive (1991 F1 racing game) needs 16 cars, 16 tracks, and supporting visuals produced in the game's anime style (Kosuke Fujishima + Hino Matsuri fusion, per art bible). The user is the solo producer; without this skill, assets stay at the concept-art stage (Krea2 images) and the MVP cannot ship.

## Success looks like

- Generate a 3D F1 car in the game style from concept to Unity-ready (mesh, UVs, painted textures, Simple Lit materials, LODs) — both from scratch (2D → multiview → 3D) AND by restyling existing models (Asset Store, ASR carset)
- Verify ANY asset (generated image, 3D model, video) against the art bible with an objective checklist, and iterate prompts/models until it conforms
- Produce supporting images and cutscenes (video) with AI, all in the same style
- Run a repeatable pipeline for 16 cars + 16 tracks (a process, not one-off tricks)

## Constraints

- User has ZERO drawing background (38yo, partially blind earlier in life) — teach via objective criteria, measurable values, and empirical tests, never "develop your eye"
- Tools: Blender (beginner, assisted by Blender MCP), Unity, ComfyUI + Krea2 (RTX 3080 Ti 12GB), Krita; budget exists for a paid 3D tool (Tripo/Rodin/Meshy/Hi3D) if the pipeline needs it
- Conversation in PT-BR; ALL persistent documents in English (project rule #1422)
- Art bible (style, materials 8.5, budgets 8.1/8.3) and asset specs already exist — production must conform to them
- ~1 year to MVP; MVP scope for cars: no skeleton rig (wheels rotate via script), driver is a separate asset domain

## Out of scope

- Manual 2D drawing/painting skills (hand-drawn art)
- Gameplay programming
- Rigging/animation beyond what MVP assets need
