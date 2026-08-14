using System;

namespace Overdrive.Settings.Core
{
    /// <summary>
    /// Transactional settings preview (ADR-0004:50, :85-91): a <see cref="Snapshot"/> of the active
    /// values taken at session start plus an editable <see cref="Working"/> copy. Apply persists
    /// Working (backup-first via <see cref="SettingsBlobService"/>) and commits it as the active
    /// profile; Cancel restores Snapshot to runtime. One session at a time (ADR-0004:165) — enforced
    /// by the caller passing its held reference to <see cref="TryOpen"/>, never by global state.
    /// </summary>
    /// <remarks>
    /// Publisher, not singleton writer: runtime consumers subscribe to <see cref="WorkingChanged"/> /
    /// <see cref="Committed"/> / <see cref="SnapshotRestored"/> / <see cref="ApplyFailed"/> and read
    /// the delivered model. This keeps game state out of statics (DI rule).
    /// </remarks>
    public sealed class SettingsEditSession : IDisposable
    {
        private readonly SettingsBlobService _blobService;
        private readonly IDisplayConfirmGate _displayConfirm;
        private readonly Action<string> _warningSink;
        private bool _isOpen;
        private bool _disposed;
        private bool _displayConfirmPending;
        private DisplayCandidate _pendingCandidate;
        private int _pendingVersion;

        /// <summary>
        /// Opens a settings session. Rejected (no session created, no state change) when the lifecycle
        /// forbids opening (active Countdown → <see cref="SettingsOpenResult.BlockedCountdown"/>, AC-E2)
        /// or when <paramref name="currentSession"/> is still open (one session at a time →
        /// <see cref="SettingsOpenResult.SessionActive"/>, AC-E8). The caller owns the returned session
        /// and passes it back on every subsequent open attempt.
        /// </summary>
        /// <param name="blobService">The persistence facade (Story 001) — Load seeds Snapshot, Save persists Working.</param>
        /// <param name="lifecycle">The lifecycle context (Countdown gate, Difficulty editability).</param>
        /// <param name="displayConfirm">The display-confirmation gate (Story 005 supplies the real one).</param>
        /// <param name="warningSink">Warning sink (duplicate bindings, failed default persist, etc.).</param>
        /// <param name="currentSession">The caller's held session reference (null when none).</param>
        /// <param name="result">The open outcome.</param>
        /// <returns>The opened session, or null when rejected.</returns>
        public static SettingsEditSession TryOpen(
            SettingsBlobService blobService,
            ISettingsLifecycleContext lifecycle,
            IDisplayConfirmGate displayConfirm,
            Action<string> warningSink,
            SettingsEditSession currentSession,
            out SettingsOpenResult result)
        {
            if (blobService == null) throw new ArgumentNullException(nameof(blobService));
            if (lifecycle == null) throw new ArgumentNullException(nameof(lifecycle));
            if (displayConfirm == null) throw new ArgumentNullException(nameof(displayConfirm));

            if (!lifecycle.CanOpenSettings)
            {
                result = SettingsOpenResult.BlockedCountdown;
                return null;
            }

            if (currentSession != null && currentSession.IsOpen)
            {
                result = SettingsOpenResult.SessionActive;
                return null;
            }

            SettingsBlobService.LoadOutcome outcome = blobService.Load();
            result = SettingsOpenResult.Opened;
            return new SettingsEditSession(blobService, displayConfirm, warningSink, outcome.Settings);
        }

        private SettingsEditSession(
            SettingsBlobService blobService,
            IDisplayConfirmGate displayConfirm,
            Action<string> warningSink,
            GameSettingsData snapshot)
        {
            _blobService = blobService;
            _displayConfirm = displayConfirm;
            _warningSink = warningSink;
            Snapshot = snapshot;
            Working = snapshot;
            _isOpen = true;
        }

        /// <summary>True while the session is open (between open and Apply-success/Cancel/Dispose).</summary>
        public bool IsOpen => _isOpen && !_disposed;

        /// <summary>True while a display confirmation is awaiting its outcome (GDD settings.md:110).</summary>
        public bool HasPendingDisplayConfirm => _displayConfirmPending;

