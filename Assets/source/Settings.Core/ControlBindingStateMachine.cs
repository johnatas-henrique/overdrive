using System;
using System.Collections.Generic;

namespace Overdrive.Settings.Core
{
    /// <summary>
    /// The engine-free rebinding state machine (GDD settings.md:168-197): Open → Listening →
    /// (Captured→Open | Rejected→Open | Conflict→BindingConflict) → (Override→Open | Cancel→Open).
    /// Owns the transactional working override-set (diff vs the pre-session baseline) and the state
    /// transitions; UI presentation and the Input System capture-mode API are owned elsewhere.
    /// </summary>
    public sealed class ControlBindingStateMachine : IDisposable
    {
        private readonly IRebindCapture _capture;
        private readonly ISchemeProbe _schemeProbe;
        private readonly List<BindingOverrideData> _working;
        private readonly IReadOnlyList<BindingOverrideData> _baseline;
        private CaptureResult? _pendingConflict;
        private bool _disposed;

        /// <summary>Creates the state machine and subscribes to capture results.</summary>
        /// <param name="capture">The capture port (tests inject a fake; production uses the Input-catalog-backed adapter).</param>
        /// <param name="schemeProbe">Read-only active-scheme probe (AC-E11).</param>
        /// <param name="initialWorking">The full persisted override-set at session start; the baseline for AC-C6 diffs.</param>
        /// <exception cref="ArgumentNullException">Any argument is null.</exception>
        public ControlBindingStateMachine(IRebindCapture capture, ISchemeProbe schemeProbe, IReadOnlyList<BindingOverrideData> initialWorking)
        {
            _capture = capture ?? throw new ArgumentNullException(nameof(capture));
            _schemeProbe = schemeProbe ?? throw new ArgumentNullException(nameof(schemeProbe));
            _working = new List<BindingOverrideData>(initialWorking ?? throw new ArgumentNullException(nameof(initialWorking)));
            _baseline = new List<BindingOverrideData>(_working);
            _capture.Captured += OnCaptured;
        }

        /// <summary>The current rebind state.</summary>
        public ControlBindingState State { get; private set; } = ControlBindingState.Open;

        /// <summary>The target being rebound while Listening (drives the "Press a key..." prompt).</summary>
        public BindingTarget? PendingTarget { get; private set; }

        /// <summary>The pending conflict in BindingConflict (exposes ConflictingActionId for "This key is bound to [action]").</summary>
        public CaptureResult? PendingConflict => _pendingConflict;

        /// <summary>The active scheme read through the probe (Settings never mutates it — AC-E11).</summary>
        public ControlScheme ActiveScheme => _schemeProbe.ActiveScheme;

        /// <summary>
        /// Begins listening for a rebind. Rejected (with a typed reason) when the target is reserved or
        /// the capture port refuses; otherwise transitions to Listening.
        /// </summary>
        /// <param name="target">The concrete slot to rebind.</param>
        /// <returns>Started or Rejected with the typed cause.</returns>
        public CaptureStartResult BeginListening(BindingTarget target)
        {
            if (State != ControlBindingState.Open)
            {
                return new CaptureStartResult(CaptureStartStatus.Rejected, RejectionReason.Busy);
            }

            CaptureStartResult result = _capture.BeginCapture(target);
            if (result.Status != CaptureStartStatus.Started)
            {
                return result;
            }

            State = ControlBindingState.Listening;
            PendingTarget = target;
            _pendingConflict = null;
            return result;
        }

        /// <summary>
        /// Programmatic cancel (device loss, UI Cancel; the adapter surfaces Escape/Gamepad East as
        /// Cancelled via the event). In Listening this ends capture and returns to Open; in BindingConflict
        /// Escape rejects the conflict (AC-ST6) so the session cannot desync with a stale pending conflict.
        /// </summary>
        public void CancelListening()
        {
            if (State == ControlBindingState.Listening)
            {
                _capture.EndCapture();
                ReturnToOpen();
            }
            else if (State == ControlBindingState.BindingConflict)
            {
                CancelConflict();
            }
        }

