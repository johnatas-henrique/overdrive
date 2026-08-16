using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using Overdrive.Input;
using Overdrive.Settings.Core;
using CoreControlScheme = Overdrive.Settings.Core.ControlScheme;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.Controls;
using UnityEngine.InputSystem.UI;

namespace Overdrive.Settings.Tests
{
    /// <summary>
    /// Integration evidence for Story 004 (Control Bindings &amp; Rebinding State Machine): the
    /// Input-catalog-backed capture adapter, the scheme probe over InputContextController, the
    /// persisted-override mapper (AC-C12/E4), and the Settings-side consumption of the existing
    /// SettingsInputPreviewEvaluator (AC-C10/C11 — no re-implementation).
    /// </summary>
    [TestFixture]
    public sealed class ControlBindingIntegrationTests : InputTestFixture
    {
        private InputSystem_Actions _actions;
        private InputBindingCatalog _catalog;
        private InputContextController _controller;
        private GameObject _eventSystemObject;
        private Gamepad _gamepad;

        [SetUp]
        public void SetUp()
        {
            InputSystem.AddDevice<Keyboard>();
            _gamepad = InputSystem.AddDevice<Gamepad>();
            _actions = new InputSystem_Actions();
            _catalog = new InputBindingCatalog(_actions.asset);

            _eventSystemObject = new GameObject("EventSystem");
            _eventSystemObject.AddComponent<EventSystem>();
            InputSystemUIInputModule uiModule = _eventSystemObject.AddComponent<InputSystemUIInputModule>();
            uiModule.enabled = false;
            _controller = new InputContextController(_actions, uiModule);
        }

        [TearDown]
        public void TearDown()
        {
            _controller?.Unbind();
            _actions?.Dispose();
            if (_eventSystemObject != null)
            {
                UnityEngine.Object.DestroyImmediate(_eventSystemObject);
            }
        }

        // ---- helpers ----

        private BindingSlot Slot(string actionName)
        {
            return _catalog.RemappableSlots.First(s => s.ActionName == actionName);
        }

        private BindingTarget TargetFor(BindingSlot slot, Overdrive.Settings.Core.ControlScheme scheme = Overdrive.Settings.Core.ControlScheme.KeyboardMouse, int slotIndex = 0, string part = "")
        {
            return new BindingTarget(_catalog.GetActionId(slot.Id), slot.Id, scheme, slotIndex, part);
        }

        private string EffectivePath(Guid bindingId)
        {
            foreach (InputActionMap actionMap in _actions.asset.actionMaps)
            {
                foreach (InputAction action in actionMap.actions)
                {
                    for (int i = 0; i < action.bindings.Count; i++)
                    {
                        if (action.bindings[i].id == bindingId)
                        {
                            return action.bindings[i].overridePath ?? action.bindings[i].path;
                        }
                    }
                }
            }

            return null;
        }

        private static RawInputSample MakeSample(float accelerateRaw = 0f, float brakeRaw = 0f, float steerRaw = 0f)
        {
            return new RawInputSample(1, Overdrive.Input.ControlScheme.Gamepad, accelerateRaw, brakeRaw, steerRaw, InputAvailability.Available, RawInputValidityFlags.None);
        }

        // ---- AC-C8/C9: reserved rejection ----

        [Test]
        public void AC_C8_BeginCapture_ReservedSlot_Rejected()
        {
            BindingSlot reserved = _catalog.ReservedSlots[0];
            var adapter = new RebindCaptureAdapter(_catalog);

            CaptureStartResult result = adapter.BeginCapture(TargetFor(reserved));

            Assert.That(result.Status, Is.EqualTo(CaptureStartStatus.Rejected));
            Assert.That(result.Reason, Is.EqualTo(RejectionReason.Reserved));
        }

        [Test]
        public void AC_C9_ListeningNeverBegins_OnReservedTarget()
        {
            BindingSlot reserved = _catalog.ReservedSlots[0];
            var adapter = new RebindCaptureAdapter(_catalog);
            bool delivered = false;
            adapter.Captured += r => delivered = true;

            CaptureStartResult result = adapter.BeginCapture(TargetFor(reserved));
            adapter.SubmitCandidate("<Keyboard>/x");

            Assert.That(result.Status, Is.EqualTo(CaptureStartStatus.Rejected));
            Assert.That(result.Reason, Is.EqualTo(RejectionReason.Reserved));
            Assert.That(delivered, Is.False, "No capture event fires — Listening never began.");
        }

