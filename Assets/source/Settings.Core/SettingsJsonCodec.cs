using System;

namespace Overdrive.Settings.Core
{
    /// <summary>
    /// Maps the PascalCase storage model (<see cref="GameSettingsData"/>) to and from the snake_case
    /// blob JSON schema (GDD settings.md:66-81). The core model and the blob format are independent
    /// surfaces — this codec is the translation layer.
    /// </summary>
    public static class SettingsJsonCodec
    {
        /// <summary>Serializes the settings model to blob JSON.</summary>
        /// <param name="settings">The settings model.</param>
        /// <returns>snake_case blob JSON.</returns>
        public static string Serialize(GameSettingsData settings)
        {
            var root = new JsonNode.ObjectNode();
            root.Set("version", new JsonNode.NumberNode(settings.Version));

            var difficulty = new JsonNode.ObjectNode();
            difficulty.Set("level", new JsonNode.NumberNode(settings.Difficulty.Level));
            root.Set("difficulty", difficulty);

            root.Set("controls", SerializeControls(settings.Controls));
            root.Set("audio", SerializeAudio(settings.Audio));
            root.Set("display", SerializeDisplay(settings.Display));
            root.Set("accessibility", SerializeAccessibility(settings.Accessibility));
            root.Set("camera", SerializeCamera(settings.Camera));

            return JsonNode.Serialize(root);
        }

        private static JsonNode.ObjectNode SerializeControls(ControlsData controls)
        {
            var node = new JsonNode.ObjectNode();
            node.Set("bindings_json", new JsonNode.StringNode(controls.BindingsJson));
            node.Set("stick_dead_zone_inner", new JsonNode.NumberNode(controls.StickInner));
            node.Set("stick_dead_zone_outer", new JsonNode.NumberNode(controls.StickOuter));
            node.Set("accelerate_ema_alpha", new JsonNode.NumberNode(controls.AccelerateAlpha));
            node.Set("brake_ema_alpha", new JsonNode.NumberNode(controls.BrakeAlpha));
            node.Set("steer_ema_alpha", new JsonNode.NumberNode(controls.SteerAlpha));
            return node;
        }

        private static JsonNode.ObjectNode SerializeAudio(AudioData audio)
        {
            var node = new JsonNode.ObjectNode();
            node.Set("master", new JsonNode.NumberNode(audio.Master));
            node.Set("music", new JsonNode.NumberNode(audio.Music));
            node.Set("sfx", new JsonNode.NumberNode(audio.Sfx));
            node.Set("ui", new JsonNode.NumberNode(audio.Ui));
            node.Set("mute_music", new JsonNode.BoolNode(audio.MuteMusic));
            node.Set("mute_sfx", new JsonNode.BoolNode(audio.MuteSfx));
            return node;
        }

        private static JsonNode.ObjectNode SerializeDisplay(DisplayData display)
        {
            var node = new JsonNode.ObjectNode();
            node.Set("resolution_w", new JsonNode.NumberNode(display.ResolutionWidth));
            node.Set("resolution_h", new JsonNode.NumberNode(display.ResolutionHeight));
            node.Set("fullscreen_mode", new JsonNode.NumberNode(display.FullscreenMode));
            node.Set("vsync", new JsonNode.NumberNode(display.Vsync));
            node.Set("quality_preset", new JsonNode.NumberNode(display.QualityPreset));
            return node;
        }

        private static JsonNode.ObjectNode SerializeAccessibility(AccessibilityData accessibility)
        {
            var node = new JsonNode.ObjectNode();
            node.Set("colorblind_mode", new JsonNode.NumberNode(accessibility.ColorblindMode));
            node.Set("text_scale", new JsonNode.NumberNode(accessibility.TextScale));
            return node;
        }

        private static JsonNode.ObjectNode SerializeCamera(CameraData camera)
        {
            var node = new JsonNode.ObjectNode();
            node.Set("shake_intensity", new JsonNode.NumberNode(camera.ShakeIntensity));
            node.Set("motion_blur", new JsonNode.BoolNode(camera.MotionBlur));
            node.Set("reduced_motion", new JsonNode.BoolNode(camera.ReducedMotion));
            node.Set("show_chase_hud_in_cockpit", new JsonNode.BoolNode(camera.ShowChaseHudInCockpit));
            return node;
        }

