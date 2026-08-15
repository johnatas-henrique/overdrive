using System;
using System.Collections.Generic;
using NUnit.Framework;
using Overdrive.Simulation;

namespace Overdrive.Content.Tests
{
    /// <summary>
    /// Unit tests for Story 3-11 (Race Unload): the engine-free
    /// <see cref="RaceCleanupSeam"/> — SM ↔ seam wiring, release-before-echo ordering,
    /// cleanup-id echo, both paths (unload + error), idempotency. The seam is REAL; the
    /// <see cref="IContentReleaser"/> port is a fake with an order-observing callback.
    /// Instance-before-handle ordering inside <c>UnityContentRuntime.ReleaseAll()</c> is
    /// verified in the integration tests (real composition root).
    /// </summary>
    public class RaceUnloadTests
    {
        private const string TrackA = "monza";
        private static readonly string[] TeamsA = { "team_0", "team_1", "team_2" };

        // ─── Fakes (low-level seams — the SM + RaceCleanupSeam are real) ─────────────

        private sealed class FakeSelectionSource : IContentSelectionSource
        {
            private readonly RaceContentSelection _selection;

            public FakeSelectionSource(RaceContentSelection selection) => _selection = selection;

            public RaceContentSelection GetSelection() => _selection;
        }

        private sealed class FakeLoadSeam : IContentLoadSeam
        {
            public List<string> TrackRequests = new List<string>();
            public List<List<string>> CarRequests = new List<List<string>>();

            public void RequestTrackLoad(string trackId) => TrackRequests.Add(trackId);

            public void RequestCarLoads(IReadOnlyList<string> teamIds) => CarRequests.Add(new List<string>(teamIds));
        }

        private sealed class FakeForwarder : IReadinessForwarder
        {
            public int ForwardCount;

            public void Forward(RaceMode raceMode, GridAssignment gridAssignment) => ForwardCount++;
        }

        /// <summary>Late-bound <see cref="IContentCleanupSeam"/> — mirrors the composition root's CleanupSeamProxy (breaks the SM ↔ seam construction cycle).</summary>
        private sealed class CleanupSeamProxy : IContentCleanupSeam
        {
            private IContentCleanupSeam _target;

            public void Bind(IContentCleanupSeam target) => _target = target;

            public void BeginCleanup(int cleanupId) => _target.BeginCleanup(cleanupId);
        }

        /// <summary>
        /// Fake <see cref="IContentReleaser"/> with an order-observing callback: captures the
        /// SM state AT THE INSTANT ReleaseAll runs, proving release-before-echo (the echo
        /// via ReportCleanupComplete is what transitions the SM out of CP_Unloading).
        /// </summary>
        private sealed class FakeReleaser : IContentReleaser
        {
            public int ReleaseAllCount;

            public Func<ContentPipelineState> StateReader;

            public Func<int> ErrorCountReader;

            public ContentPipelineState StateAtRelease;

            /// <summary>Error count AT THE INSTANT ReleaseAll runs — proves release-before-error on the error path.</summary>
            public int ErrorCountAtRelease;

            public void ReleaseAll()
            {
                ReleaseAllCount++;
                StateAtRelease = StateReader();
                ErrorCountAtRelease = ErrorCountReader();
            }
        }

        private sealed class Probe
        {
            public readonly FakeSelectionSource SelectionSource;
            public readonly FakeLoadSeam LoadSeam;
            public readonly CleanupSeamProxy CleanupProxy;
            public readonly FakeReleaser Releaser;
            public readonly FakeForwarder Forwarder;
            public readonly ContentStateMachine Machine;
            public int ContentUnloadCompleteCount;
            public int ContentLoadErrorCount;
            public List<(string Reason, ContentErrorType Type)> Errors = new List<(string, ContentErrorType)>();

            public Probe(RaceContentSelection selection)
            {
                SelectionSource = new FakeSelectionSource(selection);
                LoadSeam = new FakeLoadSeam();
                CleanupProxy = new CleanupSeamProxy();
                Releaser = new FakeReleaser();
                Forwarder = new FakeForwarder();
                Machine = new ContentStateMachine(
                    SelectionSource,
                    LoadSeam,
                    CleanupProxy,
                    Forwarder,
                    new ContentResourceState(true, Array.Empty<string>()));
                Releaser.StateReader = () => Machine.State;
                Releaser.ErrorCountReader = () => ContentLoadErrorCount;
                // The production composition root binds the proxy to the real seam AFTER the
                // SM is constructed — mirror that here.
                CleanupProxy.Bind(new RaceCleanupSeam(Releaser, Machine));
                Machine.ContentUnloadComplete += () => ContentUnloadCompleteCount++;
                Machine.ContentLoadError += (reason, type) => { ContentLoadErrorCount++; Errors.Add((reason, type)); };
            }

