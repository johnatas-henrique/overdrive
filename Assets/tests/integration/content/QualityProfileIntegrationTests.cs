using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using Overdrive.Content;
using Overdrive.Content.Unity;
using Overdrive.Settings;
using Overdrive.Settings.Core;
using Overdrive.Simulation;

namespace Overdrive.Content.Tests
{
    /// <summary>
    /// Story 3-14 (Quality Profiles WebGL) — Content-only consistency: applied preset
    /// (ActivePreset via IQualityProfileSource) → mipmap limit (MipmapLimitResolver +
    /// real UnityTextureMipmapApplier), runtime fallback override (fake
    /// IQualityOverrideSource → Low-equivalent limit → restore), adapter translation
    /// (SettingsQualityProfileSource / SettingsQualityOverrideSource over the real
    /// QualityPresetApplier / PerformanceMonitor).
    /// </summary>
    public class QualityProfileIntegrationTests
    {
        private int _originalMipmapLimit;

        [SetUp]
        public void SaveGlobalMipmapState() => _originalMipmapLimit = UnityEngine.QualitySettings.globalTextureMipmapLimit;

        [TearDown]
        public void RestoreGlobalMipmapState() => UnityEngine.QualitySettings.globalTextureMipmapLimit = _originalMipmapLimit;

        private sealed class FakeHandle : IAsyncLoadHandle
        {
            private readonly Action<FakeHandle> _onComplete;

            public FakeHandle(Action<FakeHandle> onComplete) => _onComplete = onComplete;

            public bool IsDone { get; private set; }

            public object Result { get; private set; }

            public Exception OperationException { get; private set; }

            public int ReleaseCount;

            public (long DownloadedBytes, long TotalBytes) GetDownloadStatus() => (100L, 100L);

            public void Complete(object result)
            {
                Result = result;
                IsDone = true;
                _onComplete(this);
            }

            public void Fail(Exception exception)
            {
                OperationException = exception;
                IsDone = true;
                _onComplete(this);
            }

            public void Release() => ReleaseCount++;
        }

        private sealed class FakeLoader : IAddressableLoader
        {
            public List<(string Key, FakeHandle Handle)> Loads = new List<(string, FakeHandle)>();

            public IAsyncLoadHandle LoadAssetAsync(object key, Action<IAsyncLoadHandle> onComplete)
            {
                var handle = new FakeHandle(h => onComplete(h));
                Loads.Add(((string)key, handle));
                return handle;
            }

            public IReadOnlyList<FakeHandle> Handles => Loads.Select(l => l.Handle).ToList();
        }

        private sealed class FakeInstantiator : IContentInstantiator
        {
            public int InstantiateCount;

            public object Instantiate(object prefab)
            {
                InstantiateCount++;
                return new object();
            }

            public void ReleaseInstance(object instance) { }
        }

        private sealed class FakeMemory : IMemoryPressureSource
        {
            public float Pressure { get; set; }

            public FakeMemory(float pressure) => Pressure = pressure;
        }

        private sealed class FakeQuality : IQualityReductionRequest
        {
            public int RequestCount;

            public void RequestQualityReduction(string reason) => RequestCount++;
        }

        private sealed class FakeDiagnostics : IDiagnosticsSink
        {
            public List<string> Warnings = new List<string>();

            public List<string> Errors = new List<string>();

            public void LogWarning(string message) => Warnings.Add(message);

            public void LogError(string message) => Errors.Add(message);
        }

        private sealed class FakeClock : IClock
        {
            public float Time { get; set; }

            public FakeClock(float time = 0f) => Time = time;
        }

        private sealed class FakeLogger : ISimulationLogger
        {
            public void Error(string message, Exception exception) { }
        }

        private sealed class SelectionSource : IContentSelectionSource
        {
            public RaceContentSelection Selection { get; set; }

            public SelectionSource(RaceContentSelection selection) => Selection = selection;

            public RaceContentSelection GetSelection() => Selection;
        }

        private sealed class FakeProfileSource : IQualityProfileSource
        {
            public QualityPresetId Current { get; set; } = QualityPresetId.Medium;
        }

        private sealed class FakeOverrideSource : IQualityOverrideSource
        {
            public bool IsReduced { get; private set; }

            public List<bool> ChangedCalls = new List<bool>();

            public event Action<bool> Changed;

