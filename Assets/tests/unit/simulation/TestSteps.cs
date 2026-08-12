using Overdrive.Simulation;

namespace Overdrive.Simulation.Tests
{
    /// <summary>
    /// Shared pipeline-step fixtures for Simulation tests. ReadoutStep and PublishStep are the
    /// test-local implementations of GDD steps 9 and 12 (spine indices 8 and 11) — the owning
    /// Core epics (Vehicle Physics, Fuel/Tire readout, RSM) deliver the production
    /// implementations (story-001: "steps are seams, NOT implementations"). These fixtures
    /// supply synthetic post-physics state so the kernel/driver can be tested engine-free.
    /// </summary>
    public static class TestSteps
    {
        /// <summary>Spine index of the CarState readout step (GDD step 9, 0-based index 8).</summary>
        public const int ReadoutSpineIndex = 8;

        /// <summary>Spine index of the snapshot publication step (GDD step 12, 0-based index 11).</summary>
        public const int PublishSpineIndex = 11;

        /// <summary>
        /// Test-local readout step: writes synthetic post-physics CarState/FuelState/TireState
        /// so downstream spine steps (RSM consume, publish) have data to freeze. Replaced by the
        /// Vehicle Physics / Fuel / Tire epics' real readout in production.
        /// </summary>
        public sealed class ReadoutStep : ISimulationPipelineStep
        {
            public void Execute(SimulationTickContext context)
            {
                context.PostTickCarState = new[] { new CarState(1, 1000f) };
                context.PostTickFuelState = new[] { new FuelState(0.5f) };
                context.PostTickTireState = new[] { new TireState(0.9f) };
            }
        }

        /// <summary>
        /// Test-local publication step: publishes the terminal snapshot if the RSM consume step
        /// produced one, otherwise fabricates a synthetic Racing terminal so consumers always
        /// receive a snapshot. Replaced by the production publication path in the kernel/driver.
        /// </summary>
        public sealed class PublishStep : ISimulationPipelineStep
        {
            public void Execute(SimulationTickContext context)
            {
                PostFinishSnapshot terminal = context.TerminalSnapshot;
                if (terminal == null)
                {
                    terminal = new PostFinishSnapshot(
                        new[] { new CarState(1) }, new[] { new FuelState(1) }, new[] { new TireState(0) },
                        new RsmState(), SimulationState.Racing);
                }
                context.PublishSnapshot(new PublishedSimulationSnapshot(terminal));
            }
        }
    }
}
