using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.Controls;
using UnityEngine.InputSystem.UI;

namespace Overdrive.Input
{
    /// <summary>Identifies the action-map context owned by the input controller.</summary>
    public enum InputContextKind
    {
        /// <summary>No action map is active.</summary>
        None,

        /// <summary>The gameplay action map is active.</summary>
        Gameplay,

        /// <summary>The UI action map and UI input module are active.</summary>
        UI
    }

    /// <summary>Identifies the direct-routing mode for special input destinations (Story 007).</summary>
    public enum RoutingMode
    {
        /// <summary>Normal UI/menu routing: the UI module is active and Submit/Cancel/Pause route normally.</summary>
        Normal,

        /// <summary>Finished Presentation: Confirm + UI Pause route to UI Presentation, Cancel is suppressed, the UI module is disabled.</summary>
        FinishedPresentation,

        /// <summary>PitService: Confirm routes directly to Pit Stop, Cancel is suppressed, the UI module is disabled.</summary>
        PitService,

        /// <summary>PitTransit: all UI actions are ignored, the UI module is disabled.</summary>
        PitTransit
    }

    /// <summary>
    /// Owns activation of Overdrive's gameplay and UI action maps.
    /// Example: construct it with a generated <see cref="InputSystem_Actions"/> and call
    /// <see cref="SetGameplayContext"/> or <see cref="SetUIContext"/> at lifecycle boundaries.
    /// </summary>
    public sealed class InputContextController
    {
        private static readonly List<InputAction> EnabledActionsScratch = new List<InputAction>();

        private readonly InputSystem_Actions _asset;
        private readonly InputSystemUIInputModule _uiModule;
        private readonly InputActionReference _submitReference;
        private readonly InputActionReference _cancelReference;
        private readonly InputActionReference _moveReference;
        private readonly InputActionReference _pointReference;
        private readonly InputActionReference _leftClickReference;
        private readonly HashSet<InputAction> _latchedActions = new();

        private bool _pendingPauseEdge;
        private ulong _captureSequence;
        private double _latchTime;
        private ControlScheme _activeScheme = ControlScheme.KeyboardMouse;
        private bool _keyboardMeaningful;
        private bool _gamepadMeaningful;
        private InputAvailability _lastAvailability = InputAvailability.NoInputDevice;
        private RoutingMode _routingMode = RoutingMode.Normal;
        private bool _pointerVisible = true;

        /// <summary>Pointer movement (px) in one update that counts as meaningful keyboard/mouse input.</summary>
        private const float PointerMeaningfulDeltaPixels = 2f;

        /// <summary>Gets the currently selected context.</summary>
        public InputContextKind CurrentContext { get; private set; }

        /// <summary>
        /// Raised when the active context transitions (None/Gameplay/UI). Consumers that re-seed
        /// state on UI→Gameplay resume (the context-resume EMA reinitializer) observe this. Raised
        /// only on an ACTUAL context change — a same-context call (e.g. Countdown→Racing, both
        /// Gameplay) does not fire, so EMA state is preserved across Gameplay sub-states.
        /// </summary>
        public event Action<InputContextKind> OnContextChanged;

        /// <summary>Gets the currently active input device scheme (defaults to KeyboardMouse).</summary>
        public ControlScheme ActiveScheme => _activeScheme;

        /// <summary>Raised when the active scheme changes; prompt glyphs and pointer policy observe this.</summary>
        public event Action<ControlScheme> OnActiveSchemeChanged;

        /// <summary>
        /// Raised when input availability transitions (e.g. NoInputDevice → Available on device
        /// reconnect). Consumers that re-seed state on device recovery (the scheme-change EMA
        /// reinitializer) observe this — a same-scheme reconnect emits no scheme change. Note:
        /// the first capture after construction fires a synthetic transition from the initial
        /// NoInputDevice default even if devices are already present; consumers must treat it as
        /// a first-frame priming signal, not a device-recovery event.
        /// </summary>
        public event Action<InputAvailability> OnAvailabilityChanged;

        /// <summary>Raised when the gameplay camera-toggle action is performed.</summary>
        public event Action OnCameraToggleRequested;

        /// <summary>Gets the current direct-routing mode for special input destinations (Story 007).</summary>
        public RoutingMode CurrentRoutingMode => _routingMode;

