using System;
using System.Collections.Generic;
using Overdrive.Input;

namespace Overdrive.Simulation
{
    /// <summary>
    /// Authoritative lifecycle state of the simulation. Simulation is the sole writer;
    /// no other system mutates SimulationState directly (ADR-0001).
    /// </summary>
    public enum SimulationState
    {
        Idle,
        Loading,
        Countdown,
        Racing,
        Paused,
        Finished,
        Results
    }

    /// <summary>
    /// Read-only gate over the current <see cref="SimulationState"/> used by the driver
    /// and domain systems to decide whether an active tick may execute.
    /// The gate is a test seam published by the Kernel; Simulation owns transitions.
    /// </summary>
    public interface ISimulationStateGate
    {
        SimulationState State { get; }
        bool CanTick { get; }
        bool TryTransition(SimulationState state);

        /// <summary>
        /// The Countdown or Racing state active immediately before the current pause,
        /// or null when not Paused / no valid pause entry was recorded (Story 004).
        /// Exposed on the gate so the driver can publish the Paused lifecycle snapshot
        /// with its Simulation-owned resumeState without reaching into a concrete type.
        /// </summary>
        SimulationState? ResumeState { get; }

        /// <summary>True when the current Results state was entered by forfeit (Story 005).</summary>
        bool IsForfeit { get; }

        /// <summary>Forfeit lap count; valid only when <see cref="IsForfeit"/> (Story 005).</summary>
        int ForfeitLapCount { get; }

        /// <summary>Forfeit race time in seconds; valid only when <see cref="IsForfeit"/> (Story 005).</summary>
        float RaceTimeAtForfeit { get; }
    }

    /// <summary>
    /// Story 002 compatibility name for callers that still construct a permissive gate.
    /// Production code should compose <see cref="SimulationStateMachine"/> directly;
    /// this adapter keeps the existing driver evidence source-compatible while all
    /// lifecycle behavior is implemented by the real machine.
    /// </summary>
    [Obsolete("Use SimulationStateMachine in production composition.")]
    public sealed class SimulationStateGate : SimulationStateMachine
    {
        public SimulationStateGate(SimulationState initial = SimulationState.Idle)
            : base(initial, null, true)
        {
        }
    }

    /// <summary>
    /// Invoked by the driver before accumulator evaluation (beginning of Update).
    /// Focus-loss and pause lifecycle boundaries hook here — no elapsed time is
    /// accumulated on the frame the hook fires (ADR-0001).
    /// </summary>
    public interface IPreAccumulatorLifecycleHook
    {
        void BeforeAccumulator(SimulationState state);
    }

    /// <summary>
    /// Injectable physics authority. Production implementation calls
    /// <c>Physics.Simulate(fixedDeltaTime)</c> with <c>Physics.simulationMode = SimulationMode.Script</c>;
    /// tests substitute a spy to avoid a real physics scene (ADR-0001).
    /// </summary>
    public interface IPhysicsSimulator
    {
        void Simulate(float fixedDeltaTime);
    }

    /// <summary>
    /// Raised by Simulation when the lifecycle state changes. Consumed by the
    /// recordable buffer (Story 008) and presentation-layer observers.
    /// </summary>
    public readonly struct SimulationStateChanged
    {
        public readonly SimulationState Previous;
        public readonly SimulationState Current;

        public SimulationStateChanged(SimulationState previous, SimulationState current)
        {
            Previous = previous;
            Current = current;
        }
    }

    /// <summary>
    /// Raised exactly once per pause entry, AFTER the existing
    /// <see cref="SimulationStateChanged"/> event, carrying the originating
    /// Countdown or Racing state as <see cref="ResumeState"/> (Story 004,
    /// ADR-0001). Never raised on resume — resume is a plain state transition.
    /// </summary>
    public readonly struct PausedStateChanged
    {
        /// <summary>The Countdown or Racing state active immediately before the pause.</summary>
        public readonly SimulationState ResumeState;

        /// <summary>The state Paused was entered from (identical to ResumeState for valid entries).</summary>
        public readonly SimulationState Previous;

        public PausedStateChanged(SimulationState resumeState, SimulationState previous)
        {
            ResumeState = resumeState;
            Previous = previous;
        }
    }

