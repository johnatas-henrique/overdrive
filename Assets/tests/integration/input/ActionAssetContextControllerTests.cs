// Story 001 (Input System epic) acceptance tests: action asset inventory + InputContextController.
//
// AC-69  Action asset: exactly two maps (OverdriveGameplay 5 actions, OverdriveUI 6 actions),
//        required bindings per GDD Core Rule 1, no template gameplay actions, no duplicate
//        bindings, every required action has at least one binding.
// AC-30  InputSettings.updateMode == ProcessEventsInDynamicUpdate (pinned settings asset is
//        the active InputSystem.settings).
// AC-45  Context transitions leave exactly one action map enabled; destroying the controller
//        mid-context satisfies the generated wrapper's finalizer contract (both maps disabled).
// AC-45b Sole ownership: static source scan + public-surface reflection + runtime attempt
//        (the attempt has no lasting effect — re-asserted on the next controller update).
//        The public-surface reflection allows exactly one asset exposure: the read-only
//        ActiveAsset accessor (story-001 round 8) — getter-only, not an activation surface.
// AC-12/13/49a UI routing: Confirm->Submit / Cancel->Cancel fire exactly once (single press,
//        held input, simultaneous South+East), no gameplay edge.
// AC-49b Pause edge rises exactly once per press; hold does not re-raise; re-press re-raises;
//        Gameplay→UI transition consumes the pending edge.
//
// All tests run in PlayMode (single assembly per the story's single-file mandate): the
// deterministic asset/config/scan tests need no frames and are plain [Test]; the context and
// routing tests are [UnityTest] with input simulated via InputTestFixture /
// InputSystem.QueueStateEvent. No randomness, no wall-clock assertions, no external I/O.

using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
using UnityEngine.TestTools;

/// <summary>
/// Integration tests for the Input System story-001 slice: the InputSystem_Actions asset
/// (AC-69/AC-30) and the InputContextController context/routing contract (AC-45/45b/12/13/49a/49b).
/// </summary>
public class ActionAssetContextControllerTests : InputTestFixture
{
    // Device lifecycle contract (fourth review round): this suite deliberately does NOT remove
    // devices explicitly per test. InputTestFixture.TearDown → InputSystem.Restore()
    // (InputTestFixture.cs:192) is the canonical framework contract: it restores all input
    // state including devices, and runs even when a test fails — so per-test removal would be
    // redundant. Documented as a decision, not an oversight. The one exception is
    // AC69_Asset_AxisActions_ResolveToFloatControls, whose explicit try/finally removal is
    // kept because that test resolves controls mid-body and keeps its own assertions
    // deterministic (harmless duplication of the fixture contract).

    private const string AssetPath = "Assets/InputSystem_Actions.inputactions";
    // Canonical Input System settings asset path (InputSettingsProvider.CreateNewSettingsAsset
    // default). The bare .inputsettings extension cannot be imported as a ScriptableObject in
    // Unity 6.3 (AssetDatabase refuses it), so the pinned asset uses the .asset extension.
    private const string SettingsAssetPath = "Assets/InputSystem.inputsettings.asset";

    private InputContextController _controller;
    private readonly List<GameObject> _tracked = new List<GameObject>();

    // ------------------------------------------------------------------ helpers

    private InputContextController CreateController()
    {
        var go = new GameObject("InputContextController");
        _tracked.Add(go);
        _controller = go.AddComponent<InputContextController>();
        return _controller;
    }

    private UiRoutingProbe CreateUiRoutingProbe()
    {
        var go = new GameObject("UiRoutingProbe");
        _tracked.Add(go);
        var probe = go.AddComponent<UiRoutingProbe>();
        if (EventSystem.current != null)
            EventSystem.current.SetSelectedGameObject(go);
        return probe;
    }

    private static InputSystemUIInputModule GetModule(InputContextController controller)
    {
        var field = typeof(InputContextController).GetField("_uiModule", BindingFlags.NonPublic | BindingFlags.Instance);
        Assert.IsNotNull(field, "controller field '_uiModule' not found");
        return (InputSystemUIInputModule)field.GetValue(controller);
    }

    /// <summary>
    /// Yields up to <paramref name="maxFrames"/> frames until <paramref name="condition"/>
    /// returns true, then stops. Synchronizes the routing tests on the EVENT rather than a
    /// fixed post-press frame count (round-8b flake hardening): the UI module skips Process()
    /// on its activation frame (EventSystem.Update activating the freshly enabled module,
    /// InputSystemUIInputModule), and a rare frame-boundary alignment can land the queued
    /// press on that skipped frame — the module never sees the press edge that frame, so a
    /// fixed 3-frame wait occasionally asserted 0 (observed ~1/10 before hardening). The
    /// caller asserts the expected count after this returns; if the condition never holds the
    /// loop simply exhausts and the caller's assert fails with the per-test message.
    /// </summary>
    private static IEnumerator WaitUntilTrue(int maxFrames, Func<bool> condition)
    {
        for (var i = 0; i < maxFrames && !condition(); i++)
            yield return null;
    }

    [UnityTearDown]
    public IEnumerator Teardown()
    {
        foreach (var go in _tracked)
            if (go != null)
                UnityEngine.Object.Destroy(go);
        _tracked.Clear();
        _controller = null;
        yield return null; // let deferred destruction complete before the next test
    }

    /// <summary>Receives uGUI Submit/Cancel events routed by the InputSystemUIInputModule.</summary>
    private class UiRoutingProbe : MonoBehaviour, ISubmitHandler, ICancelHandler
    {
        public int SubmitCount;
        public int CancelCount;

        public void OnSubmit(BaseEventData eventData) => SubmitCount++;
        public void OnCancel(BaseEventData eventData) => CancelCount++;
    }

    /// <summary>
    /// A rogue component that attempts to activate the UI input module from outside the
    /// controller (the maps are reachable only via the sanctioned ActiveAsset read path, and
    /// external activation has no lasting effect — corrected by the next context transition; the
    /// rogue below targets the module only). The
    /// attempt has a momentary effect — the controller's per-frame re-assertion (AC-45b)
    /// undoes it, so it has no lasting effect.
    ///
    /// MECHANISM (updated by the third review round): the rogue locates the module with
    /// FindFirstObjectByType — a legitimate external reach any component could make — so it
    /// does not depend on where the module lives. That decouples the test from the
    /// controller's EventSystem placement: whether the controller creates the EventSystem on
    /// its own GameObject (isolated test scene) or reuses a pre-existing one (whose
    /// GameObject hosts the module), the rogue finds the module either way. ModuleReached
    /// stays false only if no module exists at all, which the assertion at the call site
    /// would catch.
    /// </summary>
    private class RogueInputActivator : MonoBehaviour
    {
        public bool ModuleReached;

        public void AttemptActivation()
        {
            var module = FindFirstObjectByType<InputSystemUIInputModule>();
            if (module != null)
            {
                ModuleReached = true;
                module.enabled = true; // external activation attempt; no lasting effect
            }
        }
    }

    // ------------------------------------------------------------------ asset helpers

    private static InputActionAsset LoadAsset()
    {
        var asset = AssetDatabase.LoadAssetAtPath<InputActionAsset>(AssetPath);
        Assert.IsNotNull(asset, $"input actions asset missing at {AssetPath}");
        return asset;
    }

    /// <summary>Strips a <c>//</c> line comment so doc comments do not trip the source scan.</summary>
    private static string StripLineComment(string line)
    {
        var idx = line.IndexOf("//", StringComparison.Ordinal);
        return idx < 0 ? line : line.Substring(0, idx);
    }

    private static IEnumerable<string> GroupsOf(InputBinding binding) =>
        (binding.groups ?? string.Empty).Split(';').Where(g => g.Length > 0);

    private static void AssertBindingExists(InputAction action, string path, string group)
    {
        var found = action.bindings.Any(b => b.path == path && GroupsOf(b).Contains(group));
        Assert.IsTrue(found, $"'{action.name}' missing binding '{path}' in scheme '{group}'");
    }

    private static void AssertCompositePart(InputAction action, string compositeType, string partName, string path, string group)
    {
        var found = action.bindings.Any(b =>
            b.isPartOfComposite && b.name == partName && b.path == path && GroupsOf(b).Contains(group)
            && action.bindings.Any(root => root.isComposite && root.path == compositeType));
        Assert.IsTrue(found, $"'{action.name}' missing composite '{compositeType}' part '{partName}' '{path}' in scheme '{group}'");
    }

    /// <summary>
    /// Global N-1 guard (fourth review round): with a context active, every action currently
    /// enabled in the running InputSystem must belong to the controller's Overdrive asset AND
    /// to exactly the commanded map — nothing else, from any asset. Strictly stronger than
    /// rejecting the package's embedded DefaultInputActions by name: an extra Overdrive map
    /// enabled elsewhere, a second Overdrive asset instance, or a stale default-asset reference
    /// each fail here. Map/asset identity (reference equality) is the comparison, so renames
    /// cannot hide drift.
    /// </summary>
    private static void AssertAllEnabledActionsBelongTo(InputActionMap commandedMap, string context)
    {
        Assert.IsNotNull(commandedMap, $"{context}: commanded map must exist (module not wired to the Overdrive asset)");
        var asset = commandedMap.asset;
        Assert.IsNotNull(asset, $"{context}: commanded map must belong to an asset");
        foreach (var action in InputSystem.ListEnabledActions())
        {
            Assert.AreSame(asset, action.actionMap?.asset,
                $"{context}: enabled action '{action.name}' must belong to the controller's Overdrive asset " +
                $"'{asset.name}' — found '{action.actionMap?.asset?.name ?? "<no asset>"}'");
            Assert.AreSame(commandedMap, action.actionMap,
                $"{context}: enabled action '{action.name}' must belong to the commanded map '{commandedMap.name}' — " +
                $"found '{action.actionMap?.name ?? "<no map>"}'");
        }
    }