            public void SetReduced(bool reduced)
            {
                if (reduced == IsReduced)
                    return; // exactly-once per transition
                IsReduced = reduced;
                ChangedCalls.Add(reduced);
                Changed?.Invoke(reduced);
            }
        }

        private sealed class ThrowingMipmapApplier : ITextureMipmapApplier
        {
            public int ApplyCount;

            public void Apply(int limit)
            {
                ApplyCount++;
                throw new InvalidOperationException("simulated mipmap failure");
            }
        }

        private sealed class RecordingMipmapApplier : ITextureMipmapApplier
        {
            public readonly List<int> AppliedLimits = new List<int>();

            public int ApplyCount => AppliedLimits.Count;

            public void Apply(int limit) => AppliedLimits.Add(limit);
        }

        private sealed class LoadOrderSpyLoader : IAddressableLoader
        {
            public readonly UnityTextureMipmapApplier ObservedApplier;

            public List<FakeHandle> Loads = new List<FakeHandle>();

            public bool MipmapWasAppliedBeforeLoadStart;

            public LoadOrderSpyLoader(UnityTextureMipmapApplier observedApplier) => ObservedApplier = observedApplier;

            public IAsyncLoadHandle LoadAssetAsync(object key, Action<IAsyncLoadHandle> onComplete)
            {
                MipmapWasAppliedBeforeLoadStart = ObservedApplier.LastApplied != -1;
                var handle = new FakeHandle(h => onComplete(h));
                Loads.Add(handle);
                return handle;
            }
        }

        private sealed class Harness
        {
            public FakeLoader Loader = new FakeLoader();
            public FakeInstantiator Instantiator = new FakeInstantiator();
            public FakeMemory Memory = new FakeMemory(0.5f);
            public FakeQuality Quality = new FakeQuality();
            public FakeDiagnostics Diagnostics = new FakeDiagnostics();
            public FakeClock Clock = new FakeClock();
            public SelectionSource Selection;
            public SimulationStateMachine Kernel;
            public ContentCompositionRoot Composition;
            public UnityTextureMipmapApplier Mipmap = new UnityTextureMipmapApplier();
            public FakeProfileSource Profile = new FakeProfileSource();
            public FakeOverrideSource Override = new FakeOverrideSource();

            public Harness()
            {
                Selection = new SelectionSource(new RaceContentSelection(Track, Teams(16)));
                Kernel = new SimulationStateMachine(SimulationState.Idle, new FakeLogger());
                Composition = new ContentCompositionRoot(
                    Selection,
                    new ContentResourceState(true, Array.Empty<string>()),
                    Kernel,
                    Loader,
                    Instantiator,
                    Memory,
                    Quality,
                    Diagnostics,
                    Clock);
                Composition.AttachQualityProfiles(Profile, Mipmap, Override);
            }

            public void StartLoad()
            {
                Composition.StateMachine.OnContentLoadRequested(new ContentLoadRequest(RaceMode.Race, RaceGrid()));
            }

            public void CompleteAll()
            {
                foreach (var (_, handle) in Loader.Loads)
                    handle.Complete(new object());
            }
        }

        private const string Track = "monaco";

        private static string[] Teams(int count) =>
            Enumerable.Range(0, count).Select(i => $"team_{i}").ToArray();

        private static GridAssignment RaceGrid() => new GridAssignment(Enumerable.Range(0, 16).ToArray());

        // ─── MipmapLimitResolver: exact expected values (independent, not self-consistency) ──

        [Test]
        public void Resolver_MapsAllPresets_ExactExpectedValues()
        {
            Assert.That(MipmapLimitResolver.Resolve(QualityPresetId.Low), Is.EqualTo(2), "Low → higher limit (lower resolution).");
            Assert.That(MipmapLimitResolver.Resolve(QualityPresetId.Medium), Is.EqualTo(1));
            Assert.That(MipmapLimitResolver.Resolve(QualityPresetId.High), Is.EqualTo(0), "High → full resolution.");
            Assert.That(MipmapLimitResolver.Resolve(QualityPresetId.Ultra), Is.EqualTo(0));
            Assert.That(MipmapLimitResolver.Resolve(QualityPresetId.Custom), Is.EqualTo(1),
                "Custom → Medium-equivalent fallback (independent exact value — a wrong Custom mutation must fail).");
        }

        [Test]
        public void Resolver_UnknownPreset_Throws()
        {
            Assert.Throws<ArgumentOutOfRangeException>(() => MipmapLimitResolver.Resolve((QualityPresetId)999));
        }

