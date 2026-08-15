namespace Overdrive.Content
{
    /// <summary>
    /// Addressable key constants (ADR-0003:138-149). GROUP NAMES are never runtime
    /// load keys — the load key is the asset's ADDRESS. Group names
    /// (<c>Cars/{teamId}</c>, <c>Tracks/{trackId}</c>, <c>Shared</c>) must be mirrored by
    /// explicit address assignment in editor tooling — each car bundle's root asset is
    /// addressed <c>Cars/{teamId}/CarDefinition</c> and each track's root asset
    /// <c>Tracks/{trackId}/TrackData</c> (the per-root form is the executable contract;
    /// the group name is only a mirror prefix).
    /// </summary>
    public static class AddressableKeys
    {
        /// <summary>Shared group name (startup, lifelong).</summary>
        public const string SharedGroup = "Shared";

        /// <summary>Car group name namespace prefix, e.g. <c>Cars/team_tier4_d</c>.</summary>
        public static string CarGroup(string teamId) => $"Cars/{teamId}";

        /// <summary>Track group name namespace prefix, e.g. <c>Tracks/monaco</c>.</summary>
        public static string TrackGroup(string trackId) => $"Tracks/{trackId}";

        /// <summary>Shared car prefab address (placeholder path).</summary>
        public const string CarPrefab = "CarPrefab";

        /// <summary>Per-car root address — never a shared constant. "CarDefinition" alone would resolve ambiguously across 16 cars.</summary>
        public static string CarDefinition(string teamId) => $"Cars/{teamId}/CarDefinition";

        /// <summary>Per-track root address.</summary>
        public static string TrackData(string trackId) => $"Tracks/{trackId}/TrackData";

        /// <summary>Shared track environment address.</summary>
        public const string TrackEnvironment = "TrackEnvironment";

        /// <summary>
        /// Shared bootstrap sentinel address (Story 005): the startup validates the Shared group
        /// by loading this concrete asset type (<c>GameObject</c>) and retaining the handle for
        /// the app lifetime. A wrong asset type in the bundle is a real type-mismatch error
        /// (never silently accepted).
        /// </summary>
        public const string SharedBootstrap = "Shared/Bootstrap";
    }
}
