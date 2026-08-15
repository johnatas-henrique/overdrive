using System;
using System.Collections.Generic;
using Overdrive.Simulation;
using Overdrive.Settings.Core;

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
        private LoadSeamProxy _loadProxy;
        private UnityContentRuntime _runtime;
        private RaceLoadOrchestrator _orchestrator;
        private readonly StartupOrchestrator _startup;
        private ContentStateMachine _stateMachine;
        private LoadingScreenController _loadingScreen;
        private IQualityProfileSource _profileSource;
        private ITextureMipmapApplier _mipmapApplier;
        private IQualityOverrideSource _overrideSource;
        private bool _qualityAttached;

        /// <summary>
        /// Creates the composition and the Content state machine it wires.
        /// <paramref name="kernel"/> is the Simulation state machine the readiness forwarder
        /// calls; the seams are the concrete Addressables wrappers (or fakes in tests).
        /// The cleanup seam is constructed internally (Story 004): a late-bound proxy breaks
        /// the SM ↔ seam construction cycle, then the engine-free
        /// <see cref="RaceCleanupSeam"/> is bound with an <see cref="IContentReleaser"/>
        /// closure over this root's <see cref="UnityContentRuntime"/>.
        /// </summary>
        public ContentCompositionRoot(
            IContentSelectionSource selectionSource,
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
            _loadProxy = loadProxy;
            var cleanupProxy = new CleanupSeamProxy();
            IReadinessForwarder forwarder = new DelegateForwarder((raceMode, grid) =>
            {
                // Populate the locked grid BEFORE forwarding readiness (AC-LO3 ordering).
                // _runtime is populated by BuildRaceComponents before any readiness can fire.
                _runtime.SetGrid(grid);
                kernel.OnRaceLoadReady(raceMode, grid);
            });

            _stateMachine = new ContentStateMachine(selectionSource, loadProxy, cleanupProxy, forwarder, initialSnapshot);
            BuildRaceComponents(_stateMachine, selectionSource, kernel, loader, instantiator, memory, qualityReduction, diagnostics, clock, loadProxy, cleanupProxy);
        }

        /// <summary>
        /// Startup-mode overload (Story 005): the race components are NOT constructed here —
        /// <see cref="RunStartup"/> runs the <see cref="StartupOrchestrator"/> and, on
        /// <see cref="StartupComplete"/>, constructs the SM (seeded with
        /// <c>isSharedLoaded: true</c>) + race components + proxy bindings. The PUBLIC
        /// <see cref="StartupComplete"/> fires only AFTER the SM exists; the kernel SM is
        /// never involved in fatal startup errors.
        /// </summary>
        public ContentCompositionRoot(
            IContentSelectionSource selectionSource,
            SimulationStateMachine kernel,
            IAddressableLoader loader,
            IContentInstantiator instantiator,
            IMemoryPressureSource memory,
            IQualityReductionRequest qualityReduction,
            IDiagnosticsSink diagnostics,
            IClock clock,
            ICatalogInitializer catalog,
            ISharedLoader sharedLoader,
            IFatalErrorHandler fatal,
            IFocusSeam focus)
        {
            if (kernel == null)
                throw new ArgumentNullException(nameof(kernel));

            _startup = new StartupOrchestrator(catalog, sharedLoader, fatal, focus);
            _startup.StartupComplete += BuildRaceComponentsAfterStartup;
            _startup.Fatal += OnStartupFatal;

            _selectionSource = selectionSource;
            _kernel = kernel;
            _loader = loader;
            _instantiator = instantiator;
            _memory = memory;
            _qualityReduction = qualityReduction;
            _diagnostics = diagnostics;
            _clock = clock;
        }

        private readonly IContentSelectionSource _selectionSource;
        private readonly SimulationStateMachine _kernel;
        private readonly IAddressableLoader _loader;
        private readonly IContentInstantiator _instantiator;
        private readonly IMemoryPressureSource _memory;
        private readonly IQualityReductionRequest _qualityReduction;
        private readonly IDiagnosticsSink _diagnostics;
        private readonly IClock _clock;

        /// <summary>Runs the startup sequence (idempotent — the orchestrator is terminal).</summary>
        public void RunStartup() => _startup.Run();

        /// <summary>Fires exactly once after the SM exists and is seeded (startup success).</summary>
        public event Action StartupComplete;

        /// <summary>Fires exactly once on a fatal startup error (catalog after retry, or Shared).</summary>
        public event Action<string, Overdrive.Simulation.ContentErrorType> Fatal;

        private void BuildRaceComponentsAfterStartup()
        {
            var loadProxy = new LoadSeamProxy();
            _loadProxy = loadProxy;
            var cleanupProxy = new CleanupSeamProxy();
            IReadinessForwarder forwarder = new DelegateForwarder((raceMode, grid) =>
            {
                _runtime.SetGrid(grid);
                _kernel.OnRaceLoadReady(raceMode, grid);
            });

            var sm = new ContentStateMachine(_selectionSource, loadProxy, cleanupProxy, forwarder, new ContentResourceState(true, Array.Empty<string>()));
            _stateMachine = sm;
            BuildRaceComponents(sm, _selectionSource, _kernel, _loader, _instantiator, _memory, _qualityReduction, _diagnostics, _clock, loadProxy, cleanupProxy);
            StartupComplete?.Invoke();
        }

        private void OnStartupFatal(string reason, Overdrive.Simulation.ContentErrorType type) => Fatal?.Invoke(reason, type);

        private void BuildRaceComponents(
            ContentStateMachine sm,
            IContentSelectionSource selectionSource,
            SimulationStateMachine kernel,
            IAddressableLoader loader,
            IContentInstantiator instantiator,
            IMemoryPressureSource memory,
            IQualityReductionRequest qualityReduction,
            IDiagnosticsSink diagnostics,
            IClock clock,
            LoadSeamProxy loadProxy,
            CleanupSeamProxy cleanupProxy)
        {
            _runtime = new UnityContentRuntime(sm, instantiator);
            _orchestrator = new RaceLoadOrchestrator(sm, loader, instantiator, memory, qualityReduction, diagnostics, clock, _runtime);
            loadProxy.Bind(_orchestrator);
            cleanupProxy.Bind(new RaceCleanupSeam(new RuntimeContentReleaser(_runtime), sm));
        }

        /// <summary>The constructed Content state machine (null until startup completes in startup mode).</summary>
        public ContentStateMachine StateMachine => _stateMachine ?? throw new InvalidOperationException("StateMachine is not available until startup completes (RunStartup + StartupComplete).");

        /// <summary>The loading screen controller (null until <see cref="AttachLoadingScreen"/>).</summary>
        public LoadingScreenController LoadingScreen => _loadingScreen;

        /// <summary>
        /// Attaches the loading screen (story 3-13): constructs the controller over the
        /// orchestrator's progress + the clock, and wires SM <c>RaceLoadReady</c> →
        /// <c>NotifyLoaded</c> and SM <c>ContentLoadError</c> → <c>NotifyError</c>.
        /// Additive: existing constructors are untouched. Must be called after startup
        /// completes (startup mode); the bootstrapper drives Begin*/Tick per race.
        /// </summary>
        public void AttachLoadingScreen(ILoadingScreenPresenter presenter)
        {
            if (presenter == null)
                throw new ArgumentNullException(nameof(presenter));
            if (_stateMachine == null || _orchestrator == null)
                throw new InvalidOperationException("AttachLoadingScreen requires the state machine and orchestrator (after startup completes).");
            if (_loadingScreen != null)
                throw new InvalidOperationException("AttachLoadingScreen may be called only once — the controller is single-attach (re-arm via Begin* per race).");

            _loadingScreen = new LoadingScreenController(_orchestrator, _clock, presenter);
            _stateMachine.RaceLoadReady += (_, _) => _loadingScreen.NotifyLoaded();
            _stateMachine.ContentLoadError += (reason, _) => _loadingScreen.NotifyError(reason);
        }

        /// <summary>The race runtime handoff (read by Vehicle Physics / Grid &amp; Start).</summary>
        public IRaceContentRuntime Runtime => _runtime;

        /// <summary>The aggregated load progress (read by the loading screen).</summary>
        public IRaceLoadProgress Progress => _orchestrator;

        /// <summary>
        /// Attaches the quality profiles (story 3-14): the mipmap policy is applied
        /// at every race-load start (before the orchestrator requests the track) and
        /// re-applied on runtime override transitions (reduced → Low-equivalent limit,
        /// restored → working preset limit). The override never rewrites persisted
        /// preferences. Additive — must be called after the composition is built
        /// (startup mode: after startup completes); single-attach guard.
        /// </summary>
        public void AttachQualityProfiles(
            IQualityProfileSource profileSource,
            ITextureMipmapApplier mipmapApplier,
            IQualityOverrideSource overrideSource)
        {
            if (_qualityAttached)
                throw new InvalidOperationException("AttachQualityProfiles may only be called once.");
            if (_loadProxy == null)
                throw new InvalidOperationException("AttachQualityProfiles requires the composition to be built (startup mode: after startup completes).");
            _profileSource = profileSource ?? throw new ArgumentNullException(nameof(profileSource));
            _mipmapApplier = mipmapApplier ?? throw new ArgumentNullException(nameof(mipmapApplier));
            _overrideSource = overrideSource ?? throw new ArgumentNullException(nameof(overrideSource));
            _qualityAttached = true;
            _loadProxy.LoadStarting += OnLoadStarting;
            _overrideSource.Changed += OnOverrideChanged;
        }

        /// <summary>
        /// Applies the mipmap limit at load start. Subscriber faults are non-fatal
        /// (SafePublish): a mipmap failure must never break the content load — the
        /// exception is contained and the load proceeds.
        /// </summary>
        private void OnLoadStarting()
        {
            try
            {
                ApplyMipmap();
            }
            catch (Exception ex)
            {
                UnityEngine.Debug.LogWarning($"Mipmap policy failed at load start (non-fatal): {ex.Message}");
            }
        }

        /// <summary>Re-applies the mipmap limit on override transitions (restore path). Same non-fatal containment.</summary>
        private void OnOverrideChanged(bool _)
        {
            try
            {
                ApplyMipmap();
            }
            catch (Exception ex)
            {
                UnityEngine.Debug.LogWarning($"Mipmap policy failed on override change (non-fatal): {ex.Message}");
            }
        }

        private void ApplyMipmap()
        {
            if (_mipmapApplier == null)
                return; // not attached — no-op
            int limit = _overrideSource.IsReduced
                ? MipmapLimitResolver.Resolve(QualityPresetId.Low)
                : MipmapLimitResolver.Resolve(_profileSource.Current);
            _mipmapApplier.Apply(limit);
        }

        /// <summary>Periodic sampling hook — call from a MonoBehaviour Update.</summary>
        public void Sample() => _orchestrator.Sample();

        /// <summary>Releases all retained handles + destroys the track instance (Story 004 cleanup entry point).</summary>
        public void ReleaseAll() => _runtime.ReleaseAll();

        /// <summary>Late-bound <see cref="IContentLoadSeam"/> forwarded to the orchestrator once bound.</summary>
        private sealed class LoadSeamProxy : IContentLoadSeam
        {
            private IContentLoadSeam _target;

            /// <summary>Fires before the first load request of a race (load start — mipmap policy hook).</summary>
            public event Action LoadStarting;

            public void Bind(IContentLoadSeam target) => _target = target;

            /// <inheritdoc />
            public void RequestTrackLoad(string trackId)
            {
                if (_target == null)
                    throw new InvalidOperationException("Load seam accessed before the composition bound the orchestrator.");
                LoadStarting?.Invoke();
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

        /// <summary>Late-bound <see cref="IContentCleanupSeam"/> forwarded to the engine-free seam once bound (Story 004 wiring).</summary>
        private sealed class CleanupSeamProxy : IContentCleanupSeam
        {
            private IContentCleanupSeam _target;

            public void Bind(IContentCleanupSeam target) => _target = target;

            /// <inheritdoc />
            public void BeginCleanup(int cleanupId)
            {
                if (_target == null)
                    throw new InvalidOperationException("Cleanup seam accessed before the composition bound the Story 004 seam.");
                _target.BeginCleanup(cleanupId);
            }
        }

        /// <summary><see cref="IContentReleaser"/> bound to the runtime's full release (Story 004 unload path).</summary>
        private sealed class RuntimeContentReleaser : IContentReleaser
        {
            private readonly UnityContentRuntime _runtime;

            public RuntimeContentReleaser(UnityContentRuntime runtime) => _runtime = runtime;

            /// <inheritdoc />
            public void ReleaseAll() => _runtime.ReleaseAll();
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
