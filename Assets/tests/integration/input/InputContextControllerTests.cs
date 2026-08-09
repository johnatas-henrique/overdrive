using System.Collections;
using NUnit.Framework;
using Overdrive.Input;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.Controls;
using UnityEngine.InputSystem.LowLevel;
using UnityEngine.InputSystem.UI;
using UnityEngine.TestTools;
using UnityEngine.UI;

namespace Overdrive.Input.Tests
{
    /// <summary>Integration evidence for Story 001's action asset and context controller.</summary>
    [TestFixture]
    public sealed class InputContextControllerTests : InputTestFixture
    {
        private Keyboard _keyboard;
        private Gamepad _gamepad;
        private GameObject _eventSystemObject;
        private InputSystemUIInputModule _uiModule;
        private InputSystem_Actions _actions;
        private InputContextController _controller;

        [SetUp]
        public void SetUpStory001()
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
        public void TearDownStory001()
        {
            _controller?.Unbind();
            _actions?.Dispose();
            if (_eventSystemObject != null)
            {
                Object.DestroyImmediate(_eventSystemObject);
            }
        }

        [UnityTest]
        public IEnumerator AC12_ConfirmRoutesToSubmitWithoutGameplayEdge()
        {
            _controller.SetUIContext();
            yield return null;
            yield return ClickAndSettle(_keyboard.enterKey);
            Assert.AreEqual(1, _controller.SubmitCount);
            Assert.AreEqual(0, _controller.GameplayEdgeCount);
            Assert.AreEqual(0, _controller.PauseEdgeCount);
            yield return ClickAndSettle(_gamepad.buttonSouth);
            Assert.AreEqual(2, _controller.SubmitCount);
            Assert.AreEqual(0, _controller.GameplayEdgeCount);
            Assert.AreEqual(0, _controller.PauseEdgeCount);
            yield return ClickAndSettle(_keyboard.escapeKey);
            Assert.AreEqual(1, _controller.CancelCount);
            Assert.AreEqual(2, _controller.SubmitCount);
            Assert.AreEqual(0, _controller.PauseEdgeCount);
            Assert.AreEqual(0, _controller.GameplayEdgeCount);
            Assert.AreEqual(0, _controller.UiPauseCount);
        }

        [UnityTest]
        public IEnumerator AC13_CancelRoutesToCancelWithoutGameplayEdge()
        {
            _controller.SetUIContext();
            yield return null;
            yield return ClickAndSettle(_keyboard.escapeKey);
            Assert.AreEqual(1, _controller.CancelCount);
            Assert.AreEqual(0, _controller.PauseEdgeCount);
            Assert.AreEqual(0, _controller.GameplayEdgeCount);
            Assert.AreEqual(0, _controller.UiPauseCount);
            yield return ClickAndSettle(_gamepad.buttonEast);
            Assert.AreEqual(2, _controller.CancelCount);
            Assert.AreEqual(0, _controller.GameplayEdgeCount);
            Assert.AreEqual(0, _controller.PauseEdgeCount);
        }

        [Test]
        public void AC30_InputSettingsUsesDynamicUpdate()
        {
            Assert.AreEqual(InputSettings.UpdateMode.ProcessEventsInDynamicUpdate, InputSystem.settings.updateMode);
            InputSettings assetSettings = UnityEditor.AssetDatabase.LoadAssetAtPath<InputSettings>("Assets/source/InputSystemSettings.asset");
            Assert.IsNotNull(assetSettings);
            Assert.AreEqual(InputSettings.UpdateMode.ProcessEventsInDynamicUpdate, assetSettings.updateMode);
        }

        [UnityTest]
        public IEnumerator AC35_UIContextDoesNotEmitGameplayValuesOrEdges()
        {
            _controller.SetUIContext();
            yield return null;
            yield return ClickAndSettle(_keyboard.wKey);
            yield return ClickAndSettle(_keyboard.sKey);
            Set(_gamepad.leftStick, new Vector2(1f, 0f));
            yield return null;
            Assert.AreEqual(0, _controller.GameplayValueEventCount);
            Assert.AreEqual(0, _controller.GameplayEdgeCount);
        }

