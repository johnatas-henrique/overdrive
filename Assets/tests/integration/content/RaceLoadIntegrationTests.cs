using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using Overdrive.Content.Unity;
using Overdrive.Simulation;

namespace Overdrive.Content.Tests
{
    /// <summary>
    /// Integration tests for Story 3-10 (Race Load Orchestration): the full
    /// selection-source → ContentStateMachine → RaceLoadOrchestrator → runtime → forwarder →
    /// Kernel wiring via the <see cref="ContentCompositionRoot"/> (real SM + real
    /// composition + real kernel; the low-level Addressables/memory/clock seams are fakes).
    /// </summary>
    public class RaceLoadIntegrationTests
    {
        private const string Track = "monza";

        // ─── Fakes (low-level seams — the composition + SM + kernel are real) ────────

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

        private sealed class FakeCleanupSeam : IContentCleanupSeam
        {
            public int BeginCleanupCount;

            public int LastCleanupId = -1;

            public void BeginCleanup(int cleanupId)
            {
                BeginCleanupCount++;
                LastCleanupId = cleanupId;
            }
        }

        private sealed class FakeLogger : ISimulationLogger
        {
            public void Error(string message, Exception exception) { }
        }

        private sealed class Harness
        {
            public FakeLoader Loader = new FakeLoader();
            public FakeInstantiator Instantiator = new FakeInstantiator();
            public FakeMemory Memory = new FakeMemory(0.5f);
            public FakeQuality Quality = new FakeQuality();
            public FakeDiagnostics Diagnostics = new FakeDiagnostics();
            public FakeClock Clock = new FakeClock();
            public FakeCleanupSeam Cleanup = new FakeCleanupSeam();
            public SelectionSource Selection;
            public SimulationStateMachine Kernel;
            public ContentCompositionRoot Composition;
            public int ContentLoadErrorCount;

            public Harness(int carCount = 16)
            {
                Selection = new SelectionSource(new RaceContentSelection(Track, Teams(carCount)));
                Kernel = new SimulationStateMachine(SimulationState.Idle, new FakeLogger());
                Composition = new ContentCompositionRoot(
                    Selection,
                    Cleanup,
                    new ContentResourceState(true, Array.Empty<string>()),
                    Kernel,
                    Loader,
                    Instantiator,
                    Memory,
                    Quality,
                    Diagnostics,
                    Clock);
                Composition.StateMachine.ContentLoadError += (_, _) => ContentLoadErrorCount++;
            }

            public void SetSelection(int carCount) =>
                Selection.Selection = new RaceContentSelection(Track, Teams(carCount));

            public void StartLoad(GridAssignment grid)
            {
                Composition.StateMachine.OnContentLoadRequested(new ContentLoadRequest(RaceMode.Race, grid));
            }

            public void CompleteAll()
            {
                foreach (var (_, handle) in Loader.Loads)
                    handle.Complete(new object());
            }
        }

        private sealed class SelectionSource : IContentSelectionSource
        {
            public RaceContentSelection Selection { get; set; }

            public SelectionSource(RaceContentSelection selection) => Selection = selection;

            public RaceContentSelection GetSelection() => Selection;
        }

        private static string[] Teams(int count) =>
            Enumerable.Range(0, count).Select(i => $"team_{i}").ToArray();

        private static GridAssignment RaceGrid() => new GridAssignment(Enumerable.Range(0, 16).ToArray());

        // ─── AC-LO3: composition wiring, exact grid forwarding, runtime handoff ──────

        [Test]
        public void AC_LO3_EndToEnd_Composition_ReadinessForwarded_ExactGrid_HandoffValid()
        {
            var h = new Harness();
            GridAssignment grid = RaceGrid();
            h.StartLoad(grid);

            // Verify the composition started 17 loads through the proxy + orchestrator.
            Assert.That(h.Loader.Loads.Count, Is.EqualTo(RaceLoadOrchestrator.MaxCanonicalSlots));

            h.CompleteAll();

            // Readiness forwarded exactly once, with the EXACT request grid.
            Assert.That(h.Composition.Runtime.Grid, Is.Not.Null, "Grid populated before readiness (AC-LO3).");
            Assert.That(h.Composition.Runtime.Grid.GridSlots, Is.EqualTo(grid.GridSlots), "Exact GridAssignment forwarding.");
            Assert.That(h.Composition.Runtime.TrackInstance, Is.Not.Null, "Track instance populated.");
            Assert.That(h.Composition.Runtime.CarReferences.Count, Is.EqualTo(16), "All car refs populated.");
            Assert.That(h.Composition.Runtime.IsValid, Is.True, "Handoff valid after readiness (SM.HandoffValid).");
            Assert.That(h.Composition.StateMachine.State, Is.EqualTo(ContentPipelineState.Racing));
        }

