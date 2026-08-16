using System;
using UnityEngine;
using Overdrive.Settings.Core;

namespace Overdrive.Settings
{
    /// <summary>
    /// The real DisplayConfirm gate (Story 005) implementing both the Core seam
    /// <see cref="IDisplayConfirmGate"/> (the session sees only this) and the extended
    /// <see cref="IDisplayConfirmControl"/> the UI uses. Owns the 15-second unscaled
    /// confirmation timer, the pre-preview baseline/restore lifecycle, and the focus-loss
    /// rollback (ADR-0004:182-191, Story 005 AC-DR3/DR4/DR5/ST9).
    /// </summary>
    /// <remarks>
    /// Invariant: the pending callback is invoked exactly once per active confirmation. A
    /// replacement candidate (a second Confirm while one is pending) supersedes the previous
    /// callback — the session's generation counter invalidates the stale one, so it is never
    /// invoked. Focus loss while pending triggers exactly one restore + one outcome; a re-focus
    /// does not cancel the running timer.
    /// </remarks>
    public sealed class DisplayConfirmGate : IDisplayConfirmControl, IDisposable
    {
        /// <summary>The confirmation timeout in unscaled seconds (GDD settings.md:110).</summary>
        public const float ConfirmationSeconds = 15f;

        private readonly IDisplayApi _displayApi;
        private readonly IFocusChangeSource _focusSource;

        private bool _hasPrepared;
        private DisplayState _prepared;
        private bool _hasBaseline;
        private DisplayState _baseline;
        private bool _previewApplied;
        private bool _confirmActive;
        private float _remainingSeconds;
        private Action<DisplayConfirmResult> _pendingCallback;
        private bool _focusSubscribed;
        private bool _focusLossHandled;
        private bool _disposed;

        /// <summary>Creates the gate.</summary>
        /// <param name="displayApi">The display hardware port (real Screen adapter or fake).</param>
        /// <param name="focusSource">The focus-change source (real Application.focusChanged adapter or fake).</param>
        public DisplayConfirmGate(IDisplayApi displayApi, IFocusChangeSource focusSource)
        {
            _displayApi = displayApi ?? throw new ArgumentNullException(nameof(displayApi));
            _focusSource = focusSource ?? throw new ArgumentNullException(nameof(focusSource));
        }

        /// <summary>True while a confirmation is pending and the timer is running.</summary>
        public bool IsActive => _confirmActive && !_disposed;

        /// <inheritdoc />
        public void PrepareDisplayState(DisplayState resolved)
        {
            _prepared = resolved;
            _hasPrepared = true;
        }

        /// <inheritdoc />
        public void Confirm(DisplayCandidate candidate, Action<DisplayConfirmResult> onResult)
        {
            if (onResult == null) throw new ArgumentNullException(nameof(onResult));
            if (_disposed) throw new ObjectDisposedException(nameof(DisplayConfirmGate));

            DisplayState resolved = ResolveForCandidate(candidate);

            // Baseline is captured before the FIRST preview apply only; a replacement candidate
            // while one is pending never updates it (the original pre-preview state is what
            // Cancel/timeout/focus-loss restore).
            if (!_hasBaseline)
            {
                _baseline = _displayApi.CurrentState;
                _hasBaseline = true;
            }

            DisplayPreviewResult result = _displayApi.ApplyPreview(resolved);

            if (result != DisplayPreviewResult.Applied)
            {
                // Typed rejection: no timer, no retention. If a previous preview was applied
                // (rejection while another DisplayConfirm is pending), restore the original
                // baseline exactly once — an abandoned preview never remains applied.
                RestoreBaselineIfPreviewApplied();
                CompletePending(onResult, DisplayConfirmResult.RejectedOrTimeout);
                return;
            }

            _previewApplied = true;
            _pendingCallback = onResult;
            _remainingSeconds = ConfirmationSeconds;
            _confirmActive = true;
            _focusLossHandled = false;
            SubscribeFocus();
        }

        /// <inheritdoc />
        public void KeepChanges()
        {
            if (!IsActive) return;
            // The preview is now the ACCEPTED state — no longer a transient preview. Clearing
            // _previewApplied prevents a later rejected candidate from restoring the pre-Keep
            // baseline (QA R6 F3): a Keep followed by a rejected Confirm must not undo the
            // accepted change.
            _previewApplied = false;
            // Candidate remains applied — no restore. The session copies it to Working.
            CompletePending(_pendingCallback, DisplayConfirmResult.Accepted);
        }

        /// <inheritdoc />
        public void Cancel()
        {
            if (!IsActive) return;
            RestoreBaselineIfPreviewApplied();
            CompletePending(_pendingCallback, DisplayConfirmResult.RejectedOrTimeout);
        }

