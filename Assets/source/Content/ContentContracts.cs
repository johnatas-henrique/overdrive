using System;
using System.Collections.Generic;
using System.Linq;

namespace Overdrive.Content
{
    /// <summary>
    /// Canonical Content Pipeline lifecycle states (ADR-0003:66-84, GDD:124-152).
    /// CP_ prefix distinguishes them from Simulation Architecture states with the
    /// same names (GDD:136). <see cref="Ready"/> is TRANSITIONAL — the state machine
    /// enters it with a complete snapshot, forwards readiness, and leaves in the same
    /// operation (AC-SM5); it is never observable as a resting state.
    /// </summary>
    public enum ContentPipelineState
    {
        /// <summary>No race loaded; Shared only.</summary>
        Idle,

        /// <summary>Track bundle loading (track request issued).</summary>
        LoadingTrack,

        /// <summary>16 car bundles loading (track loaded, car requests issued).</summary>
        LoadingCars,

        /// <summary>All required slots completed — transitional (forward → Racing).</summary>
        Ready,

        /// <summary>Active race; content remains loaded.</summary>
        Racing,

        /// <summary>Transient: same-selection reload with zero Addressables I/O (GDD:146).</summary>
        RaceReconfigure,

        /// <summary>Instances destroyed and handles released (cleanup seam); emits completion.</summary>
        Unloading
    }

    /// <summary>
    /// The content selection for a race: the track and the participating teams.
    /// The canonical car identifier is the TEAM id — the Addressable address is
    /// <c>Cars/{teamId}/CarDefinition</c> (ADR-0003, Story 001 DONE). Equality uses
    /// <see cref="Identity"/>: <c>{TrackId}|{sorted TeamIds}</c> — the rule Story 003
    /// consumes for the reconfigure-vs-next-race decision (GDD:146-147).
    /// </summary>
    public readonly struct RaceContentSelection
    {
        /// <summary>Track identifier (address <c>Tracks/{trackId}/TrackData</c>).</summary>
        public readonly string TrackId;

        /// <summary>Sorted team identifiers — set-semantics (order-insensitive equality via <see cref="Identity"/>).</summary>
        public readonly IReadOnlyList<string> TeamIds;

        /// <summary>Creates a race selection; the team list is defensively sorted AND deduplicated (a duplicate id would otherwise poison the 17-parallel load — gate R3).</summary>
        public RaceContentSelection(string trackId, IReadOnlyList<string> teamIds)
        {
            TrackId = trackId ?? throw new ArgumentNullException(nameof(trackId));
            TeamIds = (teamIds ?? throw new ArgumentNullException(nameof(teamIds)))
                .Distinct()
                .OrderBy(t => t, StringComparer.Ordinal)
                .ToList();
        }

        /// <summary>Canonical identity string: <c>{TrackId}|{sorted,comma TeamIds}</c>.</summary>
        public static string Identity(RaceContentSelection selection) =>
            $"{selection.TrackId}|{string.Join(",", selection.TeamIds)}";
    }

    /// <summary>
    /// Immutable resource-inventory snapshot owned by the state machine. Set-semantics:
    /// duplicates impossible, ordering irrelevant, defensive copy on the getter.
    /// A degraded car slot occupies <see cref="CompletedRaceResourceIds"/> as a completion
    /// marker (GDD:144) — "completed" means loaded OR degraded-placeholder.
    /// </summary>
    public readonly struct ContentResourceState
    {
        private readonly HashSet<string> _completed;

        /// <summary>True when the Shared group is loaded (seeded at construction by composition).</summary>
        public readonly bool IsSharedLoaded;

        /// <summary>Defensive copy of the completed race resource IDs (1 track + 16 car slots).</summary>
        public IReadOnlyCollection<string> CompletedRaceResourceIds => _completed.ToList();

        /// <summary>Creates a snapshot; the completed set is defensively copied.</summary>
        public ContentResourceState(bool isSharedLoaded, IReadOnlyCollection<string> completedRaceResourceIds)
        {
            IsSharedLoaded = isSharedLoaded;
            _completed = completedRaceResourceIds == null
                ? new HashSet<string>(StringComparer.Ordinal)
                : new HashSet<string>(completedRaceResourceIds, StringComparer.Ordinal);
        }

        /// <summary>Returns a new snapshot with one additional completed resource id.</summary>
        public ContentResourceState WithCompleted(string resourceId) =>
            new ContentResourceState(IsSharedLoaded, _completed.Concat(new[] { resourceId }).ToList());

        /// <summary>True when the completed set is exactly the expected set (set equality).</summary>
        public bool Matches(IReadOnlyCollection<string> expectedIds) =>
            _completed.SetEquals(expectedIds ?? Array.Empty<string>());
    }
}