        /// <summary>Gets whether the UI pointer is visible (mouse is UI-only, Story 007 AC-36/48).</summary>
        public bool PointerVisible => _pointerVisible;

        /// <summary>Raised when the UI pointer visibility changes (Story 007 AC-36/48).</summary>
        public event Action<bool> OnPointerVisibilityChanged;

        /// <summary>Raised when Confirm is performed during Finished Presentation (routes to UI Presentation, Story 007 AC-54).</summary>
        public event Action OnFinishedConfirmRequested;

        /// <summary>Raised when UI Pause is performed during Finished Presentation (toggles the terminal timer, Story 007 AC-57).</summary>
        public event Action OnFinishedPauseRequested;

        /// <summary>Raised when Confirm is performed during PitService (routes to Pit Stop, Story 007 AC-52/64).</summary>
        public event Action OnPitServiceConfirmRequested;

        /// <summary>Gets the number of direct Confirm requests routed during Finished Presentation.</summary>
        public int FinishedConfirmCount { get; private set; }

        /// <summary>Gets the number of UI Pause requests routed during Finished Presentation.</summary>
        public int FinishedPauseCount { get; private set; }

        /// <summary>Gets the number of direct Confirm requests routed during PitService.</summary>
        public int PitServiceConfirmCount { get; private set; }

        /// <summary>Gets the number of UI submit actions performed.</summary>
        public int SubmitCount { get; private set; }

        /// <summary>Gets the number of UI cancel actions performed.</summary>
        public int CancelCount { get; private set; }

        /// <summary>Gets the total gameplay edge count.</summary>
        public int GameplayEdgeCount { get; private set; }

        /// <summary>Gets the number of gameplay pause edges.</summary>
        public int PauseEdgeCount { get; private set; }

        /// <summary>Gets the number of gameplay camera-toggle actions performed.</summary>
        public int CameraToggleCount { get; private set; }

        /// <summary>Gets the number of gameplay value actions performed.</summary>
        public int GameplayValueEventCount { get; private set; }

        /// <summary>Gets the number of UI pause actions performed.</summary>
        public int UiPauseCount { get; private set; }

        /// <summary>Gets the number of raw samples captured.</summary>
        public int CaptureCount { get; private set; }

        /// <summary>Gets whether a Pause edge is pending capture (latched; not yet consumed).</summary>
        public bool HasPendingPauseEdge => _pendingPauseEdge;

        /// <summary>
        /// Creates a controller and wires the supplied generated asset to the UI module.
        /// Example: <c>new InputContextController(actions, uiModule)</c>.
        /// </summary>
        public InputContextController(InputSystem_Actions asset, InputSystemUIInputModule uiModule)
        {
            _asset = asset ?? throw new ArgumentNullException(nameof(asset));
            _uiModule = uiModule ?? throw new ArgumentNullException(nameof(uiModule));

            _asset.Gameplay.Pause.performed += OnGameplayPause;
            _asset.Gameplay.Pause.canceled += OnGameplayPause;
            _asset.Gameplay.CameraToggle.performed += OnCameraToggle;
            _asset.Gameplay.CameraToggle.canceled += OnCameraToggle;
            _asset.Gameplay.Accelerate.performed += OnGameplayValue;
            _asset.Gameplay.Brake.performed += OnGameplayValue;
            _asset.Gameplay.Steer.performed += OnGameplayValue;
            _asset.UI.Confirm.performed += OnSubmit;
            _asset.UI.Confirm.canceled += OnSubmit;
            _asset.UI.Cancel.performed += OnCancel;
            _asset.UI.Cancel.canceled += OnCancel;
            _asset.UI.Pause.performed += OnUiPause;
            _asset.UI.Pause.canceled += OnUiPause;
            _asset.UI.Navigate.performed += OnNavigate;
            _asset.UI.Navigate.canceled += OnNavigate;
            _asset.UI.Click.performed += OnClick;

            _uiModule.actionsAsset = _asset.asset;
            _submitReference = InputActionReference.Create(_asset.UI.Confirm);
            _cancelReference = InputActionReference.Create(_asset.UI.Cancel);
            _moveReference = InputActionReference.Create(_asset.UI.Navigate);
            _pointReference = InputActionReference.Create(_asset.UI.Point);
            _leftClickReference = InputActionReference.Create(_asset.UI.Click);
            _uiModule.submit = _submitReference;
            _uiModule.cancel = _cancelReference;
            _uiModule.move = _moveReference;
            _uiModule.point = _pointReference;
            _uiModule.leftClick = _leftClickReference;

            _asset.Gameplay.Disable();
            _asset.UI.Disable();
            _uiModule.enabled = false;
            CurrentContext = InputContextKind.None;
            EnforceGlobalSoleOwnership();
        }

