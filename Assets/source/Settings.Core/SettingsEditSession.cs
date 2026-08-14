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
        private readonly AudioSettingsPort _audioPort;
        private readonly AccessibilitySettingsPort _accessibilityPort;
        private readonly CameraSettingsPort _cameraPort;
        private readonly VfxSettingsPort _vfxPort;
        private bool _isOpen;
        private bool _disposed;
        private bool _displayConfirmPending;
        private DisplayCandidate _pendingCandidate;
        private DisplayData _pendingDisplay;
        private int _pendingVersion;
        private bool _suppressPortPublishing;
        private bool _isPublishing;
        private bool _inWorkingChangedDispatch;

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
            return TryOpen(blobService, lifecycle, displayConfirm, warningSink, currentSession, null, null, null, null, out result);
        }

        /// <summary>
        /// Opens a settings session with the optional typed value ports (Story 3-7). Same guards as the
        /// 5-arg overload; a null port is a no-op publisher. The full overload exists because C# forbids
        /// optional parameters before a required <c>out</c> parameter (gate R5) — nullable reference
        /// types signal null-safety at the call site.
        /// </summary>
        /// <param name="blobService">The persistence facade (Story 001) — Load seeds Snapshot, Save persists Working.</param>
        /// <param name="lifecycle">The lifecycle context (Countdown gate, Difficulty editability).</param>
        /// <param name="displayConfirm">The display-confirmation gate (Story 005 supplies the real one).</param>
        /// <param name="warningSink">Warning sink (duplicate bindings, failed default persist, etc.).</param>
        /// <param name="currentSession">The caller's held session reference (null when none).</param>
        /// <param name="audio">Optional audio value port — null means no-op (existing callers unaffected).</param>
        /// <param name="accessibility">Optional accessibility value port — null means no-op.</param>
        /// <param name="camera">Optional camera value port — null means no-op.</param>
        /// <param name="vfx">Optional VFX quality port — null means no-op.</param>
        /// <param name="result">The open outcome.</param>
        /// <returns>The opened session, or null when rejected.</returns>
        public static SettingsEditSession TryOpen(
            SettingsBlobService blobService,
            ISettingsLifecycleContext lifecycle,
            IDisplayConfirmGate displayConfirm,
            Action<string> warningSink,
            SettingsEditSession currentSession,
            AudioSettingsPort audio,
            AccessibilitySettingsPort accessibility,
            CameraSettingsPort camera,
            VfxSettingsPort vfx,
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
            return new SettingsEditSession(blobService, displayConfirm, warningSink, outcome.Settings, audio, accessibility, camera, vfx);
        }

        private SettingsEditSession(
            SettingsBlobService blobService,
            IDisplayConfirmGate displayConfirm,
            Action<string> warningSink,
            GameSettingsData snapshot,
            AudioSettingsPort audio,
            AccessibilitySettingsPort accessibility,
            CameraSettingsPort camera,
            VfxSettingsPort vfx)
        {
            _blobService = blobService;
            _displayConfirm = displayConfirm;
            _warningSink = warningSink;
            Snapshot = snapshot;
            Working = snapshot;
            _audioPort = audio;
            _accessibilityPort = accessibility;
            _cameraPort = camera;
            _vfxPort = vfx;
            _isOpen = true;
        }

        /// <summary>Typed audio value port (Story 3-7) — null when the session was opened without ports.</summary>
        public AudioSettingsPort Audio => _audioPort;

        /// <summary>Typed accessibility value port (Story 3-7) — null when the session was opened without ports.</summary>
        public AccessibilitySettingsPort Accessibility => _accessibilityPort;

        /// <summary>Typed camera value port (Story 3-7) — null when the session was opened without ports.</summary>
        public CameraSettingsPort Camera => _cameraPort;

        /// <summary>Typed VFX quality port (Story 3-7) — null when the session was opened without ports.</summary>
        public VfxSettingsPort Vfx => _vfxPort;

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
            if (_isPublishing) throw new InvalidOperationException("SettingsEditSession cannot be mutated from inside a value-port handler (re-entrancy guard, Story 3-7).");
            // Recursion guard (final review): a WorkingChanged handler calling SetValue would recurse
            // unboundedly (SetValue → WorkingChanged → SetValue → ...) and stack-overflow. Feedback
            // mutation from a consumer is rejected — Cancel/Apply remain legal (terminal responses).
            if (_inWorkingChangedDispatch) throw new InvalidOperationException("SettingsEditSession cannot be mutated from a WorkingChanged handler (recursion guard, Story 3-7).");

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
                    HandleDisplayChange(RequireDisplay(category, value));
                    return; // WorkingChanged raised by the gate callback only when accepted

                case SettingsCategory.Accessibility:
                    Working = Rebuild(Working, accessibility: RequireAccessibility(category, value));
                    break;

                case SettingsCategory.Camera:
                    Working = Rebuild(Working, camera: RequireCamera(category, value));
                    break;

                default:
                    throw new ArgumentOutOfRangeException(nameof(category), category, "Unknown settings category.");
            }

            // WorkingChanged means "the value changed" — an identical value is a no-op (no raise).
            if (Working.Equals(previous)) return;
            RaiseWorkingChanged(category);
            // A WorkingChanged subscriber may CLOSE the session (Cancel/Apply) during dispatch —
            // never publish after closure (pre-emptive audit, qa-tester R4 pattern).
            if (!IsOpen) return;
            PublishPorts();
        }

        /// <summary>
        /// Replaces working values with factory defaults (AC-E9): non-display categories apply
        /// immediately; a display candidate differing from the current Working display routes through
        /// <see cref="IDisplayConfirmGate"/> and only remains in Working when Accepted. Persistence
        /// always waits for <see cref="Apply"/>. No-op when Closed.
        /// </summary>
        /// <remarks>
        /// Batch mode (unity-specialist BLOCKING, Story 3-7): RestoreDefaults calls SetValue five times,
        /// which would otherwise publish the value ports five times with partially-updated Working.
        /// Publication is suppressed during the cascade and fired ONCE afterwards (Camera → Accessibility
        /// → Audio → Vfx), so the accessibility ReducedMotion is always resolved fresh. Legacy per-category
        /// WorkingChanged events still fire per SetValue (Story 002 behavior untouched).
        /// </remarks>
        public void RestoreDefaults()
        {
            if (!IsOpen) return;
            if (_isPublishing) throw new InvalidOperationException("SettingsEditSession cannot be mutated from inside a value-port handler (re-entrancy guard, Story 3-7).");
            if (_inWorkingChangedDispatch) throw new InvalidOperationException("SettingsEditSession cannot be mutated from a WorkingChanged handler (recursion guard, Story 3-7).");

            GameSettingsData defaults = GameSettingsData.Defaults;

            _suppressPortPublishing = true;
            try
            {
                // Apply non-display categories immediately (each raises WorkingChanged).
                SetValue(SettingsCategory.Difficulty, defaults.Difficulty.Level);
                SetValue(SettingsCategory.Controls, defaults.Controls);
                SetValue(SettingsCategory.Audio, defaults.Audio);
                SetValue(SettingsCategory.Accessibility, defaults.Accessibility);
                SetValue(SettingsCategory.Camera, defaults.Camera);

                // Display candidate (defaults may differ from the current display, GDD settings.md:113).
                HandleDisplayChange(defaults.Display);
            }
            finally
            {
                _suppressPortPublishing = false;
            }

            // A WorkingChanged subscriber may CLOSE the session mid-cascade (Cancel/Apply) — the
            // remaining SetValue calls are no-ops, but HandleDisplayChange and the final publication
            // must not run on a closed session (qa-tester R4 BLOCKING 2).
            if (!IsOpen) return;

            // Publish the ports ONCE with the post-cascade Working (batch mode).
            PublishPorts();
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
            if (_isPublishing) throw new InvalidOperationException("SettingsEditSession cannot be mutated from inside a value-port handler (re-entrancy guard, Story 3-7).");
            if (_displayConfirmPending) return ApplyResult.DisplayConfirmPending;

            SaveResult saveResult;
            try
            {
                saveResult = _blobService.Save(Working);
            }
            catch (Exception ex)
            {
                LogWarning($"Settings Apply failed unexpectedly: {ex}\n{ex.StackTrace}");
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
            if (_isPublishing) throw new InvalidOperationException("SettingsEditSession cannot be mutated from inside a value-port handler (re-entrancy guard, Story 3-7).");
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
            // Consistent with SetValue/Apply/Cancel/RestoreDefaults: mutating (closing) the session
            // from inside a value-port handler is rejected (pre-emptive audit — a port handler calling
            // Dispose during publication must not silently half-close).
            if (_isPublishing) throw new InvalidOperationException("SettingsEditSession cannot be disposed from inside a value-port handler (re-entrancy guard, Story 3-7).");
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
                LogWarning($"Settings event subscriber threw: {ex}\n{ex.StackTrace}");
            }
        }

        /// <summary>
        /// Raises <see cref="WorkingChanged"/> under the recursion guard (final review): the flag is
        /// armed for the duration of the dispatch so a feedback-mutating subscriber (SetValue/
        /// RestoreDefaults) is rejected instead of recursing to stack overflow. Reset in finally —
        /// even a throwing subscriber must release the guard.
        /// </summary>
        private void RaiseWorkingChanged(SettingsCategory category)
        {
            if (WorkingChanged == null) return;
            _inWorkingChangedDispatch = true;
            try
            {
                RaiseEvent(WorkingChanged, category);
            }
            finally
            {
                _inWorkingChangedDispatch = false;
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
            // The pending payload is consumed/invalidated alongside the latch — no stale DisplayData
            // may survive an invalidation (qa-tester R3 GAP).
            _pendingDisplay = default;
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

        /// <summary>
        /// Requires an accessibility value within the approved domains (Story 3-7, AC-E5): TextScale in
        /// 0.75–2.0 (boundaries accepted) and a valid ColorblindMode int (0..3). Rejection leaves Working
        /// untouched (gate R3 — explicit rejection, no clamping).
        /// </summary>
        private static AccessibilityData RequireAccessibility(SettingsCategory category, object value)
        {
            AccessibilityData data = Require<AccessibilityData>(category, value);
            if (!float.IsFinite(data.TextScale) || data.TextScale < 0.75f || data.TextScale > 2.0f)
                throw new ArgumentOutOfRangeException(nameof(value), data.TextScale, "TextScale must be within 0.75..2.0 (AC-E5); non-finite values are rejected.");
            if (data.ColorblindMode < 0 || data.ColorblindMode > 3)
                throw new ArgumentOutOfRangeException(nameof(value), data.ColorblindMode, "ColorblindMode must be 0..3 (None..Tritanopia).");
            return data;
        }

        /// <summary>
        /// Requires a camera value within the approved domains (Story 3-7): ShakeIntensity in 0.0–2.0
        /// (GDD settings.md:158). Rejection leaves Working untouched.
        /// </summary>
        private static CameraData RequireCamera(SettingsCategory category, object value)
        {
            CameraData data = Require<CameraData>(category, value);
            if (!float.IsFinite(data.ShakeIntensity) || data.ShakeIntensity < 0f || data.ShakeIntensity > 2.0f)
                throw new ArgumentOutOfRangeException(nameof(value), data.ShakeIntensity, "ShakeIntensity must be within 0..2 (GDD settings.md:158); non-finite values are rejected.");
            return data;
        }

        /// <summary>
        /// Requires a display value with a persisted quality preset (Story 3-7, gate R5): QualityPreset
        /// must be 0..3 (Low..Ultra). QualityPresetId.Custom (4, the Story 3-6 VSync marker) is never
        /// persisted and is rejected here. Rejection leaves Working untouched.
        /// </summary>
        private static DisplayData RequireDisplay(SettingsCategory category, object value)
        {
            DisplayData data = Require<DisplayData>(category, value);
            if (data.QualityPreset < 0 || data.QualityPreset > 3)
                throw new ArgumentOutOfRangeException(nameof(value), data.QualityPreset, "QualityPreset must be 0..3 (Low..Ultra); Custom (4) is never persisted.");
            return data;
        }

        /// <summary>
        /// Publishes the typed value ports (Story 3-7) in the fixed order Camera → Accessibility (with
        /// the resolved camera ReducedMotion) → Audio → Vfx, using the current Working. Suppressed during
        /// RestoreDefaults batch mode (published once after the cascade). Re-entrant publication is
        /// guarded by <see cref="_isPublishing"/> — a port handler that mutates the session throws.
        /// Each port is published in its own try/catch (unity-specialist R1): a throwing subscriber in
        /// one port must not prevent the remaining ports from emitting (the fixed order is preserved).
        /// </summary>
        private void PublishPorts()
        {
            if (_suppressPortPublishing || _isPublishing) return;

            _isPublishing = true;
            try
            {
                // Camera first, then Accessibility (resolved ReducedMotion — never stale), then Audio, then Vfx.
                SafePublish(() => _cameraPort?.Publish(Working.Camera));
                SafePublish(() => _accessibilityPort?.Publish(Working.Accessibility, Working.Camera.ReducedMotion));
                SafePublish(() => _audioPort?.Publish(Working.Audio));
                SafePublish(() => _vfxPort?.Publish(ToQualityPresetId(Working.Display.QualityPreset)));
            }
            finally
            {
                _isPublishing = false;
            }
        }

        /// <summary>Routes a warning to the sink defensively: a throwing diagnostic sink must never
        /// break the session transition it is reporting (double-fault safety, qa-tester R3/R4).</summary>
        private void LogWarning(string message)
        {
            try { _warningSink?.Invoke(message); }
            catch { /* a broken diagnostic sink must not propagate */ }
        }

        /// <summary>Publishes one port defensively: a throwing subscriber routes to the warning sink and
        /// does not break the remaining ports or the session transition (unity-specialist R1). A throwing
        /// warning sink itself is contained (double-fault safety, unity-specialist R2 S1).</summary>
        private void SafePublish(Action publish)
        {
            try
            {
                publish();
            }
            catch (Exception ex)
            {
                LogWarning($"Value port subscriber threw: {ex}\n{ex.StackTrace}");
            }
        }

        /// <summary>Maps the persisted int (0=Low, 1=Medium, 2=High, 3=Ultra) to <see cref="QualityPresetId"/>.</summary>
        private static QualityPresetId ToQualityPresetId(int qualityPreset)
        {
            switch (qualityPreset)
            {
                case 0: return QualityPresetId.Low;
                case 1: return QualityPresetId.Medium;
                case 2: return QualityPresetId.High;
                default: return QualityPresetId.Ultra;
            }
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
            if (!IsOpen) return; // defensive: never open a confirmation on a closed session (qa-tester R4)

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
                RaiseWorkingChanged(SettingsCategory.Display);
                // A WorkingChanged subscriber may CLOSE the session (Cancel/Apply) during dispatch —
                // never publish after closure (pre-emptive audit, qa-tester R4 pattern).
                if (!IsOpen) return;
                PublishPorts(); // the display Working changed — republish (Vfx quality may have changed).
                return;
            }

            // New candidate replaces any pending one — generation counter invalidates the old outcome.
            int version = ++_pendingVersion;
            _displayConfirmPending = true;
            _pendingCandidate = new DisplayCandidate(display.ResolutionWidth, display.ResolutionHeight, display.FullscreenMode);
            // The FULL requested DisplayData is retained for the Accepted reconstruction (qa-tester R1
            // BLOCKING): a candidate carries only width/height/mode, so without this the Accepted path
            // would keep Working's vsync/quality — RestoreDefaults through the gate would lose the
            // default vsync/quality (e.g. default 1/1 preserved as 0/3).
            _pendingDisplay = display;

            try
            {
                _displayConfirm.Confirm(_pendingCandidate, result => OnDisplayConfirmOutcome(version, result));
            }
            catch (Exception ex)
            {
                // Gate failure must not brick the session: clear the pending latch so Apply is
                // not blocked forever, and report through the warning sink (REQUIRED, code review R2).
                // InvalidatePendingDisplayConfirm() (NOT a manual reset) keeps the version counter
                // MONOTONIC — a gate that retained its callback before throwing must not cause a
                // later candidate to reuse the thrown generation (qa-tester R2 B1: recycling the
                // version let a late callback from the failed candidate accept a different one).
                InvalidatePendingDisplayConfirm();
                LogWarning($"Display confirm gate failed: {ex}\n{ex.StackTrace}");
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

            // Consume the pending display BEFORE raising any event: a reentrant WorkingChanged
            // subscriber may open a NEW candidate (qa-tester R3 BLOCKING) — clearing the field after
            // RaiseEvent would wipe the new candidate's pending payload.
            DisplayData acceptedDisplay = _pendingDisplay;
            _pendingDisplay = default;

            if (outcome == DisplayConfirmResult.Accepted)
            {
                // Apply the FULL requested display (vsync/quality included) — the candidate only carried
                // width/height/mode; the pending DisplayData is the authoritative reconstruction source
                // (qa-tester R1 BLOCKING: RestoreDefaults through the gate must restore ALL defaults).
                Working = Rebuild(Working, display: acceptedDisplay);
                RaiseWorkingChanged(SettingsCategory.Display);
                // A WorkingChanged subscriber may CLOSE the session (Cancel/Apply) before publication
                // starts — never publish after closure (qa-tester R4 BLOCKING 1).
                if (!IsOpen) return;
                PublishPorts(); // the display Working changed — republish (Vfx quality may have changed).
            }
            // RejectedOrTimeout — prior Working.Display values remain; nothing changes.
        }
    }
}
