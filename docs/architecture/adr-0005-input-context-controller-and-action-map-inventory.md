# ADR-0005: Input Context Controller and Action Map Inventory

## Status

Accepted

## Date

2026-07-27

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Input |
| **Knowledge Risk** | MEDIUM — Input System 1.19.0 is post-LLM-cutoff. Core APIs (InputActionAsset, InputActionMap, InputAction) confirmed stable. |
| **References Consulted** | `docs/engine-reference/unity/modules/input.md`, `docs/engine-reference/unity/VERSION.md`, `design/gdd/input-system.md`, `docs/architecture/architecture.md` |
| **Post-Cutoff APIs Used** | `InputSettings.UpdateMode` enum renamed: `ProcessEventsInDynamicUpdate` (was `Dynamic`), `ProcessEventsInFixedUpdate` (was `FixedUpdate`). Verified in Input System 1.19.0 runtime — confirmed current. |
| **Verification Required** | Context handoff latching (held inputs across transition), device switch arbitration (same-frame both schemes) |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (SimulationInput pipeline, tick boundary capture). ADR-0004 (ControlProfile for dead zones and EMA alphas) |
| **Enables** | All gameplay systems that consume SimulationInput. UI Menu navigation routing. CameraToggle presentation-only path |
| **Blocks** | Input implementation |
| **Ordering Note** | InputSystem_Actions.inputactions asset must be created in Unity Editor before C# generation |

## Context

### Problem Statement

Overdrive has two mutually exclusive input contexts: gameplay (racing, qualifying, countdown) and UI (menus, pause, pit service). Each context has its own action map with different bindings and behaviors. The InputContextController must be the sole authority over which action map is active, how devices switch, how pending edges are cleared on context transitions, and how reserved bindings (Pause, Confirm, Cancel) cannot be remapped.

### Constraints

- Input System 1.19.0 installed. .inputactions asset with C# generated class pattern.
- Two action maps: `OverdriveGameplay` (5 actions) and `OverdriveUI` (6 actions). Exactly one active at any time.
- Pause (Escape/Start) is fixed and reserved across ALL contexts — cannot be remapped, replaced, or removed.
- Confirm (Enter/South) and Cancel (Escape/East) are reserved in all UI contexts.
- CameraToggle is presentation-only — never enters SimulationInput, tick pipeline, Replay, or Ghost Recording.
- KeyboardMouse is default device on desktop. Gamepad becomes active on first meaningful input.
- No fixed update mode: Input System processes events in DynamicUpdate.

### Requirements

- Must disable one action map before enabling the other (no overlapping bindings)
- Must clear pending pauseEdge on Gameplay→UI transition
- Must latch every newly enabled digital action and UI Navigate control actuated at transition until neutral/released (prevents Pause→Cancel, held Confirm firing in new context)
- Must exempt Accelerate, Brake, Steer from latching on UI→Gameplay resume (EMA initializes from current post-dead-zone values)
- Must route CameraToggle rising edge to Camera directly (via InputAction.performed callback → Camera.ToggleRequest). Never enters tick pipeline, Replay, or Ghost Recording. Holding does not repeat.
- Must support ActiveControlScheme arbitration (KeyboardMouse default, last meaningful device wins; both in same DynamicUpdate preserves current)
- Must trigger EMA reinitialization on active scheme change: `OnActiveSchemeChanged` → EMA state initialized from new scheme's post-dead-zone values
- Must support InputAvailability enum (Available / NoInputDevice) — zeroed SimulationInput with NoInputDevice flag when no device connected
- Must enforce brake priority: when rawBrakePostDeadZone > 0, accelerateOut = 0 and Accelerate EMA is frozen (standard racing convention)
- Replay context (Alpha+): neither action map is enabled. Recorded input only — no live CaptureLatestRawSample

## Decision

Input uses **InputContextController** as the sole owner of action map activation, context transitions, device switch arbitration, and CameraToggle routing. Two fixed action maps defined in a single `.inputactions` asset.

### Key Interfaces

