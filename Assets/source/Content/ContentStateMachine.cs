using System;
using System.Collections.Generic;
using System.Linq;
using Overdrive.Simulation;

namespace Overdrive.Content
{
    /// <summary>
    /// Content Pipeline state machine (story 3-9, ADR-0003:66-84, GDD:124-152).
    /// Authoritative lifecycle: Idle → LoadingTrack → LoadingCars → (transitional Ready) →
    /// Racing → Unloading → Idle. Error: Loading* → Unloading → Idle (cleanup-before-error,
    /// Kernel :251-259). Reconfigure: Racing → RaceReconfigure → (Ready) → Racing with ZERO
    /// Addressables I/O (GDD:146). Next race: Racing → LoadingTrack (GDD:147).
    ///
    /// Content NEVER writes <see cref="SimulationState"/> — it emits readiness/errors and
    /// the Kernel accepts them (ADR-0003). The SM is engine-free orchestration: all domain
    /// work is delegated to the injectable seams (<see cref="IContentSelectionSource"/>,
    /// <see cref="IContentLoadSeam"/>, <see cref="IContentCleanupSeam"/>,
    /// <see cref="IReadinessForwarder"/>).
    /// </summary>
    public class ContentStateMachine
    {
        private readonly IContentSelectionSource _selectionSource;
        private readonly IContentLoadSeam _loadSeam;
        private readonly IContentCleanupSeam _cleanupSeam;
        private readonly IReadinessForwarder _forwarder;

        private ContentPipelineState _state = ContentPipelineState.Idle;
        private ContentResourceState _snapshot;
        private RaceContentSelection _storedSelection;
        private RaceMode _storedMode;
        private GridAssignment _storedGrid;
        private bool _handoffValid;
        private bool _cleanupReported;
        private bool _errorReported;
        private int _cleanupGeneration = -1;
        private int _cleanupSequence;
        private int _sessionGeneration = 1;
        private ContentErrorType? _pendingErrorType;
        private string _pendingErrorReason;

        /// <summary>Raised once per accepted readiness publication (initial and re-emit).</summary>
        public event Action<RaceMode, GridAssignment> RaceLoadReady;

        /// <summary>Raised once per abortive load error AFTER cleanup completes (AC-SM4 ordering).</summary>
        public event Action<string, ContentErrorType> ContentLoadError;

        /// <summary>Raised once when cleanup completes (the ONLY trigger — AC-LO8).</summary>
        public event Action ContentUnloadComplete;

        /// <summary>Raised once per race reconfiguration (one-way event, ADR-0003:157).</summary>
        public event Action RaceReconfigureStart;

        /// <summary>Current Content Pipeline state.</summary>
        public ContentPipelineState State => _state;

        /// <summary>Immutable resource-inventory snapshot (defensive copy).</summary>
        public ContentResourceState Snapshot => _snapshot;

        /// <summary>
        /// Handoff validity flag: true from every successful readiness publication until the
        /// EARLIER of ContentUnloadComplete (unload path) or a next-race transition into
        /// CP_LoadingTrack (dual-path contract, architecture.yaml:224). Consumers must not
        /// retain the runtime past invalidation.
        /// </summary>
        public bool HandoffValid => _handoffValid;

        /// <summary>
        /// Session identity token for load-report fencing: the load implementation (Story 003)
        /// reads this when it receives <c>RequestTrackLoad</c>/<c>RequestCarLoads</c> and returns
        /// it in every <c>Report*</c> — the SM accepts only reports carrying the CURRENT token, so
        /// a stale report from a previous session (e.g. a late Addressables callback) cannot abort
        /// or complete the current session.
        /// </summary>
        public int SessionGeneration => _sessionGeneration;

