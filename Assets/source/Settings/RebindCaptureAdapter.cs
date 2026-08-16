using System;
using Overdrive.Input;
using Overdrive.Settings.Core;
using UnityEngine.InputSystem;

namespace Overdrive.Settings
{
    /// <summary>
    /// Unity-backed implementation of <see cref="IRebindCapture"/> over the Input epic's
    /// <see cref="InputBindingCatalog"/>. Validates and applies an already-received candidate path
    /// (the Input System capture-mode API itself is deferred to the UI epic — Out of Scope). Never
    /// enables action maps, routes gameplay actions, or duplicates reserved-binding policy:
    /// InputContextController remains sole owner of those (ADR-0005).
    /// </summary>
    public sealed class RebindCaptureAdapter : IRebindCapture, IDisposable
    {
        private readonly InputBindingCatalog _catalog;
        private readonly InputSystem_Actions _actions;
        private BindingTarget? _activeTarget;
        private CaptureResult? _lastResult;
        private bool _disposed;

        /// <summary>Creates the adapter.</summary>
        /// <param name="catalog">The Input-side binding catalog (slots, classification, override application).</param>
        /// <param name="actions">Optional — the generated actions wrapper. When provided, the adapter
        /// subscribes to the Cancel action (Escape / Gamepad East) and surfaces a press during Listening
        /// as <see cref="CaptureResultKind.Cancelled"/> (AC-C3/ST4). It never enables the action — map
        /// activation remains InputContextController's domain (ADR-0005); the subscription only observes
        /// an already-enabled Cancel action (runtime: UI context active).</param>
        /// <exception cref="ArgumentNullException"><paramref name="catalog"/> is null.</exception>
        public RebindCaptureAdapter(InputBindingCatalog catalog, InputSystem_Actions actions = null)
        {
            _catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
            _actions = actions;
            if (_actions != null)
            {
                _actions.@OverdriveUI.@Cancel.performed += OnCancelPerformed;
            }
            InputSystem.onDeviceChange += OnDeviceChange;
        }

        /// <inheritdoc />
        public event Action<CaptureResult> Captured;

        /// <summary>
        /// Arms listening for a target. Rejected (typed reason) when the binding/action is unknown or the
        /// slot is reserved — Listening never begins and the state machine stays Open.
        /// </summary>
        /// <param name="target">The concrete slot to rebind.</param>
        public CaptureStartResult BeginCapture(BindingTarget target)
        {
            if (!_catalog.HasBinding(target.BindingId))
            {
                return new CaptureStartResult(CaptureStartStatus.Rejected, RejectionReason.UnknownBinding);
            }

            Guid actionId = _catalog.GetActionId(target.BindingId);
            if (actionId == Guid.Empty || actionId != target.ActionId)
            {
                return new CaptureStartResult(CaptureStartStatus.Rejected, RejectionReason.UnknownAction);
            }

            if (IsReservedSlot(target.BindingId))
            {
                return new CaptureStartResult(CaptureStartStatus.Rejected, RejectionReason.Reserved);
            }

            _activeTarget = target;
            _lastResult = null;
            return new CaptureStartResult(CaptureStartStatus.Started);
        }

        /// <summary>
        /// UI-facing candidate entry point: the UI epic delivers the captured control path here after its
        /// own capture-mode API returns. Classifies via the catalog and emits <see cref="Captured"/>.
        /// Single-shot: after the outcome is delivered, the active target is cleared so a stray second
        /// candidate cannot re-apply without a fresh <see cref="BeginCapture"/>.
        /// </summary>
        /// <param name="path">The candidate control path (e.g. "&lt;Keyboard&gt;/w"). Null/empty is rejected as MalformedPath.</param>
        public void SubmitCandidate(string path)
        {
            if (!_activeTarget.HasValue)
            {
                return;
            }

            BindingTarget target = _activeTarget.Value;

            if (string.IsNullOrEmpty(path) || !SchemeMatches(target.Scheme, path))
            {
                Emit(new CaptureResult(CaptureResultKind.Rejected, target, path, reason: RejectionReason.MalformedPath));
                ClearActive();
                return;
            }

            if (IsDuplicateOfCurrent(target.BindingId, path))
            {
                Emit(new CaptureResult(CaptureResultKind.Rejected, target, path, reason: RejectionReason.DuplicateCandidate));
                ClearActive();
                return;
            }

            switch (_catalog.ClassifyCandidate(target.BindingId, path))
            {
                case RemapResult.Captured:
                    _catalog.TryRebind(target.BindingId, path);
                    Emit(new CaptureResult(CaptureResultKind.Captured, target, path));
                    ClearActive();
                    break;

                case RemapResult.Conflict:
                    BindingSlot conflicting = FindConflictingSlot(target.BindingId, path);
                    Emit(new CaptureResult(
                        CaptureResultKind.Conflict,
                        target,
                        path,
                        conflictingActionId: _catalog.GetActionId(conflicting.Id),
                        conflictingBindingId: conflicting.Id));
                    // The conflict stays pending — ConfirmConflict/CancelConflict resolve it.
                    break;

                default:
                    // A rejected candidate is Reserved when the path belongs to a fixed Confirm/Cancel/
                    // Pause binding (AC-C8); otherwise it is malformed/unresolvable.
                    RejectionReason reason = IsReservedPath(path) ? RejectionReason.Reserved : RejectionReason.MalformedPath;
                    Emit(new CaptureResult(CaptureResultKind.Rejected, target, path, reason: reason));
                    ClearActive();
                    break;
            }
        }