```csharp
// InputContextController — sole authority over action map lifecycle
public class InputContextController {
    public void SetGameplayContext();  // disables UI, enables Gameplay
    public void SetUIContext();        // disables Gameplay, enables UI
    public ControlScheme ActiveScheme { get; }
    public event Action<ControlScheme> OnActiveSchemeChanged;
}

// Action map inventory (names and routing rules — contract reference)
// Default physical bindings and remappable binding slots are authoritative ONLY in
// design/gdd/input-system.md (Core Rule 1); the story-001 tests verify the asset against
// the GDD. Duplicating binding values in the ADR caused drift (2026-08-07 amend — the ADR
// previously cited Steer's keys for Accelerate and the UI Confirm button for Brake).
// OverdriveGameplay (contexts: GameplayRacing, GameplayQualifying, GameplayCountdown):
//   Accelerate, Brake, Steer — analog (see GDD Core Rule 1 for exact controls)
//   Pause (Button) — RESERVED, not rebindable
//   CameraToggle (Button) — presentation-only, no sim tick; Gameplay-map-only (cannot fire
//     in UI/Pit/Replay contexts because its map is disabled there)
// OverdriveUI (contexts: UI, PitTransit, PitService; Finished Presentation is a UI-context sub-state):
//   Navigate, Point, Click
//   Confirm (Button) — RESERVED, not rebindable.
//     In Finished Presentation: routed to UI Presentation (skip timer), NOT InputSystemUIInputModule.
//     In PitService: after tire swap eligibility, Confirm triggers early exit (routed to Pit Stop).
//   Cancel (Button) — RESERVED, not rebindable.
//     Suppressed in PitService (consumer ignores Cancel during active service).
//     Suppressed in Finished Presentation (Escape does nothing during terminal presentation).
//   Pause (Button) — RESERVED.
//     Finished Presentation only. Routed to UI Presentation (pause terminal timer).
//     Not bound to Escape — OverdriveUI.Cancel covers Escape.
//     Not active during Racing/Qualifying/Countdown — OverdriveGameplay.Pause covers those.

// Context handoff contract
// HasPendingPause is meaningful only on Gameplay→UI transitions (the Pause that triggered it).
// On UI→Gameplay transitions, HasPendingPause is always false (the pause was consumed by the
// originating Gameplay→UI transition).
public readonly struct InputContextTransition {
    public readonly InputContext From, To;  // Gameplay → UI or UI → Gameplay
    public readonly bool HasPendingPause;   // cleared on Gameplay→UI
    // Latching: every digital action actuated at transition is consumed once, then ignored
    // until neutral and re-actuated
}

// CameraToggle — presentation-only, no simulation involvement
// Rising edge from InputAction.performed in DynamicUpdate routes DIRECTLY to Camera
// (Camera.ToggleRequest), same-frame. No queue, no tick pipeline involvement.
// Holding does not repeat. One toggle per button press.
```

### Context Transition Rules

```
Gameplay → UI:
  - Clear pending pauseEdge (consumed by the Pause that triggered the transition)
  - Every digital action and UI Navigate control actuated at transition is latched
    until neutral/released. This prevents:
    - Pause button still held → Cancel in pause menu
    - Confirm still held from previous context → fires in UI
    - Navigate still held → skips UI elements
  - Accelerate/Brake/Steer: normalize to 0 (gameplay no longer processes them)

UI → Gameplay:
  - Accelerate, Brake, Steer applied immediately (not latched):
    EMA initializes from current post-dead-zone values.
    Player pressing throttle during Pause → car accelerates on Resume.
  - All other digital actions latched as above
  - Pause remains consumed (not a new Pause event)
```

### Input Sanitization

Raw input channels (accelerate, brake, steer) are validated after dead-zone normalization and before EMA smoothing:

- NaN or Infinity → replaced by 0.0f
- Values outside [-1.0, 1.0] → clamped to [-1.0, 1.0]

This prevents erratic behavior from hardware defects or driver bugs (USB glitch, faulty stick, driver crash). Affects: all consumers of SimulationInput. Cost: 3 lines of validation per channel (negligible).

## Alternatives Considered

### Alternative 1: Single Action Map with Per-Action Enable/Disable

- **Description:** One action map with all actions. Enable/disable individual actions based on context.
- **Pros:** Single map. No context transitions.
- **Cons:** InputSystemUIInputModule requires separate action references for UI Submit/Cancel. Cannot coexist with gameplay actions in same map without binding conflicts. No clean latching boundary.
- **Rejection Reason:** Two maps provide clean isolation. UI module references OverdriveUI actions directly; gameplay code references OverdriveGameplay. No merge logic needed.

### Alternative 2: No Central Controller

- **Description:** Each system manages its own input subscriptions. Multiple MonoBehaviours listen to input events independently.
- **Pros:** Simple at individual system level.
- **Cons:** No authority over context transitions. Pause could fire twice (once in gameplay, once in UI). No coordinated latching. Device switch ambiguity.
- **Rejection Reason:** The GDD explicitly requires InputContextController as sole owner. Without central authority, reserved binding enforcement and context handoff latching cannot be guaranteed.

## Consequences

### Positive

