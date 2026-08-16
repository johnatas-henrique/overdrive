using System;
using UnityEngine.InputSystem;

namespace Overdrive.Input
{
    /// <summary>
    /// Action latches, counters, and event handlers responsibility of
    /// <see cref="InputContextController"/> (C11 split, 2026-08-15): the fourteen public
    /// event counters, the Pause-edge latch, the direct-routing event handlers (On*),
    /// and the ADR-0005 transition latches. Fields and construction live in the core
    /// partial; counters stay raw int properties until the HUD consumer forces an event
    /// stream (C11 deferral, 2026-08-15).
    /// </summary>
    public sealed partial class InputContextController
    {
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

        /// <summary>Gets whether a Pause edge is pending capture (latched; not yet consumed).</summary>
        public bool HasPendingPauseEdge => _pendingPauseEdge;

        /// <summary>Raised when the gameplay camera-toggle action is performed.</summary>
        public event Action OnCameraToggleRequested;

        /// <summary>Raised when Confirm is performed during Finished Presentation (routes to UI Presentation, Story 007 AC-54).</summary>
        public event Action OnFinishedConfirmRequested;

        /// <summary>Raised when UI Pause is performed during Finished Presentation (toggles the terminal timer, Story 007 AC-57).</summary>
        public event Action OnFinishedPauseRequested;

        /// <summary>Raised when Confirm is performed during PitService (routes to Pit Stop, Story 007 AC-52/64).</summary>
        public event Action OnPitServiceConfirmRequested;

        /// <summary>Clears the latched Pause edge once its consumer has read it (Story 004).</summary>
        public void ConsumePendingPauseEdge()
        {
            _pendingPauseEdge = false;
        }

        /// <summary>
        /// Consumes the pending Pause edge on a transition out of Gameplay (ADR-0005: the edge is
        /// consumed by the transition that triggered it). Called by the context setters that leave
        /// Gameplay and by a scheme change (AC-40). Not called on UI→Gameplay, where the edge was
        /// already consumed by the Gameplay→UI transition.
        /// </summary>
        private void ConsumePendingPauseEdgeOnTransition()
        {
            _pendingPauseEdge = false;
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
    }
}
