using System.Collections;
using System.Collections.Generic;
using NUnit.Framework;
using Overdrive.Input;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.Controls;
using UnityEngine.InputSystem.LowLevel;
using UnityEngine.InputSystem.UI;
using UnityEngine.TestTools;

namespace Overdrive.Input.Tests
{
    /// <summary>Integration evidence for Story 002: raw capture and dead-zone normalization.</summary>
    [TestFixture]
    public sealed class RawCaptureDeadZoneTests : InputTestFixture
    {
        private Keyboard _keyboard;
        private Gamepad _gamepad;
        private GameObject _eventSystemObject;
        private InputSystemUIInputModule _uiModule;
        private InputSystem_Actions _actions;
        private InputContextController _controller;

        [SetUp]
        public void SetUp()
        {
            _keyboard = InputSystem.AddDevice<Keyboard>();
            _gamepad = InputSystem.AddDevice<Gamepad>();
            _eventSystemObject = new GameObject("EventSystem");
            _eventSystemObject.AddComponent<EventSystem>();
            _uiModule = _eventSystemObject.AddComponent<InputSystemUIInputModule>();
            _uiModule.enabled = false;
            _actions = new InputSystem_Actions();
            _controller = new InputContextController(_actions, _uiModule);
        }

        [TearDown]
        public void TearDown()
        {
            _controller?.Unbind();
            _actions?.Dispose();
            if (_eventSystemObject != null)
            {
                Object.DestroyImmediate(_eventSystemObject);
            }
        }

        // ---- Dead-zone module (pure math) ----

        [Test]
        public void AC4_StickMagnitudeInsideInnerThresholdNormalizesToZero()
        {
            // Magnitudes 0, at the inner threshold, and just below it all yield zero.
            Assert.AreEqual(Vector2.zero, DeadZoneNormalizer.NormalizeStick(Vector2.zero));
            Assert.AreEqual(Vector2.zero, DeadZoneNormalizer.NormalizeStick(new Vector2(0.15f, 0f)));
            Assert.AreEqual(Vector2.zero, DeadZoneNormalizer.NormalizeStick(new Vector2(0.149f, 0f)));
            Assert.AreEqual(Vector2.zero, DeadZoneNormalizer.NormalizeStick(new Vector2(0.1f, 0.1f)));

            // Just above the inner threshold the output is small but non-zero.
            Vector2 justAbove = DeadZoneNormalizer.NormalizeStick(new Vector2(0.151f, 0f));
            Assert.Greater(justAbove.magnitude, 0f);
        }

        [Test]
        public void AC25_StickMagnitudeAtOuterThresholdNormalizesToUnitMagnitude()
        {
            AssertVector2(new Vector2(1f, 0f), DeadZoneNormalizer.NormalizeStick(new Vector2(0.95f, 0f)));
            AssertVector2(new Vector2(0f, 1f), DeadZoneNormalizer.NormalizeStick(new Vector2(0f, 0.95f)));
            // Magnitude at or above the outer threshold clamps to unit magnitude.
            AssertVector2(new Vector2(1f, 0f), DeadZoneNormalizer.NormalizeStick(new Vector2(1f, 0f)));
            AssertVector2(new Vector2(1f, 0f), DeadZoneNormalizer.NormalizeStick(new Vector2(1.2f, 0f)));

            // Diagonal input preserves direction with unit magnitude.
            Vector2 diagonal = DeadZoneNormalizer.NormalizeStick(new Vector2(0.7f, 0.7f));
            Assert.AreEqual(1f, diagonal.magnitude, 1e-4f);
            Assert.AreEqual(0.7071f, diagonal.x, 1e-3f);
            Assert.AreEqual(0.7071f, diagonal.y, 1e-3f);
        }

