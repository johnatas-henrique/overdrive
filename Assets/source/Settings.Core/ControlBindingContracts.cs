using System;
using System.Collections.Generic;

namespace Overdrive.Settings.Core
{
    /// <summary>
    /// The control scheme a binding slot belongs to. Mirrors <c>Overdrive.Input.ControlScheme</c>
    /// (same two values) so the engine-free core does not depend on the Input assembly; adapters
    /// convert at the boundary. A binding candidate's path prefix must match the target scheme.
    /// </summary>
    public enum ControlScheme
    {
        /// <summary>The keyboard/mouse scheme.</summary>
        KeyboardMouse,

        /// <summary>The gamepad scheme.</summary>
        Gamepad
    }

    /// <summary>The rebind state machine states (GDD settings.md:168-186).</summary>
    public enum ControlBindingState
    {
        /// <summary>No rebind in progress; settings browsable.</summary>
        Open,

        /// <summary>Waiting for a candidate binding (capture is armed).</summary>
        Listening,

        /// <summary>A non-reserved candidate conflicts with an existing non-critical binding; player may override or cancel.</summary>
        BindingConflict
    }

    /// <summary>Outcome of <see cref="IRebindCapture.BeginCapture"/>.</summary>
    public enum CaptureStartStatus
    {
        /// <summary>Listening began; the state machine transitions Open → Listening.</summary>
        Started,

        /// <summary>Listening never began (reserved/unknown/malformed target); <see cref="CaptureStartResult.Reason"/> carries the cause.</summary>
        Rejected
    }

    /// <summary>Outcome of a completed candidate.</summary>
    public enum CaptureResultKind
    {
        /// <summary>Valid non-conflicting candidate — the working binding updates.</summary>
        Captured,

        /// <summary>Candidate conflicts with a non-reserved binding — BindingConflict opens.</summary>
        Conflict,

        /// <summary>Capture cancelled (Escape, Gamepad East, device loss, UI Cancel).</summary>
        Cancelled,

        /// <summary>Candidate rejected (reserved conflict, malformed path, duplicate).</summary>
        Rejected
    }

    /// <summary>
    /// Typed rejection cause. Applies to the CAPTURE path only: <see cref="CaptureStartResult"/> for a
    /// rejected target and <see cref="CaptureResult"/> for a rejected candidate. Persisted-override
    /// issues surface through <see cref="BindingMigrationResult"/> instead.
    /// </summary>
    public enum RejectionReason
    {
        /// <summary>Target or candidate involves a reserved Confirm/Cancel/Pause binding.</summary>
        Reserved,

        /// <summary>Target action id resolves to no known action.</summary>
        UnknownAction,

        /// <summary>Target binding id resolves to no known binding.</summary>
        UnknownBinding,

        /// <summary>Candidate path is malformed, does not resolve to a control, or mismatches the target scheme.</summary>
        MalformedPath,

        /// <summary>Candidate path equals the target slot's current path (no-op rebind).</summary>
        DuplicateCandidate,

        /// <summary>Capture cancelled because a device was lost.</summary>
        DeviceLost,

        /// <summary>A capture is already active — the machine is not Open (re-entry guard).</summary>
        Busy
    }

    /// <summary>
    /// The concrete binding slot selected for rebinding (GDD settings.md:131). Identified by the
    /// Input-owned stable action and binding GUIDs plus the scheme/slot/composite-part context used to
    /// prove the exact slot that changes (AC-C2/C6).
    /// </summary>
    public readonly struct BindingTarget
    {
        /// <summary>Creates a binding target.</summary>
        /// <param name="actionId">Stable Input action GUID (ADR-0004:148).</param>
        /// <param name="bindingId">Stable InputBinding GUID (ADR-0004:149).</param>
        /// <param name="scheme">The scheme the slot belongs to.</param>
        /// <param name="slotIndex">0 = Primary, 1 = Secondary (KeyboardMouse); 0 = only (Gamepad).</param>
        /// <param name="compositePart">Null/empty for a whole binding; "left"/"right" for a Steer 1D-axis composite part.</param>
        public BindingTarget(Guid actionId, Guid bindingId, ControlScheme scheme, int slotIndex, string compositePart)
        {
            ActionId = actionId;
            BindingId = bindingId;
            Scheme = scheme;
            SlotIndex = slotIndex;
            CompositePart = compositePart ?? string.Empty;
        }

        /// <summary>The stable Input action GUID.</summary>
        public Guid ActionId { get; }

        /// <summary>The stable InputBinding GUID.</summary>
        public Guid BindingId { get; }

        /// <summary>The scheme the slot belongs to.</summary>
        public ControlScheme Scheme { get; }

        /// <summary>0 = Primary, 1 = Secondary (KeyboardMouse); 0 = only (Gamepad).</summary>
        public int SlotIndex { get; }

        /// <summary>Null/empty for a whole binding; "left"/"right" for a Steer 1D-axis composite part.</summary>
        public string CompositePart { get; }
    }

    /// <summary>Outcome of <see cref="IRebindCapture.BeginCapture"/>.</summary>
    public readonly struct CaptureStartResult
    {
        /// <summary>Creates the result.</summary>
        /// <param name="status">Started or Rejected.</param>
        /// <param name="reason">Typed cause when rejected.</param>
        public CaptureStartResult(CaptureStartStatus status, RejectionReason? reason = null)
        {
            Status = status;
            Reason = reason;
        }

        /// <summary>Started (Listening armed) or Rejected (Listening never began).</summary>
        public CaptureStartStatus Status { get; }

        /// <summary>Typed cause when Status is Rejected.</summary>
        public RejectionReason? Reason { get; }
    }

