using System;
using System.Collections.Generic;
using System.Linq;
using Overdrive.Simulation;

namespace Overdrive.Content
{
    /// <summary>
    /// Real <c>IContentLoadSeam</c> implementation (Story 003 — Race Load Orchestration).
    /// Starts all 17 Addressable handles in parallel (1 track + 16 cars — TR-content-002),
    /// aggregates byte-derived progress (GDD:169-177), enforces the GDD memory policy
    /// (&lt;0.85 normal; [0.85, 0.95] warning + quality reduction; &gt;0.95 abort), and reports
    /// completion/degradation/error to the <see cref="ContentStateMachine"/> with the SM's
    /// <see cref="ContentStateMachine.SessionGeneration"/> token (session fencing — stale
    /// reports from a superseded session are fenced out by the SM).
    ///
    /// Engine-free: all external interaction flows through the injectable seams
    /// (<see cref="IAddressableLoader"/>, <see cref="IContentInstantiator"/>,
    /// <see cref="IMemoryPressureSource"/>, <see cref="IQualityReductionRequest"/>,
    /// <see cref="IDiagnosticsSink"/>, <see cref="IClock"/>, <see cref="IRaceContentAccumulator"/>).
    /// The composition root (Overdrive.Content.Unity) wires the concrete Addressables impls.
    /// </summary>
    public sealed class RaceLoadOrchestrator : IContentLoadSeam, IRaceLoadProgress
    {
        /// <summary>Maximum canonical slot count: 1 track + 16 cars (TR-content-002). The ACTUAL expected count is per-request (<c>_expectedSlots</c>) — a deduplicated or reduced selection completes against its own set.</summary>
        public const int MaxCanonicalSlots = 17;

        /// <summary>Memory sampling interval for the 1s tick (gate R3) — configurable for tests.</summary>
        public const float MemorySampleIntervalSeconds = 1f;

        private const float MemoryWarnThreshold = 0.85f;
        private const float MemoryAbortThreshold = 0.95f;

        private readonly IContentLoadReporter _sm;
        private readonly IAddressableLoader _loader;
        private readonly IContentInstantiator _instantiator;
        private readonly IMemoryPressureSource _memory;
        private readonly IQualityReductionRequest _qualityReduction;
        private readonly IDiagnosticsSink _diagnostics;
        private readonly IClock _clock;
        private readonly IRaceContentAccumulator _runtime;

        private readonly List<ActiveLoad> _active = new List<ActiveLoad>();
        private readonly Dictionary<string, int> _teamIndices = new Dictionary<string, int>();
        private long _completedDownloadedBytes;
        private long _completedTotalBytes;
        private int _sessionGeneration;
        private int _completedSlots;
        private int _expectedSlots;
        private float _lastMemorySampleTime;
        private bool _memoryWarningActive;
        private bool _aborted;
        private bool _publishingProgress;

        /// <summary>Aggregated byte-derived progress in [0, 1] (forced to 1.0 at full termination).</summary>
        public float Progress { get; private set; }

        /// <summary>Raised on every observed progress change.</summary>
        public event Action<float> ProgressChanged;

        /// <summary>
        /// Creates the orchestrator. <paramref name="reporter"/> is the state machine this
        /// orchestrator reports into; <paramref name="runtime"/> is the readiness handoff
        /// accumulator the orchestrator populates before readiness.
        /// </summary>
        public RaceLoadOrchestrator(
            IContentLoadReporter reporter,
            IAddressableLoader loader,
            IContentInstantiator instantiator,
            IMemoryPressureSource memory,
            IQualityReductionRequest qualityReduction,
            IDiagnosticsSink diagnostics,
            IClock clock,
            IRaceContentAccumulator runtime)
        {
            _sm = reporter ?? throw new ArgumentNullException(nameof(reporter));
            _loader = loader ?? throw new ArgumentNullException(nameof(loader));
            _instantiator = instantiator ?? throw new ArgumentNullException(nameof(instantiator));
            _memory = memory ?? throw new ArgumentNullException(nameof(memory));
            _qualityReduction = qualityReduction ?? throw new ArgumentNullException(nameof(qualityReduction));
            _diagnostics = diagnostics ?? throw new ArgumentNullException(nameof(diagnostics));
            _clock = clock ?? throw new ArgumentNullException(nameof(clock));
            _runtime = runtime ?? throw new ArgumentNullException(nameof(runtime));
        }

