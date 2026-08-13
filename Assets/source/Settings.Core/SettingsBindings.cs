using System;
using System.Collections.Generic;

namespace Overdrive.Settings.Core
{
    /// <summary>
    /// Parses, serializes, and de-duplicates the binding overrides stored in the controls blob's
    /// <c>bindings_json</c> (GDD settings.md:70, :90; AC-E4). Two overrides pointing at the same
    /// control path (e.g. an external edit bound two actions to one key) are resolved first-wins:
    /// the first override keeps the path, later duplicates are reset (removed) and reported through
    /// the injectable warning sink. Engine-free.
    /// </summary>
    public static class SettingsBindings
    {
        /// <summary>
        /// Parses the <c>bindings_json</c> string into binding overrides. An empty or null string
        /// yields an empty array. Malformed JSON throws <see cref="JsonParseException"/>.
        /// </summary>
        /// <param name="bindingsJson">The serialized overrides.</param>
        /// <returns>The parsed overrides.</returns>
        public static BindingOverrideData[] Parse(string bindingsJson)
        {
            if (string.IsNullOrEmpty(bindingsJson)) return Array.Empty<BindingOverrideData>();

            JsonNode root = JsonNode.Parse(bindingsJson);
            if (!(root is JsonNode.ArrayNode arr))
                throw new ArgumentException("bindings_json must be a JSON array.", nameof(bindingsJson));

            var result = new List<BindingOverrideData>(arr.Items.Count);
            foreach (JsonNode item in arr.Items)
            {
                if (!(item is JsonNode.ObjectNode obj))
                    throw new ArgumentException("Each binding override must be a JSON object.", nameof(bindingsJson));

                result.Add(new BindingOverrideData(
                    ParseGuid(obj),
                    obj.Get("path") is JsonNode.StringNode path ? path.Value : string.Empty));
            }

            return result.ToArray();
        }

        /// <summary>
        /// Serializes binding overrides to <c>bindings_json</c>.
        /// </summary>
        /// <param name="overrides">The overrides.</param>
        /// <returns>The JSON array text.</returns>
        public static string Serialize(BindingOverrideData[] overrides)
        {
            if (overrides == null) throw new ArgumentNullException(nameof(overrides));

            var arr = new JsonNode.ArrayNode();
            foreach (BindingOverrideData item in overrides)
            {
                var obj = new JsonNode.ObjectNode();
                obj.Set("bindingId", new JsonNode.StringNode(item.BindingId.ToString("D")));
                obj.Set("path", new JsonNode.StringNode(item.Path));
                arr.Add(obj);
            }

            return JsonNode.Serialize(arr);
        }

        /// <summary>
        /// Resolves duplicate control paths first-wins (AC-E4): the first override per path is kept;
        /// every later override sharing that path is removed and reported through the warning sink.
        /// Overrides with an empty path are kept as-is (a path-less override is inert, not a duplicate).
        /// </summary>
        /// <param name="overrides">The loaded overrides.</param>
        /// <param name="warnings">Receives one warning per removed duplicate (path + binding id). May be null.</param>
        /// <returns>A new array with duplicates removed.</returns>
        public static BindingOverrideData[] ResolveDuplicatePaths(BindingOverrideData[] overrides, Action<string> warnings)
        {
            if (overrides == null) throw new ArgumentNullException(nameof(overrides));

            var seen = new HashSet<string>(StringComparer.Ordinal);
            var result = new List<BindingOverrideData>(overrides.Length);

            foreach (BindingOverrideData item in overrides)
            {
                if (string.IsNullOrEmpty(item.Path))
                {
                    result.Add(item);
                    continue;
                }

                if (!seen.Add(item.Path))
                {
                    warnings?.Invoke($"Duplicate binding path '{item.Path}' for binding {item.BindingId} — reset to default.");
                    continue;
                }

                result.Add(item);
            }

            return result.ToArray();
        }

        private static Guid ParseGuid(JsonNode.ObjectNode obj)
        {
            if (obj.Get("bindingId") is JsonNode.StringNode id && Guid.TryParse(id.Value, out Guid guid))
                return guid;
            throw new ArgumentException("Binding override is missing a valid bindingId GUID.");
        }
    }
}