        [Test]
        public void BeginCapture_UnknownBinding_Rejected()
        {
            var adapter = new RebindCaptureAdapter(_catalog);
            var target = new BindingTarget(Guid.Empty, Guid.NewGuid(), CoreControlScheme.KeyboardMouse, 0, string.Empty);

            CaptureStartResult result = adapter.BeginCapture(target);

            Assert.That(result.Status, Is.EqualTo(CaptureStartStatus.Rejected));
            Assert.That(result.Reason, Is.EqualTo(RejectionReason.UnknownBinding));
        }

        [Test]
        public void BeginCapture_UnknownAction_Rejected()
        {
            BindingSlot slot = Slot("Accelerate");
            var adapter = new RebindCaptureAdapter(_catalog);
            var target = new BindingTarget(Guid.NewGuid(), slot.Id, CoreControlScheme.KeyboardMouse, 0, string.Empty);

            CaptureStartResult result = adapter.BeginCapture(target);

            Assert.That(result.Status, Is.EqualTo(CaptureStartStatus.Rejected));
            Assert.That(result.Reason, Is.EqualTo(RejectionReason.UnknownAction));
        }

        // ---- AC-C2: captured candidate applies to the catalog ----

        [Test]
        public void AC_C2_SubmitCandidate_Captured_AppliesOverride()
        {
            BindingSlot accel = Slot("Accelerate");
            var adapter = new RebindCaptureAdapter(_catalog);
            CaptureResult delivered = default;
            adapter.Captured += r => delivered = r;

            CaptureStartResult started = adapter.BeginCapture(TargetFor(accel));
            Assert.That(started.Status, Is.EqualTo(CaptureStartStatus.Started));

            adapter.SubmitCandidate("<Keyboard>/x");

            Assert.That(delivered.Kind, Is.EqualTo(CaptureResultKind.Captured));
            Assert.That(EffectivePath(accel.Id), Is.EqualTo("<Keyboard>/x"));
        }

        // ---- AC-C4: conflict identifies the conflicting binding ----

        [Test]
        public void AC_C4_SubmitCandidate_Conflict_IdentifiesConflictingSlot()
        {
            BindingSlot accel = Slot("Accelerate");
            BindingSlot brake = Slot("Brake");
            var adapter = new RebindCaptureAdapter(_catalog);
            CaptureResult delivered = default;
            adapter.Captured += r => delivered = r;

            adapter.BeginCapture(TargetFor(accel));
            // Brake's current path is taken by the target candidate.
            adapter.SubmitCandidate(EffectivePath(brake.Id));

            Assert.That(delivered.Kind, Is.EqualTo(CaptureResultKind.Conflict));
            Assert.That(delivered.ConflictingBindingId, Is.EqualTo(brake.Id));
            Assert.That(delivered.ConflictingActionId, Is.EqualTo(_catalog.GetActionId(brake.Id)));
        }

        // ---- edges: duplicate, wrong scheme, malformed ----

        [Test]
        public void SubmitCandidate_DuplicateOfCurrent_Rejected()
        {
            BindingSlot accel = Slot("Accelerate");
            var adapter = new RebindCaptureAdapter(_catalog);
            CaptureResult delivered = default;
            adapter.Captured += r => delivered = r;

            adapter.BeginCapture(TargetFor(accel));
            adapter.SubmitCandidate(EffectivePath(accel.Id));

            Assert.That(delivered.Kind, Is.EqualTo(CaptureResultKind.Rejected));
            Assert.That(delivered.Reason, Is.EqualTo(RejectionReason.DuplicateCandidate));
        }

        [Test]
        public void SubmitCandidate_WrongScheme_Rejected()
        {
            BindingSlot accel = Slot("Accelerate");
            var adapter = new RebindCaptureAdapter(_catalog);
            CaptureResult delivered = default;
            adapter.Captured += r => delivered = r;

            adapter.BeginCapture(TargetFor(accel, CoreControlScheme.KeyboardMouse));
            adapter.SubmitCandidate("<Gamepad>/buttonSouth");

            Assert.That(delivered.Kind, Is.EqualTo(CaptureResultKind.Rejected));
            Assert.That(delivered.Reason, Is.EqualTo(RejectionReason.MalformedPath));
        }

        [Test]
        public void SubmitCandidate_MalformedPath_Rejected()
        {
            BindingSlot accel = Slot("Accelerate");
            var adapter = new RebindCaptureAdapter(_catalog);
            CaptureResult delivered = default;
            adapter.Captured += r => delivered = r;

            adapter.BeginCapture(TargetFor(accel));
            adapter.SubmitCandidate("<Keyboard>/nonexistentKey");

            Assert.That(delivered.Kind, Is.EqualTo(CaptureResultKind.Rejected));
            Assert.That(delivered.Reason, Is.EqualTo(RejectionReason.MalformedPath));
        }

