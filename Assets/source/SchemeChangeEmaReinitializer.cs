using System;

namespace Overdrive.Input
{
    /// <summary>
    /// Reinitializes the tick processor's EMA state when input needs re-seeding: on an active
    /// scheme change and on device recovery (availability returning to Available). The
    /// Simulation driver owns one of these per race; it subscribes to the controller's
    /// <see cref="InputContextController.OnActiveSchemeChanged"/> and
    /// <see cref="InputContextController.OnAvailabilityChanged"/> and applies the new scheme's
    /// post-dead-zone values through <see cref="TickProcessor.InitializeFromPostDeadZone"/>, so
    /// no filtered value carries from the prior scheme/device state (ADR-0005). Story 005
    /// (AC-23/AC-39); Story 006 reuses the same seam for UI→Gameplay context handoff.
    /// Example: <c>var reinit = new SchemeChangeEmaReinitializer(controller, processor); reinit.Enable();</c>
    /// </summary>
    public sealed class SchemeChangeEmaReinitializer
    {
        private readonly InputContextController _controller;
        private readonly TickProcessor _processor;
        private bool _enabled;

        /// <summary>Creates the reinitializer bound to a controller and tick processor.</summary>
        /// <param name="controller">The controller whose scheme/availability changes drive EMA reinitialization.</param>
        /// <param name="processor">The tick processor whose EMA state is reinitialized.</param>
        public SchemeChangeEmaReinitializer(InputContextController controller, TickProcessor processor)
        {
            _controller = controller ?? throw new ArgumentNullException(nameof(controller));
            _processor = processor ?? throw new ArgumentNullException(nameof(processor));
        }

        /// <summary>Subscribes to scheme/availability changes; call when the Simulation driver starts.</summary>
        public void Enable()
        {
            if (_enabled)
            {
                return;
            }

            _enabled = true;
            _controller.OnActiveSchemeChanged += OnSchemeChanged;
            _controller.OnAvailabilityChanged += OnAvailabilityChanged;
        }

        /// <summary>Unsubscribes from scheme/availability changes; call when the Simulation driver tears down.</summary>
        public void Disable()
        {
            if (!_enabled)
            {
                return;
            }

            _enabled = false;
            _controller.OnActiveSchemeChanged -= OnSchemeChanged;
            _controller.OnAvailabilityChanged -= OnAvailabilityChanged;
        }

        private void OnSchemeChanged(ControlScheme scheme)
        {
            // On the first active frame, the scheme change (during ResolveActiveScheme) and the
            // synthetic availability transition (first Capture → OnAvailabilityChanged) can both
            // trigger this reinitialization. Both read the same raw state via Peek and are
            // idempotent; the second call overwrites the same values — benign, no adverse ordering.
            _processor.InitializeFromPostDeadZone(_controller.PeekLatestRawSample());
        }

        private void OnAvailabilityChanged(InputAvailability availability)
        {
            if (availability == InputAvailability.Available)
            {
                // A same-scheme reconnect emits no scheme change, so device recovery re-seeds here.
                _processor.InitializeFromPostDeadZone(_controller.PeekLatestRawSample());
            }
        }
    }
}
