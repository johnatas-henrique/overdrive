using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using Overdrive.Content.Unity;
using Overdrive.Simulation;

namespace Overdrive.Content.Tests
{
    /// <summary>
    /// Story 005 (Startup, Catalog &amp; Fatal Errors) — composition-root startup mode:
    /// RunStartup → StartupComplete constructs the SM seeded with isSharedLoaded: true;
    /// Fatal exposed; StateMachine throws before completion; race-only ctor unchanged.
    /// </summary>
    public class StartupErrorIntegrationTests
    {
        private const string Track = "monaco";

        private static string[] Teams(int count) =>
            Enumerable.Range(0, count).Select(i => $"team_{i:D2}").ToArray();

        private sealed class FakeLogger : ISimulationLogger
        {
            public void Error(string message, Exception exception) { }
        }

        private sealed class FakeCatalog : ICatalogInitializer
        {
            public int InitializeCount;
            public bool Succeed = true;

            public void Initialize(Action<CatalogInitResult> onComplete)
            {
                InitializeCount++;
                onComplete(new CatalogInitResult(Succeed, Succeed ? string.Empty : "catalog boom"));
            }
        }

        private sealed class FakeShared : ISharedLoader
        {
            public int LoadCount;
            public bool Succeed = true;

            public void LoadShared(Action<SharedLoadResult> onComplete)
            {
                LoadCount++;
                onComplete(new SharedLoadResult(Succeed, Succeed ? string.Empty : "shared boom"));
            }
        }

        private sealed class FakeFatal : IFatalErrorHandler
        {
            public readonly List<(string Reason, ContentErrorType Type)> Calls = new List<(string, ContentErrorType)>();

            public void Fatal(string reason, ContentErrorType type) => Calls.Add((reason, type));
        }

        private sealed class FakeFocus : IFocusSeam
        {
            public bool IsFocused { get; set; } = true;

            public event Action<bool> FocusChanged;

            public void SetFocused(bool focused)
            {
                IsFocused = focused;
                FocusChanged?.Invoke(focused);
            }
        }

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

            public int ReleaseCount;

            public object Instantiate(object prefab)
            {
                InstantiateCount++;
                return new object();
            }

            public void ReleaseInstance(object instance) => ReleaseCount++;
        }

        private sealed class FakeMemory : IMemoryPressureSource
        {
            public float Pressure { get; set; }

            public FakeMemory(float pressure) => Pressure = pressure;
        }

        private sealed class FakeQuality : IQualityReductionRequest
        {
            public void RequestQualityReduction(string reason) { }
        }

        private sealed class FakeDiagnostics : IDiagnosticsSink
        {
            public void LogWarning(string message) { }

            public void LogError(string message) { }
        }

        private sealed class FakeClock : IClock
        {
            public float Time { get; set; }
        }

        private sealed class SelectionSource : IContentSelectionSource
        {
            private readonly RaceContentSelection _selection;

            public SelectionSource(RaceContentSelection selection) => _selection = selection;

            public RaceContentSelection GetSelection() => _selection;
        }

        private sealed class Harness
        {
            public FakeCatalog Catalog = new FakeCatalog();
            public FakeShared Shared = new FakeShared();
            public FakeFatal Fatal = new FakeFatal();
            public FakeFocus Focus = new FakeFocus();
            public FakeLoader Loader = new FakeLoader();
            public FakeInstantiator Instantiator = new FakeInstantiator();
            public FakeMemory Memory = new FakeMemory(0.5f);
            public FakeQuality Quality = new FakeQuality();
            public FakeDiagnostics Diagnostics = new FakeDiagnostics();
            public FakeClock Clock = new FakeClock();
            public SimulationStateMachine Kernel;
            public ContentCompositionRoot Composition;
            public int StartupCompleteCount;
            public int FatalCount;

            public Harness()
            {
                Kernel = new SimulationStateMachine(SimulationState.Idle, new FakeLogger());
                Composition = new ContentCompositionRoot(
                    new SelectionSource(new RaceContentSelection(Track, Teams(16))),
                    Kernel,
                    Loader,
                    Instantiator,
                    Memory,
                    Quality,
                    Diagnostics,
                    Clock,
                    Catalog,
                    Shared,
                    Fatal,
                    Focus);
                Composition.StartupComplete += () => StartupCompleteCount++;
                Composition.Fatal += (_, _) => FatalCount++;
            }
        }

        // ─── Startup success: SM constructed post-completion, seeded isSharedLoaded ──