        /// <summary>Disables UI and enables the gameplay action map.</summary>
        public void SetGameplayContext()
        {
            _routingMode = RoutingMode.Normal;
            _uiModule.enabled = false;
            _asset.UI.Disable();
            // Latch only on an actual transition (ADR-0005: latch on Gameplay↔UI change). A
            // same-context call (e.g. Countdown→Racing, both Gameplay) must not create latches.
            if (CurrentContext != InputContextKind.Gameplay)
            {
                // ADR-0005 context handoff: latch every newly enabled digital gameplay action
                // actuated at the transition until neutral/released (Pause, CameraToggle).
                // Accelerate/Brake/Steer are exempt (analog, AC-41). The latch evaluates here
                // (before enable), and the engine's deferred initial-state check runs on the next
                // InputSystem.Update — the frame AFTER the transition — satisfying ADR-0005:191.
                LatchActuatedGameplayActions();
            }

            _asset.Gameplay.Enable();
            SetContext(InputContextKind.Gameplay);
            EnforceGlobalSoleOwnership();
        }

        /// <summary>Disables gameplay and enables the UI action map and module.</summary>
        public void SetUIContext()
        {
            _routingMode = RoutingMode.Normal;
            // ADR-0005:119 — the pending Pause edge is consumed by the transition that triggered it.
            _pendingPauseEdge = false;
            _asset.Gameplay.Disable();
            if (CurrentContext != InputContextKind.UI)
            {
                // Latch UI digital actions + Navigate actuated at the transition (prevents held
                // Escape → Cancel in the pause menu, held Confirm, held Navigate skipping UI elements).
                LatchActuatedUiActions();
            }

            _asset.UI.Enable();
            _uiModule.enabled = true;
            SetContext(InputContextKind.UI);
            EnforceGlobalSoleOwnership();
        }

        /// <summary>
        /// Disables both action maps and the UI module (no input routing). Used for loading-blocked
        /// transitions: Input stays in <see cref="InputContextKind.None"/> while content loads and
        /// routes nothing; gameplay becomes active only after Simulation accepts RaceLoadReady.
        /// </summary>
        public void SetBlockedContext()
        {
            // ADR-0005: any pending Pause edge is consumed by the transition that triggered it.
            _pendingPauseEdge = false;
            _routingMode = RoutingMode.Normal;
            _asset.Gameplay.Disable();
            _asset.UI.Disable();
            _uiModule.enabled = false;
            SetContext(InputContextKind.None);
            EnforceGlobalSoleOwnership();
        }

        /// <summary>
        /// Enters the Finished Presentation routing mode (ADR-0019): the UI map is enabled so the
        /// direct-routing callbacks fire, but the UI module is disabled. Confirm and UI Pause route
        /// directly to UI Presentation; Cancel is suppressed. Used while <c>SimulationState.Finished</c>.
        /// </summary>
        public void SetFinishedPresentationContext()
        {
            _pendingPauseEdge = false;
            _routingMode = RoutingMode.FinishedPresentation;
            _asset.Gameplay.Disable();
            if (CurrentContext != InputContextKind.UI)
            {
                // Latch UI digital actions + Navigate actuated at the transition (prevents a held
                // Confirm from immediately dismissing the presentation, a held Pause toggling the
                // timer, a held Cancel/arrow leaking — same rule as SetUIContext, Story 006 AC-53).
                // Defense-in-depth: a held Button does not re-fire 'performed' on action-map enable
                // (no initial-state check), so the no-repeat behavior is the real protection and the
                // latch guards the engine edge where a performed arrives with a pre-transition startTime.
                LatchActuatedUiActions();
            }

            _asset.UI.Enable();
            _uiModule.enabled = false;
            SetContext(InputContextKind.UI);
            EnforceGlobalSoleOwnership();
        }

