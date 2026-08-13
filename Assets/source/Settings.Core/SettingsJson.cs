using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Overdrive.Settings.Core
{
    /// <summary>
    /// A minimal JSON node tree for the settings blob. Engine-free (no System.Text.Json,
    /// Newtonsoft, or JsonUtility — none available; JsonUtility is UnityEngine-only and
    /// forbidden in this assembly). The settings blob is a stable &lt; 10 KB schema, so a
    /// small hand-rolled parser is the correct scope (unity-specialist, 2026-08-12).
    /// </summary>
    public abstract class JsonNode
    {
        /// <summary>A JSON object node.</summary>
        public sealed class ObjectNode : JsonNode
        {
            private readonly Dictionary<string, JsonNode> _fields = new Dictionary<string, JsonNode>(StringComparer.Ordinal);

            /// <summary>Adds a field.</summary>
            public void Set(string key, JsonNode value) => _fields[key] = value;

            /// <summary>Returns whether the field exists.</summary>
            public bool Has(string key) => _fields.ContainsKey(key);

            /// <summary>Removes a field (used by migration to discard deprecated fields).</summary>
            public bool Remove(string key) => _fields.Remove(key);

            /// <summary>Renames a field (used by migration to upgrade names).</summary>
            public bool Rename(string from, string to)
            {
                if (!_fields.TryGetValue(from, out JsonNode value)) return false;
                _fields.Remove(from);
                _fields[to] = value;
                return true;
            }

            /// <summary>Returns the field, or null when absent.</summary>
            public JsonNode Get(string key) => _fields.TryGetValue(key, out JsonNode value) ? value : null;

            /// <summary>The field keys.</summary>
            public IEnumerable<string> Keys => _fields.Keys;

            /// <summary>The field count.</summary>
            public int Count => _fields.Count;
        }

        /// <summary>A JSON array node.</summary>
        public sealed class ArrayNode : JsonNode
        {
            private readonly List<JsonNode> _items = new List<JsonNode>();

            /// <summary>Adds an item.</summary>
            public void Add(JsonNode item) => _items.Add(item);

            /// <summary>The items.</summary>
            public IReadOnlyList<JsonNode> Items => _items;
        }

        /// <summary>A JSON string node.</summary>
        public sealed class StringNode : JsonNode
        {
            /// <summary>Creates a string node.</summary>
            public StringNode(string value) => Value = value;

            /// <summary>The string value.</summary>
            public string Value { get; }
        }

        /// <summary>A JSON number node (stored as double; ints round-trip exactly up to 2^53).</summary>
        public sealed class NumberNode : JsonNode
        {
            /// <summary>Creates a number node.</summary>
            public NumberNode(double value) => Value = value;

            /// <summary>The numeric value.</summary>
            public double Value { get; }
        }

        /// <summary>A JSON boolean node.</summary>
        public sealed class BoolNode : JsonNode
        {
            /// <summary>Creates a boolean node.</summary>
            public BoolNode(bool value) => Value = value;

            /// <summary>The boolean value.</summary>
            public bool Value { get; }
        }

        /// <summary>A JSON null node.</summary>
        public sealed class NullNode : JsonNode
        {
            /// <summary>The singleton null node.</summary>
            public static readonly NullNode Instance = new NullNode();

            private NullNode() { }
        }

        /// <summary>Parses a JSON document into a node tree. Throws <see cref="JsonParseException"/> on malformed input.</summary>
        /// <param name="json">The JSON text.</param>
        /// <returns>The root node (object, array, or primitive).</returns>
        public static JsonNode Parse(string json)
        {
            if (json == null) throw new ArgumentNullException(nameof(json));
            int index = 0;
            JsonNode root = ParseValue(json, ref index);
            SkipWhitespace(json, ref index);
            if (index != json.Length) throw new JsonParseException($"Unexpected trailing content at position {index}.");
            return root;
        }

        /// <summary>Serializes a node tree to JSON text.</summary>
        /// <param name="node">The root node.</param>
        /// <returns>Compact JSON text.</returns>
        public static string Serialize(JsonNode node)
        {
            if (node == null) throw new ArgumentNullException(nameof(node));
            var sb = new StringBuilder(512);
            WriteValue(sb, node);
            return sb.ToString();
        }

        private static JsonNode ParseValue(string json, ref int index)
        {
            SkipWhitespace(json, ref index);
            if (index >= json.Length) throw new JsonParseException("Unexpected end of JSON.");

            char c = json[index];
            switch (c)
            {
                case '{': return ParseObject(json, ref index);
                case '[': return ParseArray(json, ref index);
                case '"': return new StringNode(ParseString(json, ref index));
                case 't':
                    Expect(json, ref index, "true");
                    return new BoolNode(true);
                case 'f':
                    Expect(json, ref index, "false");
                    return new BoolNode(false);
                case 'n':
                    Expect(json, ref index, "null");
                    return NullNode.Instance;
                default:
                    if (c == '-' || (c >= '0' && c <= '9')) return ParseNumber(json, ref index);
                    throw new JsonParseException($"Unexpected character '{c}' at position {index}.");
            }
        }

        private static ObjectNode ParseObject(string json, ref int index)
        {
            index++; // consume '{'
            var obj = new ObjectNode();
            SkipWhitespace(json, ref index);
            if (index < json.Length && json[index] == '}') { index++; return obj; }

            while (true)
            {
                SkipWhitespace(json, ref index);
                if (index >= json.Length || json[index] != '"') throw new JsonParseException($"Expected string key at position {index}.");
                string key = ParseString(json, ref index);
                SkipWhitespace(json, ref index);
                if (index >= json.Length || json[index] != ':') throw new JsonParseException($"Expected ':' at position {index}.");
                index++;
                JsonNode value = ParseValue(json, ref index);
                obj.Set(key, value);
                SkipWhitespace(json, ref index);
                if (index >= json.Length) throw new JsonParseException("Unexpected end of JSON object.");
                if (json[index] == ',') { index++; continue; }
                if (json[index] == '}') { index++; return obj; }
                throw new JsonParseException($"Expected ',' or '}}' at position {index}.");
            }
        }

        private static ArrayNode ParseArray(string json, ref int index)
        {
            index++; // consume '['
            var arr = new ArrayNode();
            SkipWhitespace(json, ref index);
            if (index < json.Length && json[index] == ']') { index++; return arr; }

            while (true)
            {
                arr.Add(ParseValue(json, ref index));
                SkipWhitespace(json, ref index);
                if (index >= json.Length) throw new JsonParseException("Unexpected end of JSON array.");
                if (json[index] == ',') { index++; continue; }
                if (json[index] == ']') { index++; return arr; }
                throw new JsonParseException($"Expected ',' or ']' at position {index}.");
            }
        }

        private static string ParseString(string json, ref int index)
        {
            index++; // consume opening quote
            var sb = new StringBuilder();
            while (index < json.Length)
            {
                char c = json[index];
                if (c == '"') { index++; return sb.ToString(); }
                if (c == '\\')
                {
                    index++;
                    if (index >= json.Length) throw new JsonParseException("Unterminated escape.");
                    char esc = json[index];
                    switch (esc)
                    {
                        case '"': sb.Append('"'); break;
                        case '\\': sb.Append('\\'); break;
                        case '/': sb.Append('/'); break;
                        case 'b': sb.Append('\b'); break;
                        case 'f': sb.Append('\f'); break;
                        case 'n': sb.Append('\n'); break;
                        case 'r': sb.Append('\r'); break;
                        case 't': sb.Append('\t'); break;
                        case 'u':
                            if (index + 4 >= json.Length) throw new JsonParseException("Invalid unicode escape.");
                            string hex = json.Substring(index + 1, 4);
                            sb.Append((char)int.Parse(hex, NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                            index += 4;
                            break;
                        default: throw new JsonParseException($"Unknown escape '\\{esc}'.");
                    }
                    index++;
                }
                else
                {
                    sb.Append(c);
                    index++;
                }
            }
            throw new JsonParseException("Unterminated string.");
        }

        private static NumberNode ParseNumber(string json, ref int index)
        {
            int start = index;
            // RFC 8259 §7: no leading '+' — only '-', digits, '.', exponent markers are valid number chars.
            while (index < json.Length && "-0123456789.eE".IndexOf(json[index]) >= 0) index++;
            string token = json.Substring(start, index - start);
            if (token.Length == 0) throw new JsonParseException($"Expected number at position {start}.");
            if (!double.TryParse(token, NumberStyles.Float, CultureInfo.InvariantCulture, out double value))
                throw new JsonParseException($"Invalid number '{token}' at position {start}.");
            return new NumberNode(value);
        }

        private static void Expect(string json, ref int index, string literal)
        {
            if (index + literal.Length > json.Length || json.Substring(index, literal.Length) != literal)
                throw new JsonParseException($"Expected '{literal}' at position {index}.");
            index += literal.Length;
        }

        private static void SkipWhitespace(string json, ref int index)
        {
            while (index < json.Length && char.IsWhiteSpace(json[index])) index++;
        }

        private static void WriteValue(StringBuilder sb, JsonNode node)
        {
            switch (node)
            {
                case ObjectNode obj:
                    sb.Append('{');
                    bool first = true;
                    foreach (string key in obj.Keys)
                    {
                        if (!first) sb.Append(',');
                        first = false;
                        WriteString(sb, key);
                        sb.Append(':');
                        WriteValue(sb, obj.Get(key));
                    }
                    sb.Append('}');
                    break;
                case ArrayNode arr:
                    sb.Append('[');
                    for (int i = 0; i < arr.Items.Count; i++)
                    {
                        if (i > 0) sb.Append(',');
                        WriteValue(sb, arr.Items[i]);
                    }
                    sb.Append(']');
                    break;
                case StringNode str:
                    WriteString(sb, str.Value);
                    break;
                case NumberNode num:
                    sb.Append(num.Value.ToString("R", CultureInfo.InvariantCulture));
                    break;
                case BoolNode b:
                    sb.Append(b.Value ? "true" : "false");
                    break;
                case NullNode:
                    sb.Append("null");
                    break;
                default:
                    throw new InvalidOperationException($"Unknown node type {node.GetType().Name}.");
            }
        }

        private static void WriteString(StringBuilder sb, string value)
        {
            sb.Append('"');
            foreach (char c in value)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }
    }

    /// <summary>Thrown when the settings blob JSON cannot be parsed.</summary>
    public sealed class JsonParseException : Exception
    {
        /// <summary>Creates a parse exception.</summary>
        /// <param name="message">The error message.</param>
        public JsonParseException(string message) : base(message) { }
    }
}