    /// <summary>Read-only prior-state boundary assembled and owned by Simulation (ADR-0001).</summary>
    public sealed class TickStartSnapshot
    {
        private readonly CarState[] _cars;
        private readonly FuelState[] _fuel;
        private readonly TireState[] _tires;
        private readonly PitServiceCommand[] _pit;
        private readonly AIInput[] _ai;

        public IReadOnlyList<CarState> CarState => SnapshotCopies.Copy(_cars);
        public IReadOnlyList<FuelState> FuelState => SnapshotCopies.Copy(_fuel);
        public IReadOnlyList<TireState> TireState => SnapshotCopies.Copy(_tires);
        public IReadOnlyList<PitServiceCommand> PitServiceCommand => SnapshotCopies.Copy(_pit);
        public IReadOnlyList<AIInput> AIInput => SnapshotCopies.Copy(_ai);
        public TrackData TrackData { get; }
        public SimulationState SimulationState { get; }
        public DifficultyProfile DifficultyProfile { get; }

        public TickStartSnapshot(
            IReadOnlyList<CarState> cars,
            IReadOnlyList<FuelState> fuel,
            IReadOnlyList<TireState> tires,
            IReadOnlyList<PitServiceCommand> pit,
            IReadOnlyList<AIInput> ai,
            TrackData track,
            SimulationState state,
            DifficultyProfile difficulty)
        {
            _cars = SnapshotCopies.Copy(cars);
            _fuel = SnapshotCopies.Copy(fuel);
            _tires = SnapshotCopies.Copy(tires);
            _pit = SnapshotCopies.Copy(pit);
            _ai = SnapshotCopies.Copy(ai);
            TrackData = track;
            SimulationState = state;
            DifficultyProfile = difficulty;
        }
    }

    /// <summary>
    /// Immutable terminal-state snapshot captured by Simulation at the lifecycle
    /// transition to Finished. No PhysX, Fuel, Tire, Pit, collision, or tactical AI
    /// runs after finish (ADR-0001). Schema per ADR-0001 §PostFinishSnapshot.
    /// </summary>
    public sealed class PostFinishSnapshot
    {
        private readonly CarState[] _cars;
        private readonly FuelState[] _fuel;
        private readonly TireState[] _tires;
        private readonly ResultClassification[] _resultClassification;

        public IReadOnlyList<CarState> CarState => SnapshotCopies.Copy(_cars);
        public IReadOnlyList<FuelState> FuelState => SnapshotCopies.Copy(_fuel);
        public IReadOnlyList<TireState> TireState => SnapshotCopies.Copy(_tires);
        public IReadOnlyList<ResultClassification> ResultClassification => SnapshotCopies.Copy(_resultClassification);
        public RsmState Rsm { get; }
        public SimulationState SimulationState { get; }

        /// <summary>Final simulation tick counter (ADR-0001).</summary>
        public int SimulationStepCount { get; }

        /// <summary>Final racing tick counter (ADR-0001).</summary>
        public int ActiveRaceStepCount { get; }

        /// <summary>Race or Qualifying — selects destination screen (ADR-0001).</summary>
        public ResultKind ResultKind => Rsm.ResultKind;

        /// <summary>Final clock value (Simulation sim_time, ADR-0001).</summary>
        public float RaceTime { get; }

        /// <summary>Final session mode (ADR-0001).</summary>
        public RaceMode RaceMode { get; }

        /// <summary>Player classification at the finished transition (GDD schema: "player classification").</summary>
        public ResultClassification PlayerClassification { get; }

        public PostFinishSnapshot(
            IReadOnlyList<CarState> cars,
            IReadOnlyList<FuelState> fuel,
            IReadOnlyList<TireState> tires,
            RsmState rsm,
            SimulationState state,
            IReadOnlyList<ResultClassification> resultClassification = null,
            int simulationStepCount = 0,
            int activeRaceStepCount = 0,
            float raceTime = 0f,
            RaceMode raceMode = RaceMode.Race,
            ResultClassification playerClassification = Overdrive.Simulation.ResultClassification.Finished)
        {
            _cars = SnapshotCopies.Copy(cars);
            _fuel = SnapshotCopies.Copy(fuel);
            _tires = SnapshotCopies.Copy(tires);
            _resultClassification = resultClassification == null
                ? Array.Empty<ResultClassification>()
                : SnapshotCopies.Copy(resultClassification);
            Rsm = rsm;
            SimulationState = state;
            SimulationStepCount = simulationStepCount;
            ActiveRaceStepCount = activeRaceStepCount;
            RaceTime = raceTime;
            RaceMode = raceMode;
            PlayerClassification = playerClassification;
        }
    }