        [Test]
        public void SubmitCandidate_NullPath_Rejected()
        {
            BindingSlot accel = Slot("Accelerate");
            string accelDefault = EffectivePath(accel.Id);
            var adapter = new RebindCaptureAdapter(_catalog);
            CaptureResult delivered = default;
            adapter.Captured += r => delivered = r;

            adapter.BeginCapture(TargetFor(accel));
            adapter.SubmitCandidate(null);

            Assert.That(delivered.Kind, Is.EqualTo(CaptureResultKind.Rejected));
            Assert.That(delivered.Reason, Is.EqualTo(RejectionReason.MalformedPath));
            Assert.That(EffectivePath(accel.Id), Is.EqualTo(accelDefault));
        }

        [Test]
        public void AC_C8_ReservedConflict_RejectedImmediately()
        {
            // A candidate conflicting with a fixed Confirm/Cancel/Pause binding is rejected immediately
            // (AC-C8). Pause is bound to <Keyboard>/escape in the asset.
            BindingSlot accel = Slot("Accelerate");
            var adapter = new RebindCaptureAdapter(_catalog);
            CaptureResult delivered = default;
            adapter.Captured += r => delivered = r;

            adapter.BeginCapture(TargetFor(accel));
            adapter.SubmitCandidate("<Keyboard>/escape");

            Assert.That(delivered.Kind, Is.EqualTo(CaptureResultKind.Rejected));
            Assert.That(delivered.Reason, Is.EqualTo(RejectionReason.Reserved));
            Assert.That(EffectivePath(accel.Id), Is.Not.EqualTo("<Keyboard>/escape"), "The rebound slot did not take the reserved control.");
            BindingSlot pause = _catalog.ReservedSlots.First(s => s.ActionName == "Pause" && s.CurrentPath == "<Keyboard>/escape");
            Assert.That(pause.CurrentPath, Is.EqualTo("<Keyboard>/escape"), "The fixed Pause binding is unchanged.");
        }

        [Test]
        public void AC_C2_RebindExistingOverride_Substitutes()
        {
            // A slot that already carries an override can be re-rebound (AC-C2 substitution) — the
            // per-action cap must not block replacing the override on the SAME slot.
            BindingSlot accel = Slot("Accelerate");
            Assert.That(_catalog.TryRebind(accel.Id, "<Keyboard>/x"), Is.EqualTo(RemapResult.Captured));

            var adapter = new RebindCaptureAdapter(_catalog);
            CaptureResult delivered = default;
            adapter.Captured += r => delivered = r;
            adapter.BeginCapture(TargetFor(accel));
            adapter.SubmitCandidate("<Keyboard>/y");

            Assert.That(delivered.Kind, Is.EqualTo(CaptureResultKind.Captured));
            Assert.That(EffectivePath(accel.Id), Is.EqualTo("<Keyboard>/y"), "The existing override is substituted, not blocked by the cap.");
            Assert.That(_catalog.RemappableSlots.First(s => s.Id == accel.Id).CurrentPath, Is.EqualTo("<Keyboard>/y"), "The cached slot path refreshes after substitution.");
        }

        [Test]
        public void AC_C2_SubstituteThenRemove_FreesCapAccounting()
        {
            // Substitution must not inflate the per-action override count: after rebind → substitute →
            // remove, another slot of the SAME action can still rebind (the count is back to zero).
            BindingSlot accel = Slot("Accelerate");
            BindingSlot accelSecondary = _catalog.RemappableSlots.First(s => s.ActionName == "Accelerate" && s.Id != accel.Id);
            Assert.That(_catalog.TryRebind(accel.Id, "<Keyboard>/x"), Is.EqualTo(RemapResult.Captured));
            Assert.That(_catalog.TryRebind(accel.Id, "<Keyboard>/y"), Is.EqualTo(RemapResult.Captured), "Substitution on the same slot is allowed.");

            Assert.That(_catalog.RemoveOverride(accel.Id), Is.True);

            Assert.That(_catalog.TryRebind(accelSecondary.Id, "<Keyboard>/z"), Is.EqualTo(RemapResult.Captured),
                "The override count is not phantom-inflated by substitution — another slot of the same action rebinds.");
        }

