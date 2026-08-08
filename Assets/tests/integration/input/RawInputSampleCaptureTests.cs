using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.IO;
using System.Text.RegularExpressions;
using NUnit.Framework;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.LowLevel;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

/// <summary>
/// Story-002 integration tests for frame-level RawInputSample capture.
/// </summary>
public sealed class RawInputSampleCaptureTests : InputTestFixture
{
    private const string ScenePath = "Assets/tests/integration/input/Scenes/RawInputSceneLoadTest.unity";
    private readonly List<GameObject> _tracked = new List<GameObject>();
    private InputContextController _controller;

    private InputContextController CreateController()
    {
        SweepStrayControllers();
        var go = new GameObject("RawInputSampleCaptureController");
        _tracked.Add(go);
        _controller = go.AddComponent<InputContextController>();
        return _controller;
    }

    private static void SweepStrayControllers()
    {
        foreach (var stray in UnityEngine.Object.FindObjectsByType<InputContextController>(
                     FindObjectsInactive.Include,
                     FindObjectsSortMode.None))
        {
            if (stray != null)
                UnityEngine.Object.DestroyImmediate(stray.gameObject);
        }
    }

    [UnityTearDown]
    public IEnumerator Teardown()
    {
        foreach (var go in _tracked)
            if (go != null)
                UnityEngine.Object.Destroy(go);
        _tracked.Clear();
        _controller = null;
        yield return null;
    }

    [UnityTest]
    public IEnumerator AC59_CapturesOnceBeforeTicksAndReusesOneSamplePerFrame()
    {
        CreateController().SetGameplayContext();
        var harness = new GameObject("SimulationDriverHarness").AddComponent<SimulationDriverHarness>();
        _tracked.Add(harness.gameObject);
        harness.Controller = _controller;
        harness.ScriptedTicks = 3;

        yield return null;
        yield return null;

        Assert.AreEqual(1, harness.CaptureCalls);
        Assert.AreEqual(3, harness.TickCalls);
        Assert.AreEqual(1, harness.CallOrder[0]);
        Assert.AreEqual(1, harness.CallOrder.Count(value => value == 1));
        Assert.AreEqual(3, harness.CallOrder.Count(value => value == 2));
        AssertSamplesEqual(harness.CapturedSamples[0], harness.ConsumedSamples[0]);
    }

    [UnityTest]
    public IEnumerator AC59_ZeroAccumulatorTicksStillCapturesOnceBeforeAnyTick()
    {
        CreateController().SetGameplayContext();
        var harness = CreateHarness(0, 1);

        yield return null;
        yield return null;

        Assert.AreEqual(1, harness.CaptureCalls);
        Assert.AreEqual(0, harness.TickCalls);
        Assert.AreEqual(1, harness.CallOrder[0]);
    }

    [UnityTest]
    public IEnumerator AC59_BacklogTicksAllConsumeTheIdenticalCapturedSample()
    {
        CreateController().SetGameplayContext();
        var harness = CreateHarness(6, 1);

        yield return null;
        yield return null;

        Assert.AreEqual(1, harness.CaptureCalls);
        Assert.AreEqual(6, harness.TickCalls);
        foreach (var consumed in harness.ConsumedSamples)
            AssertSamplesEqual(harness.CapturedSamples[0], consumed);
    }

    [UnityTest]
    public IEnumerator AC59_RepeatedRenderUpdatesCaptureOncePerFrameWithIncreasingSequences()
    {
        CreateController().SetGameplayContext();
        var harness = CreateHarness(0, 3);

        yield return WaitForCaptureCount(harness, 3, 60);

        Assert.AreEqual(3, harness.CaptureCalls);
        Assert.AreEqual(3, harness.CapturedFrameCounts.Distinct().Count());
        for (var i = 1; i < harness.CapturedSamples.Count; i++)
            Assert.Less(harness.CapturedSamples[i - 1].captureSequence,
                harness.CapturedSamples[i].captureSequence);
    }

