using System;
using System.Collections.Generic;
using Overdrive.Input;

namespace Overdrive.Simulation
{
    /// <summary>
    /// Flags describing a lifecycle edge event in the parallel ghost edge stream (ADR-0008).
    /// Bitfield so future edge kinds (Resume, load failure) extend without format changes.
    /// </summary>
    [Flags]
    public enum EdgeEventFlags : byte
    {
        /// <summary>No edge — reserved value, never recorded.</summary>
        None = 0,
        /// <summary>A Pause edge consumed at a tick boundary.</summary>
        Pause = 1,
        /// <summary>A Resume edge (future; Alpha ghost playback may record it).</summary>
        Resume = 2,
    }

    /// <summary>
    /// The MVP ghost-recording seam (ADR-0008): the Kernel's continuous-recordable buffer.
    /// Records exactly one authoritative SimulationInput per completed Racing tick, plus
    /// parallel standalone Pause edges, and discards unconditionally in MVP. Pure C# — no
    /// Unity engine types. Never serialized, never compared, never shown in UI, never
    /// uploaded during MVP.
    /// </summary>
    public interface IGhostRecorder
    {
        /// <summary>
        /// Appends one continuous record for a completed Racing tick.
        /// </summary>
        /// <param name="input">The authoritative per-tick SimulationInput.</param>
        /// <param name="tickIndex">
        /// The simulationStepCount of the completed tick (POST-increment — the record
        /// carries the index of the tick that just finished, per the GDD ghost format).
        /// </param>
        void RecordTick(SimulationInput input, uint tickIndex);

        /// <summary>
        /// Appends one standalone lifecycle edge for a tick index (parallel stream).
        /// </summary>
        /// <param name="tickIndex">The current simulationStepCount at edge consumption.</param>
        /// <param name="flags">The edge kind (Pause/Resume).</param>
        void RecordEdgeEvent(uint tickIndex, EdgeEventFlags flags);

        /// <summary>Returns count and serializability statistics.</summary>
        GhostBufferStats GetStats();

        /// <summary>
        /// Discards the entire buffer unconditionally (MVP: on Results, Forfeit, load
        /// failure, or Idle). Idempotent; never serializes.
        /// </summary>
        void Discard();

        /// <summary>
        /// True while the buffer may be serialized later. False only after an attempted
        /// append beyond the 22,500-tick cap (never auto-recovers).
        /// </summary>
        bool IsSerializable { get; }
    }

    /// <summary>Snapshot of buffer state for diagnostics and overflow detection.</summary>
    public readonly struct GhostBufferStats
    {
        /// <summary>Number of continuous records currently held.</summary>
        public readonly int ContinuousCount;

        /// <summary>Number of edge events currently held.</summary>
        public readonly int EdgeCount;

        /// <summary>Whether the buffer is currently serializable.</summary>
        public readonly bool IsSerializable;

        /// <summary>Creates a stats snapshot.</summary>
        public GhostBufferStats(int continuousCount, int edgeCount, bool isSerializable)
        {
            ContinuousCount = continuousCount;
            EdgeCount = edgeCount;
            IsSerializable = isSerializable;
        }
    }

    /// <summary>
    /// The in-memory MVP recordable buffer (ADR-0008). Continuous stream: authoritative
    /// accelerateOut/brakeOut/steerOut (3 × float32 = 12 bytes/tick) + separate uint tick
    /// index per record (GDD ghost requirement — the index lives in the record, not the
    /// header). Pause edges go to a parallel standalone edge stream (5 bytes/event).
    /// Cap 22,500 ticks: on attempted overflow the record is silently dropped and
    /// <see cref="IsSerializable"/> becomes false permanently — oldest ticks are never
    /// discarded (TR-ghost-003).
    /// </summary>
    public sealed class GhostBuffer : IGhostRecorder
    {
        /// <summary>One continuous record: the 3 authoritative axes + the tick index.</summary>
        private readonly struct ContinuousRecord
        {
            public readonly float AccelerateOut;
            public readonly float BrakeOut;
            public readonly float SteerOut;
            public readonly uint TickIndex;

            public ContinuousRecord(SimulationInput input, uint tickIndex)
            {
                AccelerateOut = input.AccelerateOut;
                BrakeOut = input.BrakeOut;
                SteerOut = input.SteerOut;
                TickIndex = tickIndex;
            }
        }