    /// <summary>
    /// Asserts two InputActionAssets are structurally identical across the full serialized
    /// schema that matters for runtime behavior, not just map/action/binding names:
    ///   asset level:   control schemes (names + device requirements: controlPath, isOptional,
    ///                  isOR) and per-map ids;
    ///   map level:     name, id, action count;
    ///   action level:  name, id, type, expectedControlType, processors, interactions,
    ///                  wantsInitialStateCheck (the runtime name of the JSON initialStateCheck
    ///                  field), binding count;
    ///   binding level: id, path, groups, name, interactions, processors, isComposite,
    ///                  isPartOfComposite — in the same order.
    /// Runtime state (enabled flags, callbacks) is not compared. Deterministic: both sides
    /// deserialize from the same JSON ordering (the project asset and the generated wrapper's
    /// embedded JSON), so positional comparison is stable.
    ///
    /// Every field above is compared through the public runtime API — verified against
    /// Input System 1.19.0 (InputAction.id/type/expectedControlType/processors/interactions/
    /// wantsInitialStateCheck, InputActionMap.id, InputBinding.interactions/processors,
    /// InputControlScheme.name/deviceRequirements all public-readable). Two fields are not
    /// compared directly because they are redundant by construction: InputControlScheme.bindingGroup
    /// equals the scheme name (already compared above), and InputBinding.action equals the owning
    /// action (bindings are enumerated within each action's binding array). Both fields ARE
    /// public in 1.19.0.
    /// </summary>
    private static void AssertAssetsStructurallyEqual(InputActionAsset expected, InputActionAsset actual, string context)
    {
        // Control schemes: names + device requirements (JSON m_ControlSchemes → runtime
        // asset.controlSchemes). Positional order is preserved by both deserializers.
        Assert.AreEqual(expected.controlSchemes.Count, actual.controlSchemes.Count, $"{context}: control scheme count");
        for (var s = 0; s < expected.controlSchemes.Count; s++)
        {
            var expectedScheme = expected.controlSchemes[s];
            var actualScheme = actual.controlSchemes[s];
            var schemeWhere = $"{context}: scheme {s}";
            Assert.AreEqual(expectedScheme.name, actualScheme.name, $"{schemeWhere} name");
            Assert.AreEqual(expectedScheme.deviceRequirements.Count, actualScheme.deviceRequirements.Count,
                $"{schemeWhere} '{expectedScheme.name}' device requirement count");
            for (var d = 0; d < expectedScheme.deviceRequirements.Count; d++)
            {
                var expectedRequirement = expectedScheme.deviceRequirements[d];
                var actualRequirement = actualScheme.deviceRequirements[d];
                var requirementWhere = $"{schemeWhere} '{expectedScheme.name}' device requirement {d}";
                Assert.AreEqual(expectedRequirement.controlPath ?? "", actualRequirement.controlPath ?? "",
                    $"{requirementWhere} controlPath");
                Assert.AreEqual(expectedRequirement.isOptional, actualRequirement.isOptional,
                    $"{requirementWhere} isOptional");
                Assert.AreEqual(expectedRequirement.isOR, actualRequirement.isOR, $"{requirementWhere} isOR");
            }
        }

        Assert.AreEqual(expected.actionMaps.Count, actual.actionMaps.Count, $"{context}: map count");
        for (var m = 0; m < expected.actionMaps.Count; m++)
        {
            var expectedMap = expected.actionMaps[m];
            var actualMap = actual.actionMaps[m];
            Assert.AreEqual(expectedMap.name, actualMap.name, $"{context}: map {m} name");
            Assert.AreEqual(expectedMap.id, actualMap.id, $"{context}: map '{expectedMap.name}' id");
            Assert.AreEqual(expectedMap.actions.Count, actualMap.actions.Count,
                $"{context}: map '{expectedMap.name}' action count");
            for (var a = 0; a < expectedMap.actions.Count; a++)
            {
                var expectedAction = expectedMap.actions[a];
                var actualAction = actualMap.actions[a];
                var actionWhere = $"{context}: map '{expectedMap.name}' action {a}";
                Assert.AreEqual(expectedAction.name, actualAction.name, $"{actionWhere} name");
                Assert.AreEqual(expectedAction.id, actualAction.id, $"{actionWhere} '{expectedAction.name}' id");
                Assert.AreEqual(expectedAction.type, actualAction.type, $"{actionWhere} '{expectedAction.name}' type");
                Assert.AreEqual(expectedAction.expectedControlType ?? "", actualAction.expectedControlType ?? "",
                    $"{actionWhere} '{expectedAction.name}' expectedControlType");
                Assert.AreEqual(expectedAction.processors ?? "", actualAction.processors ?? "",
                    $"{actionWhere} '{expectedAction.name}' processors");
                Assert.AreEqual(expectedAction.interactions ?? "", actualAction.interactions ?? "",
                    $"{actionWhere} '{expectedAction.name}' interactions");
                Assert.AreEqual(expectedAction.wantsInitialStateCheck, actualAction.wantsInitialStateCheck,
                    $"{actionWhere} '{expectedAction.name}' initialStateCheck (wantsInitialStateCheck)");
                Assert.AreEqual(expectedAction.bindings.Count, actualAction.bindings.Count,
                    $"{actionWhere} '{expectedAction.name}' binding count");
                for (var b = 0; b < expectedAction.bindings.Count; b++)
                {
                    var expectedBinding = expectedAction.bindings[b];
                    var actualBinding = actualAction.bindings[b];
                    var where = $"{actionWhere} '{expectedAction.name}' binding {b}";
                    Assert.AreEqual(expectedBinding.id, actualBinding.id, $"{where} id");
                    // Null-vs-empty normalization: the generated wrapper's embedded JSON and
                    // the project asset may serialize empty strings differently ("" vs null),
                    // which is a formatting artifact, not structural drift — compare them equal.
                    Assert.AreEqual(expectedBinding.path ?? "", actualBinding.path ?? "", $"{where} path");
                    Assert.AreEqual(expectedBinding.groups ?? "", actualBinding.groups ?? "", $"{where} groups");
                    Assert.AreEqual(expectedBinding.name ?? "", actualBinding.name ?? "", $"{where} name");
                    Assert.AreEqual(expectedBinding.interactions ?? "", actualBinding.interactions ?? "", $"{where} interactions");
                    Assert.AreEqual(expectedBinding.processors ?? "", actualBinding.processors ?? "", $"{where} processors");
                    Assert.AreEqual(expectedBinding.isComposite, actualBinding.isComposite, $"{where} isComposite");
                    Assert.AreEqual(expectedBinding.isPartOfComposite, actualBinding.isPartOfComposite, $"{where} isPartOfComposite");
                }
            }
        }
    }

    // ============================================================ AC-69: action asset

    [Test]
    public void AC69_Asset_HasExactlyTwoMaps_OverdriveGameplayAndOverdriveUI()
    {
        var asset = LoadAsset();
        Assert.AreEqual(2, asset.actionMaps.Count, "exactly two action maps (TR-input-001)");
        Assert.IsNotNull(asset.FindActionMap("OverdriveGameplay"), "map OverdriveGameplay missing");
        Assert.IsNotNull(asset.FindActionMap("OverdriveUI"), "map OverdriveUI missing");
        Assert.IsNull(asset.FindActionMap("Player"), "template map 'Player' must not exist");
        Assert.IsNull(asset.FindActionMap("UI"), "template map 'UI' must not exist");
    }