        /// <summary>Starts the track bundle load (AC-LO4) — reads the SM session generation for fencing.</summary>
        public void RequestTrackLoad(string trackId)
        {
            _sessionGeneration = _sm.SessionGeneration;
            // Release any handles still in flight from a superseded session BEFORE clearing.
            // The current SM graph never resets with in-flight handles (Loading* is not a
            // cancel surface), but the orchestrator must never abandon a handle.
            foreach (ActiveLoad a in _active)
            {
                if (a.Instance != null)
                    _instantiator.ReleaseInstance(a.Instance);
                a.Handle.Release();
            }
            _active.Clear();
            _teamIndices.Clear();
            // Release the prior session's retained bundles + track instance: next-race goes
            // Racing → LoadingTrack directly (NO cleanup path), so the orchestrator releases here.
            _runtime.ReleaseRetainedHandles();
            if (_runtime.TrackInstance != null)
                _instantiator.ReleaseInstance(_runtime.TrackInstance);
            _completedDownloadedBytes = 0;
            _completedTotalBytes = 0;
            _completedSlots = 0;
            _expectedSlots = 1; // the track slot; car slots are added by RequestCarLoads.
            _aborted = false;
            _memoryWarningActive = false;
            _lastMemorySampleTime = _clock.Time;
            Progress = 0f;
            _runtime.Reset();
            // Notify AFTER the reset: a ProgressChanged subscriber must observe the clean
            // session state (never a destroyed-but-not-cleared track instance). Subscribers
            // must not mutate the orchestrator from the event (documented contract).
            PublishProgress(0f);
            _active.Add(StartLoad(AddressableKeys.TrackData(trackId), isTrack: true, teamId: null));
        }

        /// <summary>Starts the 16 car bundle loads (AC-LO4) — issued together with the track request (17 parallel).</summary>
        public void RequestCarLoads(IReadOnlyList<string> teamIds)
        {
            if (teamIds == null)
                throw new ArgumentNullException(nameof(teamIds));
            if (teamIds.Distinct().Count() != teamIds.Count)
                throw new ArgumentException("Duplicate team ids in the load request.", nameof(teamIds));
            _runtime.BeginCarReferences(teamIds.Count);
            _expectedSlots = 1 + teamIds.Count;
            for (int i = 0; i < teamIds.Count; i++)
            {
                _teamIndices[teamIds[i]] = i;
                _active.Add(StartLoad(AddressableKeys.CarDefinition(teamIds[i]), isTrack: false, teamId: teamIds[i]));
            }
        }

        /// <summary>
        /// Periodic sampling hook — the composition root (MonoBehaviour Update) calls this
        /// every frame; progress and memory are sampled at most once per
        /// <see cref="MemorySampleIntervalSeconds"/> (per-completion sampling happens inside
        /// the completion callback). Deterministic in tests via the fake <see cref="IClock"/>.
        /// </summary>
        public void Sample()
        {
            if (_aborted || _active.Count == 0)
                return;
            if (_clock.Time - _lastMemorySampleTime < MemorySampleIntervalSeconds)
                return;
            _lastMemorySampleTime = _clock.Time;
            SampleProgress();
            SampleMemory();
        }

        private ActiveLoad StartLoad(string key, bool isTrack, string teamId)
        {
            var handle = _loader.LoadAssetAsync(key, OnHandleComplete);
            // Capture the session generation at START: a handle that finishes after a
            // next-race superseded its session echoes the OLD token, so the SM fences it out.
            return new ActiveLoad(handle, isTrack, teamId, _sessionGeneration);
        }