        // ─── AC-QP1a: Low → limit 2 applied at load start (real Unity applier) ─────────

        [Test]
        public void AC_QP1a_LowProfile_LoadStart_AppliesLimit2()
        {
            var h = new Harness();
            h.Profile.Current = QualityPresetId.Low;

            h.StartLoad();

            Assert.That(h.Mipmap.LastApplied, Is.EqualTo(2), "Mipmap limit applied before the load starts.");
            Assert.That(UnityEngine.QualitySettings.globalTextureMipmapLimit, Is.EqualTo(2),
                "Real Unity applier wrote globalTextureMipmapLimit (PlayMode-settable).");
        }

        // ─── AC-QP2a: High → limit 0 applied at load start ──────────────────────────────

        [Test]
        public void AC_QP2a_HighProfile_LoadStart_AppliesLimit0()
        {
            var h = new Harness();
            h.Profile.Current = QualityPresetId.High;

            h.StartLoad();

            Assert.That(h.Mipmap.LastApplied, Is.EqualTo(0), "High → full resolution.");
            Assert.That(UnityEngine.QualitySettings.globalTextureMipmapLimit, Is.EqualTo(0));
        }

        [Test]
        public void LoadStart_WithoutAttach_DoesNotTouchMipmap()
        {
            var h = new Harness();
            var standalone = new ContentCompositionRoot(
                h.Selection,
                new ContentResourceState(true, Array.Empty<string>()),
                h.Kernel,
                h.Loader,
                h.Instantiator,
                h.Memory,
                h.Quality,
                h.Diagnostics,
                h.Clock);
            int before = h.Mipmap.LastApplied;

            standalone.StateMachine.OnContentLoadRequested(new ContentLoadRequest(RaceMode.Race, RaceGrid()));

            Assert.That(h.Mipmap.LastApplied, Is.EqualTo(before), "No mipmap write without attach (additive contract).");
        }

        // ─── Cross-story: override → Low-equivalent, restore → working preset ──────────

        [Test]
        public void CrossStory_OverrideReduced_AppliesLowLimit_ProfileUnchanged()
        {
            var h = new Harness();
            h.Profile.Current = QualityPresetId.High;

            h.Override.SetReduced(true);

            Assert.That(h.Mipmap.LastApplied, Is.EqualTo(2), "Override forces Low-equivalent limit (resolver(Low) = 2).");
            Assert.That(h.Profile.Current, Is.EqualTo(QualityPresetId.High),
                "Persisted/working preset is NEVER rewritten by the override.");
            Assert.That(h.Override.ChangedCalls, Is.EqualTo(new[] { true }), "Exactly one transition event.");
        }

        [Test]
        public void CrossStory_OverrideRestore_ReturnsToWorkingPresetLimit()
        {
            var h = new Harness();
            h.Profile.Current = QualityPresetId.Medium;

            h.Override.SetReduced(true);
            Assert.That(h.Mipmap.LastApplied, Is.EqualTo(2), "Reduced → Low-equivalent.");

            h.Override.SetReduced(false);

            Assert.That(h.Mipmap.LastApplied, Is.EqualTo(1), "Restored → working preset limit (Medium → 1), event-driven.");
            Assert.That(h.Override.ChangedCalls, Is.EqualTo(new[] { true, false }), "Exactly one event per transition.");
        }

        [Test]
        public void CrossStory_OverrideActiveDuringLoad_LoadAppliesLowLimit()
        {
            var h = new Harness();
            h.Profile.Current = QualityPresetId.Ultra;
            h.Override.SetReduced(true);

            h.StartLoad();

            Assert.That(h.Mipmap.LastApplied, Is.EqualTo(2), "Load start honors the active override (Ultra → Low-equivalent).");
        }

        [Test]
        public void CrossStory_OverrideRestore_LoadStart_UsesWorkingPreset()
        {
            var h = new Harness();
            h.Profile.Current = QualityPresetId.Low;
            h.Override.SetReduced(true);
            h.Override.SetReduced(false);

            h.StartLoad();

            Assert.That(h.Mipmap.LastApplied, Is.EqualTo(2), "Restored + Low preset → Low limit (2).");
        }

        // ─── AC-WG5: Medium default via the real applier; Custom behavior ──────────────