    [Test]
    public void AC69_Asset_OverdriveGameplay_HasFiveActions_WithRequiredBindings()
    {
        var asset = LoadAsset();
        var map = asset.FindActionMap("OverdriveGameplay");
        Assert.IsNotNull(map);
        var actions = map.actions.Select(a => a.name).ToArray();
        CollectionAssert.AreEquivalent(
            new[] { "Accelerate", "Brake", "Steer", "Pause", "CameraToggle" },
            actions, "OverdriveGameplay action inventory (TR-input-001)");

        // Accelerate: Axis 0-1, W primary + Up secondary (KeyboardMouse), Right Trigger (Gamepad).
        var accelerate = map.FindAction("Accelerate");
        Assert.AreEqual(InputActionType.Value, accelerate.type);
        Assert.AreEqual("Axis", accelerate.expectedControlType);
        AssertBindingExists(accelerate, "<Keyboard>/w", "KeyboardMouse");
        AssertBindingExists(accelerate, "<Keyboard>/upArrow", "KeyboardMouse");
        AssertBindingExists(accelerate, "<Gamepad>/rightTrigger", "Gamepad");

        // Brake: Axis 0-1, S primary + Down secondary, Left Trigger. (ADR typo says A/D;
        // the GDD is authoritative: Brake = S/Down.)
        var brake = map.FindAction("Brake");
        Assert.AreEqual(InputActionType.Value, brake.type);
        Assert.AreEqual("Axis", brake.expectedControlType);
        AssertBindingExists(brake, "<Keyboard>/s", "KeyboardMouse");
        AssertBindingExists(brake, "<Keyboard>/downArrow", "KeyboardMouse");
        AssertBindingExists(brake, "<Gamepad>/leftTrigger", "Gamepad");

        // Steer: Axis -1..1, 1D composite (A/Left negative, D/Right positive), Left Stick X (ADR-0005).
        var steer = map.FindAction("Steer");
        Assert.AreEqual(InputActionType.Value, steer.type);
        Assert.AreEqual("Axis", steer.expectedControlType);
        AssertCompositePart(steer, "1DAxis", "negative", "<Keyboard>/a", "KeyboardMouse");
        AssertCompositePart(steer, "1DAxis", "negative", "<Keyboard>/leftArrow", "KeyboardMouse");
        AssertCompositePart(steer, "1DAxis", "positive", "<Keyboard>/d", "KeyboardMouse");
        AssertCompositePart(steer, "1DAxis", "positive", "<Keyboard>/rightArrow", "KeyboardMouse");
        AssertBindingExists(steer, "<Gamepad>/leftStick/x", "Gamepad");

        // Pause: gameplay-only button, Escape + Gamepad Start (reserved).
        var pause = map.FindAction("Pause");
        Assert.AreEqual(InputActionType.Button, pause.type);
        AssertBindingExists(pause, "<Keyboard>/escape", "KeyboardMouse");
        AssertBindingExists(pause, "<Gamepad>/start", "Gamepad");

        // CameraToggle: presentation-only button, C + Gamepad North. NOT routed by the
        // controller in story 001 (story 011 owns its routing).
        var cameraToggle = map.FindAction("CameraToggle");
        Assert.AreEqual(InputActionType.Button, cameraToggle.type);
        AssertBindingExists(cameraToggle, "<Keyboard>/c", "KeyboardMouse");
        AssertBindingExists(cameraToggle, "<Gamepad>/buttonNorth", "Gamepad");
    }

    [Test]
    public void AC69_Asset_OverdriveUI_HasSixActions_WithRequiredBindings()
    {
        var asset = LoadAsset();
        var map = asset.FindActionMap("OverdriveUI");
        Assert.IsNotNull(map);
        var actions = map.actions.Select(a => a.name).ToArray();
        CollectionAssert.AreEquivalent(
            new[] { "Navigate", "Point", "Click", "Confirm", "Cancel", "Pause" },
            actions, "OverdriveUI action inventory (TR-input-001)");

        // Navigate: Vector2, WASD+Arrows (KeyboardMouse), Left Stick + D-pad (Gamepad).
        var navigate = map.FindAction("Navigate");
        AssertCompositePart(navigate, "2DVector", "up", "<Keyboard>/w", "KeyboardMouse");
        AssertCompositePart(navigate, "2DVector", "down", "<Keyboard>/s", "KeyboardMouse");
        AssertCompositePart(navigate, "2DVector", "left", "<Keyboard>/a", "KeyboardMouse");
        AssertCompositePart(navigate, "2DVector", "right", "<Keyboard>/d", "KeyboardMouse");
        AssertCompositePart(navigate, "2DVector", "up", "<Gamepad>/leftStick/up", "Gamepad");
        AssertCompositePart(navigate, "2DVector", "down", "<Gamepad>/leftStick/down", "Gamepad");
        AssertCompositePart(navigate, "2DVector", "left", "<Gamepad>/leftStick/left", "Gamepad");
        AssertCompositePart(navigate, "2DVector", "right", "<Gamepad>/leftStick/right", "Gamepad");
        AssertCompositePart(navigate, "2DVector", "up", "<Gamepad>/dpad/up", "Gamepad");
        AssertCompositePart(navigate, "2DVector", "down", "<Gamepad>/dpad/down", "Gamepad");
        AssertCompositePart(navigate, "2DVector", "left", "<Gamepad>/dpad/left", "Gamepad");
        AssertCompositePart(navigate, "2DVector", "right", "<Gamepad>/dpad/right", "Gamepad");

        // Point / Click: mouse position + left button.
        var point = map.FindAction("Point");
        AssertBindingExists(point, "<Mouse>/position", "KeyboardMouse");
        var click = map.FindAction("Click");
        AssertBindingExists(click, "<Mouse>/leftButton", "KeyboardMouse");

        // Reserved bindings (TR-input-004): Confirm = Enter/South, Cancel = Escape/East,
        // UI Pause = P/Start — none may be removed or replaced.
        var confirm = map.FindAction("Confirm");
        Assert.AreEqual(InputActionType.Button, confirm.type);
        AssertBindingExists(confirm, "<Keyboard>/enter", "KeyboardMouse");
        AssertBindingExists(confirm, "<Gamepad>/buttonSouth", "Gamepad");

        var cancel = map.FindAction("Cancel");
        Assert.AreEqual(InputActionType.Button, cancel.type);
        AssertBindingExists(cancel, "<Keyboard>/escape", "KeyboardMouse");
        AssertBindingExists(cancel, "<Gamepad>/buttonEast", "Gamepad");

        var uiPause = map.FindAction("Pause");
        Assert.AreEqual(InputActionType.Button, uiPause.type);
        AssertBindingExists(uiPause, "<Keyboard>/p", "KeyboardMouse");
        AssertBindingExists(uiPause, "<Gamepad>/start", "Gamepad");
    }

    [Test]
    public void AC69_Asset_NoTemplateActionsRemain()
    {
        var asset = LoadAsset();
        var names = asset.actionMaps.SelectMany(m => m.actions).Select(a => a.name).ToArray();
        var templateNames = new[]
        {
            "Fire1", "Fire2", "Fire3", "Jump", "Move", "Look", "Submit", "Attack",
            "Interact", "Crouch", "Sprint", "Previous", "Next", "ScrollWheel",
            "RightClick", "MiddleClick", "TrackedDevicePosition", "TrackedDeviceOrientation",
        };
        foreach (var name in templateNames)
            CollectionAssert.DoesNotContain(names, name, $"template action '{name}' must not exist");
    }

    [Test]
    public void AC69_Asset_HasKeyboardMouseAndGamepadControlSchemes()
    {
        var asset = LoadAsset();
        var schemes = asset.controlSchemes.Select(s => s.name).ToArray();
        CollectionAssert.AreEquivalent(new[] { "KeyboardMouse", "Gamepad" }, schemes);
        var keyboardMouse = asset.controlSchemes.First(s => s.name == "KeyboardMouse");
        var gamepad = asset.controlSchemes.First(s => s.name == "Gamepad");
        CollectionAssert.AreEquivalent(
            new[] { "<Keyboard>", "<Mouse>" },
            keyboardMouse.deviceRequirements.Select(d => d.controlPath).ToArray(),
            "KeyboardMouse scheme devices");
        CollectionAssert.AreEquivalent(
            new[] { "<Gamepad>" },
            gamepad.deviceRequirements.Select(d => d.controlPath).ToArray(),
            "Gamepad scheme devices");
    }

    [Test]
    public void AC69_Asset_NoDuplicateBindings_AndEveryRequiredActionHasBindings()
    {
        var asset = LoadAsset();

        // QA edge "duplicate binding": no two bindings in the same action may share the
        // (path + control scheme group + binding name) triple. For simple bindings the name
        // is empty, so path + scheme identifies the binding; for composite parts the part
        // name (up/down/left/right/negative/positive) disambiguates; composite roots keep
        // their own name (e.g. the three 2DVector roots Keyboard / Sticks / Dpad). The check
        // is per-action: the same path legitimately appears in different actions (e.g. W is
        // Accelerate in OverdriveGameplay and up in OverdriveUI.Navigate).
        foreach (var map in asset.actionMaps)
        {
            foreach (var action in map.actions)
            {
                var seen = new HashSet<string>();
                foreach (var binding in action.bindings)
                {
                    var groups = GroupsOf(binding).OrderBy(g => g, StringComparer.Ordinal).ToArray();
                    var groupKey = string.Join("|", groups);
                    var key = $"{binding.path}|{groupKey}|{binding.name}";
                    Assert.IsTrue(seen.Add(key),
                        $"duplicate binding in '{map.name}.{action.name}': path '{binding.path}', " +
                        $"scheme '{groupKey}', name '{binding.name}'");
                }
            }
        }

        // QA edge "disabled required action": every required action (Core Rule 1 — the full
        // inventory of both maps, asserted by AC69_Asset_Inventory_HasExactlyTwoMaps) must
        // have at least one binding; a required action with zero bindings is dead
        // ("disabled" in effect) and must not exist.
        foreach (var map in asset.actionMaps)
        {
            foreach (var action in map.actions)
            {
                Assert.Greater(action.bindings.Count, 0,
                    $"required action '{map.name}.{action.name}' has zero bindings (dead action)");
            }
        }
    }

