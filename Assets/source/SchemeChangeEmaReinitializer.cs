namespace Overdrive.Input
{
    /// <summary>
    /// Reinitializes the tick processor's EMA state when input needs re-seeding: on an active
    /// scheme change and on device recovery (availability returning to Available). Subscribes to the
    /// controller's <see cref="InputContextController.OnActiveSchemeChanged"/> and
    /// <see cref="InputContextController.OnAvailabilityChanged"/> and applies the new scheme's
    /// post-dead-zone values through <see cref="TickProcessor.InitializeFromPostDeadZone"/>, so
    /// no filtered value carries from the prior scheme/device state (ADR-0005). Story 005
    /// (AC-23/AC-39); Story 006 reuses the same seam for UI→Gameplay context handoff.
    /// Example: <c>var reinit = new SchemeChangeEmaReinitializer(controller, processor); reinit.Enable();</c>
    /// </summary>
    public sealed class SchemeChangeEmaReinitializer : EmaReinitializerBase
    {
        /// <summary>Creates the reinitializer bound to a controller and tick processor.</summary>
        public SchemeChangeEmaReinitializer(InputContextController controller, TickProcessor processor)
            : base(controller, processor)
        {
        }

        /// <inheritdoc/>
        protected override void Subscribe()
        {
            Controller.OnActiveSchemeChanged += OnSchemeChanged;
            Controller.OnAvailabilityChanged += OnAvailabilityChanged;
        }

        /// <inheritdoc/>
        protected override void Unsubscribe()
        {
            Controller.OnActiveSchemeChanged -= OnSchemeChanged;
            Controller.OnAvailabilityChanged -= OnAvailabilityChanged;
        }

        private void OnSchemeChanged(ControlScheme scheme)
        {
            // On the first active frame, the scheme change (during ResolveActiveScheme) and the
            // synthetic availability transition (first Capture → OnAvailabilityChanged) can both
            // trigger this reinitialization. Both read the same raw state via Peek and are
            // idempotent; the second call overwrites the same values — benign, no adverse ordering.
            Reinitialize();
        }

        private void OnAvailabilityChanged(InputAvailability availability)
        {
            if (availability == InputAvailability.Available)
            {
                // A same-scheme reconnect emits no scheme change, so device recovery re-seeds here.
                Reinitialize();
            }
        }
    }
}
