using System;
using System.Collections.Generic;
using NUnit.Framework;
using Overdrive.Settings.Core;

namespace Overdrive.Settings.Core.Tests
{
    /// <summary>
    /// Unit tests for the engine-free rebinding state machine (Story 004). The capture port is a fake
    /// emitting CaptureResult events; the scheme probe is a fake. No Unity/Input references.
    /// </summary>
    public class ControlBindingTests
    {
        private static readonly Guid AccelAction = Guid.Parse("11111111-1111-1111-1111-111111111111");
        private static readonly Guid AccelPrimary = Guid.Parse("22222222-2222-2222-2222-222222222222");
        private static readonly Guid SteerLeftPrimary = Guid.Parse("33333333-3333-3333-3333-333333333333");
        private static readonly Guid SteerLeftSecondary = Guid.Parse("44444444-4444-4444-4444-444444444444");

        private FakeCapture _capture;
        private FakeProbe _probe;
        private ControlBindingStateMachine _machine;

        [SetUp]
        public void SetUp()
        {
            _capture = new FakeCapture();
            _probe = new FakeProbe();
            _machine = new ControlBindingStateMachine(_capture, _probe, Array.Empty<BindingOverrideData>());
        }

        [TearDown]
        public void TearDown()
        {
            _machine?.Dispose();
        }

        private static BindingTarget Target(Guid actionId, Guid bindingId, ControlScheme scheme = ControlScheme.KeyboardMouse, int slot = 0, string part = "")
        {
            return new BindingTarget(actionId, bindingId, scheme, slot, part);
        }