    [UnityTest]
    public IEnumerator AC59_CaptureSequenceIsStrictlyIncreasingAcrossRenderFrames()
    {
        CreateController().SetGameplayContext();
        yield return null;

        var first = _controller.CaptureLatestRawSample();
        var second = _controller.CaptureLatestRawSample();
        Assert.AreEqual(0UL, first.captureSequence);
        Assert.Less(first.captureSequence, second.captureSequence);
    }

    [UnityTest]
    public IEnumerator AC59_ReadsControllerOwnedAssetAndSampleFieldsAreReadonly()
    {
        var controller = CreateController();
        controller.SetGameplayContext();
        yield return null;

        Assert.IsNotNull(controller.ActiveAsset);
        var fields = typeof(RawInputSample).GetFields(BindingFlags.Public | BindingFlags.Instance);
        Assert.AreEqual(8, fields.Length);
        Assert.IsTrue(fields.All(field => field.IsInitOnly));
        Assert.IsTrue(typeof(RawInputSample).GetCustomAttributes(
            typeof(IsReadOnlyAttribute), false).Length > 0,
            "RawInputSample must remain a compiler-marked readonly struct");
        var wrapperField = typeof(InputContextController).GetField(
            "_actions",
            BindingFlags.NonPublic | BindingFlags.Instance);
        Assert.IsNotNull(wrapperField);
        var wrapper = (InputSystem_Actions)wrapperField.GetValue(controller);
        Assert.AreSame(wrapper.asset, controller.ActiveAsset);
        Assert.AreEqual("OverdriveGameplay", controller.ActiveAsset.FindActionMap("OverdriveGameplay").name);
    }

    [UnityTest]
    public IEnumerator AC59c_CapturesDrivenAccelerateFromOwnedAssetAndEnabledActions()
    {
        var controller = CreateController();
        controller.SetGameplayContext();
        yield return null;

        var keyboard = InputSystem.AddDevice<Keyboard>();
        Press(keyboard.wKey, queueEventOnly: true);
        yield return null;
        var sample = controller.CaptureLatestRawSample();

        Assert.Greater(sample.accelerateRaw, 0.99f);
        foreach (var action in InputSystem.ListEnabledActions())
            Assert.AreSame(controller.ActiveAsset, action.actionMap.asset);
    }

    [UnityTest]
    public IEnumerator AC59c_CachedGameplayActionsBelongToControllerOwnedAsset()
    {
        var controller = CreateController();
        controller.SetGameplayContext();
        yield return null;

        var fieldNames = new[] { "_accelerateAction", "_brakeAction", "_steerAction" };
        var actionNames = new[] { "Accelerate", "Brake", "Steer" };
        for (var i = 0; i < fieldNames.Length; i++)
        {
            var field = typeof(InputContextController).GetField(
                fieldNames[i],
                BindingFlags.NonPublic | BindingFlags.Instance);
            Assert.IsNotNull(field, $"missing cached action field {fieldNames[i]}");
            var action = (InputAction)field.GetValue(controller);
            Assert.AreSame(controller.ActiveAsset, action.actionMap.asset, fieldNames[i]);
            Assert.AreEqual("OverdriveGameplay", action.actionMap.name);
            Assert.AreEqual(actionNames[i], action.name);
        }
    }

    // Unity Mono (Editor) permits FieldInfo.SetValue on this boxed readonly field, while
    // CoreCLR/IL2CPP throws FieldAccessException. This test is Editor/Mono-only; the
    // IsReadOnlyAttribute assertion in AC59_ReadsControllerOwnedAssetAndSampleFieldsAreReadonly
    // is the load-bearing mutation guard.
    [UnityTest]
    public IEnumerator AC59_SampleStructCopiesAreImmutableFromMutationAttempts()
    {
        var controller = CreateController();
        var sample = controller.CaptureLatestRawSample();
        var field = typeof(RawInputSample).GetField(
            nameof(RawInputSample.accelerateRaw),
            BindingFlags.Public | BindingFlags.Instance);
        Assert.IsNotNull(field);
        var original = sample.accelerateRaw;

        var boxedSample = (object)sample;
        field.SetValue(boxedSample, original + 1.0f);
        var reflectedSample = (RawInputSample)boxedSample;
        Assert.AreNotEqual(original, reflectedSample.accelerateRaw,
            "the boxed copy must accept the reflection write on this runtime");
        Assert.AreEqual(original, sample.accelerateRaw,
            "reflection must not mutate the captured struct value");
        yield return null;
    }

