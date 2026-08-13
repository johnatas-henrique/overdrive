using System;

namespace Overdrive.Settings.Core
{
    /// <summary>
    /// Sequential schema migration v1 → v2 → v3 for the settings blob (ADR-0004:88, GDD settings.md:88).
    /// The migration NEVER jumps versions — each step processes the previous version's blob. Every
    /// successful migration produces a version-3 blob (validated by the caller before it may replace
    /// the primary key).
    /// </summary>
    public static class SettingsMigration
    {
        /// <summary>
        /// Migrates a settings blob to the current version, processing each version step sequentially.
        /// </summary>
        /// <param name="json">The raw blob JSON.</param>
        /// <returns>The migrated blob (current version 3).</returns>
        /// <exception cref="JsonParseException">When the blob is not valid JSON.</exception>
        /// <exception cref="ArgumentException">When the blob has no version field or a version newer than current.</exception>
        public static string MigrateToCurrent(string json)
        {
            if (json == null) throw new ArgumentNullException(nameof(json));

            JsonNode root = JsonNode.Parse(json);
            if (!(root is JsonNode.ObjectNode obj))
                throw new ArgumentException("Settings blob root must be a JSON object.", nameof(json));

            var version = ReadVersion(obj);
            if (version > SettingsSchema.CurrentVersion)
                throw new ArgumentException($"Settings blob version {version} is newer than current {SettingsSchema.CurrentVersion}.", nameof(json));

            // Sequential processing — never by jump (ADR-0004 Risk: schema version gap).
            while (version < SettingsSchema.CurrentVersion)
            {
                switch (version)
                {
                    case 1: MigrateV1ToV2(obj); break;
                    case 2: MigrateV2ToV3(obj); break;
                    default:
                        throw new ArgumentException($"No migration path from version {version}.", nameof(json));
                }

                version++;
                obj.Set("version", new JsonNode.NumberNode(version));
            }

            return JsonNode.Serialize(root);
        }

        /// <summary>
        /// v1 → v2: renames <c>controls.dead_zone</c> to <c>controls.stick_dead_zone_inner</c>, applies
        /// defaults for <c>stick_dead_zone_outer</c> and the per-action EMA alphas, and discards the
        /// unused <c>vibration</c> field (GDD settings.md:88).
        /// </summary>
        private static void MigrateV1ToV2(JsonNode.ObjectNode root)
        {
            var controls = GetOrCreateControls(root);

            // dead_zone → stick_dead_zone_inner (keep the value if present and finite).
            if (controls.Get("dead_zone") is JsonNode.NumberNode deadZone && IsFinite(deadZone.Value))
            {
                controls.Set("stick_dead_zone_inner", new JsonNode.NumberNode(deadZone.Value));
            }
            else
            {
                controls.Set("stick_dead_zone_inner", new JsonNode.NumberNode(0.15));
            }
            controls.Remove("dead_zone");

            // Defaults for fields v1 never had.
            SetDefaultIfMissing(controls, "stick_dead_zone_outer", 0.95);
            SetDefaultIfMissing(controls, "accelerate_ema_alpha", 0.3);
            SetDefaultIfMissing(controls, "brake_ema_alpha", 0.3);
            SetDefaultIfMissing(controls, "steer_ema_alpha", 0.5);

            // Discard the unused vibration field.
            controls.Remove("vibration");
        }

        /// <summary>
        /// v2 → v3: discards the player-owned <c>trigger_dead_zone_inner</c> (trigger threshold is
        /// Input-owned tuning, ADR-0004:138) and <c>subtitles</c> (Alpha+ scope only, GDD:88), while
        /// preserving every remaining supported value.
        /// </summary>
        private static void MigrateV2ToV3(JsonNode.ObjectNode root)
        {
            if (root.Get("controls") is JsonNode.ObjectNode controls)
            {
                controls.Remove("trigger_dead_zone_inner");
            }

            if (root.Get("accessibility") is JsonNode.ObjectNode accessibility)
            {
                accessibility.Remove("subtitles");
            }
        }

        private static byte ReadVersion(JsonNode.ObjectNode root)
        {
            if (root.Get("version") is JsonNode.NumberNode versionNode)
            {
                double v = versionNode.Value;
                // Explicit range check — negative/zero/fractional versions produce a clear error
                // instead of a silent byte-wrap (e.g. -1 → 255).
                if (v < 1 || v > SettingsSchema.CurrentVersion || v != Math.Floor(v))
                    throw new ArgumentException($"Settings blob has unsupported version {v}.", "json");
                return (byte)v;
            }

            throw new ArgumentException("Settings blob has no version field.", "json");
        }

        private static JsonNode.ObjectNode GetOrCreateControls(JsonNode.ObjectNode root)
        {
            if (root.Get("controls") is JsonNode.ObjectNode controls) return controls;

            var created = new JsonNode.ObjectNode();
            root.Set("controls", created);
            return created;
        }

        private static void SetDefaultIfMissing(JsonNode.ObjectNode controls, string key, double defaultValue)
        {
            if (controls.Get(key) == null)
                controls.Set(key, new JsonNode.NumberNode(defaultValue));
        }

        private static bool IsFinite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);
    }
}