        [UnityTest]
        public IEnumerator AC45_ExactlyOneMapEnabledPerContextAndIdempotentRepeats()
        {
            _controller.SetGameplayContext();
            yield return null;
            Assert.AreEqual(1, EnabledMapCount());
            Assert.IsTrue(_actions.Gameplay.enabled);
            Assert.IsFalse(_actions.UI.enabled);
            _controller.SetGameplayContext();
            Assert.AreEqual(1, EnabledMapCount());
            _controller.SetUIContext();
            yield return null;
            Assert.AreEqual(1, EnabledMapCount());
            Assert.IsFalse(_actions.Gameplay.enabled);
            Assert.IsTrue(_actions.UI.enabled);
            _controller.SetUIContext();
            Assert.AreEqual(1, EnabledMapCount());
        }

        [UnityTest]
        public IEnumerator AC47_ExplicitFocusBoundaryDoesNotWrap()
        {
            _controller.SetUIContext();
            yield return null;
            GameObject[] selectables = { CreateSelectable("First"), CreateSelectable("Middle"), CreateSelectable("Last") };
            GameObject first = selectables[0];
            GameObject middle = selectables[1];
            GameObject last = selectables[2];
            try
            {
                Navigation firstNavigation = first.GetComponent<Selectable>().navigation;
                firstNavigation.mode = Navigation.Mode.Explicit;
                firstNavigation.selectOnDown = middle.GetComponent<Selectable>();
                first.GetComponent<Selectable>().navigation = firstNavigation;
                Navigation middleNavigation = middle.GetComponent<Selectable>().navigation;
                middleNavigation.mode = Navigation.Mode.Explicit;
                middleNavigation.selectOnUp = first.GetComponent<Selectable>();
                middleNavigation.selectOnDown = last.GetComponent<Selectable>();
                middle.GetComponent<Selectable>().navigation = middleNavigation;
                Navigation lastNavigation = last.GetComponent<Selectable>().navigation;
                lastNavigation.mode = Navigation.Mode.Explicit;
                lastNavigation.selectOnUp = middle.GetComponent<Selectable>();
                last.GetComponent<Selectable>().navigation = lastNavigation;
                // Prove navigation is actually processed (inward First -> Middle -> Last) before testing the boundary.
                EventSystem.current.SetSelectedGameObject(first);
                yield return null;
                yield return PressAndHold(_keyboard.downArrowKey, 5);
                Assert.AreSame(middle, EventSystem.current.currentSelectedGameObject);
                yield return PressAndHold(_keyboard.downArrowKey, 5);
                Assert.AreSame(last, EventSystem.current.currentSelectedGameObject);
                // Outward: Last navigating down must not wrap.
                yield return PressAndHold(_keyboard.downArrowKey, 5);
                Assert.AreSame(last, EventSystem.current.currentSelectedGameObject);
                // Outward: First navigating up must not wrap.
                EventSystem.current.SetSelectedGameObject(first);
                yield return null;
                yield return PressAndHold(_keyboard.upArrowKey, 5);
                Assert.AreSame(first, EventSystem.current.currentSelectedGameObject);
            }
            finally
            {
                foreach (GameObject selectable in selectables)
                {
                    Object.DestroyImmediate(selectable);
                }
            }
        }

