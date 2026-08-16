using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using Overdrive.Simulation;

namespace Overdrive.Content.Tests
{
    /// <summary>
    /// Unit tests for <see cref="RaceLoadOrchestrator"/> (Story 3-10 — Race Load
    /// Orchestration): 17-parallel orchestration, byte-derived progress, memory policy,
    /// degraded car path, session fencing — all engine-free via fakes.
    /// </summary>
    public class RaceLoadTests
    {
        private const string Track = "monaco";

        // Zero-padded team ids so lexicographic order == numeric order (team_00..team_15).
        private static string[] Teams(int count) =>
            Enumerable.Range(0, count).Select(i => $"team_{i:D2}").ToArray();

        // ─── Fakes ────────────────────────────────────────────────────────────────────

        private sealed class FakeHandle : IAsyncLoadHandle
        {
            private readonly Action<FakeHandle> _onComplete;

            public FakeHandle(Action<FakeHandle> onComplete) => _onComplete = onComplete;

            public bool IsDone { get; private set; }

            public object Result { get; private set; }

            public Exception OperationException { get; private set; }

            public long DownloadedBytes;

            public long TotalBytes;

            public int ReleaseCount;

            public (long DownloadedBytes, long TotalBytes) GetDownloadStatus() => (DownloadedBytes, TotalBytes);

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

            public bool Throw;

            public object Instantiate(object prefab)
            {
                if (Throw)
                    throw new InvalidOperationException("track root is not a GameObject");
                InstantiateCount++;
                return new object();
            }

            public void ReleaseInstance(object instance) => ReleaseCount++;
        }

        private sealed class FakeMemory : IMemoryPressureSource
        {
            private float _pressure;

            public int ReadCount;

            public FakeMemory(float pressure) => _pressure = pressure;

            public float Pressure
            {
                get
                {
                    ReadCount++;
                    return _pressure;
                }
                set => _pressure = value;
            }
        }

        private sealed class FakeQuality : IQualityReductionRequest
        {
            public int RequestCount;

            public List<string> Reasons = new List<string>();

            public void RequestQualityReduction(string reason)
            {
                RequestCount++;
                Reasons.Add(reason);
            }
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

        private sealed class SpyReporter : IContentLoadReporter
        {
            public int Generation = 42;

            public List<int> TrackGenerations = new List<int>();

            public List<int> CarGenerations = new List<int>();

            public int SessionGeneration => Generation;

            public void ReportTrackLoaded(int sessionGeneration) => TrackGenerations.Add(sessionGeneration);

            public void ReportCarLoaded(int sessionGeneration, string teamId) => CarGenerations.Add(sessionGeneration);

            public void ReportCarDegraded(int sessionGeneration, string teamId) => CarGenerations.Add(sessionGeneration);

            public void ReportLoadError(int sessionGeneration, ContentErrorType type, string reason) { }
        }

        private sealed class FakeAccumulator : IRaceContentAccumulator
        {
            public object TrackInstance { get; private set; }

            public List<object> CarReferencesList = new List<object>();

            public object[] CarReferencesArray = new object[0];

            public List<IAsyncLoadHandle> Retained = new List<IAsyncLoadHandle>();

            public GridAssignment Grid;

            public int ResetCount;

            public int ReleaseRetainedCount;

            public List<string> OpLog = new List<string>();

            public void Reset()
            {
                ResetCount++;
                TrackInstance = null;
                CarReferencesArray = new object[0];
                OpLog.Add("Reset");
            }

            public void SetTrackInstance(object trackInstance)
            {
                TrackInstance = trackInstance;
                OpLog.Add("SetTrack");
            }

            public void BeginCarReferences(int count) => CarReferencesArray = new object[count];

            public void SetCarReference(int teamIndex, object carPrefab)
            {
                CarReferencesArray[teamIndex] = carPrefab;
                CarReferencesList.Add(carPrefab);
                OpLog.Add($"Car@{teamIndex}");
            }

            public void AddRetainedHandle(IAsyncLoadHandle handle) => Retained.Add(handle);

            public void ReleaseRetainedHandles()
            {
                ReleaseRetainedCount++;
                Retained.Clear();
            }

            public void SetGrid(GridAssignment grid)
            {
                Grid = grid;
                OpLog.Add("SetGrid");
            }
        }

        private sealed class FakeSelectionSource : IContentSelectionSource
        {
            public RaceContentSelection Selection { get; set; }

            public FakeSelectionSource(RaceContentSelection selection) => Selection = selection;

            public RaceContentSelection GetSelection() => Selection;
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

        private sealed class FakeForwarder : IReadinessForwarder
        {
            public List<(RaceMode Mode, GridAssignment Grid)> Calls = new List<(RaceMode, GridAssignment)>();

            public bool TrackSetAtForward;

            public bool AllCarsSetAtForward;

            public bool GridSetAtForward;

            public Func<bool> TrackSetAtForwardCheck;

            public Func<bool> AllCarsSetAtForwardCheck;

            public Func<bool> GridSetAtForwardCheck;