    /// <summary>
    /// Immutable consumer-facing snapshot published after transition resolution.
    /// Consumers (AI, HUD, Camera, RSM) read it; no consumer mutation can reach
    /// Simulation-owned state (ADR-0001, TR-sim-011).
    /// </summary>
    public sealed class PublishedSimulationSnapshot
    {
        /// <summary>
        /// Terminal-state snapshot captured at Finished, or null for non-ticking
        /// lifecycle snapshots (Idle, Loading, Paused, Finished, Results without a
        /// captured terminal). Check <see cref="HasTerminal"/> before dereferencing.
        /// </summary>
        public PostFinishSnapshot Terminal { get; }

        /// <summary>True when this snapshot carries a captured terminal state.</summary>
        public bool HasTerminal => Terminal != null;

        /// <summary>
        /// Simulation-owned originating state recorded when this snapshot is the
        /// Paused lifecycle publication; null otherwise (Story 004, GDD schema).
        /// </summary>
        public SimulationState? ResumeState { get; }

        /// <summary>Authoritative count of completed physics ticks, including Countdown ticks.</summary>
        public int SimulationStepCount { get; }

        /// <summary>Authoritative count of completed ticks that started in Racing.</summary>
        public int ActiveRaceStepCount { get; }

        /// <summary>Race time in seconds. This is derived from ActiveRaceStepCount, not wall time.</summary>
        public float SimTime { get; }

        // GDD/ADR domain names (snake_case) exposed for schema-level consumers that read the
        // published snapshot fields verbatim. PascalCase is the public C# surface.
        public int simulationStepCount => SimulationStepCount;
        public int activeRaceStepCount => ActiveRaceStepCount;
        public float sim_time => SimTime;

        public IReadOnlyList<CarState> CarState => Terminal?.CarState ?? System.Array.Empty<CarState>();
        public IReadOnlyList<FuelState> FuelState => Terminal?.FuelState ?? System.Array.Empty<FuelState>();
        public IReadOnlyList<TireState> TireState => Terminal?.TireState ?? System.Array.Empty<TireState>();

        /// <summary>
        /// The lifecycle state of this snapshot. Defaults to <see cref="SimulationState.Idle"/>
        /// when no terminal was captured — non-ticking lifecycle snapshots (Idle, Loading,
        /// Paused) carry their state via their dedicated event or <see cref="ResumeState"/>,
        /// not this property.
        /// </summary>
        public SimulationState SimulationState => Terminal?.SimulationState ?? SimulationState.Idle;

        /// <summary>True when this snapshot carries a forfeit result (Results after Return to Menu).</summary>
        public bool IsForfeit { get; }

        /// <summary>Forfeit lap count, or -1 when not a forfeit snapshot (ADR-0001).</summary>
        public int ForfeitLapCount { get; }

        /// <summary>Forfeit race time, or 0 when not a forfeit snapshot (ADR-0001).</summary>
        public float RaceTimeAtForfeit { get; }

        // ---- RSM-originated terminal copies (ADR-0001: immutable copies in Finished/Results) ----

        /// <summary>True when RSM terminal data is present (Finished/Results after a normal completion).</summary>
        public bool HasRsmTerminalData { get; }

        /// <summary>Race or Qualifying — selects destination screen (RSM-originated copy).</summary>
        public ResultKind ResultKind { get; }

        /// <summary>True once finish resolution completed (RSM-originated copy).</summary>
        public bool ResolutionComplete { get; }

        /// <summary>Player final race time in seconds (RSM-originated copy).</summary>
        public float PlayerFinishTime { get; }

        /// <summary>True while UI Presentation shows the terminal presentation (RSM-originated copy).</summary>
        public bool TerminalPresentationRequest { get; }

        /// <summary>Resolved finish order (RSM-originated immutable copy), or null.</summary>
        public ResolvedFinishOrder ResolvedFinishOrder { get; }

        /// <summary>
        /// Story 001 compatibility constructor. Counter fields default to zero so existing
        /// consumers continue to compile while the driver adds authoritative values.
        /// </summary>
        public PublishedSimulationSnapshot(PostFinishSnapshot terminal)
            : this(terminal, 0, 0, 0f, null)
        {
        }

