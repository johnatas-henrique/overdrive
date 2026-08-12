using System;
using System.Collections.Generic;
using Overdrive.Input;
using Unity.Mathematics;

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

        /// <summary>
        /// World position of the visual/authoritative body, interpolated by the render pass
        /// (ADR-0001). NOTE: the scalar-to-float3 constructors map track-progress to the x
        /// axis as a placeholder convention — the track spline mapping (ADR-0007) later
        /// overrides this when real world positions are read out.
        /// </summary>
        public readonly float3 Position3;

        /// <summary>World rotation of the visual/authoritative body, interpolated by the render pass (ADR-0001).</summary>
        public readonly quaternion Rotation;

        public CarState(int carId, float position = 0f)
        {
            CarId = carId;
            Position = position;
            Position3 = new float3(position, 0f, 0f);
            Rotation = quaternion.identity;
        }

        /// <summary>
        /// Creates a CarState with a full 3D world pose for render interpolation (ADR-0001).
        /// The scalar <paramref name="position"/> track-progress value maps to the x axis of
        /// <see cref="Position3"/> as a placeholder convention (ADR-0007 overrides later).
        /// </summary>
        public CarState(int carId, float position, quaternion rotation)
        {
            CarId = carId;
            Position = position;
            Position3 = new float3(position, 0f, 0f);
            Rotation = rotation;
        }

        /// <summary>
        /// Creates a CarState with an explicit 3D world pose (position and rotation) for
        /// render interpolation (ADR-0001). The x component mirrors the track-progress
        /// <see cref="Position"/> convention.
        /// </summary>
        public CarState(int carId, float3 position3, quaternion rotation)
        {
            CarId = carId;
            Position = position3.x;
            Position3 = position3;
            Rotation = rotation;
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

    /// <summary>How and why a car ended the session. Produced by RSM as part of
    /// <c>ResolvedFinishOrder</c>; consumed by Simulation for snapshot publishing and
    /// the forfeit lifecycle (ADR-0001).</summary>
    public enum ResultClassification : byte
    {
        /// <summary>Completed all laps under own power.</summary>
        Finished,

        /// <summary>Did Not Finish — mid-race abandonment (fuel empty + stopped, retirement).</summary>
        DNF,

        /// <summary>Return to Menu from Paused during Countdown or Racing.</summary>
        Forfeit
    }

    /// <summary>Selects the destination results screen; produced by RSM (ADR-0001).</summary>
    public enum ResultKind : byte
    {
        Race,
        Qualifying
    }

    /// <summary>One immutable entry of the resolved finish order (ADR-0018).</summary>
    public readonly struct FinishOrderEntry
    {
        public readonly int CarId;

        /// <summary>Final classification: Finished or DNF (Forfeit never reaches the resolver).</summary>
        public readonly ResultClassification Classification;

        /// <summary>Final position, or -1 for DNF (no fabricated position).</summary>
        public readonly int Position;

        /// <summary>Final or projected finish time in seconds.</summary>
        public readonly float Time;

        public FinishOrderEntry(int carId, ResultClassification classification, int position, float time)
        {
            CarId = carId;
            Classification = classification;
            Position = position;
            Time = time;
        }
    }

    /// <summary>
    /// Immutable RSM-owned finish resolution. Simulation consumes it once and publishes
    /// immutable copies; it never re-resolves (ADR-0001, ADR-0018).
    /// </summary>
    public sealed class ResolvedFinishOrder
    {
        private readonly FinishOrderEntry[] _entries;

        /// <summary>Entries ordered by finish position (ascending).</summary>
        public IReadOnlyList<FinishOrderEntry> EntriesByPosition => SnapshotCopies.Copy(_entries);

        public ResolvedFinishOrder(IReadOnlyList<FinishOrderEntry> entries)
        {
            _entries = SnapshotCopies.Copy(entries);
        }
    }

    /// <summary>
    /// Produced by RSM when the player crosses the finish line on the final lap or
    /// retires. Simulation consumes it at the finish boundary (GDD step 10/11).
    /// </summary>
    public readonly struct FinishDetected
    {
        public readonly ResultKind ResultKind;
        public readonly ResultClassification PlayerClassification;
        public readonly float PlayerFinishTime;

        public FinishDetected(ResultKind resultKind, ResultClassification playerClassification, float playerFinishTime)
        {
            ResultKind = resultKind;
            PlayerClassification = playerClassification;
            PlayerFinishTime = playerFinishTime;
        }
    }

    /// <summary>UI Presentation dismissal of the terminal presentation (Story 005).</summary>
    public readonly struct DismissTerminalPresentation
    {
    }

    /// <summary>Simulation → Content unload request (ADR-0001 Continue/Back from Results).</summary>
    public readonly struct ContentUnloadRequest
    {
    }

    /// <summary>
    /// Emitted by RSM when a forfeit aborts the session (ADR-0008). Story 008 consumes it
    /// to discard the recordable buffer; never carries a finish order.
    /// </summary>
    public readonly struct RaceAborted
    {
        public readonly ResultClassification Classification;

        public RaceAborted(ResultClassification classification) => Classification = classification;
    }

    /// <summary>
    /// RSM-owned per-tick evaluation seam (GDD step 10). Invoked as a pipeline step at
    /// SpineIndex 9 over the post-physics CarStates; returns non-null FinishDetected
    /// exactly when the finish or retirement condition is met.
    /// </summary>
    public interface IRaceSessionManagerEvaluate
    {
        FinishDetected? Evaluate(IReadOnlyList<CarState> carStates);
    }

    /// <summary>
    /// RSM-owned finish resolver (ADR-0018). Consumes ONE immutable PostFinishSnapshot
    /// (single read) and returns the resolved order; never re-runs physics or resources.
    /// </summary>
    public interface IFinishOrderResolver
    {
        ResolvedFinishOrder Resolve(PostFinishSnapshot snapshot);
    }

    /// <summary>RSM-owned state carried into snapshots; resolution rules live in the RSM epic.</summary>
    public readonly struct RsmState
    {
        public readonly int EventCount;

        /// <summary>Race or Qualifying — selects the destination results screen (ADR-0001).</summary>
        public readonly ResultKind ResultKind;

        /// <summary>True once finish resolution has completed (immediately true for qualifying).</summary>
        public readonly bool ResolutionComplete;

        /// <summary>The player's final race time in seconds (RSM-originated).</summary>
        public readonly float PlayerFinishTime;

        /// <summary>True while UI Presentation should display the terminal presentation.</summary>
        public readonly bool TerminalPresentationRequest;

        public RsmState(
            int eventCount = 0,
            ResultKind resultKind = ResultKind.Race,
            bool resolutionComplete = false,
            float playerFinishTime = 0f,
            bool terminalPresentationRequest = false)
        {
            EventCount = eventCount;
            ResultKind = resultKind;
            ResolutionComplete = resolutionComplete;
            PlayerFinishTime = playerFinishTime;
            TerminalPresentationRequest = terminalPresentationRequest;
        }
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