    /// <summary>Result of a completed capture candidate, delivered via <see cref="IRebindCapture.Captured"/>.</summary>
    public readonly struct CaptureResult
    {
        /// <summary>Creates the result.</summary>
        /// <param name="kind">Captured / Conflict / Cancelled / Rejected.</param>
        /// <param name="target">The target that began capture.</param>
        /// <param name="candidatePath">The candidate control path (empty when cancelled).</param>
        /// <param name="conflictingActionId">Set when Kind is Conflict.</param>
        /// <param name="conflictingBindingId">Set when Kind is Conflict.</param>
        /// <param name="reason">Typed cause when Kind is Rejected (device loss cancels via Cancelled + DeviceLost).</param>
        public CaptureResult(CaptureResultKind kind, BindingTarget target, string candidatePath, Guid? conflictingActionId = null, Guid? conflictingBindingId = null, RejectionReason? reason = null)
        {
            Kind = kind;
            Target = target;
            CandidatePath = candidatePath ?? string.Empty;
            ConflictingActionId = conflictingActionId;
            ConflictingBindingId = conflictingBindingId;
            Reason = reason;
        }

        /// <summary>The outcome kind.</summary>
        public CaptureResultKind Kind { get; }

        /// <summary>The target that began capture.</summary>
        public BindingTarget Target { get; }

        /// <summary>The candidate control path (empty when cancelled).</summary>
        public string CandidatePath { get; }

        /// <summary>The stable action GUID of the conflicting binding (Conflict).</summary>
        public Guid? ConflictingActionId { get; }

        /// <summary>The stable binding GUID of the conflicting binding (Conflict).</summary>
        public Guid? ConflictingBindingId { get; }

        /// <summary>Typed cause (Rejected; Cancelled with DeviceLost).</summary>
        public RejectionReason? Reason { get; }
    }

    /// <summary>
    /// Result of mapping persisted overrides against the Input catalog (AC-C12/AC-E4). The returned
    /// value IS the non-blocking typed notice: preserved overrides stay active, restored slots fall
    /// back to defaults, and typed issues identify why.
    /// </summary>
    public readonly struct BindingMigrationResult
    {
        /// <summary>Creates the result.</summary>
        /// <param name="preservedOverrides">Every override that was applied.</param>
        /// <param name="restoredBindingIds">Slots reset to default (unknown/malformed/reserved-conflicting/cap-violated).</param>
        /// <param name="unknownBindingIds">Restored because the binding id matched no current binding (an unknown id subsumes unknown action).</param>
        /// <param name="malformedPaths">Restored because the path was malformed, reserved-conflicting, or at the override cap.</param>
        public BindingMigrationResult(IReadOnlyList<BindingOverrideData> preservedOverrides, IReadOnlyList<Guid> restoredBindingIds, IReadOnlyList<Guid> unknownBindingIds, IReadOnlyList<string> malformedPaths)
        {
            PreservedOverrides = preservedOverrides ?? Array.Empty<BindingOverrideData>();
            RestoredBindingIds = restoredBindingIds ?? Array.Empty<Guid>();
            UnknownBindingIds = unknownBindingIds ?? Array.Empty<Guid>();
            MalformedPaths = malformedPaths ?? Array.Empty<string>();
        }

        /// <summary>Every override that was applied and remains active.</summary>
        public IReadOnlyList<BindingOverrideData> PreservedOverrides { get; }

        /// <summary>Slots reset to default (union of unknown and malformed).</summary>
        public IReadOnlyList<Guid> RestoredBindingIds { get; }

        /// <summary>Restored because the binding id matched no current binding.</summary>
        public IReadOnlyList<Guid> UnknownBindingIds { get; }

        /// <summary>Restored because the path was malformed, reserved-conflicting, or at the override cap.</summary>
        public IReadOnlyList<string> MalformedPaths { get; }
    }

    /// <summary>
    /// Settings-owned capture port (ADR-0005 separation: Input owns the binding catalog and
    /// reservation policy; Settings owns the rebind session lifecycle and capture state machine).
    /// The port validates and applies an already-received candidate path via the Input catalog — it
    /// never enables action maps, routes gameplay actions, or duplicates reserved-binding policy
    /// (InputContextController remains sole owner of those).
    /// </summary>
    public interface IRebindCapture
    {
        /// <summary>
        /// Arms listening for a target. Started begins Listening; Rejected when the target is reserved,
        /// unknown, or malformed — Listening never begins. The candidate path is delivered later via
        /// <see cref="Captured"/> (the concrete adapter exposes the UI-facing candidate entry point).
        /// </summary>
        CaptureStartResult BeginCapture(BindingTarget target);

        /// <summary>Cancels active listening (Escape, Gamepad East, device loss). No working mutation.</summary>
        void EndCapture();

        /// <summary>AC-C5: accept the pending conflict — the old non-critical binding is cleared and the new override applies.</summary>
        void ConfirmConflict();

        /// <summary>AC-ST6: reject the pending conflict — the working binding set is preserved.</summary>
        void CancelConflict();

        /// <summary>Raised once per completed candidate with the capture outcome.</summary>
        event Action<CaptureResult> Captured;
    }

    /// <summary>
    /// Read-only active-scheme probe (AC-E11). Settings never mutates the probe; scheme arbitration on
    /// device reconnect remains InputContextController's domain (ADR-0005). The state machine exposes
    /// the value so tests can assert Settings did not change it.
    /// </summary>
    public interface ISchemeProbe
    {
        /// <summary>The currently active control scheme.</summary>
        ControlScheme ActiveScheme { get; }
    }
}