        /// <summary>
        /// Enters the PitService routing mode (ADR-0005/GDD): the UI map is enabled so Confirm routes
        /// directly to Pit Stop, but the UI module is disabled. Cancel is suppressed. Tire-swap
        /// eligibility is owned by the Pit Stop consumer, which receives the unconditional
        /// <see cref="OnPitServiceConfirmRequested"/> event and decides whether to exit.
        /// </summary>
        public void SetPitServiceContext()
        {
            _pendingPauseEdge = false;
            _routingMode = RoutingMode.PitService;
            _asset.Gameplay.Disable();
            if (CurrentContext != InputContextKind.UI)
            {
                // Latch UI digital actions actuated at the transition (a held Confirm must not
                // route to Pit Stop until release+repress, Story 007 AC-64).
                LatchActuatedUiActions();
            }

            _asset.UI.Enable();
            _uiModule.enabled = false;
            SetContext(InputContextKind.UI);
            EnforceGlobalSoleOwnership();
        }

        /// <summary>
        /// Enters the PitTransit routing mode (ADR-0005): the UI map is enabled so the controller
        /// receives callbacks (latch detection, meaningful-event flags), but all UI actions are
        /// suppressed and the UI module is disabled. No navigation/Submit/Cancel/gameplay event is
        /// emitted. The gameplay map stays disabled (no driving input).
        /// </summary>
        public void SetPitTransitContext()
        {
            _pendingPauseEdge = false;
            _routingMode = RoutingMode.PitTransit;
            _asset.Gameplay.Disable();
            if (CurrentContext != InputContextKind.UI)
            {
                // Latch UI digital actions actuated at the transition (held input across entry into
                // the blocked mode must not emit anything, Story 007 AC-65).
                LatchActuatedUiActions();
            }

            _asset.UI.Enable();
            _uiModule.enabled = false;
            SetContext(InputContextKind.UI);
            EnforceGlobalSoleOwnership();
        }

        /// <summary>Commits a context change, raising <see cref="OnContextChanged"/> only on an actual change.</summary>
        private void SetContext(InputContextKind context)
        {
            InputContextKind previous = CurrentContext;
            CurrentContext = context;
            if (previous != context)
            {
                OnContextChanged?.Invoke(context);
            }
        }

        /// <summary>Unsubscribes observers, destroys created references, and clears the UI module for test teardown.</summary>
        public void Unbind()
        {
            _asset.Gameplay.Pause.performed -= OnGameplayPause;
            _asset.Gameplay.Pause.canceled -= OnGameplayPause;
            _asset.Gameplay.CameraToggle.performed -= OnCameraToggle;
            _asset.Gameplay.CameraToggle.canceled -= OnCameraToggle;
            _asset.Gameplay.Accelerate.performed -= OnGameplayValue;
            _asset.Gameplay.Brake.performed -= OnGameplayValue;
            _asset.Gameplay.Steer.performed -= OnGameplayValue;
            _asset.UI.Confirm.performed -= OnSubmit;
            _asset.UI.Confirm.canceled -= OnSubmit;
            _asset.UI.Cancel.performed -= OnCancel;
            _asset.UI.Cancel.canceled -= OnCancel;
            _asset.UI.Pause.performed -= OnUiPause;
            _asset.UI.Pause.canceled -= OnUiPause;
            _asset.UI.Navigate.performed -= OnNavigate;
            _asset.UI.Navigate.canceled -= OnNavigate;
            _asset.UI.Click.performed -= OnClick;
            _latchedActions.Clear();
            _asset.Gameplay.Disable();
            _asset.UI.Disable();
            _uiModule.enabled = false;
            _uiModule.submit = null;
            _uiModule.cancel = null;
            _uiModule.move = null;
            _uiModule.point = null;
            _uiModule.leftClick = null;
            _uiModule.actionsAsset = null;
            UnityEngine.Object.Destroy(_submitReference);
            UnityEngine.Object.Destroy(_cancelReference);
            UnityEngine.Object.Destroy(_moveReference);
            UnityEngine.Object.Destroy(_pointReference);
            UnityEngine.Object.Destroy(_leftClickReference);
            _routingMode = RoutingMode.Normal;
            _pointerVisible = true;
            CurrentContext = InputContextKind.None;
        }