        /// <summary>
        /// Constructs an immutable published snapshot with the driver's counters.
        /// Example: <c>new PublishedSimulationSnapshot(terminal, 12, 8, 8f / 60f)</c>.
        /// </summary>
        public PublishedSimulationSnapshot(
            PostFinishSnapshot terminal,
            int simulationStepCount = 0,
            int activeRaceStepCount = 0,
            float simTime = 0f,
            SimulationState? resumeState = null)
        {
            Terminal = terminal; // null allowed for non-ticking lifecycle snapshots
            SimulationStepCount = simulationStepCount;
            ActiveRaceStepCount = activeRaceStepCount;
            SimTime = simTime;
            ResumeState = resumeState;
            IsForfeit = false;
            ForfeitLapCount = -1;
            RaceTimeAtForfeit = 0f;
            HasRsmTerminalData = terminal?.Rsm != null &&
                                 (terminal.SimulationState == SimulationState.Finished ||
                                  terminal.SimulationState == SimulationState.Results);
            ResultKind = terminal?.Rsm.ResultKind ?? ResultKind.Race;
            ResolutionComplete = terminal?.Rsm.ResolutionComplete ?? false;
            PlayerFinishTime = terminal?.Rsm.PlayerFinishTime ?? 0f;
            TerminalPresentationRequest = terminal?.Rsm.TerminalPresentationRequest ?? false;
            ResolvedFinishOrder = null; // driver fills from the resolved order when present
        }

        /// <summary>
        /// Full constructor for the driver's decorated publications — carries counters,
        /// an optional forfeit payload, and optional RSM terminal data.
        /// </summary>
        public PublishedSimulationSnapshot(
            PostFinishSnapshot terminal,
            int simulationStepCount,
            int activeRaceStepCount,
            float simTime,
            SimulationState? resumeState,
            bool isForfeit,
            int forfeitLapCount,
            float raceTimeAtForfeit,
            bool hasRsmTerminalData,
            ResultKind resultKind,
            bool resolutionComplete,
            float playerFinishTime,
            bool terminalPresentationRequest,
            ResolvedFinishOrder resolvedFinishOrder)
        {
            Terminal = terminal;
            SimulationStepCount = simulationStepCount;
            ActiveRaceStepCount = activeRaceStepCount;
            SimTime = simTime;
            ResumeState = resumeState;
            IsForfeit = isForfeit;
            ForfeitLapCount = forfeitLapCount;
            RaceTimeAtForfeit = raceTimeAtForfeit;
            HasRsmTerminalData = hasRsmTerminalData;
            ResultKind = resultKind;
            ResolutionComplete = resolutionComplete;
            PlayerFinishTime = playerFinishTime;
            TerminalPresentationRequest = terminalPresentationRequest;
            ResolvedFinishOrder = resolvedFinishOrder;
        }
    }

    /// <summary>
    /// One ordered seam in the canonical 14-step tick pipeline. Steps are interfaces,
    /// not implementations — owning Core epics deliver them (ADR-0001).
    /// </summary>
    public interface ISimulationPipelineStep
    {
        void Execute(SimulationTickContext context);
    }

    /// <summary>
    /// Mutable internal carrier for a single invocation spine; never published to consumers.
    /// Carries the single latest raw sample (reused across multi-tick frames) and the
    /// resolved per-car inputs produced at Step 14 (ADR-0001).
    /// </summary>
    public sealed class SimulationTickContext
    {
        public const float FIXED_DT = 1f / 60f;

        public RawInputSample RawInputSample { get; internal set; }
        public SimulationInput SimulationInput { get; internal set; }
        public TickStartSnapshot TickStartSnapshot { get; internal set; }
        public ResolvedCarInput[] ResolvedCarInputs { get; internal set; }

        /// <summary>
        /// Set by the kernel from the <c>pauseEdge</c> argument of
        /// <see cref="SimulationKernel.ExecuteTick"/>; consumed exactly once by the
        /// pause boundary step (GDD step 4, Story 004).
        /// </summary>
        public bool PauseEdge { get; internal set; }

        /// <summary>
        /// Set by the pause boundary step when a pause edge or pending performance
        /// pause is consumed. The kernel halts the spine immediately after that step;
        /// steps 4-14 do not execute on the interrupting tick (ADR-0001).
        /// </summary>
        public bool PauseBoundaryReached { get; internal set; }

