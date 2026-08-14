using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using Overdrive.Simulation;

namespace Overdrive.Content.Tests
{
    [TestFixture]
    public class ContentStateMachineTests
    {
        private const string TrackA = "monza";
        private const string TrackB = "spa";
        private static readonly string[] TeamsA = { "team_tier1_a", "team_tier1_b", "team_tier2_a" };
        private static readonly string[] TeamsB = { "team_tier1_a", "team_tier1_b", "team_tier2_b" };

        // Full 16-slot MVP grid for the LO5 aggregation invariant (GDD:144 — 1 track + 16 car slots).
        private static readonly string[] Teams16 =
        {
            "team_tier1_a", "team_tier1_b", "team_tier1_c", "team_tier1_d",
            "team_tier2_a", "team_tier2_b", "team_tier2_c", "team_tier2_d",
            "team_tier3_a", "team_tier3_b", "team_tier3_c", "team_tier3_d",
            "team_tier4_a", "team_tier4_b", "team_tier4_c", "team_tier4_d"
        };

        private sealed class FakeSelectionSource : IContentSelectionSource
        {
            public RaceContentSelection Selection;
            public int QueryCount;
            public bool Throw;

            public FakeSelectionSource(RaceContentSelection selection)
            {
                Selection = selection;
            }

            public RaceContentSelection GetSelection()
            {
                QueryCount++;
                if (Throw)
                    throw new InvalidOperationException("selection source fault");
                return Selection;
            }
        }

        private sealed class FakeLoadSeam : IContentLoadSeam
        {
            public List<string> TrackRequests = new List<string>();
            public List<List<string>> CarRequests = new List<List<string>>();
            public int ReportCalls;

            public void RequestTrackLoad(string trackId)
            {
                TrackRequests.Add(trackId);
                ReportCalls++;
            }

            public void RequestCarLoads(IReadOnlyList<string> teamIds)
            {
                CarRequests.Add(teamIds.ToList());
                ReportCalls++;
            }
        }

        private sealed class FakeCleanupSeam : IContentCleanupSeam
        {
            public int BeginCleanupCount;
            public int LastGeneration;

            public void BeginCleanup(int cleanupId)
            {
                BeginCleanupCount++;
                LastGeneration = cleanupId; // echo the SM-generated id.
            }
        }

        private sealed class FakeForwarder : IReadinessForwarder
        {
            public List<(RaceMode Mode, GridAssignment Grid)> Calls = new List<(RaceMode, GridAssignment)>();
            public bool Throw;

            public void Forward(RaceMode raceMode, GridAssignment gridAssignment)
            {
                if (Throw)
                    throw new InvalidOperationException("wiring defect");
                Calls.Add((raceMode, gridAssignment));
            }
        }

        private sealed class Probe
        {
            public readonly FakeSelectionSource SelectionSource;
            public readonly FakeLoadSeam LoadSeam;
            public readonly FakeCleanupSeam CleanupSeam;
            public readonly FakeForwarder Forwarder;
            public readonly ContentStateMachine Machine;
            public int RaceLoadReadyCount;
            public int ContentLoadErrorCount;
            public int ContentUnloadCompleteCount;
            public int RaceReconfigureStartCount;
            public List<(RaceMode Mode, GridAssignment Grid)> ReadyPayloads = new List<(RaceMode, GridAssignment)>();
            public List<(string Reason, ContentErrorType Type)> Errors = new List<(string, ContentErrorType)>();

            public Probe(RaceContentSelection selection, bool sharedLoaded = true)
            {
                SelectionSource = new FakeSelectionSource(selection);
                LoadSeam = new FakeLoadSeam();
                CleanupSeam = new FakeCleanupSeam();
                Forwarder = new FakeForwarder();
                Machine = new ContentStateMachine(
                    SelectionSource,
                    LoadSeam,
                    CleanupSeam,
                    Forwarder,
                    new ContentResourceState(sharedLoaded, Array.Empty<string>()));
                Machine.RaceLoadReady += (mode, grid) => { RaceLoadReadyCount++; ReadyPayloads.Add((mode, grid)); };
                Machine.ContentLoadError += (reason, type) => { ContentLoadErrorCount++; Errors.Add((reason, type)); };
                Machine.ContentUnloadComplete += () => ContentUnloadCompleteCount++;
                Machine.RaceReconfigureStart += () => RaceReconfigureStartCount++;
            }

            public ContentLoadRequest RaceRequest(GridAssignment grid = null) =>
                new ContentLoadRequest(RaceMode.Race, grid ?? RaceGrid());

            public void CompleteLoad()
            {
                Machine.ReportTrackLoaded(Machine.SessionGeneration);
                foreach (string team in TeamsA)
                    Machine.ReportCarLoaded(Machine.SessionGeneration, team);
            }

            public void CompleteCleanup()
            {
                Machine.ReportCleanupComplete(CleanupSeam.LastGeneration);
            }

            public void ReportTrack() => Machine.ReportTrackLoaded(Machine.SessionGeneration);
            public void ReportCar(string team) => Machine.ReportCarLoaded(Machine.SessionGeneration, team);
            public void ReportCarDegradedLocal(string team) => Machine.ReportCarDegraded(Machine.SessionGeneration, team);
            public void ReportLoadErrorLocal(ContentErrorType type, string reason) =>
                Machine.ReportLoadError(Machine.SessionGeneration, type, reason);
        }

