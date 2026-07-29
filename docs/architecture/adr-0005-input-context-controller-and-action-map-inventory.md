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
- Must route CameraToggle rising edge to Camera via InputEventQueue — dequeued at simulation Step 2, never enters tick pipeline. Holding does not repeat.
- Must support ActiveControlScheme arbitration (KeyboardMouse default, last meaningful device wins; both in same DynamicUpdate preserves current)
- Must trigger EMA reinitialization on active scheme change: `OnActiveSchemeChanged` → EMA state initialized from new scheme's post-dead-zone values
- Must support InputAvailability enum (Available / NoInputDevice) — zeroed SimulationInput with NoInputDevice flag when no device connected
- Replay context (Alpha+): neither action map is enabled. Recorded input only — no live CaptureLatestRawSample

## Decision

Input uses **InputContextController** as the sole owner of action map activation, context transitions, device switch arbitration, and CameraToggle routing. Two fixed action maps defined in a single `.inputactions` asset.

### Key Interfaces

```csharp
// InputContextController — sole authority over action map lifecycle
public class InputContextController {
    public void SetGameplayContext();  // disables UI, enables Gameplay; clears event queue
    public void SetUIContext();        // disables Gameplay, enables UI; clears event queue
    public ControlScheme ActiveScheme { get; }
    public event Action<ControlScheme> OnActiveSchemeChanged;
    public InputEventQueue EventQueue { get; }  // ring buffer (8 entries), drained at tick Step 2
}

// Action map inventory (InputSystem_Actions.inputactions)
// OverdriveGameplay (contexts: GameplayRacing, GameplayQualifying, GameplayCountdown):
//   - Accelerate (Axis, Keyboard: A/D keys or Right Trigger or Right Stick Y+)
//   - Brake (Axis, Keyboard: S or Left Trigger or Left Stick Y+, gamepad South face button)
//   - Steer (Axis, Keyboard: Left/Right arrows, Left Stick X)
//   - Pause (Button, Escape, Start) — RESERVED, not rebindable
//   - CameraToggle (Button, C, gamepad North-Y-Triangle) — presentation-only, no sim tick.
//     Ignored during: PitTransit, InPitBox, Exiting, Finished Presentation, Replay.
//
// OverdriveUI (contexts: UI, PitTransit, PitService, Finished Presentation):
//   - Navigate (Vector2, WASD/Arrows, Left Stick/D-pad)
//   - Point (Vector2, Mouse)
//   - Click (Button, Mouse Left Button)
//   - Confirm (Button, Enter, gamepad South-A) — RESERVED, not rebindable.
//     In Finished Presentation: routed to UI Presentation (skip timer), NOT InputSystemUIInputModule.
//     In PitService: after tire swap eligibility, Confirm triggers early exit (routed to Pit Stop).
//   - Cancel (Button, Escape, gamepad East-B) — RESERVED, not rebindable.
//     Suppressed in PitService (consumer ignores Cancel during active service).
//     Suppressed in Finished Presentation (Escape does nothing during terminal presentation).
//   - Pause (Button, P, gamepad Start) — RESERVED.
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

// InputEventQueue — ring buffer for cross-update event delivery
// Events from InputAction.performed (DynamicUpdate) are enqueued on rising edge.
// Simulation reads and drains at Step 2 (before Step 3 Pause consumption).
// Capacity: 8 entries (sufficient for all human input events per frame).
public class InputEventQueue {
    public void Enqueue(SimulationInputEvent evt);  // called from InputAction.performed callbacks
    public SimulationInputEvent Dequeue();           // called from Simulation driver at Step 2
    public bool TryPeek(out SimulationInputEvent evt);
    public void Clear();                             // on context transition
}

public readonly struct SimulationInputEvent {
    public readonly InputEventType Type;             // Pause, CameraToggle, ConfirmPitExit
    public readonly ulong Timestamp;                 // InputSystem event timestamp
}

public enum InputEventType : byte {
    Pause,
    CameraToggle,
    ConfirmPitExit,
    SettingsOpen,
    SettingsClose
}

// CameraToggle — presentation-only, no simulation involvement
// Rising edge from InputAction.performed in DynamicUpdate enqueues CameraToggle event.
// Simulation Step 2 dequeues it and routes directly to Camera (no tick pipeline entry).
// Holding does not repeat. One toggle per button press.
// The event queue ensures CameraToggle is never lost between DynamicUpdate and the tick.
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
- **CameraToggle isolation:** Never enters sim pipeline — no ghost recording, no replay contamination.
- **Event queue guarantees:** Input events captured in DynamicUpdate survive to the next tick boundary — no lost edges between update phases.

### ResolvedCarInput Timing

`ResolvedCarInput[carId]` is produced by the Simulation driver at Step 14 of the tick pipeline (after AI produces AIInput). This output feeds into the NEXT tick's `TickStartSnapshot` assembly (Step 1). Consumers (FuelSystem Step 5a, TireSystem Step 5b, VehiclePhysics Step 6) read the value at their pipeline step on the following tick. This is the canonical 1-tick latency: AI decision at tick N → physics effect at tick N+1.

For the player car, `SimulationInput` from InputSystem capture is placed directly into ResolvedCarInput at Step 14 — no AI input involvement. For AI cars, `AIInput` from AiRivalSystem (Step 13) is merged into ResolvedCarInput at Step 14.

### Negative

- **Action map generation dependency:** C# class from .inputactions asset must be regenerated when actions change. Generated code is not hand-editable.
- **UI module coupling:** `InputSystemUIInputModule` must reference OverdriveUI actions. Changes to UI action structure require updating the UI module reference.

### Risks

- **Same-frame device arbitration:** If both KeyboardMouse and Gamepad produce events in one DynamicUpdate, current scheme must not oscillate. Mitigation: InputContextController preserves current scheme on same-frame ambiguity.
- **Latching edge case:** If a digital action is released during the same frame as the context transition, the latch may not trigger. Mitigation: latch evaluates on the frame AFTER the transition is committed, not during.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| input-system.md | 2 action maps (OverdriveGameplay + OverdriveUI) | ADR-0005 defines exact action inventory per map and C# contract |
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