        /// <summary>
        /// Captures an immutable raw sample of the current gameplay input. Call exactly once per
        /// render frame at the start of Simulation's Update, before accumulator evaluation.
        /// </summary>
        public RawInputSample CaptureLatestRawSample()
        {
            InputAvailability availability = IsAnySchemeEligible()
                ? InputAvailability.Available
                : InputAvailability.NoInputDevice;

            // Availability-transition notification: consumers that re-seed state on device recovery
            // (e.g. the scheme-change EMA reinitializer) observe this. A pending Pause edge produced
            // before a disconnect is intentionally NOT cleared here — the tick processor's caller
            // decides whether to act on it alongside NoInputDevice availability.
            if (availability != _lastAvailability)
            {
                _lastAvailability = availability;
                OnAvailabilityChanged?.Invoke(availability);
            }

            _captureSequence++;
            CaptureCount++;
            return ReadSample(_captureSequence, availability);
        }

        /// <summary>
        /// Reads the current raw channels without producing a capture sample (no sequence/count side
        /// effects). Used by the scheme-change EMA reinitializer, which needs the new scheme's raw
        /// values but must not consume a driver capture slot (AC-59: one capture per frame).
        /// </summary>
        public RawInputSample PeekLatestRawSample()
        {
            InputAvailability availability = IsAnySchemeEligible()
                ? InputAvailability.Available
                : InputAvailability.NoInputDevice;
            return ReadSample(_captureSequence, availability);
        }

        private RawInputSample ReadSample(ulong sequence, InputAvailability availability)
        {
            ReadChannels(_activeScheme, out float accelerate, out float brake, out float steer);
            RawInputValidityFlags validity = ComputeValidityFlags(accelerate, brake, steer);
            return new RawInputSample(
                sequence,
                _activeScheme,
                accelerate,
                brake,
                steer,
                _pendingPauseEdge,
                availability,
                validity);
        }

        private void ReadChannels(ControlScheme scheme, out float accelerate, out float brake, out float steer)
        {
            if (scheme == ControlScheme.Gamepad)
            {
                accelerate = ReadGamepadAxis(_asset.Gameplay.Accelerate);
                brake = ReadGamepadAxis(_asset.Gameplay.Brake);
                steer = ReadGamepadAxis(_asset.Gameplay.Steer);
                return;
            }

            accelerate = _asset.Gameplay.Accelerate.ReadValue<float>();
            brake = _asset.Gameplay.Brake.ReadValue<float>();
            steer = _asset.Gameplay.Steer.ReadValue<float>();
        }

        private static RawInputValidityFlags ComputeValidityFlags(float accelerate, float brake, float steer)
        {
            RawInputValidityFlags validity = RawInputValidityFlags.None;
            if (!float.IsFinite(accelerate))
            {
                validity |= RawInputValidityFlags.AccelerateNonFinite;
            }

            if (!float.IsFinite(brake))
            {
                validity |= RawInputValidityFlags.BrakeNonFinite;
            }

            if (!float.IsFinite(steer))
            {
                validity |= RawInputValidityFlags.SteerNonFinite;
            }

            return validity;
        }

        /// <summary>Clears the latched Pause edge once its consumer has read it (Story 004).</summary>
        public void ConsumePendingPauseEdge()
        {
            _pendingPauseEdge = false;
        }

