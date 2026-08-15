using System;
using System.Collections.Generic;
using Overdrive.Simulation;

namespace Overdrive.Content.Unity
{
    /// <summary>
    /// Composition root for the Content Pipeline runtime (Story 003 handoffs): constructs the
    /// <see cref="ContentStateMachine"/> with a late-bound load seam and a late-bound
    /// readiness forwarder (the SM ↔ orchestrator ↔ runtime reference cycle is broken by
    /// two closures bound after construction), wires the <see cref="RaceLoadOrchestrator"/>
    /// as the <see cref="IContentLoadSeam"/>, and exposes the <see cref="IRaceContentRuntime"/>
    /// handoff + <see cref="IRaceLoadProgress"/>.
    /// </summary>
    public sealed class ContentCompositionRoot
    {
        private readonly UnityContentRuntime _runtime;
        private readonly RaceLoadOrchestrator _orchestrator;

        /// <summary>
        /// Creates the composition and the Content state machine it wires.
        /// <paramref name="kernel"/> is the Simulation state machine the readiness forwarder
        /// calls; the seams are the concrete Addressables wrappers (or fakes in tests).
        /// </summary>
        public ContentCompositionRoot(
            IContentSelectionSource selectionSource,
            IContentCleanupSeam cleanupSeam,
            ContentResourceState initialSnapshot,
            SimulationStateMachine kernel,
            IAddressableLoader loader,
            IContentInstantiator instantiator,
            IMemoryPressureSource memory,
            IQualityReductionRequest qualityReduction,
            IDiagnosticsSink diagnostics,
            IClock clock)
        {
            if (kernel == null)
                throw new ArgumentNullException(nameof(kernel));

            // Late-bound seams: the SM is constructed before the orchestrator and the
            // runtime exist, so the seam references are bound after construction.
            var loadProxy = new LoadSeamProxy();
            UnityContentRuntime runtime = null;
            IReadinessForwarder forwarder = new DelegateForwarder((raceMode, grid) =>
            {
                // Populate the locked grid BEFORE forwarding readiness (AC-LO3 ordering).
                runtime.SetGrid(grid);
                kernel.OnRaceLoadReady(raceMode, grid);
            });

            StateMachine = new ContentStateMachine(selectionSource, loadProxy, cleanupSeam, forwarder, initialSnapshot);

            runtime = new UnityContentRuntime(StateMachine, instantiator);
            _runtime = runtime;
            _orchestrator = new RaceLoadOrchestrator(StateMachine, loader, instantiator, memory, qualityReduction, diagnostics, clock, runtime);
            loadProxy.Bind(_orchestrator);
        }

        /// <summary>The constructed Content state machine.</summary>
        public ContentStateMachine StateMachine { get; }

        /// <summary>The race runtime handoff (read by Vehicle Physics / Grid &amp; Start).</summary>
        public IRaceContentRuntime Runtime => _runtime;

        /// <summary>The aggregated load progress (read by the loading screen).</summary>
        public IRaceLoadProgress Progress => _orchestrator;

        /// <summary>Periodic sampling hook — call from a MonoBehaviour Update.</summary>
        public void Sample() => _orchestrator.Sample();

        /// <summary>Releases all retained handles + destroys the track instance (Story 004 cleanup entry point).</summary>
        public void ReleaseAll() => _runtime.ReleaseAll();

        /// <summary>Late-bound <see cref="IContentLoadSeam"/> forwarded to the orchestrator once bound.</summary>
        private sealed class LoadSeamProxy : IContentLoadSeam
        {
            private IContentLoadSeam _target;

            public void Bind(IContentLoadSeam target) => _target = target;

            /// <inheritdoc />
            public void RequestTrackLoad(string trackId)
            {
                if (_target == null)
                    throw new InvalidOperationException("Load seam accessed before the composition bound the orchestrator.");
                _target.RequestTrackLoad(trackId);
            }

            /// <inheritdoc />
            public void RequestCarLoads(IReadOnlyList<string> teamIds)
            {
                if (_target == null)
                    throw new InvalidOperationException("Load seam accessed before the composition bound the orchestrator.");
                _target.RequestCarLoads(teamIds);
            }
        }

        private sealed class DelegateForwarder : IReadinessForwarder
        {
            private readonly Action<RaceMode, GridAssignment> _onForward;

            public DelegateForwarder(Action<RaceMode, GridAssignment> onForward)
            {
                _onForward = onForward;
            }

            /// <inheritdoc />
            public void Forward(RaceMode raceMode, GridAssignment gridAssignment) => _onForward(raceMode, gridAssignment);
        }
    }
}
