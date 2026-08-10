namespace Overdrive.Input
{
    /// <summary>
    /// Renders the effect of a working <see cref="ControlProfile"/> on a raw input sample (AC-11/AC-50).
    /// Constructs a <see cref="TickProcessor"/> with the working values and runs the canonical pipeline, so
    /// the preview shown while paused and the first 60 Hz tick after resume use the identical profile.
    /// Example: <c>SimulationInput preview = SettingsInputPreviewEvaluator.Evaluate(sample, working, pausePending);</c>
    /// </summary>
    public static class SettingsInputPreviewEvaluator
    {
                public static SimulationInput Evaluate(RawInputSample sample, ControlProfile working, bool pausePending)
        {
            TickProcessor processor = new TickProcessor(
                DeadZoneNormalizer.TriggerInnerThreshold, // Input-owned tuning: never overridden by a working profile (AC-50)
                working.StickInner,
                working.StickOuter,
                working.AccelerateAlpha,
                working.BrakeAlpha,
                working.SteerAlpha);

            return processor.ProcessTick(sample, pausePending);
        }
    }
}