        [Test]
        public void AC_C12_SeededOverride_RespectedFromConstruction()
        {
            // A catalog built over an ALREADY-customized asset seeds its per-action override count from
            // the asset's overridePath entries — a second slot of the same action is capped from the start.
            BindingSlot accel = Slot("Accelerate");
            BindingSlot accelSecondary = _catalog.RemappableSlots.First(s => s.ActionName == "Accelerate" && s.Id != accel.Id);
            Assert.That(_catalog.TryRebind(accel.Id, "<Keyboard>/x"), Is.EqualTo(RemapResult.Captured));

            var seeded = new InputBindingCatalog(_actions.asset);

            Assert.That(seeded.TryRebind(accelSecondary.Id, "<Keyboard>/y"), Is.EqualTo(RemapResult.Rejected),
                "The seeded catalog knows the action is at its override cap.");
            Assert.That(seeded.TryRebind(accel.Id, "<Keyboard>/z"), Is.EqualTo(RemapResult.Captured),
                "Substitution on the already-overridden slot itself remains allowed.");
        }

        [Test]
        public void AC_C12_ApplyOverrides_TwoEntriesSameAction_SecondNotApplied()
        {
            // Two persisted entries for two slots of the SAME action: the cap (one override per action)
            // rejects the second — reported in the migration result, not silently applied.
            BindingSlot accel = Slot("Accelerate");
            BindingSlot accelSecondary = _catalog.RemappableSlots.First(s => s.ActionName == "Accelerate" && s.Id != accel.Id);
            var mapper = new SettingsBindingMapper(_catalog);
            var persisted = new[]
            {
                new BindingOverrideData(accel.Id, "<Keyboard>/x"),
                new BindingOverrideData(accelSecondary.Id, "<Keyboard>/y"),
            };

            BindingMigrationResult result = mapper.MapPersistedOverrides(persisted);

            Assert.That(result.PreservedOverrides, Has.Exactly(1).Matches<BindingOverrideData>(o => o.BindingId == accel.Id));
            Assert.That(result.RestoredBindingIds, Is.EqualTo(new[] { accelSecondary.Id }));
            Assert.That(EffectivePath(accelSecondary.Id), Is.Not.EqualTo("<Keyboard>/y"));
        }

        [Test]
        public void AC_C12_MixedMigration_ValidSurvivesUnknownAndMalformed()
        {
            // A mixed persisted set: a valid override must survive while an unknown binding id and a
            // malformed path are restored — the migration never clears valid overrides when it
            // encounters an unknown/malformed entry (AC-C12 "preserves every valid override").
            BindingSlot accel = Slot("Accelerate");
            Guid unknown = Guid.NewGuid();
            var mapper = new SettingsBindingMapper(_catalog);
            var persisted = new[]
            {
                new BindingOverrideData(accel.Id, "<Keyboard>/x"),
                new BindingOverrideData(unknown, "<Keyboard>/y"),
                new BindingOverrideData(accel.Id, "<Keyboard>/bogus"),
            };

            BindingMigrationResult result = mapper.MapPersistedOverrides(persisted);

            Assert.That(result.PreservedOverrides, Has.Exactly(1).Matches<BindingOverrideData>(o => o.BindingId == accel.Id && o.Path == "<Keyboard>/x"),
                "The valid override survives mixed migration.");
            Assert.That(result.UnknownBindingIds, Is.EqualTo(new[] { unknown }));
            Assert.That(result.MalformedPaths.Count, Is.Zero, "The same-slot duplicate is discarded, not reported malformed.");
            Assert.That(EffectivePath(accel.Id), Is.EqualTo("<Keyboard>/x"));
        }

        [Test]
        public void AC_C12_SameSlotDuplicate_FirstWinsDiscarded()
        {
            // Two persisted entries for the SAME slot: the first wins and is preserved; the duplicate is
            // discarded — never preserved AND restored for the same binding id.
            BindingSlot accel = Slot("Accelerate");
            var mapper = new SettingsBindingMapper(_catalog);
            var persisted = new[]
            {
                new BindingOverrideData(accel.Id, "<Keyboard>/x"),
                new BindingOverrideData(accel.Id, "<Keyboard>/y"),
            };

            BindingMigrationResult result = mapper.MapPersistedOverrides(persisted);

            Assert.That(result.PreservedOverrides, Has.Exactly(1).Matches<BindingOverrideData>(o => o.BindingId == accel.Id && o.Path == "<Keyboard>/x"));
            Assert.That(result.RestoredBindingIds, Has.None.EqualTo(accel.Id), "The slot is preserved, never also restored.");
            Assert.That(EffectivePath(accel.Id), Is.EqualTo("<Keyboard>/x"));
        }

