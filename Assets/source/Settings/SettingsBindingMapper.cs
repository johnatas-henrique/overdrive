using System;
using System.Collections.Generic;
using Overdrive.Input;
using Overdrive.Settings.Core;

namespace Overdrive.Settings
{
    /// <summary>
    /// Maps persisted binding overrides against the Input catalog at load time (AC-C12/AC-E4). An
    /// unknown binding id (which subsumes unknown action — a binding id identifies its action
    /// implicitly per the shipped 2-field contract) or a malformed/reserved-conflicting path restores
    /// only the affected slot default; every valid override stays active. The returned
    /// <see cref="BindingMigrationResult"/> IS the non-blocking typed notice.
    /// </summary>
    public sealed class SettingsBindingMapper
    {
        private readonly InputBindingCatalog _catalog;

        /// <summary>Creates the mapper.</summary>
        /// <param name="catalog">The Input-side binding catalog.</param>
        /// <exception cref="ArgumentNullException"><paramref name="catalog"/> is null.</exception>
        public SettingsBindingMapper(InputBindingCatalog catalog)
        {
            _catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
        }

        /// <summary>
        /// Applies persisted overrides and classifies every failure: unknown binding id → UnknownBindingIds;
        /// known id with malformed/reserved-conflicting/cap-violated path → MalformedPaths; duplicate path
        /// (two overrides bound to the same control, AC-E4) → the first wins, later duplicates are restored.
        /// Every restored slot is reset to its asset default (an existing runtime override is removed).
        /// Valid overrides are applied and preserved. De-duplication is normally also handled by
        /// SettingsBindings.ResolveDuplicatePaths during the load cascade (Story 001); the mapper
        /// re-classifies defensively so the typed BindingMigrationResult is complete (AC-C12/E4).
        /// </summary>
        /// <param name="persisted">The overrides from the load cascade (may still contain duplicates).</param>
        /// <returns>The typed migration result (preserved set + restored slots + typed issues).</returns>
        public BindingMigrationResult MapPersistedOverrides(IReadOnlyList<BindingOverrideData> persisted)
        {
            if (persisted == null)
            {
                throw new ArgumentNullException(nameof(persisted));
            }

            var unknown = new List<Guid>();
            var known = new List<BindingOverrideData>();
            var seenPaths = new HashSet<string>(StringComparer.Ordinal);
            var seenBindingIds = new HashSet<Guid>();
            var duplicates = new List<Guid>();

            foreach (BindingOverrideData entry in persisted)
            {
                if (!_catalog.HasBinding(entry.BindingId))
                {
                    unknown.Add(entry.BindingId);
                    continue;
                }

                // A second override for the SAME slot (same BindingId) is a slot duplicate — the first
                // override wins and the duplicate is discarded (it never marks the slot preserved AND
                // restored; a preserved slot keeps its binding).
                if (!seenBindingIds.Add(entry.BindingId))
                {
                    continue;
                }

                if (!seenPaths.Add(entry.Path))
                {
                    duplicates.Add(entry.BindingId);
                    continue;
                }

                known.Add(entry);
            }

            Guid[] notApplied = _catalog.ApplyOverrides(ToInputOverrides(known));

            var notAppliedSet = new HashSet<Guid>(notApplied);
            var preserved = new List<BindingOverrideData>(known.Count - notAppliedSet.Count);
            var malformed = new List<string>();

            foreach (BindingOverrideData entry in known)
            {
                if (notAppliedSet.Contains(entry.BindingId))
                {
                    malformed.Add(entry.Path);
                }
                else
                {
                    preserved.Add(entry);
                }
            }

            var restored = new List<Guid>(unknown.Count + notAppliedSet.Count + duplicates.Count);
            restored.AddRange(notApplied);
            restored.AddRange(unknown);
            restored.AddRange(duplicates);

            // Every restored slot falls back to its asset default — clear any pre-existing runtime override.
            foreach (Guid restoredId in restored)
            {
                _catalog.RemoveOverride(restoredId);
            }

            return new BindingMigrationResult(preserved, restored, unknown, malformed);
        }

        private static Overdrive.Input.BindingOverride[] ToInputOverrides(IReadOnlyList<BindingOverrideData> overrides)
        {
            var result = new Overdrive.Input.BindingOverride[overrides.Count];
            for (int i = 0; i < overrides.Count; i++)
            {
                result[i] = new Overdrive.Input.BindingOverride(overrides[i].BindingId, overrides[i].Path);
            }

            return result;
        }
    }
}
