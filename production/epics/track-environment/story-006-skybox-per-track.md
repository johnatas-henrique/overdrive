# Story 006: Skybox Per Track

> **Epic**: Track + Environment
> **Status**: Ready
> **Layer**: Core
> **Type**: Visual/Feel
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/track-environment.md`
**Requirements**: `TR-TE-005`

- **TR-TE-005** (revised 2026-06-23): Skybox gradient texture (single .png on skydome mesh) per track — keyed by TrackConfig.skyPalette reference to SkyPalettes config map.

**ADR Governing Implementation**: ADR-0025: Track + Environment
**ADR Decision Summary**: Each track references a fixed sky palette from `palette.json`. The sky is a single gradient texture on a skydome mesh — no dynamic sky simulation. Sky changes only when the player changes track.

**Engine**: Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12 | **Risk**: LOW
**Engine Notes**: Skydome via `MeshBuilder.CreateSphere()` with `StandardMaterial` and a gradient `.png` texture. No HDR/IBL — simple gradient texture per ADR-0025 Decision 6 and revised TR-TE-005.

**Control Manifest Rules (this layer)**:

- C62: Track: config-driven — `src/config/tracks/{id}.ts` + GLB assets. Zero TypeScript code changes to add a circuit.

---

## Acceptance Criteria

_Revised per QL-STORY-READY gate on 2026-06-23 — gradient skydome (not HDR IBL):_

- [ ] **AC-1**: `SkyPalettes` config map defined at `src/config/sky-palettes.ts` exporting `Record<string, string>` mapping palette name to `.png` asset path.
- [ ] **AC-2**: `TrackConfig.skyPalette` key resolved against SkyPalettes map during `load()`. Unknown key logs a warning and applies a default sky palette.
- [ ] **AC-3**: Skydome mesh created as a sphere (`MeshBuilder.CreateSphere`) with `StandardMaterial` and the gradient `.png` as diffuse texture. UV-mapped to show the gradient from horizon to zenith.
- [ ] **AC-4**: Skybox is instantiated in raceScene during `load()` and disposed during `dispose()` — sky changes when track changes.
- [ ] **AC-5**: Skydome visible from Grid through Checkered Flag — no gaps or seams in the gradient. Skydome does not interfere with track geometry rendering.
- [ ] **AC-6**: No dynamic sky simulation — static gradient per track. No time-of-day changes, no weather transitions.

---

## Implementation Notes

_Derived from ADR-0025 Implementation Guidelines:_

### SkyPalettes Config

```typescript
// src/config/sky-palettes.ts
export const SkyPalettes: Record<string, string> = {
  "monza-sunny": "assets/skies/monza-sunny.png",
  "spa-overcast": "assets/skies/spa-overcast.png",
  "interlagos-sunny": "assets/skies/interlagos-sunny.png",
  "monaco-twilight": "assets/skies/monaco-twilight.png",
  default: "assets/skies/default-sky.png",
};
```

### Skydome Creation

```typescript
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';

createSkydome(scene: Scene, skyPaletteKey: string): Mesh {
  const skyPath = SkyPalettes[skyPaletteKey] ?? SkyPalettes['default'];

  if (!SkyPalettes[skyPaletteKey]) {
    console.warn(`Unknown sky palette: ${skyPaletteKey}, using default`);
  }

  // Create sphere (inverted normals for interior view)
  const skybox = MeshBuilder.CreateSphere('skybox', { diameter: 1000, segments: 16 }, scene);
  skybox.isPickable = false;
  skybox.infiniteDistance = true;

  const material = new StandardMaterial('skyboxMat', scene);
  material.diffuseTexture = new Texture(skyPath, scene);
  material.backFaceCulling = false;
  material.disableLighting = true; // sky is self-lit

  skybox.material = material;
  return skybox;
}
```

### Integration with Track Load

```typescript
// Inside TrackEnvironmentManager.load():
this.skybox = this.createSkydome(this.scene, config.skyPalette);

// Inside TrackEnvironmentManager.dispose():
if (this.skybox) {
  this.skybox.dispose();
  this.skybox = undefined;
}
```

### Visual Verification

Sky is purely visual — verify by loading two different tracks and observing the sky color/gradient change. The evidence doc should include:

1. Screenshot of Track A (e.g., Monza sunny) showing sky gradient
2. Screenshot of Track B (e.g., Monaco twilight) showing different sky gradient
3. Both screenshots taken from the same camera angle for direct comparison

---

## Out of Scope

- **Dynamic sky simulation** (time of day, weather transitions) — deferred to Alpha / Full Vision
- **HDR environment IBL** — removed per TR-TE-005 revision (gradient skydome only)
- **Track lighting** — track materials use their own lighting; skybox provides visual backdrop only

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1** (SkyPalettes config):
  - Setup: File `src/config/sky-palettes.ts` is imported
  - Verify: Exports a `Record<string, string>` where keys are palette names and values are paths to `.png` files
  - Pass condition: At least one entry exists; map entries reference existing asset paths

- **AC-2** (skyPalette key resolution):
  - Setup: TrackConfig has `skyPalette: "monza-sunny"`, SkyPalettes has `"monza-sunny": "assets/skies/monza-sunny.png"`
  - Verify: During `load()`, the texture path resolves to `"assets/skies/monza-sunny.png"`
  - Pass condition: Texture loads successfully; no console warning
  - Edge: Unknown key `"nonexistent"` logs warning and falls back to `'default'` palette

- **AC-3** (skydome mesh):
  - Setup: Track loaded with known sky palette
  - Verify: Scene contains a Mesh named "skybox" with `infiniteDistance = true` and `isPickable = false`
  - Pass condition: Mesh has a `StandardMaterial` with a diffuse texture matching the expected `.png`

- **AC-4** (skybox lifecycle):
  - Setup: Load Track A, observe skybox in scene
  - Verify: dispose() removes the skybox mesh and its material
  - Pass condition: After dispose(), no mesh named "skybox" remains in scene; after load(Track B), new skybox mesh present
  - Edge: dispose() twice does not error (idempotent)

- **AC-5** (visual presence):
  - Setup: Load any track with sky enabled
  - Verify: Sky is visible in the rendered frame from any camera angle
  - Pass condition: Sky occupies the background behind all track geometry; no transparent gaps at horizon line

- **AC-6** (static sky):
  - Setup: Same track loaded, camera stationary
  - Verify: Sky gradient remains identical frame to frame over 10 seconds
  - Pass condition: No color shift, no moving cloud layers, no time progression

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**: `production/qa/evidence/skybox-per-track-evidence.md` + visual sign-off (lead designer comparison against reference images)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 (load/dispose lifecycle — skybox instantiated during load)
- Unlocks: None (independent visual feature)
