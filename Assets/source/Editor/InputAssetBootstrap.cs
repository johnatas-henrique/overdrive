using System;
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Overdrive.Input.Editor
{
    /// <summary>Rebuilds the Story 001 input asset, wrapper, and settings singleton.</summary>
    public static class InputAssetBootstrap
    {
        private const string AssetPath = "Assets/source/InputSystem_Actions.inputactions";
        private const string WrapperPath = "Assets/source/InputSystem_Actions.cs";
        private const string SettingsPath = "Assets/source/InputSystemSettings.asset";

        /// <summary>Rebuilds all approved input assets from the GDD Core Rule 1 bindings.</summary>
        [MenuItem("Overdrive/Input/Rebuild Input Assets")]
        public static void RebuildInputAssets()
        {
            DeleteExistingAssets();
            InputActionAsset asset = BuildActionAsset();
            AssetDatabase.CreateAsset(asset, AssetPath);
            AssetDatabase.SaveAssets();
            File.WriteAllText(AssetPath, asset.ToJson());
            UnityEngine.Object.DestroyImmediate(asset);
            AssetDatabase.ImportAsset(AssetPath, ImportAssetOptions.ForceSynchronousImport);
            ConfigureWrapperImporter();
            CreateAndAssignInputSettings();
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
        }

        private static void DeleteExistingAssets()
        {
            if (File.Exists(WrapperPath))
            {
                AssetDatabase.DeleteAsset(WrapperPath);
            }

            if (AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(AssetPath) != null)
            {
                AssetDatabase.DeleteAsset(AssetPath);
            }
        }

        private static InputActionAsset BuildActionAsset()
        {
            InputActionAsset asset = ScriptableObject.CreateInstance<InputActionAsset>();
            InputActionMap gameplay = asset.AddActionMap("OverdriveGameplay");
            InputActionMap ui = asset.AddActionMap("OverdriveUI");

            InputAction accelerate = gameplay.AddAction("Accelerate", InputActionType.Value);
            accelerate.expectedControlType = "Axis";
            AddBinding(accelerate, "<Keyboard>/w", "KeyboardMouse");
            AddBinding(accelerate, "<Keyboard>/upArrow", "KeyboardMouse");
            AddBinding(accelerate, "<Gamepad>/rightTrigger", "Gamepad");

            InputAction brake = gameplay.AddAction("Brake", InputActionType.Value);
            brake.expectedControlType = "Axis";
            AddBinding(brake, "<Keyboard>/s", "KeyboardMouse");
            AddBinding(brake, "<Keyboard>/downArrow", "KeyboardMouse");
            AddBinding(brake, "<Gamepad>/leftTrigger", "Gamepad");

            InputAction steer = gameplay.AddAction("Steer", InputActionType.Value);
            steer.expectedControlType = "Axis";
            AddAxisComposite(steer, "<Keyboard>/a", "<Keyboard>/d", "KeyboardMouse");
            AddAxisComposite(steer, "<Keyboard>/leftArrow", "<Keyboard>/rightArrow", "KeyboardMouse");
            AddBinding(steer, "<Gamepad>/leftStick/x", "Gamepad");

            InputAction pause = gameplay.AddAction("Pause", InputActionType.Button);
            AddBinding(pause, "<Keyboard>/escape", "KeyboardMouse");
            AddBinding(pause, "<Gamepad>/start", "Gamepad");

            InputAction cameraToggle = gameplay.AddAction("CameraToggle", InputActionType.Button);
            AddBinding(cameraToggle, "<Keyboard>/c", "KeyboardMouse");
            AddBinding(cameraToggle, "<Gamepad>/buttonNorth", "Gamepad");

            InputAction navigate = ui.AddAction("Navigate", InputActionType.Value);
            navigate.expectedControlType = "Vector2";
            AddVectorComposite(navigate, "<Keyboard>/w", "<Keyboard>/s", "<Keyboard>/a", "<Keyboard>/d", "KeyboardMouse");
            AddVectorComposite(navigate, "<Keyboard>/upArrow", "<Keyboard>/downArrow", "<Keyboard>/leftArrow", "<Keyboard>/rightArrow", "KeyboardMouse");
            AddBinding(navigate, "<Gamepad>/leftStick", "Gamepad");
            AddVectorComposite(navigate, "<Gamepad>/dpad/up", "<Gamepad>/dpad/down", "<Gamepad>/dpad/left", "<Gamepad>/dpad/right", "Gamepad");

            InputAction point = ui.AddAction("Point", InputActionType.PassThrough);
            point.expectedControlType = "Vector2";
            AddBinding(point, "<Mouse>/position", "KeyboardMouse");

            InputAction click = ui.AddAction("Click", InputActionType.Button);
            AddBinding(click, "<Mouse>/press", "KeyboardMouse");

            InputAction confirm = ui.AddAction("Confirm", InputActionType.Button);
            AddBinding(confirm, "<Keyboard>/enter", "KeyboardMouse");
            AddBinding(confirm, "<Gamepad>/buttonSouth", "Gamepad");

            InputAction cancel = ui.AddAction("Cancel", InputActionType.Button);
            AddBinding(cancel, "<Keyboard>/escape", "KeyboardMouse");
            AddBinding(cancel, "<Gamepad>/buttonEast", "Gamepad");

            InputAction uiPause = ui.AddAction("Pause", InputActionType.Button);
            AddBinding(uiPause, "<Keyboard>/p", "KeyboardMouse");
            AddBinding(uiPause, "<Gamepad>/start", "Gamepad");

            asset.AddControlScheme("KeyboardMouse")
                .WithRequiredDevice<Keyboard>()
                .WithRequiredDevice<Mouse>();
            asset.AddControlScheme("Gamepad")
                .WithRequiredDevice<Gamepad>();
            return asset;
        }

        private static void AddBinding(InputAction action, string path, string group)
        {
            action.AddBinding(path).WithGroup(group);
        }

        private static void AddAxisComposite(InputAction action, string negative, string positive, string group)
        {
            InputActionSetupExtensions.CompositeSyntax composite = action.AddCompositeBinding("1DAxis")
                .With("Negative", negative)
                .With("Positive", positive);
            action.ChangeBinding(composite.bindingIndex).WithGroup(group);
        }

        private static void AddVectorComposite(InputAction action, string up, string down, string left, string right, string group)
        {
            InputActionSetupExtensions.CompositeSyntax composite = action.AddCompositeBinding("2DVector")
                .With("Up", up)
                .With("Down", down)
                .With("Left", left)
                .With("Right", right);
            action.ChangeBinding(composite.bindingIndex).WithGroup(group);
        }

        private static void ConfigureWrapperImporter()
        {
            AssetImporter importer = AssetImporter.GetAtPath(AssetPath);
            SerializedObject serializedImporter = new SerializedObject(importer);
            serializedImporter.FindProperty("m_GenerateWrapperCode").boolValue = true;
            serializedImporter.FindProperty("m_WrapperCodePath").stringValue = WrapperPath;
            serializedImporter.FindProperty("m_WrapperClassName").stringValue = "InputSystem_Actions";
            serializedImporter.FindProperty("m_WrapperCodeNamespace").stringValue = "Overdrive.Input";
            serializedImporter.ApplyModifiedPropertiesWithoutUndo();
            importer.SaveAndReimport();
            if (!File.Exists(WrapperPath))
            {
                Type importerType = Array.Find(typeof(InputAction).Assembly.GetTypes(), type => type.Name == "InputActionImporter");
                MethodInfo generateWrapper = importerType.GetMethod("GenerateWrapperCode", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.Instance);
                InputActionAsset importedAsset = AssetDatabase.LoadAssetAtPath<InputActionAsset>(AssetPath);
                generateWrapper.Invoke(generateWrapper.IsStatic ? null : importer, new object[] { AssetPath, importedAsset, "Overdrive.Input", "InputSystem_Actions", WrapperPath });
            }
        }

        private static void CreateAndAssignInputSettings()
        {
            InputSettings settings = ScriptableObject.CreateInstance<InputSettings>();
            settings.updateMode = InputSettings.UpdateMode.ProcessEventsInDynamicUpdate;
            AssetDatabase.CreateAsset(settings, SettingsPath);
            AssetDatabase.SaveAssets();
            InputSystem.settings = settings;
        }
    }
}
