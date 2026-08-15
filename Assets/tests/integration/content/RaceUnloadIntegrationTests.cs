using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using Overdrive.Content.Unity;
using Overdrive.Simulation;

namespace Overdrive.Content.Tests
{
    /// <summary>
    /// Integration tests for Story 3-11 (Race Unload): the REAL composition root — real SM +
    /// real <see cref="RaceCleanupSeam"/> + real <see cref="UnityContentRuntime"/> (the
    /// Addressables/memory/clock seams are fakes). Issues a real unload request and asserts
    /// the REAL <c>ReleaseAll()</c> release order (instance before handle, ADR-0003:100-105),
    /// the completion-id echo, <c>ContentUnloadComplete</c>, SM → CP_Idle, and the
    /// AC-UL2/UL6 postconditions (retained set empty, track instance null). Closes the
    /// FakeCleanupSeam gap — the 3-10 integration tests could not catch missing production
    /// cleanup wiring; these do.
    /// </summary>
    public class RaceUnloadIntegrationTests
    {
        private const string Track = "monza";

        // ─── Fakes (low-level seams — the composition, SM, seam, runtime are real) ────

        private sealed class FakeHandle : IAsyncLoadHandle
        {
            private readonly Action<FakeHandle> _onComplete;

            public FakeHandle(Action<FakeHandle> onComplete, List<string> operationLog)
            {
                _onComplete = onComplete;
                _operationLog = operationLog;
            }

            private readonly List<string> _operationLog;

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

            public void Release()
            {
                ReleaseCount++;
                _operationLog.Add("release-handle");
            }
        }

        private sealed class FakeLoader : IAddressableLoader
        {
            private readonly List<string> _operationLog;

            public FakeLoader(List<string> operationLog) => _operationLog = operationLog;

            public List<(string Key, FakeHandle Handle)> Loads = new List<(string, FakeHandle)>();

            public IAsyncLoadHandle LoadAssetAsync(object key, Action<IAsyncLoadHandle> onComplete)
            {
                var handle = new FakeHandle(h => onComplete(h), _operationLog);
                Loads.Add(((string)key, handle));
                return handle;
            }

            public IReadOnlyList<FakeHandle> Handles => Loads.Select(l => l.Handle).ToList();
        }

        private sealed class FakeInstantiator : IContentInstantiator
        {
            private readonly List<string> _operationLog;

            public FakeInstantiator(List<string> operationLog) => _operationLog = operationLog;

            public int InstantiateCount;

            public int ReleaseCount;

            public object Instantiate(object prefab)
            {
                InstantiateCount++;
                _operationLog.Add("instantiate");
                return new object();
            }

            public void ReleaseInstance(object instance)
            {
                ReleaseCount++;
                _operationLog.Add("release-instance");
            }
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

            public FakeClock(float time = 0f) => Time = time;
        }

        private sealed class FakeLogger : ISimulationLogger
        {
            public void Error(string message, Exception exception) { }
        }

        private sealed class Harness
        {
            public List<string> OperationLog = new List<string>();
            public FakeLoader Loader;
            public FakeInstantiator Instantiator;
            public FakeMemory Memory = new FakeMemory(0.5f);
            public FakeQuality Quality = new FakeQuality();
            public FakeDiagnostics Diagnostics = new FakeDiagnostics();
            public FakeClock Clock = new FakeClock();
            private readonly SelectionSource _selection;
            public SimulationStateMachine Kernel;
            public ContentCompositionRoot Composition;
            public int ContentUnloadCompleteCount;

            public Harness()
            {
                Loader = new FakeLoader(OperationLog);
                Instantiator = new FakeInstantiator(OperationLog);
                _selection = new SelectionSource(new RaceContentSelection(Track, Teams(16)));
                Kernel = new SimulationStateMachine(SimulationState.Idle, new FakeLogger());
                Composition = new ContentCompositionRoot(
                    _selection,
                    new ContentResourceState(true, Array.Empty<string>()),
                    Kernel,
                    Loader,
                    Instantiator,
                    Memory,
                    Quality,
                    Diagnostics,
                    Clock);
                Composition.StateMachine.ContentUnloadComplete += () => ContentUnloadCompleteCount++;
            }