        [Test]
        public void AC_C3_CancelPress_EmitsCancelled()
        {
            // The adapter subscribes to the Cancel action (Escape / Gamepad East) and surfaces a press
            // during Listening as Cancelled — the state machine returns to Open with no mutation.
            _actions.@OverdriveUI.@Cancel.Enable(); // test setup — runtime has the UI context active
            BindingSlot accel = Slot("Accelerate");
            var adapter = new RebindCaptureAdapter(_catalog, _actions);
            var machine = new ControlBindingStateMachine(adapter, new SchemeProbeAdapter(_controller), Array.Empty<BindingOverrideData>());
            Assert.That(machine.BeginListening(TargetFor(accel)).Status, Is.EqualTo(CaptureStartStatus.Started));

            Press((ButtonControl)_actions.@OverdriveUI.@Cancel.controls[0]);

            Assert.That(machine.State, Is.EqualTo(ControlBindingState.Open), "Escape during Listening cancels the capture.");
            Assert.That(machine.GetWorkingOverrides().Count, Is.Zero, "No working mutation on cancel.");
            machine.Dispose();
            adapter.Dispose();
        }

        [Test]
        public void SubmitCandidate_AfterCompletion_IsNoOp()
        {
            // Single-shot: after an outcome is delivered the active target is cleared, so a stray second
            // candidate cannot re-apply without a fresh BeginCapture.
            BindingSlot accel = Slot("Accelerate");
            var adapter = new RebindCaptureAdapter(_catalog);
            int delivered = 0;
            adapter.Captured += r => delivered++;

            adapter.BeginCapture(TargetFor(accel));
            adapter.SubmitCandidate("<Keyboard>/x");
            Assert.That(delivered, Is.EqualTo(1));
            Assert.That(EffectivePath(accel.Id), Is.EqualTo("<Keyboard>/x"));

            adapter.SubmitCandidate("<Keyboard>/y");

            Assert.That(delivered, Is.EqualTo(1), "No second event fires without a fresh BeginCapture.");
            Assert.That(EffectivePath(accel.Id), Is.EqualTo("<Keyboard>/x"), "The stray candidate does not re-apply.");
        }

        // ---- AC-C5/ST6: conflict resolution ----

        [Test]
        public void AC_C5_ConfirmConflict_ClearsConflicting_AppliesTarget()
        {
            BindingSlot accel = Slot("Accelerate");
            BindingSlot brake = Slot("Brake");
            var adapter = new RebindCaptureAdapter(_catalog);
            CaptureResult delivered = default;
            adapter.Captured += r => delivered = r;

            // Give Brake a runtime override on a shared path, then rebind Accelerate to it.
            string shared = "<Keyboard>/x";
            string brakeDefault = EffectivePath(brake.Id);
            Assert.That(brakeDefault, Is.Not.EqualTo(shared));
            _catalog.TryRebind(brake.Id, shared);
            Assert.That(EffectivePath(brake.Id), Is.EqualTo(shared));

            adapter.BeginCapture(TargetFor(accel));
            adapter.SubmitCandidate(shared);

            Assert.That(delivered.Kind, Is.EqualTo(CaptureResultKind.Conflict));
            adapter.ConfirmConflict();

            Assert.That(EffectivePath(accel.Id), Is.EqualTo(shared));
            Assert.That(EffectivePath(brake.Id), Is.EqualTo(brakeDefault), "The old non-critical binding is cleared — Brake falls back to its default.");
        }

        [Test]
        public void AC_ST6_CancelConflict_PreservesRuntime()
        {
            BindingSlot accel = Slot("Accelerate");
            BindingSlot brake = Slot("Brake");
            var adapter = new RebindCaptureAdapter(_catalog);
            CaptureResult delivered = default;
            adapter.Captured += r => delivered = r;

            string accelPath = EffectivePath(accel.Id);
            string brakePath = EffectivePath(brake.Id);
            adapter.BeginCapture(TargetFor(accel));
            adapter.SubmitCandidate(brakePath);

            Assert.That(delivered.Kind, Is.EqualTo(CaptureResultKind.Conflict));
            adapter.CancelConflict();

            Assert.That(EffectivePath(accel.Id), Is.EqualTo(accelPath), "Target slot untouched after conflict cancel.");
            Assert.That(EffectivePath(brake.Id), Is.EqualTo(brakePath), "Conflicting slot untouched after conflict cancel.");
        }

        // ---- AC-C3: end capture ----

        [Test]
        public void AC_C3_EndCapture_NoRuntimeMutation()
        {
            BindingSlot accel = Slot("Accelerate");
            var adapter = new RebindCaptureAdapter(_catalog);
            string original = EffectivePath(accel.Id);

            adapter.BeginCapture(TargetFor(accel));
            adapter.EndCapture();

            Assert.That(EffectivePath(accel.Id), Is.EqualTo(original));
        }