            public void Forward(RaceMode raceMode, GridAssignment gridAssignment)
            {
                if (TrackSetAtForwardCheck != null)
                    TrackSetAtForward = TrackSetAtForwardCheck();
                if (AllCarsSetAtForwardCheck != null)
                    AllCarsSetAtForward = AllCarsSetAtForwardCheck();
                if (GridSetAtForwardCheck != null)
                    GridSetAtForward = GridSetAtForwardCheck();
                Calls.Add((raceMode, gridAssignment));
            }
        }

        private sealed class ProxyLoadSeam : IContentLoadSeam
        {
            private IContentLoadSeam _target;

            public void Bind(IContentLoadSeam target) => _target = target;

            public void RequestTrackLoad(string trackId) => _target.RequestTrackLoad(trackId);

            public void RequestCarLoads(IReadOnlyList<string> teamIds) => _target.RequestCarLoads(teamIds);
        }

        private sealed class Harness
        {
            public FakeLoader Loader = new FakeLoader();
            public FakeInstantiator Instantiator = new FakeInstantiator();
            public FakeMemory Memory = new FakeMemory(0.5f);
            public FakeQuality Quality = new FakeQuality();
            public FakeDiagnostics Diagnostics = new FakeDiagnostics();
            public FakeClock Clock = new FakeClock();
            public FakeAccumulator Accumulator = new FakeAccumulator();
            public FakeCleanupSeam Cleanup = new FakeCleanupSeam();
            public FakeForwarder Forwarder = new FakeForwarder();
            public FakeSelectionSource SelectionSource;
            public ContentStateMachine Sm;
            public RaceLoadOrchestrator Orchestrator;
            public int ContentLoadErrorCount;
            public bool ProgressSubscriberThrows;
            public List<(string Reason, ContentErrorType Type)> Errors = new List<(string, ContentErrorType)>();

            public Harness(int carCount = 16)
            {
                SelectionSource = new FakeSelectionSource(new RaceContentSelection(Track, Teams(carCount)));
                var proxy = new ProxyLoadSeam();
                Sm = new ContentStateMachine(SelectionSource, proxy, Cleanup, Forwarder,
                    new ContentResourceState(true, Array.Empty<string>()));
                Sm.ContentLoadError += (reason, type) => { ContentLoadErrorCount++; Errors.Add((reason, type)); };
                Orchestrator = new RaceLoadOrchestrator(Sm, Loader, Instantiator, Memory, Quality, Diagnostics, Clock, Accumulator);
                Forwarder.TrackSetAtForwardCheck = () => Accumulator.TrackInstance != null;
                Forwarder.AllCarsSetAtForwardCheck = () => Accumulator.CarReferencesArray.Length == 16 && Accumulator.CarReferencesArray.All(x => x != null);
                Orchestrator.ProgressChanged += _ =>
                {
                    if (ProgressSubscriberThrows)
                        throw new InvalidOperationException("ui subscriber bug");
                };
                proxy.Bind(Orchestrator);
            }

            public void SetSelection(int carCount) =>
                SelectionSource.Selection = new RaceContentSelection(Track, Teams(carCount));

            public void StartLoad()
            {
                var grid = new GridAssignment(Enumerable.Range(0, 16).ToArray());
                Sm.OnContentLoadRequested(new ContentLoadRequest(RaceMode.Race, grid));
            }

            public void CompleteAll()
            {
                foreach (var (_, handle) in Loader.Loads)
                    handle.Complete(new object());
            }

            public void CompleteCleanup() => Sm.ReportCleanupComplete(Cleanup.LastCleanupId);
        }

        // ─── AC-LO1: 17 parallel handles ─────────────────────────────────────────────

        [Test]
        public void AC_LO1_All17HandlesStarted_BeforeAnyCompletion()
        {
            var h = new Harness();
            h.StartLoad();

            Assert.That(h.Loader.Loads.Count, Is.EqualTo(RaceLoadOrchestrator.MaxCanonicalSlots), "1 track + 16 cars started together.");
            Assert.That(h.Loader.Loads[0].Key, Is.EqualTo(AddressableKeys.TrackData(Track)), "Track requested first.");
            Assert.That(h.Loader.Loads.Skip(1).Select(l => l.Key),
                Is.EqualTo(Teams(16).Select(AddressableKeys.CarDefinition)), "16 car addresses requested.");
            Assert.That(h.Loader.Handles.All(x => !x.IsDone), Is.True, "No completion yet — all 17 in flight simultaneously.");
        }

        // ─── AC-LO2: progress monotonic, byte-derived ────────────────────────────────

        [Test]
        public void AC_LO2_Progress_Monotonic_ByteDerived()
        {
            var h = new Harness();
            h.StartLoad();

            // 17 handles × 100 bytes each = 1700 total. In-flight handles have downloaded 0.
            foreach (var (_, handle) in h.Loader.Loads)
                handle.TotalBytes = 100;

            // First 8 complete with their 100 bytes → (800 downloaded)/(800 + 9×100 pending) ≈ 0.47.
            for (int i = 0; i < 8; i++)
            {
                h.Loader.Handles[i].DownloadedBytes = 100;
                h.Loader.Handles[i].Complete(new object());
            }

            Assert.That(h.Orchestrator.Progress, Is.EqualTo(800f / 1700f).Within(0.001f));

            // 8 more → (1600)/(1600 + 1×100) ≈ 0.94.
            for (int i = 8; i < 16; i++)
            {
                h.Loader.Handles[i].DownloadedBytes = 100;
                h.Loader.Handles[i].Complete(new object());
            }

            Assert.That(h.Orchestrator.Progress, Is.EqualTo(1600f / 1700f).Within(0.001f), "Monotonic increase.");
            Assert.That(h.Orchestrator.Progress, Is.GreaterThan(0.47f));
        }

