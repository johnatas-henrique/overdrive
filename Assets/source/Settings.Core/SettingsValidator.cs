using System;

namespace Overdrive.Settings.Core
{
    /// <summary>
    /// Per-field validation of the settings blob (ADR-0004:44, GDD settings.md:84). Non-finite
    /// (NaN/Infinity) numeric values fall back to their approved per-field default. Structural
    /// shape is verified by the serializer; this validator only repairs invalid VALUES.
    /// </summary>
    public static class SettingsValidator
    {
        /// <summary>
        /// Validates a version-3 blob, replacing every non-finite numeric value with its approved
        /// default. Non-version-3 blobs should be migrated first (the caller owns that ordering).
        /// </summary>
        /// <param name="json">The version-3 blob JSON.</param>
        /// <returns>The validated blob JSON.</returns>
        /// <exception cref="JsonParseException">When the blob is not valid JSON.</exception>
        public static string Validate(string json)
        {
            if (json == null) throw new ArgumentNullException(nameof(json));

            JsonNode root = JsonNode.Parse(json);
            if (!(root is JsonNode.ObjectNode obj))
                throw new ArgumentException("Settings blob root must be a JSON object.", nameof(json));

            ValidateNumericOrDefault(obj, "controls", "stick_dead_zone_inner", 0.15, min: 0.0, max: 0.95);
            ValidateNumericOrDefault(obj, "controls", "stick_dead_zone_outer", 0.95, min: 0.0, max: 1.0);
            ValidateNumericOrDefault(obj, "controls", "accelerate_ema_alpha", 0.3, min: 0.0, max: 1.0);
            ValidateNumericOrDefault(obj, "controls", "brake_ema_alpha", 0.3, min: 0.0, max: 1.0);
            ValidateNumericOrDefault(obj, "controls", "steer_ema_alpha", 0.5, min: 0.0, max: 1.0);

            ValidateNumericOrDefault(obj, "audio", "master", 0.8, min: 0.0, max: 1.0);
            ValidateNumericOrDefault(obj, "audio", "music", 0.7, min: 0.0, max: 1.0);
            ValidateNumericOrDefault(obj, "audio", "sfx", 0.8, min: 0.0, max: 1.0);
            ValidateNumericOrDefault(obj, "audio", "ui", 0.6, min: 0.0, max: 1.0);

            ValidateNumericOrDefault(obj, "accessibility", "text_scale", 1.0, min: 0.75, max: 2.0);
            // Persisted colorblind mode must be 0..3 (None..Tritanopia) — an invalid int (99) would
            // otherwise silently map to None at emission instead of being repaired at load (consistency
            // with the quality_preset repair; qa-tester R1).
            ValidateNumericOrDefault(obj, "accessibility", "colorblind_mode", 0, min: 0, max: 3);

            // shake_intensity max is 2.0 (GDD settings.md:158) — the previous 1.0 silently destroyed
            // player values 1.5-2.0 on reload (unity-specialist BLOCKING, Story 3-7). Fallback 1.0 (GDD).
            ValidateNumericOrDefault(obj, "camera", "shake_intensity", 1.0, min: 0.0, max: 2.0);

            // Persisted quality preset must be 0..3 (Low..Ultra) — Custom (4) is never persisted, and an
            // out-of-range int (99) would otherwise map to Ultra at load instead of the gate-R5 Medium fallback.
            ValidateNumericOrDefault(obj, "display", "quality_preset", 1, min: 0, max: 3);

            // Persisted difficulty tier must be 0..4 (Very Easy..Very Hard) — a malformed blob with an
            // out-of-range int (99) would otherwise deserialize into a DifficultySelection outside the
            // approved domain and only fail later at RequireDifficulty (TD-030). Fallback 2 (Medium —
            // the codec default, SettingsJsonCodec). Range owned by DifficultySelection.MinLevel/MaxLevel.
            ValidateNumericOrDefault(obj, "difficulty", "level", 2, min: DifficultySelection.MinLevel, max: DifficultySelection.MaxLevel);

            return JsonNode.Serialize(root);
        }

        /// <summary>
        /// Validates one numeric field inside a category object: missing, non-finite, or out-of-range
        /// values are replaced by the approved default. Booleans and integers are shape-validated by
        /// the serializer (parse errors surface as malformed-blob failures upstream).
        /// </summary>
        private static void ValidateNumericOrDefault(JsonNode.ObjectNode root, string category, string field, double fallback, double min, double max)
        {
            if (root.Get(category) is not JsonNode.ObjectNode categoryNode) return;

            JsonNode current = categoryNode.Get(field);
            if (current is JsonNode.NumberNode number && IsFinite(number.Value) && number.Value >= min && number.Value <= max)
                return;

            categoryNode.Set(field, new JsonNode.NumberNode(fallback));
        }

        private static bool IsFinite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);
    }
}