        [Test]
        public void WG5_Adapter_ReportsAppliedPreset_AndCustom()
        {
            var applier = new QualityPresetApplier();
            var source = new SettingsQualityProfileSource(applier);

            Assert.That(source.Current, Is.EqualTo(QualityPresetId.Medium),
                "Default applied preset is Medium (WG5 default).");

            // ApplyPreset requires an active URP pipeline — the project assigns one in
            // QualitySettings; if absent the write is Rejected and ActivePreset is untouched.
            var mapping = applier.ResolveMapping(QualityPresetId.Low);
            if (applier.ApplyPreset(mapping) == ApplyStatus.Applied)
                Assert.That(source.Current, Is.EqualTo(QualityPresetId.Low), "Adapter reports the APPLIED preset.");

            applier.MarkCustomOverride();
            Assert.That(source.Current, Is.EqualTo(QualityPresetId.Custom),
                "MarkCustomOverride (no URP dependency) is reported as Custom.");
        }

        [Test]
        public void OverrideSource_TranslatesPerformanceMonitor_ExactlyOncePerTransition()
        {
            var monitor = new PerformanceMonitor(() => { });
            using (var source = new SettingsQualityOverrideSource(monitor))
            {
                Assert.That(source.IsReduced, Is.False, "Initial state mirrors the monitor.");

                var changes = new List<bool>();
                source.Changed += b => changes.Add(b);

                // Below 30 FPS (0.05s/frame = 20 FPS) sustained 3s → Reduced.
                for (int i = 0; i < 61; i++)
                    monitor.Evaluate(0.05f, SimulationState.Racing);

                Assert.That(source.IsReduced, Is.True, "Reduced after sustained low FPS.");
                Assert.That(changes, Is.EqualTo(new[] { true }), "Exactly one Reduced transition.");

                // Above 30 FPS (1/60s/frame) sustained 3s → Restored.
                for (int i = 0; i < 181; i++)
                    monitor.Evaluate(1f / 60f, SimulationState.Racing);

                Assert.That(source.IsReduced, Is.False, "Restored after sustained recovery.");
                Assert.That(changes, Is.EqualTo(new[] { true, false }), "Exactly one Restored transition.");
            }
        }

        [Test]
        public void OverrideSource_Dispose_Unsubscribes()
        {
            var monitor = new PerformanceMonitor(() => { });
            var source = new SettingsQualityOverrideSource(monitor);
            source.Dispose();
            source.Dispose(); // idempotent

            for (int i = 0; i < 61; i++)
                monitor.Evaluate(0.05f, SimulationState.Racing);

            Assert.That(source.IsReduced, Is.False, "No translation after dispose (unsubscribed).");
        }

        [Test]
        public void LoadStart_ApplierThrows_LoadProceeds_NonFatal()
        {
            var h = new Harness();
            h.Composition = new ContentCompositionRoot(
                h.Selection,
                new ContentResourceState(true, Array.Empty<string>()),
                h.Kernel,
                h.Loader,
                h.Instantiator,
                h.Memory,
                h.Quality,
                h.Diagnostics,
                h.Clock);
            var throwing = new ThrowingMipmapApplier();
            h.Composition.AttachQualityProfiles(h.Profile, throwing, h.Override);

            h.StartLoad();

            Assert.That(throwing.ApplyCount, Is.EqualTo(1), "Mipmap attempted at load start.");
            Assert.That(h.Loader.Loads.Count, Is.EqualTo(RaceLoadOrchestrator.MaxCanonicalSlots),
                "A mipmap failure is NON-FATAL — the content load proceeds (SafePublish).");
        }

        [Test]
        public void OverrideTransition_ApplierThrows_Contained_StateStillTransitions()
        {
            var h = new Harness();
            h.Composition = new ContentCompositionRoot(
                h.Selection,
                new ContentResourceState(true, Array.Empty<string>()),
                h.Kernel,
                h.Loader,
                h.Instantiator,
                h.Memory,
                h.Quality,
                h.Diagnostics,
                h.Clock);
            var throwing = new ThrowingMipmapApplier();
            h.Composition.AttachQualityProfiles(h.Profile, throwing, h.Override);

            h.Override.SetReduced(true); // applier throws inside the root handler

            Assert.That(h.Override.IsReduced, Is.True, "Override state transitioned despite the applier failure.");
            Assert.That(throwing.ApplyCount, Is.EqualTo(1), "Apply attempted on the override transition.");
        }