    [UnityTest]
    public IEnumerator AC59_AvailabilityAndValidityFlagsPreserveRawValues()
    {
        var controller = CreateController();
        controller.SetGameplayContext();
        yield return null;

        var noDeviceSample = controller.CaptureLatestRawSample();
        Assert.AreEqual(InputAvailability.NoInputDevice, noDeviceSample.inputAvailability);
        var flags = RawInputSampleValidity.GetFlags(float.NaN, float.PositiveInfinity, -1.0f);
        Assert.AreEqual(
            RawInputValidityFlags.AccelerateNonFinite | RawInputValidityFlags.BrakeNonFinite,
            flags);
        // The pure helper remains the direct validation seam; the capture-path test below uses
        // a controller-owned PassThrough probe action because Value actions reject NaN magnitude.
    }

    [UnityTest]
    public IEnumerator AC59_NonFiniteActionValuesSetValidityFlagsThroughCapturePath()
    {
        var controller = CreateController();
        controller.SetGameplayContext();
        yield return null;

        var gamepad = InputSystem.AddDevice<Gamepad>();
        var accelerateField = typeof(InputContextController).GetField(
            "_accelerateAction",
            BindingFlags.NonPublic | BindingFlags.Instance);
        var steerField = typeof(InputContextController).GetField(
            "_steerAction",
            BindingFlags.NonPublic | BindingFlags.Instance);
        var brakeField = typeof(InputContextController).GetField(
            "_brakeAction",
            BindingFlags.NonPublic | BindingFlags.Instance);
        var brakeAction = (InputAction)brakeField.GetValue(controller);
        var gameplayMap = controller.ActiveAsset.FindActionMap("OverdriveGameplay");
        controller.SetUIContext();
        var disableAsset = controller.ActiveAsset.GetType().GetMethod("Disable");
        Assert.IsNotNull(disableAsset);
        disableAsset.Invoke(controller.ActiveAsset, null);
        brakeAction.bindingMask = new InputBinding { groups = "Gamepad" };
        var probeAction = gameplayMap.AddAction("NaNProbe", InputActionType.PassThrough,
            expectedControlLayout: "Axis");
        probeAction.AddBinding("<Gamepad>/rightTrigger", groups: "Gamepad");
        var steerProbeAction = gameplayMap.AddAction("SteerNaNProbe", InputActionType.PassThrough,
            expectedControlLayout: "Axis");
        steerProbeAction.AddBinding("<Gamepad>/leftStick/x", groups: "Gamepad");
        controller.SetGameplayContext();
        accelerateField.SetValue(controller, probeAction);
        steerField.SetValue(controller, steerProbeAction);
        InputSystem.QueueStateEvent(gamepad, new GamepadState
        {
            leftStick = new Vector2(float.NaN, 0.0f),
            rightTrigger = float.NaN,
            leftTrigger = float.PositiveInfinity,
        });
        InputSystem.Update();

        var sample = controller.CaptureLatestRawSample();
        Assert.IsTrue((sample.validityFlags & RawInputValidityFlags.AccelerateNonFinite) != 0);
        Assert.IsTrue((sample.validityFlags & RawInputValidityFlags.BrakeNonFinite) != 0);
        Assert.IsTrue((sample.validityFlags & RawInputValidityFlags.SteerNonFinite) != 0);
        Assert.IsTrue(float.IsNaN(sample.accelerateRaw));
        Assert.IsTrue(float.IsPositiveInfinity(sample.brakeRaw));
        Assert.IsTrue(float.IsNaN(sample.steerRaw));
    }

