using System;
using UnityEngine.InputSystem;

namespace Overdrive.Input
{
    /// <summary>
    /// Context switching + pointer visibility responsibility of
    /// <see cref="InputContextController"/> (C11 split, 2026-08-15): the six context
    /// setters, the committed-context property/event, routing mode, and the UI pointer
    /// policy (Story 007 AC-36/48). Fields and construction live in the core partial.
    /// </summary>
    public sealed partial class InputContextController
    {
        /// <summary>Gets the currently selected context.</summary>
        public InputContextKind CurrentContext { get; private set; }

        /// <summary>
        /// Raised when the active context transitions (None/Gameplay/UI). Consumers that re-seed
        /// state on UI→Gameplay resume (the context-resume EMA reinitializer) observe this. Raised
        /// only on an ACTUAL context change — a same-context call (e.g. Countdown→Racing, both
        /// Gameplay) does not fire, so EMA state is preserved across Gameplay sub-states.
        /// </summary>
        public event Action<InputContextKind> OnContextChanged;

        /// <summary>Gets the current direct-routing mode for special input destinations (Story 007).</summary>
        public RoutingMode CurrentRoutingMode => _routingMode;

        /// <summary>Gets whether the UI pointer is visible (mouse is UI-only, Story 007 AC-36/48).</summary>
        public bool PointerVisible => _pointerVisible;

        /// <summary>Raised when the UI pointer visibility changes (Story 007 AC-36/48).</summary>
        public event Action<bool> OnPointerVisibilityChanged;

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
            // ADR-0005: the transition out of Gameplay consumes the pending Pause edge.
            ConsumePendingPauseEdgeOnTransition();
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
            // ADR-0005: the transition out of Gameplay consumes the pending Pause edge.
            ConsumePendingPauseEdgeOnTransition();
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
            EnterUiRoutingMode(RoutingMode.FinishedPresentation);
        }

        /// <summary>
        /// Enters the PitService routing mode (ADR-0005/GDD): the UI map is enabled so Confirm routes
        /// directly to Pit Stop, but the UI module is disabled. Cancel is suppressed. Tire-swap
        /// eligibility is owned by the Pit Stop consumer, which receives the unconditional
        /// <see cref="OnPitServiceConfirmRequested"/> event and decides whether to exit.
        /// </summary>
        public void SetPitServiceContext()
        {
            EnterUiRoutingMode(RoutingMode.PitService);
        }

        /// <summary>
        /// Enters the PitTransit routing mode (ADR-0005): the UI map is enabled so the controller
        /// receives callbacks (latch detection, meaningful-event flags), but all UI actions are
        /// suppressed and the UI module is disabled. No navigation/Submit/Cancel/gameplay event is
        /// emitted. The gameplay map stays disabled (no driving input).
        /// </summary>
        public void SetPitTransitContext()
        {
            EnterUiRoutingMode(RoutingMode.PitTransit);
        }

        /// <summary>
        /// Shared body of the UI-module-disabled routing modes (TD-046): enables the UI map so
        /// direct-routing callbacks fire, disables the UI module, and latches UI digital actions
        /// actuated at the transition (prevents a held Confirm from immediately dismissing a
        /// destination, a held Pause toggling the timer, a held Cancel/arrow leaking — same rule as
        /// SetUIContext, Story 006 AC-53; defense-in-depth: a held Button does not re-fire
        /// 'performed' on action-map enable (no initial-state check), so the no-repeat behavior is
        /// the real protection and the latch guards the engine edge where a performed arrives with
        /// a pre-transition startTime).
        /// </summary>
        private void EnterUiRoutingMode(RoutingMode mode)
        {
            ConsumePendingPauseEdgeOnTransition();
            _routingMode = mode;
            _asset.Gameplay.Disable();
            if (CurrentContext != InputContextKind.UI)
            {
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
    }
}
