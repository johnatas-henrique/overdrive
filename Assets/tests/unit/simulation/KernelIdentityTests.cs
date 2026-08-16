using System;
using NUnit.Framework;
using Overdrive.Input;
using Overdrive.Simulation;

namespace Overdrive.Simulation.Tests
{
    /// <summary>
    /// Spine identity contract tests (improve-codebase-architecture C5, 2026-08-15): the
    /// kernel fails fast on construction when a step declaring <see cref="ICanonicalSpineStep"/>
    /// lands in a slot that differs from its canonical index. The documented canonical slot
    /// map (GDD simulation-architecture.md / ADR-0001) is the external source of truth the
    /// constants are validated against.
    /// </summary>
    public sealed class KernelIdentityTests
    {
        private sealed class NoOpInputProcessor : ISimulationInputProcessor
        {
            public SimulationInput Process(RawInputSample sample, bool pausePending) => default;
        }

        private sealed class NoOpPhysicsSimulator : IPhysicsSimulator
        {
            public void Simulate(float fixedDeltaTime) { }
        }

        /// <summary>Generic step without the identity contract — exempt from slot validation.</summary>
        private sealed class GenericStep : ISimulationPipelineStep
        {
            public void Execute(SimulationTickContext context) { }
        }

        private static SimulationKernel Build(params ISimulationPipelineStep[] steps)
        {
            if (steps.Length != SimulationKernel.StepCount)
                throw new InvalidOperationException("Test harness requires exactly 14 steps.");
            return new SimulationKernel(new NoOpInputProcessor(), steps);
        }

        private static ISimulationPipelineStep[] StepsWithPhysicsAt(int physicsSlot)
        {
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = i == physicsSlot ? new PhysicsSimulateStep(new NoOpPhysicsSimulator()) : new GenericStep();
            return steps;
        }

        [Test]
        public void CanonicalConstants_MatchDocumentedSpineOrder()
        {
            // GDD simulation-architecture.md / ADR-0001 canonical slots (0-based): Countdown 3,
            // Physics 6, GO 7, RSM evaluation 9, RSM consume 10, AI skip 12. These constants are
            // the production steps' declared identity — a drift here is a silent slot bug.
            Assert.AreEqual(3, CountdownStep.SpineIndex);
            Assert.AreEqual(6, PhysicsSimulateStep.SpineIndex);
            Assert.AreEqual(7, GoStep.SpineIndex);
            Assert.AreEqual(9, RsmEvaluationStep.SpineIndex);
            Assert.AreEqual(10, RsmConsumeStep.SpineIndex);
            Assert.AreEqual(12, AiSkipStep.SpineIndex);
        }

        [Test]
        public void CanonicalStep_AtWrongSlot_ThrowsOnConstruction()
        {
            Assert.Throws<ArgumentException>(() => Build(StepsWithPhysicsAt(PhysicsSimulateStep.SpineIndex - 1)));
            Assert.Throws<ArgumentException>(() => Build(StepsWithPhysicsAt(PhysicsSimulateStep.SpineIndex + 1)));
        }

        [Test]
        public void CanonicalStep_AtCanonicalSlot_Constructs()
        {
            Assert.DoesNotThrow(() => Build(StepsWithPhysicsAt(PhysicsSimulateStep.SpineIndex)));
        }

        [Test]
        public void StepWithoutIdentity_AtAnySlot_Constructs()
        {
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new GenericStep();
            Assert.DoesNotThrow(() => Build(steps));
        }

        [Test]
        public void WrongSlotError_NamesTheOffendingStep()
        {
            ArgumentException ex = Assert.Throws<ArgumentException>(() => Build(StepsWithPhysicsAt(2)));
            StringAssert.Contains(nameof(PhysicsSimulateStep), ex.Message);
        }
    }
}