    [UnityTest]
    public IEnumerator AC59d_PauseRiseIsObservedOnceAndCoalescesPendingEdges()
    {
        var controller = CreateController();
        controller.SetGameplayContext();
        yield return null;

        var gamepad = InputSystem.AddDevice<Gamepad>();
        Press(gamepad.startButton, queueEventOnly: true);
        yield return null;

        var first = controller.CaptureLatestRawSample();
        var second = controller.CaptureLatestRawSample();
        Assert.IsTrue(first.pauseRise);
        Assert.IsFalse(second.pauseRise);
        Assert.IsTrue(controller.HasPendingPauseEdge);
        Release(gamepad.startButton, queueEventOnly: true);
        yield return null;
        Press(gamepad.startButton, queueEventOnly: true);
        yield return null;
        Assert.IsFalse(controller.CaptureLatestRawSample().pauseRise);
    }

    [UnityTest]
    public IEnumerator AC59d_PauseRiseCanBeObservedAgainAfterUiContextReset()
    {
        var controller = CreateController();
        controller.SetGameplayContext();
        yield return null;

        var gamepad = InputSystem.AddDevice<Gamepad>();
        Press(gamepad.startButton, queueEventOnly: true);
        yield return null;
        Assert.IsTrue(controller.CaptureLatestRawSample().pauseRise);

        controller.SetUIContext();
        controller.SetGameplayContext();
        Release(gamepad.startButton, queueEventOnly: true);
        yield return null;
        Press(gamepad.startButton, queueEventOnly: true);
        yield return null;

        Assert.IsTrue(controller.CaptureLatestRawSample().pauseRise);
    }

    [UnityTest]
    public IEnumerator AC59d_MultiplePauseRisesBeforeCaptureCoalesceToOneObservation()
    {
        var controller = CreateController();
        controller.SetGameplayContext();
        yield return null;

        var gamepad = InputSystem.AddDevice<Gamepad>();
        for (var i = 0; i < 3; i++)
        {
            Press(gamepad.startButton, queueEventOnly: true);
            Release(gamepad.startButton, queueEventOnly: true);
        }
        yield return null;

        Assert.IsTrue(controller.CaptureLatestRawSample().pauseRise);
        Assert.IsFalse(controller.CaptureLatestRawSample().pauseRise);
    }

    [UnityTest]
    public IEnumerator AC59d_PauseEdgeEventSeesAllPressesWhileSampleCoalescesThem()
    {
        var controller = CreateController();
        controller.SetGameplayContext();
        yield return null;

        var eventCount = 0;
        controller.PauseEdge += () => eventCount++;
        var gamepad = InputSystem.AddDevice<Gamepad>();
        for (var i = 0; i < 3; i++)
        {
            Press(gamepad.startButton, queueEventOnly: true);
            Release(gamepad.startButton, queueEventOnly: true);
        }
        yield return null;

        Assert.AreEqual(3, eventCount);
        Assert.IsTrue(controller.CaptureLatestRawSample().pauseRise);
        Assert.IsFalse(controller.CaptureLatestRawSample().pauseRise);
    }

    [UnityTest]
    public IEnumerator AC59d_UiContextCaptureDoesNotReportPauseRise()
    {
        var controller = CreateController();
        controller.SetGameplayContext();
        yield return null;

        var gamepad = InputSystem.AddDevice<Gamepad>();
        Press(gamepad.startButton, queueEventOnly: true);
        yield return null;
        Assert.IsTrue(controller.CaptureLatestRawSample().pauseRise);

        controller.SetUIContext();
        Assert.IsFalse(controller.CaptureLatestRawSample().pauseRise);
    }

    [UnityTest]
    public IEnumerator AC59_UiContextCaptureReturnsNeutralGameplayChannels()
    {
        var controller = CreateController();
        controller.SetGameplayContext();
        yield return null;

        var keyboard = InputSystem.AddDevice<Keyboard>();
        Press(keyboard.wKey, queueEventOnly: true);
        yield return null;
        Assert.Greater(controller.CaptureLatestRawSample().accelerateRaw, 0.99f);

        controller.SetUIContext();
        var sample = controller.CaptureLatestRawSample();
        Assert.IsFalse(sample.pauseRise);
        Assert.AreEqual(0.0f, sample.accelerateRaw);
        Assert.AreEqual(0.0f, sample.brakeRaw);
        Assert.AreEqual(0.0f, sample.steerRaw);
        Assert.AreEqual(1, controller.EnabledMapCount);
        Assert.IsFalse(controller.ActiveAsset.FindActionMap("OverdriveGameplay").enabled);
        Assert.IsTrue(controller.ActiveAsset.FindActionMap("OverdriveUI").enabled);
    }