        // ---- AC-E11: scheme probe over InputContextController ----

        [Test]
        public void AC_E11_SchemeProbe_ReadsController_WithoutMutation()
        {
            var probe = new SchemeProbeAdapter(_controller);

            Assert.That(probe.ActiveScheme, Is.EqualTo(CoreControlScheme.KeyboardMouse));
            Assert.That(_controller.ActiveScheme, Is.EqualTo(Overdrive.Input.ControlScheme.KeyboardMouse));
        }

        [Test]
        public void AC_E11_ReconnectDuringListening_ProbeUnchanged()
        {
            // A gamepad reconnect DURING Listening (device plugged in mid-capture): the candidate is
            // evaluated only for rebinding and Settings never writes the active scheme. Full
            // composition — state machine + adapter + real probe.
            BindingSlot gamepadAccel = _catalog.RemappableSlots.First(s => s.ActionName == "Accelerate" && s.CurrentPath.StartsWith("<Gamepad>", StringComparison.Ordinal));
            var probe = new SchemeProbeAdapter(_controller);
            var adapter = new RebindCaptureAdapter(_catalog);
            var machine = new ControlBindingStateMachine(adapter, probe, Array.Empty<BindingOverrideData>());

            Assert.That(machine.BeginListening(TargetFor(gamepadAccel, CoreControlScheme.Gamepad)).Status, Is.EqualTo(CaptureStartStatus.Started));
            int deviceCountBefore = InputSystem.devices.Count;
            InputSystem.AddDevice<Gamepad>();
            Assert.That(InputSystem.devices.Count, Is.EqualTo(deviceCountBefore + 1), "The reconnect genuinely happens during Listening.");
            Overdrive.Input.ControlScheme schemeBefore = _controller.ActiveScheme;
            adapter.SubmitCandidate("<Gamepad>/buttonWest");

            Assert.That(machine.State, Is.EqualTo(ControlBindingState.Open), "The capture completed and the session returned to Open.");
            Assert.That(machine.GetWorkingOverrides(), Has.Exactly(1).Matches<BindingOverrideData>(o => o.BindingId == gamepadAccel.Id));
            Assert.That(_controller.ActiveScheme, Is.EqualTo(schemeBefore),
                "Settings evaluates the candidate only for rebinding — it never mutates the active scheme, even across a reconnect.");
            machine.Dispose();
            adapter.Dispose();
        }

        [Test]
        public void AC_E11_DeviceLossDuringListening_CancelsCapture()
        {
            // A device REMOVED while Listening cancels the capture: the state machine receives
            // Cancelled(DeviceLost) and returns to Open with no working mutation; the probe is untouched.
            BindingSlot gamepadAccel = _catalog.RemappableSlots.First(s => s.ActionName == "Accelerate" && s.CurrentPath.StartsWith("<Gamepad>", StringComparison.Ordinal));
            var probe = new SchemeProbeAdapter(_controller);
            var adapter = new RebindCaptureAdapter(_catalog);
            var machine = new ControlBindingStateMachine(adapter, probe, Array.Empty<BindingOverrideData>());
            CaptureResult delivered = default;
            bool deliveredFlag = false;
            adapter.Captured += r => { delivered = r; deliveredFlag = true; };

            Assert.That(machine.BeginListening(TargetFor(gamepadAccel, CoreControlScheme.Gamepad)).Status, Is.EqualTo(CaptureStartStatus.Started));
            InputSystem.RemoveDevice(_gamepad);

            Assert.That(deliveredFlag, Is.True, "The device loss emits a cancellation result.");
            Assert.That(delivered.Kind, Is.EqualTo(CaptureResultKind.Cancelled));
            Assert.That(delivered.Reason, Is.EqualTo(RejectionReason.DeviceLost), "The typed reason is DeviceLost.");
            Assert.That(machine.State, Is.EqualTo(ControlBindingState.Open), "Device loss cancels the capture.");
            Assert.That(machine.GetWorkingOverrides().Count, Is.Zero, "No working mutation on device loss.");
            machine.Dispose();
            adapter.Dispose();
        }

        [Test]
        public void AdapterDispose_StopsDeviceLossDetection()
        {
            // After Dispose the adapter no longer listens for device changes — removing a device emits
            // nothing and the state machine is untouched.
            var probe = new SchemeProbeAdapter(_controller);
            var adapter = new RebindCaptureAdapter(_catalog);
            var machine = new ControlBindingStateMachine(adapter, probe, Array.Empty<BindingOverrideData>());
            bool delivered = false;
            adapter.Captured += r => delivered = true;
            Assert.That(machine.BeginListening(TargetFor(Slot("Accelerate"))).Status, Is.EqualTo(CaptureStartStatus.Started));

            adapter.Dispose();
            InputSystem.RemoveDevice(_gamepad);

            Assert.That(delivered, Is.False, "A disposed adapter emits no device-loss result.");
            machine.Dispose();
        }

