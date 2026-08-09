using System.Collections;
using System.Collections.Generic;
using NUnit.Framework;
using Overdrive.Input;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
using UnityEngine.TestTools;

namespace Overdrive.Input.Tests
{
    /// <summary>Unit evidence for Story 005's scheme arbitration and no-device behaviour.</summary>
    [TestFixture]
    public sealed class SchemeArbitrationTests : InputTestFixture
    {
        private GameObject _eventSystemObject;
        private InputSystemUIInputModule _uiModule;
        private InputSystem_Actions _actions;
        private InputContextController _controller;

        [SetUp]
        public void SetUpStory005()
        {
            _eventSystemObject = new GameObject("EventSystem");
            _eventSystemObject.AddComponent<EventSystem>();
            _uiModule = _eventSystemObject.AddComponent<InputSystemUIInputModule>();
            _uiModule.enabled = false;
            _actions = new InputSystem_Actions();
            _controller = new InputContextController(_actions, _uiModule);
        }

        [TearDown]
        public void TearDownStory005()
        {
            _controller?.Unbind();
            _actions?.Dispose();
            if (_eventSystemObject != null)
            {
                Object.DestroyImmediate(_eventSystemObject);
            }
        }

        [UnityTest]
        public IEnumerator AC8_GamepadDisconnectFallsBackToKeyboardMouse()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            var telemetry = new TelemetrySampleCounter();

            // Driver tick under Gamepad (meaningful trigger input activates it).
            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());
            _controller.CaptureLatestRawSample();
            telemetry.Record();

