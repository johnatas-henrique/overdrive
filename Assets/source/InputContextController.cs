using System;
using System.Collections.Generic;
using UnityEngine.InputSystem;
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

        /// <summary>Gets the currently selected context.</summary>
        public InputContextKind CurrentContext { get; private set; }

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

        private void OnGameplayPause(InputAction.CallbackContext context)
        {
            PauseEdgeCount++;
            GameplayEdgeCount++;
        }

        private void OnCameraToggle(InputAction.CallbackContext context)
        {
            CameraToggleCount++;
            GameplayEdgeCount++;
            OnCameraToggleRequested?.Invoke();
        }

        private void OnGameplayValue(InputAction.CallbackContext context)
        {
            GameplayValueEventCount++;
        }

        private void OnSubmit(InputAction.CallbackContext context)
        {
            SubmitCount++;
        }

        private void OnCancel(InputAction.CallbackContext context)
        {
            CancelCount++;
        }

        private void OnUiPause(InputAction.CallbackContext context)
        {
            UiPauseCount++;
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