        /// <summary>
        /// Deserializes a blob JSON string into the settings model. Missing optional fields fall back to
        /// their approved default; non-finite values are replaced by the caller's validator. Throws
        /// <see cref="JsonParseException"/> on malformed JSON and <see cref="ArgumentException"/> when
        /// the root is not an object or the version is absent.
        /// </summary>
        /// <param name="json">The blob JSON.</param>
        /// <returns>The settings model.</returns>
        public static GameSettingsData Deserialize(string json)
        {
            if (json == null) throw new ArgumentNullException(nameof(json));

            JsonNode root = JsonNode.Parse(json);
            if (!(root is JsonNode.ObjectNode obj))
                throw new ArgumentException("Settings blob root must be a JSON object.", nameof(json));

            byte version = ReadByteOrDefault(obj, "version", SettingsSchema.CurrentVersion);
            int difficultyLevel = ReadIntOrDefault(ReadObject(obj, "difficulty"), "level", 2);

            return new GameSettingsData(
                version,
                new DifficultySelection(difficultyLevel),
                DeserializeControls(obj),
                DeserializeAudio(obj),
                DeserializeDisplay(obj),
                DeserializeAccessibility(obj),
                DeserializeCamera(obj));
        }

        private static ControlsData DeserializeControls(JsonNode.ObjectNode obj)
        {
            var controlsObj = ReadObject(obj, "controls");
            return new ControlsData(
                ReadFloatOrDefault(controlsObj, "stick_dead_zone_inner", 0.15f),
                ReadFloatOrDefault(controlsObj, "stick_dead_zone_outer", 0.95f),
                ReadFloatOrDefault(controlsObj, "accelerate_ema_alpha", 0.3f),
                ReadFloatOrDefault(controlsObj, "brake_ema_alpha", 0.3f),
                ReadFloatOrDefault(controlsObj, "steer_ema_alpha", 0.5f),
                ReadStringOrDefault(controlsObj, "bindings_json", string.Empty));
        }

        private static AudioData DeserializeAudio(JsonNode.ObjectNode obj)
        {
            var audioObj = ReadObject(obj, "audio");
            return new AudioData(
                ReadFloatOrDefault(audioObj, "master", 0.8f),
                ReadFloatOrDefault(audioObj, "music", 0.7f),
                ReadFloatOrDefault(audioObj, "sfx", 0.8f),
                ReadFloatOrDefault(audioObj, "ui", 0.6f),
                ReadBoolOrDefault(audioObj, "mute_music", false),
                ReadBoolOrDefault(audioObj, "mute_sfx", false));
        }

        private static DisplayData DeserializeDisplay(JsonNode.ObjectNode obj)
        {
            var displayObj = ReadObject(obj, "display");
            return new DisplayData(
                ReadIntOrDefault(displayObj, "resolution_w", 1920),
                ReadIntOrDefault(displayObj, "resolution_h", 1080),
                ReadIntOrDefault(displayObj, "fullscreen_mode", 2),
                ReadIntOrDefault(displayObj, "vsync", 1),
                ReadIntOrDefault(displayObj, "quality_preset", 1));
        }

        private static AccessibilityData DeserializeAccessibility(JsonNode.ObjectNode obj)
        {
            var accessibilityObj = ReadObject(obj, "accessibility");
            return new AccessibilityData(
                ReadIntOrDefault(accessibilityObj, "colorblind_mode", 0),
                ReadFloatOrDefault(accessibilityObj, "text_scale", 1f));
        }

        private static CameraData DeserializeCamera(JsonNode.ObjectNode obj)
        {
            var cameraObj = ReadObject(obj, "camera");
            return new CameraData(
                ReadFloatOrDefault(cameraObj, "shake_intensity", 1.0f),
                ReadBoolOrDefault(cameraObj, "motion_blur", true),
                ReadBoolOrDefault(cameraObj, "reduced_motion", false),
                ReadBoolOrDefault(cameraObj, "show_chase_hud_in_cockpit", true));
        }

        private static JsonNode.ObjectNode ReadObject(JsonNode.ObjectNode parent, string key)
        {
            return parent.Get(key) is JsonNode.ObjectNode obj ? obj : new JsonNode.ObjectNode();
        }

        private static byte ReadByteOrDefault(JsonNode.ObjectNode obj, string key, byte fallback)
        {
            if (obj.Get(key) is JsonNode.NumberNode n && n.Value >= byte.MinValue && n.Value <= byte.MaxValue)
                return (byte)n.Value;
            return fallback;
        }

        private static int ReadIntOrDefault(JsonNode.ObjectNode obj, string key, int fallback)
        {
            if (obj.Get(key) is JsonNode.NumberNode n && n.Value >= int.MinValue && n.Value <= int.MaxValue)
                return (int)n.Value;
            return fallback;
        }

        private static float ReadFloatOrDefault(JsonNode.ObjectNode obj, string key, float fallback)
        {
            if (obj.Get(key) is JsonNode.NumberNode n && !float.IsNaN((float)n.Value) && !float.IsInfinity((float)n.Value))
                return (float)n.Value;
            return fallback;
        }

        private static bool ReadBoolOrDefault(JsonNode.ObjectNode obj, string key, bool fallback)
        {
            return obj.Get(key) is JsonNode.BoolNode b ? b.Value : fallback;
        }

        private static string ReadStringOrDefault(JsonNode.ObjectNode obj, string key, string fallback)
        {
            return obj.Get(key) is JsonNode.StringNode s ? s.Value : fallback;
        }
    }
}