        /// <summary>The active values at session start (from <see cref="SettingsBlobService.Load"/>).</summary>
        public GameSettingsData Snapshot { get; }

        /// <summary>The editable working copy. Consumers read it after <see cref="WorkingChanged"/>.</summary>
        public GameSettingsData Working { get; private set; }

        /// <summary>Raised synchronously after a working value changes (AC-AM1 preview).</summary>
        public event Action<SettingsCategory> WorkingChanged;

        /// <summary>Raised after a successful Apply — working committed as the active profile (AC-ST7).</summary>
        public event Action<GameSettingsData> Committed;

        /// <summary>Raised after Cancel — snapshot restored to runtime (AC-ST8).</summary>
        public event Action<GameSettingsData> SnapshotRestored;

        /// <summary>Raised when Apply persistence fails (AC-ST7 failure path).</summary>
        public event Action<SaveResult> ApplyFailed;

        /// <summary>
        /// Sets a working value for a category. Category-to-type mapping is fixed: Difficulty→int,
        /// Controls→<see cref="ControlsData"/>, Audio→<see cref="AudioData"/>, Display→
        /// <see cref="DisplayData"/>, Accessibility→<see cref="AccessibilityData"/>, Camera→
        /// <see cref="CameraData"/>. null → <see cref="ArgumentNullException"/>; wrong type →
        /// <see cref="ArgumentException"/>; out-of-range enum → <see cref="ArgumentOutOfRangeException"/>.
        /// A display candidate (resolution/fullscreen differing from current Working) routes through
        /// <see cref="IDisplayConfirmGate"/> instead of applying immediately (GDD settings.md:110,
        /// :198). No-op when Closed.
        /// </summary>
        public void SetValue(SettingsCategory category, object value)
        {
            if (!IsOpen) return;

            GameSettingsData previous = Working;
            switch (category)
            {
                case SettingsCategory.Difficulty:
                    Working = Rebuild(Working, difficulty: new DifficultySelection(RequireDifficulty(category, value)));
                    break;

                case SettingsCategory.Controls:
                    Working = Rebuild(Working, controls: Require<ControlsData>(category, value));
                    break;

                case SettingsCategory.Audio:
                    Working = Rebuild(Working, audio: Require<AudioData>(category, value));
                    break;

                case SettingsCategory.Display:
                    HandleDisplayChange(Require<DisplayData>(category, value));
                    return; // WorkingChanged raised by the gate callback only when accepted

                case SettingsCategory.Accessibility:
                    Working = Rebuild(Working, accessibility: Require<AccessibilityData>(category, value));
                    break;

                case SettingsCategory.Camera:
                    Working = Rebuild(Working, camera: Require<CameraData>(category, value));
                    break;

                default:
                    throw new ArgumentOutOfRangeException(nameof(category), category, "Unknown settings category.");
            }

            // WorkingChanged means "the value changed" — an identical value is a no-op (no raise).
            if (Working.Equals(previous)) return;
            RaiseEvent(WorkingChanged, category);
        }

        /// <summary>
        /// Replaces working values with factory defaults (AC-E9): non-display categories apply
        /// immediately; a display candidate differing from the current Working display routes through
        /// <see cref="IDisplayConfirmGate"/> and only remains in Working when Accepted. Persistence
        /// always waits for <see cref="Apply"/>. No-op when Closed.
        /// </summary>
        public void RestoreDefaults()
        {
            if (!IsOpen) return;

            GameSettingsData defaults = GameSettingsData.Defaults;

            // Apply non-display categories immediately (each raises WorkingChanged).
            SetValue(SettingsCategory.Difficulty, defaults.Difficulty.Level);
            SetValue(SettingsCategory.Controls, defaults.Controls);
            SetValue(SettingsCategory.Audio, defaults.Audio);
            SetValue(SettingsCategory.Accessibility, defaults.Accessibility);
            SetValue(SettingsCategory.Camera, defaults.Camera);

            // Display candidate (defaults may differ from the current display, GDD settings.md:113).
            HandleDisplayChange(defaults.Display);
        }