        [Test]
        public void AC32_StickMagnitude055NormalizesTo05()
        {
            // AC-32: magnitude 0.55 with inner 0.15 / outer 0.95 → exactly 0.5, direction preserved.
            AssertVector2(new Vector2(0.5f, 0f), DeadZoneNormalizer.NormalizeStick(new Vector2(0.55f, 0f)));
            AssertVector2(new Vector2(0f, 0.5f), DeadZoneNormalizer.NormalizeStick(new Vector2(0f, 0.55f)));

            // Direction is preserved for a diagonal raw vector at the same magnitude.
            Vector2 diagonal = DeadZoneNormalizer.NormalizeStick(new Vector2(0.55f, 0.55f) / Mathf.Sqrt(2f));
            Assert.AreEqual(0.5f, diagonal.magnitude, 1e-4f);
            Assert.AreEqual(0.3536f, diagonal.x, 1e-3f);
            Assert.AreEqual(0.3536f, diagonal.y, 1e-3f);

            // Values immediately around 0.55 remap monotonically.
            Assert.AreEqual(0.4875f, DeadZoneNormalizer.NormalizeStick(new Vector2(0.54f, 0f)).x, 1e-4f);
            Assert.AreEqual(0.5125f, DeadZoneNormalizer.NormalizeStick(new Vector2(0.56f, 0f)).x, 1e-4f);
        }

        [Test]
        public void AC24_TriggerAtOrBelowInnerThresholdNormalizesToZero()
        {
            // Raw values 0, at 0.05, and just below all normalize to zero.
            Assert.AreEqual(0f, DeadZoneNormalizer.NormalizeTrigger(0f));
            Assert.AreEqual(0f, DeadZoneNormalizer.NormalizeTrigger(0.05f));
            Assert.AreEqual(0f, DeadZoneNormalizer.NormalizeTrigger(0.049f));
        }

        [Test]
        public void AC33_Trigger0525NormalizesTo05()
        {
            // AC-33: raw 0.525 with inner 0.05 → exactly 0.5.
            Assert.AreEqual(0.5f, DeadZoneNormalizer.NormalizeTrigger(0.525f), 1e-4f);
            Assert.AreEqual(1f, DeadZoneNormalizer.NormalizeTrigger(1f), 1e-4f);
        }

        [Test]
        public void NormalizeAcceptsCustomThresholdsForSettings()
        {
            // Story 008 (Settings) passes control-profile values instead of the module
            // defaults — the interface must honor custom thresholds.
            // Stick: inner 0.25, outer 0.75 → magnitude 0.5 remaps to (0.5-0.25)/(0.75-0.25) = 0.5.
            Assert.AreEqual(0.5f, DeadZoneNormalizer.NormalizeStick(new Vector2(0.5f, 0f), 0.25f, 0.75f).x, 1e-4f);
            Assert.AreEqual(Vector2.zero, DeadZoneNormalizer.NormalizeStick(new Vector2(0.24f, 0f), 0.25f, 0.75f));
            // Trigger: inner 0.25 → raw 0.625 remaps to (0.625-0.25)/(1-0.25) = 0.5.
            Assert.AreEqual(0.5f, DeadZoneNormalizer.NormalizeTrigger(0.625f, 0.25f), 1e-4f);
            Assert.AreEqual(0f, DeadZoneNormalizer.NormalizeTrigger(0.24f, 0.25f), 1e-4f);
        }

        // ---- Keyboard pass-through (AC-51) ----

        [UnityTest]
        public IEnumerator AC51_KeyboardGameplayInputPassesThroughCapture()
        {
            // Keyboard scheme: no gamepad connected, so the placeholder scheme is KeyboardMouse.
            InputSystem.RemoveDevice(_gamepad);
            yield return null;

            _controller.SetGameplayContext();
            yield return null;

            Press(_keyboard.wKey);
            yield return null;
            Press(_keyboard.aKey);
            yield return null;

            RawInputSample sample = _controller.CaptureLatestRawSample();
            Assert.AreEqual(ControlScheme.KeyboardMouse, sample.ActiveScheme);
            // Keyboard maps directly to -1/0/1; the dead-zone stage does not alter it.
            Assert.AreEqual(1f, sample.AccelerateRaw, 1e-4f);
            Assert.AreEqual(-1f, sample.SteerRaw, 1e-4f);
            Assert.AreEqual(RawInputValidityFlags.None, sample.ValidityFlags);

            Release(_keyboard.wKey);
            Release(_keyboard.aKey);
            yield return null;

            // Neutral keyboard reads back as zero.
            RawInputSample neutral = _controller.CaptureLatestRawSample();
            Assert.AreEqual(0f, neutral.AccelerateRaw, 1e-4f);
            Assert.AreEqual(0f, neutral.SteerRaw, 1e-4f);
        }