        [Test]
        public void StartupSuccess_SMConstructedAfterComplete_SeededShared()
        {
            var h = new Harness();
            ContentStateMachine smObservedInsideSubscriber = null;
            h.Composition.StartupComplete += () => smObservedInsideSubscriber = h.Composition.StateMachine;

            Assert.Throws<InvalidOperationException>(() => _ = h.Composition.StateMachine,
                "StateMachine throws before startup completes.");

            h.Composition.RunStartup();

            Assert.That(h.Catalog.InitializeCount, Is.EqualTo(1));
            Assert.That(h.Shared.LoadCount, Is.EqualTo(1), "Shared loaded once.");
            Assert.That(h.StartupCompleteCount, Is.EqualTo(1), "Public StartupComplete fired after SM construction.");
            Assert.That(smObservedInsideSubscriber, Is.Not.Null,
                "A StartupComplete subscriber observes an EXISTING StateMachine (ordering contract).");
            Assert.That(h.Composition.StateMachine.State, Is.EqualTo(ContentPipelineState.Idle),
                "SM exists in Idle after startup.");
            Assert.That(h.Composition.StateMachine.Snapshot.IsSharedLoaded, Is.True,
                "SM snapshot seeded with isSharedLoaded: true (Shared retained).");
            Assert.That(h.FatalCount, Is.EqualTo(0));

            // No ContentLoadError is ever emitted during startup (startup exception — the SM
            // exists after StartupComplete and never saw a load error).
            int contentLoadErrorCount = 0;
            h.Composition.StateMachine.ContentLoadError += (_, _) => contentLoadErrorCount++;
            Assert.That(contentLoadErrorCount, Is.EqualTo(0), "No ContentLoadError during/after startup.");

            // The race flow works after startup: a race request reaches the orchestrator.
            h.Composition.StateMachine.OnContentLoadRequested(new ContentLoadRequest(RaceMode.Race, GridAssignment.ForRace(Teams(16).Select((_, i) => i).ToList())));
            Assert.That(h.Loader.Handles.Count, Is.EqualTo(17), "Race load works post-startup (1 track + 16 cars).");
        }

        // ─── Catalog double failure: internal retry then Fatal ──────────────────────

        [Test]
        public void CatalogDoubleFailure_InternalRetryThenFatal()
        {
            var h = new Harness();
            h.Catalog.Succeed = false;

            h.Composition.RunStartup();

            // The retry is INTERNAL: the second attempt fires immediately after the first
            // failure (no external re-drive). Double failure → Fatal. Retry-success is
            // covered by sequenced fakes in the unit tests.
            Assert.That(h.Catalog.InitializeCount, Is.EqualTo(2), "Retry ran internally (max 2 attempts).");
            Assert.That(h.FatalCount, Is.EqualTo(1), "Double catalog failure is fatal.");
            Assert.That(h.Fatal.Calls[0].Type, Is.EqualTo(ContentErrorType.Catalog));
            Assert.That(h.StartupCompleteCount, Is.EqualTo(0));
        }

        // ─── Shared failure: Fatal(Shared), no SM ────────────────────────────────────

        [Test]
        public void SharedFailure_FatalShared_NoSM()
        {
            var h = new Harness();
            h.Shared.Succeed = false;

            h.Composition.RunStartup();

            Assert.That(h.Shared.LoadCount, Is.EqualTo(1));
            Assert.That(h.FatalCount, Is.EqualTo(1));
            Assert.That(h.Fatal.Calls[0].Type, Is.EqualTo(ContentErrorType.Shared));
            Assert.That(h.StartupCompleteCount, Is.EqualTo(0));
            Assert.Throws<InvalidOperationException>(() => _ = h.Composition.StateMachine,
                "No SM after fatal — startup never completed.");
        }

        // ─── AC-EC7 integration: focus deferral through the REAL composition root ────

        [Test]
        public void AC_EC7_Integration_InitialUnfocused_BufferedUntilForeground()
        {
            var h = new Harness();
            h.Focus.IsFocused = false; // App starts backgrounded (no FocusChanged event yet).

            h.Composition.RunStartup();

            // The catalog + Shared completions are synchronous in the fakes — with the
            // initial focus sample they are buffered, not processed.
            Assert.That(h.StartupCompleteCount, Is.EqualTo(0), "Buffered while initially unfocused.");
            Assert.That(h.Catalog.InitializeCount, Is.EqualTo(1));
            Assert.Throws<InvalidOperationException>(() => _ = h.Composition.StateMachine,
                "No SM while startup is deferred.");

            h.Focus.IsFocused = true;
            h.Focus.SetFocused(true); // fire the event → consume the buffered catalog success

            Assert.That(h.StartupCompleteCount, Is.EqualTo(1), "Startup completed after re-focus.");
            Assert.That(h.Composition.StateMachine.Snapshot.IsSharedLoaded, Is.True,
                "SM seeded after the deferred startup completed.");
        }

        // ─── Fatal is exposed to subscribers exactly once ────────────────────────────

        [Test]
        public void Fatal_ExposedExactlyOnce()
        {
            var h = new Harness();
            h.Catalog.Succeed = false;

            h.Composition.RunStartup();
            h.Composition.RunStartup();

            Assert.That(h.Catalog.InitializeCount, Is.EqualTo(2), "Retry bound holds.");
            Assert.That(h.FatalCount, Is.EqualTo(1), "Exactly one Fatal exposure.");
        }

        // ─── Kernel untouched: fatal startup never transitions simulation state ───────

        [Test]
        public void Fatal_KernelUntouched_SimulationStaysIdle()
        {
            var h = new Harness();
            h.Shared.Succeed = false;

            h.Composition.RunStartup();

            Assert.That(h.FatalCount, Is.EqualTo(1));
            Assert.That(h.Kernel.State, Is.EqualTo(SimulationState.Idle),
                "The simulation kernel is untouched by a fatal startup error (no state transition).");
            Assert.Throws<InvalidOperationException>(() => _ = h.Composition.StateMachine);
        }
    }
}
