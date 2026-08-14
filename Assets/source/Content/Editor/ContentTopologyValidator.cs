using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEditor.AddressableAssets.Settings;
using UnityEngine;
using Overdrive.Content;

namespace Overdrive.Content.Editor
{
    /// <summary>Kind of a content topology violation (Story 3-8).</summary>
    public enum ContentTopologyIssueKind
    {
        /// <summary>Group count does not match the manifest's expectedGroupCount.</summary>
        GroupCountMismatch,
        /// <summary>A settings group is not declared in the manifest (unknown name or category).</summary>
        UnknownGroup,
        /// <summary>An entry's asset path does not match its group's allowedPaths globs.</summary>
        MembershipPathViolation,
        /// <summary>An entry's main asset type does not match its group's allowedTypes labels.</summary>
        MembershipTypeViolation,
        /// <summary>A car/track group is missing its root entry (rootPath not present among entries).</summary>
        RootEntryMissing,
        /// <summary>A root entry's address is empty/mismatched, or any entry carries an address in another group's namespace.</summary>
        AddressMirrorViolation,
        /// <summary>A car group's dependency closure reaches an asset owned by another car group.</summary>
        CrossCarDependency,
        /// <summary>The manifest declares an allowedTypes label with no type mapping.</summary>
        UnknownManifestLabel,
        /// <summary>An entry's address does not start with its own group's namespace prefix.</summary>
        NamespaceViolation
    }

    /// <summary>One content topology issue (Story 3-8).</summary>
    public readonly struct ContentTopologyIssue
    {
        /// <summary>Kind of the violation.</summary>
        public ContentTopologyIssueKind Kind { get; }

        /// <summary>Affected group name, or null.</summary>
        public string GroupName { get; }

        /// <summary>Affected entry asset path, or null.</summary>
        public string EntryPath { get; }

        /// <summary>Human-readable detail.</summary>
        public string Message { get; }

        /// <summary>Constructs an issue.</summary>
        public ContentTopologyIssue(ContentTopologyIssueKind kind, string groupName, string entryPath, string message)
        {
            Kind = kind;
            GroupName = groupName;
            EntryPath = entryPath;
            Message = message;
        }
    }

    /// <summary>Validation outcome (Story 3-8).</summary>
    public readonly struct ContentTopologyResult
    {
        /// <summary>True when no issues were found.</summary>
        public bool IsValid { get; }

        /// <summary>All issues found, empty when valid.</summary>
        public IReadOnlyList<ContentTopologyIssue> Issues { get; }

        /// <summary>Constructs a result.</summary>
        public ContentTopologyResult(bool isValid, IReadOnlyList<ContentTopologyIssue> issues)
        {
            IsValid = isValid;
            Issues = issues;
        }
    }

    /// <summary>
    /// Validates an injected <see cref="AddressableAssetSettings"/> against a
    /// <see cref="ContentTopologyData"/> manifest (Story 3-8, ADR-0003). Operates on the
    /// settings object passed in — never the global
    /// <c>AddressableAssetSettingsDefaultObject</c>. Reads each entry's
    /// <c>AddressableAssetEntry.address</c> directly; the address-assignment tooling
    /// (<see cref="AddressAssignmentTool"/>) writes the same field, so no separate seam.
    /// </summary>
    public static class ContentTopologyValidator
    {
        private static readonly Dictionary<string, Type> TypeMap = new Dictionary<string, Type>
        {
            { "Prefab", typeof(GameObject) },
            { "AudioClip", typeof(AudioClip) },
            { "Shader", typeof(Shader) },
            { "Texture2D", typeof(Texture2D) }
        };

        private static readonly HashSet<string> AllowedCategories = new HashSet<string> { "Shared", "Cars", "Tracks" };

        /// <summary>
        /// Addressables sanitizes group names by replacing <c>/</c> with <c>-</c> (a group
        /// named <c>Cars/teamA</c> is created as <c>Cars-teamA</c>). The manifest carries the
        /// conceptual names (ADR-0003 mirror); this translates a manifest name to the
        /// settings-side group name for lookup.
        /// </summary>
        public static string ToSettingsGroupName(string manifestName) => manifestName.Replace('/', '-');

        /// <summary>Reverse translation for matching settings groups back to manifest specs.</summary>
        public static string ToManifestGroupName(string settingsName) => settingsName.Replace('-', '/');

