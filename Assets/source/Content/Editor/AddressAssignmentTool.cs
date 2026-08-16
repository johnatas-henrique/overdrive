using UnityEditor.AddressableAssets.Settings;
using Overdrive.Content;

namespace Overdrive.Content.Editor
{
    /// <summary>
    /// Editor tooling that assigns root addresses mirroring group names (ADR-0003:130-137).
    /// <see cref="AssignAll"/> is the callable seam: idempotent (re-running on a correct
    /// settings leaves it unchanged; re-running on a settings with a wrong/empty root
    /// address corrects it). Writes the same <c>AddressableAssetEntry.address</c> field the
    /// <see cref="ContentTopologyValidator"/> reads, so no separate seam is needed.
    /// </summary>
    public static class AddressAssignmentTool
    {
        /// <summary>
        /// Assigns every car/track group's root entry address to its manifest
        /// <c>rootAddress</c>. Groups without a rootPath (Shared) are untouched.
        /// </summary>
        /// <returns>The number of addresses assigned or corrected.</returns>
        public static int AssignAll(AddressableAssetSettings settings, ContentTopologyData manifest)
        {
            if (settings == null || manifest == null) return 0;
            var assigned = 0;
            foreach (var spec in manifest.groups)
            {
                if (string.IsNullOrEmpty(spec.rootPath) || string.IsNullOrEmpty(spec.rootAddress)) continue;
                var group = settings.FindGroup(ContentTopologyValidator.ToSettingsGroupName(spec.name));
                if (group == null) continue;
                var root = FindEntry(group, spec.rootPath);
                if (root == null) continue;
                if (!string.Equals(root.address, spec.rootAddress, System.StringComparison.Ordinal))
                {
                    root.address = spec.rootAddress;
                    assigned++;
                }
            }
            return assigned;
        }

        private static AddressableAssetEntry FindEntry(AddressableAssetGroup group, string assetPath)
        {
            foreach (var entry in group.entries)
            {
                if (entry != null && string.Equals(entry.AssetPath, assetPath, System.StringComparison.OrdinalIgnoreCase)) return entry;
            }
            return null;
        }
    }
}