    [Test]
    public void AC59c_ControllerCreatesOnlyOneInputActionsWrapper()
    {
        var root = Directory.GetParent(Application.dataPath).FullName;
        var sourceRoot = Path.Combine(root, "Assets", "source");
        var sourceFiles = Directory.GetFiles(sourceRoot, "*.cs", SearchOption.AllDirectories);
        var constructionPattern = new Regex(@"new\s+(?:global::)?InputSystem_Actions");
        var constructionSites = sourceFiles
            .SelectMany(path => constructionPattern.Matches(File.ReadAllText(path))
                .Cast<Match>()
                .Select(match => new { Path = path, Index = match.Index }))
            .ToArray();
        Assert.AreEqual(1, constructionSites.Length,
            "all source files together must construct exactly one generated wrapper");

        var controllerPath = Path.Combine(sourceRoot, "InputContextController.cs");
        var source = File.ReadAllText(controllerPath);
        var ensureStart = source.IndexOf("private void EnsureInitialized", StringComparison.Ordinal);
        var constructionIndex = constructionSites[0].Path == controllerPath
            ? constructionSites[0].Index
            : -1;
        var ensureEnd = source.IndexOf("private void ClearPendingPauseEdge", StringComparison.Ordinal);
        Assert.That(ensureStart, Is.GreaterThan(0), "EnsureInitialized marker renamed — update the scan");
        Assert.That(ensureEnd, Is.GreaterThan(0), "ClearPendingPauseEdge marker renamed — update the scan");
        Assert.That(constructionIndex, Is.GreaterThan(ensureStart));
        Assert.That(constructionIndex, Is.LessThan(ensureEnd));
    }

    [UnityTest]
    public IEnumerator AC59_ControllerDestroysInputActionReferencesOnDestroy()
    {
        var controller = CreateController();
        controller.SetUIContext();
        yield return null;

        var fieldNames = new[]
        {
            "_submitReference", "_cancelReference", "_moveReference", "_pointReference", "_leftClickReference",
        };
        var references = fieldNames.Select(name =>
        {
            var field = typeof(InputContextController).GetField(
                name,
                BindingFlags.NonPublic | BindingFlags.Instance);
            Assert.IsNotNull(field, $"missing reference field {name}");
            return (InputActionReference)field.GetValue(controller);
        }).ToArray();
        var moduleField = typeof(InputContextController).GetField(
            "_uiModule",
            BindingFlags.NonPublic | BindingFlags.Instance);
        Assert.IsNotNull(moduleField);
        var module = moduleField.GetValue(controller) as UnityEngine.Object;
        Assert.IsNotNull(module);
        // Verify the leak setup while the module is alive. The module shares the controller's
        // GameObject, so after destruction it must be gone rather than retaining references.
        foreach (var propertyName in new[] { "submit", "cancel", "move", "point", "leftClick" })
        {
            var property = module.GetType().GetProperty(propertyName);
            Assert.IsNotNull(property, $"module property {propertyName} must remain observable");
            Assert.IsNotNull(property.GetValue(module),
                $"module property {propertyName} must be wired before destruction");
        }

        UnityEngine.Object.Destroy(controller.gameObject);
        yield return null;
        yield return null;

        foreach (var reference in references)
            Assert.IsTrue(reference == null, "controller-owned InputActionReference must be destroyed");
        Assert.IsTrue(module == null, "UI module must be destroyed with the controller");
    }