        [Test]
        public void AC_LO2_CachedZeroTotal_ProgressZeroWhilePending()
        {
            var h = new Harness();
            h.StartLoad();

            // Cached loads: total bytes = 0 → progress stays 0 while any handle pending.
            h.Loader.Handles[0].Complete(new object());
            Assert.That(h.Orchestrator.Progress, Is.Zero);
        }

        // ─── AC-LO3: runtime populated before readiness ──────────────────────────────

        [Test]
        public void AC_LO3_RuntimePopulated_BeforeReadinessForward()
        {
            var h = new Harness();
            h.StartLoad();
            h.CompleteAll();

            Assert.That(h.Forwarder.Calls.Count, Is.EqualTo(1), "Readiness forwarded once.");
            Assert.That(h.Accumulator.TrackInstance, Is.Not.Null, "Track instance populated before readiness.");
            Assert.That(h.Accumulator.CarReferencesList.Count, Is.EqualTo(16), "All 16 car refs populated before readiness.");
            Assert.That(h.Sm.State, Is.EqualTo(ContentPipelineState.Racing));
        }

        [Test]
        public void AC_LO3_TrackInstantiatedBeforeTrackReported()
        {
            var h = new Harness();
            h.StartLoad();

            // Complete ONLY the track handle → its instantiation must precede ReportTrackLoaded.
            h.Loader.Handles[0].Complete(new object());
            Assert.That(h.Instantiator.InstantiateCount, Is.EqualTo(1));
            Assert.That(h.Accumulator.OpLog, Does.Contain("SetTrack"));
            Assert.That(h.Sm.State, Is.EqualTo(ContentPipelineState.LoadingCars), "Track reported → LoadingCars.");
        }

        [Test]
        public void AC_LO3_CarsCompleteBeforeTrack_Buffered_ReadinessFires()
        {
            var h = new Harness();
            h.StartLoad();

            // 17-parallel: all 16 cars complete BEFORE the track (buffer path — gate R2 fix).
            for (int i = 1; i <= 16; i++)
                h.Loader.Handles[i].Complete(new object());
            Assert.That(h.Sm.State, Is.EqualTo(ContentPipelineState.LoadingTrack), "Cars buffered — still waiting on the track.");
            Assert.That(h.Forwarder.Calls.Count, Is.Zero, "No readiness before the track.");

            // Track completes last → readiness fires (the full set is buffered).
            h.Loader.Handles[0].Complete(new object());
            Assert.That(h.Forwarder.Calls.Count, Is.EqualTo(1), "Readiness fired once the buffered set completed.");
            Assert.That(h.Sm.State, Is.EqualTo(ContentPipelineState.Racing));
        }

        [Test]
        public void CarReferences_InTeamOrder_RegardlessOfCompletionOrder()
        {
            var h = new Harness();
            h.StartLoad();

            // Complete cars in REVERSE order; each with a distinguishable result object.
            for (int i = 16; i >= 1; i--)
                h.Loader.Handles[i].Complete($"car{i - 1}");
            h.Loader.Handles[0].Complete(new object());

            for (int k = 0; k < 16; k++)
                Assert.That(h.Accumulator.CarReferencesArray[k], Is.EqualTo($"car{k}"), $"CarReferences[{k}] is team_{k} regardless of completion order.");
        }

        [Test]
        public void AC_LO3_ForwardObservesPopulatedRuntime()
        {
            var h = new Harness();
            h.StartLoad();
            h.CompleteAll();

            // Mutation guard: if ReportTrackLoaded (or readiness) fired before the runtime was
            // populated, this assert fails — the forward must OBSERVE the populated runtime.
            // (Grid-at-forward is composition-root responsibility — covered by the integration
            // test AC_LO3_EndToEnd, which asserts the exact GridAssignment on the runtime.)
            Assert.That(h.Forwarder.TrackSetAtForward, Is.True, "Track instance populated AT forward time.");
            Assert.That(h.Forwarder.AllCarsSetAtForward, Is.True, "All 16 car references populated AT forward time.");
        }

        // ─── AC-EC2 / AC-EC8: car failure → degraded (non-fatal) ─────────────────────

        [Test]
        public void AC_EC2_CarFail_Degraded_NoError_RaceContinues()
        {
            var h = new Harness();
            h.StartLoad();

            // Handle 0 = track; handle 1 = car team_00. Car 0 fails; the rest succeed.
            h.Loader.Handles[1].Fail(new Exception("bundle corrupt"));
            for (int i = 0; i < h.Loader.Handles.Count; i++)
            {
                if (i != 1 && !h.Loader.Handles[i].IsDone)
                    h.Loader.Handles[i].Complete(new object());
            }

            Assert.That(h.ContentLoadErrorCount, Is.Zero, "A car failure never emits ContentLoadError (GDD:144).");
            Assert.That(h.Diagnostics.Warnings.Count, Is.EqualTo(1), "Degraded warning logged.");
            Assert.That(h.Sm.State, Is.EqualTo(ContentPipelineState.Racing), "Race continues with 15 loaded + 1 degraded.");
            Assert.That(h.Accumulator.CarReferencesList.Count, Is.EqualTo(15), "Degraded slot ABSENT from CarReferences.");
            Assert.That(h.Sm.Snapshot.CompletedRaceResourceIds, Has.Member("team_00"), "Degraded slot is a COMPLETED slot in the SM snapshot.");
        }