            // Disconnect; the next driver tick falls back to KeyboardMouse, telemetry continues.
            InputSystem.RemoveDevice(gamepad);
            yield return null;
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ResolveActiveScheme());
            _controller.CaptureLatestRawSample(); // driver tick under KeyboardMouse (post-disconnect)
            telemetry.Record();

            // Captured values come from KeyboardMouse, not a stale or zeroed gamepad.
            Press(keyboard.wKey);
            yield return null;
            RawInputSample sample = _controller.CaptureLatestRawSample();
            Assert.AreEqual(ControlScheme.KeyboardMouse, sample.ActiveScheme);
            Assert.AreEqual(1f, sample.AccelerateRaw, 1e-4f);
            Assert.AreEqual(InputAvailability.Available, sample.Availability);
            telemetry.Record();

            Assert.AreEqual(3, telemetry.Samples);
            // The arbitration is side-effect-free: the driver kept producing 3 real captures across
            // the disconnect, so telemetry's 1-sample-per-tick continuity is backed by real capture
            // progress (not a manually-pumped counter).
            Assert.AreEqual(3, _controller.CaptureCount);
        }

        [UnityTest]
        public IEnumerator AC9_NoDeviceForcesZeroedInputAndRecovers()
        {
            // InputTestFixture starts with zero devices — the "no device" state.
            _controller.SetGameplayContext();
            yield return null;

            RawInputSample sample = _controller.CaptureLatestRawSample();
            Assert.AreEqual(InputAvailability.NoInputDevice, sample.Availability);
            Assert.AreEqual(0f, sample.AccelerateRaw);
            Assert.AreEqual(0f, sample.BrakeRaw);
            Assert.AreEqual(0f, sample.SteerRaw);
            Assert.AreEqual(RawInputValidityFlags.None, sample.ValidityFlags);
            Assert.IsFalse(sample.PauseRise);

            var processor = new TickProcessor();
            SimulationInput input = processor.ProcessTick(sample, false);
            Assert.AreEqual(InputAvailability.NoInputDevice, input.Availability);
            Assert.AreEqual(0f, input.AccelerateOut);
            Assert.AreEqual(0f, input.BrakeOut);
            Assert.AreEqual(0f, input.SteerOut);

            // Disconnect while input was held: the device's last value must not leak into the sample.
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());
            RawInputSample held = _controller.CaptureLatestRawSample();
            Assert.AreEqual(0.6f, held.AccelerateRaw, 1e-4f);
            Assert.AreEqual(InputAvailability.Available, held.Availability);

            InputSystem.RemoveDevice(gamepad);
            yield return null;
            RawInputSample zeroed = _controller.CaptureLatestRawSample();
            Assert.AreEqual(InputAvailability.NoInputDevice, zeroed.Availability);
            Assert.AreEqual(0f, zeroed.AccelerateRaw, 1e-4f);
            Assert.AreEqual(0f, zeroed.BrakeRaw, 1e-4f);
            Assert.AreEqual(0f, zeroed.SteerRaw, 1e-4f);
            Assert.AreEqual(RawInputValidityFlags.None, zeroed.ValidityFlags);
            Assert.IsFalse(zeroed.PauseRise);

            // Persistence: several consecutive no-device ticks stay zeroed through SimulationInput
            // (the car coasts; the simulation never freezes).
            for (int i = 0; i < 3; i++)
            {
                RawInputSample noDeviceSample = _controller.CaptureLatestRawSample();
                SimulationInput zeroInput = processor.ProcessTick(noDeviceSample, false);
                Assert.AreEqual(InputAvailability.NoInputDevice, zeroInput.Availability);
                Assert.AreEqual(0f, zeroInput.AccelerateOut);
                Assert.AreEqual(0f, zeroInput.BrakeOut);
                Assert.AreEqual(0f, zeroInput.SteerOut);
            }

            // Availability returns once a scheme becomes eligible again.
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            yield return null;
            RawInputSample recovered = _controller.CaptureLatestRawSample();
            Assert.AreEqual(InputAvailability.Available, recovered.Availability);
        }

        [UnityTest]
        public IEnumerator AC23_GamepadMeaningfulActivatesGamepadAndReinitializesEma()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ActiveScheme);

            // Accumulate EMA state under KeyboardMouse (an empty sample primes the recurrence).
            var processor = new TickProcessor();
            processor.ProcessTick(_controller.CaptureLatestRawSample(), false);

            // The production handoff component (which the Simulation driver owns) reinitializes
            // the EMA from the new scheme's post-dead-zone sample on every scheme change.
            var reinitializer = new SchemeChangeEmaReinitializer(_controller, processor);
            reinitializer.Enable();

            Set(gamepad.rightTrigger, 0.8f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());

            // First tick after the switch carries no filtered value from the prior scheme:
            // prev was reinitialized to post-dead-zone(0.8), so output equals it exactly.
            SimulationInput input = processor.ProcessTick(_controller.CaptureLatestRawSample(), false);
            float postDz = DeadZoneNormalizer.NormalizeTrigger(0.8f, TickProcessor.DefaultTriggerInner);
            Assert.AreEqual(postDz, input.AccelerateOut, 0.0001f);

            reinitializer.Disable();
        }

        [UnityTest]
        public IEnumerator AC23_TriggerExactlyAtThresholdIsNotMeaningful()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            // Trigger exactly at the inner threshold → NOT meaningful; scheme stays KeyboardMouse.
            Set(gamepad.rightTrigger, DeadZoneNormalizer.TriggerInnerThreshold);
            yield return null;
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ResolveActiveScheme());

            // Just above the threshold → meaningful; scheme switches to Gamepad.
            Set(gamepad.rightTrigger, DeadZoneNormalizer.TriggerInnerThreshold + 0.001f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());
        }

        [UnityTest]
        public IEnumerator AC23_StickMagnitudeAboveInnerThresholdActivatesGamepad()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            // Stick magnitude just above the inner threshold → meaningful.
            Set(gamepad.leftStick, new Vector2(DeadZoneNormalizer.StickInnerThreshold + 0.001f, 0f));
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());
        }

        [UnityTest]
        public IEnumerator AC23_StartActivatesGamepad()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ActiveScheme);

            // Start is a meaningful digital category (Pause binding, press edge). The press marks
            // the pending edge; the subsequent scheme change clears it (covered by AC-40).
            Press(gamepad.startButton);
            yield return null;
            Assert.IsTrue(_controller.HasPendingPauseEdge);
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());
        }

        [UnityTest]
        public IEnumerator AC39_GamepadDisconnectInQualifyingFallsBackToKeyboardMouse()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            // GameplayQualifying uses the same gameplay map; the Input context is Gameplay (the
            // RSM owns the RaceMode distinction, not the input controller).
            _controller.SetGameplayContext();
            yield return null;

            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());

            // Prime EMA with a non-zero previous value under Gamepad (throttle converges toward 0.6).
            var processor = new TickProcessor();
            processor.ProcessTick(_controller.CaptureLatestRawSample(), false);

            var reinitializer = new SchemeChangeEmaReinitializer(_controller, processor);
            reinitializer.Enable();

            InputSystem.RemoveDevice(gamepad);
            yield return null;
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ResolveActiveScheme());

            // First keyboard tick: prev was reinitialized to the KeyboardMouse sample at the
            // switch (raws 0 — no key pressed), so output = α·1 + (1−α)·0 = α. Without the reinit
            // the gamepad prev (~0.6) would leak.
            Press(keyboard.wKey);
            yield return null;
            RawInputSample kbSample = _controller.CaptureLatestRawSample();
            SimulationInput input = processor.ProcessTick(kbSample, false);
            Assert.AreEqual(EmaBrakePriority.DefaultAccelerateAlpha, input.AccelerateOut, 0.0001f);

            reinitializer.Disable();
        }

        [UnityTest]
        public IEnumerator AC40_SchemeChangeClearsPendingPause()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());

            Press(gamepad.startButton);
            yield return null;
            Assert.IsTrue(_controller.HasPendingPauseEdge);

            // The driver consumes the start-button meaningful flag each update (still Gamepad,
            // so the pending Pause edge survives — SetActiveScheme clears it only on a change).
            _controller.ResolveActiveScheme();

            // Capture with a pending pause BEFORE the scheme change → the sample carries the edge.
            RawInputSample beforeChange = _controller.CaptureLatestRawSample();
            Assert.IsTrue(beforeChange.PauseRise);

            // Release the trigger, then keyboard meaningful input (W) flips the scheme.
            Set(gamepad.rightTrigger, 0f);
            Press(keyboard.wKey);
            yield return null;
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ResolveActiveScheme());
            Assert.IsFalse(_controller.HasPendingPauseEdge);

            // The next capture (after the scheme change cleared the latch) carries no edge.
            RawInputSample afterChange = _controller.CaptureLatestRawSample();
            Assert.IsFalse(afterChange.PauseRise);
        }

        [UnityTest]
        public IEnumerator AC43_KeyboardMouseIsDefaultSchemeWithConnectedGamepad()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ActiveScheme);
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ResolveActiveScheme());
        }

        [UnityTest]
        public IEnumerator AC60_KeyboardMeaningfulWinsBeforeRawCapture()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());

            // A fake driver plays the role of the Simulation driver: it resolves the scheme
            // BEFORE capture inside its own Update loop (AC-60) and records the explicit order.
            var recorder = new ArbitrationOrderRecorder();
            var driverObject = new GameObject("FakeArbitrationDriver");
            FakeArbitrationDriver driver = driverObject.AddComponent<FakeArbitrationDriver>();
            driver.Controller = _controller;
            driver.Recorder = recorder;

            // Keyboard meaningful (W) after the trigger is released.
            Set(gamepad.rightTrigger, 0f);
            Press(keyboard.wKey);
            yield return null;
            yield return null; // let the fake driver run one full update

            recorder.AssertArbitrationPrecedesCapture();
            Assert.AreEqual(ControlScheme.KeyboardMouse, driver.LastSample.ActiveScheme);

            Object.Destroy(driverObject);
        }

        [UnityTest]
        public IEnumerator AC60_PointerDeltaBoundaryMeaningful()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            Mouse mouse = InputSystem.AddDevice<Mouse>();
            _controller.SetGameplayContext();
            yield return null;

            // Exactly 2 px → meaningful: with Gamepad active it flips to KeyboardMouse.
            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());

            Set(gamepad.rightTrigger, 0f);
            Set(mouse.delta, new Vector2(2f, 0f));
            yield return null;
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ResolveActiveScheme());

            // Below 2 px → NOT meaningful: with Gamepad active it is preserved.
            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());

            Set(gamepad.rightTrigger, 0f);
            Set(mouse.delta, new Vector2(1.9f, 0f));
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());
        }

        [UnityTest]
        public IEnumerator AC60_MouseAloneMakesKeyboardMouseEligible()
        {
            Mouse mouse = InputSystem.AddDevice<Mouse>();
            _controller.SetGameplayContext();
            yield return null;

            // Mouse alone → KeyboardMouse is eligible (and default).
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ActiveScheme);
            Assert.AreEqual(InputAvailability.Available, _controller.CaptureLatestRawSample().Availability);

            // Pointer movement beyond the boundary is keyboard-meaningful.
            Set(mouse.delta, new Vector2(3f, 0f));
            yield return null;
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ResolveActiveScheme());
        }

        [UnityTest]
        public IEnumerator AC61_DpadActivatesGamepadAndUpdatesPrompts()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            // Navigate is a UI action — activate UI context so the D-pad route is live.
            _controller.SetUIContext();
            yield return null;

            var glyphConsumer = new PromptGlyphConsumer();
            _controller.OnActiveSchemeChanged += glyphConsumer.OnSchemeChanged;

            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ActiveScheme);

            Press(gamepad.dpad.up);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());
            Assert.AreEqual(ControlScheme.Gamepad, glyphConsumer.LastScheme);
            Assert.AreEqual(1, glyphConsumer.EventCount);

            _controller.OnActiveSchemeChanged -= glyphConsumer.OnSchemeChanged;
        }

        [UnityTest]
        public IEnumerator AC61_DpadDownActivatesGamepad()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            // Navigate is a UI action — activate UI context so the D-pad route is live.
            _controller.SetUIContext();
            yield return null;

            var glyphConsumer = new PromptGlyphConsumer();
            _controller.OnActiveSchemeChanged += glyphConsumer.OnSchemeChanged;

            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ActiveScheme);

            // Any D-pad direction is meaningful — Down activates Gamepad the same way as Up.
            Press(gamepad.dpad.down);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());
            Assert.AreEqual(ControlScheme.Gamepad, glyphConsumer.LastScheme);
            Assert.AreEqual(1, glyphConsumer.EventCount);

            _controller.OnActiveSchemeChanged -= glyphConsumer.OnSchemeChanged;
        }

        [UnityTest]
        public IEnumerator AC62_SameFrameBothSchemesPreserveCurrentScheme()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());

            // Both meaningful in one update: gamepad analog still held + keyboard W pressed.
            Press(keyboard.wKey);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());
        }

        [UnityTest]
        public IEnumerator AC62_KeyboardMouseCurrentBothMeaningfulPreservesKeyboardMouse()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            // KeyboardMouse current. Both meaningful in one update → preserved (anti-oscillation).
            Press(keyboard.wKey);
            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ResolveActiveScheme());
        }

        [UnityTest]
        public IEnumerator AC62_DeviceLossPrecedenceOverAntiOscillation()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            var glyphConsumer = new PromptGlyphConsumer();
            _controller.OnActiveSchemeChanged += glyphConsumer.OnSchemeChanged;

            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());
            Assert.AreEqual(1, glyphConsumer.EventCount);
            glyphConsumer.Reset();

            // Current scheme loses its device: eligibility wins — KeyboardMouse is not preserved out.
            InputSystem.RemoveDevice(gamepad);
            yield return null;
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ResolveActiveScheme());
            Assert.AreEqual(1, glyphConsumer.EventCount); // exactly one emission for the fallback
            Assert.AreEqual(ControlScheme.KeyboardMouse, glyphConsumer.LastScheme);

            _controller.OnActiveSchemeChanged -= glyphConsumer.OnSchemeChanged;
        }

        [UnityTest]
        public IEnumerator AC62_NeitherSchemeEligibleKeepsSchemeButAvailabilityDrops()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());

            // Both devices disconnect → no eligible scheme. The scheme stays stale (no eligible
            // fallback), but availability drops to NoInputDevice and capture zeroes the channels.
            InputSystem.RemoveDevice(gamepad);
            InputSystem.RemoveDevice(keyboard);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ActiveScheme);
            RawInputSample sample = _controller.CaptureLatestRawSample();
            Assert.AreEqual(ControlScheme.Gamepad, sample.ActiveScheme); // stale scheme preserved
            Assert.AreEqual(InputAvailability.NoInputDevice, sample.Availability);
            Assert.AreEqual(0f, sample.AccelerateRaw, 1e-4f);
            Assert.AreEqual(0f, sample.BrakeRaw, 1e-4f);
            Assert.AreEqual(0f, sample.SteerRaw, 1e-4f);
            Assert.AreEqual(RawInputValidityFlags.None, sample.ValidityFlags);
        }

        [UnityTest]
        public IEnumerator AC62_KeyboardMouseStaleWhenNeitherEligible()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            // KeyboardMouse current (default). Both devices disconnect → KeyboardMouse stays stale.
            InputSystem.RemoveDevice(keyboard);
            InputSystem.RemoveDevice(gamepad);
            yield return null;
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ActiveScheme);
            RawInputSample sample = _controller.CaptureLatestRawSample();
            Assert.AreEqual(ControlScheme.KeyboardMouse, sample.ActiveScheme);
            Assert.AreEqual(InputAvailability.NoInputDevice, sample.Availability);
        }

        [UnityTest]
        public IEnumerator AC62_OnActiveSchemeChangedNotEmittedOnPreserve()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            var glyphConsumer = new PromptGlyphConsumer();
            _controller.OnActiveSchemeChanged += glyphConsumer.OnSchemeChanged;

            // Gamepad active → event emitted once.
            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());
            Assert.AreEqual(1, glyphConsumer.EventCount);
            glyphConsumer.Reset();

            // Both meaningful → scheme preserved → event NOT emitted again.
            Press(keyboard.wKey);
            yield return null;
            _controller.ResolveActiveScheme();
            Assert.AreEqual(0, glyphConsumer.EventCount); // no new emission
            Assert.AreEqual(ControlScheme.KeyboardMouse, glyphConsumer.LastScheme); // reset default

            _controller.OnActiveSchemeChanged -= glyphConsumer.OnSchemeChanged;
        }

        [UnityTest]
        public IEnumerator AC62_ReconnectedSameSchemeReinitializesEma()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());

            // Prime EMA with a non-zero previous value under Gamepad.
            var processor = new TickProcessor();
            processor.ProcessTick(_controller.CaptureLatestRawSample(), false);

            var reinitializer = new SchemeChangeEmaReinitializer(_controller, processor);
            reinitializer.Enable();

            // Both devices disconnect → NoInputDevice (the active scheme stays stale Gamepad).
            InputSystem.RemoveDevice(gamepad);
            InputSystem.RemoveDevice(keyboard);
            yield return null;
            Assert.AreEqual(InputAvailability.NoInputDevice, _controller.CaptureLatestRawSample().Availability);

            // The same gamepad reconnects → scheme unchanged (Gamepad), but availability recovers
            // to Available, which re-seeds the EMA from the recovered sample (no stale ~0.6 leak).
            Gamepad replacement = InputSystem.AddDevice<Gamepad>();
            Set(replacement.rightTrigger, 0.8f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());
            SimulationInput input = processor.ProcessTick(_controller.CaptureLatestRawSample(), false);
            float postDz = DeadZoneNormalizer.NormalizeTrigger(0.8f, TickProcessor.DefaultTriggerInner);
            Assert.AreEqual(postDz, input.AccelerateOut, 0.0001f);

            reinitializer.Disable();
        }

        [UnityTest]
        public IEnumerator ReinitializerDoubleEnableSingleDisableRemovesAllCallbacks()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());

            var processor = new TickProcessor();
            processor.ProcessTick(_controller.CaptureLatestRawSample(), false); // prev ~0.6

            // Without the guard, double-Enable would subscribe the callback twice; a single Disable
            // removes the ONLY subscription, leaving the EMA untouched by later changes.
            var reinitializer = new SchemeChangeEmaReinitializer(_controller, processor);
            reinitializer.Enable();
            reinitializer.Enable();
            reinitializer.Disable();

            InputSystem.RemoveDevice(gamepad);
            yield return null;
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ResolveActiveScheme());

            SimulationInput input = processor.ProcessTick(_controller.CaptureLatestRawSample(), false);
            Assert.Greater(input.AccelerateOut, 0.01f); // callback removed → old EMA state preserved
        }

        [UnityTest]
        public IEnumerator AC23_DisabledReinitializerLeavesEmaUntouched()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());

            var processor = new TickProcessor();
            processor.ProcessTick(_controller.CaptureLatestRawSample(), false); // prev 0.18
            processor.ProcessTick(_controller.CaptureLatestRawSample(), false); // ~0.42

            var reinitializer = new SchemeChangeEmaReinitializer(_controller, processor);
            reinitializer.Enable();
            reinitializer.Disable(); // disabled before any change

            // Scheme change after Disable → the EMA must NOT be re-seeded.
            InputSystem.RemoveDevice(gamepad);
            yield return null;
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ResolveActiveScheme());

            SimulationInput input = processor.ProcessTick(_controller.CaptureLatestRawSample(), false);
            Assert.Greater(input.AccelerateOut, 0.01f); // estado EMA antigo preservado
        }

        [UnityTest]
        public IEnumerator AC59_ReinitializerDoesNotInflateCaptureCount()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            var processor = new TickProcessor();
            var reinitializer = new SchemeChangeEmaReinitializer(_controller, processor);
            reinitializer.Enable();

            // Gamepad ativo via meaningful trigger.
            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            int before = _controller.CaptureCount;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme()); // reinit usa Peek

            // 1 capture do driver; o Peek interno do reinitializer NÃO infla (AC-59: 1/frame).
            _controller.CaptureLatestRawSample();
            Assert.AreEqual(before + 1, _controller.CaptureCount);

            reinitializer.Disable();
        }

        [UnityTest]
        public IEnumerator AC62_AvailabilityTransitionEventsFireExactlyOnce()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            _controller.SetGameplayContext();
            yield return null;

            var observer = new AvailabilityObserver();
            _controller.OnAvailabilityChanged += observer.OnChanged;

            // First capture: synthetic transition to Available (default was NoInputDevice).
            _controller.CaptureLatestRawSample();
            Assert.AreEqual(1, observer.AvailableCount);
            Assert.AreEqual(0, observer.NoInputDeviceCount);
            observer.Reset();

            // Repeated captures with stable availability → NO event.
            _controller.CaptureLatestRawSample();
            _controller.CaptureLatestRawSample();
            Assert.AreEqual(0, observer.AvailableCount + observer.NoInputDeviceCount);

            // Remove keyboard → NoInputDevice (exactly 1).
            InputSystem.RemoveDevice(keyboard);
            yield return null;
            _controller.CaptureLatestRawSample();
            Assert.AreEqual(1, observer.NoInputDeviceCount);
            Assert.AreEqual(0, observer.AvailableCount);

            // Captures repetidos → NENHUM.
            _controller.CaptureLatestRawSample();
            Assert.AreEqual(1, observer.NoInputDeviceCount);

            // Re-add keyboard → Available (exactly 1).
            InputSystem.AddDevice<Keyboard>();
            yield return null;
            _controller.CaptureLatestRawSample();
            Assert.AreEqual(1, observer.AvailableCount);

            _controller.OnAvailabilityChanged -= observer.OnChanged;
        }

        [UnityTest]
        public IEnumerator AC23_DisabledReinitializerLeavesEmaUntouchedOnAvailabilityRecovery()
        {
            Keyboard keyboard = InputSystem.AddDevice<Keyboard>();
            Gamepad gamepad = InputSystem.AddDevice<Gamepad>();
            _controller.SetGameplayContext();
            yield return null;

            Set(gamepad.rightTrigger, 0.6f);
            yield return null;
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ResolveActiveScheme());

            var processor = new TickProcessor();
            processor.ProcessTick(_controller.CaptureLatestRawSample(), false); // prev 0.18
            processor.ProcessTick(_controller.CaptureLatestRawSample(), false); // ~0.42

            var reinitializer = new SchemeChangeEmaReinitializer(_controller, processor);
            reinitializer.Enable();
            reinitializer.Disable(); // disabled

            // Ambos desconectam → NoInputDevice.
            InputSystem.RemoveDevice(gamepad);
            InputSystem.RemoveDevice(keyboard);
            yield return null;
            _controller.CaptureLatestRawSample();

            // Gamepad reconnects → availability Available, but the reinitializer is disabled → EMA
            // NOT re-seeded (the old ~0.42 state remains, not post-dz(0.8)).
            Gamepad replacement = InputSystem.AddDevice<Gamepad>();
            Set(replacement.rightTrigger, 0.8f);
            yield return null;
            SimulationInput input = processor.ProcessTick(_controller.CaptureLatestRawSample(), false);
            float postDz = DeadZoneNormalizer.NormalizeTrigger(0.8f, TickProcessor.DefaultTriggerInner);
            Assert.That(input.AccelerateOut, Is.Not.EqualTo(postDz).Within(0.001f));
        }

        /// <summary>Records the driver's explicit call order: arbitration must precede capture (AC-60).</summary>
        private sealed class ArbitrationOrderRecorder
        {
            private readonly List<string> _steps = new List<string>();

            public void Record(string step)
            {
                _steps.Add(step);
            }

            public void AssertArbitrationPrecedesCapture()
            {
                Assert.AreEqual("arbitration", _steps[0]);
                Assert.AreEqual("capture", _steps[1]);
            }
        }

        /// <summary>Simulates the Simulation driver's per-frame update: resolve arbitration, then capture.</summary>
        private sealed class FakeArbitrationDriver : MonoBehaviour
        {
            public InputContextController Controller;

            public ArbitrationOrderRecorder Recorder;

            public RawInputSample LastSample { get; private set; }

            private void Update()
            {
                Recorder.Record("arbitration");
                Controller.ResolveActiveScheme(); // arbitration BEFORE capture (AC-60)
                Recorder.Record("capture");
                LastSample = Controller.CaptureLatestRawSample();
            }
        }

        /// <summary>Mock observer: records one sample per driver tick; must never reset or stop.</summary>
        private sealed class TelemetrySampleCounter
        {
            public int Samples { get; private set; }

            public void Record()
            {
                Samples++;
            }
        }

        /// <summary>Mock prompt-glyph consumer: observes OnActiveSchemeChanged (ADR-0005 seam).</summary>
        private sealed class PromptGlyphConsumer
        {
            public ControlScheme LastScheme { get; private set; } = ControlScheme.KeyboardMouse;

            public int EventCount { get; private set; }

            public void OnSchemeChanged(ControlScheme scheme)
            {
                EventCount++;
                LastScheme = scheme;
            }

            public void Reset()
            {
                LastScheme = ControlScheme.KeyboardMouse;
                EventCount = 0;
            }
        }

        /// <summary>Mock availability observer: counts transition events per direction.</summary>
        private sealed class AvailabilityObserver
        {
            public int AvailableCount { get; private set; }

            public int NoInputDeviceCount { get; private set; }

            public void OnChanged(InputAvailability availability)
            {
                if (availability == InputAvailability.Available)
                {
                    AvailableCount++;
                }
                else
                {
                    NoInputDeviceCount++;
                }
            }

            public void Reset()
            {
                AvailableCount = 0;
                NoInputDeviceCount = 0;
            }
        }
    }
}
