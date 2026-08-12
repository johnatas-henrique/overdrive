using System;

namespace Overdrive.Simulation
{
    /// <summary>
    /// Permutation Congruential Generator (PCG) — the O'Neill reference implementation,
    /// PCG-XSH-RR variant with 64-bit state and 32-bit output. This is the ONLY gameplay
    /// PRNG on the simulation path (ADR-0001): deterministic state transition, explicit
    /// 64-bit seed, named helpers, and no dependence on UnityEngine.Random or System.Random.
    /// </summary>
    /// <remarks>
    /// Algorithm: <c>state' = state * 6364136223846793005UL + inc</c>; output = xorshifted
    /// with random rotation. Construction follows pcg32_srandom_r: state = 0, advance once,
    /// add initState, advance once. Golden vectors verified against pcg-random.org
    /// (memory #98): <c>Pcg32(12345, 0)</c> NextUInt sequence
    /// <c>304133009, 2564000426, 1539170214, 2267019874, 321857903, 29877282, 4241239986, 528810775</c>.
    /// Thread-safety: not required — one instance per simulation session.
    /// </remarks>
    public sealed class Pcg32
    {
        /// <summary>The PCG multiplier constant (O'Neill reference).</summary>
        private const ulong Multiplier = 6364136223846793005UL;

        private ulong _state;
        private ulong _inc;

        /// <summary>
        /// Creates a PCG32 instance with the given state and sequence seed.
        /// <c>inc = (initSeq &lt;&lt; 1) | 1</c> per the reference; identical seeds produce
        /// identical output streams (determinism requirement).
        /// </summary>
        /// <param name="initState">The initial state seed.</param>
        /// <param name="initSeq">The sequence selector; contributes to the increment.</param>
        public Pcg32(ulong initState, ulong initSeq)
        {
            _state = 0;
            _inc = (initSeq << 1) | 1;
            Step();          // advance once with state = 0
            _state += initState;
            Step();          // advance once with the mixed state
        }

        /// <summary>Returns the next 32-bit unsigned value in the deterministic stream.</summary>
        public uint NextUInt()
        {
            ulong oldState = _state;
            Step();
            uint xorshifted = (uint)(((oldState >> 18) ^ oldState) >> 27);
            uint rot = (uint)(oldState >> 59);
            return (xorshifted >> (int)rot) | (xorshifted << (int)((-rot) & 31));
        }

        /// <summary>
        /// Returns a float in [0, 1) using the standard <c>pcg32_random_f</c> conversion:
        /// the top 24 bits of the next output scaled by 1/16777216. The sequence differs
        /// from <c>NextUInt()</c> consumption order — each call draws one fresh output.
        /// </summary>
        public float NextFloat01()
        {
            return (NextUInt() >> 8) * (1.0f / 16777216.0f);
        }

        /// <summary>Returns an integer in [0, maxExclusive).</summary>
        public int NextInt(int maxExclusive)
        {
            if (maxExclusive <= 0)
                throw new ArgumentOutOfRangeException(nameof(maxExclusive),
                    "maxExclusive must be positive.");
            return (int)(NextUInt() % (uint)maxExclusive);
        }

        /// <summary>Returns an integer in [minInclusive, maxExclusive).</summary>
        public int NextInt(int minInclusive, int maxExclusive)
        {
            if (maxExclusive <= minInclusive)
                throw new ArgumentOutOfRangeException(nameof(maxExclusive),
                    "maxExclusive must be greater than minInclusive.");
            return minInclusive + NextInt(maxExclusive - minInclusive);
        }

        private void Step()
        {
            _state = _state * Multiplier + _inc;
        }
    }
}