        [Test]
        public void AC_EC8_PrefabMissing_NullResult_Degraded()
        {
            var h = new Harness();
            h.StartLoad();

            h.Loader.Handles[1].Fail(new Exception("prefab missing"));
            Assert.That(h.Diagnostics.Warnings.Count, Is.EqualTo(1));
            Assert.That(h.Sm.Snapshot.CompletedRaceResourceIds, Has.Member("team_00"));

            // Rest completes normally → race still reaches readiness and 100%.
            for (int i = 2; i <= 16; i++)
                h.Loader.Handles[i].Complete(new object());
            h.Loader.Handles[0].Complete(new object());
            Assert.That(h.Sm.State, Is.EqualTo(ContentPipelineState.Racing), "Degraded car does not block readiness (GDD:144).");
            Assert.That(h.Orchestrator.Progress, Is.EqualTo(1f), "Progress reaches 100% despite the degraded slot.");
        }

        [Test]
        public void AC_EC8_NullResult_Degraded_NoFatal()
        {
            var h = new Harness();
            h.StartLoad();

            // Result null WITHOUT an exception (prefab missing in a loaded bundle) → degraded.
            h.Loader.Handles[1].Complete(null);
            Assert.That(h.Diagnostics.Warnings.Count, Is.EqualTo(1), "Null-result car → degraded warning.");
            Assert.That(h.Sm.Snapshot.CompletedRaceResourceIds, Has.Member("team_00"));
            Assert.That(h.ContentLoadErrorCount, Is.Zero, "Null result is never abortive for a car.");

            for (int i = 2; i <= 16; i++)
                h.Loader.Handles[i].Complete(new object());
            h.Loader.Handles[0].Complete(new object());
            Assert.That(h.Sm.State, Is.EqualTo(ContentPipelineState.Racing), "Null-result car does not block readiness.");
            Assert.That(h.Orchestrator.Progress, Is.EqualTo(1f));
        }

        // ─── AC-EC4 / AC-MB5: memory > 0.95 → abort ──────────────────────────────────

        [Test]
        public void AC_EC4_AC_MB5_MemoryAbove095_Abort_ReportLoadError_ReleasesHandles()
        {
            var h = new Harness();
            h.StartLoad();
            h.Memory.Pressure = 0.96f;

            // Completing any handle triggers per-completion memory sampling → abort.
            h.Loader.Handles[0].Complete(new object());

            Assert.That(h.Cleanup.BeginCleanupCount, Is.EqualTo(1), "SM entered Unloading → cleanup begun (AC-SM4 ordering).");
            // Memory is sampled BEFORE any success report, so the abort fires while ALL 17
            // handles are still in flight — nothing was retained yet.
            Assert.That(h.Loader.Handles.All(x => x.ReleaseCount == 1), Is.True, "All 17 in-flight handles released on abort.");

            // Cleanup completes → the error is emitted AFTER cleanup (cleanup-before-error).
            h.CompleteCleanup();
            Assert.That(h.ContentLoadErrorCount, Is.EqualTo(1), "ContentLoadError emitted (via SM AC-SM4).");
            Assert.That(h.Errors, Has.Member(("Memory pressure", ContentErrorType.Track)), "Exact reason + Track error type.");
            Assert.That(h.Diagnostics.Errors.Count, Is.EqualTo(1));
        }

        [Test]
        public void AC_MB5_Exact095_WarningNotAbort()
        {
            var h = new Harness();
            h.StartLoad();
            h.Memory.Pressure = 0.95f;

            h.Loader.Handles[0].Complete(new object());

            Assert.That(h.Cleanup.BeginCleanupCount, Is.Zero, "Exact 0.95 is warning territory, NOT abort.");
            Assert.That(h.Diagnostics.Warnings.Count, Is.EqualTo(1));
            Assert.That(h.ContentLoadErrorCount, Is.Zero);
        }

        // ─── AC-MB3 / AC-MB4: warning band ───────────────────────────────────────────

        [Test]
        public void AC_MB3_PressureBelow085_NoWarningNoQualityRequest()
        {
            var h = new Harness();
            h.StartLoad();
            h.Memory.Pressure = 0.8f;

            h.Loader.Handles[0].Complete(new object());

            Assert.That(h.Diagnostics.Warnings.Count, Is.Zero);
            Assert.That(h.Quality.RequestCount, Is.Zero);
        }

        [Test]
        public void AC_MB3_Exact085_WarningFires()
        {
            var h = new Harness();
            h.StartLoad();
            h.Memory.Pressure = 0.85f;

            h.Loader.Handles[0].Complete(new object());

            Assert.That(h.Diagnostics.Warnings.Count, Is.EqualTo(1), "Exact 0.85 is the inclusive warning threshold.");
            Assert.That(h.Quality.RequestCount, Is.EqualTo(1));
            Assert.That(h.ContentLoadErrorCount, Is.Zero);
        }

