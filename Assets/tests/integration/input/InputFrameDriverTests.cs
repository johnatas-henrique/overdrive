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
    /// <summary>Evidence for the InputFrameDriver: the per-render-frame input sequence the Simulation
    /// driver invokes once per Update (ADR-0001:41) — resolve, capture once, tick per fixed tick.</summary>
    [TestFixture]
    public sealed class InputFrameDriverTests : InputTestFixture
    {
        private Keyboard _keyboard;
        private Gamepad _gamepad;
        private GameObject _eventSystemObject;
        private InputSystemUIInputModule _uiModule;
        private InputSystem_Actions _actions;
        private InputContextController _controller;
        private TickProcessor _processor;
        private InputFrameDriver _driver;

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
            _processor = new TickProcessor();
            _driver = new InputFrameDriver(_controller, _processor);
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
        public IEnumerator BeginFrame_ResolvesSchemeAndCapturesOncePerFrame()
        {
            _controller.SetGameplayContext();
            yield return null;

            Set(_gamepad.rightTrigger, 0.6f);
            yield return null;

            _driver.BeginFrame();

            Assert.AreEqual(ControlScheme.Gamepad, _controller.ActiveScheme, "Resolve ran before capture.");
            Assert.AreEqual(1, _controller.CaptureCount, "BeginFrame captures exactly once per frame.");
        }

        [UnityTest]
        public IEnumerator Tick_ProcessesTheFrameSample()
        {
            _controller.SetGameplayContext();
            yield return null;

            Set(_gamepad.rightTrigger, 0.6f);
            yield return null;

            _driver.BeginFrame();
            SimulationInput input = _driver.Tick();

            float expected = EmaBrakePriority.Sanitize(DeadZoneNormalizer.NormalizeTrigger(0.6f, ControlProfile.Default.TriggerInner));
            Assert.AreEqual(ControlProfile.Default.AccelerateAlpha * expected, input.AccelerateOut, 0.001f,
                "Tick builds SimulationInput from the frame sample through the default profile.");
        }

        [UnityTest]
        public IEnumerator Tick_ConsumesPauseOnFirstTickOnly()
        {
            _controller.SetGameplayContext();
            yield return null;

            // Resolve to Gamepad first so the BeginFrame resolve below does not consume the edge
            // via a scheme change (ADR-0005 AC-40).
            Set(_gamepad.rightTrigger, 0.6f);
            yield return null;
            _driver.BeginFrame();
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ActiveScheme);

            Press(_gamepad.startButton);
            yield return null;
            Assert.IsTrue(_controller.HasPendingPauseEdge, "Press start latches a pending Pause edge.");

            _driver.BeginFrame();
            SimulationInput first = _driver.Tick();
            Assert.IsTrue(first.PauseEdge, "The first tick of the frame carries the Pause edge.");
            Assert.IsFalse(_controller.HasPendingPauseEdge, "The Pause edge is consumed exactly once.");

            SimulationInput second = _driver.Tick();
            Assert.IsFalse(second.PauseEdge, "Later ticks of the same frame carry no Pause edge.");
        }

        [UnityTest]
        public IEnumerator MultipleTicksPerFrame_ReuseOneCapture()
        {
            _controller.SetGameplayContext();
            yield return null;

            Set(_gamepad.rightTrigger, 0.6f);
            yield return null;

            _driver.BeginFrame();
            Assert.AreEqual(1, _controller.CaptureCount, "One capture per frame.");

            SimulationInput first = _driver.Tick();
            SimulationInput second = _driver.Tick();
            Assert.AreEqual(1, _controller.CaptureCount, "Ticks reuse the frame sample — no re-capture per tick.");

            Assert.Greater(second.AccelerateOut, first.AccelerateOut,
                "EMA advances across ticks even though the sample is reused (held analog converges).");
        }
    }
}
