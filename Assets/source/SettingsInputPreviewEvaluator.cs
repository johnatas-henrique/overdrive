namespace Overdrive.Input
{
    /// <summary>
    /// Renders the effect of a working <see cref="ControlProfile"/> on a raw input sample (AC-C11/AC-50).
    /// Sanitizes the working profile (which enforces the Input-owned trigger threshold per ADR-0004) and runs
    /// it through a fresh <see cref="TickProcessor"/> (previous output 0.0, per GDD AC-C11) so the preview
    /// demonstrates the working dead-zone and EMA response curve. The first tick after Apply/Resume applies
    /// the same working profile but re-seeds the EMA from the sample (Story 006 AC-41) — the preview and the
    /// first resumed tick intentionally differ for a held analog.
    /// Example: <c>SimulationInput preview = SettingsInputPreviewEvaluator.Evaluate(sample, working, pausePending);</c>
    /// </summary>
    public static class SettingsInputPreviewEvaluator
    {
        public static SimulationInput Evaluate(RawInputSample sample, ControlProfile working, bool pausePending)
        {
            // Sanitize enforces the Input-owned trigger threshold (ADR-0004:138) — the working profile never
            // overrides it (AC-50); stick dead-zone and EMA alphas come from the working values.
            ControlProfile sanitized = ControlProfile.Sanitize(working, out _);
            TickProcessor processor = new TickProcessor(sanitized);

            return processor.ProcessTick(sample, pausePending);
        }
    }
}