        /// <inheritdoc />
        public void EndCapture()
        {
            ClearActive();
        }

        /// <summary>
        /// Applies the pending conflict: clears the old non-critical binding and rebinds the target
        /// (AC-C5). Runtime preview — persistence waits for the session Apply.
        /// </summary>
        public void ConfirmConflict()
        {
            CaptureResult? pending = _lastResult;
            if (!pending.HasValue || pending.Value.Kind != CaptureResultKind.Conflict)
            {
                return;
            }

            if (pending.Value.ConflictingBindingId.HasValue)
            {
                _catalog.RemoveOverride(pending.Value.ConflictingBindingId.Value);
            }

            _catalog.TryRebind(pending.Value.Target.BindingId, pending.Value.CandidatePath);
            ClearActive();
        }

        /// <summary>Rejects the pending conflict — the working binding set (and runtime) are preserved.</summary>
        public void CancelConflict()
        {
            if (!_lastResult.HasValue || _lastResult.Value.Kind != CaptureResultKind.Conflict)
            {
                return;
            }

            ClearActive();
        }

        private void ClearActive()
        {
            _activeTarget = null;
            _lastResult = null;
        }

        private void OnCancelPerformed(InputAction.CallbackContext context)
        {
            // Escape / Gamepad East pressed during Listening cancels the capture (AC-C3/ST4).
            if (!_disposed && _activeTarget.HasValue)
            {
                Emit(new CaptureResult(CaptureResultKind.Cancelled, _activeTarget.Value, string.Empty));
                ClearActive();
            }
        }

        private void OnDeviceChange(InputDevice device, InputDeviceChange change)
        {
            // A device removed while Listening cancels the capture (AC-E11 device loss) — the state
            // machine receives Cancelled(DeviceLost) and returns to Open with no working mutation.
            if (!_disposed && change == InputDeviceChange.Removed && _activeTarget.HasValue)
            {
                Emit(new CaptureResult(CaptureResultKind.Cancelled, _activeTarget.Value, string.Empty, reason: RejectionReason.DeviceLost));
                ClearActive();
            }
        }

        /// <summary>Unsubscribes the device-change listener. Safe to call multiple times.</summary>
        public void Dispose()
        {
            if (!_disposed)
            {
                if (_actions != null)
                {
                    _actions.@OverdriveUI.@Cancel.performed -= OnCancelPerformed;
                }
                InputSystem.onDeviceChange -= OnDeviceChange;
                _disposed = true;
            }
        }

        private void Emit(CaptureResult result)
        {
            _lastResult = result;
            Captured?.Invoke(result);
        }

        private bool IsReservedSlot(Guid bindingId)
        {
            foreach (BindingSlot slot in _catalog.ReservedSlots)
            {
                if (slot.Id == bindingId)
                {
                    return true;
                }
            }

            return false;
        }

        private bool IsReservedPath(string path)
        {
            foreach (BindingSlot slot in _catalog.ReservedSlots)
            {
                if (string.Equals(slot.CurrentPath, path, StringComparison.Ordinal))
                {
                    return true;
                }
            }

            return false;
        }

        private bool IsDuplicateOfCurrent(Guid bindingId, string path)
        {
            foreach (BindingSlot slot in _catalog.RemappableSlots)
            {
                if (slot.Id == bindingId)
                {
                    return string.Equals(slot.CurrentPath, path, StringComparison.Ordinal);
                }
            }

            return false;
        }

        private BindingSlot FindConflictingSlot(Guid exceptBindingId, string path)
        {
            foreach (BindingSlot slot in _catalog.RemappableSlots)
            {
                if (slot.Id == exceptBindingId)
                {
                    continue;
                }

                if (string.Equals(slot.CurrentPath, path, StringComparison.Ordinal))
                {
                    return slot;
                }
            }

            // A non-null sentinel: ClassifyCandidate reported Conflict, so a slot must hold the path.
            // The invariant is enforced during development.
            UnityEngine.Debug.Assert(false, "ClassifyCandidate reported Conflict but no remappable slot holds the path.");
            return default;
        }

        private static bool SchemeMatches(Overdrive.Settings.Core.ControlScheme scheme, string path)
        {
            bool isKeyboardMouse = path.StartsWith("<Keyboard>", StringComparison.Ordinal)
                                   || path.StartsWith("<Mouse>", StringComparison.Ordinal);
            bool isGamepad = path.StartsWith("<Gamepad>", StringComparison.Ordinal);

            switch (scheme)
            {
                case Overdrive.Settings.Core.ControlScheme.KeyboardMouse:
                    return isKeyboardMouse;
                case Overdrive.Settings.Core.ControlScheme.Gamepad:
                    return isGamepad;
                default:
                    return false;
            }
        }
    }
}
