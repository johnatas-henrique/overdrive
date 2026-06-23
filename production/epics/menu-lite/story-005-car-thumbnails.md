# Story 005: Car Thumbnails via RenderTarget

> **Epic**: Menu LITE
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Visual/Feel
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/menu-lite.md`
**Requirement**: `TR-MENU-008` — Car thumbnails via RenderTarget — captured once at init with isolated camera and alpha background. 8 thumbnails cached.

**ADR Governing Implementation**: ADR-0019: Menu LITE Architecture
**ADR Decision Summary**: Car thumbnails captured once at init via `CreateScreenshotUsingRenderTargetAsync` with dedicated camera, transparent background (`Color4(0,0,0,0)`), no environment. Cached as data URLs, never re-rendered.

**Engine**: Babylon.js 9.12.0 | **Risk**: MEDIUM
**Engine Notes**: `CreateScreenshotUsingRenderTargetAsync(engine, camera, { width: 256, height: 256 })`. Preserves alpha channel in WebGL. WebGPU may require fallback to manual `RenderTargetTexture.readPixels()` + `canvas.toBlob()`. API confirmed valid in Babylon.js 9.12.0.

**Control Manifest Rules (this layer)**:

- Required: P12 — car thumbnails via `CreateScreenshotUsingRenderTargetAsync` with isolated camera, captured once at init
- Required: P8 — pre-create all controls at init
- Performance: P-G2 — ~1.6MB total (~600KB controls + ~1MB thumbnail data URLs)
- Performance: P-G4 — ~8-16ms for 8 car thumbnails at init

---

## Acceptance Criteria

_From GDD `design/gdd/menu-lite.md`, scoped to this story:_

- [ ] At game init, 8 car thumbnails are captured (one per team) using `CreateScreenshotUsingRenderTargetAsync`.
- [ ] Each capture uses a dedicated `ArcRotateCamera` positioned to frame the car centre. Camera is temporary — created, used, disposed.
- [ ] Scene state (clearColor, activeCamera, environmentTexture) is saved before each capture and restored after.
- [ ] Background is transparent (`Color4(0, 0, 0, 0)`). No environment, no shadows, no reflections — just the car on a neutral backdrop.
- [ ] Each thumbnail is stored as a data URL (base64 PNG) and used as `Image.source` in the Car Select GUI cells.
- [ ] Thumbnails are never re-rendered at runtime. Selecting a different team on Car Select instantaneously swaps the `Image.source` to the cached data URL (zero load time).
- [ ] In WebGPU mode: if `CreateScreenshotUsingRenderTargetAsync` does not preserve alpha, fallback to manual `RenderTargetTexture.readPixels()` + `canvas.toBlob()` PNG generation.

---

## Implementation Notes

_Derived from ADR-0019 Implementation Guidelines:_

```typescript
async function captureCarThumbnail(
  carMesh: AbstractMesh,
  scene: Scene,
  size = 256
): Promise<string> {
  const savedClear = scene.clearColor.clone();
  const savedCam = scene.activeCamera;
  const savedEnv = scene.environmentTexture;

  const cam = new ArcRotateCamera(
    "thumbCam",
    -Math.PI / 4,
    Math.PI / 3,
    5,
    carMesh.getBoundingInfo().boundingSphere.center,
    scene
  );

  carMesh.setEnabled(true);
  scene.clearColor = new Color4(0, 0, 0, 0);
  scene.environmentTexture = null;

  const dataUrl = await CreateScreenshotUsingRenderTargetAsync(
    scene.getEngine(),
    cam,
    { width: size, height: size }
  );

  scene.clearColor = savedClear;
  scene.environmentTexture = savedEnv;
  scene.activeCamera = savedCam;
  cam.dispose();
  carMesh.setEnabled(false);

  return dataUrl; // used as Image.source in GUI
}
```

- 8 renders × ~1-2ms = 8-16ms total at init. Run during loading screen or splash sequence.
- If the base mesh geometry is identical across teams (only material differs), apply each team's material before capture.
- `Image.source = dataUrl` — the GUI `Image` control accepts data URLs as source strings.
- WebGPU fallback: if the data URL has no alpha channel, use `RenderTargetTexture` with `readPixels()` to get raw RGBA pixels, then encode via `canvas.toBlob('image/png')`.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 004: Car Select grid layout, cell styling, selection logic — this story provides the `Image.source` values only
- Car mesh loading, team materials assignment — handled by Asset Manager + Entity lifecycle

---

## QA Test Cases

_Manual verification steps:_

### V-005-1: 8 unique thumbnails rendered

- **Setup**: After game init (thumbnails captured at startup). Navigate to Car Select.
- **Verify**: Each team cell shows a distinct car render (different colours/shapes per team).
- **Pass condition**: 8 visibly different car images displayed.

### V-005-2: Thumbnails have transparent background

- **Setup**: Car Select visible.
- **Verify**: Car image has no visible background rectangle — only the car shape on the panel.
- **Pass condition**: Background behind car matches the panel colour (no white/black rectangle around car).

### V-005-3: Selection updates thumbnail highlight

- **Setup**: Car Select visible.
- **When**: Select a team — that team's thumbnail gets accent border/overlay.
- **When**: Change selection — highlight moves to new team's thumbnail.
- **Pass condition**: Visual feedback matches selection instantly.

### V-005-4: No re-render on reselection

- **Setup**: Car Select visible.
- **When**: Select team A → B → A quickly.
- **Verify**: Team A thumbnail loads instantly (no flash, no delay, no re-capture).
- **Pass condition**: Thumbnail swap is instant — no network request, no render pass.

### V-005-5: Performance — no frame drop on Car Select open

- **Setup**: Car Select visible.
- **Verify**: Stable FPS. No hitch from thumbnail loading.
- **Pass condition**: FPS is consistent with other menu screens (no spike when Car Select first opens).

### V-005-6: WebGPU alpha check (if WebGPU renderer)

- **Setup**: Render using WebGPU.
- **Verify**: Thumbnail transparent areas are truly transparent, not black or white.
- **Pass condition**: Fallback path works correctly if WebGPU doesn't preserve alpha.

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**: `production/qa/evidence/story-005-car-thumbnails-evidence.md` + sign-off

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (MenuLite Core — ADT), Asset Manager loaded car meshes, team materials available at init
- Unlocks: Story 004 (Car Select — provides thumbnail Image sources)
