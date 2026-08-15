using System.Collections.Generic;
using System;

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
    /// Release port for the cleanup seam (Story 004): the engine-free
    /// <see cref="RaceCleanupSeam"/> performs the release through this abstraction; the
    /// Unity-backed composition root binds it to <c>UnityContentRuntime.ReleaseAll()</c>
    /// (instances via <c>ReleaseInstance</c> first, then base handles via <c>Release</c> —
    /// ADR-0003:100-105). NOT <see cref="IRaceContentAccumulator"/> — that interface
    /// expresses load mutation and does not expose instance release.
    /// </summary>
    public interface IContentReleaser
    {
        /// <summary>Releases every retained handle and destroys the instantiated track (idempotent).</summary>
        void ReleaseAll();
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

    /// <summary>Outcome of one catalog initialization attempt (Story 005).</summary>
    public readonly struct CatalogInitResult
    {
        /// <summary>Creates a result.</summary>
        public CatalogInitResult(bool success, string errorReason)
        {
            Success = success;
            ErrorReason = errorReason ?? string.Empty;
        }

        /// <summary>True when the Addressables catalog initialized.</summary>
        public readonly bool Success;

        /// <summary>Failure reason (empty on success).</summary>
        public readonly string ErrorReason;
    }

    /// <summary>Outcome of one Shared-group load (Story 005).</summary>
    public readonly struct SharedLoadResult
    {
        /// <summary>Creates a result.</summary>
        public SharedLoadResult(bool success, string errorReason)
        {
            Success = success;
            ErrorReason = errorReason ?? string.Empty;
        }

        /// <summary>True when the Shared group loaded and is retained.</summary>
        public readonly bool Success;

        /// <summary>Failure reason (empty on success).</summary>
        public readonly string ErrorReason;
    }

    /// <summary>
    /// Catalog initialization port (Story 005): async callback (NOT <c>WaitForCompletion</c> —
    /// single-threaded WebGL), matching the project's <see cref="IAddressableLoader"/> pattern.
    /// The Unity adapter wraps <c>Addressables.InitializeAsync</c>; the init handle is consumed
    /// inside the completion (never retained — only the Shared handle is retained lifelong).
    /// </summary>
    public interface ICatalogInitializer
    {
        /// <summary>Begins one catalog initialization attempt; <paramref name="onComplete"/> fires exactly once.</summary>
        void Initialize(Action<CatalogInitResult> onComplete);
    }

    /// <summary>
    /// Shared-group load port (Story 005): loads and RETAINS the Shared group (GDD:54 —
    /// persists for the app lifetime). The Unity adapter wraps
    /// <c>Addressables.LoadAssetAsync&lt;GameObject&gt;</c> on the Shared bootstrap sentinel
    /// address (<c>AddressableKeys.SharedBootstrap</c>).
    /// </summary>
    public interface ISharedLoader
    {
        /// <summary>Begins the Shared load; <paramref name="onComplete"/> fires exactly once.</summary>
        void LoadShared(Action<SharedLoadResult> onComplete);
    }

    /// <summary>
    /// Fatal-error port (Story 005): engine-free core only RECORDS the fatal (the Unity adapter
    /// shows the error and calls <c>Application.Quit</c> — GDD:193/:202 "show error and close").
    /// The orchestrator invokes <see cref="Fatal"/> EXACTLY ONCE (idempotent terminal).
    /// </summary>
    public interface IFatalErrorHandler
    {
        /// <summary>Handles a fatal startup error (catalog or Shared); the app must close.</summary>
        void Fatal(string reason, Overdrive.Simulation.ContentErrorType type);
    }

    /// <summary>
    /// Focus/lifecycle port (Story 005, AC-EC7): the Unity adapter wraps
    /// <c>Application.isFocused</c> + <c>Application.focusChanged</c>. The startup orchestrator
    /// subscribes in its constructor (lifetime = session). While unfocused the orchestrator
    /// defers stage advancement; in-flight completions are buffered and consumed once on re-focus.
    /// </summary>
    public interface IFocusSeam
    {
        /// <summary>True when the app window/tab is focused.</summary>
        bool IsFocused { get; }

        /// <summary>Fires when focus changes (true = focused).</summary>
        event Action<bool> FocusChanged;
    }
}