        // ---- AC-C12/E4: persisted override mapper ----

        [Test]
        public void AC_C12_UnknownBindingId_RestoresAndReports()
        {
            var mapper = new SettingsBindingMapper(_catalog);
            var persisted = new[] { new BindingOverrideData(Guid.NewGuid(), "<Keyboard>/w") };

            BindingMigrationResult result = mapper.MapPersistedOverrides(persisted);

            Assert.That(result.UnknownBindingIds, Is.EqualTo(new[] { persisted[0].BindingId }));
            Assert.That(result.RestoredBindingIds, Is.EqualTo(new[] { persisted[0].BindingId }));
            Assert.That(result.PreservedOverrides.Count, Is.Zero);
            Assert.That(result.MalformedPaths.Count, Is.Zero);
        }

        [Test]
        public void AC_C12_MalformedPath_RestoresAndReports()
        {
            BindingSlot accel = Slot("Accelerate");
            string accelDefault = EffectivePath(accel.Id);
            var mapper = new SettingsBindingMapper(_catalog);
            var persisted = new[] { new BindingOverrideData(accel.Id, "<Keyboard>/nonexistentKey") };

            BindingMigrationResult result = mapper.MapPersistedOverrides(persisted);

            Assert.That(result.PreservedOverrides.Count, Is.Zero);
            Assert.That(result.RestoredBindingIds, Is.EqualTo(new[] { accel.Id }));
            Assert.That(result.MalformedPaths, Is.EqualTo(new[] { "<Keyboard>/nonexistentKey" }));
            Assert.That(EffectivePath(accel.Id), Is.EqualTo(accelDefault), "Slot falls back to its asset default — nothing applied.");
        }

        [Test]
        public void AC_C12_MalformedPath_RemovesPreExistingOverride()
        {
            // A slot with an existing runtime override that the mapper rejects must be reset to its
            // asset default, not left holding the stale override.
            BindingSlot accel = Slot("Accelerate");
            string accelDefault = EffectivePath(accel.Id);
            Assert.That(_catalog.TryRebind(accel.Id, "<Keyboard>/x"), Is.EqualTo(RemapResult.Captured));
            Assert.That(EffectivePath(accel.Id), Is.Not.EqualTo(accelDefault));

            var mapper = new SettingsBindingMapper(_catalog);
            var persisted = new[] { new BindingOverrideData(accel.Id, "<Keyboard>/nonexistentKey") };

            BindingMigrationResult result = mapper.MapPersistedOverrides(persisted);

            Assert.That(result.RestoredBindingIds, Is.EqualTo(new[] { accel.Id }));
            Assert.That(EffectivePath(accel.Id), Is.EqualTo(accelDefault), "The stale override is removed — the slot falls back to default.");
        }

        [Test]
        public void AC_C12_ValidOverride_PreservedAndApplied()
        {
            BindingSlot accel = Slot("Accelerate");
            var mapper = new SettingsBindingMapper(_catalog);
            var persisted = new[] { new BindingOverrideData(accel.Id, "<Keyboard>/x") };

            BindingMigrationResult result = mapper.MapPersistedOverrides(persisted);

            Assert.That(result.PreservedOverrides.Count, Is.EqualTo(1));
            Assert.That(result.PreservedOverrides[0].BindingId, Is.EqualTo(accel.Id));
            Assert.That(result.RestoredBindingIds.Count, Is.Zero);
            Assert.That(result.UnknownBindingIds.Count, Is.Zero);
            Assert.That(EffectivePath(accel.Id), Is.EqualTo("<Keyboard>/x"));
        }

        [Test]
        public void AC_E4_DuplicatePaths_FirstWins_ThenMapperPreservesFirst()
        {
            BindingSlot accel = Slot("Accelerate");
            BindingSlot brake = Slot("Brake");
            string shared = "<Keyboard>/x";
            var persisted = new[]
            {
                new BindingOverrideData(accel.Id, shared),
                new BindingOverrideData(brake.Id, shared),
            };

            // The mapper classifies duplicates itself (AC-E4 adapter boundary): the first keeps its
            // binding, the second falls back to its slot default and is reported in RestoredBindingIds.
            var mapper = new SettingsBindingMapper(_catalog);
            BindingMigrationResult result = mapper.MapPersistedOverrides(persisted);

            Assert.That(result.PreservedOverrides, Has.Exactly(1).Matches<BindingOverrideData>(o => o.BindingId == accel.Id && o.Path == shared));
            Assert.That(result.RestoredBindingIds, Is.EqualTo(new[] { brake.Id }));
            Assert.That(EffectivePath(accel.Id), Is.EqualTo(shared));
            Assert.That(EffectivePath(brake.Id), Is.Not.EqualTo(shared), "The duplicate slot falls back to its default.");
        }

