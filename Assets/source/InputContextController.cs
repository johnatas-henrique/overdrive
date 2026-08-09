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

        private bool _pendingPauseEdge;
        private ulong _captureSequence;
        private ControlScheme _activeScheme = ControlScheme.KeyboardMouse;
        private bool _keyboardMeaningful;
        private bool _gamepadMeaningful;
        private InputAvailability _lastAvailability = InputAvailability.NoInputDevice;

        /// <summary>Pointer movement (px) in one update that counts as meaningful keyboard/mouse input.</summary>
        private const float PointerMeaningfulDeltaPixels = 2f;

        /// <summary>Gets the currently selected context.</summary>
        public InputContextKind CurrentContext { get; private set; }

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
            _asset.Gameplay.CameraToggle.performed += OnCameraToggle;
            _asset.Gameplay.Accelerate.performed += OnGameplayValue;
            _asset.Gameplay.Brake.performed += OnGameplayValue;
            _asset.Gameplay.Steer.performed += OnGameplayValue;
            _asset.UI.Confirm.performed += OnSubmit;
            _asset.UI.Cancel.performed += OnCancel;
            _asset.UI.Pause.performed += OnUiPause;
            _asset.UI.Navigate.performed += OnNavigate;
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
            _uiModule.enabled = false;
            _asset.UI.Disable();
            _asset.Gameplay.Enable();
            CurrentContext = InputContextKind.Gameplay;
            EnforceGlobalSoleOwnership();
        }

        /// <summary>Disables gameplay and enables the UI action map and module.</summary>
        public void SetUIContext()
        {
            // ADR-0005:119 — the pending Pause edge is consumed by the transition that triggered it.
            _pendingPauseEdge = false;
            _asset.Gameplay.Disable();
            _asset.UI.Enable();
            _uiModule.enabled = true;
            CurrentContext = InputContextKind.UI;
            EnforceGlobalSoleOwnership();
        }

        /// <summary>Unsubscribes observers, destroys created references, and clears the UI module for test teardown.</summary>
        public void Unbind()
        {
            _asset.Gameplay.Pause.performed -= OnGameplayPause;
            _asset.Gameplay.CameraToggle.performed -= OnCameraToggle;
            _asset.Gameplay.Accelerate.performed -= OnGameplayValue;
            _asset.Gameplay.Brake.performed -= OnGameplayValue;
            _asset.Gameplay.Steer.performed -= OnGameplayValue;
            _asset.UI.Confirm.performed -= OnSubmit;
            _asset.UI.Cancel.performed -= OnCancel;
            _asset.UI.Pause.performed -= OnUiPause;
            _asset.UI.Navigate.performed -= OnNavigate;
            _asset.UI.Click.performed -= OnClick;
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

            bool keyboardMeaningful = _keyboardMeaningful || IsKeyboardPointerMeaningful();
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
            _pendingPauseEdge = true;
            PauseEdgeCount++;
            GameplayEdgeCount++;
            FlagMeaningfulFromDevice(context.control);
        }

        private void OnCameraToggle(InputAction.CallbackContext context)
        {
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
            SubmitCount++;
            FlagMeaningfulFromDevice(context.control);
        }

        private void OnCancel(InputAction.CallbackContext context)
        {
            CancelCount++;
            FlagMeaningfulFromDevice(context.control);
        }

        private void OnUiPause(InputAction.CallbackContext context)
        {
            UiPauseCount++;
            FlagMeaningfulFromDevice(context.control);
        }

        private void OnNavigate(InputAction.CallbackContext context)
        {
            FlagMeaningfulFromDevice(context.control);
        }

        private void OnClick(InputAction.CallbackContext context)
        {
            FlagMeaningfulFromDevice(context.control);
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
