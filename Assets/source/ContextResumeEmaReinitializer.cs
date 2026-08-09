using System;
using UnityEngine;

namespace Overdrive.Input
{
    /// <summary>
    /// Re-seeds the tick processor's EMA previous-output state when the input context resumes from
    /// UI into gameplay (ADR-0005 UI→Gameplay rule: Accelerate/Brake/Steer apply immediately and
    /// EMA initializes from current post-dead-zone values, so no filtered value carries from the
    /// prior context). Observes the controller's <see cref="InputContextController.OnContextChanged"/>
    /// and acts only on an actual transition into <see cref="InputContextKind.Gameplay"/>. Gameplay
    /// sub-state transitions (e.g. Countdown→Racing, both Gameplay) fire no context change, so EMA
    /// state is preserved there (AC-18). The Simulation driver owns one instance per race
    /// (Enable on driver start, Disable on teardown). Idempotent Enable/Disable.
    /// </summary>
    public sealed class ContextResumeEmaReinitializer
    {
        private readonly InputContextController _controller;
        private readonly TickProcessor _processor;
        private bool _enabled;

        /// <summary>Creates the reinitializer for the given controller and tick processor.</summary>
        public ContextResumeEmaReinitializer(InputContextController controller, TickProcessor processor)
        {
            _controller = controller ?? throw new ArgumentNullException(nameof(controller));
            _processor = processor ?? throw new ArgumentNullException(nameof(processor));
        }

        /// <summary>Starts observing context changes. Idempotent.</summary>
        public void Enable()
        {
            if (_enabled)
            {
                return;
            }

            _enabled = true;
            _controller.OnContextChanged += OnContextChanged;
        }

        /// <summary>Stops observing context changes. Idempotent; leaves the EMA untouched.</summary>
        public void Disable()
        {
            if (!_enabled)
            {
                return;
            }

            _enabled = false;
            _controller.OnContextChanged -= OnContextChanged;
        }

        private void OnContextChanged(InputContextKind context)
        {
            if (context != InputContextKind.Gameplay)
            {
                return;
            }

            // UI→Gameplay resume (or blocked→Gameplay after readiness): seed the EMA from the
            // current post-dead-zone raw so held analog applies immediately with no filtered value
            // carrying from the prior context.
            _processor.InitializeFromPostDeadZone(_controller.PeekLatestRawSample());
        }
    }
}