        [Test]
        public void LoadOrder_MipmapApplied_BeforeLoadBegins()
        {
            var h = new Harness();
            var mipmap = new UnityTextureMipmapApplier();
            var spy = new LoadOrderSpyLoader(mipmap);
            h.Composition = new ContentCompositionRoot(
                h.Selection,
                new ContentResourceState(true, Array.Empty<string>()),
                h.Kernel,
                spy,
                h.Instantiator,
                h.Memory,
                h.Quality,
                h.Diagnostics,
                h.Clock);
            h.Composition.AttachQualityProfiles(h.Profile, mipmap, h.Override);

            h.StartLoad();

            Assert.That(spy.MipmapWasAppliedBeforeLoadStart, Is.True,
                "The mipmap policy is applied BEFORE the load begins (LoadStarting fires before RequestTrackLoad forwards).");
        }

        [Test]
        public void OverrideActiveDuringLoad_ReappliesLimit_AtLoadStart()
        {
            var h = new Harness();
            var recorder = new RecordingMipmapApplier();
            h.Composition = new ContentCompositionRoot(
                h.Selection,
                new ContentResourceState(true, Array.Empty<string>()),
                h.Kernel,
                h.Loader,
                h.Instantiator,
                h.Memory,
                h.Quality,
                h.Diagnostics,
                h.Clock);
            h.Composition.AttachQualityProfiles(h.Profile, recorder, h.Override);
            h.Profile.Current = QualityPresetId.Ultra;

            h.Override.SetReduced(true);
            Assert.That(recorder.AppliedLimits, Is.EqualTo(new[] { 2 }), "Override transition applies Low-equivalent (2).");

            h.StartLoad();

            Assert.That(recorder.AppliedLimits, Is.EqualTo(new[] { 2, 2 }),
                "Load start RE-APPLIES the override-honoring limit (not tautological — a second apply must occur).");
        }

        // ─── End-to-end with the REAL adapters (code-review R1 BLOCKING 2/4) ──────────

        [Test]
        public void EndToEnd_RealAdapters_PresetApplied_Load_AppliesMipmap()
        {
            var h = new Harness();
            var applier = new QualityPresetApplier();
            var source = new SettingsQualityProfileSource(applier);
            var mipmap = new UnityTextureMipmapApplier();
            var monitor = new PerformanceMonitor(() => { });
            using (var overrideSource = new SettingsQualityOverrideSource(monitor))
            {
                h.Composition = new ContentCompositionRoot(
                    h.Selection,
                    new ContentResourceState(true, Array.Empty<string>()),
                    h.Kernel,
                    h.Loader,
                    h.Instantiator,
                    h.Memory,
                    h.Quality,
                    h.Diagnostics,
                    h.Clock);
                h.Composition.AttachQualityProfiles(source, mipmap, overrideSource);

                var pipeline = UnityEngine.QualitySettings.renderPipeline as UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset;
                float originalScale = pipeline != null ? pipeline.renderScale : 0f;
                int originalMsaa = pipeline != null ? pipeline.msaaSampleCount : 0;
                try
                {
                    var status = applier.ApplyPreset(applier.ResolveMapping(QualityPresetId.Low));
                    Assert.That(status, Is.EqualTo(ApplyStatus.Applied),
                        "URP pipeline is assigned in this project (QualitySettings) — ApplyPreset must succeed.");

                    h.StartLoad();

                    Assert.That(mipmap.LastApplied, Is.EqualTo(2),
                        "Real adapter chain: ApplyPreset(Low) → ActivePreset=Low → IQualityProfileSource → resolver → mipmap 2.");
                    Assert.That(UnityEngine.QualitySettings.globalTextureMipmapLimit, Is.EqualTo(2));
                }
                finally
                {
                    if (pipeline != null)
                    {
                        pipeline.renderScale = originalScale;
                        pipeline.msaaSampleCount = originalMsaa;
                    }
                }
            }
        }