        /// <summary>One standalone edge event in the parallel stream.</summary>
        private readonly struct EdgeEvent
        {
            public readonly uint TickIndex;
            public readonly EdgeEventFlags Flags;

            public EdgeEvent(uint tickIndex, EdgeEventFlags flags)
            {
                TickIndex = tickIndex;
                Flags = flags;
            }
        }

        /// <summary>Default MVP cap (ADR-0008, TR-ghost-003): 22,500 ticks.</summary>
        public const uint DefaultMaxTicks = 22500;

        private readonly uint _maxTicks;
        private readonly List<ContinuousRecord> _continuous;
        private readonly List<EdgeEvent> _edges;
        private bool _overflowed;

        /// <summary>
        /// Creates a buffer with the given tick cap.
        /// </summary>
        /// <param name="maxTicks">Maximum continuous records before overflow; default 22,500.</param>
        public GhostBuffer(uint maxTicks = DefaultMaxTicks)
        {
            _maxTicks = maxTicks;
            _continuous = new List<ContinuousRecord>();
            _edges = new List<EdgeEvent>();
        }

        /// <inheritdoc />
        public bool IsSerializable => !_overflowed;

        /// <inheritdoc />
        public void RecordTick(SimulationInput input, uint tickIndex)
        {
            // TR-ghost-003: never discard oldest; on attempted overflow beyond the cap the
            // record is dropped silently and the buffer becomes permanently non-serializable
            // (a full valid race at exactly 22,500 ticks remains serializable).
            if (_continuous.Count >= _maxTicks)
            {
                _overflowed = true;
                return;
            }
            _continuous.Add(new ContinuousRecord(input, tickIndex));
        }

        /// <inheritdoc />
        public void RecordEdgeEvent(uint tickIndex, EdgeEventFlags flags)
        {
            if (flags == EdgeEventFlags.None)
                return;
            _edges.Add(new EdgeEvent(tickIndex, flags));
        }

        /// <inheritdoc />
        public GhostBufferStats GetStats()
        {
            return new GhostBufferStats(_continuous.Count, _edges.Count, IsSerializable);
        }

        /// <inheritdoc />
        public void Discard()
        {
            _continuous.Clear();
            _edges.Clear();
            // The "never auto-recovers" contract is per-session: an explicit wipe (Results /
            // Forfeit / load failure / Idle) re-arms the buffer for the NEXT race. Without
            // this, a race that overflowed would leave the same instance permanently
            // non-serializable across sessions despite being empty.
            _overflowed = false;
        }

        /// <summary>Reads the recorded continuous inputs (test/diagnostic access; MVP never serializes).</summary>
        public int ContinuousCount => _continuous.Count;

        /// <summary>Reads the recorded edge event count.</summary>
        public int EdgeCount => _edges.Count;

        /// <summary>Returns the continuous record's tick index at the given position (test access).</summary>
        public uint GetContinuousTickIndex(int index) => _continuous[index].TickIndex;

        /// <summary>Returns the continuous record's accelerate value at the given position (test access).</summary>
        public float GetContinuousAccelerate(int index) => _continuous[index].AccelerateOut;

        /// <summary>Returns the continuous record's brake value at the given position (test access).</summary>
        public float GetContinuousBrake(int index) => _continuous[index].BrakeOut;

        /// <summary>Returns the continuous record's steer value at the given position (test access).</summary>
        public float GetContinuousSteer(int index) => _continuous[index].SteerOut;

        /// <summary>Returns the edge event's tick index at the given position (test access).</summary>
        public uint GetEdgeTickIndex(int index) => _edges[index].TickIndex;

        /// <summary>Returns the edge event's flags at the given position (test access).</summary>
        public EdgeEventFlags GetEdgeFlags(int index) => _edges[index].Flags;
    }
}
