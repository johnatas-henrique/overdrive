using System;

namespace Overdrive.Settings.Core
{
    /// <summary>
    /// The settings categories a player can edit. Maps 1:1 to the six categories of
    /// <see cref="GameSettingsData"/>.
    /// </summary>
    public enum SettingsCategory
    {
        /// <summary>Difficulty selection (int level).</summary>
        Difficulty,
        /// <summary>Control dead zones / EMA alphas / bindings (<see cref="ControlsData"/>).</summary>
        Controls,
        /// <summary>Audio volumes and mutes (<see cref="AudioData"/>).</summary>
        Audio,
        /// <summary>Resolution, fullscreen, vsync, quality (<see cref="DisplayData"/>).</summary>
        Display,
        /// <summary>Accessibility (<see cref="AccessibilityData"/>).</summary>
        Accessibility,
        /// <summary>Camera (<see cref="CameraData"/>).</summary>
        Camera
    }

    /// <summary>
    /// The outcome of opening a settings session. <see cref="Opened"/> means a session was created;
    /// the other values mean the request was rejected with no state change (no session created).
    /// </summary>
    public enum SettingsOpenResult
    {
        /// <summary>A session was opened.</summary>
        Opened,
        /// <summary>Rejected: the lifecycle context forbids opening (active Countdown, GDD settings.md:252).</summary>
        BlockedCountdown,
        /// <summary>Rejected: a session is already open — one session at a time (ADR-0004:165).</summary>
        SessionActive
    }

    /// <summary>
    /// The outcome of <see cref="SettingsEditSession.Apply"/>. Maps the persistence
    /// <see cref="SaveResult"/> plus the session-local lifecycle states.
    /// </summary>
    public enum ApplyResult
    {
        /// <summary>Working was persisted and committed as the active profile.</summary>
        Success,
        /// <summary>The backup write failed (persistence <see cref="SaveResult.BackupFailed"/>).</summary>
        BackupFailed,
        /// <summary>The primary write failed (persistence <see cref="SaveResult.PrimaryFailed"/>).</summary>
        PrimaryFailed,
        /// <summary>A display confirmation is pending — Apply is disabled (GDD settings.md:110).</summary>
        DisplayConfirmPending,
        /// <summary>Apply was called on a session that is already Closed (rapid toggle, AC-E8).</summary>
        AlreadyClosed
    }

    /// <summary>
    /// The outcome of a display confirmation. The gate (Story 005) owns the 15-unscaled-second timer
    /// (GDD settings.md:110) and reports the outcome through the callback.
    /// </summary>
    public enum DisplayConfirmResult
    {
        /// <summary>The player kept the candidate — it may remain in working.</summary>
        Accepted,
        /// <summary>The player cancelled, timed out, or lost focus — the prior display values are restored.</summary>
        RejectedOrTimeout
    }

    /// <summary>
    /// A resolution/fullscreen candidate awaiting confirmation (GDD settings.md:110, :198).
    /// </summary>
    public readonly struct DisplayCandidate
    {
        /// <summary>Creates a display candidate.</summary>
        public DisplayCandidate(int width, int height, int fullscreenMode)
        {
            Width = width;
            Height = height;
            FullscreenMode = fullscreenMode;
        }

        /// <summary>The candidate resolution width.</summary>
        public int Width { get; }

        /// <summary>The candidate resolution height.</summary>
        public int Height { get; }

        /// <summary>The candidate fullscreen mode (0 windowed, 1 fullscreen window, 2 exclusive).</summary>
        public int FullscreenMode { get; }
    }

    /// <summary>
    /// The display-confirmation seam consumed by the session (AC-E9). The real implementation is
    /// Story 005 (Display Confirm &amp; Quality Presets); tests inject a fake that invokes the callback
    /// synchronously with a chosen result. While a confirmation is pending, the session exposes
    /// <see cref="SettingsEditSession.HasPendingDisplayConfirm"/> and
    /// <see cref="SettingsEditSession.Apply"/> returns <see cref="ApplyResult.DisplayConfirmPending"/>.
    /// </summary>
    public interface IDisplayConfirmGate
    {
        /// <summary>
        /// Confirms a display candidate. The gate owns the 15-second timer and invokes
        /// <paramref name="onResult"/> exactly once with the outcome. A concurrent second call
        /// replaces the pending candidate — the session is responsible for making the previous
        /// callback a no-op.
        /// </summary>
        /// <param name="candidate">The resolution/fullscreen candidate.</param>
        /// <param name="onResult">The outcome callback (invoked once).</param>
        void Confirm(DisplayCandidate candidate, Action<DisplayConfirmResult> onResult);
    }

    /// <summary>
    /// The settings lifecycle context seam (AC-E2, AC-D6, AC-ST1). The real implementation consumes
    /// simulation state (Story 003's <c>ISimulationStateGate</c>); tests inject a fake.
    /// </summary>
    public interface ISettingsLifecycleContext
    {
        /// <summary>
        /// True when settings may be opened: title/Idle, paused race, or paused Countdown. False
        /// during an ACTIVE (non-paused) Countdown (GDD settings.md:252). A paused Countdown opens
        /// through the normal pause menu.
        /// </summary>
        bool CanOpenSettings { get; }

        /// <summary>
        /// True when the Difficulty category may be edited. False when an active race owns an
        /// immutable DifficultyProfile snapshot (GDD settings.md:299) — including paused Countdown
        /// and paused Racing.
        /// </summary>
        bool IsDifficultyEditable { get; }
    }
}
