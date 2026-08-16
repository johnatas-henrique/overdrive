using Overdrive.Simulation;

namespace Overdrive.Simulation.Tests
{
    /// <summary>
    /// Shared pipeline-step fixtures for Simulation integration tests. ReadoutStep and
    /// PublishStep are the test-local implementations of GDD steps 9 and 12 (spine indices
    /// 8 and 11) — the owning Core epics (Vehicle Physics, Fuel/Tire readout, RSM) deliver the
    /// production implementations (story-001: "steps are seams, NOT implementations"). These
    /// fixtures supply synthetic post-physics state so the kernel/driver can be tested
    /// engine-free.
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
        /// Test-local publication step implementing the spine step-12 (Publish, index 11)
        /// contract, which the RSM epic must uphold when it ships the production step:
        /// <list type="bullet">
        /// <item><b>Exactly one snapshot per executed tick</b> — consumers (Camera, VFX,
        /// Audio, HUD) always receive a <see cref="PublishedSimulationSnapshot"/>; zero
        /// publications per tick is a contract violation.</item>
        /// <item><b>Terminal wins</b> — when the RSM consume step produced a
        /// <see cref="PostFinishSnapshot"/> (context.TerminalSnapshot != null), it is
        /// published verbatim with its resolved classification.</item>
        /// <item><b>Fallback keeps consumers fed</b> — while no terminal exists, the step
        /// publishes the current simulation state (test-local: fabricated Racing). The
        /// production RSM replaces the fabrication with the true current-state snapshot;
        /// the published state must always match the tick's actual SimulationState.</item>
        /// <item><b>Read-only</b> — the step never mutates simulation state; it reads
        /// the context and publishes.</item>
        /// </list>
        /// Reference: ADR-0018 contract note (2026-08-15, improve-codebase-architecture C12).
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