        /// <summary>
        /// Persists Working (backup-first via <see cref="SettingsBlobService"/>) and commits it as the
        /// active profile on success (AC-ST7). On persistence failure the session stays Open, Working
        /// is preserved for retry/Cancel, and <see cref="ApplyFailed"/> is raised. Returns
        /// <see cref="ApplyResult.DisplayConfirmPending"/> while a display confirmation is pending
        /// (GDD settings.md:110) and <see cref="ApplyResult.AlreadyClosed"/> when Closed.
        /// </summary>
        public ApplyResult Apply()
        {
            if (!IsOpen) return ApplyResult.AlreadyClosed;
            if (_displayConfirmPending) return ApplyResult.DisplayConfirmPending;

            SaveResult saveResult;
            try
            {
                saveResult = _blobService.Save(Working);
            }
            catch (Exception ex)
            {
                _warningSink?.Invoke($"Settings Apply failed unexpectedly: {ex}\n{ex.StackTrace}");
                saveResult = SaveResult.PrimaryFailed;
            }

            switch (saveResult)
            {
                case SaveResult.Success:
                    _isOpen = false;
                    InvalidatePendingDisplayConfirm();
                    RaiseEvent(Committed, Working);
                    return ApplyResult.Success;
                case SaveResult.BackupFailed:
                    RaiseEvent(ApplyFailed, saveResult);
                    return ApplyResult.BackupFailed;
                default:
                    RaiseEvent(ApplyFailed, saveResult);
                    return ApplyResult.PrimaryFailed;
            }
        }

        /// <summary>
        /// Cancels the session: restores Snapshot to runtime (AC-ST8), resets Working to Snapshot,
        /// closes the session, and invalidates any pending display confirmation (a late gate outcome
        /// is a no-op). No persistence occurs. No-op when Closed.
        /// </summary>
        public void Cancel()
        {
            if (!IsOpen) return;
            _isOpen = false;
            Working = Snapshot;
            InvalidatePendingDisplayConfirm();
            RaiseEvent(SnapshotRestored, Snapshot);
        }

        /// <summary>
        /// Closes the session. An open session is cancelled (snapshot restored — no preview may be
        /// left orphaned in runtime consumers); a Closed session disposes safely (rapid toggle,
        /// AC-E8).
        /// </summary>
        public void Dispose()
        {
            if (_disposed) return;
            if (IsOpen) Cancel();
            _disposed = true;
        }

        // -- internals -------------------------------------------------------- //

        /// <summary>
        /// Raises an event defensively: subscriber exceptions are caught and routed to the warning
        /// sink (REQUIRED from code review) — a throwing subscriber must not break the session
        /// transition that already occurred (e.g. Apply already closed the session and persisted).
        /// </summary>
        private void RaiseEvent<T>(Action<T> handler, T value)
        {
            if (handler == null) return;
            try
            {
                handler(value);
            }
            catch (Exception ex)
            {
                _warningSink?.Invoke($"Settings event subscriber threw: {ex}\n{ex.StackTrace}");
            }
        }

        /// <summary>
        /// Invalidates any pending display confirmation — a late gate outcome is a no-op. Also
        /// COMPLETES the real gate (QA R14 F1): a terminal operation (Cancel/Dispose) or a
        /// superseding non-display change must restore the physical preview immediately, not leave
        /// it applied until the 15s timer or focus loss. The gate's outcome callback fires with
        /// RejectedOrTimeout, but the incremented version makes it a stale no-op here.
        /// </summary>
        private void InvalidatePendingDisplayConfirm()
        {
            _displayConfirmPending = false;
            _pendingVersion++;
            _displayConfirm.CancelActiveConfirmation();
        }

        private static T Require<T>(SettingsCategory category, object value)
        {
            if (value == null) throw new ArgumentNullException(nameof(value), $"{category} value is null.");
            if (!(value is T typed)) throw new ArgumentException($"{category} requires {typeof(T).Name}; got {value.GetType().Name}.", nameof(value));
            return typed;
        }

