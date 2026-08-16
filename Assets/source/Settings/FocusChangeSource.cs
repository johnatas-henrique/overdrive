using System;
using UnityEngine;

namespace Overdrive.Settings
{
    /// <summary>
    /// <see cref="IFocusChangeSource"/> adapter over <see cref="Application.focusChanged"/>
    /// (Story 005 DR5 focus-loss seam). Forwards the global focus event; a fake drives
    /// loss/re-focus deterministically in tests.
    /// </summary>
    public sealed class FocusChangeSource : IFocusChangeSource, IDisposable
    {
        /// <summary>Raised when the application gains (true) or loses (false) focus.</summary>
        public event Action<bool> FocusChanged;

        private bool _disposed;

        /// <summary>Subscribes to <see cref="Application.focusChanged"/>.</summary>
        public FocusChangeSource()
        {
            Application.focusChanged += OnFocusChanged;
        }

        private void OnFocusChanged(bool focused)
        {
            FocusChanged?.Invoke(focused);
        }

        /// <summary>Unsubscribes from <see cref="Application.focusChanged"/> (idempotent).</summary>
        public void Dispose()
        {
            if (_disposed) return;
            Application.focusChanged -= OnFocusChanged;
            _disposed = true;
        }
    }
}
