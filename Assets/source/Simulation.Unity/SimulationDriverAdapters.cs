using UnityEngine;
using Overdrive.Simulation;

namespace Overdrive.Simulation.UnityAdapters
{
    // NOTE (C6, 2026-08-15): this namespace now matches its hosting assembly
    // (Overdrive.Simulation.Unity, Assets/source/Simulation.Unity/) — the adapter family
    // lives next to the engine-free contracts it bridges. The Simulation assembly itself
    // stays noEngineReferences: true; this assembly is the Unity side of the one-way
    // dependency (Simulation.Unity → Simulation).
    /// <summary>
    /// Unity adapter for the manual simulation clock. Gameplay timing must use this
    /// unscaled render delta and never Time.deltaTime or Time.fixedDeltaTime.
    /// Example: <c>new UnityFrameDeltaSource().GetUnscaledDeltaTime()</c>.
    /// </summary>
    public sealed class UnityFrameDeltaSource : IFrameDeltaSource
    {
        /// <inheritdoc />
        public float GetUnscaledDeltaTime() => Time.unscaledDeltaTime;
    }

    /// <summary>
    /// Unity adapter for the sole whole-scene physics boundary. It freezes automatic
    /// physics before each call, then performs exactly the explicit requested step.
    /// Example: <c>new UnityPhysicsSimulator().Simulate(SimulationDriver.FIXED_DT)</c>.
    /// </summary>
    public sealed class UnityPhysicsSimulator : IPhysicsSimulator
    {
        /// <summary>Creates the adapter and immediately selects script-controlled physics.</summary>
        public UnityPhysicsSimulator()
        {
            Physics.simulationMode = SimulationMode.Script;
        }

        /// <inheritdoc />
        public void Simulate(float fixedDeltaTime)
        {
            Physics.simulationMode = SimulationMode.Script;
            Physics.Simulate(fixedDeltaTime);
        }
    }

    /// <summary>
    /// Thin Unity lifecycle adapter. Composition code injects the engine-free driver;
    /// this component contributes only the render-frame Update entry point.
    /// </summary>
    public sealed class SimulationDriverBehaviour : MonoBehaviour
    {
        private SimulationDriver _driver;

        /// <summary>Gets the configured driver, or null until composition is complete.</summary>
        public SimulationDriver Driver => _driver;

        /// <summary>Injects the already-composed manual driver.</summary>
        public void Configure(SimulationDriver driver)
        {
            _driver = driver;
        }

        private void Update()
        {
            _driver?.Update();
        }
    }
}