        [Test]
        public void Memory_NanPressure_NoAbort_ErrorLogged()
        {
            var h = new Harness();
            h.StartLoad();
            h.Memory.Pressure = float.NaN;

            h.Loader.Handles[0].Complete(new object());

            Assert.That(h.ContentLoadErrorCount, Is.Zero, "NaN must not abort the load.");
            Assert.That(h.Diagnostics.Warnings.Count, Is.Zero, "NaN must not enter the warning band.");
            Assert.That(h.Diagnostics.Errors.Count, Is.EqualTo(1), "Invalid pressure value logged.");
        }

        [Test]
        public void Memory_NegativePressure_NoWarning()
        {
            var h = new Harness();
            h.StartLoad();
            h.Memory.Pressure = -0.5f;

            h.Loader.Handles[0].Complete(new object());

            Assert.That(h.Diagnostics.Warnings.Count, Is.Zero);
            Assert.That(h.Quality.RequestCount, Is.Zero);
            Assert.That(h.ContentLoadErrorCount, Is.Zero);
        }

        [Test]
        public void Memory_AbortOnTerminalCompletion_NotLost()
        {
            var h = new Harness();
            h.StartLoad();

            // 16 of 17 complete under normal pressure — one car remains (LoadingCars).
            for (int i = 0; i < 16; i++)
                h.Loader.Handles[i].Complete(new object());
            Assert.That(h.Sm.State, Is.EqualTo(ContentPipelineState.LoadingCars));

            // The FINAL car completes under high pressure → the abort must fire, NOT be
            // swallowed by the synchronous Racing transition (memory checked BEFORE the report).
            h.Memory.Pressure = 0.96f;
            h.Loader.Handles[16].Complete(new object());
            Assert.That(h.Cleanup.BeginCleanupCount, Is.EqualTo(1), "Abort on the terminal completion is not lost to Racing.");
            Assert.That(h.Sm.State, Is.EqualTo(ContentPipelineState.Unloading), "SM in Unloading, not Racing.");
            // The 16 already-retained handles are NOT released by the abort (only the in-flight
            // 17th is); they survive for Story 004 cleanup / the next-race reset.
            Assert.That(h.Loader.Handles.Take(16).All(x => x.ReleaseCount == 0), Is.True, "Retained handles survive the abort (no double-release).");
            Assert.That(h.Loader.Handles[16].ReleaseCount, Is.EqualTo(1), "The in-flight handle is released by the abort.");
        }

        [Test]
        public void Progress_Monotonic_WhenPartialHandleFails()
        {
            var h = new Harness();
            h.StartLoad();
            foreach (var (_, handle) in h.Loader.Loads)
                handle.TotalBytes = 100;

            for (int i = 0; i < 9; i++)
            {
                h.Loader.Handles[i].DownloadedBytes = 100;
                h.Loader.Handles[i].Complete(new object());
            }
            h.Clock.Time = 1f;
            h.Orchestrator.Sample(); // includes the active partially-downloaded handles

            // A partially-downloaded car (90/100) fails → without the monotonic clamp its
            // bytes would leave the pool and drag progress DOWN.
            h.Loader.Handles[10].DownloadedBytes = 90;
            h.Clock.Time = 2f;
            h.Orchestrator.Sample();
            float beforeFail = h.Orchestrator.Progress;
            h.Loader.Handles[10].Fail(new Exception("bundle corrupt"));

            Assert.That(h.Orchestrator.Progress, Is.GreaterThanOrEqualTo(beforeFail), "Progress never moves backwards (monotonic AC-LO2).");
        }

        [Test]
        public void TrackInstantiateThrows_AbortsLoad()
        {
            var h = new Harness();
            h.Instantiator.Throw = true;
            h.StartLoad();

            h.Loader.Handles[0].Complete(new object()); // track completes → instantiate throws → abort
            Assert.That(h.Cleanup.BeginCleanupCount, Is.EqualTo(1), "Track instantiation failure aborts the load.");
            Assert.That(h.Diagnostics.Errors.Count, Is.EqualTo(1));

            h.CompleteCleanup();
            Assert.That(h.ContentLoadErrorCount, Is.EqualTo(1), "Error emitted after cleanup (AC-SM4).");
        }

        [Test]
        public void Memory_SampledExactlyOncePerCompletion_NoDoubleSample()
        {
            var h = new Harness();
            h.StartLoad();
            int readsBefore = h.Memory.ReadCount;

            // Degraded path: the memory policy runs once in OnHandleComplete BEFORE the
            // report — HandleFailure must NOT resample (a double-sample mutation would
            // inflate the read count).
            h.Loader.Handles[1].Fail(new Exception("bundle corrupt"));
            Assert.That(h.Memory.ReadCount, Is.EqualTo(readsBefore + 1), "Exactly one pressure read per completion.");
        }