        // ─── Selection registration: the load uses the registered selection ──────────

        [Test]
        public void SelectionRegistration_LoadUsesRegisteredTeamIds()
        {
            var h = new Harness();
            h.StartLoad(RaceGrid());

            Assert.That(h.Loader.Loads[0].Key, Is.EqualTo(AddressableKeys.TrackData(Track)));
            foreach (string team in Teams(16))
                Assert.That(h.Loader.Loads.Skip(1).Select(l => l.Key), Has.Member(AddressableKeys.CarDefinition(team)),
                    "Every registered team id has a car address.");
        }

        // ─── Session fencing end-to-end: next-race supersedes stale callbacks ────────

        [Test]
        public void Fencing_EndToEnd_NextRace_StaleHandleIgnored()
        {
            var h = new Harness();
            h.StartLoad(RaceGrid());
            h.CompleteAll(); // Racing
            FakeHandle staleHandle = h.Loader.Handles[1];

            // Next race with a CHANGED selection (15 cars ≠ 16) → the SM issues a fresh load.
            h.SetSelection(15);
            h.StartLoad(RaceGrid());
            Assert.That(h.Composition.StateMachine.State, Is.EqualTo(ContentPipelineState.LoadingTrack), "New session restarted loading.");

            // The stale handle from session 1 completes after the reset — ignored.
            staleHandle.Complete(new object());
            Assert.That(h.Composition.StateMachine.State, Is.EqualTo(ContentPipelineState.LoadingTrack), "Stale completion did not advance the new session.");
        }

        // ─── Memory abort end-to-end: releases + error event + handoff invalid ───────

        [Test]
        public void MemoryAbort_EndToEnd_ErrorEmitted_HandlesReleased_HandoffInvalid()
        {
            var h = new Harness();
            h.StartLoad(RaceGrid());
            h.Memory.Pressure = 0.97f;
            h.Clock.Time = 1f;

            h.Loader.Handles[0].Complete(new object()); // triggers per-completion memory sample → abort

            // Abort → SM enters Unloading → cleanup begun (Story 004 would release the retained handles).
            Assert.That(h.Cleanup.BeginCleanupCount, Is.EqualTo(1), "Cleanup begun on abort (AC-SM4 ordering).");
            // Memory sampled BEFORE the success report → all 17 handles still in flight when the abort fired.
            Assert.That(h.Loader.Handles.All(x => x.ReleaseCount == 1), Is.True, "All 17 in-flight handles released on abort.");

            // Cleanup completes → the error is emitted AFTER cleanup (cleanup-before-error, AC-SM4).
            h.Composition.StateMachine.ReportCleanupComplete(h.Cleanup.LastCleanupId);
            Assert.That(h.ContentLoadErrorCount, Is.EqualTo(1), "ContentLoadError emitted after cleanup (AC-SM4).");
            Assert.That(h.Composition.Runtime.IsValid, Is.False, "Handoff invalidated by the error path.");
            Assert.That(h.Diagnostics.Errors.Count, Is.EqualTo(1), "Error logged via diagnostics.");
        }

        // ─── Grid populated BEFORE the Kernel forward (composition-root ordering) ────

        [Test]
        public void Grid_PopulatedBeforeKernelForward()
        {
            var h = new Harness();
            bool gridSeenAtCountdown = false;

            // The kernel raises StateChanged when it transitions to Countdown — which happens
            // INSIDE the readiness forward. At that instant, the runtime grid must ALREADY be
            // populated (the composition root calls SetGrid before kernel.OnRaceLoadReady).
            h.Kernel.StateChanged += change =>
            {
                if (change.Current == SimulationState.Countdown)
                    gridSeenAtCountdown = h.Composition.Runtime.Grid != null;
            };

            // Put the kernel in Loading (Idle → Loading via StartSingleRace — the real flow the
            // RaceSessionManager drives). OnRaceLoadReady only accepts readiness in Loading.
            GridAssignment grid = RaceGrid();
            Assert.That(h.Kernel.StartSingleRace(grid), Is.True, "Kernel moved Idle → Loading.");
            h.StartLoad(grid);
            h.CompleteAll();

            Assert.That(gridSeenAtCountdown, Is.True, "Runtime grid populated at the instant the kernel entered Countdown (SetGrid ran before the forward).");
            Assert.That(h.Composition.StateMachine.State, Is.EqualTo(ContentPipelineState.Racing));
        }

