using System.Collections.Generic;

namespace Overdrive.Content
{
    /// <summary>
    /// Injectable port supplying the current race selection. The SM queries it EXACTLY
    /// ONCE per accepted <c>ContentLoadRequested</c> (AC-LO4; also the fresh query in
    /// CP_Racing for the reconfigure-vs-next-race decision). Implemented by Story
    /// 003/composition (receives the selection from the RaceSessionManager); unit tests
    /// inject a fake.
    /// </summary>
    public interface IContentSelectionSource
    {
        /// <summary>Returns the current race selection (track + team ids).</summary>
        RaceContentSelection GetSelection();
    }

    /// <summary>
    /// Load orchestration port — SINGLE direction ownership: the SM calls the outbound
    /// requests; the real load implementation (Story 003) reports completion by invoking
    /// the SM's public inbound methods (<c>ReportTrackLoaded</c>, <c>ReportCarLoaded</c>,
    /// <c>ReportCarDegraded</c>, <c>ReportLoadError</c>) — the same inbound-method pattern
    /// as <c>SimulationStateMachine.OnRaceLoadReady</c>.
    /// </summary>
    public interface IContentLoadSeam
    {
        /// <summary>Requests the track bundle load (SM → seam, AC-LO4).</summary>
        void RequestTrackLoad(string trackId);

        /// <summary>Requests the 16 car bundle loads (SM → seam, LoadingCars entry).</summary>
        void RequestCarLoads(IReadOnlyList<string> teamIds);
    }

    /// <summary>
    /// Cleanup port: <see cref="BeginCleanup"/> is called by the SM on entering CP_Unloading
    /// (delegates the real release to the Story 004 implementation) with a SM-GENERATED
    /// cleanup id; the real implementation reports completion by invoking the SM's
    /// <c>ReportCleanupComplete(cleanupId)</c> echoing that SAME id — the SM accepts only the
    /// id it generated (the id is monotonic and never reused, so a stale callback from a
    /// previous session's cleanup is structurally impossible). <c>ReportCleanupComplete</c> is
    /// the ONLY trigger for the <c>ContentUnloadComplete</c> emission (AC-LO8).
    /// </summary>
    public interface IContentCleanupSeam
    {
        /// <summary>Begins destroying instances and releasing handles; <paramref name="cleanupId"/> is the SM-generated token the implementation must echo back.</summary>
        void BeginCleanup(int cleanupId);
    }

    /// <summary>
    /// Readiness publication port. The SM calls <see cref="Forward"/> EXACTLY ONCE per
    /// accepted readiness and ONLY from the transitional CP_Ready state (AC-LO6). The
    /// implementation (Story 003/composition) invokes
    /// <c>SimulationStateMachine.OnRaceLoadReady</c> (void — no acknowledge). A throw is a
    /// wiring defect and the SM does NOT catch it (fail-fast). Registered in
    /// architecture.yaml as <c>content_readiness_forwarder</c>.
    /// </summary>
    public interface IReadinessForwarder
    {
        /// <summary>Forwards readiness with the exact stored payload.</summary>
        void Forward(Overdrive.Simulation.RaceMode raceMode, Overdrive.Simulation.GridAssignment gridAssignment);
    }
}
