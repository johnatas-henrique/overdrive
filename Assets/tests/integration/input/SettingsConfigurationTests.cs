using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using Overdrive.Input;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Overdrive.Input.Tests
{
    /// <summary>Integration evidence for Story 008's Settings-facing input configuration contract.</summary>
    [TestFixture]
    public sealed class SettingsConfigurationTests : InputTestFixture
    {
        private InputSystem_Actions _actions;
        private InputBindingCatalog _catalog;

        [SetUp]
        public void SetUp()
        {
            InputSystem.AddDevice<Keyboard>();
            InputSystem.AddDevice<Gamepad>();
            _actions = new InputSystem_Actions();
            _catalog = new InputBindingCatalog(_actions.asset);
        }

        [TearDown]
        public void TearDown()
        {
            _actions?.Dispose();
        }

        // ---- AC-68: ControlProfile validation (per-field fallback + one named warning per invalid field) ----

        [Test]
        public void AC68_StickInnerGreaterOrEqualOuterFallsBack()
        {
            ControlProfile profile = new ControlProfile(0.9f, 0.3f, 0.05f, 0.3f, 0.3f, 0.5f); // inner >= outer
            ControlProfile result = ControlProfile.Sanitize(profile, out ProfileWarning[] warnings);

            Assert.AreEqual(ControlProfile.Default.StickInner, result.StickInner);
            Assert.AreEqual(ControlProfile.Default.StickOuter, result.StickOuter);
            Assert.AreEqual(1, warnings.Length);
            Assert.AreEqual(ProfileWarningKind.StickDeadZoneInvalid, warnings[0].Kind);
        }

        [Test]
        public void AC68_NonFiniteThresholdFallsBack()
        {
            ControlProfile profile = new ControlProfile(float.NaN, 0.95f, float.PositiveInfinity, 0.3f, 0.3f, 0.5f);
            ControlProfile result = ControlProfile.Sanitize(profile, out ProfileWarning[] warnings);

            Assert.AreEqual(ControlProfile.Default.StickInner, result.StickInner);
            Assert.AreEqual(ControlProfile.Default.TriggerInner, result.TriggerInner);
            Assert.AreEqual(2, warnings.Length);
            CollectionAssert.AreEquivalent(
                new[] { ProfileWarningKind.StickDeadZoneInvalid, ProfileWarningKind.TriggerThresholdInvalid },
                warnings.Select(w => w.Kind).ToArray());
        }

        [Test]
        public void AC68_AlphaOutsideRangeFallsBackPerChannel()
        {
            ControlProfile profile = new ControlProfile(0.15f, 0.95f, 0.05f, 1.5f, -0.2f, 0.5f);
            ControlProfile result = ControlProfile.Sanitize(profile, out ProfileWarning[] warnings);

            Assert.AreEqual(ControlProfile.Default.AccelerateAlpha, result.AccelerateAlpha);
            Assert.AreEqual(ControlProfile.Default.BrakeAlpha, result.BrakeAlpha);
            Assert.AreEqual(0.5f, result.SteerAlpha); // valid, preserved
            Assert.AreEqual(2, warnings.Length);
            Assert.AreEqual(ProfileWarningKind.EmaAlphaInvalid, warnings[0].Kind);
            Assert.AreEqual("Accelerate", warnings[0].Channel);
            Assert.AreEqual("Brake", warnings[1].Channel);
        }

        [Test]
        public void AC68_NonFiniteAlphaFallsBack()
        {
            ControlProfile profile = new ControlProfile(0.15f, 0.95f, 0.05f, float.NaN, float.PositiveInfinity, float.NegativeInfinity);
            ControlProfile result = ControlProfile.Sanitize(profile, out ProfileWarning[] warnings);

            Assert.AreEqual(ControlProfile.Default.AccelerateAlpha, result.AccelerateAlpha);
            Assert.AreEqual(ControlProfile.Default.BrakeAlpha, result.BrakeAlpha);
            Assert.AreEqual(ControlProfile.Default.SteerAlpha, result.SteerAlpha);
            Assert.AreEqual(3, warnings.Length);
            CollectionAssert.AreEquivalent(new[] { "Accelerate", "Brake", "Steer" }, warnings.Select(w => w.Channel).ToArray());
        }

        [Test]
        public void AC68_RepeatedLoadEmitsOneWarningEach()
        {
            ControlProfile profile = new ControlProfile(1.5f, 0.95f, 0.05f, 0.3f, 0.3f, 0.5f); // invalid stick inner
            ControlProfile first = ControlProfile.Sanitize(profile, out ProfileWarning[] firstWarnings);
            ControlProfile second = ControlProfile.Sanitize(profile, out ProfileWarning[] secondWarnings);

            // Each load (invocation) emits one StickDeadZoneInvalid — no cross-load accumulation.
            Assert.AreEqual(1, firstWarnings.Length);
            Assert.AreEqual(1, secondWarnings.Length);
            Assert.AreEqual(ControlProfile.Default.StickInner, first.StickInner);
            Assert.AreEqual(ControlProfile.Default.StickInner, second.StickInner);
        }

        [Test]
        public void AC68_ValidFieldsPreserved()
        {
            ControlProfile profile = new ControlProfile(0.2f, 0.9f, 0.05f, 0.4f, 0.35f, 0.55f);
            ControlProfile result = ControlProfile.Sanitize(profile, out ProfileWarning[] warnings);

            Assert.AreEqual(0, warnings.Length);
            Assert.AreEqual(0.2f, result.StickInner);
            Assert.AreEqual(0.9f, result.StickOuter);
            Assert.AreEqual(0.4f, result.AccelerateAlpha);
            Assert.AreEqual(0.35f, result.BrakeAlpha);
            Assert.AreEqual(0.55f, result.SteerAlpha);
        }

                [Test]
        public void AC68_MultipleInvalidFieldsEmitOneWarningEach()
        {
            ControlProfile profile = new ControlProfile(-0.1f, 1.5f, -1f, 2f, -0.5f, 3f); // all invalid
            ControlProfile result = ControlProfile.Sanitize(profile, out ProfileWarning[] warnings);

            Assert.AreEqual(5, warnings.Length); // stick(1) + trigger(1) + alpha(3, one per channel)
            Assert.AreEqual(ControlProfile.Default.StickInner, result.StickInner);
            Assert.AreEqual(ControlProfile.Default.TriggerInner, result.TriggerInner);
            Assert.AreEqual(ControlProfile.Default.SteerAlpha, result.SteerAlpha);
            Assert.AreEqual(1, warnings.Count(w => w.Kind == ProfileWarningKind.StickDeadZoneInvalid));
            Assert.AreEqual(1, warnings.Count(w => w.Kind == ProfileWarningKind.TriggerThresholdInvalid));
            Assert.AreEqual(3, warnings.Count(w => w.Kind == ProfileWarningKind.EmaAlphaInvalid)); // one per channel
        }

        [Test]
        public void AC68_SanitizedProfileUsedBeforeFirstTick()
        {
            // invalid stick inner (1.5 would dead-zone everything) + valid steer alpha 0.7 (preserved, ≠ default 0.5).
            ControlProfile invalid = new ControlProfile(1.5f, 0.95f, 0.05f, 0.3f, 0.3f, 0.7f);
            ControlProfile sanitized = ControlProfile.Sanitize(invalid, out _);
            Assert.AreEqual(ControlProfile.Default.StickInner, sanitized.StickInner, "Invalid stick inner falls back to default.");
            Assert.AreEqual(0.7f, sanitized.SteerAlpha, "Valid steer alpha is preserved.");

            RawInputSample sample = MakeSample(steerRaw: 0.8f);
            SimulationInput result = SettingsInputPreviewEvaluator.Evaluate(sample, sanitized, false);
            SimulationInput withDefault = SettingsInputPreviewEvaluator.Evaluate(sample, ControlProfile.Default, false);

            // steer 0.8 passes the sanitized default inner (0.15); the preserved alpha 0.7 (≠ default 0.5)
            // drives the output — proving the sanitized profile is used, not the default.
            float expectedSteer = EmaBrakePriority.Sanitize(DeadZoneNormalizer.NormalizeStick(new Vector2(0.8f, 0f), sanitized.StickInner, sanitized.StickOuter).x);
            Assert.AreEqual(0.7f * expectedSteer, result.SteerOut, 0.001f, "Sanitized profile (default inner + preserved alpha 0.7) drives the tick.");
            Assert.AreNotEqual(withDefault.SteerOut, result.SteerOut, "Preserved alpha 0.7 proves the sanitized profile, not the default.");
        }

        // ---- AC-11 / AC-50: SettingsInputPreviewEvaluator applies the working profile ----

        [Test]
        public void AC50_StickDeadZoneUsesWorkingValues()
        {
            // steerRaw 0.2 is above the default inner (0.15) but below the working inner (0.3).
            RawInputSample sample = MakeSample(steerRaw: 0.2f);

            SimulationInput withDefault = SettingsInputPreviewEvaluator.Evaluate(sample, ControlProfile.Default, false);
            ControlProfile working = new ControlProfile(0.3f, 0.95f, 0.05f, 0.3f, 0.3f, 0.5f);
            SimulationInput withWorking = SettingsInputPreviewEvaluator.Evaluate(sample, working, false);

            Assert.AreNotEqual(withDefault.SteerOut, withWorking.SteerOut, "Working stick dead-zone must differ from default.");
            Assert.AreEqual(0f, withWorking.SteerOut, "steerRaw 0.2 inside working inner 0.3 normalizes to 0.");
        }

        [Test]
        public void AC50_EMAAlphaUsesWorkingValues()
        {
            RawInputSample sample = MakeSample(accelerateRaw: 0.8f);

            SimulationInput withDefault = SettingsInputPreviewEvaluator.Evaluate(sample, ControlProfile.Default, false);
            ControlProfile working = new ControlProfile(0.15f, 0.95f, 0.05f, 1.0f, 0.3f, 0.5f); // accel alpha 1.0
            SimulationInput withWorking = SettingsInputPreviewEvaluator.Evaluate(sample, working, false);

            Assert.AreNotEqual(withDefault.AccelerateOut, withWorking.AccelerateOut, "Working EMA alpha must differ from default.");
            // alpha=1.0 → EMA output equals the sanitized input exactly (no smoothing with prior 0).
            Assert.AreEqual(EmaBrakePriority.Sanitize(DeadZoneNormalizer.NormalizeTrigger(0.8f, working.TriggerInner)), withWorking.AccelerateOut, 0.001f);
        }

        [Test]
        public void AC50_BrakeAndSteerAlphaUseWorkingValues()
        {
            RawInputSample sample = MakeSample(brakeRaw: 0.8f, steerRaw: 0.8f);

            ControlProfile working = new ControlProfile(0.15f, 0.95f, 0.05f, 0.3f, 1.0f, 1.0f); // brake & steer alpha 1.0
            SimulationInput withWorking = SettingsInputPreviewEvaluator.Evaluate(sample, working, false);
            SimulationInput withDefault = SettingsInputPreviewEvaluator.Evaluate(sample, ControlProfile.Default, false);

            // alpha 1.0 → the first-tick EMA output (prev 0) equals the sanitized post-dead-zone input exactly.
            float expectedBrake = EmaBrakePriority.Sanitize(DeadZoneNormalizer.NormalizeTrigger(0.8f, working.TriggerInner));
            float expectedSteer = EmaBrakePriority.Sanitize(DeadZoneNormalizer.NormalizeStick(new Vector2(0.8f, 0f), working.StickInner, working.StickOuter).x);
            Assert.AreEqual(expectedBrake, withWorking.BrakeOut, 0.001f, "alpha 1.0 brake output equals sanitized input.");
            Assert.AreEqual(expectedSteer, withWorking.SteerOut, 0.001f, "alpha 1.0 steer output equals sanitized input.");
            Assert.AreNotEqual(withDefault.BrakeOut, withWorking.BrakeOut, "Working brake alpha differs from default.");
            Assert.AreNotEqual(withDefault.SteerOut, withWorking.SteerOut, "Working steer alpha differs from default.");
        }

        [Test]
        public void AC50_TriggerThresholdRemainsInputOwned()
        {
            // The player never edits TriggerInner (control manifest line 44); a working profile may carry
            // a different valid value (0.2), but the preview must keep the Input-owned 0.05 threshold.
            ControlProfile working = new ControlProfile(0.15f, 0.95f, 0.2f, 0.3f, 0.3f, 0.5f);
            RawInputSample sample = MakeSample(accelerateRaw: 0.1f);
            SimulationInput result = SettingsInputPreviewEvaluator.Evaluate(sample, working, false);

            // 0.1 with Input-owned inner 0.05 normalizes > 0; with the working 0.2 it would be inside the dead zone → 0.
            Assert.Greater(result.AccelerateOut, 0f, "Trigger threshold stays Input-owned (0.05), not the working 0.2.");
        }

        [Test]
        public void AC11_PreviewMatchesFirstResumedTick()
        {
            ControlProfile working = new ControlProfile(0.2f, 0.9f, 0.05f, 0.4f, 0.35f, 0.55f);
            RawInputSample sample = MakeSample(accelerateRaw: 0.7f, brakeRaw: 0f, steerRaw: 0.6f);

            // Preview: the Settings evaluator applies the working profile.
            SimulationInput preview = SettingsInputPreviewEvaluator.Evaluate(sample, working, false);

            // First resumed tick: the runtime constructs a TickProcessor with the same working values
            // (the identical pattern the Simulation Kernel uses), then processes the sample.
            TickProcessor runtimeProcessor = new TickProcessor(
                DeadZoneNormalizer.TriggerInnerThreshold,
                working.StickInner, working.StickOuter,
                working.AccelerateAlpha, working.BrakeAlpha, working.SteerAlpha);
            SimulationInput firstTick = runtimeProcessor.ProcessTick(sample, false);

            Assert.AreEqual(preview.AccelerateOut, firstTick.AccelerateOut, 0.001f);
            Assert.AreEqual(preview.BrakeOut, firstTick.BrakeOut, 0.001f);
            Assert.AreEqual(preview.SteerOut, firstTick.SteerOut, 0.001f);
        }

        // ---- AC-10 / AC-29 / AC-46: Listening classification ----

        [Test]
        public void AC10_ValidNonConflictingCandidateIsCaptured()
        {
            BindingSlot slot = Slot("Accelerate");
            Assert.AreEqual(RemapResult.Captured, _catalog.ClassifyCandidate(slot.Id, "<Keyboard>/x"));
        }

        [Test]
        public void AC10_ConflictingCandidateIsConflict()
        {
            BindingSlot slot = Slot("Accelerate");
            // <Keyboard>/a is the Steer Left (WASD) binding — a non-reserved conflict.
            Assert.AreEqual(RemapResult.Conflict, _catalog.ClassifyCandidate(slot.Id, "<Keyboard>/a"));
        }

        [Test]
        public void AC10_MalformedPathIsRejected()
        {
            BindingSlot slot = Slot("Accelerate");
            Assert.AreEqual(RemapResult.Rejected, _catalog.ClassifyCandidate(slot.Id, "<Keyboard>/nonexistent"));
            Assert.AreEqual(RemapResult.Rejected, _catalog.ClassifyCandidate(slot.Id, null));
        }

        [Test]
        public void AC10_ExceededActionCapIsRejected()
        {
            List<BindingSlot> accelSlots = _catalog.RemappableSlots.Where(s => s.ActionName == "Accelerate").ToList();
            Assert.AreEqual(RemapResult.Captured, _catalog.TryRebind(accelSlots[0].Id, "<Keyboard>/x"));
            Assert.AreEqual(RemapResult.Rejected, _catalog.ClassifyCandidate(accelSlots[1].Id, "<Keyboard>/y"));
        }

        [Test]
        public void AC10_SimultaneousCandidatesClassifiedIndependently()
        {
            // Two candidates arriving in the same Listening frame are classified independently — one
            // candidate never influences the other.
            BindingSlot accel = Slot("Accelerate");
            BindingSlot brake = Slot("Brake");
            Assert.AreEqual(RemapResult.Captured, _catalog.ClassifyCandidate(accel.Id, "<Keyboard>/x"));
            Assert.AreEqual(RemapResult.Captured, _catalog.ClassifyCandidate(brake.Id, "<Keyboard>/y"));
            Assert.AreEqual(RemapResult.Conflict, _catalog.ClassifyCandidate(accel.Id, "<Keyboard>/a"));
        }

        [Test]
        public void AC29_ReservedBindingConflictIsRejected()
        {
            BindingSlot slot = Slot("Accelerate");
            // Escape is the reserved Cancel binding; rebinding Accelerate onto it is rejected.
            Assert.AreEqual(RemapResult.Rejected, _catalog.ClassifyCandidate(slot.Id, "<Keyboard>/escape"));
        }

        [Test]
        public void AC29_ConfirmAndPauseReservedConflictsRejected()
        {
            BindingSlot slot = Slot("Accelerate");
            // Enter is the reserved Confirm; P is the reserved UI Pause.
            Assert.AreEqual(RemapResult.Rejected, _catalog.ClassifyCandidate(slot.Id, "<Keyboard>/enter"));
            Assert.AreEqual(RemapResult.Rejected, _catalog.ClassifyCandidate(slot.Id, "<Keyboard>/p"));
        }

        [Test]
        public void AC29_RejectedCandidateCreatesNoOverride()
        {
            BindingSlot slot = Slot("Accelerate");
            Assert.AreEqual(RemapResult.Rejected, _catalog.TryRebind(slot.Id, "<Keyboard>/escape"));
            Assert.AreEqual(0, AllBindings().Count(b => !string.IsNullOrEmpty(b.overridePath)),
                "A rejected candidate must not create an override.");
        }

        [Test]
        public void AC29_GamepadReservedConflictRejected()
        {
            BindingSlot slot = Slot("Accelerate");
            string[] gamepadReserved = _catalog.ReservedSlots
                .Select(s => s.CurrentPath)
                .Where(p => p.StartsWith("<Gamepad>", StringComparison.Ordinal))
                .ToArray();
            Assert.IsNotEmpty(gamepadReserved, "Confirm/Cancel/Pause must expose gamepad bindings.");
            foreach (string path in gamepadReserved)
            {
                Assert.AreEqual(RemapResult.Rejected, _catalog.ClassifyCandidate(slot.Id, path),
                    $"Gamepad reserved path {path} must be rejected.");
            }
        }

        [Test]
        public void AC46_ReservedBindingCannotBeRebound()
        {
            BindingSlot confirm = _catalog.ReservedSlots.First(s => s.ActionName == "Confirm");
            Assert.AreEqual(RemapResult.Rejected, _catalog.TryRebind(confirm.Id, "<Keyboard>/x"));
            Assert.IsEmpty(_catalog.RemappableSlots.Where(s => s.ActionName == "Confirm"), "Confirm must not appear as remappable.");
        }

        [Test]
        public void AC46_ReservedBindingCannotBeRemoved()
        {
            BindingSlot cancel = _catalog.ReservedSlots.First(s => s.ActionName == "Cancel");
            Assert.IsFalse(_catalog.RemoveOverride(cancel.Id));
        }

                [Test]
        public void AC46_PauseCannotBeReboundOrRemoved()
        {
            BindingSlot pause = _catalog.ReservedSlots.First(s => s.ActionName == "Pause");
            Assert.AreEqual(RemapResult.Rejected, _catalog.TryRebind(pause.Id, "<Keyboard>/x"), "Pause cannot be rebound.");
            Assert.IsFalse(_catalog.RemoveOverride(pause.Id), "Pause override cannot be removed.");
        }

        [Test]
        public void AC46_GamepadReservedCannotBeRebound()
        {
            var gamepadReserved = _catalog.ReservedSlots
                .Where(s => s.CurrentPath.StartsWith("<Gamepad>", StringComparison.Ordinal))
                .ToArray();
            Assert.IsNotEmpty(gamepadReserved, "Confirm/Cancel/Pause must expose gamepad reserved slots.");
            foreach (BindingSlot slot in gamepadReserved)
            {
                Assert.AreEqual(RemapResult.Rejected, _catalog.TryRebind(slot.Id, "<Keyboard>/x"),
                    $"Gamepad reserved {slot.ActionName} ({slot.CurrentPath}) cannot be rebound.");
            }
        }

        [Test]
        public void AC46_RemappingCanBeRemovedRestoringDefault()
        {
            BindingSlot slot = Slot("Accelerate");
            Assert.AreEqual(RemapResult.Captured, _catalog.TryRebind(slot.Id, "<Keyboard>/x"));
            Assert.IsTrue(_catalog.RemoveOverride(slot.Id), "Remappable override can be removed.");
            Assert.AreEqual("<Keyboard>/w", EffectivePath(slot.Id), "Override removed; default path restored.");
        }

        [Test]
        public void AC46_ReservedBindingsExposedAsReservedSlots()
        {
            string[] reserved = _catalog.ReservedSlots.Select(s => s.ActionName).Distinct().ToArray();
            CollectionAssert.AreEquivalent(new[] { "Confirm", "Cancel", "Pause" }, reserved);
        }

        // ---- AC-66 / AC-67: binding overrides by stable id ----

        [Test]
        public void AC66_SteerLeftSecondaryOverridesOnlyThatBinding()
        {
            BindingSlot slot = _catalog.RemappableSlots.First(s => s.DisplayName == "Steer Left Secondary");

            Dictionary<Guid, string> before = SnapshotEffectivePaths();
            Assert.AreEqual(RemapResult.Captured, _catalog.TryRebind(slot.Id, "<Keyboard>/x"));
            Dictionary<Guid, string> after = SnapshotEffectivePaths();

            // Only the target slot changed; Steer Right and every other slot untouched.
            Assert.AreEqual(1, before.Count(kv => kv.Value != after[kv.Key]));
            Assert.AreEqual("<Keyboard>/x", after[slot.Id]);
        }

                [Test]
        public void AC66_CompositeRootUnchanged()
        {
            BindingSlot slot = _catalog.RemappableSlots.First(s => s.DisplayName == "Steer Left Secondary");
            string[] before = SteerCompositeRootPaths();
            Assert.AreEqual(RemapResult.Captured, _catalog.TryRebind(slot.Id, "<Keyboard>/x"));
            string[] after = SteerCompositeRootPaths();
            CollectionAssert.AreEqual(before, after, "Composite root bindings must remain unchanged.");
        }

        [Test]
        public void AC67_UnknownBindingIdFallsBackOnlyThatSlot()
        {
            BindingSlot slot = Slot("Accelerate");
            Guid unknownId = Guid.NewGuid();
            BindingOverride[] overrides =
            {
                new BindingOverride(slot.Id, "<Keyboard>/x"),
                new BindingOverride(unknownId, "<Keyboard>/y"),
            };

            Guid[] discarded = _catalog.ApplyOverrides(overrides);

            Assert.AreEqual(1, discarded.Length);
            Assert.AreEqual(unknownId, discarded[0]);
            Assert.AreEqual("<Keyboard>/x", EffectivePath(slot.Id), "Valid override applied.");
            Assert.AreEqual(1, AllBindings().Count(b => !string.IsNullOrEmpty(b.overridePath)),
                "Only the valid override is applied; the unknown id is discarded and every other slot stays untouched.");
        }

        [Test]
        public void AC67_MalformedKnownOverrideReportedNotApplied()
        {
            BindingSlot slot = Slot("Accelerate");
            BindingOverride[] overrides = { new BindingOverride(slot.Id, "<Keyboard>/nonexistent") };

            Guid[] notApplied = _catalog.ApplyOverrides(overrides);

            Assert.AreEqual(1, notApplied.Length, "Malformed known override is reported as not applied.");
            Assert.AreEqual(slot.Id, notApplied[0]);
            Assert.AreEqual(0, AllBindings().Count(b => !string.IsNullOrEmpty(b.overridePath)), "Nothing applied.");
        }

        [Test]
        public void AC67_MultipleUnknownIdsReported()
        {
            BindingSlot slot = Slot("Accelerate");
            Guid u1 = Guid.NewGuid();
            Guid u2 = Guid.NewGuid();
            BindingOverride[] overrides =
            {
                new BindingOverride(slot.Id, "<Keyboard>/x"),
                new BindingOverride(u1, "<Keyboard>/y"),
                new BindingOverride(u2, "<Keyboard>/z"),
            };

            Guid[] notApplied = _catalog.ApplyOverrides(overrides);

            Assert.AreEqual(2, notApplied.Length);
            CollectionAssert.AreEquivalent(new[] { u1, u2 }, notApplied);
            Assert.AreEqual("<Keyboard>/x", EffectivePath(slot.Id), "Valid override still applied.");
            Assert.AreEqual(1, AllBindings().Count(b => !string.IsNullOrEmpty(b.overridePath)));
        }

        [Test]
        public void AC67_EmptyOverrideListAppliesNothing()
        {
            Guid[] notApplied = _catalog.ApplyOverrides(Array.Empty<BindingOverride>());

            Assert.IsEmpty(notApplied);
            Assert.AreEqual(0, AllBindings().Count(b => !string.IsNullOrEmpty(b.overridePath)));
        }

        // ---- Helpers ----

        private static RawInputSample MakeSample(float accelerateRaw = 0f, float brakeRaw = 0f, float steerRaw = 0f)
        {
            return new RawInputSample(1, ControlScheme.Gamepad, accelerateRaw, brakeRaw, steerRaw, false, InputAvailability.Available, RawInputValidityFlags.None);
        }

        private BindingSlot Slot(string actionName)
        {
            return _catalog.RemappableSlots.First(s => s.ActionName == actionName);
        }

                private string EffectivePath(Guid id)
        {
            foreach (InputActionMap actionMap in _actions.asset.actionMaps)
            {
                foreach (InputAction action in actionMap.actions)
                {
                    foreach (InputBinding binding in action.bindings)
                    {
                        if (binding.id == id)
                        {
                            return binding.overridePath ?? binding.path;
                        }
                    }
                }
            }

            return null;
        }

                private IEnumerable<InputBinding> AllBindings()
        {
            foreach (InputActionMap actionMap in _actions.asset.actionMaps)
            {
                foreach (InputAction action in actionMap.actions)
                {
                    foreach (InputBinding binding in action.bindings)
                    {
                        if (!binding.isComposite)
                        {
                            yield return binding;
                        }
                    }
                }
            }
        }

        private Dictionary<Guid, string> SnapshotEffectivePaths()
        {
            var map = new Dictionary<Guid, string>();
            foreach (InputBinding binding in AllBindings())
            {
                map[binding.id] = binding.overridePath ?? binding.path;
            }

            return map;
        }

        private string[] SteerCompositeRootPaths()
        {
            List<string> roots = new List<string>();
            foreach (InputActionMap actionMap in _actions.asset.actionMaps)
            {
                foreach (InputAction action in actionMap.actions)
                {
                    if (action.name != "Steer")
                    {
                        continue;
                    }

                    foreach (InputBinding binding in action.bindings)
                    {
                        if (binding.isComposite)
                        {
                            roots.Add(binding.overridePath ?? binding.path);
                        }
                    }
                }
            }

            return roots.ToArray();
        }
    }
}
