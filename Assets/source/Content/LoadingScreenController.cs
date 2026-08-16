using System;

namespace Overdrive.Content
{
    /// <summary>
    /// Engine-free lifecycle controller for the loading screen (story 3-13,
    /// ADR-0003 + UX loading.md). Owns: minimum-display timing (0.5s), monotonic
    /// progress clamping, the first-launch "Preparing..." state, terminal
    /// exactly-once semantics, and the input-blocked report. It drives an
    /// <see cref="ILoadingScreenPresenter"/>; the visual implementation lives in
    /// the UI Menu epic.
    /// </summary>
    /// <remarks>
    /// Multi-cycle: <see cref="BeginPreparing"/> / <see cref="BeginLoading"/>
    /// re-arm a terminal controller (the composition root keeps one instance and
    /// the bootstrapper re-arms on each Idle→Loading transition). A reconfigure
    /// never calls <c>Begin*</c> — the state machine fires
    /// <c>RaceReconfigureStart</c> instead. Elapsed display time starts at the
    /// first <c>Begin*</c> call (catalog display counts on first launch).
    /// </remarks>
    public sealed class LoadingScreenController : IDisposable
    {
        private readonly IRaceLoadProgress _progress;
        private readonly IClock _clock;
        private readonly ILoadingScreenPresenter _presenter;
        private readonly float _minimumDisplaySeconds;

        private float _cycleStart;
        private float _lastProgress;
        private float _elapsed;
        private bool _active;
        private bool _preparing;
        private bool _pendingComplete;
        private bool _terminal;

        /// <summary>
        /// Creates the controller. <paramref name="minimumDisplaySeconds"/> is the
        /// GDD:119 0.5s minimum-display contract (default 0.5f).
        /// </summary>
        public LoadingScreenController(
            IRaceLoadProgress progress,
            IClock clock,
            ILoadingScreenPresenter presenter,
            float minimumDisplaySeconds = 0.5f)
        {
            _progress = progress ?? throw new ArgumentNullException(nameof(progress));
            _clock = clock ?? throw new ArgumentNullException(nameof(clock));
            _presenter = presenter ?? throw new ArgumentNullException(nameof(presenter));
            if (minimumDisplaySeconds < 0f)
                throw new ArgumentOutOfRangeException(nameof(minimumDisplaySeconds), "Minimum display must be non-negative.");
            _minimumDisplaySeconds = minimumDisplaySeconds;
        }

        /// <summary>True from the first <c>Begin*</c> until the terminal (AC-LS5); unaffected by <see cref="Dispose"/>.</summary>
        public bool InputBlocked => _active;

        /// <summary>Display time at the terminal (test observability).</summary>
        public float ElapsedDisplay => _elapsed;

        /// <summary>Fires exactly once per cycle at terminal-success (UI Menu subscribes for the fade).</summary>
        public event Action Completed;

        /// <summary>
        /// First-launch catalog state (AC-LS6). Starts a new cycle when idle/terminal;
        /// no-op while a loading cycle is active. <see cref="BeginLoading"/> later
        /// transitions out of the preparing state within the same cycle.
        /// </summary>
        public void BeginPreparing()
        {
            if (_active)
                return;
            StartCycle();
            _preparing = true;
            SafeCall(() => _presenter.ShowPreparing());
        }

        /// <summary>
        /// Race-load state (AC-LS1: emits ShowProgress(0)). Starts a new cycle when
        /// idle/terminal; transitions out of the preparing state (same cycle, elapsed
        /// preserved) when the catalog phase ends; no-op when a loading cycle is active.
        /// </summary>
        public void BeginLoading()
        {
            if (_active && !_preparing)
                return;
            if (!_active)
                StartCycle();
            _preparing = false;
            _lastProgress = 0f;
            SafeCall(() => _presenter.ShowProgress(0f));
        }

        /// <summary>
        /// Called once per frame by the Unity driver. Releases <c>Completed</c> when
        /// a sub-minimum load has reached the 0.5s display bound (AC-LS3). No-op when
        /// idle or terminal.
        /// </summary>
        public void Tick()
        {
            if (!_active || _terminal || !_pendingComplete)
                return;
            if (_clock.Time - _cycleStart >= _minimumDisplaySeconds)
                FireCompleted();
        }

        /// <summary>
        /// Signals load success (composition root subscribes to SM
        /// <c>RaceLoadReady</c>). Emits ShowProgress(1.0); completes immediately when
        /// the minimum display elapsed (AC-LS4), else pending until <see cref="Tick"/>.
        /// Exactly-once per cycle — later calls are ignored.
        /// </summary>
        public void NotifyLoaded()
        {
            if (!_active || _terminal || _pendingComplete)
                return; // terminal or already pending — later calls are ignored (exactly-once per cycle)
            if (_lastProgress < 1f)
            {
                _lastProgress = 1f;
                SafeCall(() => _presenter.ShowProgress(1f));
            }
            _elapsed = _clock.Time - _cycleStart;
            if (_elapsed >= _minimumDisplaySeconds)
                FireCompleted();
            else
                _pendingComplete = true;
        }

        /// <summary>
        /// Signals load failure (composition root subscribes to SM
        /// <c>ContentLoadError</c>). Emits <c>OnLoadError</c> — no <c>Completed</c>.
        /// Exactly-once per cycle — later calls are ignored.
        /// </summary>
        public void NotifyError(string reason)
        {
            if (!_active || _terminal)
                return;
            EndCycle();
            _elapsed = _clock.Time - _cycleStart;
            SafeCall(() => _presenter.OnLoadError(reason));
        }

        /// <summary>Unsubscribes progress events only — never touches the presenter, never changes <c>InputBlocked</c>.</summary>
        public void Dispose()
        {
            _progress.ProgressChanged -= OnProgressChanged;
        }

        private void StartCycle()
        {
            _cycleStart = _clock.Time;
            _active = true;
            _terminal = false;
            _preparing = false;
            _pendingComplete = false;
            _elapsed = 0f;
            _lastProgress = 0f;
            _progress.ProgressChanged += OnProgressChanged;
        }

        private void EndCycle()
        {
            _active = false;
            _terminal = true;
            _pendingComplete = false;
            _progress.ProgressChanged -= OnProgressChanged;
        }

        private void OnProgressChanged(float value)
        {
            if (!_active || _terminal)
                return;
            if (value <= _lastProgress)
                return;
            _lastProgress = value;
            SafeCall(() => _presenter.ShowProgress(value));
        }

        private void FireCompleted()
        {
            EndCycle();
            SafeCall(() => _presenter.OnLoadComplete());
            SafeCall(() => Completed?.Invoke());
        }

        /// <summary>SafePublish pattern: presenter/subscriber exceptions are swallowed — they are observable diagnostics, not control flow (AC-LS8/EC9).</summary>
        private static void SafeCall(Action call)
        {
            try
            {
                call?.Invoke();
            }
            catch (Exception)
            {
                // Swallowed by design — see summary.
            }
        }
    }
}