            public void SetSelection(int carCount) =>
                _selection.Selection = new RaceContentSelection(Track, Teams(carCount));

            public void StartLoad() =>
                Composition.StateMachine.OnContentLoadRequested(new ContentLoadRequest(RaceMode.Race, RaceGrid()));

            public void CompleteAll()
            {
                foreach (var (_, handle) in Loader.Loads)
                    handle.Complete(new object());
            }

            public void Unload() => Composition.StateMachine.OnContentUnloadRequested();

            private sealed class SelectionSource : IContentSelectionSource
            {
                public RaceContentSelection Selection { get; set; }

                public SelectionSource(RaceContentSelection selection) => Selection = selection;

                public RaceContentSelection GetSelection() => Selection;
            }

            private static string[] Teams(int count) =>
                Enumerable.Range(0, count).Select(i => $"team_{i}").ToArray();

            private static GridAssignment RaceGrid() => new GridAssignment(Enumerable.Range(0, 16).ToArray());
        }

        // ─── AC-UL1: real unload — instance released FIRST, then handles ─────────────

        [Test]
        public void AC_UL1_RealUnload_InstanceBeforeHandles_UnloadComplete_Idle()
        {
            var h = new Harness();
            h.StartLoad();
            h.CompleteAll(); // Racing — track instance + 17 retained handles.

            Assert.That(h.Instantiator.InstantiateCount, Is.EqualTo(1), "Track instantiated.");
            Assert.That(h.Loader.Handles.All(x => x.ReleaseCount == 0), Is.True, "All handles retained after a full load.");

            h.Unload();

            // The real cleanup seam ran: ReleaseAll (instance first, then handles) + echo →
            // ContentUnloadComplete + SM Idle.
            Assert.That(h.Instantiator.ReleaseCount, Is.EqualTo(1), "Track instance destroyed by the real cleanup seam.");
            Assert.That(h.Loader.Handles.All(x => x.ReleaseCount == 1), Is.True, "All retained handles released.");
            Assert.That(h.ContentUnloadCompleteCount, Is.EqualTo(1), "ContentUnloadComplete fired after the echo.");
            Assert.That(h.Composition.StateMachine.State, Is.EqualTo(ContentPipelineState.Idle));
            Assert.That(h.Composition.Runtime.IsValid, Is.False, "Handoff invalidated by the unload path.");
        }

        // ─── AC-UL1 order: ReleaseInstance BEFORE the handle Release calls ───────────

        [Test]
        public void AC_UL1_ReleaseOrder_InstanceFirstPerADR()
        {
            var h = new Harness();
            h.StartLoad();
            h.CompleteAll();
            h.OperationLog.Clear();

            h.Unload();

            // ADR-0003:100-105: the instance is released BEFORE any base handle release.
            int instanceIndex = h.OperationLog.IndexOf("release-instance");
            int firstHandleIndex = h.OperationLog.IndexOf("release-handle");
            Assert.That(instanceIndex, Is.EqualTo(0), "ReleaseInstance runs first (instances-before-handles).");
            Assert.That(firstHandleIndex, Is.GreaterThan(instanceIndex), "Every handle release runs after the instance release.");
            Assert.That(h.Loader.Handles.All(x => x.ReleaseCount == 1), Is.True, "Handles released after the instance.");
        }

        // ─── AC-UL2/UL6: retained set empty + track null after unload ────────────────