        /// <summary>
        /// Core-seam cancel used by the session on terminal/superseding operations (QA R14 F1):
        /// delegates to <see cref="Cancel"/> so a physical preview is never left orphaned. No-op
        /// when no confirmation is active.
        /// </summary>
        public void CancelActiveConfirmation() => Cancel();

        /// <inheritdoc />
        public void Tick(float unscaledDeltaTime)
        {
            if (!IsActive) return;
            // Defensive: a non-positive delta (0 or negative) must not prolong the confirmation
            // timer (QA R10 pre-emptive) — Time.unscaledDeltaTime is always ≥ 0 at runtime, but
            // a buggy caller must not be able to hold the confirmation open forever.
            if (unscaledDeltaTime <= 0f) return;
            _remainingSeconds -= unscaledDeltaTime;
            if (_remainingSeconds <= 0f)
            {
                RestoreBaselineIfPreviewApplied();
                CompletePending(_pendingCallback, DisplayConfirmResult.RejectedOrTimeout);
            }
        }

        /// <inheritdoc />
        public void Dispose()
        {
            if (_disposed) return;
            // Completing any active confirmation prevents the session's _displayConfirmPending
            // from remaining true forever (the pending callback would otherwise never fire and
            // session.Apply() would return DisplayConfirmPending permanently). CompletePending
            // is idempotent-safe (clears state before invoking); RestoreBaselineIfPreviewApplied
            // is one-shot.
            if (_confirmActive)
            {
                RestoreBaselineIfPreviewApplied();
                CompletePending(_pendingCallback, DisplayConfirmResult.RejectedOrTimeout);
            }
            UnsubscribeFocus();
            _disposed = true;
        }

        // -- internals -------------------------------------------------------- //

        /// <summary>
        /// Handles focus loss: exactly one restore + one outcome per active confirmation
        /// (repeated <c>false</c> events are idempotent). A re-focus (true) while pending does
        /// NOT cancel the running timer.
        /// </summary>
        private void OnFocusChanged(bool focused)
        {
            if (focused) return;
            if (!IsActive || _focusLossHandled) return;

            _focusLossHandled = true;
            RestoreBaselineIfPreviewApplied();
            CompletePending(_pendingCallback, DisplayConfirmResult.RejectedOrTimeout);
        }

        /// <summary>
        /// Resolves the candidate to the physical state to apply. Matches the prepared
        /// (already-resolved) state by (width, height, mode) and uses it verbatim — idempotent,
        /// NO second resolve, NO second warning. A mismatch (e.g. RestoreDefaults where no
        /// prepare happened) resolves with the candidate as requested and the current display's
        /// refresh-rate as the default. Consumes the prepared state (one-shot).
        /// </summary>
        private DisplayState ResolveForCandidate(DisplayCandidate candidate)
        {
            FullScreenMode mode = DisplayStateResolver.ToFullScreenMode(candidate.FullscreenMode);

            if (_hasPrepared
                && _prepared.Width == candidate.Width
                && _prepared.Height == candidate.Height
                && _prepared.ScreenMode == mode)
            {
                _hasPrepared = false;
                return _prepared;
            }

            _hasPrepared = false;
            DisplayState current = _displayApi.CurrentState;
            return new DisplayState(
                candidate.Width,
                candidate.Height,
                current.RefreshRateNumerator,
                current.RefreshRateDenominator,
                mode);
        }

        /// <summary>
        /// Restores the pre-preview baseline exactly once when a preview is applied (shared by
        /// Cancel, timeout, focus-loss, and rejection-while-pending). No-op otherwise.
        /// </summary>
        private void RestoreBaselineIfPreviewApplied()
        {
            if (!_previewApplied) return;
            _displayApi.Restore(_baseline);
            _previewApplied = false;
        }

        /// <summary>
        /// Completes a confirmation: clears the pending callback, stops the timer, unsubscribes
        /// focus, and invokes the callback exactly once. Any late event (a stale focus-loss, a
        /// duplicate outcome) is a no-op because <see cref="IsActive"/> is false. Resets
        /// <c>_hasBaseline</c> so the NEXT confirmation captures its OWN pre-preview baseline
        /// (the current display state may have changed between sessions — QA finding R1).
        /// </summary>
        private void CompletePending(Action<DisplayConfirmResult> onResult, DisplayConfirmResult result)
        {
            _confirmActive = false;
            _pendingCallback = null;
            _hasBaseline = false;
            UnsubscribeFocus();
            onResult?.Invoke(result);
        }

        private void SubscribeFocus()
        {
            if (_focusSubscribed) return;
            _focusSource.FocusChanged += OnFocusChanged;
            _focusSubscribed = true;
        }

        private void UnsubscribeFocus()
        {
            if (!_focusSubscribed) return;
            _focusSource.FocusChanged -= OnFocusChanged;
            _focusSubscribed = false;
        }
    }
}
