using System;
using System.Collections.Generic;
using Overdrive.Simulation;

namespace Overdrive.Content
{
    /// <summary>
    /// Injectable Addressables seam — the engine-free orchestrator (Story 003) drives
    /// loading through this port; the Unity-backed implementation wraps
    /// <c>Addressables.LoadAssetAsync</c> in <c>Overdrive.Content.Unity</c>.
    /// </summary>
    public interface IAddressableLoader
    {
        /// <summary>Starts an async asset load for <paramref name="key"/>; <paramref name="onComplete"/> is invoked once when the handle finishes.</summary>
        IAsyncLoadHandle LoadAssetAsync(object key, Action<IAsyncLoadHandle> onComplete);
    }

    /// <summary>
    /// Engine-free view of one in-flight load (also the per-handle download status source
    /// — "per handle" per the story seams). The Unity-backed implementation wraps an
    /// <c>AsyncOperationHandle</c>; the orchestrator never touches UnityEngine.
    /// </summary>
    public interface IAsyncLoadHandle : IDownloadStatusSource
    {
        /// <summary>True once the underlying operation completed (success or failure).</summary>
        bool IsDone { get; }

        /// <summary>The loaded asset (null when the operation failed).</summary>
        object Result { get; }

        /// <summary>The operation exception when it failed; null on success.</summary>
        Exception OperationException { get; }

        /// <summary>Releases the underlying Addressable handle (decrements the refcount).</summary>
        void Release();
    }

    /// <summary>
    /// Per-handle download status (bytes) — the progress ratio source
    /// (ADR-0003:226, GDD:169-177). The Unity-backed implementation reads
    /// <c>AsyncOperationHandle.GetDownloadStatus()</c>.
    /// </summary>
    public interface IDownloadStatusSource
    {
        /// <summary>Current downloaded/total bytes for the handle (total may be 0 for cached loads).</summary>
        (long DownloadedBytes, long TotalBytes) GetDownloadStatus();
    }

    /// <summary>
    /// Instantiation seam — the orchestrator instantiates the TRACK (AC-LO3) through this
    /// port; the Unity-backed implementation wraps <c>Object.Instantiate</c>.
    /// Car GameObjects are NOT instantiated by Content (Vehicle Physics / Grid &amp; Start).
    /// </summary>
    public interface IContentInstantiator
    {
        /// <summary>Instantiates <paramref name="prefab"/> and returns the instance (null on failure).</summary>
        object Instantiate(object prefab);

        /// <summary>Destroys a previously instantiated instance (abort cleanup).</summary>
        void ReleaseInstance(object instance);
    }

    /// <summary>Memory pressure source — the orchestrator samples this to enforce the GDD memory policy.</summary>
    public interface IMemoryPressureSource
    {
        /// <summary>Used/available memory ratio (0..1+).</summary>
        float Pressure { get; }
    }

    /// <summary>
    /// Quality-reduction request port (AC-MB4): the orchestrator requests a quality-tier
    /// reduction when pressure reaches [0.85, 0.95]. The target tier and its application are
    /// Settings-owned — out of scope; the impl only asserts the request was made.
    /// </summary>
    public interface IQualityReductionRequest
    {
        /// <summary>Requests a quality reduction with the given reason.</summary>
        void RequestQualityReduction(string reason);
    }

    /// <summary>
    /// Diagnostics sink — injectable so AC-MB3/4 warnings and degraded notifications are
    /// observable in unit tests; the Unity-backed implementation wires <c>Debug.Log</c>.
    /// </summary>
    public interface IDiagnosticsSink
    {
        /// <summary>Logs a warning.</summary>
        void LogWarning(string message);

        /// <summary>Logs an error.</summary>
        void LogError(string message);
    }

    /// <summary>
    /// Progress output seam (gate R2): the orchestrator exposes the aggregated byte-derived
    /// progress here — the observable contract AC-LO2/LP1/LP3 assert against.
    /// </summary>
    public interface IRaceLoadProgress
    {
        /// <summary>Aggregated progress in [0, 1] (bytes_loaded/total_bytes; forced to 1.0 at full termination).</summary>
        float Progress { get; }

        /// <summary>Raised on every observed progress change (intermediate samples allowed).</summary>
        event Action<float> ProgressChanged;
    }