    [UnityTest]
    public IEnumerator AC59b_RapidContextTransitionsKeepCaptureSequenceStrictlyIncreasing()
    {
        var controller = CreateController();
        controller.SetGameplayContext();
        yield return null;

        var samples = new List<RawInputSample> { controller.CaptureLatestRawSample() };
        controller.SetUIContext();
        samples.Add(controller.CaptureLatestRawSample());
        controller.SetGameplayContext();
        samples.Add(controller.CaptureLatestRawSample());
        controller.SetUIContext();
        samples.Add(controller.CaptureLatestRawSample());

        for (var i = 1; i < samples.Count; i++)
            Assert.Less(samples[i - 1].captureSequence, samples[i].captureSequence);
    }

    [UnityTest]
    public IEnumerator AC59b_RapidContextTransitionsInterleavedWithSceneLoadsKeepOneMap()
    {
        var controller = CreateController();
        controller.SetGameplayContext();
        yield return null;
        var samples = new List<RawInputSample>();
        samples.Add(controller.CaptureLatestRawSample());

        for (var i = 0; i < 2; i++)
        {
            controller.SetUIContext();
            Assert.AreEqual(1, controller.EnabledMapCount);
            Assert.AreEqual(InputContext.UI, controller.ActiveContext);
            Assert.IsTrue(controller.ActiveAsset.FindActionMap("OverdriveUI").enabled);
            Assert.IsFalse(controller.ActiveAsset.FindActionMap("OverdriveGameplay").enabled);
            samples.Add(controller.CaptureLatestRawSample());
            yield return LoadSceneInPlayMode(ScenePath);
            Assert.AreEqual(1, controller.EnabledMapCount);
            Assert.AreEqual(InputContext.UI, controller.ActiveContext);
            Assert.IsTrue(controller.ActiveAsset.FindActionMap("OverdriveUI").enabled);
            Assert.IsFalse(controller.ActiveAsset.FindActionMap("OverdriveGameplay").enabled);
            samples.Add(controller.CaptureLatestRawSample());

            controller.SetGameplayContext();
            Assert.AreEqual(1, controller.EnabledMapCount);
            Assert.AreEqual(InputContext.Gameplay, controller.ActiveContext);
            Assert.IsTrue(controller.ActiveAsset.FindActionMap("OverdriveGameplay").enabled);
            Assert.IsFalse(controller.ActiveAsset.FindActionMap("OverdriveUI").enabled);
            samples.Add(controller.CaptureLatestRawSample());
            yield return LoadSceneInPlayMode(ScenePath);
            Assert.AreEqual(1, controller.EnabledMapCount);
            Assert.AreEqual(InputContext.Gameplay, controller.ActiveContext);
            Assert.IsTrue(controller.ActiveAsset.FindActionMap("OverdriveGameplay").enabled);
            Assert.IsFalse(controller.ActiveAsset.FindActionMap("OverdriveUI").enabled);
            samples.Add(controller.CaptureLatestRawSample());
        }

        for (var i = 1; i < samples.Count; i++)
            Assert.Less(samples[i - 1].captureSequence, samples[i].captureSequence);
    }

    [UnityTest]
    public IEnumerator AC59_AvailableDeviceReportsAvailableInput()
    {
        var controller = CreateController();
        controller.SetGameplayContext();
        yield return null;

        InputSystem.AddDevice<Gamepad>();
        Assert.AreEqual(InputAvailability.Available, controller.CaptureLatestRawSample().inputAvailability);
    }

    [UnityTest]
    public IEnumerator AC59_KeyboardOnlyDeviceSelectsKeyboardMouseScheme()
    {
        var controller = CreateController();
        InputSystem.AddDevice<Keyboard>();
        yield return null;

        var sample = controller.CaptureLatestRawSample();
        Assert.AreEqual(InputAvailability.Available, sample.inputAvailability);
        Assert.AreEqual(ControlScheme.KeyboardMouse, sample.activeScheme);
    }

    [UnityTest]
    public IEnumerator AC59_MouseOnlyDeviceSelectsKeyboardMouseScheme()
    {
        var controller = CreateController();
        InputSystem.AddDevice<Mouse>();
        yield return null;

        var sample = controller.CaptureLatestRawSample();
        Assert.AreEqual(InputAvailability.Available, sample.inputAvailability);
        Assert.AreEqual(ControlScheme.KeyboardMouse, sample.activeScheme);
    }