        /// <summary>
        /// Validates the settings against the manifest. Checks, in order: group count and
        /// category coverage, per-entry membership (allowedPaths globs / allowedTypes labels),
        /// root identity (rootPath entry exists + address == rootAddress), address namespace
        /// mirror for every entry, and group-level cross-car dependency closure.
        /// </summary>
        public static ContentTopologyResult Validate(AddressableAssetSettings settings, ContentTopologyData manifest)
        {
            var issues = new List<ContentTopologyIssue>();
            if (settings == null || manifest == null)
            {
                issues.Add(new ContentTopologyIssue(ContentTopologyIssueKind.GroupCountMismatch, null, null, "Settings or manifest is null."));
                return new ContentTopologyResult(false, issues);
            }

            // 1. Group count + declared set.
            var manifestByName = new Dictionary<string, ContentTopologyGroup>();
            foreach (var g in manifest.groups) manifestByName[g.name] = g;

            if (settings.groups.Count != manifest.expectedGroupCount)
            {
                issues.Add(new ContentTopologyIssue(ContentTopologyIssueKind.GroupCountMismatch, null, null,
                    $"Group count {settings.groups.Count} != expected {manifest.expectedGroupCount}."));
            }

            foreach (var group in settings.groups)
            {
                var groupName = group != null ? group.Name : null;
                if (groupName == null || !manifestByName.TryGetValue(ToManifestGroupName(groupName), out var spec))
                {
                    issues.Add(new ContentTopologyIssue(ContentTopologyIssueKind.UnknownGroup, groupName, null,
                        $"Group '{groupName}' is not declared in the manifest."));
                    continue;
                }
                if (!AllowedCategories.Contains(spec.category))
                {
                    issues.Add(new ContentTopologyIssue(ContentTopologyIssueKind.UnknownGroup, groupName, null,
                        $"Group '{groupName}' has category '{spec.category}' — only Shared, Cars, Tracks are allowed."));
                    continue;
                }
                ValidateGroup(group, spec, manifest, issues);
            }

            foreach (var declared in manifest.groups)
            {
                if (settings.FindGroup(ToSettingsGroupName(declared.name)) == null)
                {
                    issues.Add(new ContentTopologyIssue(ContentTopologyIssueKind.UnknownGroup, declared.name, null,
                        $"Manifest group '{declared.name}' is missing from settings."));
                }
            }

            return new ContentTopologyResult(issues.Count == 0, issues);
        }

        private static void ValidateGroup(AddressableAssetGroup group, ContentTopologyGroup spec,
            ContentTopologyData manifest, List<ContentTopologyIssue> issues)
        {
            ValidateManifestLabels(group, spec, issues);
            ValidateEntryMembership(group, spec, manifest, issues);
            ValidateRootIdentity(group, spec, issues);
            ValidateCrossCarClosure(group, spec, manifest, issues);
        }

        /// <summary>Reports unknown manifest type labels once per distinct label (dedup), independent of entries.</summary>
        private static void ValidateManifestLabels(AddressableAssetGroup group, ContentTopologyGroup spec, List<ContentTopologyIssue> issues)
        {
            if (spec.allowedTypes == null) return;
            var seenUnknown = new HashSet<string>();
            foreach (var label in spec.allowedTypes)
            {
                if (!TypeMap.ContainsKey(label) && seenUnknown.Add(label))
                {
                    issues.Add(new ContentTopologyIssue(ContentTopologyIssueKind.UnknownManifestLabel, group.Name, null,
                        $"Manifest label '{label}' has no type mapping."));
                }
            }
        }

        /// <summary>Per-entry membership (allowedPaths globs, allowedTypes labels) and namespace mirror.</summary>
        private static void ValidateEntryMembership(AddressableAssetGroup group, ContentTopologyGroup spec,
            ContentTopologyData manifest, List<ContentTopologyIssue> issues)
        {
            foreach (var entry in group.entries)
            {
                if (entry == null) continue;
                var assetPath = entry.AssetPath;
                if (!IsPathAllowed(assetPath, spec.allowedPaths))
                {
                    issues.Add(new ContentTopologyIssue(ContentTopologyIssueKind.MembershipPathViolation, group.Name, assetPath,
                        $"Entry '{assetPath}' does not match any allowedPaths of group '{group.Name}'."));
                }
                if (spec.allowedTypes != null && spec.allowedTypes.Count > 0 && assetPath != null)
                {
                    var assetType = AssetDatabase.GetMainAssetTypeAtPath(assetPath);
                    if (assetType == null || !MatchesAnyType(assetType, spec.allowedTypes))
                    {
                        issues.Add(new ContentTopologyIssue(ContentTopologyIssueKind.MembershipTypeViolation, group.Name, assetPath,
                            $"Entry '{assetPath}' type {assetType?.Name} does not match group '{group.Name}' allowedTypes."));
                    }
                }
                if (!string.IsNullOrEmpty(entry.address) && !IsAddressInNamespace(entry.address, spec.name, spec.category))
                {
                    issues.Add(new ContentTopologyIssue(ContentTopologyIssueKind.NamespaceViolation, group.Name, assetPath,
                        $"Entry '{assetPath}' address '{entry.address}' is outside group '{group.Name}' namespace."));
                }
            }
        }