    [Test]
    public void AC69_Asset_AxisActions_ResolveToFloatControls()
    {
        // Resolution hardening (third review round): the AC-69 binding-existence assertions
        // prove a binding is present, but not that it RESOLVES to a control the action's
        // contract can read. An Axis action reads ReadValue<float>(); a binding pointing at a
        // Vector2 control (e.g. a bare <Gamepad>/leftStick) resolves to a StickControl whose
        // valueType is Vector2 — the float read casts `control as InputControl<float>` to
        // null and throws InvalidOperationException at runtime. This test closes the whole
        // class of "binding exists but resolves to the wrong type" bugs: every resolved
        // control of the three Axis actions must be float-typed.
        //
        // Controls only resolve against devices that exist in InputSystem.devices — the
        // binding-existence tests inspect metadata and need none, but resolution does. Follow
        // the suite's established pattern (explicit AddDevice per test, e.g. the AC-12/13/49a
        // routing tests): add the two devices the axis bindings reference, then remove them
        // in finally (the InputTestFixture TearDown also restores device state via
        // SaveAndReset, so even a mid-test failure cannot leak devices into other tests).
        var asset = LoadAsset();
        var keyboard = InputSystem.AddDevice<Keyboard>();
        var gamepad = InputSystem.AddDevice<Gamepad>();
        try
        {
            foreach (var actionName in new[] { "Accelerate", "Brake", "Steer" })
            {
                var action = asset.FindAction(actionName);
                Assert.IsNotNull(action, $"axis action '{actionName}' missing from the asset");
                Assert.Greater(action.controls.Count, 0,
                    $"'{actionName}' must resolve at least one control (binding existence alone is not enough)");
                Assert.IsTrue(action.controls.All(c => c.valueType == typeof(float)),
                    $"'{actionName}' must resolve only to float controls (Axis contract) — found: "
                    + string.Join(", ", action.controls.Select(c => $"{c.path} ({c.valueType})")));
            }
        }
        finally
        {
            InputSystem.RemoveDevice(keyboard);
            InputSystem.RemoveDevice(gamepad);
        }
    }

    [Test]
    public void AC69_Asset_MatchesGeneratedWrapperRuntime()
    {
        // Consistency (third review round, blocking): the controller constructs
        // new InputSystem_Actions() — the generated wrapper embedding the asset JSON at build
        // time — while the other AC-69 tests inspect the .inputactions file. Nothing else
        // proves the two representations are the same asset. If the wrapper is stale — e.g.
        // the asset was edited but the C# class was never regenerated (the failure class that
        // originally blocked this story) — the runtime controller and the inspected asset
        // silently diverge. Compare structure in both directions, not serialized formatting:
        // map/action/binding identity.
        var projectAsset = LoadAsset();
        // Compare while the wrapper is alive: Dispose() destroys the wrapper's asset via
        // UnityEngine.Object.Destroy, whose destruction is deferred to end of frame — reading
        // wrapper.asset after the using-block works only because of that deferral and would
        // read a destroyed-pending object. Restructured so the comparison happens inside the
        // block, while the asset is guaranteed alive.
        using (var wrapper = new InputSystem_Actions())
        {
            var wrapperAsset = wrapper.asset;
            AssertAssetsStructurallyEqual(projectAsset, wrapperAsset, "asset → wrapper");
            AssertAssetsStructurallyEqual(wrapperAsset, projectAsset, "wrapper → asset");
        }
    }

    // ============================================================ AC-30: settings

    [Test]
    public void AC30_InputSettings_UpdateModeIsProcessEventsInDynamicUpdate()
    {
        Assert.IsNotNull(InputSystem.settings, "InputSystem.settings must be available");
        Assert.AreEqual(
            InputSettings.UpdateMode.ProcessEventsInDynamicUpdate,
            InputSystem.settings.updateMode,
            "updateMode must be ProcessEventsInDynamicUpdate (control manifest)");

        var settingsAsset = AssetDatabase.LoadAssetAtPath<InputSettings>(SettingsAssetPath);
        Assert.IsNotNull(settingsAsset, $"settings asset missing at {SettingsAssetPath}");

        // Wiring assertion: the pinned asset must be the editor-tracked ACTIVE settings, not
        // merely another DynamicUpdate default. During Unity Test Framework runs the Input
        // System replaces InputSystem.settings with a temporary in-memory instance
        // (InputSystem.cs InitializeInEditor: "In the tests, this is all we need"), so direct
        // identity against the asset would fail by design. The editor tracks the active
        // settings asset through EditorBuildSettings (InputSystem.cs:2885-2891 "In the
        // editor, we keep track of the settings asset through EditorBuildSettings") — that
        // config object survives test resets and proves the pin is wired.
        UnityEngine.Object activeSettings = null;
        var wired = EditorBuildSettings.TryGetConfigObject("com.unity.input.settings", out activeSettings);
        Assert.IsTrue(wired, "EditorBuildSettings must track the active input settings config object");
        Assert.AreEqual(settingsAsset, activeSettings,
            "pinned settings asset must be the editor-tracked active InputSystem.settings (wired, not defaults)");
        Assert.AreEqual(
            InputSettings.UpdateMode.ProcessEventsInDynamicUpdate,
            settingsAsset.updateMode,
            "pinned settings asset must use ProcessEventsInDynamicUpdate");
    }

    // ============================================================ AC-45b: sole ownership

    [Test]
    public void AC45b_PublicSurface_ExposesNoActivationApi()
    {
        const BindingFlags flags = BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static | BindingFlags.FlattenHierarchy;
        var type = typeof(InputContextController);

        // Action maps, individual actions, and the UI input module all carry public
        // Enable/Disable — InputAction.actionMap exposes InputActionMap.Enable(), so a future
        // `public InputAction PauseAction => ...` would be an activation surface too (round-8b
        // future-proofing). No public member may expose any of them (AC-45b).
        var mapOrModuleTyped = type.GetFields(flags).Where(f =>
                typeof(InputActionMap).IsAssignableFrom(f.FieldType)
                || typeof(InputAction).IsAssignableFrom(f.FieldType)
                || typeof(InputSystemUIInputModule).IsAssignableFrom(f.FieldType))
            .Cast<MemberInfo>() // FieldInfo and PropertyInfo unify on MemberInfo for Concat
            .Concat(type.GetProperties(flags).Where(p =>
                typeof(InputActionMap).IsAssignableFrom(p.PropertyType)
                || typeof(InputAction).IsAssignableFrom(p.PropertyType)
                || typeof(InputSystemUIInputModule).IsAssignableFrom(p.PropertyType)))
            .Select(m => m.Name)
            .ToArray();
        CollectionAssert.IsEmpty(mapOrModuleTyped,
            "public members must not expose action maps, individual actions, or the UI input module");

        // The action ASSET has exactly one sanctioned public exposure: the read-only ActiveAsset
        // accessor (story-001 round 8). The asset itself has no Enable/Disable (InputActionMap
        // does), and the accessor is a getter-only property, so it is a read path, not an
        // activation path. Any second asset exposure would be a contract violation.
        var assetTyped = type.GetFields(flags)
            .Where(f => typeof(InputActionAsset).IsAssignableFrom(f.FieldType))
            .Cast<MemberInfo>()
            .Concat(type.GetProperties(flags)
                .Where(p => typeof(InputActionAsset).IsAssignableFrom(p.PropertyType)))
            .Select(m => m.Name)
            .ToArray();
        CollectionAssert.AreEquivalent(new[] { "ActiveAsset" }, assetTyped,
            "the ONLY public InputActionAsset exposure must be the ActiveAsset accessor");

        // The asset exposure check extends to public METHODS returning InputActionAsset
        // (round-8b future-proofing): a `public InputActionAsset GetActiveAsset()` would be a
        // second, equally activatable exposure. Property accessors (get_*/set_*) appear in
        // the method surface but ARE the ActiveAsset property already covered above —
        // IsSpecialName filters them out (it also filters event accessors and operators,
        // none of which return an asset here). The current type is clean; this guards the
        // future surface.
        var assetReturningMethods = type.GetMethods(flags)
            .Where(m => !m.IsSpecialName && typeof(InputActionAsset).IsAssignableFrom(m.ReturnType))
            .Select(m => m.Name)
            .ToArray();
        CollectionAssert.IsEmpty(assetReturningMethods,
            "no public method may return InputActionAsset (the only sanctioned asset exposure is the ActiveAsset property)");

        var activeAssetProp = type.GetProperty("ActiveAsset", BindingFlags.Public | BindingFlags.Instance);
        Assert.IsNotNull(activeAssetProp, "ActiveAsset must exist as a public instance property");
        Assert.IsTrue(activeAssetProp.CanRead, "ActiveAsset must be readable (sanctioned read path)");
        Assert.IsFalse(activeAssetProp.CanWrite, "ActiveAsset must have NO setter (read-only; the asset's own Enable() remains callable by a consumer through it but has no lasting effect — see AC45b_ActiveAssetActivationViaAccessor_CorrectedByNextTransition)");

        var activationMethods = type.GetMethods(flags)
            .Where(m => m.Name == "Enable" || m.Name == "Disable" || m.Name.Contains("EnableMap") || m.Name.Contains("EnableModule"))
            .Select(m => m.Name)
            .ToArray();
        // Methods RETURNING activation-capable types (InputAction / InputActionMap /
        // InputSystemUIInputModule) would also expose an activation path (e.g.
        // GetGameplayMap() -> map.Enable()); InputActionAsset is covered by the
        // assetReturningMethods check above. Current type is clean (verified).
        var activationTypedReturns = type.GetMethods(flags)
            .Where(m => !m.IsSpecialName)
            .Where(m => typeof(InputAction).IsAssignableFrom(m.ReturnType)
                || typeof(InputActionMap).IsAssignableFrom(m.ReturnType)
                || typeof(InputSystemUIInputModule).IsAssignableFrom(m.ReturnType))
            .Select(m => m.Name)
            .ToArray();
        CollectionAssert.IsEmpty(activationTypedReturns,
            "no public method may return an activation-capable input type");
        CollectionAssert.IsEmpty(activationMethods,
            "no public Enable/Disable activation methods outside the context setters");
    }