    [UnityTest]
    public IEnumerator AC59_GamepadOnlyDeviceSelectsGamepadScheme()
    {
        var controller = CreateController();
        InputSystem.AddDevice<Gamepad>();
        yield return null;

        Assert.AreEqual(ControlScheme.Gamepad, controller.CaptureLatestRawSample().activeScheme);
    }

    [UnityTest]
    public IEnumerator AC59_KeyboardAndGamepadDevicesPreferKeyboardMouseScheme()
    {
        var controller = CreateController();
        InputSystem.AddDevice<Keyboard>();
        InputSystem.AddDevice<Gamepad>();
        yield return null;

        Assert.AreEqual(ControlScheme.KeyboardMouse, controller.CaptureLatestRawSample().activeScheme);
    }

    [UnityTest]
    public IEnumerator AC59_NoneContextCaptureReturnsDefinedSample()
    {
        var controller = CreateController();
        yield return null;

        var sample = controller.CaptureLatestRawSample();
        Assert.IsFalse(sample.pauseRise);
        Assert.AreEqual(InputContext.None, controller.ActiveContext);
        Assert.AreEqual(InputAvailability.NoInputDevice, sample.inputAvailability);
        Assert.AreEqual(ControlScheme.KeyboardMouse, sample.activeScheme);
    }

    [UnityTest]
    public IEnumerator AC59b_CaptureSequenceSurvivesContextChangeAndSceneLoad()
    {
        var controller = CreateController();
        controller.SetGameplayContext();
        yield return null;
        var gameplay = controller.CaptureLatestRawSample();
        controller.SetUIContext();
        var ui = controller.CaptureLatestRawSample();
        Assert.Less(gameplay.captureSequence, ui.captureSequence);

        yield return LoadSceneInPlayMode(ScenePath);
        var afterLoad = controller.CaptureLatestRawSample();
        Assert.Less(ui.captureSequence, afterLoad.captureSequence);
        Assert.AreSame(controller, UnityEngine.Object.FindFirstObjectByType<InputContextController>());
        Assert.AreEqual(1, UnityEngine.Object.FindObjectsByType<InputContextController>(FindObjectsSortMode.None).Length);
    }

    [UnityTest]
    public IEnumerator AC59b_SceneLoadWithoutContextChangePreservesControllerAndSequence()
    {
        var controller = CreateController();
        controller.SetGameplayContext();
        yield return null;
        var beforeLoad = controller.CaptureLatestRawSample();
        Assert.AreEqual(InputContext.Gameplay, controller.ActiveContext);
        Assert.AreEqual(1, controller.EnabledMapCount);
        Assert.IsTrue(controller.ActiveAsset.FindActionMap("OverdriveGameplay").enabled);
        Assert.IsFalse(controller.ActiveAsset.FindActionMap("OverdriveUI").enabled);

        yield return LoadSceneInPlayMode(ScenePath);

        var afterLoad = controller.CaptureLatestRawSample();
        Assert.Less(beforeLoad.captureSequence, afterLoad.captureSequence);
        Assert.AreEqual(InputContext.Gameplay, controller.ActiveContext);
        Assert.AreEqual(1, controller.EnabledMapCount);
        Assert.IsTrue(controller.ActiveAsset.FindActionMap("OverdriveGameplay").enabled);
        Assert.IsFalse(controller.ActiveAsset.FindActionMap("OverdriveUI").enabled);
        Assert.AreSame(controller, UnityEngine.Object.FindFirstObjectByType<InputContextController>());
        Assert.AreEqual(1, UnityEngine.Object.FindObjectsByType<InputContextController>(FindObjectsSortMode.None).Length);
    }

