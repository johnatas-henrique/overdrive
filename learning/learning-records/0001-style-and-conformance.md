# Style, Geometry, Surface, and Conformance

The user now distinguishes the visual identity of Overdrive from the techniques used to implement it. **Style** is the game's shared visual language: the Fujishima + Matsuri fusion and the hand-crafted 1990s Japanese racing-anime identity. **Geometry** is the actual 3D form of an asset, including its mesh, volumes, topology, modeled details, part separation, silhouette, and proportions. **Silhouette** is the recognizable outer contour; **proportion** is the size relationship between parts. A real-world proportion does not need to become unrealistic to feel anime: stylization can come from simplification, clean contours, graphic shadows, controlled highlights, and selective exaggeration while preserving important historical identity anchors.

**Surface** is the appearance applied to geometry: textures, colors, roughness, metallic response, normal maps, glass, dirt, and decals. **Palette** is the controlled set of project colors and their semantic use. A **shader** is the program that calculates how a surface reacts to light, shadows, reflections, transparency, and other rendering inputs. `URP/Lit` or Simple Lit reacts to scene lighting and can show shadows, highlights, and reflections; `Unlit` largely displays the authored color without normal scene-light response, producing a flatter graphic result. Overdrive should not remove shadows entirely: it needs controlled, readable graphic shadows rather than photorealistic gradients and micro-reflections.

**Context** is the asset's role, placement, camera, lighting, surrounding objects, and narrative use. The same Porsche can fail as a primary F1 race car but work as a character's civilian car in a paddock or cutscene. A camera angle does not normally move a fixed light, but it changes which surfaces, highlights, and shadows are visible; camera and lighting therefore affect the final appearance even when the asset mesh is unchanged.

## Evidence

- The user read Lesson 1 and resolved their questions.
- The user correctly reasoned that Assetto Corsa cars may be useful as historical and technical references but can be poor final assets when their geometry and realistic silhouettes conflict with Overdrive's visual domain.
- Unity inspection confirmed that the prototype Porsche is a modular 44-object prefab with separate body, doors, glass, wheels, brakes, lights, mirrors, spoiler, steering wheel, collider, and `CARRERA_LOW` variant. Its main material uses `Universal Render Pipeline/Lit`, smoothness `0.483`, metallic `0.102`, and receives shadows; its matte material uses the same shader with smoothness and metallic set to `0`. This provides a concrete example of geometry, surface, and shader being separate layers.

## Implications

- Future asset evaluation must check **geometry/silhouette/proportion first**, before investing in repainted surfaces.
- Assets with compatible geometry but mismatched surfaces should be treated as re-styling candidates, not rejected automatically.
- Future lessons can begin teaching practical material and texture changes, using the Porsche, wall, and grandstand assets as controlled examples.