        /// <summary>
        /// Requires a difficulty level within the approved profile range (0-4, Very Easy..Very Hard)
        /// — the GDD mandates validated numeric ranges (BLOCKING, code review R2).
        /// </summary>
        private static int RequireDifficulty(SettingsCategory category, object value)
        {
            int level = Require<int>(category, value);
            if (level < DifficultySelection.MinLevel || level > DifficultySelection.MaxLevel)
                throw new ArgumentOutOfRangeException(nameof(value), level, $"Difficulty level must be within {DifficultySelection.MinLevel}..{DifficultySelection.MaxLevel} (Very Easy..Very Hard).");
            return level;
        }

        private static GameSettingsData Rebuild(
            GameSettingsData baseValue,
            DifficultySelection? difficulty = null,
            ControlsData? controls = null,
            AudioData? audio = null,
            DisplayData? display = null,
            AccessibilityData? accessibility = null,
            CameraData? camera = null)
        {
            return new GameSettingsData(
                baseValue.Version,
                difficulty ?? baseValue.Difficulty,
                controls ?? baseValue.Controls,
                audio ?? baseValue.Audio,
                display ?? baseValue.Display,
                accessibility ?? baseValue.Accessibility,
                camera ?? baseValue.Camera);
        }

        /// <summary>
        /// Routes a display change: a candidate differing from the current Working display goes through
        /// the confirmation gate; an identical display (or non-display field change only) applies
        /// immediately. A new candidate while one is pending replaces it (latest selection wins) via a
        /// generation counter — a late outcome for a stale candidate is a no-op.
        /// </summary>
        private void HandleDisplayChange(DisplayData display)
        {
            bool candidateChanged =
                display.ResolutionWidth != Working.Display.ResolutionWidth ||
                display.ResolutionHeight != Working.Display.ResolutionHeight ||
                display.FullscreenMode != Working.Display.FullscreenMode;

            // Non-display fields (vsync, quality preset) or an identical display apply immediately.
            if (!candidateChanged)
            {
                // A pending confirmation is superseded by this immediate apply — the player's newest
                // display action wins (GAPS, code review R2).
                if (_displayConfirmPending) InvalidatePendingDisplayConfirm();
                if (display.Equals(Working.Display)) return; // identical — no raise
                Working = Rebuild(Working, display: display);
                RaiseEvent(WorkingChanged, SettingsCategory.Display);
                return;
            }

            // New candidate replaces any pending one — generation counter invalidates the old outcome.
            int version = ++_pendingVersion;
            _displayConfirmPending = true;
            _pendingCandidate = new DisplayCandidate(display.ResolutionWidth, display.ResolutionHeight, display.FullscreenMode);

            try
            {
                _displayConfirm.Confirm(_pendingCandidate, result => OnDisplayConfirmOutcome(version, result));
            }
            catch (Exception ex)
            {
                // Gate failure must not brick the session: clear the pending latch so Apply is
                // not blocked forever, and report through the warning sink (REQUIRED, code review R2).
                _displayConfirmPending = false;
                _pendingVersion = version - 1;
                _warningSink?.Invoke($"Display confirm gate failed: {ex}\n{ex.StackTrace}");
            }
        }

        private void OnDisplayConfirmOutcome(int version, DisplayConfirmResult outcome)
        {
            // Stale or post-close outcome (a newer candidate replaced this one, or the session was
            // cancelled/applied while the gate was pending) — no-op: never mutate a closed session.
            // Note: the !IsOpen term is defensive only — a closed session always invalidates the
            // pending latch (Cancel/Apply call InvalidatePendingDisplayConfirm), so the pending/version
            // guards alone already reject late outcomes by contract. Kept as belt-and-braces against
            // future contract drift; the state is unreachable through the public API.
            if (!IsOpen || !_displayConfirmPending || version != _pendingVersion) return;

            _displayConfirmPending = false;

            if (outcome == DisplayConfirmResult.Accepted)
            {
                Working = Rebuild(Working, display: new DisplayData(
                    _pendingCandidate.Width,
                    _pendingCandidate.Height,
                    _pendingCandidate.FullscreenMode,
                    Working.Display.Vsync,
                    Working.Display.QualityPreset));
                RaiseEvent(WorkingChanged, SettingsCategory.Display);
            }
            // RejectedOrTimeout — prior Working.Display values remain; nothing changes.
        }
    }
}
