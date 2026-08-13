using System;
using Overdrive.Input;
using Overdrive.Simulation;

namespace Overdrive.Multiplayer
{
    /// <summary>
    /// Delegate raised by an <see cref="INetworkSimulationDriver"/> when remote inputs arrive
    /// for a simulation frame. Remote inputs are delivered as a batch per frame.
    /// </summary>
    /// <param name="simulationFrame">The simulation frame the inputs belong to.</param>
    /// <param name="inputs">The remote inputs received for that frame.</param>
    public delegate void RemoteInputsReceivedHandler(uint simulationFrame, ReadOnlySpan<NetworkInput> inputs);

    /// <summary>
    /// Project-owned seam between the manual simulation accumulator and a future Beta
    /// real-time networking driver (ADR-0017 D2). MVP publishes the seam with NO provider
    /// implementation. The driver is a guest of the manual accumulator: it never calls
    /// <c>Physics.Simulate</c>, owns no <c>FixedUpdate</c>, and never writes
    /// <c>SimulationState</c>.
    /// </summary>
    public interface INetworkSimulationDriver
    {
        /// <summary>
        /// Submits the local player's inputs for a simulation frame to the driver.
        /// </summary>
        /// <param name="localInputs">The local inputs captured for the frame.</param>
        /// <param name="simulationFrame">The simulation frame the inputs belong to.</param>
        void SubmitInputs(ReadOnlySpan<SimulationInput> localInputs, uint simulationFrame);

        /// <summary>
        /// Serializes the selected owner-car data from the published snapshot into the
        /// caller-provided destination buffer.
        /// </summary>
        /// <param name="snapshot">The published simulation snapshot.</param>
        /// <param name="destination">Caller-provided storage for the serialized bytes.</param>
        /// <returns>The number of bytes written, or a negative value on failure.</returns>
        int SerializeSnapshot(in PublishedSimulationSnapshot snapshot, Span<byte> destination);

        /// <summary>
        /// Resets driver-side prediction state so Simulation can restore every car to the
        /// captured pre-replay kinematic state (ADR-0017 D4).
        /// </summary>
        /// <param name="toFrame">The frame to roll back to.</param>
        /// <param name="state">The corrective kinematic state for all simulated cars.</param>
        void Rollback(uint toFrame, in SimulationRollbackState state);

        /// <summary>
        /// Returns the driver's best-effort predicted input for a car at a frame.
        /// </summary>
        /// <param name="carId">The car to query.</param>
        /// <param name="frame">The simulation frame.</param>
        /// <returns>The predicted input, or a default input when unavailable.</returns>
        NetworkInput GetPredictedInput(int carId, uint frame);

        /// <summary>
        /// Raised when remote inputs arrive for a simulation frame.
        /// </summary>
        event RemoteInputsReceivedHandler RemoteInputsReceived;
    }
}
