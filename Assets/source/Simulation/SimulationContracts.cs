using System;
using System.Collections.Generic;
using Overdrive.Input;

namespace Overdrive.Simulation
{
    /// <summary>Session mode selected by the Race Session Manager.</summary>
    public enum RaceMode : byte
    {
        Race,
        Qualifying
    }

    /// <summary>
    /// Immutable content-to-simulation grid handoff. Race sessions use GridSlots;
    /// qualifying uses PitBoxSlot. The simulation intentionally performs no further
    /// assignment validation; content and Grid &amp; Start own that responsibility.
    /// </summary>
    public sealed class GridAssignment
    {
        private readonly int[] _gridSlots;

        /// <summary>Race grid slots, copied at construction and never exposed mutably.</summary>
        public IReadOnlyList<int> GridSlots => SnapshotCopies.Copy(_gridSlots);

        /// <summary>Qualifying pit-box slot, or -1 when this is a race assignment.</summary>
        public int PitBoxSlot { get; }

        /// <summary>Creates a race assignment from the supplied slot sequence.</summary>
        public GridAssignment(IReadOnlyList<int> gridSlots)
        {
            if (gridSlots == null) throw new ArgumentNullException(nameof(gridSlots));
            _gridSlots = SnapshotCopies.Copy(gridSlots);
            PitBoxSlot = -1;
        }

        /// <summary>Creates a qualifying assignment for one pit-box slot.</summary>
        public GridAssignment(int pitBoxSlot)
        {
            _gridSlots = Array.Empty<int>();
            PitBoxSlot = pitBoxSlot;
        }

        /// <summary>
        /// Creates an assignment carrying both representations. This overload is useful
        /// to content adapters that deserialize one shared contract for both modes.
        /// </summary>
        public GridAssignment(IReadOnlyList<int> gridSlots, int pitBoxSlot)
        {
            if (gridSlots == null) throw new ArgumentNullException(nameof(gridSlots));
            _gridSlots = SnapshotCopies.Copy(gridSlots);
            PitBoxSlot = pitBoxSlot;
        }

        /// <summary>Creates a race grid assignment from the supplied slot sequence.</summary>
        public static GridAssignment ForRace(IReadOnlyList<int> gridSlots) => new GridAssignment(gridSlots);

        /// <summary>Creates a qualifying assignment with the given pit-box slot.</summary>
        public static GridAssignment ForQualifying(int pitBoxSlot) => new GridAssignment(pitBoxSlot);
    }

    /// <summary>Abortive content failure categories defined by ADR-0003.</summary>
    public enum ContentErrorType : byte
    {
        Track,
        Shared,
        Catalog
    }

    /// <summary>Kernel-owned lifecycle error metadata forwarded to UI and diagnostics.</summary>
    public readonly struct LifecycleErrorRaised
    {
        public readonly string Reason;
        public readonly ContentErrorType ContentErrorType;

        public LifecycleErrorRaised(string reason, ContentErrorType contentErrorType)
        {
            Reason = reason;
            ContentErrorType = contentErrorType;
        }
    }

    /// <summary>Per-car authoritative state produced by Vehicle Physics readout (Step 9).</summary>
    public readonly struct CarState
    {
        public readonly int CarId;
        public readonly float Position;

        public CarState(int carId, float position = 0f)
        {
            CarId = carId;
            Position = position;
        }
    }

    /// <summary>Per-car fuel level owned by FuelSystem.</summary>
    public readonly struct FuelState
    {
        public readonly float Amount;

        public FuelState(float amount = 0f) => Amount = amount;
    }

    /// <summary>Per-car tire wear owned by TireSystem.</summary>
    public readonly struct TireState
    {
        public readonly float Wear;

        public TireState(float wear = 0f) => Wear = wear;
    }

    /// <summary>Pit-service contract written by PitStopSystem at Step 9b, carried in TickStartSnapshot (ADR-0011).</summary>
    public readonly struct PitServiceCommand
    {
        public readonly int CarId;
        public readonly bool Requested;

        public PitServiceCommand(int carId, bool requested)
        {
            CarId = carId;
            Requested = requested;
        }
    }

    /// <summary>Cached AI input produced at Step 13 for consumption at the next tick's Step 2.</summary>
    public readonly struct AIInput
    {
        public readonly int CarId;
        public readonly float Accelerate;

        public AIInput(int carId, float accelerate = 0f)
        {
            CarId = carId;
            Accelerate = accelerate;
        }
    }

    /// <summary>Immutable track geometry reference, loaded once at race init.</summary>
    public readonly struct TrackData
    {
        public readonly int Version;

        public TrackData(int version = 0) => Version = version;
    }

    /// <summary>Immutable difficulty profile snapshotted at race init (ADR-0004).</summary>
    public readonly struct DifficultyProfile
    {
        public readonly int Level;

        public DifficultyProfile(int level = 0) => Level = level;
    }

    /// <summary>RSM-owned state carried into snapshots; resolution rules live in the RSM epic.</summary>
    public readonly struct RsmState
    {
        public readonly int EventCount;

        public RsmState(int eventCount = 0) => EventCount = eventCount;
    }

    /// <summary>Transition request produced by RSM and consumed by Simulation.</summary>
    public readonly struct TransitionRequest
    {
        public readonly SimulationState Target;

        public TransitionRequest(SimulationState target) => Target = target;
    }

    /// <summary>
    /// Immutable replay boundary captured at GO before the first Racing tick
    /// (ADR-0008; expanded by Story 008 with race/content identity, seed, grid,
    /// cars, resources, and Perfect Start state).
    /// </summary>
    public readonly struct ReplayInitialState
    {
        public readonly SimulationState SimulationState;
        public readonly TrackData TrackData;

        public ReplayInitialState(SimulationState state, TrackData trackData)
        {
            SimulationState = state;
            TrackData = trackData;
        }
    }

    /// <summary>
    /// One resolved per-car input: the player's SimulationInput combined with the
    /// car's cached AIInput. Consumed identically by Fuel, Tire, and Vehicle Physics
    /// in strict ascending-carId order (AC-3.7).
    /// </summary>
    public readonly struct ResolvedCarInput
    {
        public readonly int CarId;
        public readonly SimulationInput PlayerInput;
        public readonly AIInput AI;

        public ResolvedCarInput(int carId, SimulationInput playerInput, AIInput ai)
        {
            CarId = carId;
            PlayerInput = playerInput;
            AI = ai;
        }
    }

    /// <summary>
    /// Copy helpers for immutable snapshot boundaries. Returns fresh array copies on
    /// every read so no consumer reference can reach the snapshot's internal arrays.
    /// </summary>
    internal static class SnapshotCopies
    {
        public static T[] Copy<T>(IReadOnlyList<T> source)
        {
            if (source == null) throw new ArgumentNullException(nameof(source));
            var result = new T[source.Count];
            for (int i = 0; i < result.Length; i++)
                result[i] = source[i];
            return result;
        }
    }
}