        [Test]
        public void Progress_Clamp_PreservesProgressWhenTotalGrows()
        {
            var h = new Harness();
            h.StartLoad();

            // 8 handles × 100 bytes complete → 800/800 = 1.0 (forced only at 17; here the
            // completed+active pool ratio is tracked). Set a small pool first: 8 complete with
            // bytes, remaining 9 active with 0 downloaded → ratio 800/1700 ≈ 0.47.
            foreach (var (_, handle) in h.Loader.Loads)
                handle.TotalBytes = 100;
            for (int i = 0; i < 8; i++)
            {
                h.Loader.Handles[i].DownloadedBytes = 100;
                h.Loader.Handles[i].Complete(new object());
            }
            h.Clock.Time = 1f;
            h.Orchestrator.Sample();
            float before = h.Orchestrator.Progress;

            // A NEW handle joins the pool with a large total and 0 downloaded → the raw ratio
            // would drop; the monotonic clamp must preserve the observed progress.
            var extra = h.Loader.Handles[9];
            extra.TotalBytes = 100000;
            h.Clock.Time = 2f;
            h.Orchestrator.Sample();
            Assert.That(h.Orchestrator.Progress, Is.GreaterThanOrEqualTo(before), "Monotonic clamp holds when total-byte estimates grow.");
        }

        [Test]
        public void Progress_NeverReports100_BeforeAllSlotsTerminate()
        {
            var h = new Harness();
            var observed = new List<float>();
            h.Orchestrator.ProgressChanged += observed.Add;
            h.StartLoad();

            // One handle completes 100/100; the other 16 are cached (0/0 totals) → the raw
            // byte ratio is 1.0 with 16 slots still pending. Must NOT report 100% (that would
            // mask a hung load on the loading screen).
            h.Loader.Handles[0].TotalBytes = 100;
            h.Loader.Handles[0].DownloadedBytes = 100;
            h.Loader.Handles[0].Complete(new object());
            float cap = 1f - 1f / (RaceLoadOrchestrator.MaxCanonicalSlots + 1);
            Assert.That(h.Orchestrator.Progress, Is.EqualTo(cap).Within(0.001f), "Byte ratio capped at the request-sized ceiling, not 1.0.");
            Assert.That(observed.Any(v => Math.Abs(v - cap) < 0.001f), Is.True, "ProgressChanged observed the capped value.");

            for (int i = 1; i <= 16; i++)
                h.Loader.Handles[i].Complete(new object());
            Assert.That(h.Orchestrator.Progress, Is.EqualTo(1f), "1.0 only when all slots terminate.");
        }

        [Test]
        public void Progress_RequestSizedCap_ReducedGrid()
        {
            // A reduced grid (track + 2 cars) caps at 1 - 1/4 = 0.75, NOT the canonical 0.944
            // — mutation guard for the request-sized cap formula.
            var h = new Harness(carCount: 2);
            var observed = new List<float>();
            h.Orchestrator.ProgressChanged += observed.Add;
            h.StartLoad();

            h.Loader.Handles[0].TotalBytes = 100;
            h.Loader.Handles[0].DownloadedBytes = 100;
            h.Loader.Handles[0].Complete(new object()); // track 100/100; 2 cars cached (0/0)

            Assert.That(h.Orchestrator.Progress, Is.EqualTo(0.75f).Within(0.001f), "Request-sized cap = 1 - 1/(3 slots + 1) = 0.75.");
            Assert.That(observed.Any(v => Math.Abs(v - 0.75f) < 0.001f), Is.True, "ProgressChanged observed the request-sized cap.");
        }

        [Test]
        public void Sample_Tick_UpdatesInFlightByteProgress()
        {
            var h = new Harness();
            h.StartLoad();
            foreach (var (_, handle) in h.Loader.Loads)
                handle.TotalBytes = 100;

            // Track 50/100 downloaded but NOT completed — the 1s tick must aggregate in-flight bytes.
            h.Loader.Handles[0].DownloadedBytes = 50;
            h.Clock.Time = 1f;
            h.Orchestrator.Sample();
            Assert.That(h.Orchestrator.Progress, Is.EqualTo(50f / 1700f).Within(0.001f), "Tick aggregates in-flight byte progress (50/1700).");
        }

        [Test]
        public void Sample_Tick_AppliesMemoryPolicy()
        {
            var h = new Harness();
            h.StartLoad();

            // Pressure in the warning band WITHOUT any completion — the 1s tick applies the policy.
            h.Memory.Pressure = 0.9f;
            h.Clock.Time = 1f;
            h.Orchestrator.Sample();
            Assert.That(h.Diagnostics.Warnings.Count, Is.EqualTo(1), "Warning emitted on the 1s tick, not just on completions.");
            Assert.That(h.Quality.RequestCount, Is.EqualTo(1));
        }

        [Test]
        public void Clock_Rollback_SuppressesSample()
        {
            var h = new Harness();
            h.StartLoad();
            h.Clock.Time = 1f;
            h.Orchestrator.Sample();
            int readsAfterFirst = h.Memory.ReadCount;

            h.Clock.Time = 0.5f; // backwards clock — must suppress the sample tick, not crash.
            h.Orchestrator.Sample();
            Assert.That(h.Memory.ReadCount, Is.EqualTo(readsAfterFirst), "Backwards clock suppresses sampling until it catches up.");
        }

        [Test]
        public void RequestCarLoads_DuplicateTeamIds_Throws()
        {
            var h = new Harness();
            Assert.Throws<ArgumentException>(() => h.Orchestrator.RequestCarLoads(new[] { "team_a", "team_a" }));
        }