        [Test]
        public void MapPersistedOverrides_Null_Throws()
        {
            var mapper = new SettingsBindingMapper(_catalog);

            Assert.Throws<ArgumentNullException>(() => mapper.MapPersistedOverrides(null));
        }

        // ---- AC-C10/C11: Settings preview consumption of the existing evaluator ----

        [Test]
        public void AC_C10_StickDeadZone_PreviewNormalizesToHalf()
        {
            // steerRaw 0.55, stick inner 0.15, stick outer 0.95 → (0.55-0.15)/(0.95-0.15) = 0.5.
            // Steer EMA alpha 1.0 keeps the output at the normalized magnitude.
            var working = new ControlProfile(0.15f, 0.95f, DeadZoneNormalizer.TriggerInnerThreshold, 0.3f, 0.3f, 1.0f);
            RawInputSample sample = MakeSample(steerRaw: 0.55f);

            SimulationInput first = SettingsInputPreviewEvaluator.Evaluate(sample, working, false);
            SimulationInput second = SettingsInputPreviewEvaluator.Evaluate(sample, working, false);

            Assert.That(first.SteerOut, Is.EqualTo(0.5f).Within(0.001f));
            Assert.That(second.SteerOut, Is.EqualTo(first.SteerOut), "Pure evaluation — repeatable, no simulation advance.");
        }

        [Test]
        public void AC_C11_EMAPreview_FirstTickIsAlphaTimesRaw()
        {
            // accelerate alpha 0.3, raw 1.0, previous output 0.0 → 0.3.
            var working = new ControlProfile(0.15f, 0.95f, DeadZoneNormalizer.TriggerInnerThreshold, 0.3f, 0.3f, 0.5f);
            RawInputSample sample = MakeSample(accelerateRaw: 1.0f);

            SimulationInput result = SettingsInputPreviewEvaluator.Evaluate(sample, working, false);

            Assert.That(result.AccelerateOut, Is.EqualTo(0.3f).Within(0.001f));
        }

        // ---- AC-C7: adapter surface performs no action-map activation or gameplay routing ----

        [Test]
        public void AC_C7_AdapterSurface_NoRoutingApis()
        {
            // The Settings capture adapter must never activate action maps, route gameplay actions, or
            // write the active scheme — InputContextController remains sole owner (ADR-0005). Proven by
            // surface scan: no public member activates/routes, and no InputContextController/InputActionMap
            // leaks through the public API.
            Type adapterType = typeof(RebindCaptureAdapter);

            Assert.That(adapterType.GetConstructor(new[] { typeof(InputBindingCatalog), typeof(InputSystem_Actions) }), Is.Not.Null,
                "The adapter depends on the Input catalog (and optionally the actions wrapper) — never on InputContextController or InputActionAsset.");

            string[] routed = adapterType.GetMethods()
                .Where(m => m.IsPublic && !m.IsSpecialName)
                .Select(m => m.Name)
                .ToArray();
            Assert.That(routed, Has.None.Match("Enable|Activate|Route|Switch|SetContext"),
                "No public adapter method activates a map or switches contexts.");

            Assert.That(adapterType.GetProperties().Select(p => p.PropertyType.Name), Has.None.Match("InputContextController|InputActionMap|InputActionAsset"),
                "No controller/map types leak through the adapter's public surface.");

            Type probeType = typeof(SchemeProbeAdapter);
            Assert.That(probeType.GetProperty(nameof(SchemeProbeAdapter.ActiveScheme)).GetSetMethod(), Is.Null,
                "The probe is read-only — Settings can never write the active scheme.");

            // Behavioral evidence: a full capture cycle through the real controller does not change the
            // active input context (no map activation or routing happens on the Settings side).
            BindingSlot accel = Slot("Accelerate");
            InputContextKind before = _controller.CurrentContext;
            var adapter = new RebindCaptureAdapter(_catalog);
            adapter.BeginCapture(TargetFor(accel));
            adapter.SubmitCandidate("<Keyboard>/x");
            Assert.That(_controller.CurrentContext, Is.EqualTo(before), "Capture never activates or routes maps through the controller.");
            adapter.Dispose();
        }
    }
}