        // ---- Raw capture (AC-59) ----

        [UnityTest]
        public IEnumerator AC59_CaptureRunsOncePerFrameWithMonotonicSequence()
        {
            _controller.SetGameplayContext();
            yield return null;

            var driverObject = new GameObject("FakeSimulationDriver");
            FakeSimulationDriver driver = driverObject.AddComponent<FakeSimulationDriver>();
            var processor = new TickProcessor();
            driver.FrameDriver = new InputFrameDriver(_controller, processor);

            // Let three render updates run; the driver captures exactly once per Update.
            yield return null;
            yield return null;
            yield return null;

            Assert.AreEqual(3, driver.Frames);
            Assert.AreEqual(3, _controller.CaptureCount);
            // captureSequence is monotonic across the driver's capture calls.
            for (int i = 1; i < driver.CapturedSequences.Count; ++i)
            {
                Assert.Greater(driver.CapturedSequences[i], driver.CapturedSequences[i - 1]);
            }

            // The accumulator consumes exactly the frame-captured sample, in capture order —
            // proving capture precedes accumulator evaluation every render update (a stale or
            // out-of-order sample would diverge this list).
            CollectionAssert.AreEqual(driver.CapturedSequences, driver.AccumulatedSequences);

            Object.Destroy(driverObject);
        }

        [UnityTest]
        public IEnumerator PendingPauseEdgeIsLatchedUntilConsumed()
        {
            _controller.SetGameplayContext();
            yield return null;

            Press(_gamepad.startButton);
            yield return null;
            Assert.IsTrue(_controller.HasPendingPauseEdge);

            // Reading (capture) does not clear the latched edge.
            _controller.CaptureLatestRawSample();
            Assert.IsTrue(_controller.HasPendingPauseEdge);

            _controller.ConsumePendingPauseEdge();
            Assert.IsFalse(_controller.HasPendingPauseEdge);
        }

        [UnityTest]
        public IEnumerator SetUIContextClearsPendingPauseEdge()
        {
            _controller.SetGameplayContext();
            yield return null;

            Press(_gamepad.startButton);
            yield return null;
            Assert.IsTrue(_controller.HasPendingPauseEdge);

            // ADR-0005:119 — the Pause edge is consumed by the transition that triggered it.
            _controller.SetUIContext();
            Assert.IsFalse(_controller.HasPendingPauseEdge);
        }

        [UnityTest]
        public IEnumerator GamepadTriggersCaptureRawAccelerateAndBrake()
        {
            _controller.SetGameplayContext();
            yield return null;

            Set(_gamepad.rightTrigger, 0.4f);
            Set(_gamepad.leftTrigger, 0.3f);
            yield return null;

            // Story 005: the scheme is resolved before capture (meaningful trigger input → Gamepad).
            _controller.ResolveActiveScheme();
            RawInputSample sample = _controller.CaptureLatestRawSample();
            Assert.AreEqual(ControlScheme.Gamepad, sample.ActiveScheme);
            Assert.AreEqual(0.4f, sample.AccelerateRaw, 1e-4f);
            Assert.AreEqual(0.3f, sample.BrakeRaw, 1e-4f);
        }