        /// <summary>
        /// Resolves the active input-device scheme for this Dynamic Update. Call once per render
        /// frame BEFORE <see cref="CaptureLatestRawSample"/> (explicit call order — the Simulation
        /// driver owns it, not Unity script execution order). Collects meaningful-event flags from
        /// the update's processed actions plus the current analog and pointer values, then applies
        /// ADR-0005 arbitration: KeyboardMouse default, last meaningful device wins, both meaningful
        /// in one update preserves the current scheme (anti-oscillation), and a scheme that lost its
        /// device loses arbitration (eligibility wins). Clears the pending Pause edge and raises
        /// <see cref="OnActiveSchemeChanged"/> only on an actual change.
        /// </summary>
        public ControlScheme ResolveActiveScheme()
        {
            bool keyboardEligible = Keyboard.current != null || Mouse.current != null;
            bool gamepadEligible = Gamepad.current != null;

            bool pointerMeaningful = IsKeyboardPointerMeaningful();
            if (pointerMeaningful)
            {
                // A pointer delta >= 2 px makes the pointer visible and counts as keyboard/mouse
                // meaningful → the KeyboardMouse scheme becomes active (Story 007 AC-48).
                ShowPointer();
            }

            bool keyboardMeaningful = _keyboardMeaningful || pointerMeaningful;
            bool gamepadMeaningful = _gamepadMeaningful || IsGamepadAnalogMeaningful();

            _keyboardMeaningful = false;
            _gamepadMeaningful = false;

            // Device-loss precedence (AC-62): a scheme that lost its device cannot be preserved,
            // regardless of anti-oscillation.
            if ((_activeScheme == ControlScheme.Gamepad && !gamepadEligible) ||
                (_activeScheme == ControlScheme.KeyboardMouse && !keyboardEligible))
            {
                if (keyboardEligible)
                {
                    return SetActiveScheme(ControlScheme.KeyboardMouse);
                }

                if (gamepadEligible)
                {
                    return SetActiveScheme(ControlScheme.Gamepad);
                }

                return _activeScheme;
            }

            // Anti-oscillation (AC-62): both schemes meaningful this update → keep the current.
            if (keyboardMeaningful && gamepadMeaningful)
            {
                return _activeScheme;
            }

            if (gamepadMeaningful)
            {
                return SetActiveScheme(ControlScheme.Gamepad);
            }

            if (keyboardMeaningful)
            {
                return SetActiveScheme(ControlScheme.KeyboardMouse);
            }

            return _activeScheme;
        }

        private ControlScheme SetActiveScheme(ControlScheme scheme)
        {
            if (scheme == _activeScheme)
            {
                return scheme;
            }

            _activeScheme = scheme;
            // AC-40: a pending Pause edge is consumed by the scheme change that triggered it.
            _pendingPauseEdge = false;
            OnActiveSchemeChanged?.Invoke(scheme);
            return scheme;
        }

        private static bool IsAnySchemeEligible()
        {
            return (Keyboard.current != null || Mouse.current != null) || Gamepad.current != null;
        }

        private bool IsKeyboardPointerMeaningful()
        {
            return Mouse.current != null && Mouse.current.delta.magnitude >= PointerMeaningfulDeltaPixels;
        }

        private bool IsGamepadAnalogMeaningful()
        {
            if (Gamepad.current == null)
            {
                return false;
            }

            float accelerate = ReadGamepadAxis(_asset.Gameplay.Accelerate);
            float brake = ReadGamepadAxis(_asset.Gameplay.Brake);
            if (accelerate > DeadZoneNormalizer.TriggerInnerThreshold ||
                brake > DeadZoneNormalizer.TriggerInnerThreshold)
            {
                return true;
            }

            return IsStickMagnitudeMeaningful();
        }

        private bool IsStickMagnitudeMeaningful()
        {
            // Steer binds to a single gamepad stick (leftStick). If a future control profile
            // added a second stick to the action, this returns on whichever control the Input
            // System enumerates first — acceptable today, revisit if Story 008 allows stick rebinding.
            foreach (InputControl control in _asset.Gameplay.Steer.controls)
            {
                if (control.parent is StickControl stick && stick.device is Gamepad)
                {
                    Vector2 raw = stick.ReadUnprocessedValue();
                    return raw.magnitude > DeadZoneNormalizer.StickInnerThreshold;
                }
            }

            return false;
        }

        /// <summary>Flags a meaningful digital event by the device that produced it.</summary>
        private void FlagMeaningfulFromDevice(InputControl control)
        {
            if (control?.device is Gamepad)
            {
                _gamepadMeaningful = true;
            }
            else
            {
                _keyboardMeaningful = true;
            }
        }

        private static float ReadGamepadAxis(InputAction action)
        {
            foreach (InputControl control in action.controls)
            {
                if (control is InputControl<float> axis && control.device is Gamepad)
                {
                    // ReadUnprocessedValue bypasses embedded processors (e.g. the StickControl's
                    // axisDeadzone on leftStick/x); triggers carry none but the call is uniform.
                    return axis.ReadUnprocessedValue();
                }
            }

            return 0f;
        }