        private void OnHandleComplete(IAsyncLoadHandle handle)
        {
            if (_aborted)
            {
                handle.Release();
                return;
            }

            ActiveLoad entry = FindActive(handle);
            if (entry == null)
                return; // already terminal (defensive — callbacks are exactly-once by contract).

            // Per-completion sampling (gate R3: once per slot completion AND per tick).
            _lastMemorySampleTime = _clock.Time;

            // Memory policy checked BEFORE any report: the SM can synchronously transition
            // to Racing on the terminal completion, which would swallow a late abort.
            SampleMemory();
            if (_aborted)
                return;

            if (handle.OperationException != null || handle.Result == null)
            {
                HandleFailure(entry, handle);
                return;
            }

            var status = handle.GetDownloadStatus();
            _completedDownloadedBytes += status.DownloadedBytes;
            _completedTotalBytes += status.TotalBytes;

            if (entry.IsTrack)
                HandleTrackSuccess(entry, handle);
            else
                HandleCarSuccess(entry, handle);

            CountCompletion();
            SampleProgress();
        }

        /// <summary>Track failure is abortive; car failure is a degraded slot (GDD:144).</summary>
        private void HandleFailure(ActiveLoad entry, IAsyncLoadHandle handle)
        {
            if (entry.IsTrack)
            {
                // Track failure is abortive (TR-content-004): release, then error report
                // with the ENTRY's generation (a stale track failure is fenced out by the SM).
                _diagnostics.LogError($"Track bundle failed to load: {handle.OperationException?.Message ?? "null result"}");
                Abort("Track bundle failed to load", ContentErrorType.Track, entry.SessionGeneration);
                return;
            }

            // Car failure is NON-fatal (GDD:144): degraded slot, race continues with 15.
            _diagnostics.LogWarning($"Car {entry.TeamId} failed to load — degraded slot (placeholder fills the grid).");
            handle.Release();
            _active.Remove(entry);
            _sm.ReportCarDegraded(entry.SessionGeneration, entry.TeamId);
            CountCompletion();
            SampleProgress();
        }

        /// <summary>Track instantiated FIRST, then reported (AC-LO3 ordering).</summary>
        private void HandleTrackSuccess(ActiveLoad entry, IAsyncLoadHandle handle)
        {
            object instance;
            try
            {
                instance = _instantiator.Instantiate(handle.Result);
            }
            catch (Exception e)
            {
                // The track asset loaded but is not instantiable (wrong root type) — abortive.
                _diagnostics.LogError($"Track instantiation failed: {e.Message}");
                Abort("Track instantiation failed", ContentErrorType.Track, entry.SessionGeneration);
                return;
            }

            if (instance == null)
            {
                _diagnostics.LogError("Track instantiation returned null.");
                Abort("Track instantiation returned null", ContentErrorType.Track, entry.SessionGeneration);
                return;
            }

            entry.Instance = instance;
            _runtime.SetTrackInstance(instance);
            _runtime.AddRetainedHandle(handle);
            _active.Remove(entry);
            _sm.ReportTrackLoaded(entry.SessionGeneration);
        }

        /// <summary>Car prefab asset retained for Vehicle Physics / Grid &amp; Start spawning (NOT instantiated) — stored at its team index (TeamIds order).</summary>
        private void HandleCarSuccess(ActiveLoad entry, IAsyncLoadHandle handle)
        {
            _runtime.SetCarReference(_teamIndices[entry.TeamId], handle.Result);
            _runtime.AddRetainedHandle(handle);
            _active.Remove(entry);
            _sm.ReportCarLoaded(entry.SessionGeneration, entry.TeamId);
        }

        /// <summary>Counts a terminated slot; forces progress to 1.0 when the full request set terminates (AC-LP2/LP3).</summary>
        private void CountCompletion()
        {
            _completedSlots++;
            if (_completedSlots >= _expectedSlots)
                PublishProgress(1f);
        }

        /// <summary>Aggregates byte-derived progress from completed + active handles (monotonic by construction).</summary>
        private void SampleProgress()
        {
            if (_completedSlots >= _expectedSlots)
                return; // final 1.0 already forced — do not recompute from byte ratios (AC-LP2/LP3).
            long downloaded = _completedDownloadedBytes;
            long total = _completedTotalBytes;
            foreach (ActiveLoad a in _active)
            {
                var s = a.Handle.GetDownloadStatus();
                downloaded += s.DownloadedBytes;
                total += s.TotalBytes;
            }

            float next = total == 0 ? 0f : Math.Clamp((float)downloaded / total, 0f, 1f);
            // Monotonic by contract (AC-LO2): a failed handle dropping downloaded bytes, or a
            // total estimate growing, must never move progress backwards.
            next = Math.Max(Progress, next);
            // 1.0 is RESERVED for full slot termination (AC-LP2) — a byte ratio of exactly 1.0
            // while slots are still pending (e.g. cached handles with 0/0 totals) would mask a
            // hung load on the loading screen (gate R4). The cap is request-sized so a reduced
            // grid's loading screen never shows a semantically wrong 94%.
            if (next >= 1f)
                next = 1f - 1f / (_expectedSlots + 1);
            if (next != Progress)
                PublishProgress(next);
        }

