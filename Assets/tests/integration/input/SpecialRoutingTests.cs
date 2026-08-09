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
    /// <summary>Integration evidence for Story 007: special input routing.</summary>
    [TestFixture]
    public sealed class SpecialRoutingTests : InputTestFixture
    {
        private Keyboard _keyboard;
        private Gamepad _gamepad;
        private Mouse _mouse;
        private GameObject _eventSystemObject;
        private InputSystemUIInputModule _uiModule;
        private InputSystem_Actions _actions;
        private InputContextController _controller;
        private TickProcessor _processor;

        [SetUp]
        public void SetUp()
        {
            _keyboard = InputSystem.AddDevice<Keyboard>();
            _gamepad = InputSystem.AddDevice<Gamepad>();
            _mouse = InputSystem.AddDevice<Mouse>();
            _eventSystemObject = new GameObject("EventSystem");
            _eventSystemObject.AddComponent<EventSystem>();
            _uiModule = _eventSystemObject.AddComponent<InputSystemUIInputModule>();
            _uiModule.enabled = false;
            _actions = new InputSystem_Actions();
            _controller = new InputContextController(_actions, _uiModule);
            _processor = new TickProcessor();
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

        // ---- AC-26: mouse is UI-only, never affects gameplay input ----

        [UnityTest]
        public IEnumerator AC26_MouseDoesNotAffectGameplayInput()
        {
            _controller.SetGameplayContext();
            yield return null;
            _controller.ResolveActiveScheme();

            Press(_keyboard.wKey); // Accelerate held
            yield return null;
            SimulationInput baseline = _processor.ProcessTick(_controller.CaptureLatestRawSample(), false);

            // Mouse movement + click during processing (UI-only).
            Set(_mouse.delta, new Vector2(20f, 10f));
            Press(_mouse.leftButton);
            yield return null;
            SimulationInput after = _processor.ProcessTick(_controller.CaptureLatestRawSample(), false);

            Assert.AreEqual(1f, baseline.RawAcceleratePostDeadZone, 1e-3f);
            Assert.AreEqual(1f, after.RawAcceleratePostDeadZone, 1e-3f, "Mouse must not change Accelerate.");
            Assert.AreEqual(0f, baseline.RawBrakePostDeadZone, 1e-3f);
            Assert.AreEqual(0f, after.RawBrakePostDeadZone, 1e-3f, "Mouse must not change Brake.");
            Assert.AreEqual(0f, baseline.RawSteerPostDeadZone, 1e-3f);
            Assert.AreEqual(0f, after.RawSteerPostDeadZone, 1e-3f, "Mouse must not change Steer.");
            Assert.AreEqual(0, _controller.PauseEdgeCount, "Mouse must not create a Pause edge.");
        }

        // ---- AC-36: keyboard/gamepad UI input hides the pointer and sets the scheme ----

        [UnityTest]
        public IEnumerator AC36_KeyboardNavigateHidesPointerAndSetsKeyboardMouse()
        {
            _controller.SetUIContext();
            yield return null;
            Assert.IsTrue(_controller.PointerVisible, "Pointer starts visible in the UI context.");

            Press(_keyboard.upArrowKey); // Navigate (keyboard)
            yield return null;
            _controller.ResolveActiveScheme();

            Assert.IsFalse(_controller.PointerVisible, "Keyboard Navigate hides the pointer.");
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ActiveScheme);
        }

        [UnityTest]
        public IEnumerator AC36_KeyboardConfirmAndCancelHidePointer()
        {
            _controller.SetUIContext();
            yield return null;
            Assert.IsTrue(_controller.PointerVisible);

            // Confirm (Enter) hides the pointer and keeps KeyboardMouse.
            Press(_keyboard.enterKey);
            yield return null;
            _controller.ResolveActiveScheme();
            Assert.IsFalse(_controller.PointerVisible, "Keyboard Confirm hides the pointer.");
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ActiveScheme);

            Release(_keyboard.enterKey);
            yield return null;
            Press(_keyboard.escapeKey); // Cancel (Escape)
            yield return null;
            Assert.IsFalse(_controller.PointerVisible, "Keyboard Cancel hides the pointer.");
        }

        [UnityTest]
        public IEnumerator AC36_GamepadNavigateHidesPointerAndSetsGamepad()
        {
            _controller.SetUIContext();
            yield return null;

            Press(_gamepad.dpad.up); // Navigate (gamepad)
            yield return null;
            _controller.ResolveActiveScheme();

            Assert.IsFalse(_controller.PointerVisible, "Gamepad Navigate hides the pointer.");
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ActiveScheme);
        }

        // ---- AC-48: pointer delta or click shows the pointer and sets KeyboardMouse ----

        [UnityTest]
        public IEnumerator AC48_PointerDeltaShowsPointerAndSetsKeyboardMouse()
        {
            _controller.SetUIContext();
            yield return null;
            Press(_keyboard.upArrowKey); // hide the pointer first
            yield return null;
            Assert.IsFalse(_controller.PointerVisible);
            Release(_keyboard.upArrowKey); // release so a later Navigate edge can fire
            yield return null;

            // Pointer delta >= 2 px → visible + KeyboardMouse.
            Set(_mouse.delta, new Vector2(10f, 0f));
            yield return null;
            _controller.UpdateUiPointerState();
            _controller.ResolveActiveScheme();
            Assert.IsTrue(_controller.PointerVisible, "Pointer delta >= 2px makes the pointer visible.");
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ActiveScheme);

            // Subsequent gamepad Navigate hides it and selects Gamepad.
            Press(_gamepad.dpad.up);
            yield return null;
            _controller.ResolveActiveScheme();
            Assert.IsFalse(_controller.PointerVisible, "Subsequent Navigate hides the pointer.");
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ActiveScheme);
        }

        [UnityTest]
        public IEnumerator AC48_PointerDeltaThresholdBoundaries()
        {
            _controller.SetUIContext();
            yield return null;

            // Below 2 px → pointer stays hidden.
            Press(_keyboard.upArrowKey); // hide the pointer first
            yield return null;
            Assert.IsFalse(_controller.PointerVisible);
            Release(_keyboard.upArrowKey);
            yield return null;

            Set(_mouse.delta, new Vector2(1.99f, 0f));
            yield return null;
            _controller.UpdateUiPointerState();
            Assert.IsFalse(_controller.PointerVisible, "Delta below 2px must not show the pointer.");

            // Exactly 2 px → pointer visible.
            Set(_mouse.delta, new Vector2(2.0f, 0f));
            yield return null;
            _controller.UpdateUiPointerState();
            Assert.IsTrue(_controller.PointerVisible, "Delta at exactly 2px shows the pointer.");
        }

        [UnityTest]
        public IEnumerator AC48_ClickShowsPointerAndSwitchesSchemeFromGamepad()
        {
            _controller.SetUIContext();
            yield return null;

            // Start from Gamepad active + pointer hidden (gamepad Navigate).
            Press(_gamepad.dpad.up);
            yield return null;
            _controller.ResolveActiveScheme();
            Assert.AreEqual(ControlScheme.Gamepad, _controller.ActiveScheme);
            Assert.IsFalse(_controller.PointerVisible);
            Release(_gamepad.dpad.up);
            yield return null;

            // Click (primary button) → pointer visible + KeyboardMouse.
            Press(_mouse.leftButton);
            yield return null;
            Assert.IsTrue(_controller.PointerVisible, "A click makes the pointer visible.");
            _controller.ResolveActiveScheme();
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ActiveScheme,
                "A click switches the UI scheme to KeyboardMouse.");
        }

        // ---- AC-58: CameraToggle routes one presentation request per press ----

        [UnityTest]
        public IEnumerator AC58_CameraToggleRoutesOneRequestPerPress()
        {
            _controller.SetGameplayContext();
            yield return null;

            int requests = 0;
            _controller.OnCameraToggleRequested += () => requests++;

            Press(_keyboard.cKey);
            yield return null;
            Assert.AreEqual(1, requests, "One CameraToggle request per press.");
            Assert.AreEqual(1, _controller.CameraToggleCount);

            yield return null; // held → no additional request
            Assert.AreEqual(1, requests, "Holding must not repeat the request.");

            Release(_keyboard.cKey);
            yield return null;
            Press(_keyboard.cKey);
            yield return null;
            Assert.AreEqual(2, requests, "Release+repress produces a second request.");
            Assert.AreEqual(2, _controller.CameraToggleCount);

            // Gamepad North (Y/Triangle) also routes one request per press.
            Release(_keyboard.cKey); // release so North produces a fresh rising edge
            yield return null;
            Press(_gamepad.buttonNorth);
            yield return null;
            Assert.AreEqual(3, requests, "Gamepad North routes a CameraToggle request.");
            yield return null; // held → no repeat
            Assert.AreEqual(3, requests);
        }

        // ---- AC-52/AC-64: PitService Confirm routes directly to Pit Stop ----

        [UnityTest]
        public IEnumerator AC52_PitServiceConfirmGatedByTireSwap()
        {
            var pitStop = new PitStopStub { TireSwapComplete = false, CurrentFuel = 8.0f };
            _controller.OnPitServiceConfirmRequested += pitStop.OnConfirm;
            _controller.SetPitServiceContext();
            yield return null;

            // Tire swap incomplete → the consumer does not exit.
            Press(_keyboard.enterKey);
            yield return null;
            Assert.AreEqual(0, pitStop.ExitCommands, "No pit exit before tire swap completes.");
            Assert.AreEqual(1, _controller.PitServiceConfirmCount,
                "Controller routes the Confirm unconditionally; the consumer gates.");
            Assert.AreEqual(0, _controller.SubmitCount, "No generic UI Submit during PitService.");

            // Tire swap completes → exactly one exit command carrying the current fuel.
            pitStop.TireSwapComplete = true;
            Release(_keyboard.enterKey);
            yield return null;
            Press(_keyboard.enterKey);
            yield return null;
            Assert.AreEqual(1, pitStop.ExitCommands, "One exit command after tire swap completes.");
            Assert.AreEqual(8.0f, pitStop.LastExitFuel, "Exit command carries the current fuel level.");

            // Cancel is suppressed.
            Press(_keyboard.escapeKey);
            yield return null;
            Assert.AreEqual(0, _controller.CancelCount, "Cancel suppressed during PitService.");
        }

        [UnityTest]
        public IEnumerator AC64_HeldConfirmDoesNotRouteOnPitServiceEntry()
        {
            // Enter held across the Gameplay→PitService entry. A held Button does not re-fire
            // 'performed' on action-map enable (Input System initial-state check off), so no direct
            // command routes until release+repress. Regression — not a proof of the latch itself
            // (which is defense-in-depth; the no-repeat behavior is the real protection).
            _controller.SetGameplayContext();
            yield return null;

            int confirmRequests = 0;
            _controller.OnPitServiceConfirmRequested += () => confirmRequests++;

            Press(_keyboard.enterKey);
            yield return null;
            _controller.SetPitServiceContext();
            yield return null;
            Assert.AreEqual(0, confirmRequests, "Held Confirm must not route on PitService entry.");
            Assert.AreEqual(0, _controller.PitServiceConfirmCount);

            // Release+repress → one direct command; held does not repeat.
            Release(_keyboard.enterKey);
            yield return null;
            Press(_keyboard.enterKey);
            yield return null;
            Assert.AreEqual(1, confirmRequests);
            yield return null; // held → no repeat
            Assert.AreEqual(1, confirmRequests, "Held Confirm must not repeat the direct command.");

            Release(_keyboard.enterKey);
            yield return null;
            Press(_keyboard.enterKey);
            yield return null;
            Assert.AreEqual(2, confirmRequests, "Release+repress produces a second direct command.");
        }

        // ---- AC-54: Finished Qualifying Presentation Confirm routes to Results ----

        [UnityTest]
        public IEnumerator AC54_FinishedQualifyingConfirmRoutesToResults()
        {
            _controller.SetFinishedPresentationContext();
            yield return null;

            int confirmRequests = 0;
            _controller.OnFinishedConfirmRequested += () => confirmRequests++;

            Press(_keyboard.enterKey);
            yield return null;
            Assert.AreEqual(1, confirmRequests, "Confirm dismisses Finished Presentation.");
            Assert.AreEqual(1, _controller.FinishedConfirmCount);
            Assert.AreEqual(0, _controller.SubmitCount, "No generic UI Submit during Finished Presentation.");

            // Gamepad South also routes a Finished Confirm.
            Release(_keyboard.enterKey); // release so South produces a fresh rising edge
            yield return null;
            Press(_gamepad.buttonSouth);
            yield return null;
            Assert.AreEqual(2, confirmRequests, "Gamepad South routes a Finished Confirm.");
            Assert.AreEqual(2, _controller.FinishedConfirmCount);
        }

        // ---- AC-57: Finished Presentation Pause toggles the terminal timer ----

        [UnityTest]
        public IEnumerator AC57_FinishedPauseTogglesTerminalTimer()
        {
            _controller.SetFinishedPresentationContext();
            yield return null;

            int pauseRequests = 0;
            _controller.OnFinishedPauseRequested += () => pauseRequests++;

            Press(_keyboard.pKey); // OverdriveUI.Pause = P
            yield return null;
            Assert.AreEqual(1, pauseRequests, "UI Pause routes to UI Presentation terminal timer.");
            Assert.AreEqual(1, _controller.FinishedPauseCount);
            Assert.AreEqual(0, _controller.UiPauseCount, "No generic UI Pause count during Finished.");

            // Gamepad Start also routes a Finished Pause.
            Release(_keyboard.pKey); // release so Start produces a fresh rising edge
            yield return null;
            Press(_gamepad.startButton);
            yield return null;
            Assert.AreEqual(2, pauseRequests, "Gamepad Start routes a Finished Pause.");
            Assert.AreEqual(2, _controller.FinishedPauseCount);

            // Escape remains suppressed (no generic Cancel dispatched).
            Press(_keyboard.escapeKey);
            yield return null;
            Assert.AreEqual(0, _controller.CancelCount, "Escape must not dispatch a generic Cancel.");
        }

        // ---- AC-63: Finished Presentation suppresses Cancel with module disabled ----

        [UnityTest]
        public IEnumerator AC63_FinishedEscapeSuppressedAndModuleDisabled()
        {
            _controller.SetFinishedPresentationContext();
            yield return null;
            Assert.IsFalse(_uiModule.enabled, "UI module disabled during Finished Presentation.");

            Press(_keyboard.escapeKey);
            yield return null;
            Assert.AreEqual(0, _controller.CancelCount, "Cancel suppressed in Finished Presentation.");
            Assert.AreEqual(InputContextKind.UI, _controller.CurrentContext);
            Assert.AreEqual(RoutingMode.FinishedPresentation, _controller.CurrentRoutingMode);
        }

        // ---- AC-65: blocked modes emit no input events ----

        [UnityTest]
        public IEnumerator AC65_PitTransitEmitsNothing()
        {
            _controller.SetPitTransitContext();
            yield return null;
            Assert.IsFalse(_uiModule.enabled, "UI module disabled during PitTransit.");

            // Full input surface: UI digitals, gameplay actions, mouse, gamepad.
            Press(_keyboard.enterKey); // Confirm
            Press(_keyboard.escapeKey); // Cancel
            Press(_keyboard.upArrowKey); // Navigate
            Press(_keyboard.pKey); // Pause
            Press(_keyboard.cKey); // CameraToggle (gameplay map disabled)
            Press(_keyboard.wKey); // Gameplay value
            Press(_mouse.leftButton); // Click (UI, suppressed)
            Press(_gamepad.startButton); // Start → Pause (gamepad)
            Press(_gamepad.dpad.up); // Navigate (gamepad)
            yield return null;
            Assert.AreEqual(0, _controller.SubmitCount);
            Assert.AreEqual(0, _controller.CancelCount);
            Assert.AreEqual(0, _controller.UiPauseCount);
            Assert.AreEqual(0, _controller.PauseEdgeCount);
            Assert.AreEqual(0, _controller.CameraToggleCount);
            Assert.AreEqual(0, _controller.GameplayValueEventCount);
            Assert.AreEqual(0, _controller.FinishedConfirmCount);
            Assert.AreEqual(0, _controller.FinishedPauseCount);
            Assert.AreEqual(0, _controller.PitServiceConfirmCount);

            // Navigate/Click must not leave side effects: the scheme stays unchanged (no meaningful
            // flag), and the pointer stays hidden (no ShowPointer from Click during PitTransit).
            _controller.ResolveActiveScheme();
            Assert.AreEqual(ControlScheme.KeyboardMouse, _controller.ActiveScheme,
                "Suppressed Navigate/Click must not change the scheme during PitTransit.");
        }

        [UnityTest]
        public IEnumerator AC65_LoadingBlockedEmitsNothing()
        {
            _controller.SetBlockedContext();
            yield return null;
            Assert.IsFalse(_uiModule.enabled, "UI module disabled during Loading-blocked.");

            // Full input surface: UI digitals, gameplay actions, mouse, gamepad.
            Press(_keyboard.enterKey); // Confirm
            Press(_keyboard.escapeKey); // Cancel
            Press(_keyboard.upArrowKey); // Navigate
            Press(_keyboard.pKey); // Pause keyboard
            Press(_keyboard.cKey); // CameraToggle (gameplay map disabled)
            Press(_keyboard.wKey); // Gameplay value
            Press(_mouse.leftButton); // Click (UI, suppressed)
            Press(_gamepad.startButton); // Start → Pause (gamepad)
            Press(_gamepad.dpad.up); // Navigate (gamepad)
            yield return null;
            Assert.AreEqual(0, _controller.SubmitCount, "No Submit during Loading-blocked.");
            Assert.AreEqual(0, _controller.CancelCount, "No Cancel during Loading-blocked.");
            Assert.AreEqual(0, _controller.UiPauseCount);
            Assert.AreEqual(0, _controller.PauseEdgeCount, "No Pause edge during Loading-blocked.");
            Assert.AreEqual(0, _controller.CameraToggleCount);
            Assert.AreEqual(0, _controller.GameplayValueEventCount);
            Assert.AreEqual(0, _controller.FinishedConfirmCount);
            Assert.AreEqual(0, _controller.FinishedPauseCount);
            Assert.AreEqual(0, _controller.PitServiceConfirmCount);
        }

        [UnityTest]
        public IEnumerator AC54_HeldConfirmDoesNotRouteOnFinishedEntry()
        {
            // Confirm held across a normal-UI → Finished transition. The performed edge already fired
            // in the UI context; a held Button does not re-fire 'performed' on action-map enable, so
            // nothing routes until release+repress. Regression — the no-repeat behavior is the real
            // protection (latching is defense-in-depth).
            _controller.SetUIContext();
            yield return null;

            int confirmRequests = 0;
            _controller.OnFinishedConfirmRequested += () => confirmRequests++;
            Press(_keyboard.enterKey); // Confirm held
            yield return null;
            Assert.AreEqual(1, _controller.SubmitCount, "Confirm performed in normal UI.");

            _controller.SetFinishedPresentationContext(); // UI → Finished
            yield return null;
            Assert.AreEqual(0, confirmRequests, "Held Confirm must not route on Finished entry.");
            Assert.AreEqual(0, _controller.FinishedConfirmCount);

            // Release+repress routes exactly once.
            Release(_keyboard.enterKey);
            yield return null;
            Press(_keyboard.enterKey);
            yield return null;
            Assert.AreEqual(1, confirmRequests, "Release+repress routes a Finished Confirm.");
        }

        [UnityTest]
        public IEnumerator AC57_HeldPauseDoesNotToggleOnFinishedEntry()
        {
            // Pause held across a normal-UI → Finished transition. The performed edge already fired
            // in the UI context; no repeat on action-map enable, so the terminal timer does not
            // toggle until release+repress. Regression — no-repeat is the real protection.
            _controller.SetUIContext();
            yield return null;

            int pauseRequests = 0;
            _controller.OnFinishedPauseRequested += () => pauseRequests++;
            Press(_keyboard.pKey); // Pause (OverdriveUI.Pause = P) held
            yield return null;
            Assert.AreEqual(1, _controller.UiPauseCount, "Pause performed in normal UI.");

            _controller.SetFinishedPresentationContext(); // UI → Finished
            yield return null;
            Assert.AreEqual(0, pauseRequests, "Held Pause must not toggle the terminal timer on Finished entry.");
            Assert.AreEqual(0, _controller.FinishedPauseCount);

            // Release+repress toggles exactly once.
            Release(_keyboard.pKey);
            yield return null;
            Press(_keyboard.pKey);
            yield return null;
            Assert.AreEqual(1, pauseRequests, "Release+repress toggles the terminal timer.");
        }

        // ---- Mock support ----

        /// <summary>Models the Pit Stop consumer: gates the exit on tire-swap completion (Story 007 AC-52).</summary>
        private sealed class PitStopStub
        {
            public bool TireSwapComplete;
            public float CurrentFuel;
            public int ExitCommands;
            public float LastExitFuel;

            public void OnConfirm()
            {
                if (TireSwapComplete)
                {
                    ExitCommands++;
                    LastExitFuel = CurrentFuel;
                }
            }
        }
    }
}