            public ContentLoadRequest RaceRequest(GridAssignment grid = null) =>
                new ContentLoadRequest(RaceMode.Race, grid ?? RaceGrid());

            /// <summary>Idle → LoadingTrack → (fake load seam recorded the requests) → manually report → Ready → Forward → Racing.</summary>
            public void LoadRaceAndComplete()
            {
                Machine.OnContentLoadRequested(RaceRequest());
                Machine.ReportTrackLoaded(Machine.SessionGeneration);
                foreach (string team in TeamsA)
                    Machine.ReportCarLoaded(Machine.SessionGeneration, team);
            }

            public void Unload() => Machine.OnContentUnloadRequested();

            private static GridAssignment RaceGrid() => new GridAssignment(new[] { 0, 1, 2 });
        }

        private static RaceContentSelection SelectionA() => new RaceContentSelection(TrackA, TeamsA);

        // ─── AC-UL1: unload path — release runs BEFORE the completion echo ───────────

        [Test]
        public void AC_UL1_UnloadPath_ReleaseBeforeEcho_UnloadComplete_Idle()
        {
            var p = new Probe(SelectionA());
            p.LoadRaceAndComplete();
            Assert.That(p.Machine.State, Is.EqualTo(ContentPipelineState.Racing));

            p.Unload();

            // The release ran while the SM was STILL in Unloading (before the echo completed it).
            Assert.That(p.Releaser.StateAtRelease, Is.EqualTo(ContentPipelineState.Unloading),
                "ReleaseAll runs before ReportCleanupComplete (release-before-echo).");
            Assert.That(p.Releaser.ReleaseAllCount, Is.EqualTo(1), "ReleaseAll called exactly once.");
            Assert.That(p.ContentUnloadCompleteCount, Is.EqualTo(1), "ContentUnloadComplete emitted after the echo.");
            Assert.That(p.Machine.State, Is.EqualTo(ContentPipelineState.Idle), "SM returns to Idle.");
            Assert.That(p.Machine.HandoffValid, Is.False, "Handoff invalidated by the unload path.");
        }

        // ─── AC-UL1: error path — release BEFORE the error propagates (AC-SM4) ───────

        [Test]
        public void AC_UL1_ErrorPath_ReleaseBeforeError_LoadError_Idle()
        {
            var p = new Probe(SelectionA());
            p.Machine.OnContentLoadRequested(p.RaceRequest());
            // Abortive error while LoadingTrack (track failure, memory abort — Story 003 path).
            p.Machine.ReportLoadError(p.Machine.SessionGeneration, ContentErrorType.Track, "track bundle failed");

            // The real seam ran synchronously: release + echo → error emitted after cleanup.
            Assert.That(p.Releaser.StateAtRelease, Is.EqualTo(ContentPipelineState.Unloading),
                "ReleaseAll runs before ReportCleanupComplete on the error path (cleanup-before-error).");
            Assert.That(p.ContentLoadErrorCount, Is.EqualTo(1), "ContentLoadError emitted after cleanup.");
            Assert.That(p.Errors[0].Type, Is.EqualTo(ContentErrorType.Track));
            Assert.That(p.Machine.State, Is.EqualTo(ContentPipelineState.Idle));
            Assert.That(p.ContentUnloadCompleteCount, Is.EqualTo(0), "Error path emits ContentLoadError, not ContentUnloadComplete.");
        }

        // ─── Partial-handle cleanup: retained released before error propagates ────────

        [Test]
        public void PartialCleanup_ReleaseAllCalledOnce_BeforeError()
        {
            var p = new Probe(SelectionA());
            p.Machine.OnContentLoadRequested(p.RaceRequest());
            p.Machine.ReportLoadError(p.Machine.SessionGeneration, ContentErrorType.Track, "pressure > 0.95 (memory abort)");

            Assert.That(p.Releaser.ReleaseAllCount, Is.EqualTo(1), "The seam releases retained + instance exactly once on abort.");
            Assert.That(p.Releaser.StateAtRelease, Is.EqualTo(ContentPipelineState.Unloading));
            Assert.That(p.ContentLoadErrorCount, Is.EqualTo(1));
            Assert.That(p.Machine.State, Is.EqualTo(ContentPipelineState.Idle));
        }

        // ─── Cleanup-before-error ORDER: the error is emitted AFTER the release ───────

