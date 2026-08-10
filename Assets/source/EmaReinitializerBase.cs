using System;

namespace Overdrive.Input
{
    /// <summary>
    /// Shared lifecycle for EMA reinitializers that re-seed the tick processor's previous-output
    /// state from the controller's latest raw sample. Owns the idempotent Enable/Disable lifecycle
    /// and the <see cref="Reinitialize"/> seam; each concrete policy subscribes to its own controller
    /// events (ADR-0005) via <see cref="Subscribe"/> / <see cref="Unsubscribe"/>. The Simulation
    /// driver owns one instance per race.
    /// </summary>
    public abstract class EmaReinitializerBase
    {
        /// <summary>The controller whose events drive re-seeding.</summary>
        protected readonly InputContextController Controller;

        /// <summary>The tick processor whose EMA state is re-seeded.</summary>
        protected readonly TickProcessor Processor;

        private bool _enabled;

        /// <summary>Creates the base bound to a controller and tick processor.</summary>
        /// <param name="controller">The controller whose scheme/context/availability changes drive re-seeding.</param>
        /// <param name="processor">The tick processor whose EMA state is reinitialized.</param>
        protected EmaReinitializerBase(InputContextController controller, TickProcessor processor)
        {
            Controller = controller ?? throw new ArgumentNullException(nameof(controller));
            Processor = processor ?? throw new ArgumentNullException(nameof(processor));
        }

        /// <summary>Subscribes to the policy's controller events; call when the Simulation driver starts. Idempotent.</summary>
        public void Enable()
        {
            if (_enabled)
            {
                return;
            }

            _enabled = true;
            Subscribe();
        }

        /// <summary>Unsubscribes from the policy's controller events; call when the Simulation driver tears down. Idempotent.</summary>
        public void Disable()
        {
            if (!_enabled)
            {
                return;
            }

            _enabled = false;
            Unsubscribe();
        }

        /// <summary>Subscribes to the controller events that drive this policy (ADR-0005).</summary>
        protected abstract void Subscribe();

        /// <summary>Unsubscribes from the controller events subscribed by <see cref="Subscribe"/>.</summary>
        protected abstract void Unsubscribe();

        /// <summary>Re-seeds the EMA from the controller's latest raw sample (post-dead-zone values).</summary>
        protected void Reinitialize() => Processor.InitializeFromPostDeadZone(Controller.PeekLatestRawSample());
    }
}