        /// <summary>
        /// Creates the state machine. The initial snapshot is SEEDED by composition (the
        /// Shared-loaded state — Story 005 loads Shared at startup before the CP starts);
        /// subsequent states are driven by inbound reports.
        /// </summary>
        public ContentStateMachine(
            IContentSelectionSource selectionSource,
            IContentLoadSeam loadSeam,
            IContentCleanupSeam cleanupSeam,
            IReadinessForwarder forwarder,
            ContentResourceState initialSnapshot)
        {
            _selectionSource = selectionSource ?? throw new ArgumentNullException(nameof(selectionSource));
            _loadSeam = loadSeam ?? throw new ArgumentNullException(nameof(loadSeam));
            _cleanupSeam = cleanupSeam ?? throw new ArgumentNullException(nameof(cleanupSeam));
            _forwarder = forwarder ?? throw new ArgumentNullException(nameof(forwarder));
            _snapshot = initialSnapshot;
        }

        // ─── Inbound: Kernel handshake (composition adapter subscribes the Kernel events) ───

        /// <summary>
        /// Consumes the Kernel's <c>ContentLoadRequested</c>. Accepted in Idle (begin load)
        /// and CP_Racing (reconfigure vs next-race decision). Busy states (Loading*,
        /// transitional Ready, RaceReconfigure, Unloading) are no-ops with ZERO selection
        /// queries (AC-EC6, R9 busy/idempotency rules).
        /// </summary>
        public void OnContentLoadRequested(ContentLoadRequest request)
        {
            switch (_state)
            {
                case ContentPipelineState.Idle:
                    BeginLoad(request);
                    break;
                case ContentPipelineState.Racing:
                    HandleRacingRequest(request);
                    break;
                default:
                    // Busy: LoadingTrack, LoadingCars, Ready-instant, RaceReconfigure, Unloading.
                    break;
            }
        }

        /// <summary>
        /// Consumes the Kernel's <c>ContentUnloadRequested</c>. Loaded states (Ready,
        /// Racing, RaceReconfigure) → Unloading + BeginCleanup. Idle is a no-op (nothing
        /// loaded); Loading* is a no-op (the request inputs are NOT cancel surfaces — AC-SM4).
        /// </summary>
        public void OnContentUnloadRequested()
        {
            switch (_state)
            {
                case ContentPipelineState.Ready:
                case ContentPipelineState.Racing:
                case ContentPipelineState.RaceReconfigure:
                    EnterUnloading();
                    break;
                default:
                    // Idle (AC-SM3 no-op) and Loading* (AC-SM4 no-op).
                    break;
            }
        }

        // ─── Inbound: load seam (the real load implementation, Story 003, invokes these) ───

        /// <summary>Reports the track bundle loaded (LoadingTrack → LoadingCars + car requests).</summary>
        public void ReportTrackLoaded(int sessionGeneration)
        {
            if (sessionGeneration != _sessionGeneration)
                return; // stale report from a previous session — session fencing.
            if (_state != ContentPipelineState.LoadingTrack)
                return;

            _snapshot = _snapshot.WithCompleted(_storedSelection.TrackId);
            _state = ContentPipelineState.LoadingCars;
            _loadSeam.RequestCarLoads(_storedSelection.TeamIds);
        }

        /// <summary>
        /// Reports one car bundle loaded. Only expected team IDs are recorded (unknown IDs
        /// are IGNORED). When the completed set reaches the full expected set (1 track + 16
        /// slots), the SM passes THROUGH transitional Ready (forward + CP_Racing) — AC-LO5.
        /// </summary>
        public void ReportCarLoaded(int sessionGeneration, string teamId)
        {
            RecordCarCompletion(sessionGeneration, teamId);
        }

        /// <summary>
        /// Reports one car bundle degraded (placeholder fills the grid — GDD:144). A degraded
        /// slot is a COMPLETED slot and counts toward the 16-slot expected set.
        /// </summary>
        public void ReportCarDegraded(int sessionGeneration, string teamId)
        {
            RecordCarCompletion(sessionGeneration, teamId);
        }

