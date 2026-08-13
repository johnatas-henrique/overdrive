using System;
using Overdrive.Input;
using Overdrive.Settings.Core;
using UnityEngine;

namespace Overdrive.Settings
{
    /// <summary>
    /// The Unity-facing settings loader. Wires the engine-free core (load cascade, migration,
    /// per-field validation, binding de-duplication) to Unity surfaces: the warning sink forwards to
    /// <c>Debug.LogWarning</c>, and the resolved control settings are mapped into
    /// <c>Overdrive.Input.ControlProfile</c> (consuming the Input epic's <c>ControlProfile.Sanitize</c>
    /// for profile-level validation — not re-implemented).
    /// </summary>
    public sealed class SettingsLoader
    {
        private readonly SettingsBlobService _blobService;
        private readonly Action<string> _warningSink;

        /// <summary>Creates the loader.</summary>
        /// <param name="blobService">The engine-free blob service.</param>
        /// <param name="warningSink">Optional warning sink; defaults to <c>Debug.LogWarning</c>.</param>
        public SettingsLoader(SettingsBlobService blobService, Action<string> warningSink = null)
        {
            _blobService = blobService ?? throw new ArgumentNullException(nameof(blobService));
            _warningSink = warningSink ?? (message => Debug.LogWarning($"[Settings] {message}"));
        }

        /// <summary>
        /// The resolved settings after a full load, mapped to Unity-facing types.
        /// </summary>
        public readonly struct LoadedSettings
        {
            /// <summary>Creates the loaded settings.</summary>
            /// <param name="data">The raw persisted model.</param>
            /// <param name="controlProfile">The sanitized control profile.</param>
            /// <param name="resolvedBindings">The de-duplicated binding overrides (AC-E4).</param>
            /// <param name="usedBackup">Whether backup was used.</param>
            /// <param name="usedDefaults">Whether defaults were used.</param>
            public LoadedSettings(GameSettingsData data, ControlProfile controlProfile, BindingOverrideData[] resolvedBindings, bool usedBackup, bool usedDefaults)
            {
                Data = data;
                ControlProfile = controlProfile;
                ResolvedBindings = resolvedBindings;
                UsedBackup = usedBackup;
                UsedDefaults = usedDefaults;
            }

            /// <summary>The raw persisted model.</summary>
            public GameSettingsData Data { get; }

            /// <summary>The sanitized control profile (Input-side validation applied).</summary>
            public ControlProfile ControlProfile { get; }

            /// <summary>The de-duplicated binding overrides (AC-E4 — first-wins per path).</summary>
            public BindingOverrideData[] ResolvedBindings { get; }

            /// <summary>Whether the backup blob was loaded.</summary>
            public bool UsedBackup { get; }

            /// <summary>Whether factory defaults were loaded.</summary>
            public bool UsedDefaults { get; }
        }

        /// <summary>
        /// Loads, migrates, validates, de-duplicates bindings, and maps to Unity types.
        /// </summary>
        /// <returns>The loaded settings.</returns>
        public LoadedSettings Load()
        {
            SettingsBlobService.LoadOutcome outcome = _blobService.Load();

            // First launch (factory defaults): attempt to persist them (GDD settings.md:84). A failed
            // initial write keeps defaults active for the session and reports a save warning — the game
            // never crashes.
            if (outcome.UsedDefaults && _blobService.TryPersistDefaults() != SaveResult.Success)
            {
                _warningSink("Initial settings save failed — factory defaults remain active for this session.");
            }

            // De-duplicate binding overrides (AC-E4) — external edits may have bound two actions to one key.
            var overrides = SettingsBindings.Parse(outcome.Settings.Controls.BindingsJson);
            var resolved = SettingsBindings.ResolveDuplicatePaths(overrides, _warningSink);

            // Map core control values into the Input ControlProfile, then validate per-field via Input's Sanitize.
            var coreControls = outcome.Settings.Controls;
            var rawProfile = new ControlProfile(
                coreControls.StickInner,
                coreControls.StickOuter,
                // TriggerInner is Input-owned tuning — ControlProfile.Sanitize overwrites it from the
                // approved Input default regardless of what we pass here (ADR-0004:138).
                DeadZoneNormalizer.TriggerInnerThreshold,
                coreControls.AccelerateAlpha,
                coreControls.BrakeAlpha,
                coreControls.SteerAlpha);
            ControlProfile sanitized = ControlProfile.Sanitize(rawProfile, out _);

            return new LoadedSettings(
                outcome.Settings,
                sanitized,
                resolved,
                outcome.UsedBackup,
                outcome.UsedDefaults);
        }
    }
}
