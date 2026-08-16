using System;
using System.Collections.Generic;

namespace Overdrive.Simulation
{
    /// <summary>
    /// Result of a determinism pair run: the per-tick maximum position delta across all
    /// cars and the PASS/FAIL verdict against the ≤0.001 tolerance (AC-5.1).
    /// </summary>
    public sealed class DeterminismComparisonReport
    {
        /// <summary>Maximum absolute position delta observed across all ticks and cars.</summary>
        public readonly float MaxPositionDelta;

        /// <summary>The tolerance the run was compared against (0.001 units).</summary>
        public readonly float Tolerance;

        /// <summary>Number of simulated ticks compared.</summary>
        public readonly int TickCount;

        /// <summary>True when <see cref="MaxPositionDelta"/> ≤ <see cref="Tolerance"/>.</summary>
        public readonly bool Passed;

        /// <summary>Creates a comparison report.</summary>
        public DeterminismComparisonReport(float maxPositionDelta, float tolerance, int tickCount, bool passed)
        {
            MaxPositionDelta = maxPositionDelta;
            Tolerance = tolerance;
            TickCount = tickCount;
            Passed = passed;
        }
    }

    /// <summary>
    /// Seeds the simulation pipeline deterministically for a pair run. Forces the race's
    /// PCG32 seed and the sim RNG consumption order so two fresh runs consume identical
    /// randomness (AC-5.1/5.5 harness scaffold — the actual 16-car gate runs at the
    /// MVP-assembly gate with Vehicle Physics supplying positions).
    /// </summary>
    public interface ISeedInjection
    {
        /// <summary>Applies the given seed to the simulation before the run begins.</summary>
        void InjectSeed(ulong seed);
    }

    /// <summary>
    /// Kernel-owned determinism harness scaffold (AC-5.1/5.5). Wires seeds and compares
    /// outputs; it does NOT produce vehicle positions — Vehicle Physics supplies those at
    /// the MVP-assembly gate. Delivered here so the gate has the injection seam + pair-run
    /// comparator + evidence output ready.
    /// </summary>
    public interface IDeterminismHarness
    {
        /// <summary>
        /// Runs two fresh simulations with the injected seed and returns the comparison
        /// report (per-tick max position delta + PASS/FAIL vs 0.001).
        /// </summary>
        /// <param name="seed">The PCG32 seed both runs consume.</param>
        /// <param name="trackId">Track identity for the run (content lookup at the gate).</param>
        /// <param name="tickCount">Number of ticks each run simulates (AC-5.1: 300).</param>
        DeterminismComparisonReport RunPairComparison(ulong seed, string trackId, int tickCount);
    }

    /// <summary>
    /// The MVP-assembly gate comparator: given two per-tick position streams (run A and
    /// run B), computes the per-tick maximum delta across cars and the ≤0.001 verdict.
    /// Pure C# — the gate feeds Vehicle Physics output into this comparator.
    /// </summary>
    public static class DeterminismComparator
    {
        /// <summary>The AC-5.1/5.5 determinism tolerance in world units.</summary>
        public const float Tolerance = 0.001f;

        /// <summary>
        /// Compares two parallel position streams and produces the report.
        /// </summary>
        /// <param name="runA">Per-tick positions, indexed [tick][carId].</param>
        /// <param name="runB">Per-tick positions for the second run.</param>
        public static DeterminismComparisonReport Compare(
            IReadOnlyList<IReadOnlyList<float>> runA,
            IReadOnlyList<IReadOnlyList<float>> runB)
        {
            if (runA == null || runB == null)
                throw new ArgumentNullException(runA == null ? nameof(runA) : nameof(runB));
            if (runA.Count != runB.Count)
                throw new ArgumentException("Run streams must have equal tick counts.", nameof(runB));
            if (runA.Count == 0)
                throw new ArgumentException("Run streams must contain at least one tick.", nameof(runA));

            float maxDelta = 0f;
            bool nonFiniteDelta = false;
            int tickCount = runA.Count;
            for (int tick = 0; tick < tickCount; tick++)
            {
                IReadOnlyList<float> a = runA[tick];
                IReadOnlyList<float> b = runB[tick];
                if (a == null || b == null || a.Count != b.Count || a.Count == 0)
                    throw new ArgumentException(
                        $"Tick {tick}: car lists must be non-null, non-empty, and equal length.", nameof(runB));
                for (int car = 0; car < a.Count; car++)
                {
                    float delta = Math.Abs(a[car] - b[car]);
                    // NaN/Infinity deltas are never determinism: a non-finite position cannot
                    // satisfy the <= tolerance comparison (NaN > maxDelta is false, which would
                    // silently pass an empty/NaN stream).
                    if (!float.IsFinite(delta))
                        nonFiniteDelta = true;
                    else if (delta > maxDelta)
                        maxDelta = delta;
                }
            }

            bool passed = !nonFiniteDelta && maxDelta <= Tolerance;
            return new DeterminismComparisonReport(maxDelta, Tolerance, tickCount, passed);
        }
    }
}