        /// <summary>
        /// Reports an abortive load failure (track, shared, catalog — Car is never abortive).
        /// Starts cleanup; the error is emitted ONLY after <c>ReportCleanupComplete</c>
        /// (cleanup-before-error, AC-SM4). Idempotent — a duplicate during the same error
        /// path is ignored.
        /// </summary>
        public void ReportLoadError(int sessionGeneration, ContentErrorType type, string reason)
        {
            if (sessionGeneration != _sessionGeneration)
                return; // stale report from a previous session — session fencing.
            if (_state != ContentPipelineState.LoadingTrack && _state != ContentPipelineState.LoadingCars)
                return;
            if (_errorReported)
                return;

            _errorReported = true;
            _pendingErrorType = type;
            _pendingErrorReason = reason;
            EnterUnloading();
        }

        // ─── Inbound: cleanup seam ───

        /// <summary>
        /// Reports cleanup complete — the ONLY trigger for the completion signal (AC-LO8).
        /// Error path emits <c>ContentLoadError</c> (after cleanup, AC-SM4); unload path
        /// emits <c>ContentUnloadComplete</c>. Idempotent (second report ignored) and
        /// fenced on the SM-generated cleanup id — a stale callback from a previous
        /// session's cleanup cannot numerically collide (the id is monotonic and owned by
        /// the SM, never reused).
        /// </summary>
        public void ReportCleanupComplete(int cleanupId)
        {
            if (_state != ContentPipelineState.Unloading)
                return;
            if (_cleanupReported)
                return;
            if (cleanupId != _cleanupGeneration)
                return; // stale or mis-echoed cleanup id — the SM owns the token.

            _cleanupReported = true;
            _handoffValid = false;

            if (_pendingErrorType.HasValue)
            {
                ContentErrorType type = _pendingErrorType.Value;
                string reason = _pendingErrorReason;
                _pendingErrorType = null;
                _pendingErrorReason = null;
                _state = ContentPipelineState.Idle;
                Raise(() => ContentLoadError?.Invoke(reason, type));
            }
            else
            {
                _state = ContentPipelineState.Idle;
                Raise(() => ContentUnloadComplete?.Invoke());
            }
        }

        // ─── Internal transitions ───

        /// <summary>Idle → LoadingTrack: one selection query, store selection + payload, request track.</summary>
        private void BeginLoad(ContentLoadRequest request)
        {
            RaceContentSelection selection = _selectionSource.GetSelection();
            StoreSession(selection, request);
            _state = ContentPipelineState.LoadingTrack;
            _loadSeam.RequestTrackLoad(selection.TrackId);
        }

        /// <summary>
        /// CP_Racing request: ONE fresh selection query; EQUAL → RaceReconfigure (cache hit,
        /// also covers the Kernel racing retry — ADR-0003:53/198); DIFFERENT → next race
        /// (GDD:147) with the previous handoff invalidated.
        /// </summary>
        private void HandleRacingRequest(ContentLoadRequest request)
        {
            RaceContentSelection fresh = _selectionSource.GetSelection();
            if (RaceContentSelection.Identity(fresh) == RaceContentSelection.Identity(_storedSelection))
                Reconfigure(request);
            else
                NextRace(fresh, request);
        }

        /// <summary>
        /// Racing → RaceReconfigure → (Ready) → re-emit → Racing. ZERO Addressables I/O —
        /// the load seam is never touched (spy proves zero Request*/Report* calls).
        /// </summary>
        private void Reconfigure(ContentLoadRequest request)
        {
            _state = ContentPipelineState.RaceReconfigure;
            Raise(() => RaceReconfigureStart?.Invoke());
            if (_state != ContentPipelineState.RaceReconfigure)
                return; // a reentrant subscriber moved the SM (e.g. unload) — never publish from a stale state.
            PublishReady(request.Mode, request.Grid);
        }

