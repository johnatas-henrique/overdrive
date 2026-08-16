using System;
using System.Collections.Generic;
using Unity.Mathematics;

namespace Overdrive.Multiplayer
{
    /// <summary>
    /// Fixed-length 16-element wrapper around <see cref="float3"/> values with zero
    /// allocation (no array or list backing storage). Elements are copied at
    /// construction. Indexed access outside [0,15] throws
    /// <see cref="ArgumentOutOfRangeException"/>.
    /// </summary>
    public readonly struct Vector3Array16
    {
        public const int Capacity = 16;

        private readonly float3 _v00, _v01, _v02, _v03, _v04, _v05, _v06, _v07;
        private readonly float3 _v08, _v09, _v10, _v11, _v12, _v13, _v14, _v15;

        /// <summary>
        /// The fixed element count (always 16).
        /// </summary>
        public int Count => Capacity;

        /// <summary>
        /// Constructs a wrapper copying exactly 16 elements from the source.
        /// </summary>
        /// <param name="source">The source elements; must contain exactly 16.</param>
        /// <exception cref="ArgumentNullException">When <paramref name="source"/> is null.</exception>
        /// <exception cref="ArgumentException">When <paramref name="source"/> does not contain exactly 16 elements.</exception>
        public Vector3Array16(IReadOnlyList<float3> source)
        {
            if (source == null) throw new ArgumentNullException(nameof(source));
            if (source.Count != Capacity) throw new ArgumentException($"Source must contain exactly {Capacity} elements.", nameof(source));

            _v00 = source[0]; _v01 = source[1]; _v02 = source[2]; _v03 = source[3];
            _v04 = source[4]; _v05 = source[5]; _v06 = source[6]; _v07 = source[7];
            _v08 = source[8]; _v09 = source[9]; _v10 = source[10]; _v11 = source[11];
            _v12 = source[12]; _v13 = source[13]; _v14 = source[14]; _v15 = source[15];
        }

        /// <summary>
        /// Constructs a wrapper from an enumerable, consuming exactly 16 elements.
        /// </summary>
        /// <param name="source">The source elements; must yield exactly 16.</param>
        /// <exception cref="ArgumentNullException">When <paramref name="source"/> is null.</exception>
        /// <exception cref="ArgumentException">When <paramref name="source"/> does not yield exactly 16 elements.</exception>
        public static Vector3Array16 FromEnumerable(IEnumerable<float3> source)
        {
            if (source == null) throw new ArgumentNullException(nameof(source));

            var values = new float3[Capacity];
            int count = 0;
            foreach (float3 value in source)
            {
                if (count >= Capacity) throw new ArgumentException($"Source must contain exactly {Capacity} elements.", nameof(source));
                values[count++] = value;
            }
            if (count != Capacity) throw new ArgumentException($"Source must contain exactly {Capacity} elements.", nameof(source));

            return new Vector3Array16(values);
        }

        /// <summary>
        /// Returns the element at the given index.
        /// </summary>
        /// <param name="index">The element index (0..15).</param>
        /// <exception cref="ArgumentOutOfRangeException">When <paramref name="index"/> is outside [0,15].</exception>
        public float3 this[int index]
        {
            get
            {
                switch (index)
                {
                    case 0: return _v00;
                    case 1: return _v01;
                    case 2: return _v02;
                    case 3: return _v03;
                    case 4: return _v04;
                    case 5: return _v05;
                    case 6: return _v06;
                    case 7: return _v07;
                    case 8: return _v08;
                    case 9: return _v09;
                    case 10: return _v10;
                    case 11: return _v11;
                    case 12: return _v12;
                    case 13: return _v13;
                    case 14: return _v14;
                    case 15: return _v15;
                    default: throw new ArgumentOutOfRangeException(nameof(index), index, $"Index must be within [0, {Capacity - 1}].");
                }
            }
        }
    }

