using System;
using UnityEngine;

namespace Overdrive.Content.Unity
{
    /// <summary>
    /// <see cref="IMemoryPressureSource"/> — used/available approximation: reserved memory
    /// over a configurable available ceiling (default 4 GB). The precise metric is measured
    /// at the assembly gate (TD-026); this approximation lets the memory policy
    /// (AC-MB3/4/5, GDD:181-189) run in the MVP.
    /// </summary>
    public sealed class MemoryPressureSource : IMemoryPressureSource
    {
        private readonly long _availableBytes;

        /// <summary>Creates the source with an available-memory ceiling (bytes).</summary>
        public MemoryPressureSource(long availableBytes)
        {
            _availableBytes = availableBytes > 0 ? availableBytes : 4L * 1024 * 1024 * 1024;
        }

        /// <inheritdoc />
        public float Pressure
        {
            get
            {
                long used = UnityEngine.Profiling.Profiler.GetTotalReservedMemoryLong();
                return _availableBytes <= 0 ? 0f : (float)used / _availableBytes;
            }
        }
    }

    /// <summary><see cref="IClock"/> over <c>Time.realtimeSinceStartup</c>.</summary>
    public sealed class ClockSource : IClock
    {
        /// <inheritdoc />
        public float Time => UnityEngine.Time.realtimeSinceStartup;
    }

    /// <summary><see cref="IDiagnosticsSink"/> over <c>Debug.Log</c>.</summary>
    public sealed class DiagnosticsSink : IDiagnosticsSink
    {
        /// <inheritdoc />
        public void LogWarning(string message) => Debug.LogWarning($"[Content] {message}");

        /// <inheritdoc />
        public void LogError(string message) => Debug.LogError($"[Content] {message}");
    }

    /// <summary>
    /// Default <see cref="IQualityReductionRequest"/> — logs the request (the target tier and
    /// its application are Settings-owned; a real wiring replaces this in the composition).
    /// </summary>
    public sealed class DiagnosticQualityReductionRequest : IQualityReductionRequest
    {
        private readonly IDiagnosticsSink _sink;

        /// <summary>Creates the request that logs via <paramref name="sink"/>.</summary>
        public DiagnosticQualityReductionRequest(IDiagnosticsSink sink)
        {
            _sink = sink ?? throw new ArgumentNullException(nameof(sink));
        }

        /// <inheritdoc />
        public void RequestQualityReduction(string reason) => _sink.LogWarning($"Quality reduction requested: {reason}");
    }
}