        [Test]
        public void DuplicateSelection_EndToEnd_DeduplicatedAndLoads()
        {
            // A selection with duplicate team ids is canonicalized at construction (Distinct),
            // so the 17-parallel load is never poisoned by a duplicate.
            var h = new Harness();
            h.SelectionSource.Selection = new RaceContentSelection(Track, new[] { "team_00", "team_01", "team_00" });
            Assert.That(h.SelectionSource.Selection.TeamIds, Is.EqualTo(new[] { "team_00", "team_01" }), "Duplicates removed at the selection root.");

            h.StartLoad();
            Assert.That(h.Loader.Loads.Count, Is.EqualTo(1 + 2), "1 track + 2 deduplicated cars.");
            foreach (var (_, handle) in h.Loader.Loads)
                handle.Complete(new object());
            Assert.That(h.Sm.State, Is.EqualTo(ContentPipelineState.Racing), "Deduplicated selection completes normally.");
            Assert.That(h.Orchestrator.Progress, Is.EqualTo(1f), "Progress reaches 1.0 for the deduplicated request set (3 slots).");
        }

        [Test]
        public void AC_MB4_PressureInBand_WarningAndQualityRequest()
        {
            var h = new Harness();
            h.StartLoad();
            h.Memory.Pressure = 0.9f;

            h.Loader.Handles[0].Complete(new object());

            Assert.That(h.Diagnostics.Warnings.Count, Is.EqualTo(1), "Warning emitted.");
            Assert.That(h.Quality.RequestCount, Is.EqualTo(1), "Quality reduction requested.");
            Assert.That(h.Cleanup.BeginCleanupCount, Is.Zero, "Band is not abortive.");
        }

        [Test]
        public void AC_MB4_WarningOnce_NotSpammed()
        {
            var h = new Harness();
            h.StartLoad();
            h.Memory.Pressure = 0.9f;

            h.Loader.Handles[0].Complete(new object());
            h.Clock.Time = 1f;
            h.Loader.Handles[1].Complete(new object());

            Assert.That(h.Quality.RequestCount, Is.EqualTo(1), "Warning/request once per band entry, not per sample.");
        }

        // ─── AC-LP1 / LP2 / LP3: progress ratios ─────────────────────────────────────

        [Test]
        public void AC_LP1_600Total_150Loaded_Progress025()
        {
            var h = new Harness();
            h.StartLoad();

            // The track handle carries the 600 MB asset; the other 16 report no bytes yet.
            h.Loader.Handles[0].TotalBytes = 600;
            h.Loader.Handles[0].DownloadedBytes = 150;
            h.Loader.Handles[0].Complete(new object());

            Assert.That(h.Orchestrator.Progress, Is.EqualTo(0.25f).Within(0.01f), "150/600 = 0.25 ±1%.");
        }

        [Test]
        public void AC_LP2_AllLoaded_Progress1()
        {
            var h = new Harness();
            h.StartLoad();
            h.CompleteAll();

            Assert.That(h.Orchestrator.Progress, Is.EqualTo(1f), "Final progress forced to 1.0.");
        }

        [Test]
        public void AC_LP3_OneCarFails_ProgressStill100()
        {
            var h = new Harness();
            h.StartLoad();

            h.Loader.Handles[1].Fail(new Exception("bundle corrupt"));
            for (int i = 0; i < h.Loader.Handles.Count; i++)
            {
                if (i != 1 && !h.Loader.Handles[i].IsDone)
                    h.Loader.Handles[i].Complete(new object());
            }

            Assert.That(h.Orchestrator.Progress, Is.EqualTo(1f), "1/16 fails → remaining 15 + track still reach 100%.");
        }

        [Test]
        public void ProgressChanged_ObservesIntermediateValues()
        {
            var h = new Harness();
            var observed = new List<float>();
            h.Orchestrator.ProgressChanged += observed.Add;
            h.StartLoad();

            // 17 handles × 100 bytes total each; only COMPLETED handles carry downloaded bytes.
            foreach (var (_, handle) in h.Loader.Loads)
                handle.TotalBytes = 100;

            for (int i = 0; i < 4; i++)
            {
                h.Loader.Handles[i].DownloadedBytes = 100;
                h.Loader.Handles[i].Complete(new object());
            }
            Assert.That(observed.Any(v => Math.Abs(v - 4f / 17f) < 0.001f), Is.True, "~0.24 observed after 4/17.");

            for (int i = 4; i < 8; i++)
            {
                h.Loader.Handles[i].DownloadedBytes = 100;
                h.Loader.Handles[i].Complete(new object());
            }
            Assert.That(observed.Any(v => Math.Abs(v - 8f / 17f) < 0.001f), Is.True, "~0.47 observed after 8/17.");

            for (int i = 8; i < 12; i++)
            {
                h.Loader.Handles[i].DownloadedBytes = 100;
                h.Loader.Handles[i].Complete(new object());
            }
            Assert.That(observed.Any(v => Math.Abs(v - 12f / 17f) < 0.001f), Is.True, "~0.71 observed after 12/17.");

            for (int i = 12; i < 17; i++)
            {
                h.Loader.Handles[i].DownloadedBytes = 100;
                h.Loader.Handles[i].Complete(new object());
            }
            Assert.That(observed, Does.Contain(1f), "1.0 observed at full completion.");
        }