    /// <summary>
    /// Clock seam (gate R4) — injectable so the 1s progress/memory sampling tick is
    /// deterministic in tests; the Unity-backed implementation wraps
    /// <c>Time.realtimeSinceStartup</c>.
    /// </summary>
    public interface IClock
    {
        /// <summary>
        /// Current time in seconds — MUST be monotonic (never decrease): the 1s sampling
        /// tick derives elapsed time from successive reads, so a backwards clock would
        /// suppress sampling until it catches back up (gate R4 contract).
        /// </summary>
        float Time { get; }
    }

    /// <summary>
    /// Readiness handoff (AC-LO3) — populated by the orchestrator BEFORE
    /// <c>RaceLoadReady</c> is forwarded. Vehicle Physics / Grid &amp; Start read it to spawn
    /// car GameObjects; Content instantiates the TRACK and loads car PREFAB assets only.
    /// Engine-free: object references (no UnityEngine) — registered in architecture.yaml as
    /// <c>content_race_runtime_handoff</c>.
    /// </summary>
    public interface IRaceContentRuntime
    {
        /// <summary>The instantiated track (null before the track reports).</summary>
        object TrackInstance { get; }

        /// <summary>Loaded car prefab assets in team-id order — degraded slots are ABSENT (EC2/EC8).</summary>
        IReadOnlyList<object> CarReferences { get; }

        /// <summary>The locked grid assignment (populated before readiness by the composition root).</summary>
        GridAssignment Grid { get; }

        /// <summary>Valid from RaceLoadReady until the EARLIER of ContentUnloadComplete or a next-race transition (Story 002 dual-path).</summary>
        bool IsValid { get; }
    }

    /// <summary>
    /// Write-side of the runtime handoff — the orchestrator (Story 003) populates the track
    /// instance, car references, and retained handles through this port; the concrete
    /// <c>IRaceContentRuntime</c> implementation implements BOTH interfaces.
    /// </summary>
    public interface IRaceContentAccumulator
    {
        /// <summary>Clears all accumulated state for a new load session (does NOT release retained handles — see <see cref="ReleaseRetainedHandles"/>).</summary>
        void Reset();

        /// <summary>Records the instantiated track instance (before ReportTrackLoaded).</summary>
        void SetTrackInstance(object trackInstance);

        /// <summary>The instantiated track of the current session, or null.</summary>
        object TrackInstance { get; }

        /// <summary>Starts a fresh car slot set of the given size (called by the orchestrator at RequestCarLoads).</summary>
        void BeginCarReferences(int count);

        /// <summary>Records one loaded car prefab at its team index. CarReferences MUST be in
        /// TeamIds order (the grid consumer pairs CarReferences[i] with TeamIds[i]) —
        /// parallel completion order is non-deterministic, so the orchestrator resolves
        /// the index from the request list.
        /// </summary>
        void SetCarReference(int teamIndex, object carPrefab);

        /// <summary>Retains a load handle for the race lifetime (Story 004 cleanup releases it).</summary>
        void AddRetainedHandle(IAsyncLoadHandle handle);

        /// <summary>Releases every retained handle from prior sessions (called by the orchestrator at reset — next-race has no cleanup path).</summary>
        void ReleaseRetainedHandles();

        /// <summary>Sets the locked grid (called by the composition root before forwarding readiness).</summary>
        void SetGrid(GridAssignment grid);
    }

    /// <summary>
    /// Inbound report port the orchestrator consumes — the <see cref="ContentStateMachine"/>
    /// implements this (its public Report* methods + <c>SessionGeneration</c>). Declared so
    /// the orchestrator depends on the abstraction, breaking the construction cycle
    /// (the SM needs the load seam; the load seam needs the reporter).
    /// </summary>
    public interface IContentLoadReporter
    {
        /// <summary>The SM session generation the load impl echoes on every report (session fencing).</summary>
        int SessionGeneration { get; }

        /// <summary>Reports the track bundle loaded.</summary>
        void ReportTrackLoaded(int sessionGeneration);

        /// <summary>Reports one car bundle loaded.</summary>
        void ReportCarLoaded(int sessionGeneration, string teamId);

        /// <summary>Reports one car bundle degraded (non-fatal — GDD:144).</summary>
        void ReportCarDegraded(int sessionGeneration, string teamId);

        /// <summary>Reports an abortive load error (track/catalog/memory).</summary>
        void ReportLoadError(int sessionGeneration, ContentErrorType type, string reason);
    }
}