        [UnityTest]
        public IEnumerator AC49_UISouthEastAndStartRouteByContext()
        {
            _controller.SetUIContext();
            yield return null;
            yield return ClickAndSettle(_gamepad.buttonSouth);
            yield return ClickAndSettle(_gamepad.buttonEast);
            yield return ClickAndSettle(_gamepad.startButton);
            Assert.AreEqual(1, _controller.SubmitCount);
            Assert.AreEqual(1, _controller.CancelCount);
            Assert.AreEqual(1, _controller.UiPauseCount);
            Assert.AreEqual(0, _controller.PauseEdgeCount);
            Assert.AreEqual(0, _controller.GameplayEdgeCount);
            _controller.SetGameplayContext();
            yield return null;
            yield return ClickAndSettle(_gamepad.startButton);
            Assert.AreEqual(1, _controller.PauseEdgeCount);
            Assert.AreEqual(1, _controller.GameplayEdgeCount);
            Assert.AreEqual(1, _controller.UiPauseCount);
        }

        [Test]
        public void AC69_AssetHasApprovedMapsActionsAndBindings()
        {
            Assert.AreEqual(2, _actions.asset.actionMaps.Count);
            Assert.AreEqual("OverdriveGameplay", _actions.asset.actionMaps[0].name);
            Assert.AreEqual("OverdriveUI", _actions.asset.actionMaps[1].name);
            Assert.AreEqual(5, _actions.asset.actionMaps[0].actions.Count);
            Assert.AreEqual(6, _actions.asset.actionMaps[1].actions.Count);
            string[] gameplayActionNames = { "Accelerate", "Brake", "Steer", "Pause", "CameraToggle" };
            string[] uiActionNames = { "Navigate", "Point", "Click", "Confirm", "Cancel", "Pause" };
            foreach (InputAction action in _actions.asset.actionMaps[0].actions)
            {
                Assert.Contains(action.name, gameplayActionNames, $"Gameplay map contains unexpected action '{action.name}'");
            }

            foreach (InputAction action in _actions.asset.actionMaps[1].actions)
            {
                Assert.Contains(action.name, uiActionNames, $"UI map contains unexpected action '{action.name}'");
            }
            Assert.AreEqual(11, _actions.asset.actionMaps[0].actions.Count + _actions.asset.actionMaps[1].actions.Count);
            string[] actionNames = { "Accelerate", "Brake", "Steer", "Pause", "CameraToggle", "Navigate", "Point", "Click", "Confirm", "Cancel" };
            foreach (string actionName in actionNames)
            {
                Assert.IsNotNull(_actions.asset.FindAction(actionName, throwIfNotFound: false));
            }
            Assert.IsNotNull(_actions.asset.FindAction("OverdriveUI/Pause", throwIfNotFound: false));
            string[] templateActions = { "Jump", "Move", "Look", "Fire", "Sprint", "Crouch", "Throw", "Interact" };
            foreach (string templateName in templateActions)
            {
                Assert.IsNull(_actions.asset.FindAction(templateName, throwIfNotFound: false), $"Template action '{templateName}' must not exist in the asset");
            }

            foreach (InputActionMap map in _actions.asset.actionMaps)
            {
                foreach (InputAction action in map.actions)
                {
                    Assert.Contains(action.name, actionNames, $"Unexpected action '{action.name}' outside the approved Core Rule 1 set");
                }
            }
            AssertBindingContains(_actions.Gameplay.Accelerate, "<Keyboard>/w");
            AssertBindingContains(_actions.Gameplay.Accelerate, "<Keyboard>/upArrow");
            AssertBindingContains(_actions.Gameplay.Accelerate, "<Gamepad>/rightTrigger");
            AssertBindingContains(_actions.Gameplay.Pause, "<Keyboard>/escape");
            AssertBindingContains(_actions.Gameplay.Pause, "<Gamepad>/start");
            AssertBindingContains(_actions.UI.Confirm, "<Keyboard>/enter");
            AssertBindingContains(_actions.UI.Confirm, "<Gamepad>/buttonSouth");
            AssertBindingContains(_actions.UI.Cancel, "<Keyboard>/escape");
            AssertBindingContains(_actions.UI.Cancel, "<Gamepad>/buttonEast");
            AssertBindingContains(_actions.UI.Pause, "<Keyboard>/p");
            AssertBindingContains(_actions.UI.Pause, "<Gamepad>/start");
            AssertBindingContains(_actions.Gameplay.CameraToggle, "<Keyboard>/c");
            AssertBindingContains(_actions.Gameplay.CameraToggle, "<Gamepad>/buttonNorth");
        }

