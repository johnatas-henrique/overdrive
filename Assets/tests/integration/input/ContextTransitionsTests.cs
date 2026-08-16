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
    /// <summary>Integration evidence for Story 006: context handoff and transitions.</summary>
    [TestFixture]
    public sealed class ContextTransitionsTests : InputTestFixture
    {
        private Keyboard _keyboard;
        private Gamepad _gamepad;
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

        // ---- AC-14: Countdown driving input is processed ----

        [UnityTest]
        public IEnumerator AC14_CountdownDrivingInputProcessed()
        {
            _controller.SetGameplayContext();
            yield return null;

            Set(_gamepad.rightTrigger, 0.8f);
            Set(_gamepad.leftStick, new Vector2(0.5f, 0f));
            yield return null;

            _controller.ResolveActiveScheme(); // gamepad analog meaningful → Gamepad
            RawInputSample raw = _controller.CaptureLatestRawSample();
            Assert.AreEqual(ControlScheme.Gamepad, raw.ActiveScheme);

            SimulationInput input = _processor.ProcessTick(raw, false);
            float expectedPostDz = DeadZoneNormalizer.NormalizeTrigger(0.8f);
            Assert.AreEqual(expectedPostDz, input.RawAcceleratePostDeadZone, 1e-3f);
            Assert.Greater(input.AccelerateOut, 0f); // EMA-processed value > 0
            Assert.AreEqual(InputAvailability.Available, input.Availability);
        }

        // ---- AC-15 / AC-17: Settings context coupling ----

        [UnityTest]
        public IEnumerator AC15_CountdownPauseEntersUiAndSettingsOpen()
        {
            _controller.SetGameplayContext();
            yield return null;

            var settings = new SettingsContextObserver(_controller);
            Assert.IsFalse(settings.IsOpen);
            Assert.AreEqual(InputContextKind.Gameplay, _controller.CurrentContext);

            Press(_keyboard.escapeKey);
            yield return null;
            Assert.AreEqual(1, _controller.PauseEdgeCount);

            _controller.SetUIContext(); // Pause → UI
            yield return null;
            Assert.AreEqual(InputContextKind.UI, _controller.CurrentContext);
            Assert.IsFalse(_controller.HasPendingPauseEdge);
            // Settings opens in the UI context with MVP categories enumerated and Difficulty disabled.
            Assert.IsTrue(settings.IsOpen);
            Assert.IsFalse(settings.IsDifficultyEnabled);
            CollectionAssert.AreEqual(
                new[] { "Audio", "Display", "Controls", "Accessibility", "Camera" },
                settings.Categories);

            _controller.SetGameplayContext(); // Resume
            yield return null;
            Assert.AreEqual(InputContextKind.Gameplay, _controller.CurrentContext);
            Assert.IsFalse(settings.IsOpen);
        }

        [UnityTest]
        public IEnumerator AC17_SettingsRequestedIgnoredDuringActiveCountdown()
        {
            _controller.SetGameplayContext(); // Countdown active, not paused
            yield return null;

            var settings = new SettingsContextObserver(_controller);
            settings.Request(); // Settings requested while Countdown active
            yield return null;

            Assert.AreEqual(InputContextKind.Gameplay, _controller.CurrentContext);
            Assert.IsFalse(settings.IsOpen, "Settings must not open during active Countdown.");
        }

        // ---- AC-16: grid-lock mock observes processed input without movement ----

        [UnityTest]
        public IEnumerator AC16_GridLockMockObservesProcessedInputWithoutMovement()
        {
            _controller.SetGameplayContext();
            yield return null;
            _controller.ResolveActiveScheme();

            var gridLock = new GridLockMock();
            Set(_gamepad.rightTrigger, 0.7f);
            yield return null;

            for (int i = 0; i < 3; i++)
            {
                SimulationInput input = _processor.ProcessTick(_controller.CaptureLatestRawSample(), false);
                gridLock.Observe(input);
                yield return null;
            }

            // Input path keeps producing throttle during Countdown; the grid lock (Vehicle Physics,
            // not this story) holds the car — the mock models the hold and asserts it never moved.
            Assert.AreEqual(3, gridLock.ObservedTicks);
            Assert.Greater(gridLock.LastThrottle, 0f, "Driving input must reach the grid-lock consumer.");
            Assert.AreEqual(0f, gridLock.CarVelocity, "Grid lock must keep the car stationary under input.");
        }

        // ---- AC-18: Countdown→Racing preserves EMA state ----

        [UnityTest]
        public IEnumerator AC18_CountdownToRacingPreservesEmaState()
        {
            _controller.SetGameplayContext();
            yield return null;

            var reinitializer = new ContextResumeEmaReinitializer(_controller, _processor);
            reinitializer.Enable();

            Set(_gamepad.rightTrigger, 0.6f);
            Set(_gamepad.leftStick, new Vector2(0.5f, 0f));
            yield return null;
            _controller.ResolveActiveScheme(); // gamepad analog meaningful → Gamepad
            SimulationInput countdownTick = _processor.ProcessTick(_controller.CaptureLatestRawSample(), false);

            // Racing is a Gameplay sub-state (same context) — no context change, no EMA reset.
            _controller.SetGameplayContext();
            yield return null;

            SimulationInput racingTick = _processor.ProcessTick(_controller.CaptureLatestRawSample(), false);
            float postDzA = DeadZoneNormalizer.NormalizeTrigger(0.6f);
            float postDzS = DeadZoneNormalizer.NormalizeStick(new Vector2(0.5f, 0f)).x;
            float alphaA = EmaBrakePriority.DefaultAccelerateAlpha;
            float alphaS = EmaBrakePriority.DefaultSteerAlpha;
            Assert.AreEqual(
                countdownTick.AccelerateOut * (1f - alphaA) + postDzA * alphaA,
                racingTick.AccelerateOut,
                1e-3f,
                "Accelerate EMA must continue (not reset) across Countdown→Racing.");
            Assert.AreEqual(
                countdownTick.SteerOut * (1f - alphaS) + postDzS * alphaS,
                racingTick.SteerOut,
                1e-3f,
                "Steer EMA must continue (not reset) across Countdown→Racing.");

            reinitializer.Disable();
        }

        [UnityTest]
        public IEnumerator AC18_BrakeEmaContinuesWithPriorityAcrossCountdownToRacing()
        {
            _controller.SetGameplayContext();
            yield return null;

            var reinitializer = new ContextResumeEmaReinitializer(_controller, _processor);
            reinitializer.Enable();

            Set(_gamepad.leftTrigger, 0.4f); // brake held
            Set(_gamepad.rightTrigger, 0.6f); // throttle held simultaneously (brake priority under load)
            yield return null;
            _controller.ResolveActiveScheme();
            SimulationInput countdownTick = _processor.ProcessTick(_controller.CaptureLatestRawSample(), false);

            _controller.SetGameplayContext(); // Racing (same context — no reset)
            yield return null;

            SimulationInput racingTick = _processor.ProcessTick(_controller.CaptureLatestRawSample(), false);
            float postDzB = DeadZoneNormalizer.NormalizeTrigger(0.4f);
            float alphaB = EmaBrakePriority.DefaultBrakeAlpha;
            Assert.AreEqual(
                countdownTick.BrakeOut * (1f - alphaB) + postDzB * alphaB,
                racingTick.BrakeOut,
                1e-3f,
                "Brake EMA must continue across Countdown→Racing.");
            // Brake priority remains active: accelerate stays zeroed.
            Assert.AreEqual(0f, racingTick.AccelerateOut, "Brake priority must stay active.");

            reinitializer.Disable();
        }

        // ---- AC-37: Qualifying Pause resumes to gameplay ----

        [UnityTest]
        public IEnumerator AC37_QualifyingPauseResumesToGameplay()
        {
            _controller.SetGameplayContext();
            yield return null;

            Press(_keyboard.escapeKey);
            yield return null;
            _controller.SetUIContext();
            yield return null;
            Assert.AreEqual(InputContextKind.UI, _controller.CurrentContext);

            _controller.SetGameplayContext();
            yield return null;
            Assert.AreEqual(InputContextKind.Gameplay, _controller.CurrentContext);
        }

        // ---- AC-41: UI→Gameplay resume initializes EMA + latches digital actions ----

        [UnityTest]
        public IEnumerator AC41_ResumeInitializesEmaAndLatchesDigital()
        {
            _controller.SetGameplayContext();
            yield return null;

            var reinitializer = new ContextResumeEmaReinitializer(_controller, _processor);
            reinitializer.Enable();

            Set(_gamepad.rightTrigger, 0.6f);
            yield return null;
            _controller.ResolveActiveScheme(); // Gamepad (so Peek reads the physical control)
            float expectedPostDz = DeadZoneNormalizer.NormalizeTrigger(0.6f);
            SimulationInput first = _processor.ProcessTick(_controller.CaptureLatestRawSample(), false);
            Assert.AreEqual(expectedPostDz * EmaBrakePriority.DefaultAccelerateAlpha, first.AccelerateOut, 1e-3f);

            _controller.SetUIContext(); // Pause → UI; throttle physically still held
            yield return null;

            // A digital gameplay action (CameraToggle / C) held across the resume.
            Press(_keyboard.cKey);
            yield return null;

            _controller.SetGameplayContext(); // resume → re-seed EMA from post-dead-zone; latch C
            yield return null;

            SimulationInput resumed = _processor.ProcessTick(_controller.CaptureLatestRawSample(), false);
            // (a) EMA prev == current post-dead-zone; (b) analog applies immediately.
            Assert.AreEqual(expectedPostDz, resumed.RawAcceleratePostDeadZone, 1e-3f);
            Assert.AreEqual(expectedPostDz, resumed.AccelerateOut, 1e-2f);
            // (c) held digital latched: no CameraToggle on resume.
            Assert.AreEqual(0, _controller.CameraToggleCount, "Held CameraToggle must not fire on resume.");
            // (d) no stale pause edge on resume.
            Assert.IsFalse(resumed.PauseEdge);

            // CameraToggle fires only after release + repress.
            Release(_keyboard.cKey);
            yield return null;
            Press(_keyboard.cKey);
            yield return null;
            Assert.AreEqual(1, _controller.CameraToggleCount, "CameraToggle fires after release+repress.");

            reinitializer.Disable();
        }

        // ---- AC-44: held Escape does not fire UI Cancel ----

        [UnityTest]
        public IEnumerator AC44_EscapeHeldDoesNotFireCancelUntilReleased()
        {
            _controller.SetGameplayContext();
            yield return null;

            Press(_keyboard.escapeKey);
            yield return null;
            Assert.AreEqual(1, _controller.PauseEdgeCount);

            _controller.SetUIContext(); // Escape still held
            yield return null; // settle frame (initial-state check)
            Assert.AreEqual(InputContextKind.UI, _controller.CurrentContext);
            Assert.AreEqual(0, _controller.CancelCount, "Held Escape must not fire UI Cancel.");

            Release(_keyboard.escapeKey);
            yield return null;

            Press(_keyboard.escapeKey);
            yield return null;
            Assert.AreEqual(1, _controller.CancelCount, "Cancel fires only after release+repress.");
        }

        // ---- AC-53: held digitals latched across both transition directions ----

        [UnityTest]
        public IEnumerator AC53_HeldGameplayDigitalDoesNotProduceStaleEdgeInUi()
        {
            _controller.SetGameplayContext();
            yield return null;

            Press(_keyboard.cKey); // CameraToggle held
            yield return null;
            Assert.AreEqual(1, _controller.CameraToggleCount);

            _controller.SetUIContext();
            yield return null;
            Assert.AreEqual(InputContextKind.UI, _controller.CurrentContext);
            Assert.AreEqual(1, _controller.CameraToggleCount); // no stale edge in UI
            Assert.AreEqual(1, _controller.GameplayEdgeCount);

            Release(_keyboard.cKey);
            _controller.SetGameplayContext();
            yield return null;
            Press(_keyboard.cKey);
            yield return null;
            Assert.AreEqual(2, _controller.CameraToggleCount);
        }

        [UnityTest]
        public IEnumerator AC53_UiToGameplayHeldEscapeDoesNotFirePauseUntilReleased()
        {
            _controller.SetUIContext();
            yield return null;

            Press(_keyboard.escapeKey); // Cancel held in UI
            yield return null;
            Assert.AreEqual(1, _controller.CancelCount);

            _controller.SetGameplayContext(); // UI→Gameplay with Escape held
            yield return null;
            Assert.AreEqual(InputContextKind.Gameplay, _controller.CurrentContext);
            Assert.AreEqual(0, _controller.PauseEdgeCount, "Held Escape must not fire Pause on resume.");

            Release(_keyboard.escapeKey);
            yield return null;
            Press(_keyboard.escapeKey);
            yield return null;
            Assert.AreEqual(1, _controller.PauseEdgeCount, "Pause fires after release+repress.");
        }

        [UnityTest]
        public IEnumerator AC53_HeldConfirmDoesNotFireSubmitInUi()
        {
            _controller.SetGameplayContext();
            yield return null;

            Press(_keyboard.enterKey); // Confirm (UI-only binding) held
            yield return null;
            Assert.AreEqual(0, _controller.SubmitCount, "Confirm is UI-only; no Submit fires in Gameplay.");

            _controller.SetUIContext(); // Gameplay→UI with Enter held
            yield return null;
            Assert.AreEqual(InputContextKind.UI, _controller.CurrentContext);
            Assert.AreEqual(0, _controller.SubmitCount, "Held Enter must not fire Submit on Gameplay→UI.");

            Release(_keyboard.enterKey);
            yield return null;
            Press(_keyboard.enterKey);
            yield return null;
            Assert.AreEqual(1, _controller.SubmitCount, "Confirm fires after release+repress.");
        }

        // ---- AC-56 / AC-70: loading-blocked until correct RaceLoadReady ----

        [UnityTest]
        public IEnumerator AC56_LoadingBlockedUntilRaceReady()
        {
            _controller.SetUIContext(); // Qualifying Results
            yield return null;

            var driver = new LifecycleDriverMock(_controller);
            driver.StartRaceRequested(); // → blocked (None)
            yield return null;
            Assert.AreEqual(InputContextKind.None, _controller.CurrentContext);
            Assert.IsFalse(_uiModule.enabled, "UI module disabled during blocked loading.");
            Assert.IsFalse(_actions.Gameplay.enabled, "Gameplay map disabled during blocked loading.");
            Assert.IsFalse(_actions.UI.enabled, "UI map disabled during blocked loading.");
            Press(_keyboard.escapeKey); // Pause/Cancel
            Press(_keyboard.wKey); // Accelerate
            Press(_keyboard.cKey); // CameraToggle
            yield return null;
            Assert.AreEqual(0, _controller.PauseEdgeCount, "No Pause during blocked loading.");
            Assert.AreEqual(0, _controller.CancelCount, "No Cancel during blocked loading.");
            Assert.AreEqual(0, _controller.CameraToggleCount, "No CameraToggle during blocked loading.");
            Assert.AreEqual(0, _controller.GameplayValueEventCount, "No gameplay value event during blocked loading.");
            Release(_keyboard.escapeKey);
            Release(_keyboard.wKey);
            Release(_keyboard.cKey);
            yield return null;

            // Wrong-mode readiness (Qualifying when Race expected) → ignored, stays blocked.
            driver.RaceLoadReady(expectedMode: "Race", actualMode: "Qualifying");
            yield return null;
            Assert.AreEqual(InputContextKind.None, _controller.CurrentContext);
            Assert.AreEqual(0, driver.GameplayTransitions);

            // Correct readiness → Gameplay (Countdown).
            driver.RaceLoadReady(expectedMode: "Race", actualMode: "Race");
            yield return null;
            Assert.AreEqual(InputContextKind.Gameplay, _controller.CurrentContext);
            Assert.AreEqual(1, driver.GameplayTransitions);

            // Duplicate readiness → ignored (already Gameplay).
            driver.RaceLoadReady(expectedMode: "Race", actualMode: "Race");
            yield return null;
            Assert.AreEqual(InputContextKind.Gameplay, _controller.CurrentContext);
            Assert.AreEqual(1, driver.GameplayTransitions, "Duplicate readiness must not transition again.");
        }

        [UnityTest]
        public IEnumerator AC70_QualifyingLoadingBlockedUntilQualifyingReady()
        {
            _controller.SetUIContext();
            yield return null;

            var driver = new LifecycleDriverMock(_controller);
            driver.StartRaceRequested(); // content loading for Qualifying → blocked
            yield return null;
            Assert.AreEqual(InputContextKind.None, _controller.CurrentContext);

            // Input held during loading is not processed (blocked routing).
            Press(_keyboard.wKey); // Accelerate held
            Press(_keyboard.escapeKey); // Pause/Cancel held
            yield return null;
            Assert.AreEqual(0, _controller.GameplayValueEventCount, "Held input not processed while loading.");
            Assert.AreEqual(0, _controller.PauseEdgeCount, "Held Pause not processed while loading.");
            Release(_keyboard.wKey);
            Release(_keyboard.escapeKey);
            yield return null;

            // Wrong-mode (Race when Qualifying expected) → ignored.
            driver.RaceLoadReady(expectedMode: "Qualifying", actualMode: "Race");
            yield return null;
            Assert.AreEqual(InputContextKind.None, _controller.CurrentContext);

            // Correct readiness → Gameplay (Qualifying, no Countdown transition).
            driver.RaceLoadReady(expectedMode: "Qualifying", actualMode: "Qualifying");
            yield return null;
            Assert.AreEqual(InputContextKind.Gameplay, _controller.CurrentContext);
            Assert.AreEqual(1, driver.GameplayTransitions);

            // Duplicate readiness → ignored.
            driver.RaceLoadReady(expectedMode: "Qualifying", actualMode: "Qualifying");
            yield return null;
            Assert.AreEqual(1, driver.GameplayTransitions, "Duplicate qualifying readiness must not transition again.");
        }

        // ---- OnContextChanged: fires only on an actual change ----

        [UnityTest]
        public IEnumerator ContextChange_OnContextChangedFiresOnlyOnActualChange()
        {
            int changeCount = 0;
            InputContextKind lastContext = InputContextKind.None;
            _controller.OnContextChanged += ctx => { changeCount++; lastContext = ctx; };
            _controller.SetGameplayContext();
            _controller.SetGameplayContext(); // same context — no change
            _controller.SetUIContext();
            yield return null;

            Assert.AreEqual(2, changeCount, "OnContextChanged fires only on actual context changes.");
            Assert.AreEqual(InputContextKind.UI, lastContext);
        }

        // ---- SetBlockedContext clears a pending Pause edge ----

        [UnityTest]
        public IEnumerator BlockedContext_ClearsPendingPauseEdge()
        {
            _controller.SetGameplayContext();
            yield return null;

            Press(_keyboard.escapeKey); // Pause edge pending
            yield return null;
            Assert.IsTrue(_controller.HasPendingPauseEdge);

            _controller.SetBlockedContext(); // direct Gameplay→blocked (defensive path)
            yield return null;
            Assert.IsFalse(_controller.HasPendingPauseEdge, "SetBlockedContext must clear a pending Pause edge.");
            Assert.AreEqual(InputContextKind.None, _controller.CurrentContext);
        }

        // ---- Same-context calls do not latch ----

        [UnityTest]
        public IEnumerator SameContext_DoesNotLatchDigitalActions()
        {
            _controller.SetGameplayContext();
            yield return null;

            Press(_keyboard.cKey); // CameraToggle held
            yield return null;
            Assert.AreEqual(1, _controller.CameraToggleCount);

            // Countdown→Racing: same context (Gameplay) — no latch must be created.
            _controller.SetGameplayContext();
            yield return null;

            var field = typeof(InputContextController).GetField("_latchedActions", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            var latch = (System.Collections.Generic.HashSet<InputAction>)field.GetValue(_controller);
            Assert.AreEqual(0, latch.Count, "Same-context calls must not create latches.");

            // The repress fires normally (not suppressed by a stale latch).
            Release(_keyboard.cKey);
            yield return null;
            Press(_keyboard.cKey);
            yield return null;
            Assert.AreEqual(2, _controller.CameraToggleCount);
        }

        // ---- Mock support ----

        private sealed class SettingsContextObserver
        {
            private readonly InputContextController _controller;
            public bool IsOpen;
            public bool IsDifficultyEnabled = true;
            public readonly List<string> Categories = new();

            public SettingsContextObserver(InputContextController controller)
            {
                _controller = controller;
                _controller.OnContextChanged += OnContextChanged;
            }

            public void Request()
            {
                // Settings may open only when the controller is in the UI context (e.g. via Pause).
                IsOpen = _controller.CurrentContext == InputContextKind.UI;
            }

            private void OnContextChanged(InputContextKind context)
            {
                IsOpen = context == InputContextKind.UI;
                IsDifficultyEnabled = !IsOpen;
                Categories.Clear();
                if (IsOpen)
                {
                    // MVP categories (Difficulty disabled during Countdown).
                    Categories.AddRange(new[] { "Audio", "Display", "Controls", "Accessibility", "Camera" });
                }
            }
        }

        [UnityTest]
        public IEnumerator ContextResume_DoubleEnableSingleDisableRemovesAllCallbacks()
        {
            _controller.SetGameplayContext();
            yield return null;

            // Prime the EMA with a held gamepad analog (prev > 0).
            Set(_gamepad.rightTrigger, 0.6f);
            yield return null;
            _processor.ProcessTick(_controller.CaptureLatestRawSample(), false);

            _controller.SetUIContext();
            yield return null;

            // Without the base idempotent guard, double-Enable would subscribe the callback twice; a
            // single Disable removes the ONLY subscription, leaving the EMA untouched by the resume.
            var reinitializer = new ContextResumeEmaReinitializer(_controller, _processor);
            reinitializer.Enable();
            reinitializer.Enable();
            reinitializer.Disable();

            // Release the analog so a live callback would re-seed to 0 on the resume below.
            Set(_gamepad.rightTrigger, 0f);
            yield return null;

            _controller.SetGameplayContext();
            yield return null;

            // Callback removed → the UI→Gameplay transition did not re-seed; the EMA decayed from its
            // primed value (≈0.12) instead of dropping to 0.
            SimulationInput input = _processor.ProcessTick(_controller.CaptureLatestRawSample(), false);
            Assert.Greater(input.AccelerateOut, 0.01f, "Disable removed the callback → EMA preserved across resume.");
        }

        private sealed class GridLockMock
        {
            public int ObservedTicks;
            public float LastThrottle;
            public float CarVelocity;

            public void Observe(SimulationInput input)
            {
                ObservedTicks++;
                LastThrottle = input.AccelerateOut;
                // Vehicle Physics (grid lock) holds the car: the input is consumed but never
                // converted into velocity while the lock is active.
                CarVelocity = 0f;
            }
        }

        private sealed class LifecycleDriverMock
        {
            private readonly InputContextController _controller;
            private bool _readyConsumed;
            public int GameplayTransitions;

            public LifecycleDriverMock(InputContextController controller)
            {
                _controller = controller;
            }

            public void StartRaceRequested()
            {
                // Simulation accepts the start → content loading → input blocked.
                _controller.SetBlockedContext();
            }

            public void RaceLoadReady(string expectedMode, string actualMode)
            {
                // Only the first matching readiness consumes the transition; wrong-mode and
                // duplicate readiness are ignored (Input stays blocked / already Gameplay).
                if (actualMode == expectedMode && !_readyConsumed)
                {
                    _readyConsumed = true;
                    _controller.SetGameplayContext();
                    GameplayTransitions++;
                }
            }
        }
    }
}
