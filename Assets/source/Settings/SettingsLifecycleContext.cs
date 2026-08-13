using Overdrive.Settings.Core;
using Overdrive.Simulation;

namespace Overdrive.Settings
{
    /// <summary>
    /// Unity-facing lifecycle context: maps the current <see cref="SimulationState"/> (via the
    /// Kernel's <see cref="ISimulationStateGate"/>) to the settings lifecycle queries consumed by
    /// <see cref="SettingsEditSession"/> and the UI.
    /// </summary>
    /// <remarks>
    /// <see cref="CanOpenSettings"/> is false only during an ACTIVE (non-paused) Countdown
    /// (GDD settings.md:252) — a paused Countdown opens through the normal pause menu.
    /// <see cref="IsDifficultyEditable"/> is false whenever a race owns its immutable DifficultyProfile
    /// snapshot: Countdown or Racing (active or paused) (GDD settings.md:299, AC-D6).
    /// </remarks>
    public sealed class SettingsLifecycleContext : ISettingsLifecycleContext
    {
        private readonly ISimulationStateGate _stateGate;

        /// <summary>Creates the lifecycle context over the simulation state gate.</summary>
        /// <param name="stateGate">The read-only simulation state gate.</param>
        public SettingsLifecycleContext(ISimulationStateGate stateGate)
        {
            _stateGate = stateGate ?? throw new System.ArgumentNullException(nameof(stateGate));
        }

        /// <inheritdoc />
        public bool CanOpenSettings => _stateGate.State != SimulationState.Countdown;

        /// <inheritdoc />
        public bool IsDifficultyEditable
        {
            get
            {
                SimulationState state = _stateGate.State;
                if (state == SimulationState.Countdown || state == SimulationState.Racing)
                    return false;

                // Paused — a race snapshot exists when the pause came from Countdown or Racing.
                if (state == SimulationState.Paused)
                {
                    SimulationState? resume = _stateGate.ResumeState;
                    if (resume == SimulationState.Countdown || resume == SimulationState.Racing)
                        return false;
                }

                return true;
            }
        }
    }
}