        [Test]
        public void AC_C1_BeginListening_Started_TransitionsToListening()
        {
            CaptureStartResult result = _machine.BeginListening(Target(AccelAction, AccelPrimary));

            Assert.That(result.Status, Is.EqualTo(CaptureStartStatus.Started));
            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Listening));
            Assert.That(_machine.PendingTarget.HasValue, Is.True);
            Assert.That(_machine.PendingTarget.Value.BindingId, Is.EqualTo(AccelPrimary));
            Assert.That(_capture.BeginCalls, Is.EqualTo(1));
        }

        [Test]
        public void AC_C8_BeginListening_PortRejected_StaysOpen()
        {
            _capture.BeginResult = new CaptureStartResult(CaptureStartStatus.Rejected, RejectionReason.Reserved);

            CaptureStartResult result = _machine.BeginListening(Target(AccelAction, AccelPrimary));

            Assert.That(result.Status, Is.EqualTo(CaptureStartStatus.Rejected));
            Assert.That(result.Reason, Is.EqualTo(RejectionReason.Reserved));
            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Open));
            Assert.That(_machine.PendingTarget.HasValue, Is.False);
        }

        [Test]
        public void AC_C9_ListeningNeverBegins_OnRejectedTarget()
        {
            _capture.BeginResult = new CaptureStartResult(CaptureStartStatus.Rejected, RejectionReason.UnknownBinding);

            _machine.BeginListening(Target(AccelAction, AccelPrimary));

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Open));
            Assert.That(_capture.EndCalls, Is.Zero);
        }

        [Test]
        public void BeginListening_WhileListening_RejectedWithoutRacing()
        {
            _machine.BeginListening(Target(AccelAction, AccelPrimary));

            CaptureStartResult result = _machine.BeginListening(Target(AccelAction, SteerLeftPrimary));

            Assert.That(result.Status, Is.EqualTo(CaptureStartStatus.Rejected));
            Assert.That(result.Reason, Is.EqualTo(RejectionReason.Busy), "Re-entry is rejected with a Busy reason, not Reserved.");
            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Listening));
            Assert.That(_machine.PendingTarget.Value.BindingId, Is.EqualTo(AccelPrimary));
        }

        [Test]
        public void AC_C2_Captured_UpdatesWorkingAndReturnsOpen()
        {
            _machine.BeginListening(Target(AccelAction, AccelPrimary));

            _capture.Emit(new CaptureResult(CaptureResultKind.Captured, Target(AccelAction, AccelPrimary), "<Keyboard>/w"));

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Open));
            Assert.That(_machine.PendingTarget.HasValue, Is.False);
            IReadOnlyList<BindingOverrideData> working = _machine.GetWorkingOverrides();
            Assert.That(working.Count, Is.EqualTo(1));
            Assert.That(working[0].BindingId, Is.EqualTo(AccelPrimary));
            Assert.That(working[0].Path, Is.EqualTo("<Keyboard>/w"));
        }

        [Test]
        public void AC_C6_OnlyTargetSlotChanges_AgainstBaseline()
        {
            var initial = new[]
            {
                new BindingOverrideData(SteerLeftPrimary, "<Keyboard>/a"),
                new BindingOverrideData(SteerLeftSecondary, "<Keyboard>/d"),
            };
            _machine = new ControlBindingStateMachine(_capture, _probe, initial);

            _machine.BeginListening(Target(AccelAction, AccelPrimary, slot: 0));
            _capture.Emit(new CaptureResult(CaptureResultKind.Captured, Target(AccelAction, AccelPrimary, slot: 0), "<Keyboard>/w"));

            IReadOnlyList<BindingOverrideData> baseline = _machine.GetBaselineOverrides();
            IReadOnlyList<BindingOverrideData> working = _machine.GetWorkingOverrides();

            Assert.That(working.Count, Is.EqualTo(initial.Length + 1));
            int changedSlots = CountDiff(baseline, working);
            Assert.That(changedSlots, Is.EqualTo(1));
            Assert.That(working, Has.Exactly(1).Matches<BindingOverrideData>(o => o.BindingId == AccelPrimary && o.Path == "<Keyboard>/w"));
        }

        [Test]
        public void AC_C3_CancelListening_PreservesWorking()
        {
            _machine.BeginListening(Target(AccelAction, AccelPrimary));

            _machine.CancelListening();

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Open));
            Assert.That(_machine.GetWorkingOverrides().Count, Is.Zero);
            Assert.That(_capture.EndCalls, Is.EqualTo(1));
        }

        [Test]
        public void AC_ST4_CancelledResult_ReturnsOpen_NoMutation()
        {
            _machine.BeginListening(Target(AccelAction, AccelPrimary));

            _capture.Emit(new CaptureResult(CaptureResultKind.Cancelled, Target(AccelAction, AccelPrimary), string.Empty));

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Open));
            Assert.That(_machine.PendingTarget.HasValue, Is.False);
            Assert.That(_machine.GetWorkingOverrides().Count, Is.Zero);
        }

        [Test]
        public void AC_ST4_Cancelled_DeviceLoss_ReturnsOpen_NoMutation()
        {
            _machine.BeginListening(Target(AccelAction, AccelPrimary));

            _capture.Emit(new CaptureResult(CaptureResultKind.Cancelled, Target(AccelAction, AccelPrimary), string.Empty, reason: RejectionReason.DeviceLost));

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Open));
            Assert.That(_machine.PendingTarget.HasValue, Is.False);
            Assert.That(_machine.GetWorkingOverrides().Count, Is.Zero);
        }

        [Test]
        public void Captured_WhileOpen_IsIgnored_NoMutation()
        {
            // A stale capture event arriving while Open (no listening session) must not mutate the working set.
            _capture.Emit(new CaptureResult(CaptureResultKind.Captured, Target(AccelAction, AccelPrimary), "<Keyboard>/w"));

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Open));
            Assert.That(_machine.GetWorkingOverrides().Count, Is.Zero);
        }

        [Test]
        public void Conflict_WhileOpen_IsIgnored()
        {
            _capture.Emit(new CaptureResult(
                CaptureResultKind.Conflict,
                Target(AccelAction, AccelPrimary),
                "<Keyboard>/a",
                conflictingActionId: AccelAction,
                conflictingBindingId: SteerLeftPrimary));

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Open));
            Assert.That(_machine.PendingConflict.HasValue, Is.False);
        }

        [Test]
        public void MultipleConflicts_LastWins_ConfirmResolvesLatest()
        {
            _machine.BeginListening(Target(AccelAction, AccelPrimary));
            _capture.Emit(new CaptureResult(
                CaptureResultKind.Conflict,
                Target(AccelAction, AccelPrimary),
                "<Keyboard>/a",
                conflictingActionId: AccelAction,
                conflictingBindingId: SteerLeftPrimary));
            _capture.Emit(new CaptureResult(
                CaptureResultKind.Conflict,
                Target(AccelAction, AccelPrimary),
                "<Keyboard>/b",
                conflictingActionId: AccelAction,
                conflictingBindingId: SteerLeftSecondary));

            Assert.That(_machine.PendingConflict.Value.ConflictingBindingId, Is.EqualTo(SteerLeftSecondary));

            _machine.ConfirmConflict();

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Open));
            Assert.That(_machine.PendingConflict.HasValue, Is.False);
            IReadOnlyList<BindingOverrideData> working = _machine.GetWorkingOverrides();
            Assert.That(working, Has.Exactly(1).Matches<BindingOverrideData>(o => o.BindingId == AccelPrimary && o.Path == "<Keyboard>/b"));
            Assert.That(working, Has.None.Matches<BindingOverrideData>(o => o.BindingId == SteerLeftSecondary));
        }

        [Test]
        public void AC_C6_SecondarySlot_RebindProvesSlotIndexAndPart()
        {
            var initial = new[] { new BindingOverrideData(SteerLeftPrimary, "<Keyboard>/a") };
            _machine = new ControlBindingStateMachine(_capture, _probe, initial);

            // Rebind the SECONDARY steer-left slot (SlotIndex 1, composite part "left") — the diff must
            // show exactly that slot changed and the primary is untouched (AC-C2/C6 slot identity).
            _machine.BeginListening(Target(AccelAction, SteerLeftSecondary, slot: 1, part: "left"));
            _capture.Emit(new CaptureResult(CaptureResultKind.Captured, Target(AccelAction, SteerLeftSecondary, slot: 1, part: "left"), "<Keyboard>/z"));

            IReadOnlyList<BindingOverrideData> baseline = _machine.GetBaselineOverrides();
            IReadOnlyList<BindingOverrideData> working = _machine.GetWorkingOverrides();

            Assert.That(CountDiff(baseline, working), Is.EqualTo(1));
            Assert.That(working, Has.Exactly(1).Matches<BindingOverrideData>(o => o.BindingId == SteerLeftSecondary && o.Path == "<Keyboard>/z"));
            Assert.That(working, Has.Exactly(1).Matches<BindingOverrideData>(o => o.BindingId == SteerLeftPrimary && o.Path == "<Keyboard>/a"), "The primary slot is untouched.");
        }

        [Test]
        public void AC_C4_Conflict_OpensBindingConflict_WithConflictingAction()
        {
            _machine.BeginListening(Target(AccelAction, AccelPrimary));

            _capture.Emit(new CaptureResult(
                CaptureResultKind.Conflict,
                Target(AccelAction, AccelPrimary),
                "<Keyboard>/a",
                conflictingActionId: AccelAction,
                conflictingBindingId: SteerLeftPrimary));

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.BindingConflict));
            Assert.That(_machine.PendingConflict.HasValue, Is.True);
            Assert.That(_machine.PendingConflict.Value.ConflictingActionId, Is.EqualTo(AccelAction));
            Assert.That(_machine.PendingConflict.Value.ConflictingBindingId, Is.EqualTo(SteerLeftPrimary));
        }

        [Test]
        public void AC_C5_ConfirmConflict_ClearsOldAndAppliesNew()
        {
            _machine.BeginListening(Target(AccelAction, AccelPrimary));
            _capture.Emit(new CaptureResult(
                CaptureResultKind.Conflict,
                Target(AccelAction, AccelPrimary),
                "<Keyboard>/a",
                conflictingActionId: AccelAction,
                conflictingBindingId: SteerLeftPrimary));

            _machine.ConfirmConflict();

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Open));
            Assert.That(_machine.PendingConflict.HasValue, Is.False);
            Assert.That(_capture.ConfirmCalls, Is.EqualTo(1));
            IReadOnlyList<BindingOverrideData> working = _machine.GetWorkingOverrides();
            Assert.That(working, Has.Exactly(1).Matches<BindingOverrideData>(o => o.BindingId == AccelPrimary && o.Path == "<Keyboard>/a"));
            Assert.That(working, Has.None.Matches<BindingOverrideData>(o => o.BindingId == SteerLeftPrimary));
        }

        [Test]
        public void CancelListening_DuringConflict_RejectsConflict()
        {
            var initial = new[] { new BindingOverrideData(SteerLeftPrimary, "<Keyboard>/a") };
            _machine = new ControlBindingStateMachine(_capture, _probe, initial);
            _machine.BeginListening(Target(AccelAction, AccelPrimary));
            _capture.Emit(new CaptureResult(
                CaptureResultKind.Conflict,
                Target(AccelAction, AccelPrimary),
                "<Keyboard>/a",
                conflictingActionId: AccelAction,
                conflictingBindingId: SteerLeftPrimary));

            _machine.CancelListening();

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Open));
            Assert.That(_machine.PendingConflict.HasValue, Is.False);
            Assert.That(_capture.CancelCalls, Is.EqualTo(1), "Escape during BindingConflict rejects the conflict — no desync.");
            IReadOnlyList<BindingOverrideData> working = _machine.GetWorkingOverrides();
            Assert.That(working, Has.Exactly(1).Matches<BindingOverrideData>(o => o.BindingId == SteerLeftPrimary && o.Path == "<Keyboard>/a"));
        }

        [Test]
        public void Captured_ForDifferentTarget_IsIgnored()
        {
            _machine.BeginListening(Target(AccelAction, AccelPrimary));

            _capture.Emit(new CaptureResult(CaptureResultKind.Captured, Target(AccelAction, SteerLeftPrimary), "<Keyboard>/a"));

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Listening), "A wrong-target event must not resolve the session.");
            Assert.That(_machine.GetWorkingOverrides().Count, Is.Zero);
        }

        [Test]
        public void Captured_SameBindingDifferentScheme_IsIgnored()
        {
            // The target match is full (action + binding + scheme + slot + part) — same BindingId but a
            // different scheme is a DIFFERENT slot and must be ignored.
            _machine.BeginListening(Target(AccelAction, AccelPrimary, ControlScheme.KeyboardMouse, 0, string.Empty));

            _capture.Emit(new CaptureResult(
                CaptureResultKind.Captured,
                Target(AccelAction, AccelPrimary, ControlScheme.Gamepad, 0, string.Empty),
                "<Gamepad>/buttonWest"));

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Listening));
            Assert.That(_machine.GetWorkingOverrides().Count, Is.Zero);
        }

        [Test]
        public void Captured_SameBindingDifferentSlotIndex_IsIgnored()
        {
            // Same BindingId + scheme but a different SlotIndex is a different slot (primary vs secondary).
            _machine.BeginListening(Target(AccelAction, AccelPrimary, ControlScheme.KeyboardMouse, 0, string.Empty));

            _capture.Emit(new CaptureResult(
                CaptureResultKind.Captured,
                Target(AccelAction, AccelPrimary, ControlScheme.KeyboardMouse, 1, string.Empty),
                "<Keyboard>/w"));

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Listening));
            Assert.That(_machine.GetWorkingOverrides().Count, Is.Zero);
        }

        [Test]
        public void Captured_SameBindingDifferentCompositePart_IsIgnored()
        {
            // Same BindingId + scheme + slot but a different composite part (left vs right) is a
            // different slot — ignored.
            _machine.BeginListening(Target(AccelAction, AccelPrimary, ControlScheme.KeyboardMouse, 0, "left"));

            _capture.Emit(new CaptureResult(
                CaptureResultKind.Captured,
                Target(AccelAction, AccelPrimary, ControlScheme.KeyboardMouse, 0, "right"),
                "<Keyboard>/w"));

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Listening));
            Assert.That(_machine.GetWorkingOverrides().Count, Is.Zero);
        }

        [Test]
        public void AC_ST6_CancelConflict_PreservesWorking()
        {
            var initial = new[] { new BindingOverrideData(SteerLeftPrimary, "<Keyboard>/a") };
            _machine = new ControlBindingStateMachine(_capture, _probe, initial);
            _machine.BeginListening(Target(AccelAction, AccelPrimary));
            _capture.Emit(new CaptureResult(
                CaptureResultKind.Conflict,
                Target(AccelAction, AccelPrimary),
                "<Keyboard>/a",
                conflictingActionId: AccelAction,
                conflictingBindingId: SteerLeftPrimary));

            _machine.CancelConflict();

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Open));
            Assert.That(_machine.PendingConflict.HasValue, Is.False);
            Assert.That(_capture.CancelCalls, Is.EqualTo(1));
            IReadOnlyList<BindingOverrideData> working = _machine.GetWorkingOverrides();
            Assert.That(working, Has.Exactly(1).Matches<BindingOverrideData>(o => o.BindingId == SteerLeftPrimary && o.Path == "<Keyboard>/a"));
            Assert.That(working, Has.None.Matches<BindingOverrideData>(o => o.BindingId == AccelPrimary));
        }

        [Test]
        public void AC_E11_ActiveScheme_ReadsProbe_UnchangedBySettings()
        {
            _probe.ActiveScheme = ControlScheme.Gamepad;

            Assert.That(_machine.ActiveScheme, Is.EqualTo(ControlScheme.Gamepad));

            _machine.BeginListening(Target(AccelAction, AccelPrimary));
            _capture.Emit(new CaptureResult(CaptureResultKind.Captured, Target(AccelAction, AccelPrimary), "<Gamepad>/buttonSouth"));

            Assert.That(_machine.ActiveScheme, Is.EqualTo(ControlScheme.Gamepad));
        }

        [Test]
        public void AC_ST3_RejectedResult_ReturnsOpen()
        {
            _machine.BeginListening(Target(AccelAction, AccelPrimary));

            _capture.Emit(new CaptureResult(CaptureResultKind.Rejected, Target(AccelAction, AccelPrimary), "<Keyboard>/w", reason: RejectionReason.MalformedPath));

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Open));
            Assert.That(_machine.PendingTarget.HasValue, Is.False);
            Assert.That(_machine.GetWorkingOverrides().Count, Is.Zero);
        }

        [Test]
        public void GetWorkingOverrides_DefensiveSnapshot()
        {
            _machine.BeginListening(Target(AccelAction, AccelPrimary));
            _capture.Emit(new CaptureResult(CaptureResultKind.Captured, Target(AccelAction, AccelPrimary), "<Keyboard>/w"));

            IReadOnlyList<BindingOverrideData> snapshot = _machine.GetWorkingOverrides();

            Assert.That(snapshot, Is.Not.SameAs(_machine.GetWorkingOverrides()));
        }

        [Test]
        public void ConfirmConflict_WithoutConflict_IsNoOp()
        {
            _machine.ConfirmConflict();

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Open));
            Assert.That(_capture.ConfirmCalls, Is.Zero);
        }

        [Test]
        public void CancelListening_WhileOpen_IsNoOp()
        {
            _machine.CancelListening();

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Open));
            Assert.That(_capture.EndCalls, Is.Zero);
        }

        [Test]
        public void Dispose_UnsubscribesCapture()
        {
            _machine.BeginListening(Target(AccelAction, AccelPrimary));

            _machine.Dispose();
            _capture.Emit(new CaptureResult(CaptureResultKind.Captured, Target(AccelAction, AccelPrimary), "<Keyboard>/w"));

            Assert.That(_machine.State, Is.EqualTo(ControlBindingState.Listening));
        }

        [Test]
        public void Captured_OverwritesExistingOverrideForSlot()
        {
            var initial = new[] { new BindingOverrideData(AccelPrimary, "<Keyboard>/old") };
            _machine = new ControlBindingStateMachine(_capture, _probe, initial);

            _machine.BeginListening(Target(AccelAction, AccelPrimary));
            _capture.Emit(new CaptureResult(CaptureResultKind.Captured, Target(AccelAction, AccelPrimary), "<Keyboard>/w"));

            IReadOnlyList<BindingOverrideData> working = _machine.GetWorkingOverrides();
            Assert.That(working.Count, Is.EqualTo(1));
            Assert.That(working[0].Path, Is.EqualTo("<Keyboard>/w"));
        }

        [Test]
        public void MultipleRebinds_DiffAgainstBaseline_CountsEachChange()
        {
            _machine.BeginListening(Target(AccelAction, AccelPrimary));
            _capture.Emit(new CaptureResult(CaptureResultKind.Captured, Target(AccelAction, AccelPrimary), "<Keyboard>/w"));
            _machine.BeginListening(Target(AccelAction, SteerLeftPrimary));
            _capture.Emit(new CaptureResult(CaptureResultKind.Captured, Target(AccelAction, SteerLeftPrimary), "<Keyboard>/a"));

            Assert.That(CountDiff(_machine.GetBaselineOverrides(), _machine.GetWorkingOverrides()), Is.EqualTo(2));
        }

        private static int CountDiff(IReadOnlyList<BindingOverrideData> a, IReadOnlyList<BindingOverrideData> b)
        {
            var mapA = new Dictionary<Guid, string>();
            var mapB = new Dictionary<Guid, string>();
            foreach (BindingOverrideData o in a) mapA[o.BindingId] = o.Path;
            foreach (BindingOverrideData o in b) mapB[o.BindingId] = o.Path;

            int diff = 0;
            foreach (KeyValuePair<Guid, string> pair in mapA)
            {
                if (!mapB.TryGetValue(pair.Key, out string pathB) || pathB != pair.Value) diff++;
            }

            foreach (KeyValuePair<Guid, string> pair in mapB)
            {
                if (!mapA.ContainsKey(pair.Key)) diff++;
            }

            return diff;
        }

        private sealed class FakeCapture : IRebindCapture
        {
            public CaptureStartResult BeginResult = new CaptureStartResult(CaptureStartStatus.Started);
            public int BeginCalls;
            public int EndCalls;
            public int ConfirmCalls;
            public int CancelCalls;

            public event Action<CaptureResult> Captured;

            public CaptureStartResult BeginCapture(BindingTarget target)
            {
                BeginCalls++;
                return BeginResult;
            }

            public void EndCapture() => EndCalls++;

            public void ConfirmConflict() => ConfirmCalls++;

            public void CancelConflict() => CancelCalls++;

            public void Emit(CaptureResult result) => Captured?.Invoke(result);
        }

        private sealed class FakeProbe : ISchemeProbe
        {
            public ControlScheme ActiveScheme { get; set; } = ControlScheme.KeyboardMouse;
        }
    }
}