    [UnityTest]
    public IEnumerator AC45b_ActiveAssetAccessor_ReturnsControllerAsset_ReadOnly()
    {
        CreateController();
        // Non-null after creation: Awake → EnsureInitialized has run, so the wrapper exists.
        // (Null-before-Awake is not observable through the component lifecycle — Awake runs
        // before any test body can touch the instance.)
        var asset = _controller.ActiveAsset;
        Assert.IsNotNull(asset, "ActiveAsset must be non-null after controller creation");
        Assert.AreEqual("InputSystem_Actions", asset.name,
            "accessor must expose the controller-owned Overdrive wrapper asset");

        _controller.SetGameplayContext();
        yield return null;
        Assert.AreEqual(1, _controller.EnabledMapCount, "exactly one map enabled in Gameplay");

        // Identity (reference equality, the N-1 guard pattern): every enabled action must live
        // on the SAME asset instance the accessor hands out. The shared JSON asset name cannot
        // distinguish a second wrapper's asset — identity must, so the read path can never be
        // pointed at a foreign enabled asset.
        foreach (var action in InputSystem.ListEnabledActions())
        {
            Assert.AreSame(asset, action.actionMap?.asset,
                $"enabled action '{action.name}' must belong to the accessor's asset instance (identity)");
            Assert.AreEqual("OverdriveGameplay", action.actionMap?.name,
                "only the Gameplay map may be enabled in Gameplay context");
        }
        Assert.AreSame(asset, GetModule(_controller).actionsAsset,
            "accessor asset must be the same instance the UI module is wired to");

        // The accessor is a read path, not an activation surface — but the returned asset's
        // public Enable() is callable through it. That activation class is covered by
        // AC45b_ActiveAssetActivationViaAccessor_CorrectedByNextTransition below (the next
        // context transition sweeps the extra map back to exactly-one); not duplicated here.
    }

    [UnityTest]
    public IEnumerator AC45b_ActiveAssetActivationViaAccessor_CorrectedByNextTransition()
    {
        CreateController();
        _controller.SetGameplayContext();
        yield return null; // settle: Gameplay context active, exactly one map enabled
        Assert.AreEqual(1, _controller.EnabledMapCount, "setup: exactly one map enabled in Gameplay");

        // The qa gate's point: InputActionAsset.Enable() is PUBLIC, and the accessor hands out
        // the controller's own asset, so a consumer CAN activate maps through the sanctioned
        // read path. The contract is not "activation is impossible" — it is "activation has no
        // lasting effect: transitions re-establish exactly-one-map". Prove the path is real:
        // enable the UI map through the accessor and observe BOTH maps enabled (yield first,
        // following the AC45_BothMapsForceEnabled setup pattern).
        _controller.ActiveAsset.FindActionMap("OverdriveUI").Enable();
        yield return null;
        Assert.AreEqual(2, _controller.EnabledMapCount,
            "activation via the accessor must be real: both maps enabled after FindActionMap().Enable()");

        // But activation has no lasting effect: re-running a context transition (even the SAME
        // context) re-establishes exactly-one-map — the transition's disable-before-enable
        // (ADR-0005) sweeps the external same-asset activation.
        _controller.SetGameplayContext();
        Assert.AreEqual(1, _controller.EnabledMapCount,
            "the next context transition must restore exactly-one-map after accessor activation");
        Assert.IsFalse(_controller.ActiveAsset.FindActionMap("OverdriveUI").enabled,
            "OverdriveUI map must be disabled again after the transition");

        // N-1 guard: every globally enabled action belongs to the commanded map.
        AssertAllEnabledActionsBelongTo(GetModule(_controller).actionsAsset.FindActionMap("OverdriveGameplay"),
            "Gameplay context after accessor activation");
        yield return null;
    }

    [Test]
    public void AC45b_StaticSourceScan_RejectsExternalActivationCalls()
    {
        var root = Directory.GetParent(Application.dataPath).FullName;
        var scanRoots = new[]
        {
            Path.Combine(root, "Assets", "source"),
            Path.Combine(root, "Assets", "tests"),
        };
        var sources = scanRoots
            .SelectMany(r => Directory.GetFiles(r, "*.cs", SearchOption.AllDirectories))
            .Where(f => !f.EndsWith("InputContextController.cs"))
            // The generated wrapper (InputSystem_Actions.cs) is the ADR-mandated accessor
            // surface; its Enable/Disable helpers are not activation callers, so it is exempt.
            .Where(f => !f.EndsWith("InputSystem_Actions.cs"))
            .Where(f => !f.EndsWith("ActionAssetContextControllerTests.cs"))
            .ToArray();

        Assert.That(sources.Length, Is.GreaterThan(0), "source scan found nothing to check");

        var violations = new List<string>();
        foreach (var file in sources)
        {
            var lines = File.ReadAllLines(file);
            for (var i = 0; i < lines.Length; i++)
            {
                var line = StripLineComment(lines[i]); // doc comments may mention the module name
                if (line.Contains(".Enable(") || line.Contains(".Disable(") || line.Contains("InputSystemUIInputModule"))
                    violations.Add($"{Path.GetFileName(file)}:{i + 1}: {lines[i].Trim()}");
            }
        }

        Assert.IsEmpty(violations,
            "external activation of action maps / UI input module found outside InputContextController:\n"
            + string.Join("\n", violations));

        // Sanity: the scan can detect the sanctioned pattern inside the controller itself.
        // (The generated wrapper InputSystem_Actions.cs is exempt: it is the ADR-mandated
        // accessor surface, not an activation caller.)
        var controllerSource = File.ReadAllText(Path.Combine(root, "Assets", "source", "InputContextController.cs"));
        Assert.IsTrue(controllerSource.Contains(".Enable(") && controllerSource.Contains(".Disable("),
            "sanity: scan must be able to see sanctioned calls in InputContextController");
    }

    // ============================================================ AC-45: context transitions

    [UnityTest]
    public IEnumerator AC45_FreshController_NeitherMapEnabled()
    {
        CreateController();
        yield return null;
        Assert.AreEqual(InputContext.None, _controller.ActiveContext);
        Assert.AreEqual(0, _controller.EnabledMapCount, "fresh controller must have no map enabled");
        Assert.IsFalse(GetModule(_controller).enabled, "UI module must be off before any context");
        Assert.IsFalse(_controller.HasPendingPauseEdge);
    }

    [UnityTest]
    public IEnumerator AC45_SetGameplayContext_ExactlyOneMapEnabled()
    {
        CreateController();
        _controller.SetGameplayContext();
        yield return null;
        Assert.AreEqual(InputContext.Gameplay, _controller.ActiveContext);
        Assert.AreEqual(1, _controller.EnabledMapCount, "exactly one map must be enabled in Gameplay");
        Assert.IsFalse(GetModule(_controller).enabled, "UI module must be disabled in Gameplay");

        // N-1 guard mirror (fourth review round): in Gameplay the commanded map is
        // OverdriveGameplay — every enabled action must belong to it and the Overdrive asset.
        AssertAllEnabledActionsBelongTo(GetModule(_controller).actionsAsset.FindActionMap("OverdriveGameplay"), "Gameplay context");
    }

    [UnityTest]
    public IEnumerator AC45_SetUIContext_ExactlyOneMapEnabled()
    {
        CreateController();
        _controller.SetGameplayContext();
        _controller.SetUIContext();
        yield return null;
        Assert.AreEqual(InputContext.UI, _controller.ActiveContext);
        Assert.AreEqual(1, _controller.EnabledMapCount, "exactly one map must be enabled in UI");
        Assert.IsTrue(GetModule(_controller).enabled, "UI module must be enabled in UI context");

        // N-1 guard (fourth review round, strengthened), global view: enumerate every action
        // enabled in the running InputSystem and require that each belongs to the controller's
        // Overdrive asset AND to exactly the commanded map — nothing else, from any asset.
        // The earlier name-only DefaultInputActions rejection would have missed a second
        // Overdrive asset instance, an extra Overdrive map enabled elsewhere, or a renamed
        // default asset; identity comparison catches all of them.
        AssertAllEnabledActionsBelongTo(GetModule(_controller).actionsAsset.FindActionMap("OverdriveUI"), "UI context");
    }

