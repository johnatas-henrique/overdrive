using System;
using Overdrive.Simulation;

namespace Overdrive.Input
{
    /// <summary>
    /// Production capture adapter consumed by the Simulation driver. Scheme resolution
    /// and raw capture remain Input-owned, while the driver controls when this single
    /// call occurs relative to accumulator evaluation.
    /// </summary>
    public sealed class InputFrameCapture : IFrameInputCapture
    {
        private readonly InputContextController _controller;

        /// <summary>Creates a frame capture wrapper around the Input context controller.</summary>
        public InputFrameCapture(InputContextController controller)
        {
            _controller = controller ?? throw new ArgumentNullException(nameof(controller));
        }

        /// <summary>
        /// Resolves the active device scheme and captures one raw sample. This is the only
        /// production implementation of the simulation-facing per-frame capture seam.
        /// </summary>
        public RawInputSample CaptureLatest()
        {
            _controller.ResolveActiveScheme();
            return _controller.CaptureLatestRawSample();
        }

        /// <summary>Reads whether Input has a pending gameplay Pause edge.</summary>
        public bool HasPendingPauseEdge => _controller.HasPendingPauseEdge;

        /// <summary>Consumes the Pause edge after the first tick that receives it.</summary>
        public void ConsumePendingPauseEdge()
        {
            _controller.ConsumePendingPauseEdge();
        }
    }
}