        /// <summary>Root identity for car/track groups (Shared omits rootPath); empty/mismatched root address is a mirror violation.</summary>
        private static void ValidateRootIdentity(AddressableAssetGroup group, ContentTopologyGroup spec, List<ContentTopologyIssue> issues)
        {
            if (string.IsNullOrEmpty(spec.rootPath)) return;
            var root = FindEntry(group, spec.rootPath);
            if (root == null)
            {
                issues.Add(new ContentTopologyIssue(ContentTopologyIssueKind.RootEntryMissing, group.Name, spec.rootPath,
                    $"Group '{group.Name}' is missing its root entry '{spec.rootPath}'."));
            }
            else if (string.IsNullOrEmpty(root.address))
            {
                issues.Add(new ContentTopologyIssue(ContentTopologyIssueKind.AddressMirrorViolation, group.Name, spec.rootPath,
                    $"Root entry '{spec.rootPath}' has an empty address; expected '{spec.rootAddress}'."));
            }
            else if (!string.Equals(root.address, spec.rootAddress, StringComparison.Ordinal))
            {
                issues.Add(new ContentTopologyIssue(ContentTopologyIssueKind.AddressMirrorViolation, group.Name, spec.rootPath,
                    $"Root entry address '{root.address}' != expected '{spec.rootAddress}'."));
            }
        }

        /// <summary>Group-level dependency closure: no car entry may resolve into another car group's folder (Shared roots allowed).</summary>
        private static void ValidateCrossCarClosure(AddressableAssetGroup group, ContentTopologyGroup spec,
            ContentTopologyData manifest, List<ContentTopologyIssue> issues)
        {
            if (!manifest.forbiddenCrossCarDependencies || spec.category != "Cars") return;
            foreach (var entry in group.entries)
            {
                if (entry == null || string.IsNullOrEmpty(entry.AssetPath)) continue;
                foreach (var dep in AssetDatabase.GetDependencies(entry.AssetPath, true))
                {
                    if (dep == entry.AssetPath) continue;
                    foreach (var other in manifest.groups)
                    {
                        if (other == spec || other.category != "Cars") continue;
                        if (IsPathAllowed(dep, other.allowedPaths))
                        {
                            issues.Add(new ContentTopologyIssue(ContentTopologyIssueKind.CrossCarDependency, group.Name, entry.AssetPath,
                                $"Entry '{entry.AssetPath}' depends on '{dep}', owned by car group '{other.name}'."));
                        }
                    }
                }
            }
        }

        private static AddressableAssetEntry FindEntry(AddressableAssetGroup group, string assetPath)
        {
            foreach (var entry in group.entries)
            {
                if (entry != null && string.Equals(entry.AssetPath, assetPath, StringComparison.OrdinalIgnoreCase)) return entry;
            }
            return null;
        }

        private static bool MatchesAnyType(Type assetType, List<string> labels)
        {
            foreach (var label in labels)
            {
                if (!TypeMap.TryGetValue(label, out var mapped)) continue; // unknown labels handled by the pre-pass
                if (mapped.IsAssignableFrom(assetType) || assetType.IsAssignableFrom(mapped)) return true;
            }
            return false;
        }

        private static bool IsAddressInNamespace(string address, string groupName, string category)
        {
            // Car/track: address must start with the manifest group name prefix (mirror).
            // The groupName passed here is the MANIFEST name (with '/'), e.g. "Cars/teamA".
            if (category == "Cars" || category == "Tracks")
            {
                return address.StartsWith(groupName + "/", StringComparison.Ordinal) || address == groupName;
            }
            // Shared: must not use a Cars/ or Tracks/ namespace prefix.
            return !address.StartsWith("Cars/", StringComparison.Ordinal) && !address.StartsWith("Tracks/", StringComparison.Ordinal);
        }

        private static bool IsPathAllowed(string path, List<string> globs)
        {
            if (globs == null || globs.Count == 0) return true;
            if (string.IsNullOrEmpty(path)) return false;
            foreach (var glob in globs)
            {
                if (GlobMatches(glob, path)) return true;
            }
            return false;
        }

        /// <summary>Glob match: <c>**</c> crosses directory separators, <c>*</c> does not.</summary>
        public static bool GlobMatches(string glob, string path)
        {
            var pattern = "^" + Regex.Escape(glob)
                .Replace(@"\*\*", ".*")
                .Replace(@"\*", "[^/]*")
                .Replace(@"\?", ".") + "$";
            return Regex.IsMatch(path, pattern, RegexOptions.IgnoreCase);
        }
    }
}
