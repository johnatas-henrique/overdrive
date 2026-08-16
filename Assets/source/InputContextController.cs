using System;
using System.Collections.Generic;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;

namespace Overdrive.Input
{
    /// <summary>The mutually exclusive input mode backed by its own action map (Input Context, CONTEXT.md).</summary>
    public enum InputContextKind
    {
        /// <summary>No action map active (loading-blocked or startup).</summary>
        None = 0,

        /// <summary>Gameplay action map active (racing).</summary>
        Gameplay,

        /// <summary>UI action map active (menus, results, pause).</summary>
        UI
    }

    /// <summary>
    /// Direct-routing destination for UI actions that bypass the EventSystem (Story 007):
    /// Finished Presentation routes Confirm/UI Pause to UI Presentation; PitService routes
    /// Confirm to Pit Stop; PitTransit suppresses all UI actions. Normal routes through the
    /// EventSystem as usual.
    /// </summary>
    public enum RoutingMode
    {
        /// <summary>Standard routing through the UI module/EventSystem.</summary>
        Normal = 0,

        /// <summary>Confirm/UI Pause route directly to UI Presentation (ADR-0019).</summary>
        FinishedPresentation,

        /// <summary>Confirm routes directly to Pit Stop (ADR-0005/GDD).</summary>
        PitService,

        /// <summary>All UI actions suppressed (ADR-0005, pit transit).</summary>
        PitTransit
    }

    /// <summary>
    /// Owns activation of Overdrive's gameplay and UI action maps.
    /// Example: construct it with a generated <see cref="InputSystem_Actions"/> and call
    /// <see cref="SetGameplayContext"/> or <see cref="SetUIContext"/> at lifecycle boundaries.
    ///
    /// Split across four partial files by responsibility (improve-codebase-architecture C11,
    /// 2026-08-15 — same public surface, zero behavior change):
    /// <list type="bullet">
    /// <item>InputContextController.cs — core: fields, construction, unbind, raw capture.</item>
    /// <item>InputContextController.Contexts.cs — context switching + pointer visibility.</item>
    /// <item>InputContextController.Latches.cs — action latches, counters, event handlers.</item>
    /// <item>InputContextController.Scheme.cs — scheme arbitration (ADR-0005).</item>
    /// </list>
    /// </summary>
    public sealed partial class InputContextController
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
        private ControlProfile _profile = ControlProfile.Default;

        /// <summary>Pointer movement (px) in one update that counts as meaningful keyboard/mouse input.</summary>
        private const float PointerMeaningfulDeltaPixels = 2f;

        /// <summary>Gets the number of raw samples captured.</summary>
        public int CaptureCount { get; private set; }

        /// <summary>
        /// Raised when input availability transitions (e.g. NoInputDevice → Available on device
        /// reconnect). Consumers that re-seed state on device recovery (the scheme-change EMA
        /// reinitializer) observe this — a same-scheme reconnect emits no scheme change. Note:
        /// the first capture after construction fires a synthetic transition from the initial
        /// NoInputDevice default even if devices are already present; consumers must treat it as
        /// a first-frame priming signal, not a device-recovery event.
        /// </summary>
        public event Action<InputAvailability> OnAvailabilityChanged;

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