    [UnityTest]
    public IEnumerator AC59b_UiContextSurvivesSceneLoadWithUiMapActive()
    {
        var controller = CreateController();
        controller.SetUIContext();
        yield return null;
        Assert.AreEqual(InputContext.UI, controller.ActiveContext);
        Assert.AreEqual(1, controller.EnabledMapCount);
        Assert.IsTrue(controller.ActiveAsset.FindActionMap("OverdriveUI").enabled);
        Assert.IsFalse(controller.ActiveAsset.FindActionMap("OverdriveGameplay").enabled);

        yield return LoadSceneInPlayMode(ScenePath);

        Assert.AreEqual(InputContext.UI, controller.ActiveContext);
        Assert.AreEqual(1, controller.EnabledMapCount);
        Assert.IsTrue(controller.ActiveAsset.FindActionMap("OverdriveUI").enabled);
        Assert.IsFalse(controller.ActiveAsset.FindActionMap("OverdriveGameplay").enabled);
    }

    private static IEnumerator LoadSceneInPlayMode(string scenePath)
    {
        EditorSceneManager.LoadSceneInPlayMode(
            scenePath,
            new LoadSceneParameters(LoadSceneMode.Single));
        for (var frame = 0; frame < 60; frame++)
        {
            if (SceneManager.GetActiveScene().name == Path.GetFileNameWithoutExtension(scenePath))
                yield break;
            yield return null;
        }
        Assert.Fail($"{Path.GetFileNameWithoutExtension(scenePath)} did not become active within 60 frames.");
    }

    private static IEnumerator WaitForCaptureCount(
        SimulationDriverHarness harness,
        int expectedCaptureCount,
        int maxFrames)
    {
        for (var frame = 0; frame < maxFrames; frame++)
        {
            if (harness.CaptureCalls >= expectedCaptureCount)
                yield break;
            yield return null;
        }
        Assert.Fail($"Harness captured {harness.CaptureCalls} frames; expected {expectedCaptureCount}.");
    }

    private SimulationDriverHarness CreateHarness(int scriptedTicks, int maxFrames)
    {
        var harness = new GameObject("SimulationDriverHarness").AddComponent<SimulationDriverHarness>();
        _tracked.Add(harness.gameObject);
        harness.Controller = _controller;
        harness.ScriptedTicks = scriptedTicks;
        harness.MaxFrames = maxFrames;
        return harness;
    }

    private static void AssertSamplesEqual(RawInputSample expected, RawInputSample actual)
    {
        Assert.AreEqual(expected.captureSequence, actual.captureSequence);
        Assert.AreEqual(expected.activeScheme, actual.activeScheme);
        Assert.AreEqual(expected.accelerateRaw, actual.accelerateRaw);
        Assert.AreEqual(expected.brakeRaw, actual.brakeRaw);
        Assert.AreEqual(expected.steerRaw, actual.steerRaw);
        Assert.AreEqual(expected.pauseRise, actual.pauseRise);
        Assert.AreEqual(expected.inputAvailability, actual.inputAvailability);
        Assert.AreEqual(expected.validityFlags, actual.validityFlags);
    }

    private sealed class SimulationDriverHarness : MonoBehaviour
    {
        public InputContextController Controller;
        public int ScriptedTicks;
        public int MaxFrames = 1;
        public int CaptureCalls;
        public int TickCalls;
        public readonly List<RawInputSample> CapturedSamples = new List<RawInputSample>();
        public readonly List<RawInputSample> ConsumedSamples = new List<RawInputSample>();
        public readonly List<int> CapturedFrameCounts = new List<int>();
        public readonly List<int> CallOrder = new List<int>();

        private void Update()
        {
            var sample = Controller.CaptureLatestRawSample();
            CaptureCalls++;
            CallOrder.Add(1);
            CapturedSamples.Add(sample);
            CapturedFrameCounts.Add(Time.frameCount);
            for (var i = 0; i < ScriptedTicks; i++)
            {
                TickCalls++;
                CallOrder.Add(2);
                ConsumeTick(sample);
            }
            if (CapturedSamples.Count >= MaxFrames)
                enabled = false;
        }

        private void ConsumeTick(RawInputSample sample)
        {
            ConsumedSamples.Add(sample);
        }
    }
}