        private void OnGameplayPause(InputAction.CallbackContext context)
        {
            if (context.phase == InputActionPhase.Canceled)
            {
                _latchedActions.Remove(_asset.Gameplay.Pause);
                return;
            }

            if (ShouldSuppressPerformed(_asset.Gameplay.Pause, context))
            {
                return;
            }

            _pendingPauseEdge = true;
            PauseEdgeCount++;
            GameplayEdgeCount++;
            FlagMeaningfulFromDevice(context.control);
        }

        private void OnCameraToggle(InputAction.CallbackContext context)
        {
            if (context.phase == InputActionPhase.Canceled)
            {
                _latchedActions.Remove(_asset.Gameplay.CameraToggle);
                return;
            }

            if (ShouldSuppressPerformed(_asset.Gameplay.CameraToggle, context))
            {
                return;
            }

            CameraToggleCount++;
            GameplayEdgeCount++;
            OnCameraToggleRequested?.Invoke();
            FlagMeaningfulFromDevice(context.control);
        }

        private void OnGameplayValue(InputAction.CallbackContext context)
        {
            GameplayValueEventCount++;
            // Keyboard/mouse gameplay actions count as keyboard meaningful; gamepad analog
            // meaningfulness is measured by threshold read in ResolveActiveScheme (the action's
            // 'performed' edge fires at the control's embedded dead-zone, not the game's 0.15).
            if (context.control?.device is Gamepad)
            {
                return;
            }

            _keyboardMeaningful = true;
        }

        private void OnSubmit(InputAction.CallbackContext context)
        {
            if (context.phase == InputActionPhase.Canceled)
            {
                _latchedActions.Remove(_asset.UI.Confirm);
                return;
            }

            if (ShouldSuppressPerformed(_asset.UI.Confirm, context))
            {
                return;
            }

            switch (_routingMode)
            {
                case RoutingMode.FinishedPresentation:
                    // ADR-0019: Confirm dismisses Finished Presentation → UI Presentation opens Results.
                    FinishedConfirmCount++;
                    OnFinishedConfirmRequested?.Invoke();
                    return;
                case RoutingMode.PitService:
                    // ADR-0005/GDD: Confirm routes directly to Pit Stop (eligibility gated by the consumer).
                    PitServiceConfirmCount++;
                    OnPitServiceConfirmRequested?.Invoke();
                    return;
                case RoutingMode.PitTransit:
                    // ADR-0019: all UI actions suppressed during PitTransit.
                    return;
                default:
                    SubmitCount++;
                    FlagMeaningfulFromDevice(context.control);
                    HidePointer();
                    break;
            }
        }

        private void OnCancel(InputAction.CallbackContext context)
        {
            if (context.phase == InputActionPhase.Canceled)
            {
                _latchedActions.Remove(_asset.UI.Cancel);
                return;
            }

            if (ShouldSuppressPerformed(_asset.UI.Cancel, context))
            {
                return;
            }

            if (_routingMode != RoutingMode.Normal)
            {
                // ADR-0019: Cancel is suppressed in Finished Presentation, PitService, and PitTransit.
                return;
            }

            CancelCount++;
            FlagMeaningfulFromDevice(context.control);
            HidePointer();
        }

        private void OnUiPause(InputAction.CallbackContext context)
        {
            if (context.phase == InputActionPhase.Canceled)
            {
                _latchedActions.Remove(_asset.UI.Pause);
                return;
            }

            if (ShouldSuppressPerformed(_asset.UI.Pause, context))
            {
                return;
            }

            if (_routingMode == RoutingMode.FinishedPresentation)
            {
                // ADR-0019: UI Pause toggles the terminal presentation timer while SimulationState stays Finished.
                FinishedPauseCount++;
                OnFinishedPauseRequested?.Invoke();
                return;
            }

            if (_routingMode != RoutingMode.Normal)
            {
                // Pause is suppressed in PitService and PitTransit.
                return;
            }

            UiPauseCount++;
            FlagMeaningfulFromDevice(context.control);
            HidePointer();
        }

        private void OnNavigate(InputAction.CallbackContext context)
        {
            if (context.phase == InputActionPhase.Canceled)
            {
                _latchedActions.Remove(_asset.UI.Navigate);
                return;
            }

            if (ShouldSuppressPerformed(_asset.UI.Navigate, context))
            {
                return;
            }

            if (_routingMode != RoutingMode.Normal)
            {
                // Navigation is suppressed in Finished Presentation, PitService, and PitTransit.
                return;
            }

            FlagMeaningfulFromDevice(context.control);
            HidePointer();
        }