    /// <summary>
    /// Fixed-length 16-element wrapper around <see cref="quaternion"/> values with zero
    /// allocation (no array or list backing storage). Elements are copied at
    /// construction. Indexed access outside [0,15] throws
    /// <see cref="ArgumentOutOfRangeException"/>.
    /// </summary>
    public readonly struct QuaternionArray16
    {
        public const int Capacity = 16;

        private readonly quaternion _v00, _v01, _v02, _v03, _v04, _v05, _v06, _v07;
        private readonly quaternion _v08, _v09, _v10, _v11, _v12, _v13, _v14, _v15;

        /// <summary>
        /// The fixed element count (always 16).
        /// </summary>
        public int Count => Capacity;

        /// <summary>
        /// Constructs a wrapper copying exactly 16 elements from the source.
        /// </summary>
        /// <param name="source">The source elements; must contain exactly 16.</param>
        /// <exception cref="ArgumentNullException">When <paramref name="source"/> is null.</exception>
        /// <exception cref="ArgumentException">When <paramref name="source"/> does not contain exactly 16 elements.</exception>
        public QuaternionArray16(IReadOnlyList<quaternion> source)
        {
            if (source == null) throw new ArgumentNullException(nameof(source));
            if (source.Count != Capacity) throw new ArgumentException($"Source must contain exactly {Capacity} elements.", nameof(source));

            _v00 = source[0]; _v01 = source[1]; _v02 = source[2]; _v03 = source[3];
            _v04 = source[4]; _v05 = source[5]; _v06 = source[6]; _v07 = source[7];
            _v08 = source[8]; _v09 = source[9]; _v10 = source[10]; _v11 = source[11];
            _v12 = source[12]; _v13 = source[13]; _v14 = source[14]; _v15 = source[15];
        }

        /// <summary>
        /// Constructs a wrapper from an enumerable, consuming exactly 16 elements.
        /// </summary>
        /// <param name="source">The source elements; must yield exactly 16.</param>
        /// <exception cref="ArgumentNullException">When <paramref name="source"/> is null.</exception>
        /// <exception cref="ArgumentException">When <paramref name="source"/> does not yield exactly 16 elements.</exception>
        public static QuaternionArray16 FromEnumerable(IEnumerable<quaternion> source)
        {
            if (source == null) throw new ArgumentNullException(nameof(source));

            var values = new quaternion[Capacity];
            int count = 0;
            foreach (quaternion value in source)
            {
                if (count >= Capacity) throw new ArgumentException($"Source must contain exactly {Capacity} elements.", nameof(source));
                values[count++] = value;
            }
            if (count != Capacity) throw new ArgumentException($"Source must contain exactly {Capacity} elements.", nameof(source));

            return new QuaternionArray16(values);
        }

        /// <summary>
        /// Returns the element at the given index.
        /// </summary>
        /// <param name="index">The element index (0..15).</param>
        /// <exception cref="ArgumentOutOfRangeException">When <paramref name="index"/> is outside [0,15].</exception>
        public quaternion this[int index]
        {
            get
            {
                switch (index)
                {
                    case 0: return _v00;
                    case 1: return _v01;
                    case 2: return _v02;
                    case 3: return _v03;
                    case 4: return _v04;
                    case 5: return _v05;
                    case 6: return _v06;
                    case 7: return _v07;
                    case 8: return _v08;
                    case 9: return _v09;
                    case 10: return _v10;
                    case 11: return _v11;
                    case 12: return _v12;
                    case 13: return _v13;
                    case 14: return _v14;
                    case 15: return _v15;
                    default: throw new ArgumentOutOfRangeException(nameof(index), index, $"Index must be within [0, {Capacity - 1}].");
                }
            }
        }
    }

    /// <summary>
    /// Corrective kinematic state for all 16 simulated cars, captured pre-replay and
    /// restored by the rollback pipeline (ADR-0017 D4). Contains position, rotation,
    /// linear velocity, and angular velocity for each car, in a zero-allocation form.
    /// </summary>
    public readonly struct SimulationRollbackState
    {
        /// <summary>
        /// Per-car world positions (16 elements).
        /// </summary>
        public readonly Vector3Array16 Positions;

        /// <summary>
        /// Per-car world rotations (16 elements).
        /// </summary>
        public readonly QuaternionArray16 Rotations;

        /// <summary>
        /// Per-car linear velocities (16 elements).
        /// </summary>
        public readonly Vector3Array16 LinearVelocities;

        /// <summary>
        /// Per-car angular velocities (16 elements).
        /// </summary>
        public readonly Vector3Array16 AngularVelocities;

        /// <summary>
        /// Constructs the rollback state from the four per-car kinematic arrays.
        /// </summary>
        /// <param name="positions">Per-car world positions.</param>
        /// <param name="rotations">Per-car world rotations.</param>
        /// <param name="linearVelocities">Per-car linear velocities.</param>
        /// <param name="angularVelocities">Per-car angular velocities.</param>
        public SimulationRollbackState(
            Vector3Array16 positions,
            QuaternionArray16 rotations,
            Vector3Array16 linearVelocities,
            Vector3Array16 angularVelocities)
        {
            Positions = positions;
            Rotations = rotations;
            LinearVelocities = linearVelocities;
            AngularVelocities = angularVelocities;
        }
    }
}
