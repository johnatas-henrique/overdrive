using System;
using Overdrive.Simulation;

namespace Overdrive.Content
{
    /// <summary>
    /// App-startup orchestrator (Story 005 — Startup, Catalog &amp; Fatal Errors): owns the
    /// startup sequence per GDD:65-67 — initialize the Addressables catalog (retry ONCE, max 2
    /// attempts), then load + retain the Shared group. Terminal: <see cref="StartupComplete"/>
    /// (Shared retained — the CP_Idle precondition for the race SM) or
    /// <see cref="Fatal"/> (catalog after retry, or Shared — the app must close; the engine-free
    /// core only records via <see cref="IFatalErrorHandler"/>, the Unity adapter quits).
    /// </summary>
    /// <remarks>
    /// NOT part of <see cref="ContentStateMachine"/> — the SM's entry state is CP_Idle with
    /// Shared assumed retained; the startup precedes any race request (the composition root
    /// constructs the SM only after <see cref="StartupComplete"/>).
    ///
    /// Stage fencing: each async stage (catalog attempt, shared) consumes EXACTLY ONE
    /// completion — a per-attempt token + stage enum ignore duplicate or late callbacks, so
    /// the retry bound (max 2 initializer calls) and the single-Shared-load guarantee hold
    /// even under focus churn. While unfocused (<see cref="IFocusSeam"/>, AC-EC7) the
    /// orchestrator defers stage advancement: an in-flight stage continues but its completion
    /// result is buffered once and consumed exactly once on re-focus — no re-init is ever
    /// triggered by focus loss.
    /// </remarks>
    public sealed class StartupOrchestrator : IDisposable
    {
        private enum Stage
        {
            Catalog,
            Shared,
        }

        private readonly ICatalogInitializer _catalog;
        private readonly ISharedLoader _shared;
        private readonly IFatalErrorHandler _fatal;
        private readonly IFocusSeam _focus;

        private Stage _stage;
        private int _initAttempts;
        private int _attemptToken;
        private bool _run;
        private bool _terminal;
        private bool _deferred;
        private bool _bufferPending;
        private int _bufferedToken;
        private CatalogInitResult _bufferedCatalog;
        private SharedLoadResult _bufferedShared;

        /// <summary>Fires exactly once when the catalog + Shared group are ready (terminal).</summary>
        public event Action StartupComplete;

        /// <summary>Fires exactly once on a fatal startup error (terminal; the app must close).</summary>
        public event Action<string, ContentErrorType> Fatal;

        /// <summary>Creates the orchestrator and subscribes to the focus seam (lifetime = session).</summary>
        public StartupOrchestrator(ICatalogInitializer catalog, ISharedLoader shared, IFatalErrorHandler fatal, IFocusSeam focus)
        {
            _catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
            _shared = shared ?? throw new ArgumentNullException(nameof(shared));
            _fatal = fatal ?? throw new ArgumentNullException(nameof(fatal));
            _focus = focus ?? throw new ArgumentNullException(nameof(focus));
            _focus.FocusChanged += OnFocusChanged;
        }

        /// <summary>
        /// Runs the startup sequence. Idempotent: a second call while running or after the
        /// terminal state is a no-op (the composition root gates presentation on the outcome).
        /// The initial focus state is sampled HERE: if the app is already backgrounded when
        /// startup begins, completions are buffered until the first re-focus (AC-EC7).
        /// </summary>
        public void Run()
        {
            if (_run || _terminal)
                return;
            _run = true;
            _deferred = !_focus.IsFocused;
            StartCatalogAttempt();
        }

        /// <summary>Unsubscribes the focus seam (test-teardown convenience; the orchestrator lives for the session in production).</summary>
        public void Dispose()
        {
            _focus.FocusChanged -= OnFocusChanged;
        }

        private void StartCatalogAttempt()
        {
            _initAttempts++;
            _stage = Stage.Catalog;
            int token = ++_attemptToken;
            _catalog.Initialize(result => OnCatalogResult(token, result));
        }

        private void StartSharedLoad()
        {
            _stage = Stage.Shared;
            _shared.LoadShared(OnSharedResult);
        }

        private void OnFocusChanged(bool focused)
        {
            if (_terminal)
                return;
            if (!focused)
            {
                _deferred = true;
                return;
            }

            _deferred = false;
            if (!_bufferPending)
                return;

            _bufferPending = false;
            // Consume the buffered result for the current stage (token re-checked).
            if (_stage == Stage.Catalog)
                ProcessCatalogResult(_bufferedToken, _bufferedCatalog);
            else
                ProcessSharedResult(_bufferedShared);
        }

        private void OnCatalogResult(int token, CatalogInitResult result)
        {
            if (_terminal || _stage != Stage.Catalog || token != _attemptToken)
                return; // Stage latch: duplicate/late callback for a consumed attempt.
            if (_deferred)
            {
                if (_bufferPending)
                    return; // Buffered ONCE — a duplicate result must not overwrite the first.
                _bufferPending = true;
                _bufferedToken = token;
                _bufferedCatalog = result;
                return;
            }

            ProcessCatalogResult(token, result);
        }

        private void OnSharedResult(SharedLoadResult result)
        {
            if (_terminal || _stage != Stage.Shared)
                return; // Stage latch: duplicate/late callback.
            if (_deferred)
            {
                if (_bufferPending)
                    return; // Buffered ONCE — a duplicate result must not overwrite the first.
                _bufferPending = true;
                _bufferedShared = result;
                return;
            }

            ProcessSharedResult(result);
        }

        private void ProcessCatalogResult(int token, CatalogInitResult result)
        {
            if (_terminal)
                return;
            if (result.Success)
            {
                StartSharedLoad();
                return;
            }

            if (_initAttempts < 2)
            {
                StartCatalogAttempt(); // Bounded retry — max 2 initializer calls total.
                return;
            }

            FireFatal($"Addressables catalog initialization failed: {result.ErrorReason}", ContentErrorType.Catalog);
        }

        private void ProcessSharedResult(SharedLoadResult result)
        {
            if (_terminal)
                return;
            if (result.Success)
            {
                FireStartupComplete();
                return;
            }

            FireFatal($"Shared group load failed: {result.ErrorReason}", ContentErrorType.Shared);
        }

        private void FireStartupComplete()
        {
            if (_terminal)
                return;
            _terminal = true;
            _deferred = false;
            _bufferPending = false;
            Raise(StartupComplete);
        }

        private void FireFatal(string reason, ContentErrorType type)
        {
            if (_terminal)
                return;
            _terminal = true;
            _deferred = false;
            _bufferPending = false;
            // The port is invoked BEFORE the event: even if a subscriber throws, the
            // fatal is already delivered (exactly-once holds).
            _fatal.Fatal(reason, type);
            Raise(() => Fatal?.Invoke(reason, type));
        }

        /// <summary>Safe event raise (SafePublish pattern): a subscriber throw must never corrupt terminal state or propagate into the Addressables dispatch.</summary>
        private static void Raise(Action handler)
        {
            try
            {
                handler?.Invoke();
            }
            catch (Exception)
            {
                // Swallowed by design — subscriber exceptions are observable diagnostics, not control flow.
            }
        }
    }
}