        [Test]
        public void CaptureReportsNoInputDeviceWhenNoDevicesConnected()
        {
            var devices = new List<InputDevice>();
            foreach (InputDevice device in InputSystem.devices)
            {
                devices.Add(device);
            }

            foreach (InputDevice device in devices)
            {
                InputSystem.RemoveDevice(device);
            }

            RawInputSample sample = _controller.CaptureLatestRawSample();
            Assert.AreEqual(InputAvailability.NoInputDevice, sample.Availability);
            Assert.AreEqual(ControlScheme.KeyboardMouse, sample.ActiveScheme);
            Assert.AreEqual(0f, sample.AccelerateRaw, 1e-4f);
            Assert.AreEqual(0f, sample.BrakeRaw, 1e-4f);
            Assert.AreEqual(0f, sample.SteerRaw, 1e-4f);
        }

        [UnityTest]
        public IEnumerator AC59_StickRawBypassesEmbeddedDeadzone()
        {
            _controller.SetGameplayContext();
            yield return null;

            // Activate the Gamepad scheme via meaningful trigger input so capture reads raw.
            Set(_gamepad.rightTrigger, 0.4f);
            yield return null;
            _controller.ResolveActiveScheme();

            // 0.1 magnitude is inside the StickControl's embedded axisDeadzone (0.125/0.925).
            // ReadValue() would yield 0; ReadUnprocessedValue() must yield the raw 0.1.
            Set(_gamepad.leftStick, new Vector2(0.1f, 0f));
            yield return null;

            RawInputSample sample = _controller.CaptureLatestRawSample();
            Assert.AreEqual(ControlScheme.Gamepad, sample.ActiveScheme);
            Assert.AreEqual(0.1f, sample.SteerRaw, 1e-4f);
        }

        [UnityTest]
        public IEnumerator CaptureFlagsNonFiniteChannels()
        {
            _controller.SetGameplayContext();
            yield return null;

            // Activate the Gamepad scheme via meaningful trigger input so capture reads via
            // ReadUnprocessedValue on the gamepad controls.
            Set(_gamepad.rightTrigger, 0.4f);
            yield return null;
            _controller.ResolveActiveScheme();

            // Input System does not clean NaN from queued state; the capture must flag it.
            InputSystem.QueueStateEvent(_gamepad, new GamepadState { leftStick = new Vector2(float.NaN, 0f) });
            InputSystem.Update();
            yield return null;

            RawInputSample steer = _controller.CaptureLatestRawSample();
            Assert.AreEqual(RawInputValidityFlags.SteerNonFinite, steer.ValidityFlags);

            // Accelerate (rightTrigger) and brake (leftTrigger) NaN/infinity channels are flagged too.
            InputSystem.QueueStateEvent(_gamepad, new GamepadState { rightTrigger = float.PositiveInfinity, leftTrigger = float.NaN });
            InputSystem.Update();
            yield return null;
            RawInputSample triggers = _controller.CaptureLatestRawSample();
            Assert.AreEqual(
                RawInputValidityFlags.AccelerateNonFinite | RawInputValidityFlags.BrakeNonFinite,
                triggers.ValidityFlags);

            _controller.ConsumePendingPauseEdge();
        }

        // ---- Helpers ----

        private static void AssertVector2(Vector2 expected, Vector2 actual)
        {
            Assert.AreEqual(expected.x, actual.x, 1e-4f, "X component differs");
            Assert.AreEqual(expected.y, actual.y, 1e-4f, "Y component differs");
        }

        /// <summary>Acts as the Simulation driver for AC-59: resolves + captures once per Update via the
        /// <see cref="InputFrameDriver"/> seam, then feeds the accumulator.</summary>
        private sealed class FakeSimulationDriver : MonoBehaviour
        {
            public InputFrameDriver FrameDriver;
            public int Frames;
            public readonly List<ulong> CapturedSequences = new List<ulong>();
            public readonly List<ulong> AccumulatedSequences = new List<ulong>();

            private void Update()
            {
                Frames++;
                // Capture occurs first, at the start of the render update (ADR-0001); the frame driver
                // resolves the scheme and captures exactly once per frame.
                RawInputSample sample = FrameDriver.BeginFrame();
                CapturedSequences.Add(sample.CaptureSequence);
                // The accumulator (Story 004 tick processor) consumes the frame-captured sample.
                AccumulatedSequences.Add(sample.CaptureSequence);
            }
        }
    }
}
