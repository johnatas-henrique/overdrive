using System;
using Overdrive.Settings.Core;

namespace Overdrive.Settings
{
    /// <summary>
    /// UI-facing facade composing the display/quality flow (Story 005) so the AC-DR6 ordering
    /// (ApplyPreset BEFORE session.SetValue; Rejected skips SetValue) is a testable seam of this
    /// story, not implicit UI behaviour. The UI epic calls these methods; the session, gate,
    /// display adapter, and applier stay behind the ports. Disposable — unsubscribes the
    /// display-warning re-route when the UI is torn down.
    /// </summary>
    public sealed class DisplaySettingsOrchestrator : IDisposable
    {
        private readonly IDisplayApi _displayApi;
        private readonly IQualityPresetApplier _applier;
        private readonly IDisplayConfirmControl _gate;
        private readonly Action<string> _onWarning;
        private bool _disposed;

        /// <summary>
        /// Re-routed display warning (nearest-supported fallback, DR2). The orchestrator
        /// subscribes to <see cref="IDisplayApi.Warning"/> before resolving and forwards to the
        /// UI warning sink; the gate never handles warnings (Story 005 R5 finding 2).
        /// </summary>
        public event Action<string> Warning;

        /// <summary>Creates the orchestrator.</summary>
        /// <param name="displayApi">The display hardware port.</param>
        /// <param name="applier">The quality-preset applier.</param>
        /// <param name="gate">The display-confirm gate (typed as the extended control surface).</param>
        public DisplaySettingsOrchestrator(IDisplayApi displayApi, IQualityPresetApplier applier, IDisplayConfirmControl gate)
        {
            _displayApi = displayApi ?? throw new ArgumentNullException(nameof(displayApi));
            _applier = applier ?? throw new ArgumentNullException(nameof(applier));
            _gate = gate ?? throw new ArgumentNullException(nameof(gate));
            _onWarning = msg => Warning?.Invoke(msg);
            _displayApi.Warning += _onWarning;
        }

        /// <summary>Unsubscribes the display-warning re-route.</summary>
        public void Dispose()
        {
            if (_disposed) return;
            _displayApi.Warning -= _onWarning;
            _disposed = true;
        }

        /// <summary>
        /// Applies a display candidate: resolves the requested state to the nearest supported
        /// (emitting the display warning on fallback), hands the resolved physical state to the
        /// gate via <see cref="IDisplayConfirmControl.PrepareDisplayState"/>, then updates the
        /// session's working Display data. The session routes the change through the gate
        /// (DisplayConfirm opens). Returns false when no supported state exists (typed
        /// rejection — nothing is applied, no timer starts).
        /// </summary>
        /// <param name="requested">The player's requested display state.</param>
        /// <param name="session">The open settings edit session.</param>
        /// <returns>True when a supported state was resolved and the preview flow started; false when rejected.</returns>
        public bool ApplyDisplay(DisplayState requested, SettingsEditSession session)
        {
            if (_disposed) throw new ObjectDisposedException(nameof(DisplaySettingsOrchestrator));
            if (session == null) throw new ArgumentNullException(nameof(session));

            if (!_displayApi.TryResolveRequested(requested, out DisplayState resolved)) return false;

            DisplayData working = session.Working.Display;

            // Physical-state handoff only when the display actually CHANGED (QA R11 F3, R12 F2a):
            // the session treats a display identical to Working as a no-op and never opens a
            // confirmation, so preparing anyway would leave a stale prepared state that a LATER
            // confirmation (e.g. RestoreDefaults, which bypasses the orchestrator) could wrongly
            // match. The comparison uses the RESOLVED state (what the session receives) — an
            // unsupported request that falls back to the current display must not prepare.
            bool displayUnchanged =
                resolved.Width == working.ResolutionWidth
                && resolved.Height == working.ResolutionHeight
                && resolved.ScreenMode == DisplayStateResolver.ToFullScreenMode(working.FullscreenMode);
            if (session.IsOpen && !displayUnchanged) _gate.PrepareDisplayState(resolved);

            session.SetValue(SettingsCategory.Display, new DisplayData(
                resolved.Width,
                resolved.Height,
                DisplayStateResolver.ToIntMode(resolved.ScreenMode),
                working.Vsync,
                working.QualityPreset));
            return true;
        }

        /// <summary>
        /// Applies a quality preset: resolves the mapping, calls
        /// <see cref="IQualityPresetApplier.ApplyPreset"/> FIRST (Story 005 AC-DR6 ordering),
        /// and only on <see cref="ApplyStatus.Applied"/> updates the session's working Display
        /// quality-preset field. On <see cref="ApplyStatus.Rejected"/> the session is NOT
        /// touched — Working stays unchanged, no WorkingChanged fires, no persistence occurs.
        /// </summary>
        /// <param name="id">The preset to apply (Low..Ultra; Custom or an invalid id returns Rejected).</param>
        /// <param name="session">The open settings edit session.</param>
        /// <returns>The apply outcome.</returns>
        public ApplyStatus ApplyQualityPreset(QualityPresetId id, SettingsEditSession session)
        {
            if (_disposed) throw new ObjectDisposedException(nameof(DisplaySettingsOrchestrator));
            if (session == null) throw new ArgumentNullException(nameof(session));

            // Defensive facade contract (QA R10 pre-emptive): an invalid id (Custom or an
            // undefined value) resolves to Rejected — a UI bug must not crash the facade or
            // touch the session. The applier itself throws for Custom (no mapping exists);
            // converting here keeps the facade total.
            QualityPresetMapping mapping;
            try
            {
                mapping = _applier.ResolveMapping(id);
            }
            catch (ArgumentOutOfRangeException)
            {
                return ApplyStatus.Rejected;
            }

            ApplyStatus status = _applier.ApplyPreset(mapping);
            if (status != ApplyStatus.Applied) return status;

            DisplayData working = session.Working.Display;
            session.SetValue(SettingsCategory.Display, new DisplayData(
                working.ResolutionWidth,
                working.ResolutionHeight,
                working.FullscreenMode,
                working.Vsync,
                (int)id));
            return status;
        }

        /// <summary>
        /// Changes VSync (the only advanced display field in the shipped DisplayData schema,
        /// Story 005 AC-DR7): marks the active preset as Custom via
        /// <see cref="IQualityPresetApplier.MarkCustomOverride"/> then updates the session's
        /// working Display. Render Scale / Shadow Resolution / MSAA advanced fields and VSync
        /// Adaptive are deferred to the VFX epic.
        /// </summary>
        /// <param name="vsync">The new VSync count (0=Off, 1=On).</param>
        /// <param name="session">The open settings edit session.</param>
        public void SetVsync(int vsync, SettingsEditSession session)
        {
            if (_disposed) throw new ObjectDisposedException(nameof(DisplaySettingsOrchestrator));
            if (session == null) throw new ArgumentNullException(nameof(session));

            // No-op when the value is unchanged (QA R6 F6): setting VSync to the SAME value is
            // not a change and must not transition the active preset to Custom.
            if (session.Working.Display.Vsync == vsync) return;

            _applier.MarkCustomOverride();

            DisplayData working = session.Working.Display;
            session.SetValue(SettingsCategory.Display, new DisplayData(
                working.ResolutionWidth,
                working.ResolutionHeight,
                working.FullscreenMode,
                vsync,
                working.QualityPreset));
        }
    }
}