    [UnityTest]
    public IEnumerator AC45_RepeatedActivation_KeepsExactlyOneMapEnabled()
    {
        CreateController();
        _controller.SetGameplayContext();
        _controller.SetGameplayContext();
        yield return null;
        Assert.AreEqual(1, _controller.EnabledMapCount, "repeated Gameplay activation must stay at one map");
        Assert.AreEqual(InputContext.Gameplay, _controller.ActiveContext);

        _controller.SetUIContext();
        _controller.SetUIContext();
        yield return null;
        Assert.AreEqual(1, _controller.EnabledMapCount, "repeated UI activation must stay at one map");
        Assert.AreEqual(InputContext.UI, _controller.ActiveContext);
    }

    [UnityTest]
    public IEnumerator AC45_BothMapsForceEnabled_TransitionRestoresInvariant()
    {
        CreateController();
        // White-box edge-case setup: enable both maps through the wrapper's aggregate Enable().
        var wrapperField = typeof(InputContextController).GetField("_actions", BindingFlags.NonPublic | BindingFlags.Instance);
        var wrapper = (InputSystem_Actions)wrapperField.GetValue(_controller);
        wrapper.Enable();
        yield return null;
        Assert.AreEqual(2, _controller.EnabledMapCount, "edge-case setup must leave both maps enabled");

        _controller.SetGameplayContext();
        Assert.AreEqual(1, _controller.EnabledMapCount, "transition must restore exactly-one");
        Assert.AreEqual(InputContext.Gameplay, _controller.ActiveContext);

        _controller.SetUIContext();
        Assert.AreEqual(1, _controller.EnabledMapCount, "transition must restore exactly-one");
        Assert.AreEqual(InputContext.UI, _controller.ActiveContext);
        yield return null;
    }

    [UnityTest]
    public IEnumerator AC45_ControllerDestroyedMidGameplay_NoWrapperFinalizerAssert()
    {
        CreateController();
        _controller.SetGameplayContext();
        yield return null; // settle: Gameplay map enabled, module wired

        var go = _controller.gameObject;
        UnityEngine.Object.Destroy(go);
        _controller = null;
        yield return null; // deferred destruction completes: OnDestroy disables both maps, disposes

        // Run the generated wrapper's finalizer deterministically (InputSystem_Actions.cs:727-731).
        // It asserts BOTH maps are disabled when the wrapper is collected; destroying mid-Gameplay
        // must not leave a map enabled or the assert fires here. The Unity Test Framework fails
        // any test that logs an error, so reaching the end of this method is the assertion.
        System.GC.Collect();
        System.GC.WaitForPendingFinalizers();
        yield return null;

        Assert.IsTrue(go == null, "controller GameObject must be destroyed");
    }

    [UnityTest]
    public IEnumerator AC45_EnforceSoleOwnership_DisablesForeignAssetActions()
    {
        // Round-6 regression: EnforceGlobalSoleOwnership() fixed a real defect where an
        // enabled action from ANOTHER InputSystem_Actions wrapper/asset instance survived in
        // the global InputActionState (a leaked wrapper from a prior play-mode environment,
        // domain reload disabled). No existing test exercised that scenario directly — the
        // suite only validated the postcondition on clean runs. This test proves the sweep
        // acts on FOREIGN asset instances by identity (ReferenceEquals on the asset), never
        // by name: every InputSystem_Actions wrapper shares the asset JSON name, so name-based
        // filtering cannot distinguish the controller's asset from a leaked one. A single
        // action is enabled (not a whole map) so the sweep is proven at action granularity.
        var foreign = new InputSystem_Actions();
        try
        {
            var foreignAsset = foreign.asset;
            foreign.OverdriveGameplay.Accelerate.Enable();
            Assert.IsTrue(foreign.OverdriveGameplay.Accelerate.enabled,
                "setup: the foreign action must be enabled in the global InputActionState before the controller exists");

            CreateController();
            yield return null; // settle: controller Awake → EnsureInitialized runs the init sweep
            Assert.IsFalse(foreign.OverdriveGameplay.Accelerate.enabled,
                "controller init (EnsureInitialized) must sweep the foreign action before any context transition");

            _controller.SetGameplayContext();
            yield return null;

            // Postcondition (AC-45, strengthened): no enabled action may belong to the foreign
            // asset — identity via ReferenceEquals, never the shared JSON name. Collect all
            // survivors so a failure reports every one, not just the first.
            var foreignSurvivors = InputSystem.ListEnabledActions()
                .Where(a => ReferenceEquals(a.actionMap?.asset, foreignAsset))
                .Select(a => a.name)
                .ToArray();
            CollectionAssert.IsEmpty(foreignSurvivors,
                "foreign asset actions survived the sole-ownership sweep: " + string.Join(", ", foreignSurvivors));

            // The controller's own actions ARE enabled and the global invariant holds.
            Assert.AreEqual(1, _controller.EnabledMapCount, "exactly one map must be enabled in Gameplay");
            AssertAllEnabledActionsBelongTo(GetModule(_controller).actionsAsset.FindActionMap("OverdriveGameplay"),
                "Gameplay context");
        }
        finally
        {
            // The foreign wrapper is NOT owned by the controller: the sweep only disables its
            // ACTIONS — the wrapper object itself must be disabled and disposed here so it
            // cannot leak into the next test. Disable() first satisfies the generated
            // finalizer's assert (both maps disabled at GC, InputSystem_Actions.cs:727-731);
            // Dispose() destroys the foreign asset (UnityEngine.Object.Destroy, deferred).
            foreign.Disable();
            foreign.Dispose();
        }
    }

    [UnityTest]
    public IEnumerator AC45_Module_ConfirmWiredAsSubmit_CancelWiredAsCancel()
    {
        CreateController();
        yield return null;
        var module = GetModule(_controller);
        Assert.IsNotNull(module.submit, "module.submit must reference OverdriveUI.Confirm");
        Assert.AreEqual("Confirm", module.submit.action.name);
        Assert.AreEqual("OverdriveUI", module.submit.action.actionMap.name);
        Assert.IsNotNull(module.cancel, "module.cancel must reference OverdriveUI.Cancel");
        Assert.AreEqual("Cancel", module.cancel.action.name);
        Assert.AreEqual("OverdriveUI", module.cancel.action.actionMap.name);

        // N-1 guard (second review round): the module was added via AddComponent on an active
        // GameObject, so its OnEnable ran AssignDefaultActions() and wired all 10 references
        // to the package's embedded DefaultInputActions. EnsureInitialized must have called
        // UnassignActions() before the OverdriveUI wiring, so the 5 references this
        // controller does not use must be null — otherwise they would still point at the
        // default asset and get enabled with the module, activating a second input asset with
        // overlapping bindings (ADR-0005: exactly one active map).
        Assert.IsNull(module.rightClick, "module.rightClick must be null (default-asset reference not unassigned)");
        Assert.IsNull(module.middleClick, "module.middleClick must be null (default-asset reference not unassigned)");
        Assert.IsNull(module.scrollWheel, "module.scrollWheel must be null (default-asset reference not unassigned)");
        Assert.IsNull(module.trackedDeviceOrientation, "module.trackedDeviceOrientation must be null (default-asset reference not unassigned)");
        Assert.IsNull(module.trackedDevicePosition, "module.trackedDevicePosition must be null (default-asset reference not unassigned)");
        // UnassignActions() also nulls actionsAsset; the controller reassigns it AFTER the
        // call, so the module must end up on the Overdrive asset — never the embedded default.
        Assert.IsNotNull(module.actionsAsset, "module.actionsAsset must be reassigned after UnassignActions()");
        Assert.AreEqual("InputSystem_Actions", module.actionsAsset.name,
            "module.actionsAsset must be the Overdrive asset, not the embedded DefaultInputActions");
    }

    [UnityTest]
    public IEnumerator AC45b_ExternalActivationAttempt_NoEffect()
    {
        CreateController();
        _controller.SetGameplayContext();

        var rogue = _controller.gameObject.AddComponent<RogueInputActivator>();
        rogue.AttemptActivation();
        Assert.IsTrue(rogue.ModuleReached, "rogue must reach the module component (located via FindFirstObjectByType)");

        // The attempt has a MOMENTARY effect: the module is now enabled. The contract is
        // "no lasting effect" — the controller's per-frame Update re-asserts the module to
        // the commanded context on the next update, with no sanctioned transition involved.
        // The module is the scene-visible activation surface, which is why Update re-asserts
        // it per-frame; the action maps are re-established on context transitions, not
        // per-frame (see InputContextController.Update). Map enablement is asserted only
        // after the re-assertion, because the module's transient OnEnable binds the
        // OverdriveUI actions it references.
        Assert.IsTrue(GetModule(_controller).enabled,
            "rogue activation must enable the module synchronously (transient, no lasting effect)");
        Assert.AreEqual(InputContext.Gameplay, _controller.ActiveContext,
            "external activation must not change the commanded context");

        // No sanctioned transition: the per-frame re-assertion alone restores the contract.
        yield return null;
        Assert.IsFalse(GetModule(_controller).enabled,
            "module must be re-asserted disabled on the next controller update (no lasting effect)");
        Assert.AreEqual(1, _controller.EnabledMapCount,
            "external activation must not change map enablement");
    }

