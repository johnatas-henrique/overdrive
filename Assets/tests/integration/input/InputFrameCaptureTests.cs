using System.Collections;
using NUnit.Framework;
using Overdrive.Input;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
using UnityEngine.TestTools;

namespace Overdrive.Input.Tests
{
    /// <summary>
    /// Evidence for the InputFrameCapture — the single per-frame input seam the Simulation
    /// driver consumes (C4, 2026-08-15): resolve the scheme before capture, capture once,
    /// and hold/consume the Pause edge (ADR-0001:41, ADR-0005). The ordering of the seam
    /// calls (capture once per Update, edge on the first tick of a frame) is the driver's
    /// contract — proven in the simulation assembly with the real seam in
    /// SimulationDriverTests (capture-before-accumulator ordering, exactly-once-per-frame);
    /// this fixture proves the seam's own behavior with real Input devices.
    /// </summary>
    [TestFixture]
    public sealed class InputFrameCaptureTests : InputTestFixture
    {
        private Keyboard _keyboard;
        private Gamepad _gamepad;
        private GameObject _eventSystemObject;
        private InputSystemUIInputModule _uiModule;
        private InputSystem_Actions _actions;
        private InputContextController _controller;
        private InputFrameCapture _capture;

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
            _capture = new InputFrameCapture(_controller);
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

        [UnityTest]
        public IEnumerator CaptureLatest_ResolvesSchemeAndCapturesOnce()
        {
            _controller.SetGameplayContext();
            yield return null;

            Set(_gamepad.rightTrigger, 0.6f);
            yield return null;

            _capture.CaptureLatest();

            Assert.AreEqual(ControlScheme.Gamepad, _controller.ActiveScheme, "Resolve ran before capture.");
            Assert.AreEqual(1, _controller.CaptureCount, "CaptureLatest captures exactly once per call.");
        }

        [UnityTest]
        public IEnumerator CaptureLatest_ReturnsTheFrameSample()
        {
            _controller.SetGameplayContext();
            yield return null;

            Set(_gamepad.rightTrigger, 0.6f);
            yield return null;

            RawInputSample sample = _capture.CaptureLatest();
            SimulationInput input = new TickProcessor().ProcessTick(sample, false);

            float expected = EmaBrakePriority.Sanitize(DeadZoneNormalizer.NormalizeTrigger(0.6f, ControlProfile.Default.TriggerInner));
            Assert.AreEqual(ControlProfile.Default.AccelerateAlpha * expected, input.AccelerateOut, 0.001f,
                "The seam returns the captured frame sample; the tick processor builds SimulationInput from it.");
        }

        [UnityTest]
        public IEnumerator PauseEdge_LatchesUntilConsumed()
        {
            _controller.SetGameplayContext();
            yield return null;

            // Resolve to Gamepad first so the capture resolve below does not consume the edge
            // via a scheme change (ADR-0005 AC-40).
            Set(_gamepad.rightTrigger, 0.6f);
            yield return null;
            _capture.CaptureLatest();
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ActiveScheme);

            Press(_gamepad.startButton);
            yield return null;
            Assert.IsTrue(_capture.HasPendingPauseEdge, "Press start latches a pending Pause edge.");

            _capture.ConsumePendingPauseEdge();
            Assert.IsFalse(_capture.HasPendingPauseEdge, "The edge is consumed exactly once.");
        }

        [UnityTest]
        public IEnumerator PauseEdge_FirstTickCarriesEdgeThenReuse()
        {
            // The exact sequence the Simulation driver performs per frame (C4): query the
            // edge for the first tick, consume it after delivery, and reuse the edge-free
            // state for later ticks of the same frame.
            _controller.SetGameplayContext();
            yield return null;

            Set(_gamepad.rightTrigger, 0.6f);
            yield return null;
            RawInputSample sample = _capture.CaptureLatest();
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ActiveScheme);

            Press(_gamepad.startButton);
            yield return null;

            var processor = new TickProcessor();
            SimulationInput first = processor.ProcessTick(sample, _capture.HasPendingPauseEdge);
            Assert.IsTrue(first.PauseEdge, "The first tick of the frame carries the Pause edge.");
            _capture.ConsumePendingPauseEdge();

            SimulationInput second = processor.ProcessTick(sample, _capture.HasPendingPauseEdge);
            Assert.IsFalse(second.PauseEdge, "Later ticks of the same frame carry no Pause edge.");
        }
    }
}