        /// <summary>
        /// Sets <see cref="Progress"/> and raises <see cref="ProgressChanged"/>, guarding the
        /// event from subscriber faults. ProgressChanged is a UI observation surface — a
        /// subscriber bug must NOT abort the load pipeline (unlike the SM orchestration
        /// events, which are fail-fast wiring defects). Re-entrant publication is dropped
        /// (a subscriber calling back into the orchestrator mid-event cannot recurse).
        /// </summary>
        private void PublishProgress(float value)
        {
            if (_publishingProgress)
                return;
            _publishingProgress = true;
            Progress = value;
            try
            {
                ProgressChanged?.Invoke(value);
            }
            catch (Exception e)
            {
                _diagnostics.LogError($"ProgressChanged subscriber fault: {e.Message}");
            }
            finally
            {
                _publishingProgress = false;
            }
        }

        /// <summary>Enforces the GDD memory policy (GDD:181-189): &lt;0.85 none; [0.85, 0.95] warning + quality request; &gt;0.95 abort.</summary>
        private void SampleMemory()
        {
            if (_aborted)
                return;
            float pressure = _memory.Pressure;
            if (pressure < 0f || float.IsNaN(pressure))
            {
                // A defective pressure source must not silently pass as normal.
                _diagnostics.LogError($"Invalid memory pressure value {pressure} — ignoring sample.");
                return;
            }
            if (pressure > MemoryAbortThreshold)
            {
                _diagnostics.LogError($"Memory pressure {pressure:F2} exceeds {MemoryAbortThreshold} — aborting race load.");
                Abort("Memory pressure", ContentErrorType.Track, _sessionGeneration);
                return;
            }

            if (pressure >= MemoryWarnThreshold)
            {
                if (!_memoryWarningActive)
                {
                    _memoryWarningActive = true;
                    _diagnostics.LogWarning($"Memory pressure {pressure:F2} in [{MemoryWarnThreshold}, {MemoryAbortThreshold}] — requesting quality reduction.");
                    _qualityReduction.RequestQualityReduction($"Memory pressure {pressure:F2}");
                }
            }
            else
            {
                _memoryWarningActive = false;
            }
        }

        /// <summary>Aborts the load: releases all in-flight handles and any track instance, then reports the error to the SM (cleanup/emission follow Story 002 AC-SM4).</summary>
        private void Abort(string reason, ContentErrorType type, int sessionGeneration)
        {
            if (_aborted)
                return;
            _aborted = true;
            foreach (ActiveLoad a in _active)
            {
                if (a.Instance != null)
                    _instantiator.ReleaseInstance(a.Instance);
                a.Handle.Release();
            }
            _active.Clear();
            _sm.ReportLoadError(sessionGeneration, type, reason);
        }

        private ActiveLoad FindActive(IAsyncLoadHandle handle)
        {
            foreach (ActiveLoad a in _active)
                if (a.Handle == handle)
                    return a;
            return null;
        }

        private sealed class ActiveLoad
        {
            public ActiveLoad(IAsyncLoadHandle handle, bool isTrack, string teamId, int sessionGeneration)
            {
                Handle = handle;
                IsTrack = isTrack;
                TeamId = teamId;
                SessionGeneration = sessionGeneration;
            }

            public IAsyncLoadHandle Handle { get; }

            public bool IsTrack { get; }

            public string TeamId { get; }

            /// <summary>The session generation captured at start — echoed on reports so the SM fences stale callbacks.</summary>
            public int SessionGeneration { get; }

            /// <summary>Set when the track is instantiated (abort releases it).</summary>
            public object Instance { get; set; }
        }
    }
}