        /// <summary>
        /// Set by the post-physics session-start step on the tick that reaches GO.
        /// Downstream continuous-input recording must skip this boundary tick.
        /// </summary>
        public bool IsGoTick { get; internal set; }

        // ---- Post-physics readout (GDD steps 9/10/11, Story 005) ----

        /// <summary>Final CarState[] after the physics readout step (index 8), frozen for the finish boundary.</summary>
        public IReadOnlyList<CarState> PostTickCarState { get; set; }

        /// <summary>Final FuelState[] after the resource readout steps, frozen for the finish boundary.</summary>
        public IReadOnlyList<FuelState> PostTickFuelState { get; set; }

        /// <summary>Final TireState[] after the resource readout steps, frozen for the finish boundary.</summary>
        public IReadOnlyList<TireState> PostTickTireState { get; set; }

        /// <summary>
        /// Pre-computed by the driver BEFORE ExecuteTick so the RSM consume step (index 10)
        /// can freeze the post-increment counters into PostFinishSnapshot. The driver owns
        /// the authoritative counters (ADR-0001) and applies these values after the tick.
        /// </summary>
        public int NextSimulationStepCount { get; internal set; }

        /// <summary>Pre-computed next racing tick counter (see <see cref="NextSimulationStepCount"/>).</summary>
        public int NextActiveRaceStepCount { get; internal set; }

        /// <summary>Set by RsmEvaluationStep (index 9) when RSM reports a finish; consumed once by RsmConsumeStep (index 10).</summary>
        public FinishDetected? PendingFinish { get; internal set; }

        /// <summary>Set by RsmConsumeStep (index 10) after capturing PostFinishSnapshot and resolving the order.</summary>
        public ResolvedFinishOrder ResolvedFinishOrder { get; internal set; }

        /// <summary>Captured terminal snapshot produced by RsmConsumeStep (index 10) for Step 12 publication.</summary>
        public PostFinishSnapshot TerminalSnapshot { get; internal set; }

        /// <summary>
        /// Cached AI input for the next tick. Produced by Step 13 during active ticks;
        /// cleared (empty) by <see cref="AiSkipStep"/> when the published state is
        /// Finished/Results/Idle/Loading/Paused (AC-4.8j).
        /// </summary>
        public IReadOnlyList<AIInput> CachedAiInput { get; set; }

        /// <summary>
        /// Step 12 supplies the domain snapshot that the driver decorates with its
        /// authoritative counters. No terminal arrays are synthesized by the driver.
        /// </summary>
        public PublishedSimulationSnapshot PublishedSnapshot { get; private set; }

        /// <summary>Publishes the immutable Step 12 snapshot for the owning kernel.</summary>
        public void PublishSnapshot(PublishedSimulationSnapshot snapshot)
        {
            PublishedSnapshot = snapshot ?? throw new ArgumentNullException(nameof(snapshot));
        }
    }

    /// <summary>
    /// Receives the same resolved per-car input sequence as a domain subsystem.
    /// Fuel, Tire, and Vehicle Physics consume the identical ascending-carId sequence
    /// in the same tick (AC-3.7).
    /// </summary>
    public interface IResolvedCarInputConsumer
    {
        void Consume(IReadOnlyList<ResolvedCarInput> inputs, float fixedDeltaTime);
    }

    /// <summary>
    /// Turns one raw input sample into the authoritative per-tick SimulationInput.
    /// Contract owned by the Kernel; implementation delivered by the Input epic
    /// (TickProcessor implements this seam, keeping Unity.InputSystem out of the
    /// simulation assembly).
    /// </summary>
    public interface ISimulationInputProcessor
    {
        SimulationInput Process(RawInputSample sample, bool pausePending);
    }

    /// <summary>
    /// Canonical fourteen-step invocation spine. Each step is an injectable seam;
    /// the constructor enforces exactly 14 steps so a misconfigured pipeline fails fast.
    /// The kernel captures one raw sample per render frame and reuses it across ticks.
    /// The tick processor invocation (Step 2) receives the single latest immutable
    /// <see cref="RawInputSample"/> — the Input epic delivers the concrete processor.
    /// </summary>
    public sealed class SimulationKernel
    {
        private readonly ISimulationPipelineStep[] _steps;
        private readonly ISimulationInputProcessor _inputProcessor;
        private RawInputSample _latest;
        private bool _hasSample;

