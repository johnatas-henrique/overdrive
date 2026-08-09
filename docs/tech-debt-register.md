## Technical Debt Register
Last updated: 2026-08-08
Total items: 3 | Estimated total effort: S×3

| ID | Category | Description | Files | Effort | Impact | Priority | Added | Sprint |
|----|----------|-------------|-------|--------|--------|----------|-------|--------|
| TD-001 | Coverage | Near-threshold trigger tests (AC-33): add cases for trigger values just above/below 0.05 inner to pin the boundary, mirroring the existing stick just-below/just-above cases. Accepted: Story 002 requirement met with exact-value assertions; boundary density is extra rigor, not a requirement. | RawCaptureDeadZoneTests.cs | S | Low | 1 | 2026-08-08 | Backlog |
| TD-002 | Coverage | Both-trigger normalization independence (AC-24/33): the pre-written test specs asked to exercise left and right triggers separately in the normalizer, but `NormalizeTrigger` is a symmetric pure function — one test covers it; both triggers are already exercised end-to-end via `GamepadTriggersCaptureRawAccelerateAndBrake` (capture). Accepted: redundant requirement, no behavioral gap. | RawCaptureDeadZoneTests.cs | S | Low | 1 | 2026-08-08 | Backlog |
| TD-003 | Coverage | Zero/one-tick capture counting (AC-59): the controller-seam test covers 1x/frame + monotonic; explicit zero-tick/one-tick counts belong to Story 004 (tick processor consuming the sample per tick), and the capture-before-accumulator ORDER is a Simulation-driver contract (ADR-0001:41) owned by the Simulation Kernel epic DoD. Accepted: scope boundary — Story 002 covers the seam, not the driver. | Story 004 + Simulation Kernel epic | S | Low | 2 | 2026-08-08 | Backlog |

### Notes
- Every entry records WHY it was accepted (Story 002 scope boundary or redundant requirement) — none is a behavioral defect.
- TD-003 has a defined destination (Story 004 + Kernel DoD) and should be closed when the tick processor is implemented.