        private void OnClick(InputAction.CallbackContext context)
        {
            if (_routingMode != RoutingMode.Normal)
            {
                return;
            }

            // A click makes the pointer visible (Story 007 AC-48) and counts as keyboard/mouse meaningful.
            ShowPointer();
            FlagMeaningfulFromDevice(context.control);
        }

        private void ShowPointer()
        {
            if (!_pointerVisible)
            {
                _pointerVisible = true;
                OnPointerVisibilityChanged?.Invoke(true);
            }
        }

        private void HidePointer()
        {
            if (_pointerVisible)
            {
                _pointerVisible = false;
                OnPointerVisibilityChanged?.Invoke(false);
            }
        }

        /// <summary>
        /// Observes the current pointer delta for UI scheme arbitration (Story 007 AC-36/48). Call once
        /// per render frame while the UI context is active; a delta >= 2 px makes the pointer visible
        /// and marks keyboard/mouse meaningful (the following <see cref="ResolveActiveScheme"/> selects
        /// KeyboardMouse). No-op outside normal UI routing.
        /// </summary>
        public void UpdateUiPointerState()
        {
            if (_routingMode != RoutingMode.Normal)
            {
                return;
            }

            if (IsKeyboardPointerMeaningful())
            {
                ShowPointer();
                _keyboardMeaningful = true;
            }
        }

        /// <summary>Latches digital gameplay actions actuated at a UI→Gameplay transition (ADR-0005).</summary>
        private void LatchActuatedGameplayActions()
        {
            double now = UnityEngine.InputSystem.LowLevel.InputState.currentTime;
            LatchIfActuated(_asset.Gameplay.Pause, now);
            LatchIfActuated(_asset.Gameplay.CameraToggle, now);
            // Accelerate/Brake/Steer are exempt (analog, AC-41): they apply immediately on resume.
        }

        /// <summary>Latches UI digital actions + Navigate actuated at a Gameplay→UI transition (ADR-0005).</summary>
        private void LatchActuatedUiActions()
        {
            double now = UnityEngine.InputSystem.LowLevel.InputState.currentTime;
            LatchIfActuated(_asset.UI.Confirm, now);
            LatchIfActuated(_asset.UI.Cancel, now);
            LatchIfActuated(_asset.UI.Navigate, now);
            LatchIfActuated(_asset.UI.Pause, now);
            // Point/Click are PassThrough handled by the UI module (pointer tracking is desired on
            // activation) — not latched.
        }

        private void LatchIfActuated(InputAction action, double latchTime)
        {
            if (IsAnyControlActuated(action))
            {
                _latchedActions.Add(action);
                _latchTime = latchTime;
            }
        }

        private static bool IsAnyControlActuated(InputAction action)
        {
            foreach (InputControl control in action.controls)
            {
                if (!control.CheckStateIsAtDefault())
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>
        /// Returns true when a latched action's performed must be suppressed. A press that began
        /// BEFORE the transition (startTime older than the latch time) is the carried-over press
        /// — suppressed once, then the latch clears. A press that began after the transition
        /// (a legitimate release+repress in the new context) has a newer startTime and is allowed
        /// through. Note: a held Button does not fire performed on enable (initial-state check is
        /// off for Button actions), so a performed arriving here with a pre-latch startTime is the
        /// engine edge the latch guards against.
        /// </summary>
        private bool ShouldSuppressPerformed(InputAction action, InputAction.CallbackContext context)
        {
            if (!_latchedActions.Contains(action))
            {
                return false;
            }

            if (context.startTime < _latchTime)
            {
                return true;
            }

            _latchedActions.Remove(action);
            return false;
        }

        private void EnforceGlobalSoleOwnership()
        {
            EnabledActionsScratch.Clear();
            InputSystem.ListEnabledActions(EnabledActionsScratch);
            foreach (InputAction action in EnabledActionsScratch)
            {
                if (action.actionMap != null && !ReferenceEquals(action.actionMap.asset, _asset.asset))
                {
                    action.Disable();
                }
            }
        }
    }
}