        [UnityTest]
        public IEnumerator CameraToggle_RoutesSinglePerformedEvent()
        {
            int eventCount = 0;
            _controller.OnCameraToggleRequested += () => eventCount++;
            _controller.SetGameplayContext();
            yield return null;
            yield return ClickAndSettle(_keyboard.cKey);
            Assert.AreEqual(1, _controller.CameraToggleCount);
            Assert.AreEqual(1, eventCount);
            Assert.AreEqual(1, _controller.GameplayEdgeCount);
            yield return ClickAndSettle(_keyboard.cKey);
            Assert.AreEqual(2, _controller.CameraToggleCount);
            Assert.AreEqual(2, eventCount);
            // Holding must not repeat: a fresh press fires once, then holding adds nothing.
            int beforeHold = _controller.CameraToggleCount;
            Press(_keyboard.cKey);
            yield return null;
            Assert.AreEqual(beforeHold + 1, _controller.CameraToggleCount);
            int duringHold = _controller.CameraToggleCount;
            yield return null;
            yield return null;
            Assert.AreEqual(duringHold, _controller.CameraToggleCount);
            Assert.AreEqual(duringHold, eventCount);
            Release(_keyboard.cKey);
            yield return null;
        }

        [UnityTest]
        public IEnumerator Unbind_ClearsModuleStateAndStopsCallbacks()
        {
            _controller.SetUIContext();
            yield return null;
            _controller.Unbind();
            Assert.AreEqual(InputContextKind.None, _controller.CurrentContext);
            Assert.IsFalse(_actions.Gameplay.enabled);
            Assert.IsFalse(_actions.UI.enabled);
            Assert.IsFalse(_uiModule.enabled);
            Assert.IsNull(_uiModule.submit);
            Assert.IsNull(_uiModule.cancel);
            Assert.IsNull(_uiModule.move);
            Assert.IsNull(_uiModule.point);
            Assert.IsNull(_uiModule.leftClick);
            Assert.IsNull(_uiModule.actionsAsset);
            int before = _controller.SubmitCount;
            yield return ClickAndSettle(_keyboard.enterKey);
            Assert.AreEqual(before, _controller.SubmitCount);
        }

        [UnityTest]
        public IEnumerator EnforceGlobalSoleOwnership_DisablesForeignAssetOnTransition()
        {
            InputActionAsset foreign = ScriptableObject.CreateInstance<InputActionAsset>();
            try
            {
                InputActionMap foreignMap = foreign.AddActionMap("Foreign");
                foreignMap.AddAction("ForeignAction");
                foreign.Enable();
                Assert.IsTrue(foreign.enabled);
                _controller.SetGameplayContext();
                yield return null;
                Assert.IsFalse(foreign.enabled);
            }
            finally
            {
                Object.DestroyImmediate(foreign);
            }
        }

        private int EnabledMapCount()
        {
            int count = 0;
            if (_actions.Gameplay.enabled) count++;
            if (_actions.UI.enabled) count++;
            return count;
        }

        private static GameObject CreateSelectable(string name)
        {
            GameObject gameObject = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
            return gameObject;
        }

        private IEnumerator ClickAndSettle(ButtonControl control)
        {
            Press(control);
            yield return null;
            Release(control);
            yield return null;
        }

        private IEnumerator PressAndHold(ButtonControl control, int holdFrames)
        {
            Press(control);
            for (int i = 0; i < holdFrames; ++i)
                yield return null;
            Release(control);
            yield return null;
        }

        private static void AssertBindingContains(InputAction action, string path)
        {
            foreach (InputBinding binding in action.bindings)
            {
                if (binding.effectivePath == path)
                {
                    return;
                }
            }

            Assert.Fail($"Missing binding {path} on {action.name}");
        }
    }
}