        [Test]
        public void ErrorOrder_ReleaseRunsBeforeErrorEmitted()
        {
            var p = new Probe(SelectionA());
            p.Machine.OnContentLoadRequested(p.RaceRequest());

            p.Machine.ReportLoadError(p.Machine.SessionGeneration, ContentErrorType.Track, "track bundle failed");

            // At the INSTANT ReleaseAll ran, the error had NOT yet been emitted (the SM emits
            // ContentLoadError only inside ReportCleanupComplete, which runs after the release).
            Assert.That(p.Releaser.ErrorCountAtRelease, Is.EqualTo(0),
                "ReleaseAll runs BEFORE ContentLoadError is emitted (cleanup-before-error, AC-SM4).");
            Assert.That(p.ContentLoadErrorCount, Is.EqualTo(1), "Error emitted once after the release.");
            Assert.That(p.Machine.State, Is.EqualTo(ContentPipelineState.Idle));
        }

        // ─── Cleanup-id echo: the seam echoes the SM-generated token ─────────────────

        [Test]
        public void CleanupId_Echo_ExactTokenAccepted()
        {
            var p = new Probe(SelectionA());
            p.LoadRaceAndComplete();

            // The SM generates the cleanup id when entering Unloading; the real seam echoes it
            // back verbatim, so ReportCleanupComplete accepts it (id match). A wrong echo would
            // be silently ignored and the SM would stay in Unloading.
            p.Unload();

            Assert.That(p.Machine.State, Is.EqualTo(ContentPipelineState.Idle),
                "The echoed cleanup id matched the SM-generated token (id-match accepted).");
            Assert.That(p.ContentUnloadCompleteCount, Is.EqualTo(1));
        }

        // ─── Cleanup-id echo is NOT hardcoded: a SECOND cleanup echoes id 2, not 1 ───

        [Test]
        public void CleanupId_SecondSession_EchoesSecondToken()
        {
            var p = new Probe(SelectionA());

            // Session 1 unload → cleanup id 1.
            p.LoadRaceAndComplete();
            p.Unload();
            Assert.That(p.Machine.State, Is.EqualTo(ContentPipelineState.Idle));

            // Session 2 (new race) → a FRESH cleanup id (monotonic, SM-owned). A seam that
            // hardcodes ReportCleanupComplete(1) would be ignored and the SM would stay stuck
            // in Unloading — this test proves the seam echoes the ACTUAL token each time.
            p.LoadRaceAndComplete();
            p.Unload();

            Assert.That(p.Machine.State, Is.EqualTo(ContentPipelineState.Idle),
                "The second cleanup echoed the second SM-generated token (not a hardcoded first id).");
            Assert.That(p.ContentUnloadCompleteCount, Is.EqualTo(2), "Both unloads completed exactly once.");
        }

        // ─── Idempotency: a second unload after completion is a no-op ────────────────

        [Test]
        public void Idempotency_SecondUnload_NoDoubleRelease()
        {
            var p = new Probe(SelectionA());
            p.LoadRaceAndComplete();
            p.Unload();
            Assert.That(p.Releaser.ReleaseAllCount, Is.EqualTo(1));

            p.Unload(); // Idle → OnContentUnloadRequested no-op (AC-SM3).

            Assert.That(p.Releaser.ReleaseAllCount, Is.EqualTo(1), "No second release on a no-op unload.");
            Assert.That(p.ContentUnloadCompleteCount, Is.EqualTo(1), "No second ContentUnloadComplete.");
            Assert.That(p.Machine.State, Is.EqualTo(ContentPipelineState.Idle));
        }

        // ─── Empty retained set: cleanup completes cleanly with no releases ──────────

        [Test]
        public void EmptyRetainedSet_Racing_UnloadCompletes()
        {
            var p = new Probe(SelectionA());
            p.LoadRaceAndComplete();

            p.Unload();
            Assert.That(p.Releaser.ReleaseAllCount, Is.EqualTo(1),
                "The seam still calls ReleaseAll (the fake releaser is empty — no-op) and echoes completion.");
            Assert.That(p.ContentUnloadCompleteCount, Is.EqualTo(1));
            Assert.That(p.Machine.State, Is.EqualTo(ContentPipelineState.Idle));
        }

        // ─── Unload during Loading* is a no-op (AC-SM4) — no seam call ───────────────

        [Test]
        public void UnloadDuringLoading_NoOp_NoRelease()
        {
            var p = new Probe(SelectionA());
            p.Machine.OnContentLoadRequested(p.RaceRequest());
            Assert.That(p.Machine.State, Is.EqualTo(ContentPipelineState.LoadingTrack));

            p.Unload();

            Assert.That(p.Releaser.ReleaseAllCount, Is.EqualTo(0), "Loading* unload is a no-op (AC-SM4) — no cleanup begun.");
            Assert.That(p.ContentUnloadCompleteCount, Is.EqualTo(0));
            Assert.That(p.Machine.State, Is.EqualTo(ContentPipelineState.LoadingTrack));
        }
    }
}