        /// <summary>
        /// Racing → LoadingTrack for a changed selection (GDD:147). The previous handoff is
        /// cleared; NO ContentUnloadComplete is emitted (the unload is internal to the next
        /// LoadRace — Story 003/004).
        /// </summary>
        private void NextRace(RaceContentSelection fresh, ContentLoadRequest request)
        {
            _handoffValid = false;
            StoreSession(fresh, request);
            _state = ContentPipelineState.LoadingTrack;
            _loadSeam.RequestTrackLoad(fresh.TrackId);
        }

        /// <summary>Stores selection + request payload and resets the race-resource inventory.</summary>
        private void StoreSession(RaceContentSelection selection, ContentLoadRequest request)
        {
            _storedSelection = selection;
            _storedMode = request.Mode;
            _storedGrid = request.Grid;
            _snapshot = new ContentResourceState(_snapshot.IsSharedLoaded, Array.Empty<string>());
            // A fresh session must not inherit the previous session's error latch: a new load
            // after an error-to-Idle cycle must be able to report a NEW abortive error.
            _errorReported = false;
            _pendingErrorType = null;
            _pendingErrorReason = null;
            _sessionGeneration++; // new session identity — stale reports from the previous session are fenced out.
        }

        /// <summary>Records one car completion; unknown IDs are ignored; completes the load when full.</summary>
        private void RecordCarCompletion(int sessionGeneration, string teamId)
        {
            if (sessionGeneration != _sessionGeneration)
                return; // stale report from a previous session — session fencing.
            if (_state != ContentPipelineState.LoadingCars)
                return;
            if (!_storedSelection.TeamIds.Contains(teamId))
                return;

            _snapshot = _snapshot.WithCompleted(teamId);
            if (IsLoadComplete())
                PublishReady(_storedMode, _storedGrid);
        }

        /// <summary>
        /// Transitional Ready: forward exactly once with the exact stored payload (only from
        /// CP_Ready — structurally guaranteed), elevate the observable event, set the handoff,
        /// and leave Ready in the same operation (AC-SM5/LO6).
        /// </summary>
        private void PublishReady(RaceMode mode, GridAssignment grid)
        {
            _state = ContentPipelineState.Ready;
            _forwarder.Forward(mode, grid); // fail-fast — a throw is a wiring defect, not caught.
            Raise(() => RaceLoadReady?.Invoke(mode, grid));
            if (_state == ContentPipelineState.Ready) // a reentrant subscriber may have moved the SM (e.g. unload) — never overwrite it.
            {
                _handoffValid = true;
                _state = ContentPipelineState.Racing;
            }
        }

        /// <summary>Ready/Racing/RaceReconfigure → Unloading (BeginCleanup; completion deferred to the cleanup seam).</summary>
        private void EnterUnloading()
        {
            _state = ContentPipelineState.Unloading;
            _cleanupReported = false;
            // The SM OWNS the cleanup id (monotonic, never reused) — the seam only echoes it.
            _cleanupGeneration = ++_cleanupSequence;
            _cleanupSeam.BeginCleanup(_cleanupGeneration);
        }

        /// <summary>True when the completed set is exactly the expected 1-track + 16-slot set.</summary>
        private bool IsLoadComplete()
        {
            var expected = new HashSet<string>(_storedSelection.TeamIds) { _storedSelection.TrackId };
            return _snapshot.Matches(expected);
        }

        /// <summary>
        /// Safe event raise (3-7 SafePublish pattern): a subscriber throw must never corrupt
        /// SM state or leave the machine stuck mid-transition. Subscriber exceptions are
        /// swallowed — they are observable diagnostics, not control flow. The readiness
        /// FORWARDER is deliberately NOT wrapped (AC-LO6: a forward throw is a wiring defect
        /// and fails fast).
        /// </summary>
        private static void Raise(Action handler)
        {
            try
            {
                handler?.Invoke();
            }
            catch (Exception)
            {
                // Swallowed by design — see above.
            }
        }
    }
}
