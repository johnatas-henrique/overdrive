# Story 005: Instant Cockpit/Chase Toggle

> **Epic**: Camera
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Last Updated**: 2026-06-30
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/camera.md`
**Requirement**: `TR-CAM-002`

- **TR-CAM-002**: Instant toggle between cockpit and chase (no lerp transition) — `cameraToggle` pulse from `InputState` triggers it.

**ADR Governing Implementation**: ADR-0007: Camera Architecture
**ADR Decision Summary**: `toggleCockpitChase()` switches `scene.activeCamera` between the cockpit and chase instances directly. No intermediate blend state. Preference stored in `lastToggleChoice`, restored on GSM Racing re-entry.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW

**Control Manifest Rules (this layer)**:

- C18: `cameraToggle` from `InputState` only.
- C-F7: Never initiate GSM transitions.

---

## Acceptance Criteria

_From GDD `design/gdd/camera.md`, revised per QL-STORY-READY:_

- [ ] **AC-2 (revised)**: `toggleCockpitChase()` switches `scene.activeCamera` between the cockpit and chase instances in **zero frames** — no intermediate position, FOV, or rotation blend state exists between the call and the next render.
- [ ] **AC-15**: Camera toggle choice persists across GSM transitions (PreRace → Racing → PostRace → Race Again: last toggle wins). Default on first Race entry is cockpit (AC-1). Toggle choice persists through deactivate/reactivate cycles within a single session.
- [ ] **AC-16**: Toggle is a no-op when called during Grid or Drone camera modes (PreRace/PostRace) — `scene.activeCamera` remains unchanged, no error thrown.

---

## Implementation Notes

_Derived from ADR-0007 Implementation Guidelines:_

### Toggle Method

```typescript
toggleCockpitChase(): void {
  if (this.currentMode === CameraMode.Cockpit) {
    this.setActiveMode(CameraMode.Chase);
  } else if (this.currentMode === CameraMode.Chase) {
    this.setActiveMode(CameraMode.Cockpit);
  }
  // If neither Cockpit nor Chase is active (e.g., Grid, Drone), do nothing
}
```

### Input Source

Called from the `cameraToggle` pulse in `InputState` (ADR-0006). The `cameraToggle` is debounced at the Input layer with a 200ms window — Camera never receives more than 1 toggle per window. No debounce logic in Camera.

### Preference Persistence

```typescript
// In-memory storage within CameraManager
private lastToggleChoice: CameraMode.Cockpit | CameraMode.Chase | null = null;

// Updated each toggle:
toggleCockpitChase(): void {
  if (this.currentMode === CameraMode.Cockpit) {
    this.setActiveMode(CameraMode.Chase);
    this.lastToggleChoice = CameraMode.Chase;
  } else if (this.currentMode === CameraMode.Chase) {
    this.setActiveMode(CameraMode.Cockpit);
    this.lastToggleChoice = CameraMode.Cockpit;
  }
}
```

Restored on GSM Racing re-entry:

```typescript
// On gsm.state.entered(Racing):
const targetMode = this.lastToggleChoice ?? CameraMode.Cockpit;
this.setActiveMode(targetMode);
```

### Instant Switch Verification

The switch is instant because `setActiveMode` is a single assignment:

```typescript
setActiveMode(mode: CameraMode): void {
  this.currentMode = mode;
  // Switch is synchronous — scene.activeCamera changes immediately
  scene.activeCamera = this.getCameraForMode(mode);
  // No lerp, no animation, no Promise — same frame
}
```

---

## Out of Scope

- FOV recalc on toggle — handled by Story 006 (FOV reads baseFOV from config based on current mode)
- Chase occlusion — works automatically since the target mesh is the same car
- GSM lifecycle (Story 002)
- Camera creation (Story 001)

---

## QA Test Cases

_Written by qa-lead at story creation:_

- **AC-2** (instant toggle):
  - Given: Cockpit camera active (`scene.activeCamera === cockpitCam`), snapshot of active camera
  - When: `toggleCockpitChase()` is called synchronously
  - Then: `scene.activeCamera === chaseCam` immediately (same frame, before next render); no intermediate camera state exists
  - Edge: Toggling while already in chase — switches to cockpit (round-trip); toggling in Grid/Drone mode — no-op, no crash

- **AC-15** (persistence):
  - Given: Chase camera active, `lastToggleChoice === 'chase'`
  - When: GSM transitions PreRace → Racing (simulated via event)
  - Then: `scene.activeCamera === chaseCam` on re-entry to Racing
  - Edge 1: First race entry (no prior toggle) → cockpit (AC-1 default)
  - Edge 2: Toggle during PreRace? (should be ignored — only toggle when Racing camera is active) — verify no crash
  - Edge 3: Memory resets on full session restart (in-memory, not persisted to disk)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/camera/cockpit-chase-toggle_test.ts`

**Status**: [x] Complete

---

## Completion Notes

**Completed**: 2026-06-30
**Criteria**: 3/3 passing (AC-2, AC-15, AC-16)
**Deviations**: None
**Test Evidence**: Unit test at `tests/unit/camera/cockpit-chase-toggle.test.ts` (16 tests)
**Code Review**: Complete — engine specialist CLEAN, QA-testability TESTABLE
**Coverage**: 100% all metrics on camera-manager.ts
**Extra fix**: `_currentMode` assignment order in `setActiveMode()` (pre-existing concern found during code review)

---

## Dependencies

- Depends on: Story 003 (Cockpit functional), Story 004 (Chase functional)
- Unlocks: None
