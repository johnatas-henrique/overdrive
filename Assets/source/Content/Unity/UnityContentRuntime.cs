using System;
using System.Collections.Generic;
using Overdrive.Simulation;

namespace Overdrive.Content.Unity
{
    /// <summary>
    /// Concrete <see cref="IRaceContentRuntime"/> + <see cref="IRaceContentAccumulator"/>.
    /// Populated by the orchestrator (Story 003) before readiness; read by Vehicle Physics /
    /// Grid &amp; Start to spawn car GameObjects. <see cref="IsValid"/> projects the
    /// <see cref="ContentStateMachine.HandoffValid"/> dual-path contract (valid from
    /// RaceLoadReady until the EARLIER of ContentUnloadComplete or a next-race transition).
    /// CarReferences are stored in TeamIds order (the orchestrator resolves the team index),
    /// so the grid consumer can pair CarReferences[i] with the selection's TeamIds[i].
    /// </summary>
    public sealed class UnityContentRuntime : IRaceContentRuntime, IRaceContentAccumulator
    {
        private readonly ContentStateMachine _sm;
        private readonly IContentInstantiator _instantiator;
        private readonly List<IAsyncLoadHandle> _retainedHandles = new List<IAsyncLoadHandle>();
        private object[] _carReferences = Array.Empty<object>();

        /// <summary>Creates the runtime; <paramref name="sm"/> drives IsValid; <paramref name="instantiator"/> destroys the track instance on release.</summary>
        public UnityContentRuntime(ContentStateMachine sm, IContentInstantiator instantiator)
        {
            _sm = sm ?? throw new ArgumentNullException(nameof(sm));
            _instantiator = instantiator ?? throw new ArgumentNullException(nameof(instantiator));
        }

        /// <inheritdoc />
        public object TrackInstance { get; private set; }

        /// <summary>
        /// The loaded car prefabs in TeamIds order — a NULL entry marks a degraded slot
        /// (the car's bundle failed; a placeholder fills its grid position, GDD:144).
        /// </summary>
        public IReadOnlyList<object> CarReferences => _carReferences;

        /// <inheritdoc />
        public GridAssignment Grid { get; private set; }

        /// <inheritdoc />
        public bool IsValid => _sm.HandoffValid;

        /// <inheritdoc />
        public void Reset()
        {
            TrackInstance = null;
            _carReferences = Array.Empty<object>();
            // Retained handles are NOT released here — the orchestrator calls ReleaseRetainedHandles
            // at session reset (next-race has no cleanup path); Story 004 calls ReleaseAll for unload.
        }

        /// <inheritdoc />
        public void SetTrackInstance(object trackInstance) => TrackInstance = trackInstance;

        /// <inheritdoc />
        public void SetCarReference(int teamIndex, object carPrefab)
        {
            if (teamIndex < 0 || teamIndex >= _carReferences.Length)
                throw new ArgumentOutOfRangeException(nameof(teamIndex), teamIndex, "Car reference index outside the request set.");
            _carReferences[teamIndex] = carPrefab;
        }

        /// <inheritdoc />
        public void AddRetainedHandle(IAsyncLoadHandle handle) => _retainedHandles.Add(handle);

        /// <inheritdoc />
        public void ReleaseRetainedHandles()
        {
            foreach (IAsyncLoadHandle handle in _retainedHandles)
                handle.Release();
            _retainedHandles.Clear();
        }

        /// <inheritdoc />
        public void SetGrid(GridAssignment grid) => Grid = grid;

        /// <summary>Starts a fresh car slot set of the given size (called by the orchestrator at RequestCarLoads).</summary>
        public void BeginCarReferences(int count)
        {
            _carReferences = new object[count];
        }

        /// <summary>
        /// Full release for the unload path (Story 004): releases every retained handle AND
        /// destroys the instantiated track. Idempotent.
        /// </summary>
        public void ReleaseAll()
        {
            ReleaseRetainedHandles();
            if (TrackInstance != null)
            {
                _instantiator.ReleaseInstance(TrackInstance);
                TrackInstance = null;
            }
        }
    }
}