        /// <summary>AC-C5/AC-ST5: accept the pending conflict — the old non-critical binding clears, the new override applies, back to Open.</summary>
        public void ConfirmConflict()
        {
            if (State != ControlBindingState.BindingConflict)
            {
                return;
            }

            _capture.ConfirmConflict();

            CaptureResult? conflict = _pendingConflict;
            if (conflict.HasValue && conflict.Value.ConflictingBindingId.HasValue)
            {
                RemoveOverride(conflict.Value.ConflictingBindingId.Value);
            }

            if (conflict.HasValue)
            {
                UpsertOverride(conflict.Value.Target.BindingId, conflict.Value.CandidatePath);
            }

            ReturnToOpen();
        }

        /// <summary>AC-ST6: reject the pending conflict — the working binding set is preserved, back to Open.</summary>
        public void CancelConflict()
        {
            if (State != ControlBindingState.BindingConflict)
            {
                return;
            }

            _capture.CancelConflict();
            ReturnToOpen();
        }

        /// <summary>
        /// The FULL working override-set. AC-C6 verifies it differs from the pre-session baseline by
        /// exactly the changed slot(s) — compare against the baseline captured at construction.
        /// </summary>
        /// <returns>A defensive snapshot of the working overrides.</returns>
        public IReadOnlyList<BindingOverrideData> GetWorkingOverrides()
        {
            return new List<BindingOverrideData>(_working);
        }

        /// <summary>
        /// The override-set as it was when the session began. Diffs against
        /// <see cref="GetWorkingOverrides"/> prove exactly which slots changed (AC-C6).
        /// </summary>
        /// <returns>A defensive snapshot of the baseline.</returns>
        public IReadOnlyList<BindingOverrideData> GetBaselineOverrides()
        {
            return new List<BindingOverrideData>(_baseline);
        }

        private void OnCaptured(CaptureResult result)
        {
            // Defensive: only an event for the currently-armed session is consumed. A stale or stray
            // event arriving while Open (e.g. a late gate outcome) — or one targeting a DIFFERENT slot
            // than the pending one — must not mutate the session.
            bool matchesPending = PendingTarget.HasValue && SameTarget(result.Target, PendingTarget.Value);
            if (State == ControlBindingState.Listening && matchesPending)
            {
                switch (result.Kind)
                {
                    case CaptureResultKind.Captured:
                        UpsertOverride(result.Target.BindingId, result.CandidatePath);
                        ReturnToOpen();
                        break;

                    case CaptureResultKind.Conflict:
                        _pendingConflict = result;
                        State = ControlBindingState.BindingConflict;
                        break;

                    case CaptureResultKind.Rejected:
                    case CaptureResultKind.Cancelled:
                        ReturnToOpen();
                        break;
                }
            }
            else if (State == ControlBindingState.BindingConflict && result.Kind == CaptureResultKind.Conflict && matchesPending)
            {
                _pendingConflict = result;
            }
        }

        private void UpsertOverride(Guid bindingId, string path)
        {
            for (int i = 0; i < _working.Count; i++)
            {
                if (_working[i].BindingId == bindingId)
                {
                    _working[i] = new BindingOverrideData(bindingId, path);
                    return;
                }
            }

            _working.Add(new BindingOverrideData(bindingId, path));
        }

        private void RemoveOverride(Guid bindingId)
        {
            for (int i = 0; i < _working.Count; i++)
            {
                if (_working[i].BindingId == bindingId)
                {
                    _working.RemoveAt(i);
                    return;
                }
            }
        }

        private static bool SameTarget(BindingTarget a, BindingTarget b)
        {
            return a.ActionId == b.ActionId
                   && a.BindingId == b.BindingId
                   && a.Scheme == b.Scheme
                   && a.SlotIndex == b.SlotIndex
                   && string.Equals(a.CompositePart, b.CompositePart, StringComparison.Ordinal);
        }

        private void ReturnToOpen()
        {
            State = ControlBindingState.Open;
            PendingTarget = null;
            _pendingConflict = null;
        }

        /// <summary>Releases the capture subscription. Safe to call multiple times.</summary>
        public void Dispose()
        {
            if (!_disposed)
            {
                _capture.Captured -= OnCaptured;
                _disposed = true;
            }
        }
    }
}