        [Test]
        public void Degraded_ProgressReflectsSurvivingSlots()
        {
            var h = new Harness();
            h.StartLoad();

            // 17 handles × 100 bytes total; only COMPLETED handles carry bytes (active = 0).
            foreach (var (_, handle) in h.Loader.Loads)
                handle.TotalBytes = 100;
            h.Loader.Handles[1].Fail(new Exception("bundle corrupt"));
            for (int i = 0; i <= 9; i++)
            {
                if (i != 1 && !h.Loader.Handles[i].IsDone)
                {
                    h.Loader.Handles[i].DownloadedBytes = 100;
                    h.Loader.Handles[i].Complete(new object());
                }
            }

            // 9 completed with bytes (track + 8 cars) of 1600 total bytes (16 surviving × 100).
            Assert.That(h.Orchestrator.Progress, Is.EqualTo(9f / 16f).Within(0.001f), "Progress recomputed after the degraded slot is removed from the byte pool.");
        }

        // ─── Defensive invariants (pre-emptive audit) ────────────────────────────────

        [Test]
        public void NextRace_ReleasesPriorSessionRetainedHandlesAndTrack()
        {
            var h = new Harness();
            h.StartLoad();
            h.CompleteAll(); // Racing — 17 retained handles + track instance.

            Assert.That(h.Accumulator.Retained.Count, Is.EqualTo(17), "All handles retained after session 1.");
            Assert.That(h.Accumulator.TrackInstance, Is.Not.Null);

            // Changed selection → next-race (Racing → LoadingTrack, NO cleanup path) → the
            // orchestrator releases the prior session's retained handles + track instance.
            int releasesBefore = h.Accumulator.ReleaseRetainedCount;
            h.SetSelection(15);
            h.StartLoad();
            Assert.That(h.Accumulator.ReleaseRetainedCount, Is.EqualTo(releasesBefore + 1), "Retained handles released at next-race reset.");
            Assert.That(h.Accumulator.Retained.Count, Is.Zero);
            Assert.That(h.Instantiator.ReleaseCount, Is.EqualTo(1), "Prior track instance destroyed at next-race reset.");
        }

        [Test]
        public void Reset_ReleasesInFlightHandlesBeforeClearing()
        {
            var h = new Harness();
            h.StartLoad();
            var original = h.Loader.Handles.ToList();

            // Reset with NO completions — every in-flight handle must be released, never abandoned.
            h.Orchestrator.RequestTrackLoad(Track);
            Assert.That(original.All(x => x.ReleaseCount == 1), Is.True, "In-flight handles released on reset.");
        }

        [Test]
        public void ProgressChanged_SubscriberThrows_LoadContinues()
        {
            var h = new Harness();
            h.ProgressSubscriberThrows = true;
            h.StartLoad();
            h.CompleteAll();

            Assert.That(h.Forwarder.Calls.Count, Is.EqualTo(1), "Load completes despite a throwing progress subscriber.");
            Assert.That(h.Diagnostics.Errors.Count, Is.GreaterThan(0), "Subscriber fault logged, not propagated.");
        }

        // ─── Session fencing ─────────────────────────────────────────────────────────

        [Test]
        public void Fencing_ReportsEchoCapturedGeneration()
        {
            // A spy reporter with a FIXED generation: the orchestrator must read it ONCE at
            // request time and echo THAT token on every report — never re-read the current
            // value. Mutation guard: echoing the live generation would also pass the SM-side
            // fencing tests (which drop stale callbacks from the active set), but not this one.
            var spy = new SpyReporter { Generation = 42 };
            var loader = new FakeLoader();
            var h = new Harness();
            var orchestrator = new RaceLoadOrchestrator(spy, loader, h.Instantiator, h.Memory, h.Quality, h.Diagnostics, h.Clock, h.Accumulator);

            orchestrator.RequestTrackLoad(Track);
            orchestrator.RequestCarLoads(Teams(16));
            foreach (var (_, handle) in loader.Loads)
                handle.Complete(new object());

            Assert.That(spy.TrackGenerations, Does.Contain(42), "Track report echoes the captured generation.");
            Assert.That(spy.CarGenerations, Is.All.EqualTo(42), "Every car report echoes the captured generation.");
        }

        [Test]
        public void Fencing_StaleHandleFromPreviousSession_IgnoredAfterReset()
        {
            var h = new Harness();
            h.StartLoad();
            h.CompleteAll(); // Racing
            FakeHandle staleTrack = h.Loader.Handles[0];

            // Changed selection (15 cars ≠ 16) → next-race path issues a fresh load (new handles).
            h.SetSelection(15);
            h.StartLoad();
            Assert.That(h.Sm.State, Is.EqualTo(ContentPipelineState.LoadingTrack), "Next race restarted loading.");
            Assert.That(h.Orchestrator.Progress, Is.Zero, "New session resets progress to 0.");

            // The stale handle from session 1 completes AFTER the reset — ignored.
            staleTrack.Complete(new object());
            Assert.That(h.Sm.State, Is.EqualTo(ContentPipelineState.LoadingTrack), "Stale completion did not advance the new session.");
        }
    }
}