        public const int StepCount = 14;

        public event Action<SimulationStateChanged> StateChanged;
        public PublishedSimulationSnapshot PublishedSnapshot { get; private set; }

        /// <summary>
        /// Replaces the latest published snapshot after the driver decorates the Step 12
        /// domain snapshot with its authoritative counters. No terminal data is synthesized.
        /// </summary>
        internal void PublishSnapshot(PublishedSimulationSnapshot snapshot)
        {
            PublishedSnapshot = snapshot ?? throw new ArgumentNullException(nameof(snapshot));
        }

        public SimulationKernel(ISimulationInputProcessor inputProcessor, params ISimulationPipelineStep[] steps)
        {
            _inputProcessor = inputProcessor ?? throw new ArgumentNullException(nameof(inputProcessor));
            if (steps == null || steps.Length != StepCount)
                throw new ArgumentException("Exactly 14 pipeline steps are required.", nameof(steps));
            _steps = SnapshotCopies.Copy(steps);
        }

        /// <summary>Captures once per render frame; subsequent ticks reuse this exact sample.</summary>
        public void CaptureLatestRawSample(RawInputSample sample)
        {
            _latest = sample;
            _hasSample = true;
        }

        /// <summary>Executes the spine with one sample and explicit fixed duration.</summary>
        public SimulationTickContext ExecuteTick(
            bool pauseEdge = false,
            int nextSimulationStepCount = 0,
            int nextActiveRaceStepCount = 0)
        {
            if (!_hasSample)
                throw new InvalidOperationException("A raw sample must be captured before the first tick.");
            var context = new SimulationTickContext
            {
                RawInputSample = _latest,
                SimulationInput = _inputProcessor.Process(_latest, pauseEdge),
                PauseEdge = pauseEdge,
                NextSimulationStepCount = nextSimulationStepCount,
                NextActiveRaceStepCount = nextActiveRaceStepCount
            };
            for (int i = 0; i < _steps.Length; i++)
            {
                _steps[i].Execute(context);
                if (context.PauseBoundaryReached)
                    break;
            }

            return context;
        }

        /// <summary>Raises a lifecycle transition event; domain ownership remains with Simulation.</summary>
        public void NotifyStateChanged(SimulationState previous, SimulationState current)
        {
            StateChanged?.Invoke(new SimulationStateChanged(previous, current));
        }

        /// <summary>
        /// Dispatches one identical, ascending-carId input sequence to Fuel, Tire,
        /// and Vehicle Physics seams in the same tick (AC-3.7).
        /// </summary>
        public static void DispatchResolvedCarInputs(
            ResolvedCarInput[] inputs,
            IResolvedCarInputConsumer fuel,
            IResolvedCarInputConsumer tire,
            IResolvedCarInputConsumer vehiclePhysics)
        {
            if (inputs == null || fuel == null || tire == null || vehiclePhysics == null)
                throw new ArgumentNullException();
            fuel.Consume(inputs, SimulationTickContext.FIXED_DT);
            tire.Consume(inputs, SimulationTickContext.FIXED_DT);
            vehiclePhysics.Consume(inputs, SimulationTickContext.FIXED_DT);
        }

        /// <summary>
        /// Resolves one input per car in strict ascending car-id order. The player's
        /// SimulationInput is combined with each car's cached AIInput (AC-3.7).
        /// </summary>
        public static ResolvedCarInput[] ResolveCarInputs(
            IReadOnlyList<int> carIds,
            SimulationInput player,
            IReadOnlyList<AIInput> ai)
        {
            if (carIds == null || ai == null || carIds.Count != ai.Count)
                throw new ArgumentException("Car and AI lists must have equal length.");
            var result = new ResolvedCarInput[carIds.Count];
            for (int i = 0; i < result.Length; i++)
            {
                if (i > 0 && carIds[i] <= carIds[i - 1])
                    throw new ArgumentException("carIds must be strictly ascending.");
                if (ai[i].CarId != carIds[i])
                    throw new ArgumentException("AI car id does not match car id.");
                result[i] = new ResolvedCarInput(carIds[i], player, ai[i]);
            }
            return result;
        }
    }
}