        private static GridAssignment RaceGrid() => new GridAssignment(new[] { 0, 1, 2 });
        private static RaceContentSelection SelectionA() => new RaceContentSelection(TrackA, TeamsA);

        // ─── AC-SM1: initial state Idle with only Shared loaded ───

        [Test]
        public void AC_SM1_InitialState_IdleWithSharedLoaded()
        {
            var probe = new Probe(SelectionA(), sharedLoaded: true);

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Idle));
            Assert.That(probe.Machine.Snapshot.IsSharedLoaded, Is.True);
            Assert.That(probe.Machine.Snapshot.CompletedRaceResourceIds, Is.Empty);
            Assert.That(probe.Machine.HandoffValid, Is.False);
        }

        [Test]
        public void AC_SM1_InitialState_SeedWithoutShared_ReportsNotLoaded()
        {
            var probe = new Probe(SelectionA(), sharedLoaded: false);

            Assert.That(probe.Machine.Snapshot.IsSharedLoaded, Is.False);
        }

        // ─── AC-SM2: Idle + no race selected → zero race resources, no seam calls ───

        [Test]
        public void AC_SM2_Idle_NoRequest_NoSeamCalls()
        {
            var probe = new Probe(SelectionA());

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Idle));
            Assert.That(probe.LoadSeam.TrackRequests, Is.Empty);
            Assert.That(probe.LoadSeam.CarRequests, Is.Empty);
            Assert.That(probe.CleanupSeam.BeginCleanupCount, Is.Zero);
            Assert.That(probe.Forwarder.Calls, Is.Empty);
        }

        // ─── AC-SM3: unload from loaded states → Unloading; no premature completion; Idle no-op ───

        [Test]
        public void AC_SM3_UnloadRequest_FromRacing_TransitionsToUnloading_NoPrematureComplete()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Racing));

            probe.Machine.OnContentUnloadRequested();

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Unloading));
            Assert.That(probe.CleanupSeam.BeginCleanupCount, Is.EqualTo(1));
            Assert.That(probe.ContentUnloadCompleteCount, Is.Zero, "Must not emit ContentUnloadComplete before cleanup reports complete.");
        }

        [Test]
        public void AC_SM3_UnloadRequest_InIdle_IsNoOp()
        {
            var probe = new Probe(SelectionA());

            probe.Machine.OnContentUnloadRequested();

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Idle));
            Assert.That(probe.CleanupSeam.BeginCleanupCount, Is.Zero);
        }

        // ─── AC-SM4: error ordering (cleanup-before-error) + no cancel surface ───

        [Test]
        public void AC_SM4_LoadError_CleanupBeforeError_Ordering()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();

            probe.ReportLoadErrorLocal(ContentErrorType.Track, "track failed");

            Assert.That(probe.CleanupSeam.BeginCleanupCount, Is.EqualTo(1));
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Unloading));
            Assert.That(probe.ContentLoadErrorCount, Is.Zero, "ContentLoadError must be deferred until cleanup completes (cleanup-before-error).");

            probe.CompleteCleanup();

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Idle));
            Assert.That(probe.ContentLoadErrorCount, Is.EqualTo(1));
            Assert.That(probe.Errors[0], Is.EqualTo(("track failed", ContentErrorType.Track)));
            Assert.That(probe.ContentUnloadCompleteCount, Is.Zero, "Error path must not emit ContentUnloadComplete.");
            Assert.That(probe.Machine.HandoffValid, Is.False);
        }

        [Test]
        public void AC_SM4_RequestInputs_AreNoOpsWhileLoading_NoCancelSurface()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingTrack));

            // Cancel/Back must NOT cancel the load: both request inputs are no-ops while Loading*.
            probe.Machine.OnContentUnloadRequested();
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingTrack));
            Assert.That(probe.CleanupSeam.BeginCleanupCount, Is.Zero);
            Assert.That(probe.ContentUnloadCompleteCount, Is.Zero);
            Assert.That(probe.ContentLoadErrorCount, Is.Zero);
            Assert.That(probe.SelectionSource.QueryCount, Is.EqualTo(1), "Second load request while busy must NOT query the selection source.");
        }

        [Test]
        public void AC_SM4_ReportsAdvanceTheLoad_WhileLoading()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.Machine.OnContentUnloadRequested(); // no-op (no cancel surface)

            probe.ReportTrack();

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingCars));
            Assert.That(probe.LoadSeam.CarRequests.Count, Is.EqualTo(1));
        }

        // ─── AC-SM5: CP_Ready is transitional — never a resting state ───

        [Test]
        public void AC_SM5_ReadyIsTransitional_ObservableStateIsRacing()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();

            ContentPipelineState observedDuringCompletion = default;
            probe.Machine.RaceLoadReady += (_, _) => observedDuringCompletion = probe.Machine.State;
            probe.ReportCar(TeamsA[0]);
            probe.ReportCar(TeamsA[1]);
            probe.ReportCar(TeamsA[2]);

            Assert.That(observedDuringCompletion, Is.EqualTo(ContentPipelineState.Ready),
                "The SM must be observable in Ready during the publication callback.");
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Racing),
                "After the publication returns, Ready is never a resting state.");
        }

        // ─── AC-LO4: exactly-once selection query, payload storage, track request ───

        [Test]
        public void AC_LO4_LoadRequest_SelectionExactlyOnce_StoresPayload_RequestsTrack()
        {
            var probe = new Probe(SelectionA());
            GridAssignment grid = RaceGrid();

            probe.Machine.OnContentLoadRequested(new ContentLoadRequest(RaceMode.Race, grid));

            Assert.That(probe.SelectionSource.QueryCount, Is.EqualTo(1));
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingTrack));
            Assert.That(probe.LoadSeam.TrackRequests, Is.EqualTo(new[] { TrackA }));
            Assert.That(probe.LoadSeam.CarRequests, Is.Empty, "Car requests are issued at LoadingCars entry, not before.");
        }

        [Test]
        public void AC_LO4_Busy_IgnoredRequest_ZeroQueries()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();
            int queriesBefore = probe.SelectionSource.QueryCount;

            probe.Machine.OnContentLoadRequested(probe.RaceRequest());

            Assert.That(probe.SelectionSource.QueryCount, Is.EqualTo(queriesBefore), "Busy request must not query the selection source.");
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingCars));
        }

        // ─── AC-LO5: aggregation; full set → through Ready to Racing; fewer → stays ───

        [Test]
        public void AC_LO5_Completions_Aggregation_ThroughReadyToRacing()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();

            probe.ReportCar(TeamsA[0]);
            probe.ReportCar(TeamsA[1]);
            probe.ReportCar(TeamsA[2]);

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Racing));
            Assert.That(probe.Machine.Snapshot.CompletedRaceResourceIds, Is.EquivalentTo(new[] { TrackA }.Concat(TeamsA)));
            Assert.That(probe.Machine.HandoffValid, Is.True);
            Assert.That(probe.LoadSeam.CarRequests.Count, Is.EqualTo(1));
            Assert.That(probe.LoadSeam.CarRequests[0], Is.EquivalentTo(TeamsA));
        }

        [Test]
        public void AC_LO5_FewerThan16_StaysLoadingCars()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();

            probe.ReportCar(TeamsA[0]);
            probe.ReportCar(TeamsA[1]);

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingCars));
            Assert.That(probe.Forwarder.Calls, Is.Empty);
        }

        [Test]
        public void AC_LO5_DegradedCountsAsCompleted()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();

            probe.ReportCar(TeamsA[0]);
            probe.ReportCarDegradedLocal(TeamsA[1]);
            probe.ReportCar(TeamsA[2]);

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Racing),
                "A degraded slot is a COMPLETED slot (GDD:144).");
            Assert.That(probe.Machine.Snapshot.CompletedRaceResourceIds, Does.Contain(TeamsA[1]),
                "The degraded team occupies the completed set as a completion marker.");
            Assert.That(probe.RaceLoadReadyCount, Is.EqualTo(1), "Readiness emitted exactly once.");
            Assert.That(probe.Forwarder.Calls.Count, Is.EqualTo(1));
            Assert.That(probe.ReadyPayloads[0].Mode, Is.EqualTo(RaceMode.Race), "The degraded path still publishes the exact stored payload.");
        }

        [Test]
        public void AC_LO5_UnknownTeamId_IsIgnored()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();

            probe.ReportCar("team_unknown");
            probe.ReportCar(TeamsA[0]);
            probe.ReportCar(TeamsA[1]);

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingCars),
                "An unknown team ID must not count toward the expected set.");
            Assert.That(probe.Machine.Snapshot.CompletedRaceResourceIds, Is.Not.Contains("team_unknown"));
        }

        // ─── AC-LO6: forward exactly once with the exact stored payload; HandoffValid set ───

        [Test]
        public void AC_LO6_Forward_ExactStoredPayload_Once_HandoffSet()
        {
            var probe = new Probe(SelectionA());
            GridAssignment grid = RaceGrid();
            probe.Machine.OnContentLoadRequested(new ContentLoadRequest(RaceMode.Race, grid));
            probe.CompleteLoad();

            Assert.That(probe.Forwarder.Calls.Count, Is.EqualTo(1));
            Assert.That(probe.Forwarder.Calls[0].Mode, Is.EqualTo(RaceMode.Race));
            Assert.That(probe.Forwarder.Calls[0].Grid, Is.SameAs(grid), "The payload must be the EXACT stored GridAssignment, never invented.");
            Assert.That(probe.RaceLoadReadyCount, Is.EqualTo(1));
            Assert.That(probe.Machine.HandoffValid, Is.True);
        }

        [Test]
        public void AC_LO6_ForwardThrow_FailsFast_Propagates()
        {
            var probe = new Probe(SelectionA());
            probe.Forwarder.Throw = true;
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();

            Assert.Throws<InvalidOperationException>(() =>
            {
                probe.ReportCar(TeamsA[0]);
                probe.ReportCar(TeamsA[1]);
                probe.ReportCar(TeamsA[2]); // the completing slot triggers the forward
            });

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Ready),
                "Fail-fast: the SM does not catch the forward throw (wiring defect).");
        }

        // ─── AC-LO7: unload from any loaded state without Kernel Idle ───

        [Test]
        public void AC_LO7_Unload_FromRacing()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Racing));

            probe.Machine.OnContentUnloadRequested();

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Unloading));
            Assert.That(probe.CleanupSeam.BeginCleanupCount, Is.EqualTo(1));
        }

        // ─── AC-LO8: cleanup complete → ContentUnloadComplete exactly once; handoff cleared ───

        [Test]
        public void AC_LO8_CleanupComplete_EmitsOnce_HandoffCleared()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();
            probe.Machine.OnContentUnloadRequested();

            probe.CompleteCleanup();

            Assert.That(probe.ContentUnloadCompleteCount, Is.EqualTo(1));
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Idle));
            Assert.That(probe.Machine.HandoffValid, Is.False, "Handoff validity must be CLEARED after ContentUnloadComplete.");
        }

        [Test]
        public void AC_LO8_NoCompletionBeforeCleanupSignal()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();
            probe.Machine.OnContentUnloadRequested();

            // No ReportCleanupComplete — the completion must never fire on its own.
            Assert.That(probe.ContentUnloadCompleteCount, Is.Zero);
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Unloading));
        }

        // ─── RaceReconfigure: same selection → cache-hit path, zero I/O, one-way event ───

        [Test]
        public void RaceReconfigure_SameSelection_ZeroIo_Reemit_EventOnce()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Racing));

            GridAssignment raceGrid = RaceGrid();
            probe.Machine.OnContentLoadRequested(new ContentLoadRequest(RaceMode.Race, raceGrid));

            Assert.That(probe.RaceReconfigureStartCount, Is.EqualTo(1));
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Racing), "Terminal state after the re-emit.");
            Assert.That(probe.LoadSeam.ReportCalls, Is.EqualTo(2),
                "ZERO Addressables I/O during reconfiguration (2 calls = the two requests from the initial load only).");
            Assert.That(probe.SelectionSource.QueryCount, Is.EqualTo(2), "One fresh selection query per accepted request (initial + reconfigure).");
            Assert.That(probe.Forwarder.Calls.Count, Is.EqualTo(2), "Re-emit = one more readiness publication.");
            Assert.That(probe.Forwarder.Calls[1].Mode, Is.EqualTo(RaceMode.Race), "The re-emit carries the exact request mode.");
            Assert.That(probe.Forwarder.Calls[1].Grid, Is.SameAs(raceGrid), "The re-emit uses the request's grid.");
            Assert.That(probe.Machine.HandoffValid, Is.True, "Handoff validity renewed after the re-emit.");
            Assert.That(probe.RaceLoadReadyCount, Is.EqualTo(2));
        }

        [Test]
        public void RaceReconfigure_CoversKernelRacingRetry_SameSelection()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();

            // Kernel.RequestRetry emits ContentLoadRequested(Race, same grid) while Racing (L352-357).
            GridAssignment sameGrid = probe.Forwarder.Calls[0].Grid;
            probe.Machine.OnContentLoadRequested(new ContentLoadRequest(RaceMode.Race, sameGrid));

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Racing));
            Assert.That(probe.RaceReconfigureStartCount, Is.EqualTo(1),
                "A same-selection retry follows the reconfigure cache-hit path (ADR-0003:53/198), not a full load.");
            Assert.That(probe.LoadSeam.ReportCalls, Is.EqualTo(2), "No additional Addressables I/O.");
        }

        // ─── NextRace: changed selection → LoadingTrack; handoff cleared; no ContentUnloadComplete ───

        [Test]
        public void NextRace_DifferentSelection_LoadingTrack_HandoffCleared_NoUnloadComplete()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();
            Assert.That(probe.Machine.HandoffValid, Is.True);

            probe.SelectionSource.Selection = new RaceContentSelection(TrackB, TeamsB);
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingTrack),
                "Changed selection → CP_LoadingTrack (NOT reconfigure — GDD:147).");
            Assert.That(probe.Machine.HandoffValid, Is.False, "The previous handoff must be cleared.");
            Assert.That(probe.ContentUnloadCompleteCount, Is.Zero, "No ContentUnloadComplete on the next-race path.");
            Assert.That(probe.RaceReconfigureStartCount, Is.Zero);
            Assert.That(probe.LoadSeam.TrackRequests.Last(), Is.EqualTo(TrackB), "The next race requests the NEW track.");
            Assert.That(probe.SelectionSource.QueryCount, Is.EqualTo(2), "One fresh query per accepted request.");
        }

        // ─── AC-EC6: double request while busy ───

        [Test]
        public void AC_EC6_SecondRequest_WhileBusy_Ignored()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            int queriesAfterFirst = probe.SelectionSource.QueryCount;

            probe.Machine.OnContentLoadRequested(probe.RaceRequest());

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingTrack));
            Assert.That(probe.SelectionSource.QueryCount, Is.EqualTo(queriesAfterFirst), "Zero selection-source queries for the ignored request.");
            Assert.That(probe.LoadSeam.TrackRequests.Count, Is.EqualTo(1));
            Assert.That(probe.RaceLoadReadyCount, Is.Zero);
        }

        [Test]
        public void AC_SM4_UnloadRequest_WhileLoadingCars_IsNoOp_NoCancelSurface()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingCars));

            // Cancel/Back must NOT cancel the load while LoadingCars either (no cancel surface — AC-SM4).
            probe.Machine.OnContentUnloadRequested();
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingCars), "No transition on either request input while LoadingCars.");
            Assert.That(probe.CleanupSeam.BeginCleanupCount, Is.Zero, "No cleanup was begun.");
            Assert.That(probe.ContentUnloadCompleteCount, Is.Zero);
            Assert.That(probe.ContentLoadErrorCount, Is.Zero);
            Assert.That(probe.LoadSeam.ReportCalls, Is.EqualTo(2), "Only the original load's track + car requests — no extra seam calls.");
            Assert.That(probe.RaceLoadReadyCount, Is.Zero);
        }

        // ─── Busy/Unloading + idempotency (R9) ───

        [Test]
        public void BusyUnloading_ContentLoadRequested_IsNoOp()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();
            probe.Machine.OnContentUnloadRequested();
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Unloading));

            probe.Machine.OnContentLoadRequested(probe.RaceRequest());

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Unloading));
            Assert.That(probe.SelectionSource.QueryCount, Is.EqualTo(1), "Deferred to after Idle — no query.");
            Assert.That(probe.LoadSeam.TrackRequests.Count, Is.EqualTo(1));
        }

        [Test]
        public void Idempotency_DuplicateCleanupComplete_EmitsOnce()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();
            probe.Machine.OnContentUnloadRequested();

            probe.CompleteCleanup();
            probe.CompleteCleanup();

            Assert.That(probe.ContentUnloadCompleteCount, Is.EqualTo(1));
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Idle));
        }

        [Test]
        public void Idempotency_DuplicateLoadError_Once()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();

            probe.ReportLoadErrorLocal(ContentErrorType.Track, "first");
            probe.ReportLoadErrorLocal(ContentErrorType.Catalog, "second");

            Assert.That(probe.CleanupSeam.BeginCleanupCount, Is.EqualTo(1));
            probe.CompleteCleanup();
            Assert.That(probe.ContentLoadErrorCount, Is.EqualTo(1), "Only the first error is emitted (idempotent).");
            Assert.That(probe.Errors[0].Reason, Is.EqualTo("first"));
        }

        [Test]
        public void Idempotency_RepeatedCarReport_SameTeam_NoOp()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();

            probe.ReportCar(TeamsA[0]);
            probe.ReportCar(TeamsA[0]);

            Assert.That(probe.Machine.Snapshot.CompletedRaceResourceIds.Count(id => id == TeamsA[0]), Is.EqualTo(1),
                "Set-semantics: duplicates are impossible.");
        }

        // ─── Forwarder exactly-once (R9) ───

        [Test]
        public void ForwarderExactlyOnce_OneCallPerPublication()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();
            Assert.That(probe.Forwarder.Calls.Count, Is.EqualTo(1));

            // A second publication is structurally impossible — the SM left CP_Ready (Racing).
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            Assert.That(probe.Forwarder.Calls.Count, Is.EqualTo(2), "Reconfigure re-emits once; a next-race request would reload, not re-publish.");
        }

        [Test]
        public void RaceReconfigure_ReEmitsWithRequestGrid_NotStoredGrid()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();
            Assert.That(probe.Forwarder.Calls.Count, Is.EqualTo(1));

            GridAssignment qualifyingGrid = new GridAssignment(new[] { 9, 8, 7 });
            probe.Machine.OnContentLoadRequested(new ContentLoadRequest(RaceMode.Race, qualifyingGrid));

            Assert.That(probe.Forwarder.Calls.Count, Is.EqualTo(2));
            Assert.That(probe.Forwarder.Calls[1].Grid, Is.SameAs(qualifyingGrid), "The re-emit must use the REQUEST grid (qualifying grid), not the stored one.");
            Assert.That(probe.ReadyPayloads[1].Grid, Is.SameAs(qualifyingGrid));
        }

        // ─── Snapshot defensive copy ───

        [Test]
        public void Snapshot_CompletedIds_DefensiveCopy()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());

            IReadOnlyCollection<string> first = probe.Machine.Snapshot.CompletedRaceResourceIds;
            probe.ReportTrack();
            probe.ReportCar(TeamsA[0]);
            IReadOnlyCollection<string> second = probe.Machine.Snapshot.CompletedRaceResourceIds;

            Assert.That(first, Is.Empty, "The first copy must not be aliased by later snapshots.");
            Assert.That(second, Is.EquivalentTo(new[] { TrackA, TeamsA[0] }), "The current snapshot reflects the new state.");
        }

        // ─── Reentrancy & subscriber-throw safety (3-7 SafePublish pattern) ───

        [Test]
        public void Reentrancy_UnloadDuringRaceLoadReady_NotOverwritten()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.RaceLoadReady += (_, _) => probe.Machine.OnContentUnloadRequested(); // reentrant unload
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Unloading), "A reentrant unload during the event must NOT be overwritten by the Ready→Racing tail.");
            Assert.That(probe.CleanupSeam.BeginCleanupCount, Is.EqualTo(1));
            Assert.That(probe.Machine.HandoffValid, Is.False, "The handoff must not be re-set after a reentrant unload.");
            Assert.That(probe.Forwarder.Calls.Count, Is.EqualTo(1), "The forward still fired once (readiness was accepted before the reentrant unload).");
        }

        [Test]
        public void Reentrancy_UnloadDuringRaceReconfigureStart_NotOverwritten()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad(); // Racing, forward #1
            int queriesBefore = probe.SelectionSource.QueryCount;
            probe.Machine.RaceReconfigureStart += () => probe.Machine.OnContentUnloadRequested(); // reentrant unload
            probe.Machine.OnContentLoadRequested(probe.RaceRequest()); // same selection → reconfigure

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Unloading), "A reentrant unload during RaceReconfigureStart must win over the re-emit.");
            Assert.That(probe.CleanupSeam.BeginCleanupCount, Is.EqualTo(1));
            Assert.That(probe.Forwarder.Calls.Count, Is.EqualTo(1), "No re-emit after the reentrant unload.");
            Assert.That(probe.SelectionSource.QueryCount, Is.EqualTo(queriesBefore + 1), "One fresh query was made for the reconfigure decision before the reentrant unload.");
            Assert.That(probe.RaceReconfigureStartCount, Is.EqualTo(1));
        }

        [Test]
        public void SubscriberThrow_DuringRaceLoadReady_DoesNotStick()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.RaceLoadReady += (_, _) => throw new InvalidOperationException("subscriber fault");
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Racing), "A subscriber throw must not leave the SM stuck in transitional Ready.");
            Assert.That(probe.Machine.HandoffValid, Is.True);
            Assert.That(probe.Forwarder.Calls.Count, Is.EqualTo(1));
        }

        [Test]
        public void SubscriberThrow_DuringRaceReconfigureStart_DoesNotStick()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();
            probe.Machine.RaceReconfigureStart += () => throw new InvalidOperationException("subscriber fault");
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Racing), "The reconfigure completes despite a subscriber throw.");
            Assert.That(probe.Forwarder.Calls.Count, Is.EqualTo(2), "The re-emit happened.");
            Assert.That(probe.Machine.HandoffValid, Is.True);
        }

        // ─── QA R1 hardening: 16-slot invariant, phase-complete error, busy edge cases, reentrancy, mutation adequacy ───

        [Test]
        public void AC_LO5_FifteenOfSixteen_StaysLoadingCars()
        {
            var probe = new Probe(new RaceContentSelection(TrackA, Teams16));
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();
            for (int i = 0; i < 15; i++)
                probe.ReportCar(Teams16[i]);

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingCars), "15 of 16 slots must NOT complete the load.");
            Assert.That(probe.Forwarder.Calls, Is.Empty);
            Assert.That(probe.RaceLoadReadyCount, Is.Zero);
        }

        [Test]
        public void AC_LO5_SixteenOfSixteen_TransitionsThroughReadyToRacing()
        {
            var probe = new Probe(new RaceContentSelection(TrackA, Teams16));
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();
            foreach (string team in Teams16)
                probe.ReportCar(team);

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Racing));
            Assert.That(probe.Forwarder.Calls.Count, Is.EqualTo(1));
            Assert.That(probe.RaceLoadReadyCount, Is.EqualTo(1));
            Assert.That(probe.Machine.Snapshot.CompletedRaceResourceIds.Count, Is.EqualTo(17), "Track + 16 car slots.");
        }

        [Test]
        public void AC_SM4_LoadError_FromLoadingTrack_Ordering()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingTrack));

            probe.ReportLoadErrorLocal(ContentErrorType.Shared, "shared failed");

            Assert.That(probe.CleanupSeam.BeginCleanupCount, Is.EqualTo(1));
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Unloading));
            Assert.That(probe.ContentLoadErrorCount, Is.Zero, "cleanup-before-error.");

            probe.CompleteCleanup();

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Idle));
            Assert.That(probe.ContentLoadErrorCount, Is.EqualTo(1));
            Assert.That(probe.Errors[0], Is.EqualTo(("shared failed", ContentErrorType.Shared)));
        }

        [Test]
        public void AC_EC6_LoadingCars_SecondRequest_NoSeamCalls_PayloadPreserved()
        {
            var probe = new Probe(SelectionA());
            GridAssignment firstGrid = RaceGrid();
            probe.Machine.OnContentLoadRequested(new ContentLoadRequest(RaceMode.Race, firstGrid));
            probe.ReportTrack();
            int seamCallsBefore = probe.LoadSeam.ReportCalls;
            int queriesBefore = probe.SelectionSource.QueryCount;

            GridAssignment secondGrid = new GridAssignment(new[] { 9, 8, 7 });
            probe.Machine.OnContentLoadRequested(new ContentLoadRequest(RaceMode.Race, secondGrid)); // busy → ignored

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingCars));
            Assert.That(probe.LoadSeam.ReportCalls, Is.EqualTo(seamCallsBefore), "No load-seam call for the ignored request.");
            Assert.That(probe.SelectionSource.QueryCount, Is.EqualTo(queriesBefore), "ZERO selection queries for the ignored request.");

            probe.CompleteLoad();
            Assert.That(probe.Forwarder.Calls[0].Grid, Is.SameAs(firstGrid), "The first request's grid must be preserved, not the ignored one.");
        }

        [Test]
        public void Busy_RequestDuringReadyCallback_Ignored()
        {
            var probe = new Probe(SelectionA());
            int queriesBefore = probe.SelectionSource.QueryCount;
            int seamCallsBefore = probe.LoadSeam.ReportCalls;
            probe.Machine.RaceLoadReady += (_, _) =>
            {
                // Reentrant request DURING the transitional Ready callback — Ready is busy, ignored.
                probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            };
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Racing), "The reentrant request must not disturb the publication.");
            Assert.That(probe.SelectionSource.QueryCount, Is.EqualTo(queriesBefore + 1), "Only the original accepted request queried the selection source.");
            Assert.That(probe.LoadSeam.ReportCalls, Is.EqualTo(seamCallsBefore + 2), "Zero load-seam calls for the reentrant request (initial load adds track + car requests).");
            Assert.That(probe.Forwarder.Calls.Count, Is.EqualTo(1));
        }

        [Test]
        public void CallbackReentrancy_ContentLoadError_SubscriberRequestsNewLoad()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.ContentLoadError += (_, _) => probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();
            probe.ReportLoadErrorLocal(ContentErrorType.Track, "boom");
            probe.CompleteCleanup();

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingTrack), "The subscriber's new load starts from Idle (state already finalized before publication).");
            Assert.That(probe.SelectionSource.QueryCount, Is.EqualTo(2));
        }

        [Test]
        public void CallbackReentrancy_ContentUnloadComplete_SubscriberRequestsNewLoad()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.ContentUnloadComplete += () => probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();
            probe.Machine.OnContentUnloadRequested();
            probe.CompleteCleanup();

            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingTrack), "A new load after unload-complete starts from Idle.");
        }

        [Test]
        public void ErrorFlag_ResetOnNewLoad_SecondErrorEmitted()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportLoadErrorLocal(ContentErrorType.Track, "first");
            probe.CompleteCleanup();
            Assert.That(probe.ContentLoadErrorCount, Is.EqualTo(1));
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Idle));

            probe.Machine.OnContentLoadRequested(probe.RaceRequest()); // second session — latch must be reset
            probe.ReportLoadErrorLocal(ContentErrorType.Catalog, "second");
            probe.CompleteCleanup();

            Assert.That(probe.ContentLoadErrorCount, Is.EqualTo(2), "A new session must be able to report a NEW abortive error.");
            Assert.That(probe.Errors[1], Is.EqualTo(("second", ContentErrorType.Catalog)));
        }

        [Test]
        public void Snapshot_DefensiveCopy_MutationAdequate()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();

            var mutated = new List<string>(probe.Machine.Snapshot.CompletedRaceResourceIds);
            mutated.Add("intruder");
            mutated.Remove(TrackA);

            Assert.That(probe.Machine.Snapshot.CompletedRaceResourceIds, Is.EquivalentTo(new[] { TrackA }),
                "Mutating a returned copy must not alias the SM snapshot.");
        }

        [Test]
        public void ReportCarLoaded_NullOrEmptyTeamId_IsIgnored()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();

            probe.ReportCar(null);
            probe.ReportCar("");
            probe.ReportCar("unknown_team");

            Assert.That(probe.Machine.Snapshot.CompletedRaceResourceIds, Is.EquivalentTo(new[] { TrackA }));
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingCars));
        }

        [Test]
        public void SelectionSource_Throw_FailsFast()
        {
            var probe = new Probe(SelectionA());
            probe.SelectionSource.Throw = true;
            Assert.Throws<InvalidOperationException>(() => probe.Machine.OnContentLoadRequested(probe.RaceRequest()));
        }

        [Test]
        public void DuplicateUnloadRequest_WhileUnloading_NoOp()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();
            probe.Machine.OnContentUnloadRequested();
            int cleanupCalls = probe.CleanupSeam.BeginCleanupCount;

            probe.Machine.OnContentUnloadRequested(); // duplicate while Unloading

            Assert.That(probe.CleanupSeam.BeginCleanupCount, Is.EqualTo(cleanupCalls), "The duplicate unload must not re-enter cleanup.");
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Unloading));
        }

        [Test]
        public void Idempotency_DuplicateLoadError_FromLoadingTrack_Once()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest()); // LoadingTrack, no track report yet

            probe.ReportLoadErrorLocal(ContentErrorType.Track, "first");
            probe.ReportLoadErrorLocal(ContentErrorType.Catalog, "second");

            Assert.That(probe.CleanupSeam.BeginCleanupCount, Is.EqualTo(1));
            probe.CompleteCleanup();
            Assert.That(probe.ContentLoadErrorCount, Is.EqualTo(1));
            Assert.That(probe.Errors[0].Reason, Is.EqualTo("first"));
        }

        // ─── QA R2: session fencing (stale cleanup callback), defensive-copy reference, payload preservation ───

        [Test]
        public void StaleCleanupCallback_FromPreviousSession_IsIgnored()
        {
            var probe = new Probe(SelectionA());
            // Session A: error → cleanup → complete (generation gA consumed).
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportLoadErrorLocal(ContentErrorType.Track, "A failed");
            probe.CompleteCleanup();
            Assert.That(probe.ContentLoadErrorCount, Is.EqualTo(1));
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Idle));

            // Session B: error → cleanup pending (generation gB).
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportLoadErrorLocal(ContentErrorType.Catalog, "B failed");
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Unloading));

            // A late duplicate from session A arrives — must be ignored (does not complete B).
            probe.Machine.ReportCleanupComplete(probe.CleanupSeam.LastGeneration - 1); // stale generation
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Unloading), "Stale callback must not complete the current session.");
            Assert.That(probe.ContentLoadErrorCount, Is.EqualTo(1));

            // The real B completion proceeds.
            probe.CompleteCleanup();
            Assert.That(probe.ContentLoadErrorCount, Is.EqualTo(2));
            Assert.That(probe.Errors[1], Is.EqualTo(("B failed", ContentErrorType.Catalog)));
        }

        [Test]
        public void Snapshot_DefensiveCopy_ReturnsNewCollectionEachRead()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();

            Assert.That(probe.Machine.Snapshot.CompletedRaceResourceIds,
                Is.Not.SameAs(probe.Machine.Snapshot.CompletedRaceResourceIds),
                "Each read must return a fresh defensive copy, never the internal collection.");
        }

        [Test]
        public void StaleLoadError_FromPreviousSession_IsFencedOut()
        {
            var probe = new Probe(SelectionA());
            // Session A: error → cleanup → Idle.
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportLoadErrorLocal(ContentErrorType.Track, "A failed");
            probe.CompleteCleanup();
            Assert.That(probe.ContentLoadErrorCount, Is.EqualTo(1));
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Idle));
            int staleGeneration = probe.Machine.SessionGeneration - 1; // A's token

            // Session B: load begins (new token).
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingTrack));

            // A stale ReportLoadError from session A arrives — must be fenced out.
            probe.Machine.ReportLoadError(staleGeneration, ContentErrorType.Catalog, "stale A error");
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingTrack), "Stale error must not abort session B.");
            Assert.That(probe.CleanupSeam.BeginCleanupCount, Is.EqualTo(1), "No new cleanup for the stale error.");

            // A stale ReportTrackLoaded from session A — fenced out; B's own track report proceeds.
            probe.Machine.ReportTrackLoaded(staleGeneration);
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingTrack));
            probe.ReportTrack();
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingCars));
        }

        [Test]
        public void StaleCarReport_FromPreviousSession_IsFencedOut()
        {
            var probe = new Probe(new RaceContentSelection(TrackA, Teams16));
            // Session A: track + 15 cars (NOT racing yet).
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();
            for (int i = 0; i < 15; i++)
                probe.ReportCar(Teams16[i]);
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingCars));
            int staleGeneration = probe.Machine.SessionGeneration;

            // Session A fails and completes cleanup; session B begins.
            probe.ReportLoadErrorLocal(ContentErrorType.Track, "A failed");
            probe.CompleteCleanup();
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();

            // A stale 16th car report from session A arrives — must be fenced out (B stays LoadingCars).
            probe.Machine.ReportCarLoaded(staleGeneration, Teams16[15]);
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingCars), "Stale car report must not complete session B.");
            Assert.That(probe.Forwarder.Calls, Is.Empty);
            Assert.That(probe.RaceLoadReadyCount, Is.Zero);
        }

        [Test]
        public void StaleCarDegraded_FromPreviousSession_IsFencedOut()
        {
            var probe = new Probe(new RaceContentSelection(TrackA, Teams16));
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();
            for (int i = 0; i < 15; i++)
                probe.ReportCar(Teams16[i]);
            int staleGeneration = probe.Machine.SessionGeneration;

            probe.ReportLoadErrorLocal(ContentErrorType.Track, "A failed");
            probe.CompleteCleanup();
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportTrack();

            probe.Machine.ReportCarDegraded(staleGeneration, Teams16[15]);
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingCars), "Stale degraded report must not complete session B.");
            Assert.That(probe.Forwarder.Calls, Is.Empty);
        }

        [Test]
        public void CleanupId_MisEchoedBySeam_IsRejected()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();
            probe.Machine.OnContentUnloadRequested();
            int issuedId = probe.CleanupSeam.LastGeneration;

            // A mis-echoed id (e.g. a seam that reuses/corrupts tokens) must NOT complete the cleanup.
            probe.Machine.ReportCleanupComplete(issuedId + 100);
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Unloading), "A mis-echoed cleanup id must be rejected — the SM owns the token.");
            Assert.That(probe.ContentUnloadCompleteCount, Is.Zero);

            // The correct id completes normally.
            probe.CompleteCleanup();
            Assert.That(probe.ContentUnloadCompleteCount, Is.EqualTo(1));
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.Idle));
        }

        [Test]
        public void CleanupId_IsMonotonicAcrossSessions_NoNumericalCollision()
        {
            var probe = new Probe(SelectionA());
            // Session A error → cleanup (id N).
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportLoadErrorLocal(ContentErrorType.Track, "A");
            int firstId = probe.CleanupSeam.LastGeneration;
            probe.CompleteCleanup();

            // Session B error → cleanup (id N+1 — never reused).
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.ReportLoadErrorLocal(ContentErrorType.Catalog, "B");
            int secondId = probe.CleanupSeam.LastGeneration;
            Assert.That(secondId, Is.EqualTo(firstId + 1), "The SM-owned cleanup id must be monotonic — a stale callback can never numerically collide.");
            probe.CompleteCleanup();
            Assert.That(probe.ContentLoadErrorCount, Is.EqualTo(2));
        }

        [Test]
        public void SessionGeneration_StableThroughReconfigure_IncrementsOnNextRace()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest());
            probe.CompleteLoad();
            int afterInitial = probe.Machine.SessionGeneration;

            probe.Machine.OnContentLoadRequested(probe.RaceRequest()); // reconfigure — no StoreSession
            Assert.That(probe.Machine.SessionGeneration, Is.EqualTo(afterInitial), "Reconfigure must NOT advance the token (cache-hit, no new load).");

            probe.SelectionSource.Selection = new RaceContentSelection(TrackB, TeamsB);
            probe.Machine.OnContentLoadRequested(probe.RaceRequest()); // next race — StoreSession
            Assert.That(probe.Machine.SessionGeneration, Is.EqualTo(afterInitial + 1), "Next race advances the token — stale reports from the previous session are fenced out.");
        }

        [Test]
        public void CurrentTokenReport_InWrongState_IsIgnored()
        {
            var probe = new Probe(SelectionA());
            probe.Machine.OnContentLoadRequested(probe.RaceRequest()); // LoadingTrack

            // Current token but wrong state: car reports must not be accepted in LoadingTrack.
            probe.ReportCar(TeamsA[0]);
            probe.ReportCarDegradedLocal(TeamsA[1]);
            Assert.That(probe.Machine.State, Is.EqualTo(ContentPipelineState.LoadingTrack));
            Assert.That(probe.Machine.Snapshot.CompletedRaceResourceIds, Is.Empty);
        }
    }
}