        [Test]
        public void AC_UL2_UL6_AfterUnload_RetainedEmpty_TrackNull()
        {
            var h = new Harness();
            h.StartLoad();
            h.CompleteAll();
            Assert.That(h.Composition.Runtime.TrackInstance, Is.Not.Null, "Track present before unload.");

            h.Unload();

            Assert.That(h.Composition.Runtime.TrackInstance, Is.Null, "Track instance null after unload (AC-UL6).");
            Assert.That(h.Composition.Runtime.CarReferences.Count, Is.EqualTo(0), "Car references cleared after unload (no car residuals, AC-UL6).");
            Assert.That(h.Composition.StateMachine.State, Is.EqualTo(ContentPipelineState.Idle));
            Assert.That(h.ContentUnloadCompleteCount, Is.EqualTo(1));
        }

        // ─── AC-UL5: no leak — every instance and handle released exactly once ───────

        [Test]
        public void AC_UL5_NoLeak_ExactlyOnceReleases()
        {
            var h = new Harness();
            h.StartLoad();
            h.CompleteAll();

            h.Unload();

            Assert.That(h.Instantiator.ReleaseCount, Is.EqualTo(1), "Track instance released exactly once.");
            Assert.That(h.Loader.Handles.All(x => x.ReleaseCount == 1), Is.True, "Every handle released exactly once (no double-release, no leak).");
            Assert.That(h.Composition.StateMachine.State, Is.EqualTo(ContentPipelineState.Idle));
        }

        // ─── Idempotency through the REAL root: second unload is a no-op ─────────────

        [Test]
        public void Idempotency_SecondUnload_NoDoubleRelease()
        {
            var h = new Harness();
            h.StartLoad();
            h.CompleteAll();
            h.Unload();

            h.Unload(); // Idle → no-op.

            Assert.That(h.Instantiator.ReleaseCount, Is.EqualTo(1), "No second instance release.");
            Assert.That(h.Loader.Handles.All(x => x.ReleaseCount == 1), Is.True, "No double handle release.");
            Assert.That(h.ContentUnloadCompleteCount, Is.EqualTo(1), "No second ContentUnloadComplete.");
        }

        // ─── Empty runtime: unload from Idle (never loaded) is a no-op ───────────────

        [Test]
        public void EmptyRuntime_UnloadFromIdle_NoOp()
        {
            var h = new Harness();
            Assert.That(h.Composition.StateMachine.State, Is.EqualTo(ContentPipelineState.Idle));

            h.Unload(); // OnContentUnloadRequested in Idle = no-op (AC-SM3).

            Assert.That(h.Composition.StateMachine.State, Is.EqualTo(ContentPipelineState.Idle));
            Assert.That(h.Instantiator.ReleaseCount, Is.EqualTo(0), "No release with an empty runtime.");
            Assert.That(h.ContentUnloadCompleteCount, Is.EqualTo(0), "No completion with an empty runtime.");
        }

        // ─── Next-race supersede followed by unload: no double release, one completion ─

        [Test]
        public void NextRaceThenUnload_NoDoubleRelease_SingleCompletion()
        {
            var h = new Harness();
            h.StartLoad();
            h.CompleteAll(); // Racing (session 1).
            Assert.That(h.Loader.Handles.All(x => x.ReleaseCount == 0), Is.True, "Session 1 handles retained.");

            // Next race (CHANGED selection → supersede — no cleanup path, orchestrator releases inline).
            h.SetSelection(15);
            h.StartLoad();
            Assert.That(h.Loader.Handles.Take(17).All(x => x.ReleaseCount == 1), Is.True, "Session 1 handles released by the next-race inline release.");
            h.CompleteAll(); // Racing (session 2 — 16 new handles).

            h.Unload(); // Cleanup of session 2.

            Assert.That(h.Loader.Handles.All(x => x.ReleaseCount == 1), Is.True,
                "Every handle released exactly once total (session 1 by next-race, session 2 by unload) — no double-release.");
            Assert.That(h.Loader.Loads.Count, Is.EqualTo(33), "Two sessions loaded (17 + 16 — changed selection).");
            Assert.That(h.ContentUnloadCompleteCount, Is.EqualTo(1), "Exactly one ContentUnloadComplete.");
            Assert.That(h.Composition.StateMachine.State, Is.EqualTo(ContentPipelineState.Idle));
        }
    }
}