- **Clean action map isolation:** Gameplay actions never fire during UI and vice versa.
- **No binding collisions:** `InputSystemUIInputModule` references OverdriveUI actions; gameplay code references OverdriveGameplay. Same key (Escape) can mean Pause in gameplay and Cancel in UI.
- **Context handoff correctness:** Latching prevents phantom inputs. Accelerate/Brake immediate on Resume matches player expectation.
- **Reserved binding enforcement:** InputContextController owns the allowlist of rebindable actions. Confirm/Cancel/Pause are not in the rebindable set.
- **CameraToggle isolation:** Never enters sim pipeline — no ghost recording, no replay contamination. Rising edge routes directly to Camera in the same frame.

### Single Frame-Level Capture

`CaptureLatestRawSample()` runs exactly once per render frame, before accumulator evaluation (ADR-0001:44). The captured raw sample is passed to input processing at Step 2 of the current tick and is **not** stored in TickStartSnapshot — it applies to the current tick only.

### ResolvedCarInput Timing

`ResolvedCarInput[carId]` is assembled by the Simulation driver each tick from two sources (ADR-0001:41-46):

- **Player car:** the frame-level raw sample captured by `CaptureLatestRawSample()` is processed at Step 2 (dead zone → EMA → SimulationInput, per ADR-0004) and applies to the **current** tick — zero-tick player-input latency. It is not stored in TickStartSnapshot.
- **AI cars:** `AIInput` from AiRivalSystem (Step 13) is merged into ResolvedCarInput at Step 14 and feeds the NEXT tick's `TickStartSnapshot` assembly (Step 1). This is the canonical 1-tick latency: AI decision at tick N → physics effect at tick N+1 (ADR-0009:85).

Consumers (FuelSystem Step 5a, TireSystem Step 5b, VehiclePhysics Step 6) read the player's current-tick SimulationInput and the AI's cached AIInput at their pipeline step.

### Negative

- **Action map generation dependency:** C# class from .inputactions asset must be regenerated when actions change. Generated code is not hand-editable.
- **UI module coupling:** `InputSystemUIInputModule` must reference OverdriveUI actions. Changes to UI action structure require updating the UI module reference.

### Risks

- **Same-frame device arbitration:** If both KeyboardMouse and Gamepad produce events in one DynamicUpdate, current scheme must not oscillate. Mitigation: InputContextController preserves current scheme on same-frame ambiguity.
- **Latching edge case:** If a digital action is released during the same frame as the context transition, the latch may not trigger. Mitigation: latch evaluates on the frame AFTER the transition is committed, not during.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| input-system.md | 2 action maps (OverdriveGameplay + OverdriveUI) | ADR-0005 defines map/action structure and C# contract; binding values owned by GDD Core Rule 1 |
| input-system.md | InputContextController as sole owner | InputContextController.SetGameplayContext() / SetUIContext() |
| input-system.md | Context handoff latching | InputContextTransition + latch rules per direction |
| input-system.md | CameraToggle presentation-only | Routes via InputAction.performed directly to Camera, no SimulationInput |
| input-system.md | Pause reserved across all contexts | Not in rebindable set. Fixed in .inputactions asset |
| input-system.md | Device switch arbitration | ActiveControlScheme: KeyboardMouse default, last meaningful device wins |
| input-system.md | Binding IDs stable after first shipped schema | BindingOverride.ActionId/BindingId as Guid (from ADR-0004) |
| settings.md | 4 rebindable actions (Accelerate, Brake, Steer, CameraToggle) | InputContextController exposes allowlist; Confirm/Cancel/Pause excluded |
| ui-menu.md | UI navigation via OverdriveUI action map | InputSystemUIInputModule references OverdriveUI.Confirm/Cancel/Navigate |
| simulation-architecture.md | CaptureLatestRawSample() called 1x/frame before accumulator | InputContextController integrates with Simulation driver per ADR-0001 |

## Validation Criteria

- [ ] Gameplay→UI transition: Pause held at transition does NOT fire Cancel in pause menu
- [ ] UI→Gameplay transition: held Accelerate applies immediately (no dead frame)
- [ ] CameraToggle during race: one toggle per press, never enters Ghost Recording or tick pipeline
- [ ] No device: `SimulationInput.inputAvailability == NoInputDevice`, zeroed values
- [ ] Gamepad connect mid-game: active scheme switches to Gamepad, prompt glyphs update
- [ ] Reserved binding: Listening capture of Pause key → rejected immediately (from ADR-0004)
- [ ] Same-frame both devices: scheme does not oscillate

## Related Decisions

- ADR-0001: Manual Simulation Authority (CaptureLatestRawSample, tick pipeline, Pause as lifecycle edge)
- ADR-0004: Settings Persistence (ControlProfile, BindingOverride, rebindable action allowlist)