    // ============================================================ AC-12: UI Submit, no gameplay edge

    [UnityTest]
    public IEnumerator AC12_EnterInUIContext_SubmitFiresOnce_NoGameplayPauseEdgeQueued()
    {
        var keyboard = InputSystem.AddDevice<Keyboard>();
        CreateController();
        _controller.SetUIContext();
        var probe = CreateUiRoutingProbe();
        var pauseEdgeCount = 0;
        _controller.PauseEdge += () => pauseEdgeCount++;

        // Settle frame: EventSystem.Update activates the freshly enabled module this frame and
        // skips Process() on the activation frame, so a press must not share the activation frame.
        yield return null;
        Press(keyboard.enterKey, queueEventOnly: true);
        // Round-8b hardening: bounded wait on the event, not a fixed single frame — a rare
        // frame-boundary alignment can land the press on the module's activation frame
        // (Process skipped), see WaitUntilTrue.
        yield return WaitUntilTrue(60, () => probe.SubmitCount == 1);

        Assert.AreEqual(1, probe.SubmitCount, "Enter must route exactly one Submit");
        Assert.AreEqual(0, probe.CancelCount, "Enter must not route Cancel");
        Assert.AreEqual(0, pauseEdgeCount, "UI context must not raise the gameplay Pause edge");
        Assert.IsFalse(_controller.HasPendingPauseEdge, "pending-edge queue must be empty in UI context");
        Assert.AreEqual(1, _controller.EnabledMapCount);
    }

    [UnityTest]
    public IEnumerator AC12_GamepadSouthInUIContext_SubmitFiresOnce_NoGameplayPauseEdgeQueued()
    {
        var gamepad = InputSystem.AddDevice<Gamepad>();
        CreateController();
        _controller.SetUIContext();
        var probe = CreateUiRoutingProbe();
        var pauseEdgeCount = 0;
        _controller.PauseEdge += () => pauseEdgeCount++;

        yield return null; // settle frame (module activation skips Process)
        Press(gamepad.buttonSouth, queueEventOnly: true);
        // Round-8b hardening: bounded wait on the event (see WaitUntilTrue for the mechanism).
        yield return WaitUntilTrue(60, () => probe.SubmitCount == 1);

        Assert.AreEqual(1, probe.SubmitCount, "gamepad South must route exactly one Submit");
        Assert.AreEqual(0, probe.CancelCount, "gamepad South must not route Cancel");
        Assert.AreEqual(0, pauseEdgeCount, "UI context must not raise the gameplay Pause edge");
        Assert.IsFalse(_controller.HasPendingPauseEdge, "pending-edge queue must be empty in UI context");
        Assert.AreEqual(1, _controller.EnabledMapCount);
    }

    [UnityTest]
    public IEnumerator AC12_EnterHeldInUIContext_SubmitFiresOnce_NoRefireWhileHeld()
    {
        var keyboard = InputSystem.AddDevice<Keyboard>();
        CreateController();
        _controller.SetUIContext();
        var probe = CreateUiRoutingProbe();

        yield return null; // settle frame (module activation skips Process)
        // Press and hold: the module fires Submit on the press edge (it checks
        // WasPerformedThisDynamicUpdate per frame, InputSystemUIInputModule.cs:901-904), so
        // holding must not re-fire. Round-8b hardening: a BOUNDED WAIT synchronizes on the
        // event, not a fixed frame count — a rare frame-boundary alignment can land the press
        // on the module's activation frame (Process skipped), and the fixed 3-frame wait then
        // asserted 0 (observed 1/10). Wait up to 60 frames for the event, then hold 3 more
        // frames to prove no re-fire.
        Press(keyboard.enterKey, queueEventOnly: true);
        yield return WaitUntilTrue(60, () => probe.SubmitCount == 1);
        Assert.AreEqual(1, probe.SubmitCount,
            "Enter held press never produced exactly one Submit within 60 frames (got " + probe.SubmitCount + ")");
        yield return null;
        yield return null;
        yield return null;

        Assert.AreEqual(1, probe.SubmitCount, "Enter held must fire exactly one Submit (no re-fire while held)");
        Assert.AreEqual(0, probe.CancelCount, "Enter held must not route Cancel");
    }

    [UnityTest]
    public IEnumerator AC12_GamepadSouthHeldInUIContext_SubmitFiresOnce_NoRefireWhileHeld()
    {
        var gamepad = InputSystem.AddDevice<Gamepad>();
        CreateController();
        _controller.SetUIContext();
        var probe = CreateUiRoutingProbe();

        yield return null; // settle frame (module activation skips Process)
        // Press and hold: the module fires Submit on the press edge (it checks
        // WasPerformedThisDynamicUpdate per frame, InputSystemUIInputModule.cs:901-904), so
        // holding must not re-fire. Round-8b hardening: bounded wait on the event (see
        // AC12_EnterHeldInUIContext for the mechanism).
        Press(gamepad.buttonSouth, queueEventOnly: true);
        yield return WaitUntilTrue(60, () => probe.SubmitCount == 1);
        Assert.AreEqual(1, probe.SubmitCount,
            "gamepad South held press never produced exactly one Submit within 60 frames (got " + probe.SubmitCount + ")");
        yield return null;
        yield return null;
        yield return null;

        Assert.AreEqual(1, probe.SubmitCount, "gamepad South held must fire exactly one Submit (no re-fire while held)");
        Assert.AreEqual(0, probe.CancelCount, "gamepad South held must not route Cancel");
    }

    // ============================================================ AC-13: UI Cancel, no gameplay edge

    [UnityTest]
    public IEnumerator AC13_EscapeInUIContext_CancelFiresOnce_NoGameplayPauseEdgeQueued()
    {
        var keyboard = InputSystem.AddDevice<Keyboard>();
        CreateController();
        _controller.SetUIContext();
        var probe = CreateUiRoutingProbe();
        var pauseEdgeCount = 0;
        _controller.PauseEdge += () => pauseEdgeCount++;

        yield return null; // settle frame (module activation skips Process)
        Press(keyboard.escapeKey, queueEventOnly: true);
        // Round-8b hardening: bounded wait on the event (see WaitUntilTrue for the mechanism).
        yield return WaitUntilTrue(60, () => probe.CancelCount == 1);

        Assert.AreEqual(1, probe.CancelCount, "Escape must route exactly one Cancel");
        Assert.AreEqual(0, probe.SubmitCount, "Escape must not route Submit");
        Assert.AreEqual(0, pauseEdgeCount, "UI context must not raise the gameplay Pause edge");
        Assert.IsFalse(_controller.HasPendingPauseEdge, "pending-edge queue must be empty in UI context");
        Assert.AreEqual(1, _controller.EnabledMapCount);
    }

    [UnityTest]
    public IEnumerator AC13_GamepadEastInUIContext_CancelFiresOnce_NoGameplayPauseEdgeQueued()
    {
        var gamepad = InputSystem.AddDevice<Gamepad>();
        CreateController();
        _controller.SetUIContext();
        var probe = CreateUiRoutingProbe();
        var pauseEdgeCount = 0;
        _controller.PauseEdge += () => pauseEdgeCount++;

        yield return null; // settle frame (module activation skips Process)
        Press(gamepad.buttonEast, queueEventOnly: true);
        // Round-8b hardening: bounded wait on the event (see WaitUntilTrue for the mechanism).
        yield return WaitUntilTrue(60, () => probe.CancelCount == 1);

        Assert.AreEqual(1, probe.CancelCount, "gamepad East must route exactly one Cancel");
        Assert.AreEqual(0, probe.SubmitCount, "gamepad East must not route Submit");
        Assert.AreEqual(0, pauseEdgeCount, "UI context must not raise the gameplay Pause edge");
        Assert.IsFalse(_controller.HasPendingPauseEdge, "pending-edge queue must be empty in UI context");
        Assert.AreEqual(1, _controller.EnabledMapCount);
    }

    [UnityTest]
    public IEnumerator AC13_EscapeHeldInUIContext_CancelFiresOnce_NoRefireWhileHeld()
    {
        var keyboard = InputSystem.AddDevice<Keyboard>();
        CreateController();
        _controller.SetUIContext();
        var probe = CreateUiRoutingProbe();

        yield return null; // settle frame (module activation skips Process)
        // Press and hold: the module fires Cancel on the press edge (it checks
        // WasPerformedThisDynamicUpdate per frame), so holding must not re-fire. Round-8b
        // hardening: bounded wait on the event (see AC12_EnterHeldInUIContext for the
        // mechanism), then hold 3 more frames to prove no re-fire.
        Press(keyboard.escapeKey, queueEventOnly: true);
        yield return WaitUntilTrue(60, () => probe.CancelCount == 1);
        Assert.AreEqual(1, probe.CancelCount,
            "Escape held press never produced exactly one Cancel within 60 frames (got " + probe.CancelCount + ")");
        yield return null;
        yield return null;
        yield return null;

        Assert.AreEqual(1, probe.CancelCount, "Escape held must fire exactly one Cancel (no re-fire while held)");
        Assert.AreEqual(0, probe.SubmitCount, "Escape held must not route Submit");
    }

