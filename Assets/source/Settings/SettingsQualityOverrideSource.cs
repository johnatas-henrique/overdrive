using System;
using Overdrive.Content;
using Overdrive.Simulation;

namespace Overdrive.Settings
{
    /// <summary>
    /// Unity-backed <see cref="IQualityOverrideSource"/> (story 3-14): translates
    /// <see cref="PerformanceMonitor.PerformanceStatusChanged"/> (Reduced/Restored,
    /// exactly once per transition) into the engine-free override port. The override
    /// NEVER rewrites persisted preferences — it only reports the active state;
    /// consumers remap behavior while reduced and restore on restore.
    /// </summary>
    public sealed class SettingsQualityOverrideSource : IQualityOverrideSource, IDisposable
    {
        private readonly PerformanceMonitor _monitor;
        private bool _isReduced;
        private bool _disposed;

        /// <summary>Subscribes to the monitor's transition events.</summary>
        public SettingsQualityOverrideSource(PerformanceMonitor monitor)
        {
            _monitor = monitor ?? throw new ArgumentNullException(nameof(monitor));
            _isReduced = monitor.IsReduced;
            monitor.PerformanceStatusChanged += OnStatusChanged;
        }

        /// <inheritdoc />
        public bool IsReduced => _isReduced;

        /// <inheritdoc />
        public event Action<bool> Changed;

        /// <summary>Unsubscribes from the monitor.</summary>
        public void Dispose()
        {
            if (_disposed)
                return;
            _disposed = true;
            _monitor.PerformanceStatusChanged -= OnStatusChanged;
        }

        private void OnStatusChanged(PerformanceSignal signal)
        {
            bool reduced = signal.Status == PerformanceStatus.Reduced;
            if (reduced == _isReduced)
                return; // exactly-once per transition — never re-emit
            _isReduced = reduced;
            try
            {
                Changed?.Invoke(reduced);
            }
            catch
            {
                // Subscriber faults are wiring defects (SafePublish pattern) — the
                // override state already transitioned; do not mask the source event.
                UnityEngine.Debug.LogError("IQualityOverrideSource.Changed subscriber threw.");
            }
        }
    }
}
