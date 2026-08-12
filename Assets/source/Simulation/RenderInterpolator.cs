using Unity.Mathematics;

namespace Overdrive.Simulation
{
    /// <summary>
    /// Pure render interpolation math for the manual simulation loop (ADR-0001 Interpolation
    /// Phases, GDD "2. Render Interpolation"). All methods are stateless and engine-free:
    /// the caller (the driver's deferred LateUpdate stage or a test) owns the visual buffer
    /// storage and injects remainders/snapshots, so every acceptance criterion of Story 006
    /// is verifiable as pure math without a Unity scene.
    /// </summary>
    public static class RenderInterpolator
    {
        /// <summary>
        /// Computes the interpolation factor α = remainder / FIXED_DT.
        /// Precondition: 0 ≤ remainder &lt; FIXED_DT (guaranteed by the driver's step
        /// processing; invalid accumulator input is Story 002/integration scope). The result
        /// is always in [0, 1) — the visual never leads ahead of the authoritative state.
        /// </summary>
        /// <param name="remainder">Sub-tick accumulator remainder after the last completed step.</param>
        /// <returns>The interpolation factor in [0, 1).</returns>
        public static float ComputeAlpha(float remainder)
        {
            return remainder / SimulationTickContext.FIXED_DT;
        }

        /// <summary>
        /// Interpolates between the previous and current completed step's CarState.
        /// Position uses component-wise <c>math.lerp</c> (finite inputs, no guard needed);
        /// rotation uses <c>math.slerp</c> with valid-input precedence: if the current
        /// rotation is valid it is used, else the previous valid rotation, else identity —
        /// the output is never non-finite (AC-2.5). Antipodal quaternion representations are
        /// treated as equivalent by <c>math.slerp</c> (shortest-path, normalized).
        /// </summary>
        /// <param name="previous">The previous completed step's CarState.</param>
        /// <param name="current">The current completed step's CarState.</param>
        /// <param name="alpha">Interpolation factor from <see cref="ComputeAlpha"/> in [0, 1).</param>
        /// <returns>A new CarState carrying the interpolated world position and rotation.</returns>
        public static CarState Interpolate(CarState previous, CarState current, float alpha)
        {
            float3 position = math.lerp(previous.Position3, current.Position3, alpha);

            bool previousValid = IsValidRotation(previous.Rotation);
            bool currentValid = IsValidRotation(current.Rotation);

            // Valid-input precedence: both valid → slerp previous→current; current invalid →
            // previous (slerp prev→prev); previous invalid → current (slerp cur→cur); both
            // invalid → identity. The output is never non-finite (AC-2.5).
            quaternion from = previousValid ? previous.Rotation : quaternion.identity;
            quaternion to = currentValid ? current.Rotation : quaternion.identity;
            if (!currentValid && previousValid)
                to = previous.Rotation;
            else if (!previousValid && currentValid)
                from = current.Rotation;

            quaternion rotation = math.slerp(from, to, alpha);
            return new CarState(current.CarId, position, rotation);
        }

        /// <summary>
        /// Advances the previous/current visual buffers by one completed step
        /// (previous ← current, current ← completedStep). A frame that completes N steps
        /// calls this N times; interpolation then reads only the final two completed states
        /// (visual snappiness rule, GDD L67/L69). Pure function — the caller owns the storage.
        /// </summary>
        /// <param name="previous">Buffer holding the previous completed step (updated in place).</param>
        /// <param name="current">Buffer holding the current completed step (updated in place).</param>
        /// <param name="completedStep">The newly completed step snapshot.</param>
        public static void AdvanceVisualBuffers(ref CarState previous, ref CarState current, CarState completedStep)
        {
            previous = current;
            current = completedStep;
        }

        /// <summary>
        /// A quaternion is valid for interpolation iff every component is finite and the
        /// quaternion is not zero-length. <c>math.slerp</c> does NOT guard NaN/zero inputs in
        /// Unity.Mathematics 1.3.3, so validity is enforced before any slerp call (AC-2.5).
        /// </summary>
        private static bool IsValidRotation(quaternion q)
        {
            return math.all(math.isfinite(q.value)) && math.lengthsq(q.value) > 0f;
        }
    }
}