        [Test]
        public void EndToEnd_RealOverride_DoesNotTouchAppliedPreset()
        {
            var h = new Harness();
            var applier = new QualityPresetApplier();
            var source = new SettingsQualityProfileSource(applier);
            var mipmap = new UnityTextureMipmapApplier();
            var monitor = new PerformanceMonitor(() => { });
            using (var overrideSource = new SettingsQualityOverrideSource(monitor))
            {
                h.Composition = new ContentCompositionRoot(
                    h.Selection,
                    new ContentResourceState(true, Array.Empty<string>()),
                    h.Kernel,
                    h.Loader,
                    h.Instantiator,
                    h.Memory,
                    h.Quality,
                    h.Diagnostics,
                    h.Clock);
                h.Composition.AttachQualityProfiles(source, mipmap, overrideSource);

                applier.MarkCustomOverride();
                Assert.That(source.Current, Is.EqualTo(QualityPresetId.Custom), "Custom applied state (no URP dependency).");

                // 3s de frames a 20 FPS → monitor emite Reduced → override ativo.
                for (int i = 0; i < 61; i++)
                    monitor.Evaluate(0.05f, SimulationState.Racing);

                Assert.That(overrideSource.IsReduced, Is.True, "Real override active after sustained low FPS.");
                Assert.That(source.Current, Is.EqualTo(QualityPresetId.Custom),
                    "The runtime override NEVER rewrites the applied preset (real adapter chain).");
                Assert.That(mipmap.LastApplied, Is.EqualTo(2), "Override remaps to Low-equivalent limit only.");

                // 3s a 60 FPS → restore → volta ao working preset (Custom → 1).
                for (int i = 0; i < 181; i++)
                    monitor.Evaluate(1f / 60f, SimulationState.Racing);

                Assert.That(overrideSource.IsReduced, Is.False, "Restored after recovery.");
                Assert.That(mipmap.LastApplied, Is.EqualTo(1), "Restore returns to the working preset limit (Custom → Medium-equivalent 1).");
                Assert.That(source.Current, Is.EqualTo(QualityPresetId.Custom), "Preset untouched across the whole override cycle.");
            }
        }

        [Test]
        public void OverrideSource_Dispose_WhileReduced_StopsTranslating()
        {
            var monitor = new PerformanceMonitor(() => { });
            var source = new SettingsQualityOverrideSource(monitor);
            for (int i = 0; i < 61; i++)
                monitor.Evaluate(0.05f, SimulationState.Racing);
            Assert.That(source.IsReduced, Is.True, "Reduced before dispose.");

            source.Dispose();

            // Restore no monitor → sem tradução: o estado fica stale (documented desync —
            // após dispose ninguém consome; o desync é o custo aceito do unsubscribe).
            for (int i = 0; i < 181; i++)
                monitor.Evaluate(1f / 60f, SimulationState.Racing);

            Assert.That(source.IsReduced, Is.True, "After dispose the source stops translating (stale state documented).");
        }

        [Test, Order(9999)]
        public void GlobalMipmap_IsolationSentinel_NoCrossTestPollution()
        {
            // Project default (QualitySettings.asset: globalTextureMipmapLimit: 0).
            // Every mutation test in this class runs before this sentinel; if any
            // TearDown restoration were removed, its mutated value (2/1) would leak
            // here and fail the assertion — proving the Save/Restore pair works.
            Assert.That(UnityEngine.QualitySettings.globalTextureMipmapLimit, Is.EqualTo(0),
                "No cross-test pollution: the SetUp/TearDown pair restores the global mipmap limit between tests.");
        }

        // ─── Attach guards ─────────────────────────────────────────────────────────────

        [Test]
        public void AttachQualityProfiles_SingleAttach_SecondThrows()
        {
            var h = new Harness();
            Assert.Throws<InvalidOperationException>(() =>
                h.Composition.AttachQualityProfiles(h.Profile, h.Mipmap, h.Override),
                "Second attach rejected (single-attach guard).");
        }

        [Test]
        public void AttachQualityProfiles_NullArgs_Throw()
        {
            var h = new Harness();
            var standalone = new ContentCompositionRoot(
                h.Selection,
                new ContentResourceState(true, Array.Empty<string>()),
                h.Kernel,
                h.Loader,
                h.Instantiator,
                h.Memory,
                h.Quality,
                h.Diagnostics,
                h.Clock);
            Assert.Throws<ArgumentNullException>(() => standalone.AttachQualityProfiles(null, h.Mipmap, h.Override));
            Assert.Throws<ArgumentNullException>(() => standalone.AttachQualityProfiles(h.Profile, null, h.Override));
            Assert.Throws<ArgumentNullException>(() => standalone.AttachQualityProfiles(h.Profile, h.Mipmap, null));
        }
    }
}