        // ─── Degraded car through the REAL runtime (null slot, readiness, 100%) ─────

        [Test]
        public void DegradedCar_RealRuntime_NullSlot_Readiness_Progress100()
        {
            var h = new Harness();
            h.StartLoad(RaceGrid());

            // Car team_01 fails; the rest complete normally.
            h.Loader.Handles[1].Fail(new Exception("bundle corrupt"));
            for (int i = 0; i < h.Loader.Handles.Count; i++)
            {
                if (i != 1 && !h.Loader.Handles[i].IsDone)
                    h.Loader.Handles[i].Complete(new object());
            }

            Assert.That(h.Composition.StateMachine.State, Is.EqualTo(ContentPipelineState.Racing), "Degraded car does not block readiness.");
            Assert.That(h.Composition.Runtime.IsValid, Is.True);
            Assert.That(h.Composition.Runtime.CarReferences.Count, Is.EqualTo(16), "The runtime array keeps 16 slots.");
            Assert.That(h.Composition.Runtime.CarReferences[0], Is.Null, "The degraded slot (team_00) is a NULL entry in the real runtime (placeholder fills it downstream).");
            Assert.That(h.Composition.Runtime.CarReferences[1], Is.Not.Null, "Team 01 present.");
            Assert.That(h.Composition.Runtime.CarReferences[15], Is.Not.Null, "Team 15 present.");
            Assert.That(h.Loader.Handles[1].ReleaseCount, Is.EqualTo(1), "Failed handle released.");
        }

        // ─── Full release (Story 004 unload path): handles + track instance ──────────

        [Test]
        public void TerminalAbort_EndToEnd_CleanupThenError_HandoffInvalid_RetainedSurvive()
        {
            var h = new Harness();
            h.StartLoad(RaceGrid());

            // 16 complete under normal pressure (retained); the 17th aborts on high pressure.
            for (int i = 0; i < 16; i++)
                h.Loader.Handles[i].Complete(new object());
            h.Memory.Pressure = 0.97f;
            h.Loader.Handles[16].Complete(new object());
            Assert.That(h.Cleanup.BeginCleanupCount, Is.EqualTo(1), "Abort on the terminal completion reaches cleanup.");
            Assert.That(h.Loader.Handles.Take(16).All(x => x.ReleaseCount == 0), Is.True, "Retained handles survive the abort (no double-release).");
            Assert.That(h.Loader.Handles[16].ReleaseCount, Is.EqualTo(1), "Only the in-flight handle is released by the abort.");

            // Cleanup completes → error emitted once, SM returns to Idle, handoff invalid.
            h.Composition.StateMachine.ReportCleanupComplete(h.Cleanup.LastCleanupId);
            Assert.That(h.ContentLoadErrorCount, Is.EqualTo(1), "Exactly one ContentLoadError after cleanup.");
            Assert.That(h.Composition.StateMachine.State, Is.EqualTo(ContentPipelineState.Idle));
            Assert.That(h.Composition.Runtime.IsValid, Is.False, "Handoff invalidated by the error path.");

            // The full release (Story 004 unload path) releases the retained handles.
            h.Composition.ReleaseAll();
            Assert.That(h.Loader.Handles.Take(16).All(x => x.ReleaseCount == 1), Is.True, "ReleaseAll releases the retained handles.");
        }

        [Test]
        public void AddressableLoader_NullKey_Throws()
        {
            var loader = new AddressableLoader();
            Assert.Throws<ArgumentNullException>(() => loader.LoadAssetAsync(null, _ => { }));
        }

        [Test]
        public void ReleaseAll_DestroysTrackInstanceAndReleasesHandles()
        {
            var h = new Harness();
            h.StartLoad(RaceGrid());
            h.CompleteAll();

            Assert.That(h.Instantiator.InstantiateCount, Is.EqualTo(1), "Track instantiated.");
            Assert.That(h.Loader.Handles.All(x => x.ReleaseCount == 0), Is.True, "All handles retained after a full load.");

            h.Composition.ReleaseAll();
            Assert.That(h.Instantiator.ReleaseCount, Is.EqualTo(1), "Track instance destroyed by ReleaseAll.");
            Assert.That(h.Loader.Handles.All(x => x.ReleaseCount == 1), Is.True, "All retained handles released by ReleaseAll.");
        }
    }
}
