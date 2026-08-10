namespace Overdrive.Input
{
    /// <summary>
    /// Owns the per-render-frame input sequence the Simulation driver invokes once per <c>Update()</c>
    /// (ADR-0001:41): resolve the scheme, capture the frame's raw sample once, then process one tick per
    /// fixed tick with that same sample. The Simulation driver owns the timing (how many ticks per frame
    /// via its accumulator); this module makes the ordering — resolve before capture, one sample per frame,
    /// Pause consumed on the first tick (ADR-0005) — structural instead of a documented convention.
    /// Example:
    /// <c>driver.BeginFrame(); while (accumulator &gt;= FIXED_DT) { var input = driver.Tick(); /* ... */ }</c>
    /// </summary>
    public sealed class InputFrameDriver
    {
        private readonly InputContextController _controller;
        private readonly TickProcessor _processor;
        private RawInputSample _frameSample;

        /// <summary>Creates the frame driver bound to a controller and tick processor.</summary>
        /// <param name="controller">The controller that resolves the scheme, captures samples, and holds the Pause edge.</param>
        /// <param name="processor">The tick processor that builds the per-tick SimulationInput.</param>
        public InputFrameDriver(InputContextController controller, TickProcessor processor)
        {
            _controller = controller ?? throw new System.ArgumentNullException(nameof(controller));
            _processor = processor ?? throw new System.ArgumentNullException(nameof(processor));
        }

        /// <summary>
        /// Starts a render frame: resolves the active scheme and captures the frame's raw sample once,
        /// returning it for telemetry/consumption. Call once per render Update, before any tick, per
        /// ADR-0001:41.
        /// </summary>
        public RawInputSample BeginFrame()
        {
            _controller.ResolveActiveScheme();
            _frameSample = _controller.CaptureLatestRawSample();
            return _frameSample;
        }

        /// <summary>
        /// Processes one simulation tick with the frame's sample. The first tick of the frame carries
        /// the pending Pause edge, which is consumed exactly once (ADR-0005); later ticks of the same
        /// frame reuse the sample with the edge already consumed. Call once per fixed tick while the
        /// Simulation accumulator has time to advance. Requires <see cref="BeginFrame"/> to have run.
        /// </summary>
        public SimulationInput Tick()
        {
            SimulationInput input = _processor.ProcessTick(_frameSample, _controller.HasPendingPauseEdge);
            _controller.ConsumePendingPauseEdge();
            return input;
        }
    }
}