    [UnityTest]
    public IEnumerator AC13_GamepadEastHeldInUIContext_CancelFiresOnce_NoRefireWhileHeld()
    {
        var gamepad = InputSystem.AddDevice<Gamepad>();
        CreateController();
        _controller.SetUIContext();
        var probe = CreateUiRoutingProbe();

        yield return null; // settle frame (module activation skips Process)
        // Press and hold: the module fires Cancel on the press edge, so holding must not
        // re-fire. Round-8b hardening: bounded wait on the event (see
        // AC12_EnterHeldInUIContext for the mechanism), then hold 3 more frames to prove no
        // re-fire.
        Press(gamepad.buttonEast, queueEventOnly: true);
        yield return WaitUntilTrue(60, () => probe.CancelCount == 1);
        Assert.AreEqual(1, probe.CancelCount,
            "gamepad East held press never produced exactly one Cancel within 60 frames (got " + probe.CancelCount + ")");
        yield return null;
        yield return null;
        yield return null;

        Assert.AreEqual(1, probe.CancelCount, "gamepad East held must fire exactly one Cancel (no re-fire while held)");
        Assert.AreEqual(0, probe.SubmitCount, "gamepad East held must not route Submit");
    }

    [UnityTest]
    public IEnumerator AC13_GamepadStartInUIContext_NoPauseEdgeRises()
    {
        var gamepad = InputSystem.AddDevice<Gamepad>();
        CreateController();
        _controller.SetUIContext();
        var pauseEdgeCount = 0;
        _controller.PauseEdge += () => pauseEdgeCount++;

        // Start is bound to the UI Pause action here, which is not observed for the edge.
        Press(gamepad.startButton, queueEventOnly: true);
        yield return null;

        Assert.AreEqual(0, pauseEdgeCount, "gamepad Start in UI context must not raise the gameplay Pause edge");
        Assert.IsFalse(_controller.HasPendingPauseEdge, "pending-edge queue must be empty in UI context");
    }

    // ============================================================ AC-49a: South→Submit only, East→Cancel only

    [UnityTest]
    public IEnumerator AC49a_GamepadSouth_SubmitOnly_NoCancel()
    {
        var gamepad = InputSystem.AddDevice<Gamepad>();
        CreateController();
        _controller.SetUIContext();
        var probe = CreateUiRoutingProbe();

        yield return null; // settle frame (module activation skips Process)
        Press(gamepad.buttonSouth, queueEventOnly: true);
        // Round-8b hardening: bounded wait on the event (see WaitUntilTrue for the mechanism).
        yield return WaitUntilTrue(60, () => probe.SubmitCount == 1);

        Assert.AreEqual(1, probe.SubmitCount, "South must fire exactly one Submit");
        Assert.AreEqual(0, probe.CancelCount, "South must fire no Cancel");
    }

    [UnityTest]
    public IEnumerator AC49a_GamepadEast_CancelOnly_NoSubmit()
    {
        var gamepad = InputSystem.AddDevice<Gamepad>();
        CreateController();
        _controller.SetUIContext();
        var probe = CreateUiRoutingProbe();

        yield return null; // settle frame (module activation skips Process)
        Press(gamepad.buttonEast, queueEventOnly: true);
        // Round-8b hardening: bounded wait on the event (see WaitUntilTrue for the mechanism).
        yield return WaitUntilTrue(60, () => probe.CancelCount == 1);

        Assert.AreEqual(1, probe.CancelCount, "East must fire exactly one Cancel");
        Assert.AreEqual(0, probe.SubmitCount, "East must fire no Submit");
    }

    [UnityTest]
    public IEnumerator AC49a_SouthAndEastInOneUpdate_SubmitAndCancelEachFireOnce()
    {
        var gamepad = InputSystem.AddDevice<Gamepad>();
        CreateController();
        _controller.SetUIContext();
        var probe = CreateUiRoutingProbe();

        yield return null; // settle frame (module activation skips Process)
        // Both buttons pressed within a single input update (AC-49a edge "Both buttons in one
        // update"): the module executes cancel before submit per frame
        // (InputSystemUIInputModule.cs:901-904) and both actions performed this update, so
        // each reservation fires exactly once.
        Press(gamepad.buttonSouth, queueEventOnly: true);
        Press(gamepad.buttonEast, queueEventOnly: true);
        // Round-8b hardening: bounded wait on BOTH events (see WaitUntilTrue for the
        // mechanism).
        yield return WaitUntilTrue(60, () => probe.SubmitCount == 1 && probe.CancelCount == 1);

        Assert.AreEqual(1, probe.SubmitCount, "South must fire exactly one Submit even when East is pressed in the same update");
        Assert.AreEqual(1, probe.CancelCount, "East must fire exactly one Cancel even when South is pressed in the same update");
    }

    [UnityTest]
    public IEnumerator AC49a_UIMapExternallyDisabled_RestoredByNextTransition()
    {
        // QA edge case "UI map accidentally disabled": an external Disable of OverdriveUI
        // takes effect immediately but has no lasting effect — the commanded map is
        // re-established by the next sanctioned context transition (SetUIContext re-enables
        // the UI map, InputContextController.cs:178; disable-before-enable, ADR-0005). The
        // map is NOT re-asserted per-frame (only the UI module is, per
        // InputContextController.Update); the transition is the map-level recovery path.
        var gamepad = InputSystem.AddDevice<Gamepad>();
        CreateController();
        _controller.SetUIContext();
        var probe = CreateUiRoutingProbe();

        yield return null; // settle frame (module activation skips Process)

        var uiMap = _controller.ActiveAsset.FindActionMap("OverdriveUI");
        Assert.IsNotNull(uiMap, "OverdriveUI map must exist on the controller-owned asset");
        uiMap.Disable(); // external disable through the sanctioned read accessor
        Assert.IsFalse(uiMap.enabled, "external disable must take effect immediately (transient)");

        // Sanctioned transition (idempotent SetUIContext) re-establishes the commanded map.
        _controller.SetUIContext();
        Assert.IsTrue(uiMap.enabled, "next sanctioned transition must restore the UI map");

        Press(gamepad.buttonSouth, queueEventOnly: true);
        yield return WaitUntilTrue(60, () => probe.SubmitCount == 1);

        Assert.AreEqual(1, probe.SubmitCount, "Submit must route again after the map is restored");
        Assert.AreEqual(0, probe.CancelCount, "restored UI context must not route Cancel on South");
    }

    // ============================================================ AC-49b: Pause edge

    [UnityTest]
    public IEnumerator AC49b_GamepadStart_PauseEdgeRisesOncePerPress_NoRetriggerWhileHeld()
    {
        var gamepad = InputSystem.AddDevice<Gamepad>();
        CreateController();
        _controller.SetGameplayContext();
        var edgeCount = 0;
        _controller.PauseEdge += () => edgeCount++;

        // Press → exactly one edge, pending in Gameplay context.
        Press(gamepad.startButton, queueEventOnly: true);
        yield return null;
        Assert.AreEqual(1, edgeCount, "first press must raise exactly one Pause edge");
        Assert.IsTrue(_controller.HasPendingPauseEdge, "edge must be pending in Gameplay context");

        // Hold: extra frames while held must not re-raise.
        yield return null;
        yield return null;
        Assert.AreEqual(1, edgeCount, "holding must not re-raise the Pause edge");

        // Release: no edge on release.
        Release(gamepad.startButton, queueEventOnly: true);
        yield return null;
        Assert.AreEqual(1, edgeCount, "release must not raise the Pause edge");

        // Re-press after release → a new edge.
        Press(gamepad.startButton, queueEventOnly: true);
        yield return null;
        Assert.AreEqual(2, edgeCount, "re-press after release must raise a new Pause edge");
    }

    [UnityTest]
    public IEnumerator AC49b_GameplayToUI_TransitionConsumesPendingPauseEdge()
    {
        var gamepad = InputSystem.AddDevice<Gamepad>();
        CreateController();
        _controller.SetGameplayContext();
        var edgeCount = 0;
        _controller.PauseEdge += () => edgeCount++;

        // Press Start in Gameplay: exactly one edge, pending (AC-49b).
        Press(gamepad.startButton, queueEventOnly: true);
        yield return null;
        Assert.AreEqual(1, edgeCount, "Start press must raise exactly one Pause edge");
        Assert.IsTrue(_controller.HasPendingPauseEdge, "edge must be pending in Gameplay context");

        // Gameplay→UI consumes the pending edge (ADR-0005 "clear pending pauseEdge on
        // Gameplay→UI transition"). The consumed edge must not re-raise afterwards.
        _controller.SetUIContext();
        Assert.IsFalse(_controller.HasPendingPauseEdge,
            "Gameplay→UI transition must clear the pending pause edge (ADR-0005)");

        yield return null;
        yield return null;
        Assert.AreEqual(1, edgeCount, "consumed edge must not re-raise after the transition");
        Assert.IsFalse(_controller.HasPendingPauseEdge, "pending-edge queue stays empty in UI context");
        Assert.AreEqual(InputContext.UI, _controller.ActiveContext);
    }
}
